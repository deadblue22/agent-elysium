// Soft shadows for the key light that harden where they touch (PCSS): the window light is a
// broad source, so a shadow is crisp at the foot of what casts it and spreads the further it
// falls: the wall's shadow on the table goes soft, the puppets' and the rows' shadows stay
// sharp at their feet.
//
// three.js r186 samples PCF shadow maps through a comparison sampler, which cannot read the
// depth of a blocker. The key light gets its own shadow map with a plain depth texture
// (three keeps a map it finds on the light), and the shader chunks are patched once, before
// any material compiles, to read directional shadow maps as depth: a blocker search, a
// penumbra that grows with the distance to the blockers, then a filtered comparison over it.
// The spot and point lights keep three's PCF.
import { DepthFormat, DepthTexture, NearestFilter, ShaderChunk, UnsignedIntType, WebGLRenderTarget, type DirectionalLight, type OrthographicCamera } from 'three';

/** Replaces `from` in a chunk, failing loudly when a three.js upgrade has moved it. */
function patch(chunk: keyof typeof ShaderChunk, from: string | RegExp, to: string) {
  const src = ShaderChunk[chunk];
  if (!(typeof from === 'string' ? src.includes(from) : from.test(src))) throw new Error(`penumbra: ${chunk} no longer has ${from}`);
  (ShaderChunk as Record<string, string>)[chunk] = src.replace(from, to);
}

let patched = false;

/**
 * Makes `light` (the scene's only directional light that casts) cast PCSS shadows.
 * `angle`: the light's angular radius in degrees (the penumbra's spread per unit of distance);
 * `max`: the widest penumbra in world units.
 */
export function softShadows(light: DirectionalLight, o: { angle: number; max: number }) {
  const cam = light.shadow.camera as OrthographicCamera;
  cam.updateProjectionMatrix(); // three does this only when it creates the map itself
  const { x: w, y: h } = light.shadow.mapSize;
  const map = new WebGLRenderTarget(w, h);
  const depth = new DepthTexture(w, h, UnsignedIntType);
  depth.format = DepthFormat;
  depth.compareFunction = null; // read as depth, not compared
  depth.minFilter = depth.magFilter = NearestFilter;
  depth.name = `${light.name || 'key'}.shadowMap`;
  map.depthTexture = depth;
  light.shadow.map = map;
  if (patched) return;
  patched = true;

  const width = cam.right - cam.left;
  // penumbra in map uv per unit of depth (0..1 over near..far) between blocker and receiver
  const spread = ((cam.far - cam.near) * Math.tan(o.angle * (Math.PI / 180))) / width;
  const f = (v: number) => v.toFixed(6);
  const defines = /* glsl */ `
#define KEY_SPREAD ${f(spread)}
#define KEY_MAX ${f(o.max / width)}
#define KEY_MIN ${f(1.25 / w)}
`;

  patch('shadowmap_pars_fragment',
    /#if defined\( SHADOWMAP_TYPE_PCF \)\s*uniform sampler2DShadow directionalShadowMap\[ NUM_DIR_LIGHT_SHADOWS \];\s*#else\s*uniform sampler2D directionalShadowMap\[ NUM_DIR_LIGHT_SHADOWS \];\s*#endif/,
    'uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];');

  (ShaderChunk as Record<string, string>).shadowmap_pars_fragment += /* glsl */ `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
${defines}
float keyNoise( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
// a golden-angle spiral: even over the disk (k = 0.5), or denser toward the middle (k = 1)
vec2 keyDisk( int i, int n, float phi, float k ) {
	float r = pow( ( float( i ) + 0.5 ) / float( n ), k ), t = float( i ) * 2.399963229728653 + phi;
	return vec2( cos( t ), sin( t ) ) * r;
}
// the fraction of a 2 x 2 texel footprint that is lit at depth z (bilinear, as hardware PCF)
float keyLit( sampler2D map, vec2 uv, float z, vec2 size ) {
	vec2 st = uv * size - 0.5, f = fract( st ), t = 1.0 / size, b = ( floor( st ) + 0.5 ) * t;
	vec4 d = vec4( texture2D( map, b ).r, texture2D( map, b + vec2( t.x, 0.0 ) ).r, texture2D( map, b + vec2( 0.0, t.y ) ).r, texture2D( map, b + t ).r );
	vec4 lit = step( vec4( z ), d );
	return mix( mix( lit.x, lit.y, f.x ), mix( lit.z, lit.w, f.x ), f.y );
}
float getKeyShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
	vec3 c = shadowCoord.xyz / shadowCoord.w;
	c.z += shadowBias;
	// the receiver plane: how depth runs across the map here, so the wide kernels do not
	// shade a surface the light grazes with its own depth (clamped at silhouettes)
	vec3 dx = dFdx( c ), dy = dFdy( c );
	float det = dx.x * dy.y - dx.y * dy.x;
	vec2 dz = abs( det ) > 1e-14 ? vec2( dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z ) / det : vec2( 0.0 );
	dz = clamp( dz, -4.0, 4.0 );
	if ( c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0 ) return 1.0;
	float phi = keyNoise( gl_FragCoord.xy ) * PI2;
	// 1. the blockers within the widest penumbra, and how far they are (the samples crowd the
	// middle, so thin casters close by are not missed)
	float found = 0.0, sum = 0.0;
	for ( int i = 0; i < 12; i ++ ) {
		vec2 o = keyDisk( i, 12, phi, 1.0 ) * KEY_MAX;
		float d = texture2D( shadowMap, c.xy + o ).r;
		if ( d < c.z + dot( o, dz ) ) { found += 1.0; sum += d; }
	}
	if ( found == 0.0 ) return 1.0;
	if ( found == 12.0 ) return 1.0 - shadowIntensity;
	// 2. the penumbra they throw here
	float pen = clamp( ( c.z - sum / found ) * KEY_SPREAD, KEY_MIN, KEY_MAX );
	// 3. the lit fraction over it
	float lit = 0.0;
	for ( int i = 0; i < 16; i ++ ) {
		vec2 o = keyDisk( i, 16, phi + 1.3, 0.5 ) * pen;
		lit += keyLit( shadowMap, c.xy + o, c.z + dot( o, dz ), shadowMapSize );
	}
	return mix( 1.0, lit / 16.0, shadowIntensity );
}
#endif
`;
  const call = 'getShadow( directionalShadowMap[ i ]';
  patch('lights_fragment_begin', call, 'getKeyShadow( directionalShadowMap[ i ]');
  patch('shadowmask_pars_fragment', call, 'getKeyShadow( directionalShadowMap[ i ]');
}
