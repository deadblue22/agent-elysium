// Harry's puppet (assets/art/harry.svg), a papercraft: a low-poly paper model after Rauno Somelar's 3D
// sculpt (forms) and the in-game model (colours), turned three-quarters to the right, flat-shaded
// facets lit from the upper left. Chosen in the sixth round from ten directions (docs/cast.md).
// Usage: node tools/papercraft/harry.mjs [out.svg]   (default: assets/art/harry.svg; then npm run bake harry)
import { writeFileSync } from 'node:fs';
import { tube, limb, mesh, render, ngon, band, add, sub, mul, norm, rng } from './lib3d.mjs';

export const M = {
  jacket: { dark: '#252a15', base: '#5c6340', light: '#939c6c' },
  lapel: { dark: '#2e3319', base: '#6c7449', light: '#a7b07c' },
  trousers: { dark: '#4a2f0e', base: '#a0702f', light: '#d4a660' },
  shoes: { dark: '#0f2519', base: '#2f6246', light: '#5f9e7a' },
  skin: { dark: '#6c3f31', base: '#c99479', light: '#f2c9aa' },
  flush: { dark: '#6c2e25', base: '#c26b58', light: '#eba08a' },
  hair: { dark: '#1b130d', base: '#4b3829', light: '#836c55' },
  beard: { dark: '#17100b', base: '#433224', light: '#76624e' },
  shirt: { dark: '#83807a', base: '#d9d5c9', light: '#fcf9f0' },
  tie: { dark: '#0b2e28', base: '#2a6a5d', light: '#58a591' },
  tieY: { dark: '#6a4a0c', base: '#d0a032', light: '#f5d57a' },
  tieR: { dark: '#5a1c10', base: '#b0442b', light: '#e27a5c' },
  tieW: { dark: '#8a8470', base: '#e6dfc4', light: '#fffbe8' },
  belt: { dark: '#100a06', base: '#35261a', light: '#65503b' },
  brass: { dark: '#6a5528', base: '#c6a760', light: '#f3e2a4' },
  patch: { dark: '#8a8880', base: '#dedbd0', light: '#fdfbf4' },
  eye: { dark: '#0c0805', base: '#1d130c', light: '#33251a' },
  lid: { dark: '#5a2a20', base: '#9a4a3a', light: '#c9735e' },
  cig: { dark: '#9a948a', base: '#ece6d8', light: '#ffffff' },
  ash: { dark: '#3a302a', base: '#8a7a6a', light: '#b0a090' },
};

/** A strip of facets wrapped round the face (moustache, chops): columns at angles psi (deg, 0 = front, +
 *  toward the figure's left), each column [yTop, yBottom, lift] with lift = how far it stands off the skin. */
function wrapStrip(name, cols, headAt, rows = 3) {
  const pts = [], faces = [];
  cols.forEach(([psi, yT, yB, lift]) => {
    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1);
      const y = yT + (yB - yT) * t;
      const bulge = Math.sin(Math.PI * t) * lift + 0.35;
      const [cx, cz, rr] = headAt(y, psi);
      const a = (psi * Math.PI) / 180;
      pts.push([cx + Math.sin(a) * (rr + bulge), y, cz + Math.cos(a) * (rr + bulge)]);
    }
  });
  for (let c = 0; c < cols.length - 1; c++) for (let r = 0; r < rows - 1; r++) {
    const A = c * rows + r, B = (c + 1) * rows + r, C = (c + 1) * rows + r + 1, D = c * rows + r + 1;
    if ((c + r) % 2 === 0) { faces.push([A, B, C]); faces.push([A, C, D]); } else { faces.push([A, B, D]); faces.push([B, C, D]); }
  }
  // orientation: outward = away from the head's axis
  const p = mesh(name, pts, faces, null);
  p.faces = p.faces.map((f) => {
    const [a, b, c] = f.map((i) => pts[i]);
    const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
    const ctr = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const out = [ctr[0], 0, ctr[2] - 0.8];
    return n[0] * out[0] + n[2] * out[2] < 0 ? f.slice().reverse() : f;
  });
  return p;
}

export function build() {
  const parts = [];
  const LAYER = { farArm: 0, legs: 0.5, body: 1, head: 2, nearArm: 3, top: 4 };

  // ---- legs: ochre flares; the near (right) leg a step forward ----
  const leg = (sx, z0, name) => {
    const j = [
      { c: [sx * 9.6, 121, 1 + z0], rx: 10, rz: 10.8 },
      { c: [sx * 10.6, 141, 1.4 + z0], rx: 9.2, rz: 9.8 },
      { c: [sx * 11.7, 159, 1.8 + z0], rx: 7.7, rz: 8.3 },
      { c: [sx * 12.6, 174, 2.1 + z0], rx: 6.8, rz: 7.4 },
      { c: [sx * 13.5, 190, 2.5 + z0], rx: 7.2, rz: 7.8 },
      { c: [sx * 14.2, 201, 2.9 + z0], rx: 8.9, rz: 9.5 },
      { c: [sx * 14.7, 209.5, 3.2 + z0], rx: 10.5, rz: 11.3 },
    ];
    const p = limb(name, j, 8, { split: 'sym' });
    p.mat = M.trousers; p.layer = LAYER.legs;
    return p;
  };
  const shoe = (sx, z0, name) => {
    const heel = [sx * 14.8, 214.5, -6.8 + z0], toe = [sx * 17.2, 217.6, 18.5 + z0];
    const a = norm(sub(toe, heel));
    const r = [
      { c: heel, rx: 4.3, rz: 4.2 },
      { c: [sx * 15.1, 213.2, -1 + z0], rx: 5, rz: 5.6 },
      { c: [sx * 15.8, 214.8, 7 + z0], rx: 5.2, rz: 4.1 },
      { c: [sx * 16.5, 216.4, 13.2 + z0], rx: 4.3, rz: 2.7 },
      { c: toe, rx: 1.8, rz: 1.3 },
    ].map((q) => ({ ...q, a, f: [0, -1, 0] }));
    const p = tube(name, r, 6, { capTop: 1.2, capBottom: 1.0, clampY: 219, split: 'alt' });
    p.mat = M.shoes; p.layer = LAYER.legs;
    return p;
  };
  parts.push(leg(1, -1.5, 'legL'), shoe(1, -1.5, 'shoeL'));
  parts.push(leg(-1, 1.5, 'legR'), shoe(-1, 1.5, 'shoeR'));

  // ---- torso: the blazer, long, over a round belly ----
  const T = [
    [57, 8.8, 8, -1.5], [61.5, 18.6, 11.2, -1], [66, 24.4, 13.2, -0.5], [80, 23.8, 14.8, 0.4],
    [96, 22.6, 16, 1.5], [110, 21.8, 16.4, 2.1], [122, 21.2, 15.4, 1.6], [134, 21.8, 15, 1.2], [146, 22.6, 14.8, 1],
  ].map(([y, rx, rz, cz]) => ({ c: [0, y, cz], rx, rz }));
  const torso = tube('torso', T, 10, { split: 'sym' });
  torso.mat = M.jacket; torso.layer = LAYER.body;
  // printed: the open front (shirt, belt, trousers below), lapels, the shirt collar, the tie, pocket flaps
  const opening = [[0.74, 0.1], [0.64, 1], [0.48, 2], [0.38, 3], [0.42, 4], [0.52, 5], [0.55, 6], [0.72, 7], [0.98, 8]];
  const openPoly = [...opening.map(([u, v]) => [-u, v]), ...opening.slice().reverse()];
  const shirtPoly = openPoly.map(([u, v]) => [u, Math.min(v, 5.8)]);
  const trouserPoly = [[-0.55, 6.05], [0.55, 6.05], [0.72, 7], [0.98, 8], [-0.98, 8], [-0.72, 7]];
  torso.patches.push({ poly: shirtPoly, mat: M.shirt });
  torso.patches.push({ poly: trouserPoly, mat: M.trousers, bias: -0.08 });
  torso.patches.push({ poly: [[-0.56, 5.72], [0.56, 5.72], [0.56, 6.1], [-0.56, 6.1]], mat: M.belt });
  torso.patches.push({ poly: [[-0.17, 5.68], [0.17, 5.68], [0.17, 6.14], [-0.17, 6.14]], mat: M.brass, offset: 0.1 });
  // the front edges of the jacket, below the lapels: a dark cut line
  const edgeL = opening.filter(([, v]) => v >= 3).map(([u, v]) => [-u, v]);
  const edgeR = opening.filter(([, v]) => v >= 3);
  torso.patches.push({ polys: [...band(edgeL, 0.07, 1), ...band(edgeR, 0.07, 1)], mat: M.belt, offset: 0.1, opacity: 0.8, jitter: false });
  // wide seventies lapels, catching the light, with a dark rim
  const lapel = (s) => [[s * 0.74, 0.1], [s * 1.85, 0.92], [s * 1.62, 2.1], [s * 1.34, 2.22], [s * 1.47, 2.55], [s * 0.4, 3.62], [s * 0.39, 3], [s * 0.48, 2], [s * 0.64, 1]];
  const lapelRim = (s) => band([[s * 1.85, 0.92], [s * 1.62, 2.1], [s * 1.34, 2.22], [s * 1.47, 2.55], [s * 0.4, 3.62]], 0.08, 1);
  torso.patches.push({ polys: [lapel(1), lapel(-1)], mat: M.lapel, offset: 0.08, bias: 0.16 });
  torso.patches.push({ polys: [...lapelRim(1), ...lapelRim(-1)], mat: M.belt, offset: 0.12, opacity: 0.75, jitter: false });
  // the shirt's big collar, its points spread over the lapels
  const collar = (s) => [[s * 0.12, -0.05], [s * 0.74, 0.02], [s * 1.3, 1.62], [s * 0.82, 1.38], [s * 0.3, 0.78]];
  torso.patches.push({ polys: [collar(1), collar(-1)], mat: M.shirt, offset: 0.16, bias: 0.05 });
  torso.patches.push({ polys: [...band([[0.74, 0.02], [1.3, 1.62], [0.82, 1.38]], 0.05, 1), ...band([[-0.74, 0.02], [-1.3, 1.62], [-0.82, 1.38]], 0.05, 1)], mat: M.shirt, offset: 0.18, bias: -0.35, opacity: 0.8 });
  // the Horrific Necktie: a wide teal blade over the belly, printed with yellow, rust and pale motifs
  const tieBlade = [[-0.15, 1.0], [0.15, 1.0], [0.36, 4.7], [0.02, 5.3], [-0.32, 4.75]];
  torso.patches.push({ poly: tieBlade, mat: M.tie, offset: 0.2 });
  torso.patches.push({ poly: [[-0.23, 0.32], [0.23, 0.32], [0.17, 1.02], [-0.15, 1.02]], mat: M.tie, offset: 0.24, bias: -0.08 });
  const R = rng(3);
  const motifs = { y: [], r: [], w: [] };
  for (let v = 1.3; v < 5.0; v += 0.3) {
    const w = 0.15 + (v - 1.0) * 0.055;
    const u = (R() - 0.5) * 2 * w * 0.75;
    const kind = ['y', 'y', 'r', 'w'][Math.floor(R() * 4)];
    const sz = 0.055 + R() * 0.04;
    motifs[kind].push(kind === 'y' ? ngon(u, v, sz * 1.4, sz * 1.1, 6, R()) : kind === 'r' ? [[u - sz, v - sz * 0.7], [u + sz, v - sz * 0.7], [u + sz, v + sz * 0.7], [u - sz, v + sz * 0.7]] : ngon(u, v, sz * 1.3, sz * 1.0, 3, R() * 2));
  }
  torso.patches.push({ polys: motifs.y, mat: M.tieY, offset: 0.26 });
  torso.patches.push({ polys: motifs.r, mat: M.tieR, offset: 0.26 });
  torso.patches.push({ polys: motifs.w, mat: M.tieW, offset: 0.26 });
  // pocket flaps
  const flap = (s) => [[s * 1.0, 6.5], [s * 2.0, 6.4], [s * 2.0, 6.74], [s * 1.02, 6.84]];
  torso.patches.push({ polys: [flap(1), flap(-1)], mat: M.lapel, offset: 0.06, bias: -0.12 });
  torso.patches.push({ polys: [...band([[1.0, 6.84], [2.0, 6.74]], 0.05, 1), ...band([[-1.0, 6.84], [-2.0, 6.74]], 0.05, 1)], mat: M.belt, offset: 0.1, opacity: 0.7 });
  parts.push(torso);

  // ---- neck ----
  const neck = tube('neck', [
    { c: [0, 44, 0.8], rx: 7.4, rz: 7.2 }, { c: [0, 52, 1], rx: 7.6, rz: 7.4 }, { c: [0, 60, 0], rx: 8, rz: 7.6 },
  ], 8, { split: 'alt' });
  neck.mat = M.skin; neck.layer = LAYER.body;
  parts.push(neck);
  const band0 = tube('collarBand', [
    { c: [0, 53.6, 0.6], rx: 8.3, rz: 8.1 }, { c: [0, 58.5, 0.2], rx: 8.9, rz: 8.6 },
  ], 10, { split: 'quad', keep: (i, k, u) => Math.abs(u) > 0.6 });
  band0.mat = M.shirt; band0.layer = LAYER.body; band0.depthBias = 0.5;
  parts.push(band0);

  // ---- arms: the near (right) arm drawn over the body, the far one behind it ----
  const arm = (sx, name, layer) => {
    const sleeve = limb(name + 'Sleeve', [
      { c: [sx * 21.4, 63.5, 0], rx: 7.8, rz: 8.2 },
      { c: [sx * 25.1, 72, -0.3], rx: 7.6, rz: 7.8 },
      { c: [sx * 27, 86, -1.2], rx: 6.8, rz: 7.2 },
      { c: [sx * 27.8, 99, -1.2], rx: 6.2, rz: 6.6 },
      { c: [sx * 28.4, 112, 1.2], rx: 5.9, rz: 6.3 },
      { c: [sx * 28.8, 124.5, 4.2], rx: 6.2, rz: 6.6 },
    ], 8, { split: 'sym', capTop: 2.2 });
    sleeve.mat = M.jacket; sleeve.layer = layer;
    if (sx < 0) sleeve.patches.push({ poly: [[-1.75, 0.55], [-0.75, 0.55], [-0.75, 1.45], [-1.75, 1.45]], mat: M.patch, offset: 0.1 });
    else sleeve.patches.push({ poly: [[0.75, 0.55], [1.75, 0.55], [1.75, 1.45], [0.75, 1.45]], mat: M.patch, offset: 0.1 });
    const cuff = limb(name + 'Cuff', [
      { c: [sx * 28.8, 122.5, 4.2], rx: 4.7, rz: 5.1 }, { c: [sx * 29.1, 129, 5.2], rx: 4.6, rz: 5 },
    ], 8, { split: 'alt' });
    cuff.mat = M.shirt; cuff.layer = layer; cuff.depthBias = -3;
    const hand = limb(name + 'Hand', [
      { c: [sx * 29.2, 128, 5.3], rx: 3.2, rz: 3.9 },
      { c: [sx * 29.4, 132.5, 5.9], rx: 3.7, rz: 4.8 },
      { c: [sx * 29.4, 137.5, 6.3], rx: 3.4, rz: 4.6 },
      { c: [sx * 29.1, 142, 6.2], rx: 2.6, rz: 3.6 },
    ], 6, { split: 'alt', capBottom: 1.8 });
    hand.mat = M.skin; hand.layer = layer; hand.depthBias = -4;
    const thumb = mesh(name + 'Thumb', [
      [sx * 29, 130, 9.3], [sx * 27.2, 132, 9.5], [sx * 30.6, 132, 9.3], [sx * 28.8, 137.6, 10.5], [sx * 29, 133, 7.4],
    ], [[0, 1, 3], [0, 3, 2], [1, 4, 3], [2, 3, 4]], [sx * 29, 133, 6]);
    thumb.mat = M.skin; thumb.layer = layer; thumb.depthBias = 2;
    return [hand, thumb, cuff, sleeve];
  };
  parts.push(...arm(1, 'armL', LAYER.farArm));
  parts.push(...arm(-1, 'armR', LAYER.nearArm));

  // ---- head: long face, heavy brow ----
  const H = [
    [14, 8, 9, -1, null], [18, 11.2, 12.4, -0.6, null],
    [24, 12.4, 13.4, 0, [0.98, 1, 1, 1, 1, 0.98]],
    [29.5, 12.6, 13.6, 0.4, [1.04, 1.02, 1, 0.98, 0.97, 0.96]],
    [34, 12.6, 13.2, 0.3, [0.99, 0.93, 1.02, 0.98, 0.96, 0.95]],
    [39.5, 12.4, 13.2, 0.6, [1.02, 1.0, 1.01, 0.96, 0.92, 0.9]],
    [44.5, 11.6, 12.8, 1, [1.04, 1.0, 0.96, 0.9, 0.85, 0.82]],
    [49, 9.8, 11, 1.6, [1.06, 1.0, 0.93, 0.84, 0.75, 0.7]],
    [52.2, 6, 7.6, 3, [1.1, 1.0, 0.85, 0.7, 0.55, 0.5]],
  ].map(([y, rx, rz, cz, Mu]) => ({ c: [0, y, cz], rx, rz, m: Mu ? (k, u) => Mu[Math.min(5, Math.round(Math.abs(u)))] : undefined }));
  const head = tube('head', H, 10, { split: 'sym', capTop: 2, capBottom: 1 });
  head.mat = M.skin; head.layer = LAYER.head;
  // printed on the face: eyes under the brow, brows, reddened lids, a flush on the cheeks
  const eye = (s) => [[s * 0.62, 4.02], [s * 0.95, 3.86], [s * 1.38, 3.9], [s * 1.5, 4.05], [s * 1.1, 4.16], [s * 0.72, 4.14]];
  const brow = (s) => [[s * 0.42, 3.25], [s * 1.0, 3.02], [s * 1.72, 3.1], [s * 1.78, 3.38], [s * 1.05, 3.32], [s * 0.45, 3.5]];
  const bag = (s) => [[s * 0.64, 4.18], [s * 1.5, 4.08], [s * 1.46, 4.5], [s * 0.8, 4.52]];
  head.patches.push({ polys: [bag(1), bag(-1)], mat: M.flush, opacity: 0.75, offset: 0.05 });
  head.patches.push({ polys: [eye(1), eye(-1)], mat: M.eye, offset: 0.08, jitter: false });
  head.patches.push({ polys: [brow(1), brow(-1)], mat: M.beard, offset: 0.1 });
  head.patches.push({ polys: [[[-0.9, 6.3], [0.9, 6.3], [0.7, 7.6], [-0.7, 7.6]]], mat: M.skin, bias: -0.08, offset: 0.03 });
  parts.push(head);

  // a helper for anything wrapped on the face: centre and radius of the head surface at (y, psi)
  const headAt = (y, psi) => {
    let i = H.findIndex((r) => r.c[1] > y); if (i <= 0) i = 1;
    const A = H[i - 1], B = H[i];
    const t = (y - A.c[1]) / (B.c[1] - A.c[1]);
    const a = (psi * Math.PI) / 180;
    const u = (psi / 36);
    const mA = A.m ? A.m(0, u) : 1, mB = B.m ? B.m(0, u) : 1;
    const rA = Math.hypot(A.rx * Math.sin(a), A.rz * Math.cos(a)) * mA, rB = Math.hypot(B.rx * Math.sin(a), B.rz * Math.cos(a)) * mB;
    return [0, A.c[2] + (B.c[2] - A.c[2]) * t, rA + (rB - rA) * t];
  };

  // the nose: big, flushed, a wedge off the face
  const nose = mesh('nose', [
    [0, 29.8, 14.3], [0, 38.6, 20.8], [-3.9, 40.4, 13.9], [3.9, 40.4, 13.9], [0, 41, 16.6], [-2.5, 33, 14.6], [2.5, 33, 14.6],
  ], [[0, 5, 1], [0, 1, 6], [5, 2, 1], [1, 3, 6], [2, 4, 1], [1, 4, 3]], [0, 36, 11]);
  nose.mat = M.flush; nose.layer = LAYER.head;
  parts.push(nose);

  // the walrus moustache and the muttonchops as one mass: down from the temples, round the mouth
  const beardCols = (s) => [
    [s * 104, 27.5, 41, 0.7], [s * 92, 27, 45.5, 1.1], [s * 78, 28.5, 49, 1.5], [s * 63, 36, 50.8, 1.8],
    [s * 48, 40.2, 50.2, 2.0], [s * 32, 40.6, 48.2, 2.2], [s * 16, 40.3, 46.6, 2.3],
  ];
  const beard = wrapStrip('beard', [...beardCols(-1), [0, 40.8, 46.2, 2.4], ...beardCols(1).reverse()], headAt, 3);
  beard.mat = M.beard; beard.layer = LAYER.head + 0.7;
  parts.push(beard);
  // grey stubble on the chin below
  head.patches.push({ polys: [[[-1.5, 6.6], [1.5, 6.6], [1.2, 8.05], [-1.2, 8.05]]], mat: M.beard, opacity: 0.35, offset: 0.04, bias: 0.25 });

  // ---- hair: a shell over the crown, parted in the middle, hanging to the collar ----
  const HR = [
    [10.4, 8.6, 9.6, -1, null, null],
    [14.5, 12.9, 14.3, -0.9, null, null],
    [20.5, 14.0, 15.0, -1.3, (k, u) => (Math.abs(u) <= 1 ? 0.93 : 1), (u) => [0, u === 0 ? -3.2 : Math.abs(u) === 1 ? 1.4 : Math.abs(u) === 2 ? 2.6 : 0, 0]],
    [27, 15.3, 16.2, -2.2, (k, u) => (Math.abs(u) === 2 ? 0.95 : 1), (u) => [0, Math.abs(u) === 2 ? 3 : 0, 0]],
    [35, 16.4, 16.6, -3.8, null, null],
    [44, 17.2, 16.4, -5.8, null, null],
    [53, 17.8, 15.6, -7.6, null, null],
    [61, 18.6, 14.8, -9, null, (u, k) => [0, k % 2 ? 3.5 : -1.5, 0]],
  ].map(([y, rx, rz, cz, m, off]) => ({ c: [0, y, cz], rx, rz, m: m ?? undefined, off: off ?? undefined }));
  const keepHair = (i0) => (i, k, u) => {
    const au = Math.abs(u); i += i0;
    if (i <= 1) return true;
    if (i === 2) return au > 1.4;
    return au > 1.9;
  };
  // locks: lighter and darker bands combed back from the parting
  const locks = [
    [[-0.3, 1.2], [-0.05, 1.0], [-1.6, 3.2], [-2.1, 3.3]], [[-1.0, 0.8], [-0.7, 0.9], [-2.8, 5.0], [-3.3, 5.0]],
    [[-2.3, 1.4], [-2.0, 1.5], [-3.5, 6.2], [-3.9, 6.0]], [[0.4, 1.1], [0.7, 1.0], [2.2, 3.4], [1.9, 3.5]],
    [[1.6, 1.0], [1.9, 1.1], [3.6, 5.6], [3.2, 5.8]],
  ];
  const darkLocks = [[[-1.5, 0.9], [-1.3, 1.0], [-2.9, 4.2], [-3.1, 4.1]], [[-2.9, 2.2], [-2.7, 2.3], [-4.2, 6.6], [-4.5, 6.5]], [[1.1, 1.3], [1.3, 1.25], [2.7, 4.4], [2.5, 4.5]]];
  const hairTop = tube('hairTop', HR.slice(0, 6), 10, { split: 'sym', capTop: 2.6, keep: keepHair(0) });
  hairTop.mat = M.hair; hairTop.layer = LAYER.head + 0.5;
  hairTop.patches.push({ polys: locks, mat: M.hair, bias: 0.13, offset: 0.05 });
  hairTop.patches.push({ polys: darkLocks, mat: M.hair, bias: -0.14, offset: 0.06 });
  const hairLow = tube('hairLow', HR.slice(5), 10, { split: 'sym', keep: keepHair(5) });
  hairLow.mat = M.hair; hairLow.layer = LAYER.body;
  hairLow.patches.push({ polys: [[[-2.3, 0], [-2.0, 0], [-2.6, 2.2], [-2.9, 2.2]], [[-3.4, 0], [-3.1, 0], [-3.5, 2.3], [-3.8, 2.2]]], mat: M.hair, bias: 0.12, offset: 0.05 });
  parts.push(hairTop, hairLow);

  // ---- the cigarette, from the corner of the mouth ----
  const c0 = [3.2, 45.6, 13.2], c1 = [6.6, 46.6, 21.5];
  const ca = norm(sub(c1, c0));
  const cig = tube('cig', [{ c: c0, rx: 0.75, rz: 0.75, a: ca, f: [0, -1, 0] }, { c: lerp3(c0, c1, 0.86), rx: 0.75, rz: 0.75, a: ca, f: [0, -1, 0] }, { c: c1, rx: 0.75, rz: 0.75, a: ca, f: [0, -1, 0] }], 4, { split: 'quad', capBottom: 0.2 });
  cig.mat = (fi, verts, idx) => (idx.some((i) => verts[i].uv[1] >= 1.5) ? M.ash : M.cig);
  cig.layer = LAYER.top; cig.fold = false;
  parts.push(cig);

  // the head turns further toward Kim than the body
  for (const p of parts) if (HEAD_PARTS.includes(p.name)) for (const v of p.verts) v.p = headTurn(v.p);
  // the proportions of Somelar's sculpt: a smaller head, the jacket ending at the crotch, long legs
  for (const p of parts) {
    const kind = HEAD_PARTS.includes(p.name) || p.name === 'neck' ? 'head' : /^(leg|shoe)/.test(p.name) ? 'leg' : /^arm/.test(p.name) ? 'arm' : 'body';
    for (const v of p.verts) {
      const [x, y, z] = v.p;
      v.p = kind === 'head' ? mapHead(v.p) : [x, kind === 'leg' ? legY(y) : kind === 'arm' ? armY(y) : bodyY(y), z];
    }
  }
  for (const p of parts) for (const v of p.verts) v.p = mul(v.p, SCALE);
  return parts;
}
const HEAD_PARTS = ['head', 'nose', 'beard', 'hairTop', 'hairLow', 'cig'];
const pw = (y, P) => {
  let i = 0; while (i < P.length - 2 && y > P[i + 1][0]) i++;
  const [a, b] = [P[i], P[i + 1]];
  return a[1] + ((y - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
};
const SH = 0.8;
const SCALE = 0.985;
export const mapHead = (p) => [p[0] * SH, 45 + (p[1] - 56) * SH, p[2] * SH];
const bodyY = (y) => pw(y, [[56, 45], [66, 54], [146, 117]]);
const legY = (y) => (y >= 209.5 ? y : 104 + ((y - 121) * 105.5) / 88.5);
const armY = (y) => 52 + (y - 63.5) * 0.97;
export const HEAD_TURN = 18;
export function headTurn(p) {
  const d = (HEAD_TURN * Math.PI) / 180, c = Math.cos(d), s = Math.sin(d);
  const z0 = 1;
  return [p[0] * c + (p[2] - z0) * s, p[1], -p[0] * s + (p[2] - z0) * c + z0];
}
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function make({ out, yaw = 33, pitch = 9 } = {}) {
  const light = [-0.55, -0.75, 0.6];
  const base = { yaw, pitch, light, amb: 0.22, dif: 0.9, jitter: 0.045, seed: 11, mountainOp: 0.46, valleyOp: 0.62, foldW: 0.44, outlineW: 0.58, cutOp: 0.7 };
  const first = render(build(), base);
  const maxY = Math.max(...first.allPts.map((p) => p[1]));
  const cx = first.P([0, 150, 0])[0];
  const dx = 86 - cx, dy = 219 - maxY;
  const view = { ...base, place: (p) => [p[0] + dx, p[1] + dy, p[2]] };
  const r = render(build(), view);
  const minY = Math.min(...r.allPts.map((p) => p[1]));
  const minX = Math.min(...r.allPts.map((p) => p[0])), maxX = Math.max(...r.allPts.map((p) => p[0]));
  const ember = r.P(mul(mapHead(headTurn([6.6, 46.6, 21.5])), SCALE));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="30 5 104 220" width="104" height="220" data-bake-scale="4" data-soles="219" data-feet-x0="48" data-feet-x1="124" data-ember-x="${ember[0].toFixed(1)}" data-ember-y="${ember[1].toFixed(1)}">
<!-- Harry (papercraft; generated by tools/papercraft/harry.mjs, do not edit by hand): a low-poly paper model after Rauno Somelar's 3D sculpt of Harry
     (the forms and proportions: a head about a sixth of his height, long hair swept back to the collar,
     the walrus moustache and muttonchops, a wide-lapelled blazer ending at the crotch, long legs in
     flares) in the colours of the in-game model (olive blazer, white shirt, the Horrific
     Necktie, ochre flares, green shoes). Turned three-quarters to the right; every facet is flat and
     lit from the upper left; light creases on mountain folds, dark on valley folds; printed details
     (shirt, tie, lapels, eyes) lie on the facets. Drawn by a small generator; no pixels of the original.
     data-soles: the SVG y on the fold line; data-feet-x0/x1: the x range the stand tab covers;
     data-ember-x/y: the cigarette's tip (the scene puts a glow there). -->
<defs>
<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="5" result="n"/>
  <feDiffuseLighting in="n" surfaceScale="0.6" diffuseConstant="1" lighting-color="#fff" result="fib"><feDistantLight azimuth="235" elevation="60"/></feDiffuseLighting>
  <feComposite in="fib" in2="SourceGraphic" operator="arithmetic" k1="0.2" k2="0" k3="0.84" k4="0" result="tex"/>
  <feComposite in="tex" in2="SourceAlpha" operator="in"/>
</filter>
</defs>
<g filter="url(#grain)">
${r.svg}
</g>
</svg>
`;
  if (out) writeFileSync(out, svg);
  return { svg, bounds: { minX, maxX, minY }, ember };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = make({ out: process.argv[2] ?? new URL('../../assets/art/harry.svg', import.meta.url).pathname });
  console.log(JSON.stringify(res.bounds), 'ember', res.ember.map((x) => x.toFixed(1)).join(','), 'size', res.svg.length);
}
