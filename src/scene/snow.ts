// Snow drifting over the whole frame: a Points system between the camera and the book.
// Flakes are seeded in frame space (1600 x 900) at a view depth and drift down the frame
// in the vertex shader, so the resting frame (t = 0) is deterministic, and the camera's
// parallax separates them by depth. The resting frame keeps flakes off the text column.
import {
  BufferGeometry, Float32BufferAttribute, NormalBlending, Points, Quaternion, ShaderMaterial, Vector2, Vector3,
  type PerspectiveCamera,
} from 'three';
import type { Rect } from '../page/layout';

export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** camera: in its resting pose. avoid: frame-space rect kept clear at t = 0. */
export function createSnow(camera: PerspectiveCamera, lens: { focal: number; principal: { x: number; y: number } }, avoid: Rect | null, count = 230) {
  camera.updateMatrixWorld();
  const eye = camera.getWorldPosition(new Vector3());
  const q = camera.getWorldQuaternion(new Quaternion());
  const R = mulberry32(2024);
  const seed: number[] = [], move: number[] = [], sway: number[] = [], pos: number[] = [];
  const inside = (x: number, y: number, m: number) => !!avoid && x > avoid.x - m && x < avoid.x + avoid.w + m && y > avoid.y - m && y < avoid.y + avoid.h + m;
  for (let i = 0; i < count; i++) {
    const r = R(), kind = r < 0.05 ? 2 : r < 0.32 ? 1 : 0;
    let r0: number, a: number, vy: number, depth: number;
    // view depths in world units; the book starts about 17 units from the eye
    if (kind === 0) { r0 = 0.7 + R() * 1.5; a = 0.35 + R() * 0.45; vy = 10 + R() * 16; depth = 5 + R() * 11; }
    else if (kind === 1) { r0 = 2 + R() * 1.8; a = 0.35 + R() * 0.3; vy = 18 + R() * 14; depth = 4 + R() * 8; }
    else { r0 = 7 + R() * 9; a = 0.07 + R() * 0.08; vy = 26 + R() * 12; depth = 2.5 + R() * 2.5; }
    let x = R() * 1600, y = R() * 900;
    while (inside(x, y, r0 + 4)) { x = R() * 1600; y = R() * 900; }
    seed.push(x, y, depth, kind);
    move.push(r0, a, vy, R() * 6.28);
    sway.push(0.3 + R() * 0.8);
    pos.push(0, 0, 0);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geometry.setAttribute('aSeed', new Float32BufferAttribute(seed, 4));
  geometry.setAttribute('aMove', new Float32BufferAttribute(move, 4));
  geometry.setAttribute('aSway', new Float32BufferAttribute(sway, 1));

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uEye: { value: eye },
      uRight: { value: new Vector3(1, 0, 0).applyQuaternion(q) },
      uUp: { value: new Vector3(0, 1, 0).applyQuaternion(q) },
      uFwd: { value: new Vector3(0, 0, -1).applyQuaternion(q) },
      uScale: { value: 1 },
      uFocal: { value: lens.focal },
      uPrincipal: { value: new Vector2(lens.principal.x, lens.principal.y) },
      uColor: { value: new Vector3(0.855, 0.888, 0.896) }, // #eef2f3, linear
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;  // frame x, frame y, view depth, kind
      attribute vec4 aMove;  // radius px, alpha, fall px/s, phase
      attribute float aSway;
      uniform float uTime, uScale, uFocal;
      uniform vec2 uPrincipal;
      uniform vec3 uEye, uRight, uUp, uFwd;
      varying float vAlpha, vKind;
      void main() {
        float t = uTime;
        float sy = mod(aSeed.y + aMove.z * t + 15.0, 930.0) - 15.0;
        float sx = mod(aSeed.x + (2.0 + aSeed.w * 1.5) * t + 15.0, 1630.0) - 15.0 + sin(t * aSway + aMove.w) * 6.0 * aSway;
        float d = aSeed.z;
        float k = d / uFocal; // world units per frame px at this view depth
        vec3 p = uEye + uFwd * d + uRight * ((sx - uPrincipal.x) * k) + uUp * ((uPrincipal.y - sy) * k);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.0, 2.0 * aMove.x * (d / -mv.z) * uScale);
        vAlpha = aMove.y;
        vKind = aSeed.w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha, vKind;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        float a;
        if (vKind < 0.5) a = 1.0 - smoothstep(0.55, 1.0, r);
        else if (vKind < 1.5) a = r < 0.45 ? mix(1.0, 0.8, r / 0.45) : mix(0.8, 0.0, (r - 0.45) / 0.55);
        else a = r < 0.2 ? mix(1.0, 0.8, r / 0.2) : mix(0.8, 0.0, (r - 0.2) / 0.8);
        gl_FragColor = vec4(uColor, a * vAlpha);
      }`,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 10;
  points.name = 'snow';
  return {
    points,
    update(t: number) { material.uniforms.uTime.value = t; },
    /** Device px per frame px. */
    setScale(s: number) { material.uniforms.uScale.value = s; },
  };
}
