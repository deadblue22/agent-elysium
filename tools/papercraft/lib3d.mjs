// A tiny low-poly renderer for the papercraft puppets (tools/papercraft/harry.mjs, kim.mjs): parts built from rings of vertices,
// turned (yaw) and tipped (pitch), flat-shaded per facet with a light from the upper left,
// "printed" details clipped onto the facets, fold lines (mountain light, valley dark) on shared
// edges, and a dark cut line along each part's silhouette. Output: SVG markup.

// ---------- vectors ----------
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------- deterministic noise ----------
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s >>> 0) / 4294967296; };
}

// ---------- colour ----------
const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toLin = (c) => Math.pow(c / 255, 2.2);
const toSrgb = (c) => Math.round(255 * Math.pow(Math.min(1, Math.max(0, c)), 1 / 2.2));
const rgb2hex = (r) => '#' + r.map((c) => c.toString(16).padStart(2, '0')).join('');
function mixHex(a, b, t) {
  const A = hex2rgb(a).map(toLin), B = hex2rgb(b).map(toLin);
  return [0, 1, 2].map((i) => A[i] + (B[i] - A[i]) * t);
}
/** material {dark, base, light}: s = 0 → dark, s = 0.6 → base, s = 1 → light (a little past both ends) */
export function shade(mat, s, jitter = 0) {
  s = Math.max(-0.15, Math.min(1.15, s + jitter));
  const lin = s < 0.6 ? mixHex(mat.dark, mat.base, Math.max(0, s) / 0.6) : mixHex(mat.base, mat.light, (s - 0.6) / 0.4);
  if (s < 0) for (let i = 0; i < 3; i++) lin[i] *= 1 + s * 2;
  return rgb2hex(lin.map(toSrgb));
}

// ---------- building parts ----------
/**
 * A tube: rings of `segs` vertices. Each ring: { c:[x,y,z], rx, rz, a?:axis (default down [0,1,0]),
 * f?:front (default [0,0,1]), m?:(k,u)=>radius multiplier, off?:(u,k)=>[dx,dy,dz] }.
 * u runs -segs/2..segs/2 with u = 0 at the front (+f) and +u toward cross(a, f) (the figure's left).
 * opts: { capTop, capBottom (apex distances, or undefined), split: 'alt'|'a'|'b'|'auto'|'quad',
 *         keep?: (i, k, uMid) => bool  (which quads to keep; open surfaces), clampY }
 */
export function tube(name, rings, segs, opts = {}) {
  const verts = [], faces = [], ringIdx = [];
  const half = segs / 2;
  rings.forEach((R, i) => {
    const a = norm(R.a ?? [0, 1, 0]);
    let f = R.f ?? [0, 0, 1];
    f = norm(sub(f, mul(a, dot(f, a))));
    const s = cross(a, f);
    const idx = [];
    for (let k = 0; k < segs; k++) {
      const u = k <= half ? k : k - segs;
      const phi = (2 * Math.PI * (k + (R.phase ?? opts.phase ?? 0))) / segs;
      const m = R.m ? R.m(k, u) : 1;
      let p = add(R.c, add(mul(s, R.rx * Math.sin(phi) * m), mul(f, R.rz * Math.cos(phi) * m)));
      if (R.off) p = add(p, R.off(u, k));
      if (opts.clampY != null) p[1] = Math.min(p[1], opts.clampY);
      idx.push(verts.length);
      verts.push({ p, uv: [u, i] });
    }
    ringIdx.push(idx);
  });
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < segs; k++) {
      const k2 = (k + 1) % segs;
      const A = ringIdx[i][k], B = ringIdx[i][k2], C = ringIdx[i + 1][k2], D = ringIdx[i + 1][k];
      let uA = verts[A].uv[0], uB = verts[B].uv[0];
      if (uB < uA) uB += segs;
      let uMid = (uA + uB) / 2; if (uMid > half) uMid -= segs;
      if (opts.keep && !opts.keep(i, k, uMid)) continue;
      const ctr = lerp(rings[i].c, rings[i + 1].c, 0.5);
      const mode = opts.split ?? 'alt';
      const quad = [A, B, C, D];
      if (mode === 'quad') { faces.push(orient(verts, quad, ctr)); continue; }
      if (mode === 'auto') {
        const n = norm(cross(sub(verts[B].p, verts[A].p), sub(verts[D].p, verts[A].p)));
        const dev = Math.abs(dot(n, sub(verts[C].p, verts[A].p)));
        if (dev < (opts.flatTol ?? 0.18)) { faces.push(orient(verts, quad, ctr)); continue; }
      }
      const diagAC = mode === 'a' ? true : mode === 'b' ? false
        : mode === 'auto' ? len(sub(verts[A].p, verts[C].p)) <= len(sub(verts[B].p, verts[D].p))
        : mode === 'sym' ? (uMid >= 0) === ((i % 2) === 0)
        : (i + k) % 2 === 0;
      if (diagAC) { faces.push(orient(verts, [A, B, C], ctr)); faces.push(orient(verts, [A, C, D], ctr)); }
      else { faces.push(orient(verts, [A, B, D], ctr)); faces.push(orient(verts, [B, C, D], ctr)); }
    }
  }
  const cap = (ri, apex) => {
    const R = rings[ri];
    const a = norm(R.a ?? [0, 1, 0]);
    const ap = add(add(R.c, mul(a, apex)), R.apexOff ?? [0, 0, 0]);
    const ci = verts.length;
    verts.push({ p: ap, uv: [0, ri + (apex < 0 ? -0.5 : 0.5)], apex: true });
    for (let k = 0; k < segs; k++) {
      const k2 = (k + 1) % segs;
      if (opts.keepCap && !opts.keepCap(ri, k)) continue;
      faces.push(orient(verts, [ringIdx[ri][k], ringIdx[ri][k2], ci], add(R.c, mul(a, -apex))));
    }
  };
  if (opts.capTop != null && opts.capTop !== false) cap(0, -Math.abs(opts.capTop));
  if (opts.capBottom != null && opts.capBottom !== false) cap(rings.length - 1, Math.abs(opts.capBottom));
  return { name, verts, faces, patches: [], segs, rings: ringIdx, opts };
}
function orient(verts, idx, inside) {
  const [a, b, c] = idx.map((i) => verts[i].p);
  const n = cross(sub(b, a), sub(c, a));
  const ctr = idx.reduce((s, i) => add(s, verts[i].p), [0, 0, 0]).map((x) => x / idx.length);
  return dot(n, sub(ctr, inside)) < 0 ? idx.slice().reverse() : idx.slice();
}

/** A limb: a tube along joints [{c, rx, rz, f?}] with each ring perpendicular to the path. */
export function limb(name, joints, segs, opts = {}) {
  const rings = joints.map((j, i) => {
    const prev = joints[Math.max(0, i - 1)].c, next = joints[Math.min(joints.length - 1, i + 1)].c;
    return { ...j, a: j.a ?? norm(sub(next, prev)), f: j.f ?? opts.front ?? [0, 0, 1] };
  });
  return tube(name, rings, segs, opts);
}

/** A part from explicit vertices and faces; faces are oriented outward using `inside`. uv optional per vertex. */
export function mesh(name, points, faceList, inside, uvs) {
  const verts = points.map((p, i) => ({ p, uv: uvs ? uvs[i] : [0, 0] }));
  const faces = faceList.map((f) => (inside ? orient(verts, f, inside) : f.slice()));
  return { name, verts, faces, patches: [], segs: 0 };
}

// ---------- 2D helpers for patches ----------
/** Sutherland–Hodgman: clip polygon `poly` (list of [u,v]) by a convex polygon `clip`. */
export function clipPoly(poly, clip) {
  let area = 0;
  for (let i = 0; i < clip.length; i++) { const a = clip[i], b = clip[(i + 1) % clip.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area >= 0 ? 1 : -1;
  let out = poly;
  for (let i = 0; i < clip.length && out.length; i++) {
    const A = clip[i], B = clip[(i + 1) % clip.length];
    const side = (p) => sgn * ((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]));
    const inp = out; out = [];
    for (let j = 0; j < inp.length; j++) {
      const Pp = inp[j], Q = inp[(j + 1) % inp.length];
      const d1 = side(Pp), d2 = side(Q);
      if (d1 >= -1e-9) out.push(Pp);
      if ((d1 >= -1e-9) !== (d2 >= -1e-9)) {
        const t = d1 / (d1 - d2);
        out.push([Pp[0] + (Q[0] - Pp[0]) * t, Pp[1] + (Q[1] - Pp[1]) * t]);
      }
    }
  }
  return out;
}
export const ngon = (cu, cv, ru, rv, n = 8, rot = 0) => Array.from({ length: n }, (_, i) => {
  const t = rot + (2 * Math.PI * i) / n;
  return [cu + ru * Math.cos(t), cv + rv * Math.sin(t)];
});
export const ngonRing = (cu, cv, ru, rv, w, n = 8, rot = 0) => {
  const o = ngon(cu, cv, ru, rv, n, rot), i = ngon(cu, cv, ru - w, rv - w * (rv / ru), n, rot);
  return o.map((p, k) => [p, o[(k + 1) % n], i[(k + 1) % n], i[k]]);
};
/** A stroke in uv along a polyline: quads of width w (u units; v scaled by 1/asp). */
export function band(pts, w, asp = 1) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const d = [b[0] - a[0], (b[1] - a[1]) * asp];
    const l = Math.hypot(d[0], d[1]) || 1;
    const n = [(-d[1] / l) * w / 2, (d[0] / l) * w / 2 / asp];
    out.push([[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]]);
  }
  return out;
}

// ---------- rendering ----------
const fmt = (x) => (Math.round(x * 100) / 100).toString();
const pathD = (pts) => `M${pts.map((p) => fmt(p[0]) + ',' + fmt(p[1])).join('L')}Z`;

/**
 * parts: [{ name, verts, faces, segs, mat (material or (fi, verts, idx) => material|null),
 *           patches: [{ polys | poly, mat, offset?, bias?, opacity?, jitter? }],
 *           layer (draw order group; faces within a layer are depth-sorted), depthBias?, bias?,
 *           fold?: false, outline?: false, jitter? }]
 * view: { yaw, pitch (deg), light [x,y,z] (screen: y down, z toward viewer), amb, dif, seed, jitter,
 *         place: (p) => p (after rotation), foldW, outlineW, seamW, mountain/valley/cut colours+opacities }
 */
export function render(parts, view) {
  const yaw = (view.yaw * Math.PI) / 180, pitch = ((view.pitch ?? 0) * Math.PI) / 180;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const rot = (p) => {
    const x = p[0] * cy + p[2] * sy, z0 = -p[0] * sy + p[2] * cy;
    return [x, p[1] * cp + z0 * sp, -p[1] * sp + z0 * cp];
  };
  const place = view.place ?? ((p) => p);
  const P = (p) => place(rot(p));
  const L = norm(view.light ?? [-0.55, -0.75, 0.6]);
  const amb = view.amb ?? 0.12, dif = view.dif ?? 0.95;
  const R = rng(view.seed ?? 7);
  const items = [];
  const allPts = [];
  const edgeInfo = []; // per part: Map key -> faces
  parts.forEach((part, pi) => {
    const vt = part.verts.map((v) => P(v.p));
    part._vt = vt;
    for (const v of vt) allPts.push(v);
    const jit = part.jitter ?? view.jitter ?? 0.035;
    part._faces = part.faces.map((f, fi) => {
      const pts = f.map((i) => vt[i]);
      let n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
      let flipped = false;
      if (part.twoSided && n[2] < 0) { n = mul(n, -1); flipped = true; }
      const ctr = pts.reduce((s, p) => add(s, p), [0, 0, 0]).map((x) => x / pts.length);
      const vis = n[2] > (part.visEps ?? 1e-3);
      const s = amb + dif * Math.max(0, dot(n, L)) + (part.bias ?? 0) + (flipped ? (part.innerBias ?? 0) : 0);
      return { pi, fi, idx: f, pts, n, ctr, vis, s, j: (R() - 0.5) * 2 * jit, drawn: false };
    });
    const em = new Map();
    part._faces.forEach((f) => {
      for (let i = 0; i < f.idx.length; i++) {
        const a = f.idx[i], b = f.idx[(i + 1) % f.idx.length];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        if (!em.has(key)) em.set(key, []);
        em.get(key).push(f);
      }
    });
    edgeInfo[pi] = em;
    for (const f of part._faces) {
      if (!f.vis) continue;
      const mat = typeof part.mat === 'function' ? part.mat(f.fi, part.verts, f.idx) : part.mat;
      if (!mat) continue;
      f.mat = mat;
      items.push({ layer: part.layer ?? pi, depth: f.ctr[2] + (part.depthBias ?? 0), f, part, pi });
    }
  });
  items.sort((a, b) => a.layer - b.layer || a.depth - b.depth);
  const out = [];
  for (const it of items) {
    const { f, part, pi } = it;
    const col = shade(f.mat, f.s, f.j);
    const fop = part.opacity != null ? ` fill-opacity="${part.opacity}" stroke-opacity="${part.opacity}"` : '';
    out.push(`<path d="${pathD(f.pts)}" fill="${col}"${fop} stroke="${col}" stroke-width="${part.seamW ?? view.seamW ?? 0.3}" stroke-linejoin="round"/>`);
    f.drawn = true;
    // printed details on this facet
    for (const pt of part.patches) {
      if (pt.onlyIf && !pt.onlyIf(f)) continue;
      const polys = pt.polys ?? [pt.poly];
      const uvs = f.idx.map((i) => part.verts[i].uv.slice());
      if (f.idx.some((i) => part.verts[i].apex) && !pt.onCaps) continue;
      const segs = part.segs || 0;
      if (segs) {
        const us = uvs.map((x) => x[0]);
        if (Math.max(...us) - Math.min(...us) > segs / 2) for (const x of uvs) if (x[0] < 0) x[0] += segs;
      }
      const tris = f.idx.length === 3 ? [[0, 1, 2]] : [[0, 1, 2], [0, 2, 3]];
      for (const t of tris) {
        const tuv = t.map((i) => uvs[i]);
        const det = (tuv[1][0] - tuv[0][0]) * (tuv[2][1] - tuv[0][1]) - (tuv[2][0] - tuv[0][0]) * (tuv[1][1] - tuv[0][1]);
        if (Math.abs(det) < 1e-9) continue;
        const m3 = t.map((i) => part.verts[f.idx[i]].p);
        for (const poly of polys) {
          let src = poly;
          if (segs && tuv.some((x) => x[0] > segs / 2)) src = poly.map(([u, v]) => [u < 0 ? u + segs : u, v]);
          const cl = clipPoly(src, tuv);
          if (cl.length < 3) continue;
          const pts3 = cl.map(([u, v]) => {
            const l1 = ((u - tuv[0][0]) * (tuv[2][1] - tuv[0][1]) - (tuv[2][0] - tuv[0][0]) * (v - tuv[0][1])) / det;
            const l2 = ((tuv[1][0] - tuv[0][0]) * (v - tuv[0][1]) - (u - tuv[0][0]) * (tuv[1][1] - tuv[0][1])) / det;
            return add(add(mul(m3[0], 1 - l1 - l2), mul(m3[1], l1)), mul(m3[2], l2));
          });
          const off = pt.offset ?? 0.04;
          const sp2 = pts3.map((p) => add(P(p), mul(f.n, off)));
          const c2 = shade(pt.mat, f.s + (pt.bias ?? 0), pt.jitter === false ? 0 : f.j * 0.6);
          const op = pt.opacity != null ? ` fill-opacity="${pt.opacity}" stroke-opacity="${pt.opacity}"` : '';
          out.push(`<path d="${pathD(sp2)}" fill="${c2}"${op} stroke="${c2}" stroke-width="${pt.seamW ?? 0.18}" stroke-linejoin="round"/>`);
        }
      }
    }
    // this facet's edges: folds (once both sides are drawn) and silhouette cuts
    const em = edgeInfo[pi];
    for (let i = 0; i < f.idx.length; i++) {
      const a = f.idx[i], b = f.idx[(i + 1) % f.idx.length];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const fs = em.get(key).filter((g) => g.vis && g.mat);
      const pa = part._vt[a], pb = part._vt[b];
      const line = (stroke, op, w) => `<path d="M${fmt(pa[0])},${fmt(pa[1])}L${fmt(pb[0])},${fmt(pb[1])}" fill="none" stroke="${stroke}" stroke-opacity="${fmt(op)}" stroke-width="${w}" stroke-linecap="round"/>`;
      if (fs.length === 2) {
        const other = fs[0] === f ? fs[1] : fs[0];
        if (!other.drawn || part.fold === false) continue;
        const convex = dot(f.n, sub(other.ctr, f.ctr)) < 0;
        const ang = Math.acos(Math.max(-1, Math.min(1, dot(f.n, other.n))));
        if (ang < (view.foldMin ?? 0.05)) continue;
        const k = Math.min(1, ang / 0.6);
        if (convex) out.push(line(view.mountain ?? '#fff3dc', (view.mountainOp ?? 0.45) * (0.45 + 0.55 * k), view.foldW ?? 0.4));
        else out.push(line(view.valley ?? '#120a05', (view.valleyOp ?? 0.55) * (0.45 + 0.55 * k), view.foldW ?? 0.4));
      } else if (fs.length === 1 && part.outline !== false) {
        out.push(line(view.cut ?? '#0e0804', view.cutOp ?? 0.6, view.outlineW ?? 0.5));
      }
    }
  }
  return { svg: out.join('\n'), P, rot, allPts };
}

/** Places a figure: renders once to find the extent, then again with soles on `soles` and the body axis
 *  point `axis` (local) on x = `cx`. Returns the second render. */
export function placeAndRender(buildFn, base, { soles, cx, axis }) {
  const first = render(buildFn(), base);
  const maxY = Math.max(...first.allPts.map((p) => p[1]));
  const dx = cx - first.P(axis)[0], dy = soles - maxY;
  const view = { ...base, place: (p) => [p[0] + dx, p[1] + dy, p[2]] };
  const r = render(buildFn(), view);
  r.bounds = {
    minX: Math.min(...r.allPts.map((p) => p[0])), maxX: Math.max(...r.allPts.map((p) => p[0])),
    minY: Math.min(...r.allPts.map((p) => p[1])), maxY: Math.max(...r.allPts.map((p) => p[1])),
  };
  return r;
}

/** The paper-grain filter and the document around the facets. */
export function svgDoc({ viewBox, size, data, comment, body }) {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${v}"`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size[0]}" height="${size[1]}"${attrs}>
<!-- ${comment} -->
<defs>
<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="5" result="n"/>
  <feDiffuseLighting in="n" surfaceScale="0.6" diffuseConstant="1" lighting-color="#fff" result="fib"><feDistantLight azimuth="235" elevation="60"/></feDiffuseLighting>
  <feComposite in="fib" in2="SourceGraphic" operator="arithmetic" k1="0.2" k2="0" k3="0.84" k4="0" result="tex"/>
  <feComposite in="tex" in2="SourceAlpha" operator="in"/>
</filter>
</defs>
<g filter="url(#grain)">
${body}
</g>
</svg>
`;
}
