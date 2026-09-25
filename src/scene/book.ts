// The open book, modelled as a hardcover lying open on the table:
//   - two cloth-covered boards with slightly rounded, worn corners, projecting beyond the
//     page block on the three free sides, and the spine under the gutter;
//   - a thick page block on each board, whose top (the base page) follows the page profile
//     (space.ts): a narrow valley at the spine, an S-rise to a crest, flat outward, a slight
//     droop at the fore-edge; its tail, fore-edges and head show the stacked sheet edges,
//     which follow the profile, so the pages visibly flow down into the gutter at the tail;
//   - the study's floor printed on the base page, where the pop-up stands;
//   - the two torn top sheets on the base page, lifting and curling up over the last few
//     percent before their tear, with a thin side face at the tear;
//   - baked ambient occlusion: vertex colours in the gutter, a contact shadow on the table.
import {
  BackSide, Box3, BoxGeometry, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Vector2, Vector3,
  type Object3D, type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Art } from '../assets';
import { clothColor, clothWeave, contactBook, decal, pageEdges, paperTooth } from './paper';
import {
  BOOK_H, COVER_T, GUTTER, PAGE_W, SHEET_Y, SQUARE, UNIT, baseY, gutterAO, paperMaterial, rectUV, sheetY, surfaceGrid, wx, wz,
  xSamples, ySamples,
} from './space';

/**
 * The chapter's last page turn: the right top sheet turns over the gutter onto the left page.
 * Each point of the sheet turns about the spine by its own angle: the fore-edge leads by up to
 * TURN_LAG of the turn, so the sheet curls as it lifts and drapes as it lands. Mid-turn the
 * sheet stands flat; landed, it takes the left page's shape, TURN_LIFT above it.
 */
const TURN_LAG = 0.18;
const TURN_LIFT = 0.035;
const smoothstep = (t: number) => t * t * (3 - 2 * t);
/** The angle (0..π) of the point u world units from the spine at turn progress p. */
export const turnAngle = (p: number, u: number) =>
  Math.PI * smoothstep(Math.min(1, Math.max(0, p * (1 + TURN_LAG) - TURN_LAG * (1 - Math.min(1, u / PAGE_W)))));
/** Where a point (x, y) of the right half lands at turn angle θ (world units; z does not change). */
function turned(x: number, y: number, θ: number): [number, number] {
  const h = y - SHEET_Y, s = Math.cos(θ);
  return [x * Math.cos(θ) - s * h * Math.sin(θ), SHEET_Y + x * Math.sin(θ) + s * h * Math.cos(θ) + TURN_LIFT * (1 - Math.cos(θ)) / 2];
}

export interface PageUniforms {
  tInk: { value: Texture };
  /** Mip LOD bias for the ink: slightly negative keeps glyphs crisp without shimmer. */
  uInkBias: { value: number };
}

/** The top sheets lift this much at their tear, curling up over the last CURL px before it. */
const CURL_LIFT = 0.055;
const CURL = 26;
/** Thickness of the side face at the tear. */
const TEAR_EDGE = 0.014;

/**
 * A torn top sheet: the paper texture (its alpha is the torn silhouette) with the page's
 * ink canvas composited on top before lighting, so the text lies on the paper and takes
 * its shape, light, occlusion and shadows.
 */
function pageMaterial(paper: Texture, ink: Texture, tooth: Texture): { material: MeshStandardMaterial; uniforms: PageUniforms } {
  const material = new MeshStandardMaterial({
    map: paper, roughness: 0.9, metalness: 0, alphaToCoverage: true, shadowSide: DoubleSide,
    vertexColors: true, normalMap: tooth, normalScale: new Vector2(0.45, 0.45),
  });
  const uniforms: PageUniforms = { tInk: { value: ink }, uInkBias: { value: -0.4 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', /* glsl */ `#include <map_pars_fragment>
uniform sampler2D tInk;
uniform float uInkBias;`)
      .replace('#include <map_fragment>', /* glsl */ `#include <map_fragment>
{
  // The ink is premultiplied and stored as sRGB; the sampler hands back linear values.
  // Re-encoding recovers the stored premultiplied sRGB exactly, and blending there over
  // the paper (also in sRGB) is how a browser blends text: glyph weight matches the DOM.
  vec4 ink = texture( tInk, vMapUv, uInkBias );
  vec3 inkS = sRGBTransferOETF( vec4( ink.rgb, 1.0 ) ).rgb;
  vec3 paperS = sRGBTransferOETF( vec4( diffuseColor.rgb, 1.0 ) ).rgb;
  diffuseColor.rgb = sRGBTransferEOTF( vec4( paperS * ( 1.0 - ink.a ) + inkS, 1.0 ) ).rgb;
}`);
  };
  material.customProgramCacheKey = () => 'page-ink';
  return { material, uniforms };
}

/** A copy of a tiling map repeated so one tile covers `tile` world units over a surface w x d. */
function tiled(t: Texture, w: number, d: number, tile: number): Texture {
  const c = t.clone();
  c.repeat.set(w / tile, d / tile);
  return c;
}

/**
 * Where each column of a torn sheet's paper starts (book px from the far edge), read from the
 * baked texture's alpha: the exact torn edge, fibres and all.
 */
function tearEdge(image: CanvasImageSource & { width: number; height: number }): Float32Array {
  const W = GUTTER, H = BOOK_H, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(image, 0, 0, W, H);
  const a = x.getImageData(0, 0, W, H).data;
  const edge = new Float32Array(W + 1);
  for (let px = 0; px < W; px++) {
    let y = 0;
    while (y < H - 1 && !(a[(y * W + px) * 4 + 3] > 150 && a[((y + 1) * W + px) * 4 + 3] > 150)) y++;
    edge[px] = y;
  }
  edge[W] = edge[W - 1];
  return edge;
}

/** Moving average over +-r columns. */
function smoothed(v: Float32Array, r: number): Float32Array {
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) {
    let s = 0, n = 0;
    for (let k = -r; k <= r; k++) { const q = i + k; if (q >= 0 && q < v.length) { s += v[q]; n++; } }
    out[i] = s / n;
  }
  return out;
}

function createBoards() {
  const group = new Group();
  group.name = 'boards';
  const weave = clothWeave();
  const cloth = new MeshStandardMaterial({ map: clothColor(), normalMap: weave, normalScale: new Vector2(0.7, 0.7), roughness: 0.84, metalness: 0 });
  const w = PAGE_W + SQUARE - 0.03, d = BOOK_H / UNIT + 2 * SQUARE;
  weave.repeat.set(w / 0.35, d / 0.35);
  for (const s of [-1, 1]) {
    const board = new Mesh(new RoundedBoxGeometry(w, COVER_T, d, 3, 0.02), cloth);
    board.position.set(s * (0.03 + w / 2), COVER_T / 2, 0);
    board.castShadow = board.receiveShadow = true;
    group.add(board);
  }
  // the spine, under the gutter (not seen, but it closes the book from below)
  const spine = new Mesh(new BoxGeometry(0.16, COVER_T * 0.8, d), cloth);
  spine.position.set(0, COVER_T * 0.4, 0);
  group.add(spine);
  return { group, footprint: { w: 2 * (0.03 + w), d } };
}

/**
 * The faces of one half's page block that show the stacked sheet edges: the tail (near),
 * the fore-edge and the head. Each runs from the board up to the page surface, v = 0..1
 * over that height, so the sheet lines follow the profile.
 */
function blockEdges(bx0: number, bx1: number, top: (bx: number, by: number) => number): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const strip = (pts: { x: number; z: number; top: number; u: number }[], flip: boolean) => {
    const base = pos.length / 3;
    for (const p of pts) {
      pos.push(p.x, COVER_T, p.z, p.x, p.top, p.z);
      uv.push(p.u, 0, p.u, 1);
    }
    for (let k = 0; k < pts.length - 1; k++) {
      const b0 = base + 2 * k, t0 = b0 + 1, b1 = b0 + 2, t1 = b0 + 3;
      if (flip) idx.push(b0, t0, b1, b1, t0, t1);
      else idx.push(b0, b1, t0, b1, t1, t0);
    }
  };
  const xs = xSamples(bx0, bx1), ys = ySamples(0, BOOK_H, 10);
  const L = 2.4; // world units per texture tile along the edges
  // tail (by = BOOK_H), facing +z, x increasing
  strip(xs.map((bx) => ({ x: wx(bx), z: wz(BOOK_H), top: top(bx, BOOK_H), u: wx(bx) / L })), false);
  // head (by = 0), facing -z
  strip(xs.map((bx) => ({ x: wx(bx), z: wz(0), top: baseY(bx, 0), u: wx(bx) / L })), true);
  // fore-edge, facing away from the gutter
  const fx = bx0 < GUTTER ? bx0 : bx1;
  strip(ys.map((by) => ({ x: wx(fx), z: wz(by), top: top(fx, by), u: wz(by) / L })), bx0 >= GUTTER);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createBook(art: Art, inkLeft: Texture, inkRight: Texture, inkEnd: Texture) {
  const group = new Group();
  group.name = 'book';
  const tooth = paperTooth();

  const boards = createBoards();
  group.add(boards.group);

  // the book's contact shadow on the table
  const margin = 0.9, fp = boards.footprint;
  const onTable = decal(new PlaneGeometry(fp.w + 2 * margin, fp.d + 2 * margin), contactBook(fp.w, fp.d, margin), 0.9);
  onTable.rotation.x = -Math.PI / 2;
  onTable.position.y = 0.002;
  onTable.name = 'contact-table';
  group.add(onTable);

  // the torn top sheets: where their paper starts, column by column
  const sides = {
    left: { bx0: 0, bx1: GUTTER, art: art['page-left'], ink: inkLeft },
    right: { bx0: GUTTER, bx1: 2 * GUTTER, art: art['page-right'], ink: inkRight },
  };
  const tears = Object.fromEntries(Object.entries(sides).map(([k, s]) => {
    const edge = tearEdge(s.art.texture.image as HTMLImageElement);
    return [k, { edge, smooth: smoothed(edge, 6) }];
  })) as Record<'left' | 'right', { edge: Float32Array; smooth: Float32Array }>;
  const curl = (side: 'left' | 'right', bx: number, by: number) => {
    const col = Math.min(GUTTER, Math.max(0, Math.round(bx - sides[side].bx0)));
    const d = by - tears[side].smooth[col];
    return d <= 0 ? CURL_LIFT : d < CURL ? CURL_LIFT * (1 - d / CURL) ** 2 : 0;
  };
  /** World height of a top sheet, curl included. */
  const sheetAt = (side: 'left' | 'right') => (bx: number, by: number) => sheetY(bx, by) + curl(side, bx, by);

  // the page blocks
  const blockTop = new MeshStandardMaterial({ color: '#ded3bb', roughness: 0.92, vertexColors: true, normalMap: tiled(tooth, PAGE_W, BOOK_H / UNIT, 1.2) });
  const edges = new MeshStandardMaterial({ map: pageEdges(), roughness: 0.95, metalness: 0 });
  for (const [side, s] of Object.entries(sides) as ['left' | 'right', (typeof sides)['left']][]) {
    const top = new Mesh(surfaceGrid(xSamples(s.bx0, s.bx1), ySamples(0, BOOK_H, 20), baseY, rectUV(s.bx0, s.bx1, 0, BOOK_H), gutterAO), blockTop);
    top.receiveShadow = true;
    const faces = new Mesh(blockEdges(s.bx0, s.bx1, sheetAt(side)), edges);
    faces.castShadow = faces.receiveShadow = true;
    top.name = `block-${side}`;
    faces.name = `block-edges-${side}`;
    group.add(top, faces);
  }

  // the base page's floor sheet: the ground of the pop-up, from its fold down past the lowest tear
  const [fx, fy, fw, fh] = art.floor.viewBox, fold = art.floor.meta.fold;
  const fy0 = fold + fy, fy1 = fold + fy + fh;
  const floorMat = paperMaterial(art.floor.texture, 0.95);
  floorMat.vertexColors = true;
  floorMat.normalMap = tiled(tooth, fw / UNIT, fh / UNIT, 1.2);
  floorMat.normalScale.set(0.35, 0.35);
  const floor = new Mesh(surfaceGrid(xSamples(fx, fx + fw), ySamples(fy0, fy1, 8), (bx, by) => baseY(bx, by) + 0.003, rectUV(fx, fx + fw, fy0, fy1), gutterAO), floorMat);
  floor.receiveShadow = true;
  floor.name = 'floor';
  group.add(floor);

  // the torn top sheets, and the thin side face along each tear
  const pages: Record<'left' | 'right', { mesh: Mesh; uniforms: PageUniforms }> = {} as never;
  const tearFace = new MeshStandardMaterial({ color: '#ece3d0', roughness: 0.95, shadowSide: DoubleSide });
  for (const [side, s] of Object.entries(sides) as ['left' | 'right', (typeof sides)['left']][]) {
    const t = tears[side], lo = Math.min(...t.smooth), hi = Math.max(...t.smooth);
    const { material, uniforms } = pageMaterial(s.art.texture, s.ink, tiled(tooth, PAGE_W, BOOK_H / UNIT, 1.2));
    const geometry = surfaceGrid(xSamples(s.bx0, s.bx1), ySamples(0, BOOK_H, 12, [lo - 8, hi + CURL + 8]), sheetAt(side), rectUV(s.bx0, s.bx1, 0, BOOK_H), gutterAO);
    const mesh = new Mesh(geometry, material);
    mesh.name = `page-${side}`;
    mesh.castShadow = true; // the torn silhouette (alpha) casts, not the rectangle
    mesh.receiveShadow = true;
    group.add(mesh);
    pages[side] = { mesh, uniforms };

    const pos: number[] = [], idx: number[] = [];
    for (let col = 0; col <= GUTTER; col += 2) {
      const bx = s.bx0 + col, by = t.edge[col], y = sheetY(bx, by) + CURL_LIFT;
      pos.push(wx(bx), y, wz(by), wx(bx), y - TEAR_EDGE, wz(by));
    }
    for (let k = 0; k < pos.length / 6 - 1; k++) {
      const t0 = 2 * k, b0 = t0 + 1, t1 = t0 + 2, b1 = t0 + 3;
      idx.push(t0, t1, b0, b0, t1, b1);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const face = new Mesh(g, tearFace);
    face.castShadow = true;
    face.name = `tear-edge-${side}`;
    group.add(face);
  }

  // ---- the page turn
  const right = pages.right.mesh;
  const flipGeo = right.geometry;
  const rest = Float32Array.from(flipGeo.attributes.position.array as Float32Array);
  // the back of the sheet: plain paper, torn the same way (the blank sheet's paper)
  const backMat = new MeshStandardMaterial({
    map: art['page-end'].texture, roughness: 0.92, alphaToCoverage: true, side: BackSide, vertexColors: true,
    normalMap: tiled(tooth, PAGE_W, BOOK_H / UNIT, 1.2), normalScale: new Vector2(0.45, 0.45), color: '#f1ebe0',
  });
  const back = new Mesh(flipGeo, backMat);
  back.name = 'page-right-back';
  back.receiveShadow = true;
  back.visible = false;
  group.add(back);
  // the blank sheet under it, torn the same way, with 「第一章 完」
  const end = pageMaterial(art['page-end'].texture, inkEnd, tiled(tooth, PAGE_W, BOOK_H / UNIT, 1.2));
  const tr = tears.right, trLo = Math.min(...tr.smooth), trHi = Math.max(...tr.smooth);
  const endSheet = new Mesh(surfaceGrid(xSamples(GUTTER, 2 * GUTTER), ySamples(0, BOOK_H, 12, [trLo - 8, trHi + CURL + 8]), (bx, by) => sheetAt('right')(bx, by) - 0.003,
    rectUV(GUTTER, 2 * GUTTER, 0, BOOK_H), gutterAO), end.material);
  endSheet.name = 'page-end';
  endSheet.receiveShadow = true;
  endSheet.visible = false;
  group.add(endSheet);
  const carried: { pivot: Group; anchor: Vector3; hideAt: number }[] = [];
  let turnP = 0;
  const tearRight = group.getObjectByName('tear-edge-right')!;

  return {
    group,
    leftPage: pages.left.mesh, rightPage: pages.right.mesh,
    uniforms: { left: pages.left.uniforms, right: pages.right.uniforms, end: end.uniforms },
    /**
     * Makes something lying or standing on the right sheet turn with it (puppets, dice, hearts):
     * it turns rigidly with the sheet at its own place and hides once the sheet covers it.
     */
    carry(obj: Object3D, hideAt = 0.5 * Math.PI) {
      const box = new Box3().setFromObject(obj);
      const c = box.getCenter(new Vector3());
      const bx = c.x * UNIT + GUTTER, by = c.z * UNIT + BOOK_H / 2;
      const anchor = new Vector3(c.x, sheetAt('right')(Math.min(2 * GUTTER, Math.max(GUTTER, bx)), Math.min(BOOK_H, Math.max(0, by))), c.z);
      const pivot = new Group();
      pivot.position.copy(anchor);
      obj.parent!.add(pivot);
      obj.position.sub(anchor);
      pivot.add(obj);
      carried.push({ pivot, anchor, hideAt });
    },
    /** Turn progress 0..1 (0: the sheet lies on the right page; 1: it lies on the left). */
    setTurn(p: number) {
      if (p === turnP) return;
      turnP = p;
      const pos = flipGeo.attributes.position;
      const a = pos.array as Float32Array;
      for (let i = 0; i < a.length; i += 3) {
        const θ = turnAngle(p, rest[i]);
        const [x, y] = turned(rest[i], rest[i + 1], θ);
        a[i] = x; a[i + 1] = y; a[i + 2] = rest[i + 2];
      }
      pos.needsUpdate = true;
      flipGeo.computeVertexNormals();
      flipGeo.computeBoundingSphere();
      back.visible = endSheet.visible = p > 0;
      tearRight.visible = p === 0;
      for (const c of carried) {
        // lying on the curled sheet: at the sheet's point under it, turned to the sheet's slope
        // there (the turn angle plus the curl: u·dθ/du), and gone once the sheet's back faces up
        const u = c.anchor.x, θ = turnAngle(p, u);
        const dθ = (turnAngle(p, u + 0.02) - turnAngle(p, u - 0.02)) / 0.04;
        const φ = θ + Math.atan(u * dθ);
        const [x, y] = turned(u, c.anchor.y, θ);
        c.pivot.position.set(x, y, c.anchor.z);
        c.pivot.rotation.z = φ;
        c.pivot.visible = φ < c.hideAt;
      }
    },
    /** World height of the right top sheet (with its curl), for what stands on it. */
    rightSheet: sheetAt('right'),
    tooth,
  };
}

