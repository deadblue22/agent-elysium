// Kim's puppet (assets/art/kim.svg), a papercraft: a low-poly paper model after Rauno Somelar's 3D
// sculpt of Kim (forms: slicked-back hair, round glasses, the high stand-up collar, the short blousing
// bomber over a white T-shirt, baggy trousers tucked into lace-up boots) in the colours of the in-game
// model, turned three-quarters to the left. Chosen in the sixth round from ten directions (docs/cast.md).
// Usage: node tools/papercraft/kim.mjs [out.svg]   (default: assets/art/kim.svg; then npm run bake kim)
import { writeFileSync } from 'node:fs';
import { tube, limb, mesh, placeAndRender, svgDoc, ngon, band, add, sub, mul, norm, cross, rng } from './lib3d.mjs';

export const M = {
  orange: { dark: '#6a280d', base: '#cc5d28', light: '#f59a5c' },
  rib: { dark: '#42190a', base: '#86401e', light: '#bb6a3e' },
  collar: { dark: '#22160e', base: '#5a3e2b', light: '#906c50' },
  tee: { dark: '#86857f', base: '#dedcd4', light: '#fbfaf5' },
  skin: { dark: '#6a472c', base: '#d0a97e', light: '#f3d6ad' },
  hair: { dark: '#060505', base: '#1f1b1a', light: '#4e4642' },
  nape: { dark: '#1c1a18', base: '#433d38', light: '#6e665c' },
  rim: { dark: '#030303', base: '#121212', light: '#3c3c3c' },
  lens: { dark: '#9aa8ac', base: '#dfe9ec', light: '#ffffff' },
  glove: { dark: '#35110a', base: '#76301f', light: '#b35c45' },
  trousers: { dark: '#3a2c1c', base: '#7e6746', light: '#b39670' },
  boots: { dark: '#0c0907', base: '#2c231e', light: '#5c4c42' },
  lace: { dark: '#6a5a4a', base: '#a8988a', light: '#d8ccc0' },
  belt: { dark: '#0c0908', base: '#2a211c', light: '#56473e' },
  laceDark: { dark: '#2a2420', base: '#6a5c50', light: '#9a8a7c' },
  buckle: { dark: '#5a5046', base: '#a89c8a', light: '#e8dccb' },
  patch: { dark: '#8a8880', base: '#dedbd0', light: '#fdfbf4' },
  badgeMark: { dark: '#3a2418', base: '#6c4a34', light: '#8a6a52' },
  eye: { dark: '#0a0706', base: '#1a120e', light: '#2e241e' },
  mouth: { dark: '#5a3024', base: '#8e5a46', light: '#b07a64' },
  zip: { dark: '#5a5a5a', base: '#a8a8a8', light: '#e8e8e8' },
};
export const HEAD_TURN = -15;
const SK = 0.8;
const pwK = (y) => {
  const P = [[53, 44.8], [57, 48.5], [115, 90.5]];
  let i = 0; while (i < P.length - 2 && y > P[i + 1][0]) i++;
  const [a, b] = [P[i], P[i + 1]];
  return a[1] + ((y - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
};
const SCALE = 0.99;
export function headTurn(p) {
  const d = (HEAD_TURN * Math.PI) / 180, c = Math.cos(d), s = Math.sin(d), z0 = 1;
  return [p[0] * c + (p[2] - z0) * s, p[1], -p[0] * s + (p[2] - z0) * c + z0];
}

export function build() {
  const parts = [];
  const LAYER = { farArm: 2.6, legs: 0.5, body: 1, head: 2, nearArm: 3 };

  // ---- legs: khaki trousers, full over the boots ----
  const leg = (sx, z0, name) => {
    const p = limb(name, [
      { c: [sx * 7.2, 110, 0.4 + z0], rx: 8.8, rz: 9.6 },
      { c: [sx * 7.7, 128, 0.8 + z0], rx: 8.4, rz: 9.2 },
      { c: [sx * 8.1, 146, 1.2 + z0], rx: 7.4, rz: 8.2 },
      { c: [sx * 8.3, 160, 1.4 + z0], rx: 6.8, rz: 7.6 },
      { c: [sx * 8.5, 172, 1.6 + z0], rx: 7.3, rz: 8 },
      { c: [sx * 8.6, 180, 1.4 + z0], rx: 7, rz: 7.6 },
      { c: [sx * 8.6, 184.8, 1.0 + z0], rx: 5.4, rz: 6 },
    ], 8, { split: 'sym' });
    p.mat = M.trousers; p.layer = LAYER.legs;
    return p;
  };
  const boot = (sx, z0, name) => {
    const shaft = limb(name + 'Shaft', [
      { c: [sx * 8.5, 181, 1 + z0], rx: 5.2, rz: 5.8 }, { c: [sx * 8.6, 192, 0.6 + z0], rx: 5.4, rz: 6 },
    ], 8, { split: 'quad' });
    shaft.mat = M.boots; shaft.layer = LAYER.legs; shaft.depthBias = -1;
    const heel = [sx * 8.6, 196.5, -5.2 + z0], toe = [sx * 9.4, 199.6, 13 + z0];
    const a = norm(sub(toe, heel));
    const foot = tube(name, [
      { c: heel, rx: 4.6, rz: 4.4 },
      { c: [sx * 8.7, 195, -0.5 + z0], rx: 5.4, rz: 6 },
      { c: [sx * 8.9, 196.5, 6 + z0], rx: 5.6, rz: 4.6 },
      { c: [sx * 9.2, 198.2, 10.6 + z0], rx: 4.8, rz: 3.2 },
      { c: toe, rx: 3, rz: 2 },
    ].map((q) => ({ ...q, a, f: [0, -1, 0] })), 6, { capTop: 1.2, capBottom: 1.4, clampY: 201, split: 'alt' });
    foot.mat = M.boots; foot.layer = LAYER.legs;
    foot.patches.push({ polys: [[[-0.45, 1.2], [0.45, 1.2], [0.4, 1.35], [-0.4, 1.35]], [[-0.45, 1.65], [0.45, 1.65], [0.4, 1.8], [-0.4, 1.8]], [[-0.4, 2.1], [0.4, 2.1], [0.35, 2.25], [-0.35, 2.25]]], mat: M.lace, offset: 0.08 });
    return [shaft, foot];
  };
  parts.push(leg(-1, -1.2, 'legR'), ...boot(-1, -1.2, 'bootR'));
  parts.push(leg(1, 1.2, 'legL'), ...boot(1, 1.2, 'bootL'));

  // ---- the bomber: short, boxy, blousing over a ribbed hem ----
  const T = [
    [53, 8.8, 8.2, -0.5], [57, 15.5, 10.2, -0.5], [61, 19.6, 11.6, -0.2], [74, 19.9, 12.8, 0.4],
    [90, 19.8, 13, 0.6], [101, 19.4, 12.6, 0.4], [105, 16.9, 10.8, 0.2], [115, 16.3, 10.3, 0],
  ].map(([y, rx, rz, cz]) => ({ c: [0, y, cz], rx, rz }));
  const torso = tube('torso', T, 10, { split: 'sym' });
  torso.mat = (fi, verts, idx) => (idx.every((i) => verts[i].uv[1] >= 6) ? M.rib : M.orange);
  torso.layer = LAYER.body;
  const opening = [[0.72, 0], [0.62, 1], [0.48, 2], [0.4, 3], [0.37, 4], [0.36, 5], [0.36, 6], [0.36, 7]];
  torso.patches.push({ poly: [...opening.map(([u, v]) => [-u, v]), ...opening.slice().reverse()], mat: M.tee });
  // ribbed hem: vertical ribs, printed
  const ribs = [];
  for (let u = -5; u < 5; u += 0.25) if (Math.abs(u) > 0.4) ribs.push([[u, 6.05], [u + 0.07, 6.05], [u + 0.07, 6.97], [u, 6.97]]);
  torso.patches.push({ polys: ribs, mat: M.rib, bias: -0.14, offset: 0.05 });
  // the zip's two edges
  const zipL = opening.map(([u, v]) => [-u, v]), zipR = opening;
  torso.patches.push({ polys: [...band(zipL, 0.05, 1), ...band(zipR, 0.05, 1)], mat: M.zip, offset: 0.1, bias: 0.1 });
  // the round badge on his left breast; welt pockets; seams
  torso.patches.push({ poly: ngon(1.28, 2.25, 0.27, 0.3, 8, Math.PI / 8), mat: M.patch, offset: 0.12, bias: 0.05 });
  torso.patches.push({ poly: ngon(1.28, 2.25, 0.12, 0.13, 6, 0.3), mat: M.badgeMark, offset: 0.16 });
  torso.patches.push({ polys: [...band([[0.9, 4.1], [1.5, 5.1]], 0.06, 1), ...band([[-0.9, 4.1], [-1.5, 5.1]], 0.06, 1)], mat: M.rib, offset: 0.08, bias: -0.2 });
  parts.push(torso);

  // ---- neck and the high knit collar ----
  const neck = tube('neck', [{ c: [0, 41, 0.8], rx: 5.6, rz: 5.8 }, { c: [0, 55, 0.2], rx: 6, rz: 6 }], 8, { split: 'alt' });
  neck.mat = M.skin; neck.layer = LAYER.body;
  parts.push(neck);
  const collar = tube('collar', [
    { c: [0, 44.2, -0.9], rx: 10.2, rz: 9.9, off: (u) => [0, [9.5, 8, 5, 2.4, 0.8][Math.min(4, Math.abs(u))], 0] },
    { c: [0, 57.2, 0.2], rx: 12, rz: 11.4, off: (u) => [0, Math.abs(u) <= 2 ? 2.6 : Math.abs(u) === 3 ? 1.3 : 0, 0] },
  ], 16, { split: 'quad', keep: (i, k, u) => Math.abs(u) > 1.1 });
  collar.mat = M.collar; collar.layer = LAYER.body; collar.depthBias = 1.5; collar.twoSided = true; collar.innerBias = -0.3;
  const collarRibs = [];
  for (let u = -8; u < 8; u += 0.42) if (Math.abs(u) > 1.2) collarRibs.push([[u, 0], [u + 0.13, 0], [u + 0.13, 1], [u, 1]]);
  collar.patches.push({ polys: collarRibs, mat: M.collar, bias: -0.18, offset: 0.05 });
  parts.push(collar);

  // ---- arms: the notebook held open in the left hand, the pen in the right ----
  const arm = (name, upperJ, lowerJ, cuffJ, handJ, layer, patch) => {
    const upper = limb(name + 'Upper', upperJ, 8, { split: 'sym', capTop: 2, capBottom: 2 });
    upper.mat = M.orange; upper.layer = layer;
    if (patch) upper.patches.push({ poly: patch, mat: M.patch, offset: 0.1 });
    const lower = limb(name + 'Lower', lowerJ, 8, { split: 'sym' });
    lower.mat = M.orange; lower.layer = layer + 0.01;
    const cuff = limb(name + 'Cuff', cuffJ, 8, { split: 'quad' });
    cuff.mat = M.rib; cuff.layer = layer + 0.02;
    const hand = limb(name + 'Hand', handJ, 6, { split: 'alt', capBottom: 1.6 });
    hand.mat = M.glove; hand.layer = layer + 0.03;
    return [upper, lower, cuff, hand];
  };
  parts.push(...arm('armR',
    [{ c: [-17.6, 59, -0.6], rx: 7, rz: 7.4 }, { c: [-19.6, 67, -0.6], rx: 6.9, rz: 7.2 }, { c: [-20.2, 76, 0], rx: 6.5, rz: 6.8 }, { c: [-19.8, 84, 1.2], rx: 6.1, rz: 6.3 }],
    [{ c: [-19.6, 83, 1.6], rx: 5.8, rz: 6 }, { c: [-15, 85.4, 7.8], rx: 5.4, rz: 5.6 }, { c: [-9.6, 86, 12.6], rx: 5, rz: 5.2 }],
    [{ c: [-10.4, 85.9, 12], rx: 4.4, rz: 4.6 }, { c: [-7.8, 86, 14], rx: 4.2, rz: 4.4 }],
    [{ c: [-8, 86, 13.8], rx: 3.3, rz: 4.1 }, { c: [-4.6, 85.6, 16], rx: 3.7, rz: 4.5 }, { c: [-2, 85, 17.2], rx: 2.9, rz: 3.7 }],
    LAYER.farArm));
  // the notebook: dark covers, white page edges, open toward him
  const nb = (() => {
    const c = [2.2, 88.5, 19.2], w = 5.8, h = 7, t = 0.9, al = (32 * Math.PI) / 180, be = (-18 * Math.PI) / 180;
    const pts = [];
    for (const [x, y, z] of [[-w, -h, -t], [w, -h, -t], [w, h, -t], [-w, h, -t], [-w, -h, t], [w, -h, t], [w, h, t], [-w, h, t]]) {
      let y1 = y * Math.cos(al) - z * Math.sin(al), z1 = y * Math.sin(al) + z * Math.cos(al);
      z1 = z1; // tilt: top edge away from him
      const x2 = x * Math.cos(be) + z1 * Math.sin(be), z2 = -x * Math.sin(be) + z1 * Math.cos(be);
      pts.push([c[0] + x2, c[1] + y1, c[2] + z2]);
    }
    return mesh('notebook', pts, [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], c);
  })();
  const pages = { dark: '#8a857a', base: '#e8e2d2', light: '#fffaee' }, cover = { dark: '#1a100a', base: '#3e2a1e', light: '#6e5040' };
  nb.mat = (fi) => (fi === 1 ? cover : fi === 0 ? pages : fi === 5 ? cover : pages);
  nb.layer = LAYER.nearArm - 0.1; nb.fold = true;
  parts.push(nb);
  const pen = tube('pen', [{ c: [-3.2, 84.2, 17.8], rx: 0.55, rz: 0.55, a: norm([4.6, -4.4, 1.8]), f: [0, 0, 1] }, { c: [1.4, 79.8, 19.6], rx: 0.5, rz: 0.5, a: norm([4.6, -4.4, 1.8]), f: [0, 0, 1] }], 4, { split: 'quad', capBottom: 0.6 });
  pen.mat = { dark: '#050505', base: '#1a1a1a', light: '#555555' }; pen.layer = LAYER.nearArm + 0.5; pen.fold = false;
  parts.push(pen);
  parts.push(...arm('armL',
    [{ c: [17.6, 59, -0.6], rx: 7, rz: 7.4 }, { c: [19.6, 67, -0.8], rx: 6.9, rz: 7.2 }, { c: [20.4, 76, -0.6], rx: 6.5, rz: 6.8 }, { c: [20.2, 84.5, 0.5], rx: 6.1, rz: 6.3 }],
    [{ c: [20, 83.5, 1], rx: 5.8, rz: 6 }, { c: [15.8, 87.2, 7.2], rx: 5.4, rz: 5.6 }, { c: [10.6, 89.2, 12.2], rx: 5, rz: 5.2 }],
    [{ c: [11.4, 88.8, 11.5], rx: 4.4, rz: 4.6 }, { c: [8.8, 89.8, 13.6], rx: 4.2, rz: 4.4 }],
    [{ c: [9, 89.6, 13.4], rx: 3.4, rz: 4.2 }, { c: [5.4, 90.6, 15.8], rx: 3.8, rz: 4.6 }, { c: [2.6, 90.6, 17.2], rx: 3, rz: 3.8 }],
    LAYER.nearArm, [[0.6, 0.45], [1.7, 0.45], [1.7, 1.45], [0.6, 1.45]]));

  // ---- head: a long oval, high cheekbones ----
  const H = [
    [13.5, 6.5, 7.5, -1.2, null], [16.5, 9.2, 10.8, -0.8, null], [21.5, 10.3, 11.8, -0.4, null],
    [27, 10.6, 12, 0, [1.02, 1.01, 1, 0.98, 0.97, 0.96]],
    [32, 10.5, 11.6, 0, [0.98, 0.94, 1.04, 0.98, 0.96, 0.95]],
    [37, 10, 11.2, 0.3, [1.02, 0.99, 0.99, 0.94, 0.9, 0.88]],
    [42, 8.8, 10.4, 0.6, [1.03, 0.98, 0.92, 0.86, 0.8, 0.78]],
    [45.5, 6.8, 8.4, 1.2, [1.06, 0.98, 0.88, 0.75, 0.66, 0.62]],
    [47.8, 3.8, 5, 2.2, null],
  ].map(([y, rx, rz, cz, Mu]) => ({ c: [0, y, cz], rx, rz, m: Mu ? (k, u) => Mu[Math.min(5, Math.round(Math.abs(u)))] : undefined }));
  const head = tube('head', H, 10, { split: 'sym', capTop: 1.6, capBottom: 0.8 });
  head.mat = M.skin; head.layer = LAYER.head;
  // eyes (seen through the lenses), brows, the mouth
  const eye = (s) => [[s * 0.52, 3.98], [s * 0.78, 3.85], [s * 1.12, 3.9], [s * 1.2, 4.02], [s * 0.86, 4.12], [s * 0.58, 4.1]];
  const brow = (s) => [[s * 0.38, 3.42], [s * 0.9, 3.28], [s * 1.36, 3.36], [s * 1.36, 3.52], [s * 0.9, 3.46], [s * 0.4, 3.58]];
  head.patches.push({ polys: [eye(1), eye(-1)], mat: M.eye, offset: 0.08, jitter: false });
  head.patches.push({ polys: [brow(1), brow(-1)], mat: M.hair, offset: 0.08, bias: 0.1 });
  head.patches.push({ polys: [[[-0.55, 5.9], [0.55, 5.9], [0.5, 6.05], [-0.5, 6.05]]], mat: M.mouth, offset: 0.06 });
  parts.push(head);

  const nose = mesh('nose', [
    [0, 28, 12.1], [0, 35.6, 15.2], [-2.7, 37, 11.2], [2.7, 37, 11.2], [0, 37.6, 13.1], [-1.6, 31, 12.2], [1.6, 31, 12.2],
  ], [[0, 5, 1], [0, 1, 6], [5, 2, 1], [1, 3, 6], [2, 4, 1], [1, 4, 3]], [0, 34, 9.5]);
  nose.mat = M.skin; nose.layer = LAYER.head;
  parts.push(nose);

  // the near ear (his left)
  const ear = mesh('ear', [[10.2, 29.2, 0.2], [11.9, 30, -1.6], [12.1, 34.5, -2.2], [10.9, 37.4, -1.6], [10, 36.2, -0.4], [11.1, 33, -0.8]],
    [[0, 1, 5], [1, 2, 5], [2, 3, 5], [3, 4, 5], [4, 0, 5]], null);
  ear.twoSided = true; ear.mat = M.skin; ear.layer = LAYER.head; ear.depthBias = 1;
  parts.push(ear);

  // ---- hair: slicked back, dark, receding at the temples; the sides and nape clipped short ----
  const HR = [
    [11.9, 6.9, 7.9, -1.4, null],
    [15.4, 10.1, 11.7, -1, (u) => [0, Math.abs(u) <= 1 ? -1.3 : 0, 0], (k, u) => (Math.abs(u) <= 1 ? 1.06 : 1)],
    [20.2, 11.2, 12.6, -0.8, (u) => [0, Math.abs(u) === 0 ? -0.6 : Math.abs(u) === 1 ? -2.4 : Math.abs(u) === 2 ? -3.4 : 0, 0], (k, u) => (Math.abs(u) <= 2 ? 0.95 : 1)],
    [26, 11.5, 12.8, -1, null],
    [32, 11.3, 12.2, -1.4, null],
    [38.5, 10.4, 10.8, -2, null],
  ].map(([y, rx, rz, cz, off, m]) => ({ c: [0, y, cz], rx, rz, off: off ?? undefined, m: m ?? undefined }));
  const hair = tube('hair', HR, 10, {
    split: 'sym', capTop: 1.8,
    keep: (i, k, u) => { const au = Math.abs(u); return i <= 1 ? true : i === 2 ? au > 1.9 : i === 3 ? au > 2.4 : au > 2.9; },
  });
  hair.mat = (fi, verts, idx) => (idx.every((i) => verts[i].uv[1] >= 3 && !verts[i].apex) ? M.nape : M.hair);
  hair.layer = LAYER.head + 0.5;
  // comb lines
  const combs = [];
  for (const u0 of [-1.6, -1.0, -0.45, 0.15, 0.7, 1.25, 1.8]) combs.push(...band([[u0 * 0.6, 0.35], [u0, 1.3], [u0 * 1.25, 2.2]], 0.06, 1));
  hair.patches.push({ polys: combs, mat: M.hair, bias: 0.22, offset: 0.06 });
  parts.push(hair);


  // ---- the round glasses: dark octagonal rims, pale lenses, a bridge, the arm back to the ear ----
  const lensC = (s) => [s * 4.3, 31.2, 11.9 - Math.abs(s) * 0.2];
  const rimPts = [], rimFaces = [], lensPts = [], lensFaces = [];
  const Ro = 4.1, Ri = 3.25;
  for (const s of [-1, 1]) {
    const C = lensC(s);
    const d = norm([s * 0.25, 0, 1]);
    const e1 = norm(cross([0, 1, 0], d)), e2 = [0, 1, 0];
    const b = rimPts.length;
    for (let k = 0; k < 8; k++) {
      const t = (Math.PI * 2 * k) / 8 + Math.PI / 8;
      rimPts.push(add(C, add(mul(e1, Ro * Math.cos(t)), mul(e2, Ro * Math.sin(t)))));
      rimPts.push(add(C, add(mul(e1, Ri * Math.cos(t)), mul(e2, Ri * Math.sin(t)))));
    }
    for (let k = 0; k < 8; k++) {
      const k2 = (k + 1) % 8;
      rimFaces.push([b + 2 * k, b + 2 * k2, b + 2 * k2 + 1, b + 2 * k + 1]);
    }
    const lb = lensPts.length;
    for (let k = 0; k < 8; k++) {
      const t = (Math.PI * 2 * k) / 8 + Math.PI / 8;
      lensPts.push(add(C, add(mul(e1, Ri * Math.cos(t)), mul(e2, Ri * Math.sin(t)))));
    }
    lensFaces.push(Array.from({ length: 8 }, (_, k) => lb + k));
  }
  // bridge between the inner-upper rim points
  const bi = rimPts.length;
  rimPts.push(add(lensC(-1), [Ro * 0.92, -1.2, 0.3]), add(lensC(1), [-Ro * 0.92, -1.2, 0.3]), add(lensC(1), [-Ro * 0.92, -0.2, 0.3]), add(lensC(-1), [Ro * 0.92, -0.2, 0.3]));
  rimFaces.push([bi, bi + 1, bi + 2, bi + 3]);
  // the near arm (his left) back to the ear
  const ai = rimPts.length;
  rimPts.push(add(lensC(1), [Ro * 0.97, -0.9, -0.4]), [10.9, 30.2, -0.6], [10.9, 31.1, -0.6], add(lensC(1), [Ro * 0.97, 0, -0.4]));
  rimFaces.push([ai, ai + 1, ai + 2, ai + 3]);
  const rims = mesh('rims', rimPts, rimFaces, null);
  rims.twoSided = true; rims.mat = M.rim; rims.layer = LAYER.head + 0.8; rims.fold = false;
  const lenses = mesh('lenses', lensPts, lensFaces, null);
  lenses.twoSided = true; lenses.mat = M.lens; lenses.layer = LAYER.head + 0.75; lenses.opacity = 0.32; lenses.fold = false; lenses.outline = false;
  parts.push(lenses, rims);

  const HEADS = ['head', 'nose', 'ear', 'hair', 'rims', 'lenses'];
  for (const p of parts) if (HEADS.includes(p.name)) for (const v of p.verts) v.p = headTurn(v.p);
  // the proportions of Somelar's sculpt: a smaller head, the bomber ending at the waist, long legs,
  // the trousers bloused into tall lace-up boots
  for (const p of parts) {
    const kind = HEADS.includes(p.name) || p.name === 'neck' ? 'head' : /Shaft$/.test(p.name) ? 'shaft' : /^(leg|boot)/.test(p.name) ? 'leg' : /^arm|^notebook|^pen/.test(p.name) ? 'arm' : 'body';
    for (const v of p.verts) {
      const [x, y, z] = v.p;
      v.p = kind === 'head' ? [x * SK, 10.5 + (y - 10.1) * SK, z * SK]
        : [x, kind === 'shaft' ? 158 + ((y - 181) * 32) / 11 : kind === 'leg' ? (y >= 191 ? y : 84 + ((y - 110) * 78) / 74.8) : kind === 'arm' ? 49 + (y - 59) * 0.87 : pwK(y), z];
    }
  }
  // the hips below the bomber's hem: trousers and a belt with its buckle
  const hips = tube('hips', [
    { c: [0, 88.6, 0.4], rx: 16.4, rz: 10.4 }, { c: [0, 93.2, 0.5], rx: 16.8, rz: 10.8 }, { c: [0, 99, 0.6], rx: 16.4, rz: 10.6 },
  ], 10, { split: 'sym' });
  hips.mat = M.trousers; hips.layer = LAYER.legs; hips.depthBias = 2;
  hips.patches.push({ poly: [[-5, 0.35], [5, 0.35], [5, 1.05], [-5, 1.05]], mat: M.belt });
  hips.patches.push({ poly: [[-0.32, 0.28], [0.32, 0.28], [0.32, 1.12], [-0.32, 1.12]], mat: M.buckle, offset: 0.1 });
  parts.push(hips);
  // laces up the boot shafts
  for (const p of parts) if (/Shaft$/.test(p.name)) p.patches.push({ polys: [0.12, 0.3, 0.48, 0.66, 0.84].flatMap((v) => [[[-0.42, v], [0.42, v + 0.1], [0.42, v + 0.14], [-0.42, v + 0.04]], [[0.42, v], [-0.42, v + 0.1], [-0.42, v + 0.14], [0.42, v + 0.04]]]), mat: M.laceDark, offset: 0.08 });
  // a little smaller: about nine tenths of Harry's height, the head clear of the viewBox's top
  for (const p of parts) for (const v of p.verts) v.p = [v.p[0] * SCALE, v.p[1] * SCALE, v.p[2] * SCALE];
  return parts;
}

export function make({ out, yaw = -33, pitch = 9 } = {}) {
  const base = { yaw, pitch, light: [-0.55, -0.75, 0.6], amb: 0.22, dif: 0.9, jitter: 0.045, seed: 23, mountainOp: 0.46, valleyOp: 0.62, foldW: 0.42, outlineW: 0.55, cutOp: 0.7 };
  const r = placeAndRender(build, base, { soles: 201, cx: 51.5, axis: [0, 150, 0] });
  const svg = svgDoc({
    viewBox: '12 10 72 193', size: [72, 193],
    data: { 'bake-scale': 4, soles: 201, 'feet-x0': 31, 'feet-x1': 72 },
    comment: `Kim (papercraft; generated by tools/papercraft/kim.mjs, do not edit by hand): a low-poly paper model after Rauno Somelar's 3D sculpt of Kim
     (the forms and proportions: a small head, hair slicked back from a receding hairline, round glasses,
     the tall stand-up collar, the short bomber blousing over its ribbed hem at the waist, a white
     T-shirt, a belt, baggy trousers bloused into tall lace-up boots) in the colours of the in-game model (orange bomber, dark brown collar, white patch on the
     sleeve and round badge, red-brown gloves, khaki trousers, dark boots). He holds his notebook open
     in his left hand and a pen in his right. Turned three-quarters to the left; flat facets lit from the upper left, light
     creases on mountain folds, dark on valley folds, printed details on the facets. Drawn by a small
     generator; no pixels of the original. data-soles: the SVG y on the fold line; data-feet-x0/x1: the
     x range the stand tab covers.`,
    body: r.svg,
  });
  if (out) writeFileSync(out, svg);
  return { svg, bounds: r.bounds };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = make({ out: process.argv[2] ?? new URL('../../assets/art/kim.svg', import.meta.url).pathname });
  console.log(JSON.stringify(res.bounds), 'size', res.svg.length);
}
