// The open book, built like the reference pop-up book: a cover board, a stack of flat
// sheets whose edges step irregularly along the near and outer edges, the base page on
// top of the stack carrying the study's floor sheet (the pop-up stands on it), and the
// two visible pages: torn top sheets lying a hair above the base page.
import { BoxGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, type Texture } from 'three';
import type { Art } from '../assets';
import { BASE_Y, BOOK_H, BOOK_W, COVER_TOP, GUTTER, SHEET_Y, UNIT, flatSheet, paperMaterial } from './space';

export interface PageUniforms {
  tInk: { value: Texture };
  /** Mip LOD bias for the ink: slightly negative keeps glyphs crisp without shimmer. */
  uInkBias: { value: number };
  uGutterU: { value: number };
}

/**
 * A torn top sheet: the paper texture (its alpha is the torn silhouette) with the page's
 * ink canvas composited on top before lighting, so the text lies on the paper and takes
 * its light and shadows. Only a soft occlusion toward the gutter; the sheet is flat.
 */
function pageMaterial(paper: Texture, ink: Texture, gutterU: number): { material: MeshStandardMaterial; uniforms: PageUniforms } {
  const material = new MeshStandardMaterial({
    map: paper, roughness: 0.9, metalness: 0, alphaToCoverage: true, shadowSide: DoubleSide,
  });
  const uniforms: PageUniforms = { tInk: { value: ink }, uInkBias: { value: -0.4 }, uGutterU: { value: gutterU } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', /* glsl */ `#include <map_pars_fragment>
uniform sampler2D tInk;
uniform float uInkBias;
uniform float uGutterU;`)
      .replace('#include <map_fragment>', /* glsl */ `#include <map_fragment>
{
  // The ink is premultiplied and stored as sRGB; the sampler hands back linear values.
  // Re-encoding recovers the stored premultiplied sRGB exactly, and blending there over
  // the paper (also in sRGB) is how a browser blends text: glyph weight matches the DOM.
  vec4 ink = texture( tInk, vMapUv, uInkBias );
  vec3 inkS = sRGBTransferOETF( vec4( ink.rgb, 1.0 ) ).rgb;
  vec3 paperS = sRGBTransferOETF( vec4( diffuseColor.rgb, 1.0 ) ).rgb;
  diffuseColor.rgb = sRGBTransferEOTF( vec4( paperS * ( 1.0 - ink.a ) + inkS, 1.0 ) ).rgb;
  // the gutter: the two sheets meet in a soft shade
  diffuseColor.rgb *= mix( 0.72, 1.0, smoothstep( 0.0, 0.045, abs( vMapUv.x - uGutterU ) ) );
}`);
  };
  material.customProgramCacheKey = () => 'page-ink';
  return { material, uniforms };
}

/**
 * Sheets of the stack, top (the base page) to bottom: how far each reaches past the base
 * page's outer and near edges, per side. The steps show from above as thin light and dark
 * lines, like the edges of real sheets that do not quite line up.
 */
const STACK = {
  left: { out: [0, 0.032, 0.058, 0.046, 0.088], near: [0, 0.028, 0.017, 0.056, 0.082] },
  right: { out: [0.008, 0.041, 0.027, 0.07, 0.096], near: [0.012, 0.037, 0.064, 0.05, 0.1] },
};
const SHEET_TONES = ['#ddd1b6', '#c4b597', '#d8cbaf', '#bcad8e', '#d0c2a5'];

function createStack(stackTex: Texture) {
  const group = new Group();
  group.name = 'stack';
  const n = STACK.left.out.length;
  const h = (BASE_Y - COVER_TOP) / n;
  const W = GUTTER / UNIT, D = BOOK_H / UNIT, gap = 0.002;
  const edges = SHEET_TONES.map((color) => new MeshStandardMaterial({ color, roughness: 0.95 }));
  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const out = STACK[side].out[i], near = STACK[side].near[i];
      const w = W - gap + out, d = D + near;
      // the fore-edge shows a band of the (legacy) page-block texture: fine sheet lines
      const fore = stackTex.clone();
      fore.repeat.set(0.5, 1 / n);
      fore.offset.set(side === 'left' ? 0 : 0.5, 1 - (i + 1) / n);
      const foreMat = new MeshStandardMaterial({ map: fore, roughness: 0.95 });
      const edge = edges[i];
      const slab = new Mesh(new BoxGeometry(w, h, d), [edge, edge, edge, edge, foreMat, edge]);
      slab.position.set(s * (gap + w / 2), BASE_Y - h * (i + 0.5), -D / 2 + d / 2);
      slab.castShadow = slab.receiveShadow = true;
      group.add(slab);
    }
    // the torn top sheet's own edge: the step from the base page up to the sheet
    const lip = new Mesh(new BoxGeometry(W - gap - 0.004, SHEET_Y - BASE_Y, 0.004), new MeshStandardMaterial({ color: '#e2d6bd', roughness: 0.95 }));
    lip.position.set(s * (gap + (W - gap) / 2), (BASE_Y + SHEET_Y) / 2, D / 2 - 0.002);
    lip.castShadow = lip.receiveShadow = true;
    group.add(lip);
  }
  return group;
}

export function createBook(art: Art, inkLeft: Texture, inkRight: Texture) {
  const group = new Group();
  group.name = 'book';

  // the cover board, showing beyond the stack
  const cover = new Mesh(new BoxGeometry(13.76, COVER_TOP, BOOK_H / UNIT + 0.3), new MeshStandardMaterial({ color: '#181d2b', roughness: 0.7 }));
  cover.position.set(0, COVER_TOP / 2, 0.09);
  cover.castShadow = cover.receiveShadow = true;
  group.add(cover, createStack(art.stack.texture));

  // the base page's floor sheet: the ground of the pop-up, from its fold down past the lowest tear
  const [fx, fy, fw, fh] = art.floor.viewBox, fold = art.floor.meta.fold;
  const floor = flatSheet(fx, fx + fw, fold + fy, fold + fy + fh, BASE_Y + 0.003);
  floor.material = paperMaterial(art.floor.texture, 0.95);
  floor.receiveShadow = true;
  floor.name = 'floor';
  group.add(floor);

  // the torn top sheets
  const left = pageMaterial(art['page-left'].texture, inkLeft, 1);
  const right = pageMaterial(art['page-right'].texture, inkRight, 0);
  const leftPage = flatSheet(0, GUTTER, 0, BOOK_H, SHEET_Y);
  const rightPage = flatSheet(GUTTER, BOOK_W, 0, BOOK_H, SHEET_Y);
  leftPage.material = left.material;
  rightPage.material = right.material;
  leftPage.name = 'page-left';
  rightPage.name = 'page-right';
  for (const p of [leftPage, rightPage]) {
    p.castShadow = true; // the torn silhouette (alpha) casts, not the rectangle
    p.receiveShadow = true;
    group.add(p);
  }

  return { group, leftPage, rightPage, uniforms: { left: left.uniforms, right: right.uniforms } };
}
