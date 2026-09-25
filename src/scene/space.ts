// World space shared by the scene modules.
//
// The legacy board's layout (docs/style-board.png) is kept: art is authored in its CSS px,
// and 100 px = 1 world unit. "Book space" (bx, by) is the open book seen from above:
// bx 0..1340 left to right (gutter at 670), by 0..600 from the far edge (where the
// pop-up stands) to the near edge. World: Y up, the table is Y = 0, +Z toward the viewer.
import {
  BufferGeometry, DoubleSide, Float32BufferAttribute, FrontSide, Group, Mesh, MeshStandardMaterial,
  PlaneGeometry, type Material, type Texture,
} from 'three';
import type { ArtPiece } from '../assets';

export const UNIT = 100;
export const DEG = Math.PI / 180;
export const GUTTER = 670;
export const BOOK_W = 1340;
export const BOOK_H = 600;

/** Top of the cover board and of the (flat) page block. */
export const COVER_TOP = 0.05;
export const PAGE_BASE = 0.2;
/** Height of the pages' bulge next to the gutter. */
export const BULGE = 0.1;
/** Pop-up planes and puppets rise at this angle from the page (the M0 board's --phi). */
export const HINGE_DEG = 70;
export const LEAN = (90 - HINGE_DEG) * DEG;

export const wx = (bx: number) => (bx - GUTTER) / UNIT;
export const wz = (by: number) => (by - BOOK_H / 2) / UNIT;

/** Lift of the page surface above PAGE_BASE: zero in the crease, a quick rise, a slow fall to the fore-edges. */
export function lift(bx: number): number {
  const d = Math.min(1, Math.abs(bx - GUTTER) / GUTTER);
  return BULGE * (1 - Math.exp(-d / 0.035)) * (1 - 0.6 * d * d);
}
export const surfaceY = (bx: number) => PAGE_BASE + lift(bx);

/** Sample positions along x: every 8 px, every 1.5 px within 40 px of the gutter. */
function xSamples(bx0: number, bx1: number): number[] {
  const xs = new Set<number>([bx0, bx1]);
  for (let x = Math.ceil(bx0 / 8) * 8; x < bx1; x += 8) xs.add(x);
  for (let x = GUTTER - 40; x <= GUTTER + 40; x += 1.5) if (x > bx0 && x < bx1) xs.add(x);
  if (GUTTER > bx0 && GUTTER < bx1) xs.add(GUTTER);
  return [...xs].sort((a, b) => a - b);
}

/** A sheet lying on the pages, following their curvature; UV covers the rect (v = 1 at the far edge). */
export function curvedSheet(bx0: number, bx1: number, by0: number, by1: number, offset = 0, ny = 8): BufferGeometry {
  const xs = xSamples(bx0, bx1);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const bx of xs) {
    for (let j = 0; j <= ny; j++) {
      const by = by0 + ((by1 - by0) * j) / ny;
      pos.push(wx(bx), surfaceY(bx) + offset, wz(by));
      uv.push((bx - bx0) / (bx1 - bx0), 1 - j / ny);
    }
  }
  const row = ny + 1;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ny; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The fore-edge of the page block: from the cover up to the (curved) page surface. */
export function foreEdge(bx0: number, bx1: number, by: number, bottom: number): BufferGeometry {
  const xs = xSamples(bx0, bx1);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const bx of xs) {
    pos.push(wx(bx), bottom, wz(by), wx(bx), surfaceY(bx) - 0.002, wz(by));
    const u = (bx - bx0) / (bx1 - bx0);
    uv.push(u, 0, u, 1);
  }
  for (let i = 0; i < xs.length - 1; i++) {
    const a = i * 2, c = a + 1, b = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
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
  /** World height of the fold line (defaults to the page surface there). */
  y?: number;
}

/**
 * A paper plane hinged on the page: a group at the fold line, leaning back so it stands at
 * HINGE_DEG from the page; the textured plane inside is placed so its base sits on the fold.
 */
export function standing(piece: ArtPiece, material: Material, o: StandOptions): { group: Group; mesh: Mesh } {
  const [vx, vy, vw, vh] = piece.viewBox;
  const s = o.scale ?? 1, x0 = o.x0 ?? 0;
  const mesh = new Mesh(new PlaneGeometry((vw * s) / UNIT, (vh * s) / UNIT), material);
  mesh.position.set(wx(x0 + (vx + vw / 2) * s), ((o.baseY - (vy + vh / 2)) * s) / UNIT, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const group = new Group();
  const cx = x0 + (vx + vw / 2) * s;
  group.position.set(0, o.y ?? surfaceY(cx), wz(o.hinge));
  group.rotation.x = -LEAN;
  group.add(mesh);
  return { group, mesh };
}

/** World position of an SVG point on a standing piece (e.g. the candle flame on the desk). */
export function pointOnStanding(o: StandOptions & { svgX: number; svgY: number }, y0: number) {
  const s = o.scale ?? 1;
  const up = ((o.baseY - o.svgY) * s) / UNIT;
  return {
    x: wx((o.x0 ?? 0) + o.svgX * s),
    y: y0 + up * Math.cos(LEAN),
    z: wz(o.hinge) - up * Math.sin(LEAN),
  };
}

