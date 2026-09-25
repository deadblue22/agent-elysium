// Post-processing: the scene renders linear into a 4x MSAA half-float target, then one
// fullscreen pass does exposure, a soft shoulder, the sRGB encode, the colour grade
// (cool top, warm bottom, cool shadows), the vignette and animated film grain.
// Grading and grain work in display space so they match the legacy board's CSS layers.
import { HalfFloatType, Vector2, Vector4, WebGLRenderTarget, type Camera, type Scene, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const FilmShader = {
  name: 'FilmShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uExposure: { value: 1 },
    uGrade: { value: 1 },
    uVignette: { value: 1 },
    uGrain: { value: 0.1 },
    /** grain grid in cells across the frame; setSize keeps one cell at GRAIN_PX css px */
    uGrainCells: { value: new Vector2(1280, 720) },
    /** uv rect (x0, y0, x1, y1) of the text column, where the grain is gentler (as on the M0 board). */
    uQuiet: { value: new Vector4(0, 0, 0, 0) },
    uQuietGrain: { value: 0.5 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uExposure, uGrade, uVignette, uGrain;
    uniform vec2 uGrainCells;
    uniform vec4 uQuiet;
    uniform float uQuietGrain;
    varying vec2 vUv;

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

      // vignette: ellipse 80% x 78% at (50%, 56%)
      float r = length((vUv - vec2(0.5, 0.44)) / vec2(0.8, 0.78));
      float a = r < 0.5 ? 0.0 : r < 0.76 ? 0.38 * (r - 0.5) / 0.26 : r < 1.0 ? mix(0.38, 0.86, (r - 0.76) / 0.24) : 0.86;
      s = mix(s, vec3(4.0, 2.0, 1.0) / 255.0, a * uVignette);

      // film grain: overlay-blended noise, a new pattern 24 times a second; gentler on the text
      float n = grain(vUv * uGrainCells, floor(uTime * 24.0));
      vec3 ov = mix(2.0 * s * n, 1.0 - 2.0 * (1.0 - s) * (1.0 - n), step(0.5, s));
      vec2 q = smoothstep(uQuiet.xy - 0.015, uQuiet.xy + 0.01, vUv) * (1.0 - smoothstep(uQuiet.zw - 0.01, uQuiet.zw + 0.015, vUv));
      s = mix(s, ov, uGrain * mix(1.0, uQuietGrain, q.x * q.y));

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
