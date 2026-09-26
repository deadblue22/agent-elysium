// Snow falling outside the window: a Points system in the gap between the back wall and the
// view outside (the far layer), in the wall's own leaning frame, so the wall hides every flake
// but those seen through the window hole. Flakes are seeded once and fall in the vertex
// shader, so the resting frame (t = 0) is deterministic.
import { BufferGeometry, Float32BufferAttribute, NormalBlending, Points, ShaderMaterial, Vector3, type Group } from 'three';

export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * wall: the wall's group (its local y runs up the wall, z out of it toward the room).
 * hole: the window hole in the wall group's frame (x0..x1, y0..y1) and how far behind the
 * wall the flakes may fall (depth, world units). focal: the camera's focal length, frame px.
 */
export function createSnow(wall: Group, hole: { x0: number; x1: number; y0: number; y1: number; depth: number }, focal: number, count = 90) {
  const R = mulberry32(2024);
  const pos: number[] = [], move: number[] = [];
  const pad = 0.15;
  for (let i = 0; i < count; i++) {
    const big = R() < 0.18;
    pos.push(hole.x0 - pad + R() * (hole.x1 - hole.x0 + 2 * pad), hole.y0 + R() * (hole.y1 - hole.y0), -(0.02 + R() * (hole.depth - 0.03)));
    // size (world units), alpha, fall (units/s), sway phase
    move.push(big ? 0.04 + R() * 0.02 : 0.02 + R() * 0.018, big ? 0.55 + R() * 0.2 : 0.4 + R() * 0.35, 0.22 + R() * 0.2, R() * 6.28);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geometry.setAttribute('aMove', new Float32BufferAttribute(move, 4));

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 1 },
      uFocal: { value: focal },
      uRange: { value: new Vector3(hole.y0, hole.y1 - hole.y0, 0) },
      uColor: { value: new Vector3(0.855, 0.888, 0.896) }, // #eef2f3, linear
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aMove; // size, alpha, fall, phase
      uniform float uTime, uScale, uFocal;
      uniform vec3 uRange;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y = uRange.x + mod(p.y - uRange.x - aMove.z * uTime, uRange.y);
        p.x += sin(uTime * 0.9 + aMove.w) * 0.05;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.0, aMove.x * uFocal * uScale / -mv.z);
        vAlpha = aMove.y;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.45, 1.0, r)) * vAlpha * uOpacity);
      }`,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.name = 'snow';
  wall.add(points);
  return {
    points,
    update(t: number) { material.uniforms.uTime.value = t; },
    /** 0: no snow (last night, before 23:00); 1: snowing. */
    setOpacity(o: number) { material.uniforms.uOpacity.value = o; points.visible = o > 0.001; },
    /** Device px per frame px. */
    setScale(s: number) { material.uniforms.uScale.value = s; },
  };
}
