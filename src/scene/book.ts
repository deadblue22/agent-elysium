// The open book: cover board, page block, fore-edge, the two curved pages, the study floor sheet.
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Texture } from 'three';
import type { Art } from '../assets';
import {
  BOOK_H, BOOK_W, COVER_TOP, GUTTER, PAGE_BASE, curvedSheet, foreEdge, paperMaterial,
} from './space';

export interface PageUniforms {
  tInk: { value: Texture };
  /** Mip LOD bias for the ink: slightly negative keeps glyphs crisp without shimmer. */
  uInkBias: { value: number };
  uGutterU: { value: number };
}

/**
 * Paper whose diffuse colour is the paper texture with the page's ink canvas composited on
 * top (premultiplied), before lighting: the text converges with the page, bends with it,
 * receives its shadows and light. The crease darkens toward the gutter.
 */
function pageMaterial(paper: Texture, ink: Texture, gutterU: number): { material: MeshStandardMaterial; uniforms: PageUniforms } {
  const material = new MeshStandardMaterial({ map: paper, roughness: 0.9, metalness: 0 });
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
  float g = abs( vMapUv.x - uGutterU );
  diffuseColor.rgb *= mix( 0.42, 1.0, smoothstep( 0.0, 0.08, g ) ) * mix( 0.9, 1.0, smoothstep( 0.0, 0.25, g ) );
}`);
  };
  material.customProgramCacheKey = () => 'page-ink';
  return { material, uniforms };
}

export function createBook(art: Art, inkLeft: Texture, inkRight: Texture) {
  const group = new Group();
  group.name = 'book';

  const cover = new Mesh(new BoxGeometry(13.76, COVER_TOP, 6.3), new MeshStandardMaterial({ color: '#181d2b', roughness: 0.7 }));
  cover.position.set(0, COVER_TOP / 2, 0.09);
  cover.castShadow = cover.receiveShadow = true;
  group.add(cover);

  const blockH = PAGE_BASE - COVER_TOP - 0.004;
  const block = new Mesh(new BoxGeometry(BOOK_W / 100 - 0.02, blockH, BOOK_H / 100 - 0.02), new MeshStandardMaterial({ color: '#bfae8a', roughness: 0.95 }));
  block.position.set(0, COVER_TOP + blockH / 2, 0);
  block.castShadow = block.receiveShadow = true;
  group.add(block);

  const edge = new Mesh(foreEdge(0, BOOK_W, BOOK_H + 0.3, COVER_TOP), new MeshStandardMaterial({ map: art.stack.texture, roughness: 0.95 }));
  edge.receiveShadow = true;
  group.add(edge);

  const left = pageMaterial(art['page-left'].texture, inkLeft, 1);
  const right = pageMaterial(art['page-right'].texture, inkRight, 0);
  const leftPage = new Mesh(curvedSheet(0, GUTTER, 0, BOOK_H, 0, 12), left.material);
  const rightPage = new Mesh(curvedSheet(GUTTER, BOOK_W, 0, BOOK_H, 0, 12), right.material);
  leftPage.name = 'page-left';
  rightPage.name = 'page-right';
  for (const p of [leftPage, rightPage]) {
    p.receiveShadow = true;
    group.add(p);
  }

  // the study's floor: its own sheet lying on both pages along the far edge
  const [fx, fy, fw, fh] = art.floor.viewBox;
  const floor = new Mesh(curvedSheet(fx, fx + fw, fy, fy + fh, 0.004, 4), paperMaterial(art.floor.texture, 0.95));
  floor.receiveShadow = true;
  floor.name = 'floor';
  group.add(floor);

  return { group, leftPage, rightPage, uniforms: { left: left.uniforms, right: right.uniforms } };
}
