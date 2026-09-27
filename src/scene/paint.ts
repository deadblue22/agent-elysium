// The painted look (?paint=1, ?paint=2; docs/paint.md): the whole frame repainted as an oil
// painting of the papercut diorama, after the original's painted scenes and Rostov's concept
// paintings. One pass takes over the film grade's output and paints it, in steps:
//   1. the graded frame, box-filtered down to the paint resolution and mapped onto the
//      painter's palette (blues toward teal, a greyed base, saturated accents kept, cold darks
//      and warm lights);
//   2. its structure tensor (colour gradients), smoothed: the flow the strokes follow;
//   3. an anisotropic Kuwahara filter (Kyprianidis et al. 2009, with the polynomial sector
//      weights of 2010): flat patches of colour drawn out along the flow, edges kept;
//   4. brush strokes: two layers of oriented strokes on a jittered grid, each carrying two
//      paints picked from the flattened image along its axis and varied a little, the fine
//      layer only where the image has detail, now and then a palette-knife mark; a stroke's
//      paint gives way at strong edges, and a warm ground shows where strokes leave gaps;
//   5. the relief of the paint (stroke ridges, bristle grooves, the canvas weave) lit from the
//      upper left, dark accents on the dark side of edges, and the log's column left crisp.
// Sizes are in frame px (the 1600 x 900 composition, src/scene/camera.ts FRAME), so any window
// size shows the same painting; the costly steps run at the frame's css resolution or below,
// whatever the pixel ratio, and only the last step runs per device pixel.
import {
  DataTexture, HalfFloatType, LinearFilter, NearestFilter, RepeatWrapping, ShaderMaterial, UnsignedByteType, Vector2, Vector4,
  WebGLRenderTarget, type IUniform, type TextureDataType, type WebGLRenderer,
} from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FRAME } from './camera';
import { mulberry32 } from './snow';

export type PaintLevel = 1 | 2;

/** `?paint` or `?paint=1`, `?paint=2` (anything else: 0, the look unchanged). */
export function parsePaint(search: string): 0 | PaintLevel {
  const v = new URLSearchParams(search).get('paint');
  return v === '1' || v === '' ? 1 : v === '2' ? 2 : 0;
}

export interface Look {
  /** Frame px per paint px (the tensor and the Kuwahara filter run at this resolution). */
  scale: number;
  /** Kuwahara: radius (paint px), sharpness q, eccentricity (lower: longer patches along the flow). */
  radius: number; sharp: number; ecc: number;
  /** Smoothing of the structure tensor (paint px). */
  sigma: number;
  /**
   * Stroke layers: cell (frame px), half length and half width (cells). Strokes are looked up
   * in the 3 x 3 cells round a pixel, so a half length may not pass one cell.
   */
  coarse: [number, number, number]; fine: [number, number, number];
  /** Per-stroke jitter of value, temperature, saturation; how far a colour edge lets a stroke's paint through. */
  jitter: [number, number, number, number];
  /** Share of the coarse strokes laid with a palette knife. */
  knife: number;
  /** Grime: value swing of broad dull patches, share of dirty strokes. */
  grime: [number, number];
  /** Blues turned toward teal (part of a turn) and greyed (0..1). */
  bend: [number, number];
  /** Palette: saturation of the greyed base, how much the accents keep, contrast, its pivot. */
  palette: [number, number, number, number];
  /** Soft-light tints of the darks and the lights (rgb, amount). */
  cool: [number, number, number, number]; warm: [number, number, number, number];
  /** The warm ground showing between strokes (rgb, share of it in the underpainting). */
  ground: [number, number, number, number];
  /** Dark accents on the dark side of edges. */
  darken: number;
  /** Relief: strength, gloss, canvas weave, the log column's share of the relief. */
  relief: [number, number, number, number];
}

export const LOOKS: Record<PaintLevel, Look> = {
  // a painting of the diorama: brush strokes, a few knife marks, a cool palette
  1: {
    scale: 2, radius: 4, sharp: 8, ecc: 1, sigma: 2,
    coarse: [26, 1, 0.5], fine: [10, 1, 0.45],
    jitter: [0.09, 0.09, 0.14, 0.3], knife: 0.12, grime: [0.14, 0.08], bend: [0.07, 0.25],
    palette: [0.72, 0.9, 1.12, 0.45],
    cool: [0.3, 0.46, 0.52, 0.5], warm: [0.66, 0.54, 0.4, 0.3],
    ground: [0.62, 0.32, 0.16, 0.15], darken: 0.4,
    relief: [0.7, 0.35, 0.35, 0.3],
  },
  // bolder: broad strokes, a third of them knife marks, a colder base, more ground and grime
  2: {
    scale: 2, radius: 6, sharp: 8, ecc: 0.7, sigma: 2.5,
    coarse: [36, 1, 0.52], fine: [13, 1, 0.46],
    jitter: [0.11, 0.12, 0.18, 0.38], knife: 0.3, grime: [0.2, 0.14], bend: [0.1, 0.35],
    palette: [0.6, 1, 1.2, 0.45],
    cool: [0.22, 0.44, 0.52, 0.85], warm: [0.74, 0.54, 0.32, 0.55],
    ground: [0.66, 0.3, 0.12, 0.3], darken: 0.55,
    relief: [1, 0.45, 0.45, 0.3],
  },
};

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMMON = /* glsl */ `
  #define PI 3.141592653589793
  varying vec2 vUv;
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec4 hash42(vec2 p) {
    vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
    p4 += dot(p4, p4.wzxy + 33.33);
    return fract((p4.xxyz + p4.yzzw) * p4.zywx);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float hash11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
  float noise1(float x) { // 1D value noise (for small x)
    float i = floor(x), f = fract(x);
    return mix(hash11(i), hash11(i + 1.0), f * f * (3.0 - 2.0 * f));
  }`;

/** The painter's palette, applied to the painted frame and to the crisp log alike. */
const PALETTE = /* glsl */ `
  uniform vec4 uPalette, uCool, uWarm;
  uniform vec2 uBend;
  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
  }
  vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
  }
  vec3 softLight(vec3 b, vec3 s) { // W3C compositing
    vec3 d = mix(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, step(b, vec3(0.25)));
    return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(0.5, s));
  }
  vec3 palette(vec3 c) {
    // the painter's blues lean to teal and grey (Rostov's skies and shadows)
    vec3 hsv = rgb2hsv(c);
    float blue = smoothstep(0.5, 0.58, hsv.x) * (1.0 - smoothstep(0.7, 0.78, hsv.x));
    c = hsv2rgb(vec3(hsv.x - uBend.x * blue, hsv.y * (1.0 - uBend.y * blue), hsv.z));
    float l = luma(c);
    float hi = max(c.r, max(c.g, c.b)), lo = min(c.r, min(c.g, c.b));
    float s = (hi - lo) / (hi + 1e-4);
    // a cold, greyed base: middling saturation drains toward grey, strong accents keep theirs
    c = mix(vec3(l), c, mix(uPalette.x, 1.0, smoothstep(0.35, 0.8, s) * uPalette.y));
    // darks toward a cold blue-green, lights toward ochre
    c = mix(c, softLight(c, uCool.rgb), (1.0 - smoothstep(0.0, 0.55, l)) * uCool.a);
    c = mix(c, softLight(c, uWarm.rgb), smoothstep(0.45, 1.0, l) * uWarm.a);
    return clamp((c - uPalette.w) * uPalette.z + uPalette.w, 0.0, 1.0);
  }`;

/** The flow at a point of the smoothed tensor: the direction of least change, and how sure it is. */
const FLOW = /* glsl */ `
  vec3 flow(vec4 T) { // (unit tangent, anisotropy)
    float E = T.x, G = T.y, F = T.z;
    float root = sqrt((E - G) * (E - G) + 4.0 * F * F);
    float l1 = 0.5 * (E + G + root), l2 = 0.5 * (E + G - root);
    vec2 t = vec2(l1 - E, -F);
    float n = length(t);
    return vec3(n > 0.0 ? t / n : vec2(1.0, 0.0), l1 + l2 > 0.0 ? (l1 - l2) / (l1 + l2) : 0.0);
  }`;

/** 1. Down to the paint resolution: four bilinear taps average 2x2 (1x) or 4x4 (2x) device px. */
const PREFILTER = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uQuarter;
  ${COMMON}
  ${PALETTE}
  void main() {
    vec3 c = texture2D(tSrc, vUv - uQuarter).rgb + texture2D(tSrc, vUv + uQuarter).rgb
      + texture2D(tSrc, vUv + vec2(uQuarter.x, -uQuarter.y)).rgb + texture2D(tSrc, vUv + vec2(-uQuarter.x, uQuarter.y)).rgb;
    gl_FragColor = vec4(palette(c * 0.25), 1.0);
  }`;

/** 2. The structure tensor of the colour (Sobel), and the luminance for the edge accents. */
const TENSOR = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uTexel;
  ${COMMON}
  vec3 at(float x, float y) { return texture2D(tSrc, vUv + vec2(x, y) * uTexel).rgb; }
  void main() {
    vec3 a = at(-1.0, -1.0), b = at(0.0, -1.0), c = at(1.0, -1.0), d = at(-1.0, 0.0);
    vec3 f = at(1.0, 0.0), g = at(-1.0, 1.0), h = at(0.0, 1.0), i = at(1.0, 1.0);
    vec3 gx = (c + 2.0 * f + i - a - 2.0 * d - g) * 0.25;
    vec3 gy = (g + 2.0 * h + i - a - 2.0 * b - c) * 0.25;
    gl_FragColor = vec4(dot(gx, gx), dot(gy, gy), dot(gx, gy), luma(at(0.0, 0.0)));
  }`;

/** Separable Gaussian. */
const BLUR = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uStep;
  uniform float uSigma;
  ${COMMON}
  void main() {
    vec4 s = texture2D(tSrc, vUv);
    float ws = 1.0;
    for (int i = 1; i <= 8; i++) {
      float x = float(i);
      if (x > 2.5 * uSigma) break;
      float w = exp(-x * x / (2.0 * uSigma * uSigma));
      s += (texture2D(tSrc, vUv + uStep * x) + texture2D(tSrc, vUv - uStep * x)) * w;
      ws += 2.0 * w;
    }
    gl_FragColor = s / ws;
  }`;

/**
 * The Kuwahara filter's samples: fixed points of the unit disc (half rings, each point used
 * with its mirror image) and each point's weight in the eight sectors, after the polynomial
 * weighting of Kyprianidis et al. 2010 (zeta = 2 / radius, the sectors' envelope 3 pi / 16), a
 * Gaussian falloff and the area the point stands for. `centre` is the centre's weight in
 * every sector. The mirror image of a point counts in the opposite sector (k + 4).
 */
export function kuwaharaTaps(radius: number) {
  const zeta = 2 / radius, env = (1.5 * Math.PI) / 8;
  const eta = (zeta + Math.cos(env)) / Math.sin(env) ** 2;
  const sq = (z: number) => Math.max(0, z) ** 2;
  const sectors = (x: number, y: number) => {
    const px = zeta - eta * x * x, py = zeta - eta * y * y;
    const rx = Math.SQRT1_2 * (x - y), ry = Math.SQRT1_2 * (x + y);
    const qx = zeta - eta * rx * rx, qy = zeta - eta * ry * ry;
    return [sq(y + px), sq(ry + qx), sq(-x + py), sq(-rx + qy), sq(-y + px), sq(-ry + qx), sq(x + py), sq(rx + qy)];
  };
  // half rings (radius, points): about one point per paint px of the widest ellipse
  const rings: [number, number][] = radius > 5 ? [[0.2, 3], [0.45, 5], [0.7, 7], [0.93, 9]] : [[0.25, 3], [0.57, 5], [0.88, 7]];
  const bounds = [0.08, ...rings.slice(1).map(([r], i) => (r + rings[i][0]) / 2), 1];
  const taps: { x: number; y: number; w: number[] }[] = [];
  rings.forEach(([r, n], i) => {
    const area = (Math.PI * (bounds[i + 1] ** 2 - bounds[i] ** 2)) / 2 / n;
    for (let j = 0; j < n; j++) {
      const a = (Math.PI * (j + 0.5)) / n, x = r * Math.cos(a), y = r * Math.sin(a);
      const w = sectors(x, y), sum = w.reduce((s, v) => s + v, 0);
      const g = (Math.exp(-Math.PI * r * r) * area) / sum;
      // a sector's share under 1% is left out of the shader
      taps.push({ x, y, w: w.map((wk) => (wk / sum < 0.01 ? 0 : wk * g)) });
    }
  });
  return { centre: (Math.PI * bounds[0] ** 2) / 8, taps };
}

/**
 * 3. Anisotropic Kuwahara (Kyprianidis et al. 2009), eight sectors. The ellipse follows the flow
 * and stretches with its anisotropy; its samples are the fixed points of kuwaharaTaps, so the
 * sector weights are constants: the shader is generated with the samples unrolled and the zero
 * weights left out, and bilinear taps stand for the pixels between samples.
 */
function kuwahara(radius: number): string {
  const { centre, taps } = kuwaharaTaps(radius);
  const f = (x: number) => x.toFixed(5);
  const ks = [0, 1, 2, 3, 4, 5, 6, 7];
  const body = [`c = texture2D(tSrc, vUv).rgb;`, ...ks.map((k) => `m${k} += vec4(c * ${f(centre)}, ${f(centre)}); s${k} += c * c * ${f(centre)};`)];
  for (const { x, y, w } of taps) {
    body.push(`o = ax * ${f(x)} + ay * ${f(y)}; c = texture2D(tSrc, vUv + o).rgb; d = texture2D(tSrc, vUv - o).rgb;`);
    w.forEach((wk, k) => {
      if (!wk) return;
      const W = f(wk), K = (k + 4) % 8;
      body.push(`m${k} += vec4(c * ${W}, ${W}); s${k} += c * c * ${W}; m${K} += vec4(d * ${W}, ${W}); s${K} += d * d * ${W};`);
    });
  }
  return /* glsl */ `
  uniform sampler2D tSrc, tTensor;
  uniform vec2 uTexel;
  uniform float uSharp, uEcc;
  ${COMMON}
  ${FLOW}
  void main() {
    vec3 fl = flow(texture2D(tTensor, vUv));
    float k = (uEcc + fl.z) / uEcc;
    vec2 ax = fl.xy * (k * ${f(radius)}) * uTexel, ay = vec2(-fl.y, fl.x) * (${f(radius)} / k) * uTexel;
    vec4 ${ks.map((k) => `m${k} = vec4(0.0)`).join(', ')};
    vec3 ${ks.map((k) => `s${k} = vec3(0.0)`).join(', ')};
    vec3 c, d;
    vec2 o;
    ${body.join('\n    ')}
    // each sector's mean, weighted by how even the sector is (q: the sharpness)
    vec4 acc = vec4(0.0);
    vec3 mean;
    float w;
    ${ks.map((k) => `mean = m${k}.rgb / m${k}.w; w = 1.0 / pow(max(0.02, dot(sqrt(abs(s${k} / m${k}.w - mean * mean)), vec3(1.0))), uSharp); acc += vec4(mean * w, w);`).join('\n    ')}
    gl_FragColor = vec4(acc.rgb / acc.w, 1.0);
  }`;
}

/**
 * 4a. The strokes of one layer, four texels per stroke (a target four times the cell grid wide):
 *   0: centre (in its cell, 0..1), direction (cos, sin);  1: half length, half width (css px),
 *   depth, kind (0 brush, 1 knife, -1 none: the fine layer leaves out strokes where the image
 *   is plain);  2, 3: its two paints, picked from the flattened image toward its start and
 *   toward its end, varied in value, temperature and saturation; broad patches of grime dull
 *   some, and now and then a stroke is dirty.
 */
const CELLS = /* glsl */ `
  uniform sampler2D tColor, tTensor;
  uniform vec2 uCss, uGrime;
  uniform vec4 uLayer, uJitter; // cell (css px), half length, half width (cells), seed
  uniform float uFine, uKnife, uScale;
  ${COMMON}
  ${FLOW}
  vec3 vary(vec3 col, vec4 r, float s) {
    // the paint on the brush: its value, temperature (toward orange or toward blue-green) and
    // saturation vary from stroke to stroke; value varies less on light paint, where it reads
    // as noise
    col *= 1.0 + (r.x - 0.5) * 2.0 * uJitter.x * (1.2 - 0.6 * luma(col));
    col += (r.y - 0.5) * 2.0 * uJitter.y * vec3(0.9, 0.12, -0.8) * (0.2 + luma(col));
    return mix(vec3(luma(col)), col, 1.0 + (s - 0.5) * 2.0 * uJitter.z);
  }
  void main() {
    int part = int(gl_FragCoord.x) % 4;
    vec2 cell = vec2(floor(gl_FragCoord.x / 4.0), floor(gl_FragCoord.y));
    vec4 h = hash42(cell * 1.37 + uLayer.w), r = hash42(cell * 2.71 + uLayer.w + 3.1);
    vec2 c = (cell + h.xy) * uLayer.x, q = c / uCss;
    vec4 T = texture2D(tTensor, q);
    vec3 fl = flow(T);
    float strength = T.x + T.y;
    // where the image is plain the flow means little: a slow drift across the canvas instead
    float sure = smoothstep(0.0002, 0.004, strength) * smoothstep(0.05, 0.4, fl.z);
    float a0 = -0.55 + (vnoise(c / (170.0 * uScale) + uLayer.w) - 0.5) * 2.2;
    float af = atan(fl.y, fl.x);
    vec2 dd = mix(vec2(cos(2.0 * a0), sin(2.0 * a0)), vec2(cos(2.0 * af), sin(2.0 * af)), sure);
    float a = 0.5 * atan(dd.y, dd.x) + (h.z - 0.5) * 0.3;
    vec2 dir = vec2(cos(a), sin(a));
    // a palette-knife mark now and then: shorter, wider, flat
    bool knife = uFine < 0.5 && r.z < uKnife;
    float hl = uLayer.y * uLayer.x * (0.55 + 0.45 * h.w) * (knife ? 0.75 : 1.0);
    float hw = uLayer.z * uLayer.x * (0.8 + 0.4 * r.w) * (knife ? 1.5 : 1.0);
    bool keep = uFine < 0.5 || h.z < smoothstep(0.002, 0.02, strength);
    if (part == 0) { gl_FragColor = vec4(h.xy, dir); return; }
    if (part == 1) { gl_FragColor = vec4(hl, hw, fract(h.w * 13.7 + r.x * 7.3), keep ? (knife ? 1.0 : 0.0) : -1.0); return; }
    vec2 axis = dir * hl * 0.6 / uCss;
    vec3 col = (texture2D(tColor, q).rgb + texture2D(tColor, part == 2 ? q - axis : q + axis).rgb) * 0.5;
    col = vary(col, part == 2 ? r : hash42(cell * 3.3 + uLayer.w + 8.0), h.w);
    float dull = vnoise(c / (85.0 * uScale) + uLayer.w * 0.1) - 0.5;
    col *= 1.0 + dull * uGrime.x;
    if (fract(r.w * 17.3) < uGrime.y) col = mix(col, vec3(0.34, 0.31, 0.22) * (0.45 + 0.9 * luma(col)), 0.35);
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }`;

/** 4b. The strokes over the flattened image, at css resolution: colour, and paint thickness in alpha. */
const STROKES = /* glsl */ `
  uniform sampler2D tColor, tSmall, tTensor, tCoarse, tFine;
  uniform vec4 uCoarse, uFine, uGround;
  uniform float uDarken, uFollow, uGiveWay;
  ${COMMON}
  ${FLOW}
  struct Hit { float z; float m; vec3 c; float h; };
  // The top stroke over a pixel, and the top one of those that cover it fully (the paint under
  // the top one's soft edge). fp: the flow at the pixel; L: cell (css px), .., seed.
  void strokes(vec2 p, vec3 fp, sampler2D cells, vec4 L, vec3 base, vec3 ground, inout Hit top, inout Hit under) {
    ivec2 c0 = ivec2(floor(p / L.x)), n = textureSize(cells, 0);
    n.x /= 4;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        ivec2 cell = c0 + ivec2(i, j);
        if (cell.x < 0 || cell.y < 0 || cell.x >= n.x || cell.y >= n.y) continue;
        vec4 B = texelFetch(cells, ivec2(cell.x * 4 + 1, cell.y), 0);
        if (B.w < 0.0) continue;
        vec4 A = texelFetch(cells, ivec2(cell.x * 4, cell.y), 0);
        bool knife = B.w > 0.5;
        vec2 dir = A.zw, d = p - (vec2(cell) + A.xy) * L.x;
        // a brush bends with the form it follows: its axis turns toward the flow where it passes
        if (!knife) dir = normalize(mix(dir, fp.xy * sign(dot(fp.xy, dir)), uFollow * fp.z));
        float u = dot(d, dir) / B.x;
        if (abs(u) > 1.0) continue;
        vec4 r = hash42(vec2(cell) * 2.71 + L.w + 3.1);
        float v = dot(d, vec2(-dir.y, dir.x)) / B.y;
        if (!knife) v -= (fract(r.z * 7.0) - 0.5) * 0.7 * u * u; // the brush swings a little arc
        if (abs(v) > 1.0) continue;
        float pu = 1.0 / B.x, pv = 1.0 / B.y; // one css px in stroke units
        // most strokes are laid thin; about one in four is loaded (impasto) and stands up
        float load = r.y > 0.75 ? 1.0 : 0.35;
        float m, th, streak = 0.5, dry = 0.0, blend;
        if (knife) {
          // a skewed, tapering slab: a clean edge where the knife went down, a broken one where
          // it lifted; the drag scrapes the paint thin in fine streaks and blends its two paints
          float uu = u + (fract(r.x * 5.7) - 0.5) * v;
          float vv = v / (1.0 - 0.45 * fract(r.w * 3.1) * (uu * 0.5 + 0.5));
          float lift = 0.78 + 0.22 * noise1(vv * B.y / 3.0 + r.y * 23.0);
          m = (1.0 - smoothstep(1.0 - 1.5 * pv, 1.0, abs(vv))) * smoothstep(-1.0, -1.0 + 1.5 * pu, uu)
            * (1.0 - smoothstep(lift - 2.0 * pu, lift, uu));
          streak = noise1(vv * B.y / 1.3 + r.w * 51.0);
          dry = 0.3 * smoothstep(0.72, 0.95, streak);
          blend = smoothstep(-0.9, 0.9, vv);
          th = 0.42 + load * 0.5 * smoothstep(0.55, 1.0, vv) + 0.12 * (streak - 0.5); // a ridge where it lifted
        } else {
          // bristles leave streaks along the stroke and fray its sides
          float across = v * B.y / 1.7 + r.w * 37.0;
          streak = 0.7 * noise1(across) + 0.3 * noise1(across * 2.3 + u * 1.5 + 11.0);
          float fray = 0.1 + 0.22 * noise1(u * B.x / 4.0 + r.x * 40.0 + (v > 0.0 ? 0.0 : 17.0));
          // some strokes are laid crisp, some scumbled on with soft sides
          float soft = max(1.5 * pv, 0.45 * fract(r.w * 5.3) * fract(r.w * 5.3));
          float side = 1.0 - smoothstep(1.0 - fray - soft, 1.0 - fray, abs(v));
          // a blunt, rounded start where the loaded brush lands; the end runs dry in streaks
          float start = smoothstep(0.0, 2.0 * pu, u + 1.0 - 0.3 * (1.0 - sqrt(max(0.0, 1.0 - v * v))));
          dry = smoothstep(0.3, 1.0, u);
          m = side * start * smoothstep(dry - 0.12, dry + 0.03, streak * 0.85 + 0.15);
          th = 0.4 + load * ((0.3 + 0.3 * smoothstep(0.35, 0.95, abs(v))) * (1.0 - 0.6 * dry) + 0.25 * exp(-(u + 0.85) * (u + 0.85) * 60.0))
            + (0.12 + 0.2 * load) * (streak - 0.5);
          blend = 0.7 * smoothstep(0.3, 0.8, streak); // two paints on the bristles, in streaks
        }
        if (m <= 0.0) continue;
        // its two paints; toward its end it runs thin and the ground shows
        vec3 paint = texelFetch(cells, ivec2(cell.x * 4 + 2, cell.y), 0).rgb;
        vec3 paint2 = texelFetch(cells, ivec2(cell.x * 4 + 3, cell.y), 0).rgb;
        vec3 col = mix(mix(paint, paint2, blend) * (0.96 + 0.08 * streak), ground, 0.4 * dry);
        // across a strong colour edge the stroke's paint gives way to what is under it
        vec3 dc = paint - base;
        col = mix(base, col, exp(-dot(dc, dc) / (uGiveWay * uGiveWay)));
        Hit hit = Hit(B.z, m, col, th);
        if (hit.z > top.z) { if (top.m > 0.99) under = top; top = hit; }
        else if (m > 0.99 && hit.z > under.z) under = hit;
      }
    }
  }
  void main() {
    vec2 p = gl_FragCoord.xy;
    vec3 base = texture2D(tColor, vUv).rgb;
    vec4 T = texture2D(tTensor, vUv);
    vec3 fp = flow(T);
    fp.z = smoothstep(0.1, 0.5, fp.z);
    // the underpainting: thin paint where no stroke lies, over a warm ground (an imprimatura of
    // burnt sienna, as its value) that shows through between strokes and where they run thin
    vec3 ground = mix(base, uGround.rgb * (0.3 + 1.1 * luma(base)), uGround.a);
    Hit none = Hit(-1.0, 0.0, ground, 0.3 + 0.08 * vnoise(p / 6.0));
    Hit top = none, under = none;
    strokes(p, fp, tCoarse, uCoarse, base, ground, top, under);
    vec3 col = mix(under.c, top.c, top.m);
    float th = mix(under.h, top.h, top.m);
    Hit ftop = Hit(-1.0, 0.0, col, th), funder = ftop;
    strokes(p, fp, tFine, uFine, base, ground, ftop, funder);
    col = mix(funder.c, ftop.c, ftop.m);
    th = mix(funder.h, ftop.h, ftop.m);
    // dark accents where the paint turns darker than its surround
    col *= 1.0 - uDarken * smoothstep(0.01, 0.1, T.w - luma(base));
    // small bright things the filter dulled (a flame, lit windows, a glint) come back as dabs
    vec3 raw = texture2D(tSmall, vUv).rgb;
    float accent = smoothstep(0.05, 0.16, luma(raw) - max(luma(base), luma(col)));
    col = mix(col, raw * 1.04, accent);
    th = mix(th, 0.9, accent);
    gl_FragColor = vec4(col, th);
  }`;

/** The canvas tile: CANVAS_TILE css px square, CANVAS_THREADS threads each way; slopes up to ±CANVAS_SLOPE / 2. */
const CANVAS_TILE = 128, CANVAS_THREADS = 48, CANVAS_SLOPE = 2;

/** 5. The relief of the paint and the canvas, lit from the upper left; the log's column kept crisp. */
const FINAL = /* glsl */ `
  uniform sampler2D tFilm, tPaint, tCanvas;
  uniform vec2 uCss;
  uniform vec4 uQuiet, uKeep, uRelief;
  uniform float uScale;
  ${COMMON}
  ${PALETTE}
  // inside a uv rect (x0, y0, x1, y1), in frame px, its edge wandering like a brushed one
  float inside(vec4 r, vec2 p) {
    vec2 lo = (vUv - r.xy) * uCss / uScale, up = (r.zw - vUv) * uCss / uScale;
    return min(min(lo.x, lo.y), min(up.x, up.y)) + (noise1(p.x / (11.0 * uScale)) + noise1(p.y / (11.0 * uScale) + 40.0) - 1.0) * 8.0;
  }
  vec3 canvas(vec2 p) { // height 0..1, and its slope per css px
    vec3 c = texture2D(tCanvas, p / ${CANVAS_TILE.toFixed(1)}).rgb;
    return vec3(c.x, (c.yz - 0.5) * ${CANVAS_SLOPE.toFixed(1)});
  }
  void main() {
    vec2 p = vUv * uCss, e = 1.0 / uCss;
    vec4 P = texture2D(tPaint, vUv);
    float hl = texture2D(tPaint, vUv - vec2(e.x, 0.0)).a, hr = texture2D(tPaint, vUv + vec2(e.x, 0.0)).a;
    float hd = texture2D(tPaint, vUv - vec2(0.0, e.y)).a, hu = texture2D(tPaint, vUv + vec2(0.0, e.y)).a;
    vec3 cv = canvas(p);
    // the log's column and a new lead's card: the film frame as it was, feathered out over
    // about 20 frame px with a ragged, brushed edge; they keep a little of the relief, so the
    // page stays in the painting
    float quiet = smoothstep(-26.0, -6.0, inside(uQuiet, p));
    if (uKeep.z > uKeep.x) quiet = max(quiet, smoothstep(-20.0, -4.0, inside(uKeep, p)));
    float thin = 1.0 - smoothstep(0.1, 0.6, P.a); // the weave shows where the paint is thin
    // (the brightest paint gets a little less relief: there it reads as noise)
    vec2 slope = vec2(hl - hr, hd - hu) * uRelief.x * mix(1.0, uRelief.w, quiet) * (1.0 - 0.35 * smoothstep(0.65, 1.0, luma(P.rgb)))
      + cv.yz * uRelief.z * mix(mix(0.2, 1.0, thin), 0.3, quiet);
    vec3 n = normalize(vec3(slope, 1.0));
    vec3 L = normalize(vec3(-0.5, 0.62, 0.6));
    // linearised Lambert: slopes toward the light brighten, away darken, flat stays as it was
    float diffuse = clamp(1.0 + dot(slope, L.xy) / L.z, 0.4, 1.6);
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float gloss = max(0.0, pow(max(dot(n, H), 0.0), 36.0) - pow(H.z, 36.0));
    vec3 col = P.rgb;
    if (quiet > 0.0) col = mix(col, palette(texture2D(tFilm, vUv).rgb), quiet);
    col = col * diffuse + gloss * uRelief.y * (0.25 + 0.75 * luma(col));
    // the ground shows a little between the threads where the paint is thin
    col *= 1.0 - (1.0 - cv.x) * 0.06 * uRelief.z * thin;
    col += (hash12(gl_FragCoord.xy * 1.618) - 0.5) / 255.0; // dither
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }`;

/**
 * A plain-weave canvas as a tileable texture: height in r, its slope per css px in g and b
 * (0.5 flat). Threads pass over and under each other in turn, wander a little and vary in
 * thickness; everything repeats with the tile.
 */
function canvasTexture(): DataTexture {
  const n = CANVAS_TILE, T = CANVAS_THREADS, P = n / T;
  const rnd = mulberry32(1909);
  const swell = Array.from({ length: T * T }, () => 0.8 + 0.35 * rnd());
  const drift = Array.from({ length: T }, () => rnd() * Math.PI * 2);
  const height = (x: number, y: number) => {
    // threads wander by a fraction of their spacing, periodic over the tile
    const qx = x / P + 0.18 * Math.sin(((2 * Math.PI * y) / n) * 3 + drift[Math.floor(x / P) % T]);
    const qy = y / P + 0.18 * Math.sin(((2 * Math.PI * x) / n) * 2 + drift[Math.floor(y / P) % T]);
    const kx = ((Math.floor(qx) % T) + T) % T, ky = ((Math.floor(qy) % T) + T) % T;
    const warp = Math.sin(Math.PI * (qx - Math.floor(qx))), weft = Math.sin(Math.PI * (qy - Math.floor(qy))), s = swell[ky * T + kx];
    return (kx + ky) % 2 === 0 ? Math.max(warp * (0.55 + 0.45 * weft) * s, weft * 0.55) : Math.max(weft * (0.55 + 0.45 * warp) * s, warp * 0.55);
  };
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = height(x + 0.5, y + 0.5);
  const at = (x: number, y: number) => h[(((y % n) + n) % n) * n + (((x % n) + n) % n)];
  const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      data[i] = byte(at(x, y));
      data[i + 1] = byte(0.5 + (at(x - 1, y) - at(x + 1, y)) / 2 / CANVAS_SLOPE);
      data[i + 2] = byte(0.5 + (at(x, y - 1) - at(x, y + 1)) / 2 / CANVAS_SLOPE);
      data[i + 3] = 255;
    }
  }
  const t = new DataTexture(data, n, n);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = t.minFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

function target(w: number, h: number, type: TextureDataType = HalfFloatType, nearest = false) {
  const filter = nearest ? NearestFilter : LinearFilter;
  return new WebGLRenderTarget(w, h, { type, depthBuffer: false, minFilter: filter, magFilter: filter, generateMipmaps: false });
}

function material(fragmentShader: string, uniforms: Record<string, IUniform>) {
  return new ShaderMaterial({ vertexShader: VERTEX, fragmentShader, uniforms, depthTest: false, depthWrite: false });
}

/**
 * The painting pass. It takes over the film pass (disabled in the composer): the film's
 * material grades the scene into a plain 8-bit target at the device resolution, and the
 * painting starts from there. The film's uniforms still drive the grade (the cues' exposure and
 * night), and its text column (uQuiet) is where the painting stays out of the log.
 */
export class PaintPass extends Pass {
  private quad = new FullScreenQuad();
  private graded = target(1, 1, UnsignedByteType);
  private small = target(1, 1);
  private tensor = target(1, 1);
  private blurred = target(1, 1);
  private smooth = target(1, 1);
  private flat = target(1, 1);
  private coarse = target(1, 1, HalfFloatType, true);
  private fine = target(1, 1, HalfFloatType, true);
  private paint = target(1, 1);
  private canvas = canvasTexture();
  private css = new Vector2(1, 1);
  /** A second rect left crisp (uv x0, y0, x1, y1; empty when x1 <= x0): a new lead's card. */
  readonly keep = new Vector4();
  /** css px per frame px. */
  private scale = { value: 1 };
  private layers: { coarse: Vector4; fine: Vector4 };
  private look: Look;
  private steps: ShaderMaterial[];
  private m: Record<'prefilter' | 'tensor' | 'blurH' | 'blurV' | 'kuwahara' | 'coarse' | 'fine' | 'strokes' | 'final', ShaderMaterial>;

  constructor(private renderer: WebGLRenderer, level: PaintLevel, private film: ShaderPass) {
    super();
    const k = this.look = LOOKS[level];
    const palette = {
      uPalette: { value: new Vector4(...k.palette) }, uCool: { value: new Vector4(...k.cool) }, uWarm: { value: new Vector4(...k.warm) },
      uBend: { value: new Vector2(...k.bend) },
    };
    // the layers' cells in css px (set with the size), shared by the cells and the strokes
    this.layers = { coarse: new Vector4(k.coarse[0], k.coarse[1], k.coarse[2], 17), fine: new Vector4(k.fine[0], k.fine[1], k.fine[2], 71) };
    const jitter = { value: new Vector4(...k.jitter) };
    const cells = (layer: Vector4, fine: number) => material(CELLS, {
      tColor: { value: this.flat.texture }, tTensor: { value: this.smooth.texture }, uCss: { value: this.css }, uScale: this.scale,
      uLayer: { value: layer }, uJitter: jitter, uFine: { value: fine }, uKnife: { value: k.knife }, uGrime: { value: new Vector2(...k.grime) },
    });
    this.m = {
      prefilter: material(PREFILTER, { tSrc: { value: this.graded.texture }, uQuarter: { value: new Vector2() }, ...palette }),
      tensor: material(TENSOR, { tSrc: { value: this.small.texture }, uTexel: { value: new Vector2() } }),
      blurH: material(BLUR, { tSrc: { value: this.tensor.texture }, uStep: { value: new Vector2() }, uSigma: { value: k.sigma } }),
      blurV: material(BLUR, { tSrc: { value: this.blurred.texture }, uStep: { value: new Vector2() }, uSigma: { value: k.sigma } }),
      kuwahara: material(kuwahara(k.radius), {
        tSrc: { value: this.small.texture }, tTensor: { value: this.smooth.texture }, uTexel: { value: new Vector2() }, uSharp: { value: k.sharp }, uEcc: { value: k.ecc },
      }),
      coarse: cells(this.layers.coarse, 0),
      fine: cells(this.layers.fine, 1),
      strokes: material(STROKES, {
        tColor: { value: this.flat.texture }, tSmall: { value: this.small.texture }, tTensor: { value: this.smooth.texture },
        tCoarse: { value: this.coarse.texture }, tFine: { value: this.fine.texture },
        uCoarse: { value: this.layers.coarse }, uFine: { value: this.layers.fine },
        uDarken: { value: k.darken }, uFollow: { value: 0.6 }, uGiveWay: { value: k.jitter[3] }, uGround: { value: new Vector4(...k.ground) },
      }),
      final: material(FINAL, {
        tFilm: { value: this.graded.texture }, tPaint: { value: this.paint.texture }, tCanvas: { value: this.canvas },
        uCss: { value: this.css }, uScale: this.scale, uQuiet: film.uniforms.uQuiet, uKeep: { value: this.keep },
        uRelief: { value: new Vector4(...k.relief) }, ...palette,
      }),
    };
    const m = this.m;
    this.steps = [m.prefilter, m.tensor, m.blurH, m.blurV, m.kuwahara, m.coarse, m.fine, m.strokes];
  }

  setSize(width: number, height: number) {
    const pr = this.renderer.getPixelRatio();
    const cw = Math.max(1, Math.round(width / pr)), ch = Math.max(1, Math.round(height / pr));
    const k = this.look, s = cw / FRAME.w;
    this.css.set(cw, ch);
    this.scale.value = s;
    const pw = Math.max(1, Math.ceil(cw / (k.scale * s))), ph = Math.max(1, Math.ceil(ch / (k.scale * s)));
    this.graded.setSize(width, height);
    for (const t of [this.small, this.tensor, this.blurred, this.smooth, this.flat]) t.setSize(pw, ph);
    for (const [t, l, cell] of [[this.coarse, this.layers.coarse, k.coarse[0]], [this.fine, this.layers.fine, k.fine[0]]] as const) {
      l.x = cell * s;
      t.setSize(4 * (Math.ceil(cw / l.x) + 1), Math.ceil(ch / l.x) + 1);
    }
    this.paint.setSize(cw, ch);
    (this.m.prefilter.uniforms.uQuarter.value as Vector2).set(0.25 / pw, 0.25 / ph);
    for (const m of [this.m.tensor, this.m.kuwahara]) (m.uniforms.uTexel.value as Vector2).set(1 / pw, 1 / ph);
    (this.m.blurH.uniforms.uStep.value as Vector2).set(1 / pw, 0);
    (this.m.blurV.uniforms.uStep.value as Vector2).set(0, 1 / ph);
  }

  render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget) {
    const run = (m: ShaderMaterial, to: WebGLRenderTarget | null) => {
      renderer.setRenderTarget(to);
      this.quad.material = m;
      this.quad.render(renderer);
    };
    this.film.uniforms.tDiffuse.value = readBuffer.texture;
    run(this.film.material, this.graded);
    const targets = [this.small, this.tensor, this.blurred, this.smooth, this.flat, this.coarse, this.fine, this.paint];
    this.steps.forEach((m, i) => run(m, targets[i]));
    run(this.m.final, this.renderToScreen ? null : writeBuffer);
  }

  dispose() {
    for (const t of [this.graded, this.small, this.tensor, this.blurred, this.smooth, this.flat, this.coarse, this.fine, this.paint]) t.dispose();
    for (const m of Object.values(this.m)) m.dispose();
    this.canvas.dispose();
    this.quad.dispose();
  }
}

/**
 * Paints the frame: the painting pass takes the film pass's place at the end of the composer.
 * The film's grain goes (the Kuwahara filter would smear it into blotches); the canvas and
 * the relief take its place.
 */
export function addPaint(renderer: WebGLRenderer, post: { composer: { addPass(p: Pass): void }; film: ShaderPass }, level: PaintLevel) {
  post.film.enabled = false;
  post.film.uniforms.uGrain.value = 0;
  const pass = new PaintPass(renderer, level, post.film);
  post.composer.addPass(pass);
  return pass;
}
