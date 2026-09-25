// World space shared by the scene modules.
//
// The legacy board's layout (docs/style-board.png) is kept: art is authored in its CSS px,
// and 100 px = 1 world unit. "Book space" (bx, by) is the open book seen from above:
// bx 0..1340 left to right (gutter at 670), by 0..BOOK_H from the far edge to the near
// edge; the pop-up stands on its fold line part-way in. World: Y up, the table is Y = 0,
// +Z toward the viewer.
import { DoubleSide, FrontSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry, type Material, type Texture } from 'three';
import type { ArtPiece } from '../assets';
import { PAGE } from '../page/layout';

export const UNIT = 100;
export const DEG = Math.PI / 180;
export const GUTTER = 670;
export const BOOK_W = 1340;
export const BOOK_H = PAGE.h;

/** Top of the cover board. */
export const COVER_TOP = 0.05;
/**
 * The book is built like the reference pop-up book: a stack of flat sheets on the cover.
 * The top of the stack is the base page, which carries the study's floor sheet and the
 * pop-up; the two visible pages are torn top sheets lying a hair above it.
 */
export const BASE_Y = 0.2;
export const SHEET_Y = BASE_Y + 0.02;
/**
 * Default lean of a standing piece back from the vertical, degrees. Each row of the pop-up
 * sets its own (the wall leans most, rows nearer the reader stand more upright).
 */
export const LEAN_DEG = 15;
/** Unit normal of a piece leaning back by `lean` degrees (it faces the reader and up). */
export const leanNormal = (lean = LEAN_DEG) => ({ x: 0, y: Math.sin(lean * DEG), z: Math.cos(lean * DEG) });

export const wx = (bx: number) => (bx - GUTTER) / UNIT;
export const wz = (by: number) => (by - BOOK_H / 2) / UNIT;

/** A flat sheet lying in the book at height y; UV covers the rect (v = 1 at the far edge). */
export function flatSheet(bx0: number, bx1: number, by0: number, by1: number, y: number): Mesh {
  const mesh = new Mesh(new PlaneGeometry((bx1 - bx0) / UNIT, (by1 - by0) / UNIT));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(wx((bx0 + bx1) / 2), y, wz((by0 + by1) / 2));
  return mesh;
}

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

export interface StandOptions {
  /** by of the fold line the piece stands on. */
  hinge: number;
  /** The SVG y that sits on the fold line. */
  baseY: number;
  /** bx of the SVG's x = 0, and SVG units per book px. */
  x0?: number;
  scale?: number;
  /** World height of the fold line (defaults to the base page). */
  y?: number;
  /** Lean back from the vertical, degrees (defaults to LEAN_DEG). */
  lean?: number;
}

/**
 * A paper plane hinged on the page: a group at the fold line, leaning back by its `lean`;
 * the textured plane inside is placed so its base sits on the fold.
 */
export function standing(piece: ArtPiece, material: Material, o: StandOptions): { group: Group; mesh: Mesh } {
  const [vx, vy, vw, vh] = piece.viewBox;
  const s = o.scale ?? 1, x0 = o.x0 ?? 0;
  const mesh = new Mesh(new PlaneGeometry((vw * s) / UNIT, (vh * s) / UNIT), material);
  mesh.position.set(wx(x0 + (vx + vw / 2) * s), ((o.baseY - (vy + vh / 2)) * s) / UNIT, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const group = new Group();
  group.position.set(0, o.y ?? BASE_Y, wz(o.hinge));
  group.rotation.x = -(o.lean ?? LEAN_DEG) * DEG;
  group.add(mesh);
  return { group, mesh };
}

/** World position of an SVG point on a standing piece (e.g. the candle flame on the desk). */
export function pointOnStanding(o: StandOptions & { svgX: number; svgY: number }, y0: number) {
  const s = o.scale ?? 1, lean = (o.lean ?? LEAN_DEG) * DEG;
  const up = ((o.baseY - o.svgY) * s) / UNIT;
  return {
    x: wx((o.x0 ?? 0) + o.svgX * s),
    y: y0 + up * Math.cos(lean),
    z: wz(o.hinge) - up * Math.sin(lean),
  };
}

