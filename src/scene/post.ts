// Post-processing: the scene renders linear into a 4x MSAA half-float target, then one
// fullscreen pass does exposure, a soft shoulder, the sRGB encode, the colour grade
// (cool top, warm bottom, cool shadows), the vignette and animated film grain.
// Grading and grain work in display space so they match the legacy board's CSS layers.
// A painterly grade (?style=2, src/scene/palette.ts) turns blues toward teal, adds a split tone,
// a saturation trim, paint mottling, a reshaped vignette and a glow round the brightest lights;
// at their defaults these leave the frame exactly as it was.
import { HalfFloatType, Vector2, Vector3, Vector4, WebGLRenderTarget, type Camera, type Scene, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const FilmShader = {
  name: 'FilmShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uExposure: { value: 1 },
    uGrade: { value: 1 },
    /** 0 the present; 1 last night: colder, less saturated (the reconstruction's flashback). */
    uNight: { value: 0 },
    uVignette: { value: 1 },
    uGrain: { value: 0.05 },
    /** Contrast about a mid grey, after the grade (M1 review: a little more punch). */
    uContrast: { value: 1.1 },
    /** grain grid in cells across the frame; setSize keeps one cell at GRAIN_PX css px */
    uGrainCells: { value: new Vector2(1280, 720) },
    /** uv rect (x0, y0, x1, y1) of the text column, where the grain is gentler (as on the M0 board). */
    uQuiet: { value: new Vector4(0, 0, 0, 0) },
    uQuietGrain: { value: 0.5 },
    /** The flashback's night: the colour the drained frame is multiplied by. */
    uNightTint: { value: new Vector3(0.8, 0.92, 1.12) },
    /** Split tone: the darks soft-lit toward rgb by a (0: off), and the lights toward uToneHigh's. */
    uToneLow: { value: new Vector4(0.5, 0.5, 0.5, 0) },
    uToneHigh: { value: new Vector4(0.5, 0.5, 0.5, 0) },
    /** Saturation after the grade (1: unchanged). */
    uSaturation: { value: 1 },
    /** Blues and violets turned toward teal (x: part of a turn) and greyed (y: 0..1); 0, 0: off. */
    uBlueShift: { value: new Vector2(0, 0) },
    /** Paint mottling: broad brush-like patches of value and temperature, ± this much (0: off). */
    uMottle: { value: 0 },
    /** Vignette: its colour, and its shape (x: radius where it starts, y: the knee, z: strength there, w: strength at the rim). */
    uVignetteColor: { value: new Vector3(4 / 255, 2 / 255, 1 / 255) },
    uVignetteShape: { value: new Vector4(0.5, 0.76, 0.38, 0.86) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uExposure, uGrade, uVignette, uGrain, uNight, uContrast;
    uniform vec2 uGrainCells;
    uniform vec4 uQuiet;
    uniform float uQuietGrain;
    uniform vec3 uNightTint, uVignetteColor;
    uniform vec4 uToneLow, uToneHigh, uVignetteShape;
    uniform float uSaturation, uMottle;
    uniform vec2 uBlueShift;
    varying vec2 vUv;

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

    vec3 shoulder(vec3 c) { // linear up to 0.82, then rolls off softly toward 1
      vec3 k = vec3(0.82);
      return mix(c, k + (1.0 - k) * (1.0 - exp(-(c - k) / (1.0 - k))), step(k, c));
    }
    vec3 toSRGB(vec3 c) {
      c = clamp(c, 0.0, 1.0);
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    vec3 softLight(vec3 b, vec3 s) { // W3C compositing
      vec3 d = mix(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, step(b, vec3(0.25)));
      return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(0.5, s));
    }
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    // paint mottling, -0.5..0.5: broad patches drawn out along a slanted stroke direction, like
    // a loaded brush's; fixed on the frame, like the canvas under a painting
    float mottle(vec2 uv) {
      vec2 p = mat2(0.94, -0.34, 0.34, 0.94) * vec2(uv.x * 1.7778, uv.y);
      return vnoise(p * vec2(4.0, 13.0)) * 0.6 + vnoise(p * vec2(9.0, 31.0) + 5.3) * 0.4 - 0.5;
    }
    float grainAt(vec2 c, float f) { return 0.5 * (hash(c + f * 17.13) + hash(c.yx * 1.37 + 91.7 + f * 3.71)); }
    // value noise on the grain grid, bilinearly upscaled so each grain is a soft ~1 px speck
    float grain(vec2 p, float f) {
      vec2 i = floor(p - 0.5), u = p - 0.5 - i;
      return mix(mix(grainAt(i, f), grainAt(i + vec2(1.0, 0.0), f), u.x),
                 mix(grainAt(i + vec2(0.0, 1.0), f), grainAt(i + vec2(1.0, 1.0), f), u.x), u.y);
    }

    void main() {
      vec3 s = toSRGB(shoulder(texture2D(tDiffuse, vUv).rgb * uExposure));

      // grade: cool light from above, warm toward the table (the M0 board's soft-light gradient)
      float y = 1.0 - vUv.y;
      vec4 g = y < 0.45 ? vec4(vec3(40.0, 70.0, 95.0) / 255.0, 0.35 * (1.0 - y / 0.45))
                        : vec4(vec3(110.0, 60.0, 25.0) / 255.0, 0.22 * (y - 0.45) / 0.55);
      s = mix(s, softLight(s, g.rgb), g.a * uGrade);
      float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
      s = mix(s, s * vec3(0.95, 0.99, 1.06), (1.0 - smoothstep(0.04, 0.45, l)) * 0.3 * uGrade);
      // last night: drained of warmth, shifted to blue, a little darker; highlights keep some warmth
      float ln = dot(s, vec3(0.2126, 0.7152, 0.0722));
      vec3 cold = mix(vec3(ln), s, 0.5) * uNightTint * 0.9;
      s = mix(s, mix(cold, s, smoothstep(0.55, 0.95, ln) * 0.5), uNight);

      // the text column, where grain and mottling are gentler
      vec2 q = smoothstep(uQuiet.xy - 0.015, uQuiet.xy + 0.01, vUv) * (1.0 - smoothstep(uQuiet.zw - 0.01, uQuiet.zw + 0.015, vUv));
      float quiet = q.x * q.y;

      // the painterly grade: split tone (darks toward one colour, lights toward another), a
      // saturation trim, and paint mottling in value and temperature
      if (uBlueShift.x != 0.0 || uBlueShift.y != 0.0) {
        vec3 h = rgb2hsv(s);
        float w = smoothstep(0.5, 0.58, h.x) * (1.0 - smoothstep(0.76, 0.86, h.x));
        s = hsv2rgb(vec3(h.x - uBlueShift.x * w, h.y * (1.0 - uBlueShift.y * w), h.z));
      }
      float lt = dot(s, vec3(0.2126, 0.7152, 0.0722));
      s = mix(s, softLight(s, uToneLow.rgb), (1.0 - smoothstep(0.0, 0.55, lt)) * uToneLow.a);
      s = mix(s, softLight(s, uToneHigh.rgb), smoothstep(0.45, 1.0, lt) * uToneHigh.a);
      s = mix(vec3(dot(s, vec3(0.2126, 0.7152, 0.0722))), s, uSaturation);
      float mo = mottle(vUv) * uMottle * mix(1.0, 0.3, quiet);
      s = s * (1.0 + mo) + vec3(0.3, 0.05, -0.3) * mo;

      s = clamp((s - 0.42) * uContrast + 0.42, 0.0, 1.0);

      // vignette: ellipse 80% x 78% at (50%, 56%); a painted frame's edge wanders with the mottling
      vec4 V = uVignetteShape;
      float r = length((vUv - vec2(0.5, 0.44)) / vec2(0.8, 0.78)) + mottle(vUv * 1.7 + 3.1) * uMottle * 0.8;
      float a = r < V.x ? 0.0 : r < V.y ? V.z * (r - V.x) / (V.y - V.x) : r < 1.0 ? mix(V.z, V.w, (r - V.y) / (1.0 - V.y)) : V.w;
      s = mix(s, uVignetteColor, a * uVignette);

      // film grain: overlay-blended noise, a new pattern 24 times a second; gentler on the text
      float n = grain(vUv * uGrainCells, floor(uTime * 24.0));
      vec3 ov = mix(2.0 * s * n, 1.0 - 2.0 * (1.0 - s) * (1.0 - n), step(0.5, s));
      s = mix(s, ov, uGrain * mix(1.0, uQuietGrain, quiet));

      gl_FragColor = vec4(s, 1.0);
    }`,
};

/** Size of one grain cell in css px: fine enough to read as film texture, not blotches. */
const GRAIN_PX = 1.25;

export function createPost(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
  const size = renderer.getDrawingBufferSize(new Vector2());
  const target = new WebGLRenderTarget(size.x, size.y, { type: HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const film = new ShaderPass(FilmShader);
  composer.addPass(film);
  return {
    composer,
    uniforms: film.uniforms as typeof FilmShader.uniforms,
    /**
     * A glow round what is brighter than `threshold` in the linear scene (the candle's flame
     * and halo, the hottest lamp-lit paper), added before the grade: the painted glow of the
     * original's lamps (?style=2).
     */
    addGlow(strength: number, radius: number, threshold: number) {
      composer.insertPass(new UnrealBloomPass(size.clone(), strength, radius, threshold), 1);
    },
    setSize(w: number, h: number, pixelRatio: number) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);
      film.uniforms.uGrainCells.value.set(w / GRAIN_PX, h / GRAIN_PX);
    },
    render(t: number) {
      film.uniforms.uTime.value = t;
      composer.render();
    },
  };
}
