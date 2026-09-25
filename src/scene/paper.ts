// Procedural surface detail and baked occlusion, generated once at load time (seeded, so
// every run is identical; no SVG filters): the paper's tooth, the book cloth and its weave,
// the stacked page edges, and the contact shadows (ambient occlusion) that the static
// pieces throw where they touch a surface, derived from their baked alpha.
import {
  CanvasTexture, DataTexture, Float32BufferAttribute, LinearMipmapLinearFilter, Mesh, MeshBasicMaterial, RepeatWrapping, RGBAFormat,
  SRGBColorSpace, UnsignedByteType, type BufferGeometry, type Texture,
} from 'three';
import type { ArtPiece } from '../assets';
import { mulberry32 } from './snow';
import { rectUV, surfaceGrid, xSamples, ySamples, type StandOptions } from './space';

/** Tileable value noise on an n x n grid, summed over octaves; returns n*n values in 0..1. */
function tileNoise(n: number, seed: number, octaves: [cells: number, weight: number][]): Float32Array {
  const R = mulberry32(seed);
  const out = new Float32Array(n * n);
  let total = 0;
  for (const [cells, weight] of octaves) {
    const lattice = new Float32Array(cells * cells).map(() => R());
    const at = (i: number, j: number) => lattice[((j % cells) + cells) % cells * cells + (((i % cells) + cells) % cells)];
    for (let y = 0; y < n; y++) {
      const fy = (y / n) * cells, j = Math.floor(fy), ty = fy - j, sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < n; x++) {
        const fx = (x / n) * cells, i = Math.floor(fx), tx = fx - i, sx = tx * tx * (3 - 2 * tx);
        const a = at(i, j) + (at(i + 1, j) - at(i, j)) * sx;
        const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
        out[y * n + x] += (a + (b - a) * sy) * weight;
      }
    }
    total += weight;
  }
  for (let k = 0; k < out.length; k++) out[k] /= total;
  return out;
}

/** A tangent-space normal map (linear) from a tileable height field. */
function normalMap(h: Float32Array, n: number, strength: number): DataTexture {
  const data = new Uint8Array(n * n * 4);
  const H = (x: number, y: number) => h[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1), k = (y * n + x) * 4;
      data[k] = (-dx / l * 0.5 + 0.5) * 255;
      data[k + 1] = (dy / l * 0.5 + 0.5) * 255;
      data[k + 2] = (1 / l * 0.5 + 0.5) * 255;
      data[k + 3] = 255;
    }
  }
  const t = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/** The paper's tooth: fine, irregular relief. Repeat it so one tile covers about 1.2 world units. */
export function paperTooth(): DataTexture {
  const n = 512;
  return normalMap(tileNoise(n, 71, [[128, 0.5], [64, 0.3], [32, 0.2]]), n, 3.2);
}

/** Plain-weave book cloth: threads over and under; one tile covers about 0.35 world units. */
export function clothWeave(): DataTexture {
  const n = 128, P = 8, jitter = tileNoise(n, 5, [[32, 1]]);
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = Math.floor(x / P), j = Math.floor(y / P), fx = (x % P) / P, fy = (y % P) / P;
      const warpOnTop = (i + j) % 2 === 0;
      const warp = Math.sin(Math.PI * fx), weft = Math.sin(Math.PI * fy);
      h[y * n + x] = (warpOnTop ? 0.55 + 0.45 * warp * (0.6 + 0.4 * weft) : 0.55 + 0.45 * weft * (0.6 + 0.4 * warp)) + 0.25 * jitter[y * n + x];
    }
  }
  return normalMap(h, n, 1.6);
}

/**
 * Book cloth colour for one board face (mapped once over each face): dark indigo, mottled,
 * a little lighter along the edges and worn through to grey at the corners.
 */
export function clothColor(): CanvasTexture {
  const n = 512, c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d')!;
  const img = x.createImageData(n, n), d = img.data;
  const mottle = tileNoise(n, 23, [[6, 0.6], [24, 0.4]]), grain = tileNoise(n, 29, [[128, 1]]);
  const R = mulberry32(31);
  const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => ({ u, v, r: 0.018 + R() * 0.012 }));
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      const u = px / n, v = py / n, k = py * n + px;
      let wear = 0.25 * Math.max(0, 1 - Math.min(u, v, 1 - u, 1 - v) / 0.012); // rubbed edges
      for (const cn of corners) {
        const dist = Math.hypot(u - cn.u, v - cn.v);
        wear = Math.max(wear, Math.max(0, 1 - dist / cn.r) ** 0.7 * (0.75 + 0.5 * grain[k]));
      }
      wear = Math.min(1, wear);
      const m = 0.9 + 0.2 * mottle[k] + 0.08 * (grain[k] - 0.5);
      const base = [27 * m, 34 * m, 54 * m], worn = [78, 80, 86];
      for (let ch = 0; ch < 3; ch++) d[k * 4 + ch] = base[ch] + (worn[ch] - base[ch]) * wear;
      d[k * 4 + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * The stacked page edges (tail and fore-edges): off-white, many fine sheet lines with slight
 * grey banding and one or two px of misalignment jitter, darker toward the board and with a
 * light rim at the top. v runs from the board (0) to the page surface (1); tile it along u.
 */
export function pageEdges(): CanvasTexture {
  const w = 1024, h = 128, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  const R = mulberry32(47);
  x.fillStyle = '#e4dccb';
  x.fillRect(0, 0, w, h);
  // groups of sheets (signatures) in slightly different tones
  for (let y = 0; y < h;) {
    const bh = 5 + Math.floor(R() * 9), tone = 214 + Math.floor(R() * 22);
    x.fillStyle = `rgb(${tone},${tone - 7},${tone - 20})`;
    x.fillRect(0, y, w, bh);
    y += bh;
  }
  // sheet lines: each wanders a pixel or two along the edge, some darker than others
  for (let k = 0; k < 26; k++) {
    const y0 = 3 + (k / 26) * (h - 6) + (R() - 0.5) * 2.5;
    const dark = R() < 0.35 ? 0.62 : 0.24 + R() * 0.16, p1 = R() * 6.28, p2 = R() * 6.28, f1 = 2 + R() * 3, f2 = 9 + R() * 12;
    x.strokeStyle = `rgba(92,80,62,${dark})`;
    x.lineWidth = R() < 0.35 ? 2.2 : 1.1;
    x.beginPath();
    for (let px = 0; px <= w; px += 8) {
      const y = y0 + Math.sin((px / w) * f1 * 6.283 + p1) * 0.9 + Math.sin((px / w) * f2 * 6.283 + p2) * 0.45;
      if (px === 0) x.moveTo(px, y); else x.lineTo(px, y);
    }
    x.stroke();
  }
  // a few sheets stick out: brighter streaks
  for (let k = 0; k < 10; k++) {
    const y = 4 + R() * (h - 8), x0 = R() * w, len = 80 + R() * 400;
    x.fillStyle = 'rgba(250,246,236,.45)';
    x.fillRect(x0, y, len, 1);
  }
  // occlusion toward the board, and the light rim where the edge turns into the page surface
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,252,244,.7)');
  g.addColorStop(0.07, 'rgba(255,250,240,0)');
  g.addColorStop(0.8, 'rgba(40,30,20,0)');
  g.addColorStop(1, 'rgba(40,30,20,.45)');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  return t;
}

/** A black decal whose alpha is the darkness, drawn over a surface (depth-tested, no depth write). */
export function decal(geometry: BufferGeometry, alpha: Texture, opacity = 1): Mesh {
  const m = new Mesh(geometry, new MeshBasicMaterial({
    color: 0x000000, alphaMap: alpha, transparent: true, opacity, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  m.renderOrder = 1;
  return m;
}

/** A greyscale canvas texture used as an alpha map (the green channel is read). */
function alphaTexture(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  return t;
}

/**
 * Contact occlusion under a standing cut-out: where the piece's baked silhouette reaches its
 * base line, the surface darkens, spreading further behind the piece (it leans over it) than
 * in front. Returns a texture 1 px per SVG unit across and `behind + front` px deep, the
 * piece's base line at row `behind`.
 */
export function contactUnder(image: CanvasImageSource & { width: number; height: number }, viewBox: number[], baseY: number,
  opts: { behind?: number; front?: number; band?: number } = {}): { texture: CanvasTexture; behind: number; front: number } {
  const behind = opts.behind ?? 34, front = opts.front ?? 14, band = opts.band ?? 8;
  const [, vy, vw, vh] = viewBox;
  const W = Math.max(1, Math.round(vw)), H = Math.max(1, Math.round(vh));
  const src = document.createElement('canvas');
  src.width = W; src.height = H;
  const sx = src.getContext('2d', { willReadFrequently: true })!;
  sx.drawImage(image, 0, 0, W, H);
  const y1 = Math.min(H, Math.round(baseY - vy)), y0 = Math.max(0, y1 - band);
  const rows = sx.getImageData(0, y0, W, Math.max(1, y1 - y0)).data;
  const touch = new Float32Array(W);
  for (let px = 0; px < W; px++) {
    let a = 0;
    for (let r = 0; r < y1 - y0; r++) a = Math.max(a, rows[(r * W + px) * 4 + 3] / 255);
    touch[px] = a;
  }
  // soften across (a box blur, twice)
  let wv = touch;
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(W);
    for (let px = 0; px < W; px++) {
      let s = 0, n = 0;
      for (let k = -4; k <= 4; k++) { const q = px + k; if (q >= 0 && q < W) { s += wv[q]; n++; } }
      out[px] = s / n;
    }
    wv = out;
  }
  const c = document.createElement('canvas');
  c.width = W; c.height = behind + front;
  const x = c.getContext('2d')!;
  const img = x.createImageData(W, behind + front), d = img.data;
  for (let r = 0; r < behind + front; r++) {
    const f = r < behind ? Math.exp(-(behind - r) / (behind * 0.38)) : Math.exp(-(r - behind) / (front * 0.35));
    for (let px = 0; px < W; px++) {
      const v = Math.round(255 * Math.min(1, wv[px] * f));
      const k = (r * W + px) * 4;
      d[k] = d[k + 1] = d[k + 2] = v;
      d[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return { texture: alphaTexture(c), behind, front };
}

/** A soft square contact shadow (for the dice), `size` px with the object's footprint in the middle half. */
export function contactSquare(size = 64): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  x.fillStyle = '#000';
  x.fillRect(0, 0, size, size);
  x.shadowColor = '#fff';
  x.shadowBlur = size * 0.16;
  x.shadowOffsetX = size * 4;
  x.fillStyle = '#fff';
  x.fillRect(size * 0.25 - size * 4, size * 0.25, size * 0.5, size * 0.5);
  return alphaTexture(c);
}

/**
 * The book's contact shadow on the table: a broad soft darkening around the boards and a
 * tight dark line right along their edges. Covers the book's footprint plus `margin` on
 * every side (world units); the footprint is w x d.
 */
export function contactBook(w: number, d: number, margin: number): CanvasTexture {
  const px = 64, W = Math.round((w + 2 * margin) * px), H = Math.round((d + 2 * margin) * px);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = '#000';
  x.fillRect(0, 0, W, H);
  const rect = (a: number, blur: number, grow: number) => {
    x.save();
    x.shadowColor = `rgba(255,255,255,${a})`;
    x.shadowBlur = blur;
    x.shadowOffsetX = W * 2;
    x.fillStyle = '#fff';
    x.fillRect(margin * px - grow - W * 2, margin * px - grow, w * px + 2 * grow, d * px + 2 * grow);
    x.restore();
  };
  rect(0.55, 0.55 * px, 0.08 * px);  // broad and soft
  rect(0.85, 0.06 * px, 0);          // the contact line along the boards
  return alphaTexture(c);
}

/**
 * The contact occlusion of a standing piece, as a decal lying on `surface` (world height at
 * bx, by) under its fold line. `gap(bx)`: how far the piece's base floats above the surface
 * there (it bridges the gutter valley); the occlusion fades out where it does not touch.
 */
export function standingContact(piece: ArtPiece, o: StandOptions, surface: (bx: number, by: number) => number,
  opts: { opacity: number; behind?: number; front?: number; gap?: (bx: number) => number }): Mesh {
  const s = o.scale ?? 1, x0 = o.x0 ?? 0;
  const [vx, , vw] = piece.viewBox;
  const { texture, behind, front } = contactUnder(piece.texture.image as HTMLImageElement, piece.viewBox, o.baseY, { behind: opts.behind, front: opts.front });
  const bx0 = x0 + vx * s, bx1 = x0 + (vx + vw) * s, by0 = o.hinge - behind * s, by1 = o.hinge + front * s;
  const g = surfaceGrid(xSamples(bx0, bx1), ySamples(by0, by1, 3), (bx, by) => surface(bx, by) + 0.004, rectUV(bx0, bx1, by0, by1));
  const m = decal(g, texture, opts.opacity);
  if (opts.gap) {
    const p = g.attributes.position, rgba = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      const gap = opts.gap(p.getX(i) * 100 + 670);
      rgba.set([1, 1, 1, 1 - Math.min(1, Math.max(0, (gap - 0.006) / 0.024))], i * 4);
    }
    g.setAttribute('color', new Float32BufferAttribute(rgba, 4));
    (m.material as MeshBasicMaterial).vertexColors = true;
  }
  return m;
}
