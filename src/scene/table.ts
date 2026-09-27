// The wooden table under the book: varnished walnut boards, drawn by the shader from world
// position (no texture, so it stays sharp at any size). The boards run left to right, each
// with its own grain: the growth rings of a log cut by the board's flat face, lines along the
// board that open into arches where the cut runs close to the rings (flat-sawn), fine pores
// along the grain, a dark seam between boards and a butt joint now and then; the varnish is a
// little glossier on the wood than in the seams.
import { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';

/** Board width across the table and board length (world units; 1 unit is about 3 cm). */
const BOARD = { width: 3.4, length: 46, offset: 1.1 };

const WOOD = /* glsl */ `
varying vec2 vWood;
float wHash( vec2 p ) {
	vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
	p3 += dot( p3, p3.yzx + 33.33 );
	return fract( ( p3.x + p3.y ) * p3.z );
}
float wNoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p ), u = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( wHash( i ), wHash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( wHash( i + vec2( 0.0, 1.0 ) ), wHash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
float wFbm( vec2 p ) {
	float s = 0.0, a = 0.5;
	for ( int i = 0; i < 4; i ++ ) { s += a * wNoise( p ); p = p * 2.03 + 17.1; a *= 0.5; }
	return s / 0.9375;
}
vec3 wLinear( vec3 c ) { return pow( c, vec3( 2.2 ) ); }
/** Albedo (linear) and roughness of the table at world (x, z). */
vec4 wood( vec2 p ) {
	float W = ${BOARD.width.toFixed(2)}, L = ${BOARD.length.toFixed(2)};
	float z = p.y + ${BOARD.offset.toFixed(2)};
	float row = floor( z / W ), v = z - row * W;               // across the board
	float shift = wHash( vec2( row, 3.7 ) ) * L;
	float col = floor( ( p.x + shift ) / L ), u = p.x + shift - col * L; // along it
	float id = wHash( vec2( row * 1.7 + 0.3, col * 2.9 + 1.1 ) );
	// the log's pith, below the face and off to one side; the log tapers along the board
	float v0 = W * ( -0.2 + 1.4 * wHash( vec2( id, 1.3 ) ) );
	float depth = 0.5 + 1.8 * wHash( vec2( id, 2.1 ) ) + 0.06 * ( u - 0.5 * L ) * ( wHash( vec2( id, 5.0 ) ) - 0.5 );
	float warp = ( wFbm( vec2( u * 0.09, v * 0.8 ) + id * 13.0 ) - 0.5 ) * 0.5 + ( wNoise( vec2( u * 0.6, v * 3.0 ) + id * 5.0 ) - 0.5 ) * 0.05;
	float dv = v - v0 + warp;
	float r = sqrt( dv * dv + depth * depth ) * ( 8.5 + 3.0 * id );
	r += 0.7 * wNoise( vec2( r * 0.3, id * 11.0 ) ); // some years grow wider than others
	float ring = fract( r );
	float aa = clamp( fwidth( r ) * 1.5, 0.0, 0.5 );
	// early wood light, late wood darker, a soft edge on one side and a sharp one on the other
	float late = smoothstep( 0.52 - aa, 0.78 + aa, ring ) * ( 1.0 - smoothstep( 0.93 - aa, 1.0, ring ) );
	late *= 1.0 - smoothstep( 0.2, 0.5, aa ); // too fine to draw: leave the average
	// pores: short dark flecks along the grain, faded out where they would alias
	float pw = fwidth( v ) * 38.0;
	float pore = smoothstep( 0.78, 0.92, wNoise( vec2( u * 1.6, v * 38.0 ) + id * 7.0 ) ) * ( 1.0 - smoothstep( 0.4, 0.9, pw ) );
	// broad figure: lighter and darker streaks along the board
	float figure = wFbm( vec2( u * 0.05, v * 0.55 + id * 9.0 ) );
	vec3 light = vec3( 0.25, 0.155, 0.095 ), mid = vec3( 0.19, 0.115, 0.07 ), dark = vec3( 0.115, 0.066, 0.04 );
	vec3 c = mix( mid, light, smoothstep( 0.3, 0.75, figure ) );
	c = mix( c, dark, 0.42 * late );
	c = mix( c, dark * 0.8, 0.45 * pore );
	c *= 0.86 + 0.28 * id; // each board a little lighter or darker
	// the seams: a dark groove between boards, a rounded, lighter lip beside it
	float e = min( v, W - v ), j = min( u, L - u );
	float seam = 1.0 - smoothstep( 0.006, 0.03, e );
	float lip = smoothstep( 0.02, 0.035, e ) * ( 1.0 - smoothstep( 0.035, 0.08, e ) );
	float butt = 1.0 - smoothstep( 0.006, 0.025, j );
	c *= ( 1.0 - 0.55 * max( seam, butt ) ) * ( 1.0 + 0.1 * lip );
	float rough = 0.46 + 0.14 * wNoise( vec2( u * 0.3, v * 1.5 ) + id * 3.0 ) + 0.1 * late + 0.3 * max( seam, butt );
	return vec4( wLinear( c ), rough );
}
`;

export function createTable() {
  const W = 64, D = 40;
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, metalness: 0 });
  material.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWood;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvWood = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${WOOD}\nvec4 wTable;`)
      .replace('#include <map_fragment>', '#include <map_fragment>\n\twTable = wood( vWood );\n\tdiffuseColor.rgb *= wTable.rgb;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = wTable.a;');
  };
  material.customProgramCacheKey = () => 'table-wood';
  const mesh = new Mesh(new PlaneGeometry(W, D), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0, 3);
  mesh.receiveShadow = true;
  mesh.name = 'table';
  return mesh;
}
