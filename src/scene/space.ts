// World space and the physical shape of the open book, shared by the scene modules.
//
// Art is authored in the legacy board's CSS px, and 100 px = 1 world unit. "Book space"
// (bx, by) is the open book seen from above: bx 0..1340 left to right (the gutter at 670),
// by 0..BOOK_H from the far edge (head) to the near edge (tail); the pop-up stands on its
// fold lines part-way in. World: Y up, the table is Y = 0, +Z toward the viewer.
//
// The book is a hardcover lying open: cloth boards on the table, a thick page block on
// each board, whose top surface (the base page, carrying the study's floor) follows how
// real pages lie: a narrow valley at the spine, an S-shaped rise to a crest near the
// gutter, then almost flat, with a slight droop at the fore-edge. The torn top sheets lie
// on the base page and share its profile.
import { BufferGeometry, DoubleSide, Float32BufferAttribute, FrontSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry, type Material, type Texture } from 'three';
import type { ArtPiece } from '../assets';
import { PAGE } from '../page/layout';

export const UNIT = 100;
export const DEG = Math.PI / 180;
export const GUTTER = 670;
export const BOOK_W = 1340;
export const BOOK_H = PAGE.h;
/** One page's width in world units. */
export const PAGE_W = GUTTER / UNIT;

/** Cover boards: thickness, and how far they project beyond the page block (the "squares"). */
export const COVER_T = 0.055;
export const SQUARE = 0.15;
/** Page block thickness where the pages lie flat (a 17 cm page with about 1 cm of pages). */
export const BLOCK_T = 0.35;
/** The base page's flat level, and the torn top sheets' (a hair above it). */
export const BASE_Y = COVER_T + BLOCK_T;
export const SHEET_LIFT = 0.02;
export const SHEET_Y = BASE_Y + SHEET_LIFT;

/** Cross-section of each half, from the gutter (u = 0) to the fore-edge (u = 1), u in page widths. */
export const PROFILE = {
  crestU: 0.12,            // the crest, 12% of the page width from the gutter
  crest: 0.028 * PAGE_W,   // its height above the flat level (2.8% of the page width)
  valley: 0.024 * PAGE_W,  // the valley bottom at the spine, below the flat level
  settleU: 0.4,            // flat from here outward
  droop: 0.02,             // fore-edge droop
  droopU: 0.07,            // over the last 7% of the width
  headRelax: 0.35,         // the curve is 35% weaker at the head, where the pop-up pulls the pages flat
  tailRelax: 0,            // full strength at the tail, where the pages' flow into the gutter shows
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Distance from the gutter in page widths. */
export const gutterU = (bx: number) => Math.min(1, Math.abs(bx - GUTTER) / GUTTER);
/** How strongly the gutter curve shows at depth by (1 in the middle of the page). */
const relax = (by: number) => 1 - PROFILE.headRelax * (1 - smooth(0, 220, by)) - PROFILE.tailRelax * smooth(520, BOOK_H, by);

/** The profile at u (page widths from the gutter), before relaxation, relative to the flat level. */
function curve(u: number): number {
  const { crestU, crest: C, valley: V, settleU } = PROFILE;
  if (u < crestU) {
    // S-rise from the valley to the crest: steep near the spine, rounding broadly into the crest
    const s = 1 - (1 - u / crestU) ** 1.8;
    return -V + (C + V) * s * s * (3 - 2 * s);
  }
  if (u < settleU) return C * (1 - smooth(crestU, settleU, u));
  return 0;
}
const droop = (u: number) => {
  const t = (u - (1 - PROFILE.droopU)) / PROFILE.droopU;
  return t > 0 ? -PROFILE.droop * t * t : 0;
};

/** Height of the base page above its flat level at (bx, by). */
export function lift(bx: number, by: number): number {
  const u = gutterU(bx);
  return curve(u) * relax(by) + droop(u);
}
/** World height of the base page (the top of the page block). */
export const baseY = (bx: number, by: number) => BASE_Y + lift(bx, by);

/**
 * The line a flat card standing on the page rests on: a card spanning the gutter bridges the
 * valley from crest to crest (a small gap under it at the spine is correct); elsewhere it
 * follows the page.
 */
export function envelope(bx: number, by: number): number {
  const u = Math.max(gutterU(bx), PROFILE.crestU);
  return curve(u) * relax(by) + droop(u);
}

/** Cockle: a very low, low-frequency undulation of the top sheets (none in the binding). */
export function cockle(bx: number, by: number): number {
  const w = smooth(0.02, 0.15, gutterU(bx));
  const a = Math.sin((2 * Math.PI * bx) / 255 + 1.3) * Math.sin((2 * Math.PI * by) / 205 + 0.4);
  const b = Math.sin((2 * Math.PI * (0.8 * bx + 0.6 * by)) / 370 + 2.1);
  return 0.014 * w * (0.55 * a + 0.45 * b);
}
/** World height of a torn top sheet's surface (without the curl at its tear). */
export const sheetY = (bx: number, by: number) => BASE_Y + lift(bx, by) + SHEET_LIFT + cockle(bx, by);

/**
 * Ambient occlusion of the page surface in the gutter, from its cross-section: how much of
 * the sky each point loses behind the two crests (cosine-weighted, 2D). 1 = unoccluded.
 */
export function gutterAO(bx: number, by: number): number {
  const u = gutterU(bx), W = PAGE_W, cu = PROFILE.crestU;
  const y = lift(bx, by), yc = PROFILE.crest * relax(by);
  const sinH = (h: number, d: number) => (h > 0 ? h / Math.hypot(h, Math.max(d, 1e-3)) : 0);
  const opposite = sinH(yc - y, (u + cu) * W);
  const own = sinH(yc - y, Math.abs(cu - u) * W);
  const vis = u < cu ? 1 - 0.5 * (opposite + own) : 1 - 0.5 * Math.max(opposite, own);
  return vis ** 1.9; // (M1 review: a deeper gutter)
}

export const wx = (bx: number) => (bx - GUTTER) / UNIT;
export const wz = (by: number) => (by - BOOK_H / 2) / UNIT;

/** Sample positions across the width: fine in the gutter, coarse where the pages lie flat. */
export function xSamples(bx0: number, bx1: number): number[] {
  const xs = new Set<number>([bx0, bx1]);
  for (let x = Math.ceil(bx0 / 10) * 10; x < bx1; x += 10) xs.add(x);
  for (let x = GUTTER - 280; x <= GUTTER + 280; x += 5) if (x > bx0 && x < bx1) xs.add(x);
  for (let x = GUTTER - 90; x <= GUTTER + 90; x += 2) if (x > bx0 && x < bx1) xs.add(x);
  return [...xs].sort((a, b) => a - b);
}
/** Sample positions along the depth: every `step` px, every 3 px inside `dense`. */
export function ySamples(by0: number, by1: number, step = 10, dense?: [number, number]): number[] {
  const ys = new Set<number>([by0, by1]);
  for (let y = Math.ceil(by0 / step) * step; y < by1; y += step) ys.add(y);
  if (dense) for (let y = Math.max(by0, dense[0]); y <= Math.min(by1, dense[1]); y += 3) ys.add(Math.round(y));
  return [...ys].sort((a, b) => a - b);
}

/**
 * A surface over a (bx, by) grid, facing up: height(bx, by) in world units; uv(bx, by);
 * optional per-vertex grey (ambient occlusion) as vertex colours.
 */
export function surfaceGrid(xs: number[], ys: number[], height: (bx: number, by: number) => number,
  uv: (bx: number, by: number) => [number, number], shade?: (bx: number, by: number) => number): BufferGeometry {
  const pos: number[] = [], uvs: number[] = [], col: number[] = [], idx: number[] = [];
  for (const bx of xs) {
    for (const by of ys) {
      pos.push(wx(bx), height(bx, by), wz(by));
      uvs.push(...uv(bx, by));
      if (shade) { const s = shade(bx, by); col.push(s, s, s); }
    }
  }
  const row = ys.length;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < row - 1; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  if (shade) g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** UV mapping of a rect in book space onto a texture (v = 1 at its far edge). */
export const rectUV = (bx0: number, bx1: number, by0: number, by1: number) =>
  (bx: number, by: number): [number, number] => [(bx - bx0) / (bx1 - bx0), 1 - (by - by0) / (by1 - by0)];

/**
 * Paper with a cut-out silhouette. Alpha-to-coverage (with the MSAA render target) gives
 * soft cut edges without sorting; for the shadow maps three.js then uses alphaTest 0.5,
 * so a piece casts its silhouette, not its rectangle. Shadows are rendered from both sides.
 */
export function paperMaterial(map: Texture, roughness = 0.92): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map, roughness, metalness: 0, alphaToCoverage: true, side: FrontSide, shadowSide: DoubleSide,
  });
}

/**
 * Default lean of a standing piece back from the vertical, degrees. Each row of the pop-up
 * sets its own (the wall leans most, rows nearer the reader stand more upright).
 */
export const LEAN_DEG = 15;
/** Unit normal of a piece leaning back by `lean` degrees (it faces the reader and up). */
export const leanNormal = (lean = LEAN_DEG) => ({ x: 0, y: Math.sin(lean * DEG), z: Math.cos(lean * DEG) });

export interface StandOptions {
  /** by of the fold line the piece stands on. */
  hinge: number;
  /** The SVG y that sits on the fold line. */
  baseY: number;
  /** bx of the SVG's x = 0, and SVG units per book px. */
  x0?: number;
  scale?: number;
  /** World height of the fold line (defaults to the base page's flat level). */
  y?: number;
  /** Lean back from the vertical, degrees (defaults to LEAN_DEG). */
  lean?: number;
  /**
   * Height of the fold line above `y` along the width (world units), e.g. the envelope of
   * the curved pages: the card bends with the page it is glued to.
   */
  rest?: (bx: number) => number;
}

/**
 * A paper plane hinged on the page: a group at the fold line, leaning back by its `lean`;
 * the textured plane inside is placed so its base sits on the fold. With `rest`, the plane
 * is subdivided across and each column raised to the fold line's height there.
 */
export function standing(piece: ArtPiece, material: Material, o: StandOptions): { group: Group; mesh: Mesh } {
  const [vx, vy, vw, vh] = piece.viewBox;
  const s = o.scale ?? 1, x0 = o.x0 ?? 0, lean = (o.lean ?? LEAN_DEG) * DEG;
  const w = (vw * s) / UNIT, h = (vh * s) / UNIT;
  const geometry = new PlaneGeometry(w, h, o.rest ? Math.max(1, Math.ceil(w / 0.06)) : 1, 1);
  const cx = wx(x0 + (vx + vw / 2) * s);
  if (o.rest) {
    // a world-vertical rise, expressed in the leaning group's frame
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const e = o.rest((cx + p.getX(i)) * UNIT + GUTTER);
      p.setY(i, p.getY(i) + e * Math.cos(lean));
      p.setZ(i, p.getZ(i) + e * Math.sin(lean));
    }
    geometry.computeVertexNormals();
  }
  const mesh = new Mesh(geometry, material);
  mesh.position.set(cx, ((o.baseY - (vy + vh / 2)) * s) / UNIT, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const group = new Group();
  group.position.set(0, o.y ?? BASE_Y, wz(o.hinge));
  group.rotation.x = -lean;
  group.add(mesh);
  return { group, mesh };
}

/** World position of an SVG point on a standing piece (e.g. the candle flame on the desk). */
export function pointOnStanding(o: StandOptions & { svgX: number; svgY: number }, y0: number) {
  const s = o.scale ?? 1, lean = (o.lean ?? LEAN_DEG) * DEG;
  const bx = (o.x0 ?? 0) + o.svgX * s;
  const up = ((o.baseY - o.svgY) * s) / UNIT;
  const e = o.rest ? o.rest(bx) : 0;
  return {
    x: wx(bx),
    y: y0 + e + up * Math.cos(lean),
    z: wz(o.hinge) - up * Math.sin(lean),
  };
}
