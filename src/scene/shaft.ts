// A shaft of light through the pop-up's window, drawn as lit haze in the air, and the motes that
// float in it (?look=, src/scene/mood.ts). The light is the low sun (the key: parallel rays) or
// a spot standing well behind the window (the moon); it casts, so the wall lets it into the room
// through the window hole only. The shaft is the hull of the rays through the hole, marched in
// its fragment shader: each sample counts where the light's own shadow map sees it, so the
// window frame, the open casements, the desk and whoever stands in the light cut the shaft into
// beams exactly as they cut its patch on the floor. The haze thins away from the window and
// drifts (slow noise). The motes glint where the light reaches them, and warm near the candle.
import {
  AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, FrontSide, Mesh, Points, ShaderMaterial, Vector2, Vector3, Vector4,
  type DirectionalLight, type SpotLight,
} from 'three';
import { mulberry32 } from './snow';

/** Samples along each view ray through the shaft (dithered per pixel, so a few are enough). */
const STEPS = 14;

// A spot's shadow map is compared in hardware (three's PCF); the key's is plain depth
// (penumbra.ts), compared here.
const SHADOW = /* glsl */ `
#ifdef SHAFT_COMPARE
uniform sampler2DShadow tShadow;
#else
uniform sampler2D tShadow;
#endif
uniform mat4 uShadowMatrix;
uniform float uShadowBias;
uniform vec3 uLightPos, uLightDir;
uniform vec2 uCone; // cos of the outer and inner half angles
/** How much of the light reaches p: its shadow map, and the spot's cone. */
float lightAt( vec3 p ) {
  vec4 c = uShadowMatrix * vec4( p, 1.0 );
  c.xyz /= c.w;
  if ( c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0 ) return 0.0;
#ifdef SHAFT_COMPARE
  float lit = texture( tShadow, vec3( c.xy, c.z + uShadowBias ) );
#else
  float lit = step( c.z + uShadowBias, texture( tShadow, c.xy ).r );
#endif
  float cosA = dot( normalize( p - uLightPos ), uLightDir );
  return lit * smoothstep( uCone.x, uCone.y, cosA );
}
`;

const NOISE = /* glsl */ `
float sHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
float sNoise( vec3 x ) {
  vec3 i = floor( x ), f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( sHash( i ), sHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( sHash( i + vec3( 0, 1, 0 ) ), sHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( sHash( i + vec3( 0, 0, 1 ) ), sHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( sHash( i + vec3( 0, 1, 1 ) ), sHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
`;

export interface ShaftOptions {
  /** The light, which casts: a spot (its rays spread from it) or the key (parallel rays). */
  light: SpotLight | DirectionalLight;
  /** The window hole, world: a corner and its two edges (across, up). */
  hole: { corner: Vector3; across: Vector3; up: Vector3 };
  /** The hull reaches this far along the light from the hole (world units). */
  length: number;
  /** Nothing below this height (the pages and the floor; the table). */
  floorY: number;
  /** The haze: its colour (linear) and how dense it is; how fast it thins with distance from the hole. */
  color: Color;
  density: number;
  thin: number;
  /** Motes: how many in the shaft and round the candle; their colours; where the candle is. */
  motes?: { shaft: number; candle: number; color: Color; warm: Color; candleAt: Vector3; size: number };
  /** The camera's focal length (frame px), for the motes' size. */
  focal: number;
}

export function createShaft(o: ShaftOptions) {
  const L = o.light, spot = (L as SpotLight).isSpotLight === true;
  L.updateMatrixWorld();
  L.target.updateMatrixWorld();
  const at = new Vector3().setFromMatrixPosition(L.matrixWorld);
  const dir = new Vector3().setFromMatrixPosition(L.target.matrixWorld).sub(at).normalize();
  // the hull: the hole's corners, a little wider, and where the light's rays through them end
  // (a directional light's rays are parallel: they come from far off along it)
  const { corner, across, up } = o.hole;
  const from = spot ? at : corner.clone().addScaledVector(dir, -1e3);
  const defines: Record<string, string> = spot ? { SHAFT_COMPARE: '' } : {};
  const grow = 0.06;
  const near = [[-grow, -grow], [1 + grow, -grow], [1 + grow, 1 + grow], [-grow, 1 + grow]]
    .map(([a, b]) => corner.clone().addScaledVector(across, a).addScaledVector(up, b));
  const far = near.map((p) => p.clone().add(p.clone().sub(from).normalize().multiplyScalar(o.length)));
  const pos: number[] = [];
  for (const p of [...near, ...far]) pos.push(p.x, p.y, p.z);
  // faces (outward): near 0-3, far 4-7, then the four sides
  const quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  const index: number[] = [];
  for (const [a, b, c, d] of quads) index.push(a, b, c, a, c, d);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geometry.setIndex(index);
  // the hull's planes (outward normals), for the ray's entry and exit
  const inside = near.concat(far).reduce((s, p) => s.add(p), new Vector3()).multiplyScalar(1 / 8);
  const planes = quads.map(([a, b, c]) => {
    const pa = [...near, ...far][a], pb = [...near, ...far][b], pc = [...near, ...far][c];
    const n = pb.clone().sub(pa).cross(pc.clone().sub(pa)).normalize();
    if (n.dot(inside.clone().sub(pa)) > 0) n.negate();
    return new Vector4(n.x, n.y, n.z, -n.dot(pa));
  });

  const shadowUniforms = {
    tShadow: { value: null as unknown },
    uShadowMatrix: { value: L.shadow.matrix },
    uShadowBias: { value: L.shadow.bias },
    uLightPos: { value: from },
    uLightDir: { value: dir },
    uCone: { value: spot ? new Vector2(Math.cos((L as SpotLight).angle), Math.cos((L as SpotLight).angle * (1 - (L as SpotLight).penumbra))) : new Vector2(-2, -1.9) },
  };
  const material = new ShaderMaterial({
    defines, transparent: true, depthWrite: false, blending: AdditiveBlending, side: FrontSide,
    uniforms: {
      ...shadowUniforms,
      uPlanes: { value: planes },
      uColor: { value: o.color.clone() },
      uDensity: { value: o.density },
      uThin: { value: o.thin },
      uFloorY: { value: o.floorY },
      uNear: { value: new Vector4().copy(planes[0]) },
      uTime: { value: 0 },
      uStrength: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4( position, 1.0 );
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${SHADOW}
      ${NOISE}
      uniform vec4 uPlanes[ 6 ];
      uniform vec4 uNear;
      uniform vec3 uColor;
      uniform float uDensity, uThin, uFloorY, uTime, uStrength;
      varying vec3 vWorld;
      void main() {
        vec3 ro = cameraPosition, rd = normalize( vWorld - cameraPosition );
        float t0 = 0.0, t1 = 1e4;
        for ( int i = 0; i < 6; i ++ ) {
          float den = dot( uPlanes[ i ].xyz, rd ), num = -( dot( uPlanes[ i ].xyz, ro ) + uPlanes[ i ].w );
          if ( abs( den ) < 1e-6 ) { if ( num < 0.0 ) discard; continue; }
          float t = num / den;
          if ( den < 0.0 ) t0 = max( t0, t ); else t1 = min( t1, t );
        }
        if ( t1 <= t0 ) discard;
        // dithered steps: the noise per pixel hides the banding of so few samples
        float jitter = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
        float dt = ( t1 - t0 ) / float( ${STEPS} ), sum = 0.0;
        for ( int i = 0; i < ${STEPS}; i ++ ) {
          vec3 p = ro + rd * ( t0 + ( float( i ) + jitter ) * dt );
          if ( p.y < uFloorY ) break;
          float lit = lightAt( p );
          if ( lit <= 0.0 ) continue;
          // thinning away from the window, and a slow drift of dust
          float d = -( dot( uNear.xyz, p ) + uNear.w );
          float dust = 0.55 + 0.9 * sNoise( p * 2.3 + vec3( 0.0, -0.05, 0.08 ) * uTime ) * sNoise( p * 0.9 - vec3( 0.03, 0.0, 0.0 ) * uTime );
          sum += lit * exp( -d * uThin ) * dust;
        }
        float a = sum * dt * uDensity * uStrength;
        gl_FragColor = vec4( uColor * a, 1.0 );
      }`,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'shaft';
  mesh.renderOrder = 3; // after the paper, before the flame's sprites
  mesh.frustumCulled = false;

  // ---- motes
  let points: Points | null = null;
  const mu = { uTime: { value: 0 }, uStrength: { value: 1 }, uScale: { value: 1 } };
  if (o.motes) {
    const m = o.motes, R = mulberry32(1729);
    const at: number[] = [], seed: number[] = [];
    const hull = (a: number, b: number, c: number) => {
      const n = corner.clone().addScaledVector(across, a).addScaledVector(up, b);
      return n.add(n.clone().sub(from).normalize().multiplyScalar(c * o.length * 0.8));
    };
    for (let i = 0; i < m.shaft; i++) {
      const p = hull(R() * 1.1 - 0.05, R() * 1.1 - 0.05, R() ** 0.8);
      if (p.y < o.floorY + 0.05) { i--; continue; }
      at.push(p.x, p.y, p.z);
      seed.push(R(), R(), R(), R());
    }
    for (let i = 0; i < m.candle; i++) {
      // round the flame, thinning out with distance; none below the desk top
      const r = 0.25 + 1.3 * R() ** 1.6, th = R() * Math.PI * 2, ph = Math.acos(2 * R() - 1);
      const p = m.candleAt.clone().add(new Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph) * 0.7, Math.sin(ph) * Math.sin(th)).multiplyScalar(r));
      if (p.y < m.candleAt.y - 0.5) { i--; continue; }
      at.push(p.x, p.y, p.z);
      seed.push(R(), R(), R(), R());
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(at, 3));
    g.setAttribute('aSeed', new Float32BufferAttribute(seed, 4));
    const pm = new ShaderMaterial({
      defines, transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: {
        ...shadowUniforms, ...mu,
        uFocal: { value: o.focal },
        uSize: { value: m.size },
        uColor: { value: m.color.clone() },
        uWarm: { value: m.warm.clone() },
        uCandle: { value: m.candleAt.clone() },
        uCandleOn: { value: 1 },
      },
      vertexShader: /* glsl */ `
        ${SHADOW}
        attribute vec4 aSeed;
        uniform float uTime, uStrength, uScale, uFocal, uSize, uCandleOn;
        uniform vec3 uColor, uWarm, uCandle;
        varying vec3 vColor;
        void main() {
          // a slow wander, and a slower settling
          vec3 p = position + vec3( sin( uTime * ( 0.13 + 0.1 * aSeed.x ) + aSeed.y * 6.28 ), -0.4 + sin( uTime * ( 0.09 + 0.07 * aSeed.z ) + aSeed.w * 6.28 ), cos( uTime * ( 0.11 + 0.08 * aSeed.w ) + aSeed.x * 6.28 ) ) * 0.07;
          float lit = lightAt( p );
          float dc = length( p - uCandle );
          float warm = uCandleOn / ( 1.0 + dc * dc * 5.0 );
          // each flake turns: it glints now and then
          float glint = 0.3 + 0.7 * pow( 0.5 + 0.5 * sin( uTime * ( 0.8 + 1.7 * aSeed.z ) + aSeed.x * 40.0 ), 4.0 );
          vColor = ( uColor * lit + uWarm * warm ) * glint * uStrength;
          vec4 mv = viewMatrix * vec4( p, 1.0 );
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max( 1.0, uSize * ( 0.6 + 0.8 * aSeed.y ) * uFocal * uScale / -mv.z );
          if ( dot( vColor, vec3( 1.0 ) ) < 0.004 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); // unlit: off screen
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          float r = length( gl_PointCoord - 0.5 ) * 2.0;
          if ( r > 1.0 ) discard;
          gl_FragColor = vec4( vColor * ( 1.0 - smoothstep( 0.2, 1.0, r ) ), 1.0 );
        }`,
    });
    points = new Points(g, pm);
    points.name = 'motes';
    points.frustumCulled = false;
    points.renderOrder = 4;
  }

  const uniformsOf = [material.uniforms, ...(points ? [(points.material as ShaderMaterial).uniforms] : [])];
  return {
    mesh, points,
    /**
     * t: seconds; strength: 0 hidden .. 1; candle: 0 out .. 1 burning. Returns true when the
     * frame must be rendered for the shaft: while the light's shadow map does not exist yet
     * (three makes a spot's at its first shadow render), and when the shaft shows or hides.
     */
    update(t: number, strength: number, candle = 1): boolean {
      const map = L.shadow.map?.depthTexture ?? null, was = mesh.visible;
      for (const u of uniformsOf) {
        u.tShadow.value = map;
        u.uTime.value = t;
        u.uStrength.value = strength;
      }
      if (points) (points.material as ShaderMaterial).uniforms.uCandleOn.value = candle;
      mesh.visible = strength > 0.001 && !!map;
      if (points) points.visible = mesh.visible;
      return !map || mesh.visible !== was;
    },
    /** Device px per frame px (the motes' size). */
    setScale(s: number) { mu.uScale.value = s; },
  };
}
