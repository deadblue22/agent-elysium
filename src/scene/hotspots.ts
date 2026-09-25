// Hover tips (the tip texts: src/content/hotspots.ts): what the pointer is over on the stage.
//
// Every paper piece that can be hovered, or that hides what is behind it, is a target. A ray
// from the pointer is tested against all of them, nearest first; a hit on a transparent pixel
// of a piece's texture (a small CPU copy of its alpha) passes through. The first opaque hit
// decides: a piece of its own names its key (the puppets, the casements, the stairs, the dog,
// Marek, the dice); a baked layer (the furniture row, the wall, the desk, the floor, …) looks
// the point up among its regions, in the layer's SVG coordinates, first match first (so the
// clock wins over the fireplace, and the fireplace over the wall behind it). An opaque hit
// with no key (bare wallpaper, the left page) shows nothing.
//
// The hovered thing brightens a little: its own pieces by 10%, and a region of a layer by an
// additive copy of that layer's texture laid over the region (only the region's paper lights).
import {
  AdditiveBlending, Box3, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Raycaster, Vector2, Vector3,
  type Camera, type Material, type Object3D, type Texture,
} from 'three';
import type { Art, ArtPiece } from '../assets';
import type { PieceHandle } from './popup';
import { baseY, leanNormal, pointOnStanding, wx, wz, type StandOptions } from './space';

type Rect = [number, number, number, number];
type Shape = Rect | [number, number][];

/** Regions of the baked layers, in each layer's SVG coordinates. The first that contains the point wins. */
const REGIONS: Record<string, [string, Shape][]> = {
  furniture: [
    ['clock', [932, 112, 1008, 242]],
    ['curtain', [[322, 60], [398, 60], [394, 118], [384, 186], [366, 244], [356, 280], [352, 334], [334, 336], [312, 322], [300, 286], [290, 240], [290, 196], [292, 146], [302, 96]]],
    ['mirror', [902, 68, 1038, 196]],
    ['fireplace', [778, 190, 1162, 430]],
    ['bookshelf', [48, 60, 300, 430]],
    ['radiator', [1168, 348, 1302, 430]],
  ],
  wall: [
    ['photo', [664, 132, 734, 232]],
    ['calendar', [1194, 160, 1270, 264]],
    ['window', [342, 76, 628, 338]],
  ],
  desk: [
    ['candle', [748, 26, 792, 128]],
    ['victim', [408, 68, 548, 124]], // his back and head, over the ledger
    ['victim', [450, 118, 476, 198]], // the arm hanging by the chair
    ['desk', [476, 118, 808, 250]],
  ],
  'front-right': [
    ['books', [1076, 282, 1156, 332]],
    ['wastebasket', [1162, 268, 1248, 332]],
    ['coatStand', [1282, 30, 1376, 332]],
  ],
};

/**
 * The loose sheets printed on the floor (tools/extract-art.mjs: x, y from the fold, degrees),
 * each 30 x 22 px.
 */
const PAPERS: [number, number, number][] = [[330, 40, -14], [612, 38, 22], [1000, 34, 12], [240, 88, 9], [868, 84, -8], [1040, 92, -24],
  [470, 140, -18], [770, 150, 14], [930, 170, -6], [1110, 236, 19], [1210, 200, -11], [560, 190, 6]];

/** A texture's alpha, at a reduced size, for picking. */
class AlphaMask {
  private data: Uint8ClampedArray;
  private w: number;
  private h: number;
  constructor(image: CanvasImageSource & { width: number; height: number }) {
    const k = Math.min(1, 512 / image.width);
    this.w = Math.max(1, Math.round(image.width * k));
    this.h = Math.max(1, Math.round(image.height * k));
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.drawImage(image, 0, 0, this.w, this.h);
    this.data = x.getImageData(0, 0, this.w, this.h).data;
  }
  /** Alpha (0..255) at a mesh uv (v = 1 at the image's top). */
  at(u: number, v: number): number {
    const px = Math.min(this.w - 1, Math.max(0, Math.floor(u * this.w)));
    const py = Math.min(this.h - 1, Math.max(0, Math.floor((1 - v) * this.h)));
    return this.data[(py * this.w + px) * 4 + 3];
  }
}

const inside = (s: Shape, x: number, y: number): boolean => {
  if (typeof s[0] === 'number') { const [x0, y0, x1, y1] = s as Rect; return x >= x0 && x <= x1 && y >= y0 && y <= y1; }
  const p = s as [number, number][];
  let hit = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) hit = !hit;
  }
  return hit;
};
const bbox = (s: Shape): Rect => {
  if (typeof s[0] === 'number') return s as Rect;
  const p = s as [number, number][];
  return [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))];
};

/** Where a region's SVG corners are in the world: on a standing layer, or on the floor. */
type Surface = { kind: 'standing'; opts: StandOptions } | { kind: 'floor'; fold: number };

interface Target {
  mesh: Mesh;
  alpha: AlphaMask | null;
  viewBox: [number, number, number, number];
  key?: string;
  regions?: [string, Shape][];
  surface?: Surface;
  texture?: Texture;
}

export interface HotspotParts {
  art: Art;
  pieces: Record<string, PieceHandle>;
  floor: Mesh;
  puppets: Record<'harry' | 'kim', Mesh>;
  dice: Mesh[];
  cues: { window: Mesh[]; clock: Mesh[]; stairs: Mesh[]; dog: Mesh[]; marek: Mesh[] };
  /** Pieces that hide what is behind them without a tip of their own (the pages, the lead card). */
  blockers: { mesh: Mesh; piece?: ArtPiece }[];
}

export function createHotspots(p: HotspotParts) {
  const masks = new Map<ArtPiece, AlphaMask>();
  const mask = (a: ArtPiece) => {
    let m = masks.get(a);
    if (!m) { m = new AlphaMask(a.texture.image as HTMLImageElement); masks.set(a, m); }
    return m;
  };
  const targets = new Map<Object3D, Target>();
  const add = (mesh: Mesh, piece: ArtPiece | null, extra: Partial<Target> = {}) =>
    targets.set(mesh, { mesh, alpha: piece ? mask(piece) : null, viewBox: piece?.viewBox ?? [0, 0, 1, 1], texture: piece?.texture, ...extra });

  // the baked layers
  for (const name of ['wall', 'furniture', 'desk', 'front-right']) {
    add(p.pieces[name].mesh, p.art[name], { regions: REGIONS[name], surface: { kind: 'standing', opts: p.pieces[name].opts } });
  }
  add(p.pieces['front-chair'].mesh, p.art['front-chair'], { key: 'armchair' });
  add(p.pieces.far.mesh, p.art.far, { key: 'window' });
  // the floor: the loose sheets, then the rug under the desk
  const rowDesk = p.art.floor.meta.rowDesk;
  const papers: [string, Shape][] = PAPERS.map(([x, y, deg]) => {
    const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    return ['papers', [[-17, -13], [17, -13], [17, 13], [-17, 13]].map(([u, v]) => [x + u * c - v * s, y + u * s + v * c] as [number, number])];
  });
  add(p.floor, p.art.floor, {
    regions: [...papers, ['rug', [386, rowDesk - 46, 826, rowDesk + 52]]],
    surface: { kind: 'floor', fold: p.art.floor.meta.fold },
  });
  // pieces of their own
  add(p.puppets.harry, p.art.harry, { key: 'harry' });
  add(p.puppets.kim, p.art.kim, { key: 'kim' });
  for (const d of p.dice) add(d, null, { key: 'dice' });
  const own: [keyof HotspotParts['cues'], (m: Mesh) => ArtPiece | null][] = [
    ['window', (m) => (m.name === 'pane' ? null : p.art[m.name] ?? null)],
    ['clock', (m) => p.art[m.name] ?? null],
    ['stairs', () => p.art.stairs],
    ['dog', (m) => (m.name === 'dog-head' ? p.art['dog-head'] : p.art.dog)],
    ['marek', () => p.art.marek],
  ];
  for (const [key, piece] of own) for (const m of p.cues[key]) add(m, piece(m), { key });
  for (const b of p.blockers) add(b.mesh, b.piece ?? null);

  const ray = new Raycaster();
  const meshes = [...targets.keys()];
  const visible = (o: Object3D | null): boolean => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };

  /** The key under a pointer (NDC), or null. */
  function pick(ndc: Vector2, camera: Camera): string | null {
    ray.setFromCamera(ndc, camera);
    for (const hit of ray.intersectObjects(meshes, false)) {
      const t = targets.get(hit.object);
      if (!t || !visible(t.mesh)) continue;
      const uv = hit.uv;
      if (t.alpha && uv && t.alpha.at(uv.x, uv.y) < 110) continue; // cut away: look further
      if (t.key) return t.key;
      if (t.regions && uv) {
        const [vx, vy, vw, vh] = t.viewBox;
        const x = vx + uv.x * vw, y = vy + (1 - uv.y) * vh;
        const r = t.regions.find(([, s]) => inside(s, x, y));
        if (r) return r[0];
      }
      return null; // paper without a tip hides what is behind it
    }
    return null;
  }

  // ---- highlight
  const group = new Group();
  group.name = 'hotspot-highlights';
  const original = new Map<Material, Color>();
  const quads = new Map<string, Mesh[]>();
  let lit: string | null = null;

  /** The world position of a region's SVG point on its surface, lifted toward the viewer. */
  const onSurface = (s: Surface, x: number, y: number, lift: number): Vector3 => {
    if (s.kind === 'floor') { const bx = x, by = s.fold + y; return new Vector3(wx(bx), baseY(bx, by) + 0.003 + lift, wz(by)); }
    const w = pointOnStanding({ ...s.opts, svgX: x, svgY: y }, s.opts.y ?? 0);
    const n = leanNormal(s.opts.lean);
    return new Vector3(w.x + n.x * lift, w.y + n.y * lift, w.z + n.z * lift);
  };
  const quadsFor = (key: string): Mesh[] => {
    let q = quads.get(key);
    if (q) return q;
    q = [];
    for (const t of targets.values()) {
      if (!t.regions || !t.surface || !t.texture) continue;
      for (const [k, shape] of t.regions) {
        if (k !== key) continue;
        const [x0, y0, x1, y1] = bbox(shape);
        const [vx, vy, vw, vh] = t.viewBox;
        const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        const pos: number[] = [], uv: number[] = [];
        for (const [x, y] of corners) {
          const w = onSurface(t.surface, x, y, 0.004);
          pos.push(w.x, w.y, w.z);
          uv.push((x - vx) / vw, 1 - (y - vy) / vh);
        }
        const g = new BufferGeometry();
        g.setAttribute('position', new Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
        g.setIndex([0, 3, 1, 1, 3, 2]);
        const m = new Mesh(g, new MeshBasicMaterial({ map: t.texture, color: '#ffe6c4', transparent: true, opacity: 0.1, blending: AdditiveBlending, depthWrite: false }));
        m.renderOrder = 2;
        m.visible = false;
        group.add(m);
        q.push(m);
      }
    }
    quads.set(key, q);
    return q;
  };
  const materialsOf = (key: string): Material[] => {
    const out = new Set<Material>();
    for (const t of targets.values()) if (t.key === key) for (const m of [t.mesh.material].flat()) out.add(m);
    return [...out];
  };

  return {
    group,
    pick,
    /** Brightens what `key` names (or nothing). */
    highlight(key: string | null) {
      if (key === lit) return;
      if (lit) {
        for (const m of materialsOf(lit)) { const c = original.get(m); if (c && 'color' in m) (m as MeshBasicMaterial).color.copy(c); }
        for (const q of quadsFor(lit)) q.visible = false;
      }
      lit = key;
      if (!key) return;
      for (const m of materialsOf(key)) {
        if (!('color' in m)) continue;
        const c = (m as MeshBasicMaterial).color;
        if (!original.has(m)) original.set(m, c.clone());
        c.copy(original.get(m)!).multiplyScalar(1.1);
      }
      for (const q of quadsFor(key)) q.visible = true;
    },
    /** A world point on what `key` names, for tests: its first piece's middle, or its first region's. */
    center(key: string): Vector3 | null {
      for (const t of targets.values()) {
        if (t.key === key && visible(t.mesh)) return new Box3().setFromObject(t.mesh).getCenter(new Vector3());
        const r = t.regions?.find(([k]) => k === key);
        if (r && t.surface) { const [x0, y0, x1, y1] = bbox(r[1]); return onSurface(t.surface, (x0 + x1) / 2, (y0 + y1) / 2, 0); }
      }
      return null;
    },
  };
}
