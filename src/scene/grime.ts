// Grime and decay for the looks (?look=, src/scene/mood.ts), drawn at runtime over the baked
// paper: the materials of the wall, the floor, the furniture rows, the two top sheets and the
// table get a few lines of shader (onBeforeCompile) that stain them procedurally. Each piece
// is keyed by its own board coordinates (its texture's SVG viewBox; world position for the
// table), so a stain stays on its card while the card folds and rises, and needs no texture.
//   wall      rising damp with tide lines above the baseboard, a leak running down from the
//             cornice, streaks under the window's sill, soot over the mantel, the paper peeling
//             off along both seams and a torn patch showing the plaster, mould specks low down
//   floor     dirt in drifts along the walls and trodden in, scuffs, slush and wet rings under
//             the window; the rug worn pale where it is walked on, two stains, frayed edges
//   cards     the furniture rows: a dull film, darker toward their feet
//   pages     greyer paper, tanned edges, foxing (faint over the log's column), a cup ring
//   table     the varnish dull and scratched, water rings, dust
import { Mesh, Vector4, type Material, type MeshStandardMaterial, type Object3D, type WebGLProgramParametersWithUniforms } from 'three';
import type { Art } from '../assets';

const COMMON = /* glsl */ `
uniform vec4 uGrimeBox;
uniform float uGrime;
float gHash( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
float gNoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p ), u = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( gHash( i ), gHash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( gHash( i + vec2( 0.0, 1.0 ) ), gHash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
float gFbm( vec2 p ) {
	float s = 0.0, a = 0.5;
	for ( int i = 0; i < 4; i ++ ) { s += a * gNoise( p ); p = p * 2.07 + 13.1; a *= 0.5; }
	return s / 0.9375;
}
vec3 gLin( vec3 c ) { return pow( c, vec3( 2.2 ) ); }
// a stain where the field f passes th: its body (x) and the tide line at its edge (y)
vec2 gStain( float f, float th, float w ) {
	return vec2( smoothstep( th, th + w, f ), smoothstep( th - w * 0.6, th, f ) * ( 1.0 - smoothstep( th, th + w * 1.2, f ) ) );
}
// specks: at most one per cell of size s, of radius r (px), with probability p
float gSpeck( vec2 q, float s, float r, float p ) {
	vec2 c = floor( q / s ), o = vec2( gHash( c + 3.1 ), gHash( c + 7.7 ) );
	float d = length( q - ( c + 0.2 + 0.6 * o ) * s ), k = gHash( c + 1.3 );
	return step( k, p ) * ( 1.0 - smoothstep( r * ( 0.4 + 0.8 * gHash( c + 5.2 ) ), r * ( 0.9 + 0.8 * gHash( c + 5.2 ) ), d ) );
}
// short strokes (scratches, scuffs): at most one per cell of size s, of random length and
// turn, with probability p; w: half width (px); antialiased over the pixel's footprint
float gStroke( vec2 q, float s, float w, float p ) {
	vec2 c = floor( q / s ), l = q - ( c + 0.5 ) * s;
	float a = gHash( c + 2.9 ) * 3.1416, len = s * ( 0.15 + 0.3 * gHash( c + 8.3 ) );
	vec2 dir = vec2( cos( a ), sin( a ) ), o = ( vec2( gHash( c + 4.4 ), gHash( c + 6.1 ) ) - 0.5 ) * s * 0.3;
	vec2 d = l - o;
	float t = clamp( dot( d, dir ), -len, len );
	float dist = length( d - dir * t ), aa = fwidth( dist ) + 1e-4;
	return step( gHash( c + 0.7 ), p ) * ( 1.0 - smoothstep( w, w + aa, dist ) ) * ( 1.0 - smoothstep( 0.6, 1.0, abs( t ) / len ) * 0.8 );
}
// a ring left by a glass or a cup: centre, radius (px); broken, wobbly, a faint film inside
float gRing( vec2 q, vec2 at, float r ) {
	vec2 d = q - at, n = d / max( length( d ), 1e-3 ); // (noise on the direction: no seam where an angle would wrap)
	float rr = length( d ) + 2.0 * gNoise( n * 3.0 + r );
	float line = exp( -pow( ( rr - r ) / 1.8, 2.0 ) ) * smoothstep( 0.25, 0.6, gNoise( n * 2.2 + vec2( r, 3.0 ) ) );
	return line + 0.12 * ( 1.0 - smoothstep( r * 0.5, r, rr ) );
}
// board px of the piece under this fragment (its SVG viewBox)
vec2 gBoard( vec2 uv ) { return uGrimeBox.xy + vec2( uv.x, 1.0 - uv.y ) * uGrimeBox.zw; }
`;

/** The wallpaper (wall.svg: 1340 wide, the baseboard at 412..440, seams at 704 and 1165). */
const WALL = /* glsl */ `
vec3 grime( vec2 q, vec3 c ) {
	float k = uGrime;
	float big = gFbm( q / 95.0 ), fine = gNoise( q / 7.0 );
	// rising damp: tide-lined blotches climbing from the baseboard, highest in the corners
	float rise = smoothstep( 250.0, 400.0, q.y + 40.0 * big ) + 0.35 * ( 1.0 - smoothstep( 0.0, 160.0, min( q.x, 1340.0 - q.x ) ) );
	// (water fades the dark paper to a muddy tan and leaves a brown tide line at its edge)
	vec3 faded = gLin( vec3( 0.36, 0.34, 0.27 ) ) * ( 0.8 + 0.4 * big ), tide = gLin( vec3( 0.2, 0.15, 0.1 ) );
	vec2 damp = gStain( big * 0.75 + rise * 0.55 + 0.05 * fine, 0.72, 0.05 );
	c = mix( c, faded, damp.x * 0.45 * k );
	c = mix( c, tide, damp.y * 0.6 * k );
	// a leak from the cornice over the bookshelf and one over the calendar: stains and runs
	for ( int i = 0; i < 2; i ++ ) {
		float x0 = i == 0 ? 170.0 : 1240.0;
		float spread = exp( -pow( ( q.x - x0 ) / ( 95.0 + 40.0 * big ), 2.0 ) ) * ( 1.0 - smoothstep( 60.0, 190.0, q.y ) );
		vec2 leak = gStain( spread + 0.3 * big, 0.62, 0.05 );
		c = mix( c, faded, leak.x * 0.5 * k );
		c = mix( c, tide, leak.y * 0.7 * k );
		float runs = smoothstep( 0.62, 0.9, gNoise( vec2( q.x / 5.0, q.y / 170.0 ) ) ) * exp( -pow( ( q.x - x0 ) / 70.0, 2.0 ) ) * smoothstep( 70.0, 110.0, q.y ) * ( 1.0 - smoothstep( 150.0, 330.0, q.y ) );
		c *= 1.0 - 0.45 * runs * k;
	}
	// under the window's sill: water has run down in streaks
	float sill = step( 346.0, q.x ) * step( q.x, 624.0 ) * smoothstep( 336.0, 346.0, q.y );
	c *= 1.0 - 0.5 * sill * smoothstep( 0.5, 0.85, gNoise( vec2( q.x / 6.0, q.y / 90.0 ) ) ) * k;
	// soot over the fireplace's mantel, rising and spreading
	float soot = exp( -pow( ( q.x - 968.0 ) / ( 150.0 + 0.5 * ( 260.0 - q.y ) ), 2.0 ) ) * smoothstep( 40.0, 250.0, q.y ) * ( 1.0 - smoothstep( 250.0, 262.0, q.y ) );
	c *= 1.0 - 0.55 * soot * ( 0.6 + 0.4 * big ) * k;
	// the paper peeling off along the seams: plaster bared in a ragged strip, a dark curl at its edge
	vec3 plaster = gLin( vec3( 0.56, 0.53, 0.47 ) ) * ( 0.7 + 0.25 * fine + 0.3 * gFbm( q / 12.0 ) );
	for ( int i = 0; i < 2; i ++ ) {
		float sx = i == 0 ? 704.0 : 1165.0, dir = i == 0 ? 1.0 : -1.0;
		float along = i == 0 ? smoothstep( 60.0, 90.0, q.y ) * ( 1.0 - smoothstep( 170.0, 250.0, q.y ) ) : smoothstep( 270.0, 300.0, q.y ) * ( 1.0 - smoothstep( 380.0, 405.0, q.y ) );
		float w = along * ( 7.0 + 26.0 * gNoise( vec2( q.y / 30.0, float( i ) * 9.0 ) ) );
		float d = ( q.x - sx ) * dir;
		float bare = step( 0.0, d ) * ( 1.0 - smoothstep( w - 1.0, w + 1.0, d ) ) * step( 0.5, along );
		c = mix( c, plaster, bare * k );
		// the curled paper: its pale back, then the shadow it throws on the wall
		float back = smoothstep( w - 1.0, w, d ) * ( 1.0 - smoothstep( w + 1.2, w + 2.2, d ) ) * step( 0.5, along );
		float curl = smoothstep( w + 1.2, w + 2.2, d ) * ( 1.0 - smoothstep( w + 2.2, w + 6.0, d ) ) * step( 0.5, along );
		c = mix( c, gLin( vec3( 0.72, 0.68, 0.58 ) ), back * 0.8 * k );
		c *= 1.0 - 0.7 * curl * k;
	}
	// a torn patch low on the right, the plaster showing
	float tear = length( ( q - vec2( 1060.0, 350.0 ) ) / vec2( 30.0, 18.0 ) ) + 0.45 * gNoise( q / 6.0 ) + 0.3 * big;
	c = mix( c, plaster, ( 1.0 - smoothstep( 0.95, 1.05, tear ) ) * k );
	c *= 1.0 - 0.6 * smoothstep( 0.9, 1.05, tear ) * ( 1.0 - smoothstep( 1.05, 1.3, tear ) ) * k;
	// mould specks low down, and an overall dinginess
	float mould = gSpeck( q, 9.0, 2.2, 0.55 ) * smoothstep( 330.0, 405.0, q.y ) * smoothstep( 0.4, 0.7, big );
	c *= 1.0 - 0.6 * mould * k;
	c *= 1.0 - k * ( 0.1 + 0.12 * big );
	return c;
}
`;

/** The floor (floor.svg, y from the fold; the rug at 380..1160 x 76..486). */
const FLOOR = /* glsl */ `
vec3 grime( vec2 q, vec3 c ) {
	float k = uGrime;
	float big = gFbm( q / 80.0 ), fine = gNoise( q / 5.0 );
	float lum = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	// the rug: worn pale and grey where it is walked on, two old stains, frayed edges
	vec2 r0 = vec2( 380.0, 76.0 ), r1 = vec2( 1160.0, 486.0 );
	float edge = min( min( q.x - r0.x, r1.x - q.x ), min( q.y - r0.y, r1.y - q.y ) );
	float onRug = step( 0.0, edge );
	float worn = onRug * smoothstep( 0.2, 0.75, 1.0 - length( ( q - vec2( 800.0, 300.0 ) ) / vec2( 330.0, 170.0 ) ) + 0.35 * ( big - 0.5 ) );
	c = mix( c, vec3( lum ) * 1.25 + gLin( vec3( 0.18, 0.17, 0.15 ) ), worn * 0.55 * k );
	c *= 1.0 - onRug * k * 0.4 * smoothstep( 0.55, 0.8, gNoise( vec2( ( q.x + q.y * 0.2 ) / 2.2, q.y / 40.0 ) ) ) * ( 1.0 - smoothstep( 0.0, 9.0, edge ) );
	for ( int i = 0; i < 2; i ++ ) {
		vec2 at = i == 0 ? vec2( 560.0, 210.0 ) : vec2( 1015.0, 395.0 );
		float f = 1.0 - length( ( q - at ) / ( i == 0 ? vec2( 46.0, 30.0 ) : vec2( 34.0, 26.0 ) ) ) + 0.35 * ( big - 0.5 ) + 0.1 * ( fine - 0.5 );
		vec2 s = gStain( f, 0.0, 0.12 );
		c *= mix( vec3( 1.0 ), gLin( vec3( 0.55, 0.45, 0.4 ) ), s.x * 0.8 * k );
		c *= mix( vec3( 1.0 ), gLin( vec3( 0.4, 0.3, 0.26 ) ), s.y * 0.8 * k );
	}
	// the boards: dirt drifted along the walls and trodden in, patchy
	float wallDist = min( q.y - 4.0, min( q.x, 1340.0 - q.x ) );
	float drift = 1.0 - smoothstep( 0.0, 70.0, wallDist + 40.0 * big );
	float trodden = smoothstep( 0.45, 0.85, big ) * ( 1.0 - onRug * 0.5 );
	c *= 1.0 - k * ( 0.12 + 0.3 * drift + 0.22 * trodden + 0.06 * fine );
	c = mix( c, c * gLin( vec3( 0.93, 0.9, 0.84 ) ), k );
	// scuffs: short dark strokes where chairs and heels scraped, in patches
	float sc = gStroke( q, 34.0, 0.9, 0.7 ) * smoothstep( 0.45, 0.7, gNoise( q / 110.0 + 9.0 ) );
	c *= 1.0 - 0.45 * sc * ( 1.0 - onRug ) * k;
	// slush blown in under the window, and the wet rings it leaves as it melts
	float under = exp( -pow( ( q.x - 490.0 ) / 170.0, 2.0 ) ) * ( 1.0 - smoothstep( 40.0, 170.0, q.y ) );
	vec2 wet = gStain( under + 0.4 * ( big - 0.5 ), 0.42, 0.06 );
	c *= mix( vec3( 1.0 ), gLin( vec3( 0.7, 0.68, 0.64 ) ), wet.x * 0.7 * k );
	c *= mix( vec3( 1.0 ), gLin( vec3( 0.45, 0.42, 0.38 ) ), wet.y * 0.7 * k );
	float slush = smoothstep( 0.6, 0.78, under * 0.8 + 0.55 * gFbm( q / 14.0 ) - 0.12 ) * uSnow;
	c = mix( c, gLin( vec3( 0.7, 0.73, 0.75 ) ) * ( 0.85 + 0.3 * fine ), slush * 0.6 * k );
	return c;
}
`;

/** The furniture rows: a dull film, darker toward the feet (y near the SVG's bottom). */
const CARD = /* glsl */ `
vec3 grime( vec2 q, vec3 c ) {
	float k = uGrime;
	float big = gFbm( q / 60.0 );
	float low = smoothstep( uGrimeBox.y + uGrimeBox.w * 0.55, uGrimeBox.y + uGrimeBox.w, q.y );
	c *= 1.0 - k * ( 0.08 + 0.14 * big + 0.18 * low * ( 0.5 + big ) );
	c *= 1.0 - 0.35 * k * gSpeck( q, 11.0, 1.4, 0.3 );
	return c;
}
`;

/**
 * The top sheets (page px: 0..1340 across the spread, 0..720 from the head): greyer paper,
 * tanned edges, foxing (faint over the log's column), a cup ring on the right page.
 */
const PAGE = /* glsl */ `
vec3 grime( vec2 q, vec3 c ) {
	float k = uGrime;
	float lum = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	c = mix( c, vec3( lum ) * gLin( vec3( 0.97, 0.96, 0.93 ) ), 0.45 * k ); // grey, a little green-yellow
	float big = gFbm( q / 70.0 );
	// the log's column keeps most of its paper white, for the ink's contrast
	float column = step( 20.0, q.x ) * step( q.x, 606.0 ) * step( 200.0, q.y ) * step( q.y, 700.0 );
	c *= 1.0 - k * ( 0.07 + 0.08 * big ) * mix( 1.0, 0.4, column );
	// tanning toward the page's outer edges and its tail
	float e = min( min( q.x, 1340.0 - q.x ), 720.0 - q.y ) + 25.0 * big;
	c *= mix( vec3( 1.0 ), gLin( vec3( 0.86, 0.78, 0.62 ) ), ( 1.0 - smoothstep( 0.0, 70.0, e ) ) * mix( 0.8, 0.3, column ) * k );
	// foxing: brown specks in clusters, fewer in the log's column
	float fox = gSpeck( q, 16.0, 2.4, 0.18 ) * smoothstep( 0.45, 0.7, big ) + gSpeck( q + 7.0, 6.0, 0.9, 0.3 ) * smoothstep( 0.55, 0.8, big );
	c *= mix( vec3( 1.0 ), gLin( vec3( 0.72, 0.56, 0.38 ) ), min( 1.0, fox ) * mix( 0.85, 0.25, column ) * k );
	// a cup was set down on the right page once
	c *= mix( vec3( 1.0 ), gLin( vec3( 0.78, 0.66, 0.5 ) ), gRing( q, vec2( 1180.0, 668.0 ), 40.0 ) * 0.45 * k );
	return c;
}
`;

/** The table (world x, z): dull, scratched varnish, water rings, dust. */
const TABLE = /* glsl */ `
vec3 grime( vec2 w, vec3 c ) {
	float k = uGrime;
	vec2 q = w * 100.0; // board px
	float big = gFbm( q / 160.0 );
	float lum = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	c = mix( c, vec3( lum ), 0.15 * k );
	// dust, thicker away from where hands go
	c = mix( c, gLin( vec3( 0.4, 0.39, 0.37 ) ), k * ( 0.05 + 0.12 * smoothstep( 0.4, 0.8, big ) ) );
	// scratches: short pale strokes every which way, thicker in patches
	float s = gStroke( q, 70.0, 0.45, 0.35 ) + gStroke( q + vec2( 31.0, 17.0 ), 43.0, 0.35, 0.25 * smoothstep( 0.3, 0.7, big ) );
	c = mix( c, gLin( vec3( 0.42, 0.39, 0.36 ) ), min( 1.0, s ) * 0.4 * k );
	// water rings where glasses stood
	float rings = gRing( q, vec2( -880.0, 120.0 ), 40.0 ) + gRing( q, vec2( 1030.0, -260.0 ), 34.0 ) + gRing( q, vec2( -790.0, -520.0 ), 46.0 );
	c = mix( c, gLin( vec3( 0.46, 0.44, 0.41 ) ), min( 1.0, rings ) * 0.3 * k );
	return c;
}
`;

type Kind = 'wall' | 'floor' | 'card' | 'page' | 'table';
const RECIPES: Record<Kind, string> = { wall: WALL, floor: FLOOR, card: CARD, page: PAGE, table: TABLE };

/**
 * Adds a recipe to a material: after the base colour is read (and, on the pages, before the
 * log's ink is laid over it). Keeps any patch the material has already (the ink, the wood).
 */
function patch(material: Material, kind: Kind, box: [number, number, number, number], amount: number, extra: Record<string, { value: unknown }> = {}) {
  const m = material as MeshStandardMaterial;
  const before = m.onBeforeCompile.bind(m), key = m.customProgramCacheKey.bind(m);
  const uniforms = { uGrimeBox: { value: new Vector4(...box) }, uGrime: { value: amount }, ...extra };
  m.onBeforeCompile = (s: WebGLProgramParametersWithUniforms, r) => {
    before(s, r);
    Object.assign(s.uniforms, uniforms);
    const decl = Object.keys(extra).map((n) => `uniform float ${n};`).join('\n');
    if (kind === 'table') {
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vGrimeW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvGrimeW = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec2 vGrimeW;\n${decl}\n${COMMON}\n${RECIPES[kind]}`)
        .replace('diffuseColor.rgb *= wTable.rgb;', 'diffuseColor.rgb *= wTable.rgb;\n\tdiffuseColor.rgb = grime( vGrimeW, diffuseColor.rgb );')
        .replace('roughnessFactor = wTable.a;', 'roughnessFactor = min( 1.0, wTable.a + 0.22 * uGrime );');
    } else {
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', `#include <common>\n${decl}\n${COMMON}\n${RECIPES[kind]}`)
        .replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = grime( gBoard( vMapUv ), diffuseColor.rgb );');
    }
  };
  m.customProgramCacheKey = () => `${key()}+grime-${kind}`;
  m.needsUpdate = true;
  return uniforms;
}

/**
 * Stains the room. `amount`: 0..1; `snow`: 1 while slush lies under the window (winter).
 * Returns the uniforms that change later (the slush).
 */
export function applyGrime(root: Object3D, art: Art, amount: number, snow = 0) {
  const mesh = (name: string) => {
    const o = root.getObjectByName(name);
    return o instanceof Mesh ? o : null;
  };
  const slush = { value: snow };
  const box = (name: string) => art[name].viewBox;
  const wall = mesh('wall'), floor = mesh('floor'), table = mesh('table');
  if (wall) patch(wall.material as Material, 'wall', box('wall'), amount);
  if (floor) {
    // the floor sheet's uv runs over its viewBox, y measured from the fold
    const [x, y, w, h] = box('floor');
    patch(floor.material as Material, 'floor', [x, y, w, h], amount, { uSnow: slush });
  }
  for (const name of ['furniture', 'desk', 'front-chair', 'front-right']) {
    const m = mesh(name);
    if (m) patch(m.material as Material, 'card', box(name), amount);
  }
  for (const name of ['page-left', 'page-right']) {
    const m = mesh(name);
    if (m) patch(m.material as Material, 'page', box(name), amount);
  }
  if (table) patch(table.material as Material, 'table', [0, 0, 1, 1], amount);
  return { slush };
}
