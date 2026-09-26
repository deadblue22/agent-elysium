// One-time migration aid: mines the legacy CSS 3D board (demo/index.html) for its paper
// art and writes one standalone SVG per paper piece into assets/art/.
//
// The legacy page generates part of its art with a script (wall scallops, books, floor
// boards, ...), so the page is loaded in Chromium and the finished DOM is serialised.
// For every piece this script:
//   - copies in the shared filters/gradients it references (the paper filters stay
//     inside the file and are baked by tools/bake.mjs; nothing runs them at runtime),
//   - removes the hand-painted lighting and shadows (light spills, glows, cast and
//     contact shadows): the Three.js scene produces those with real lights,
//   - crops the viewBox to the piece.
//
// assets/art/*.svg are the sources from now on; re-running this overwrites the pieces it
// generates. The puppets (harry.svg, kim.svg) are drawn by hand and are not touched.
// Usage: node tools/extract-art.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CHROMIUM, CHROMIUM_ARGS } from './chromium.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', 'art');
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- the torn top sheets
// The two visible pages are the book's top sheets with their upper part torn away; the
// base page beneath carries the study's floor, on which the pop-up stands (as in the
// reference pop-up book). Tear lines are in book px (y from the far edge).

/**
 * Page depth: a 670 x 720 page, a little taller than wide, as a real book's. The camera
 * looks at the book from the front at a reader's angle, which foreshortens the depth.
 */
const BOOK_H = 720;
/** The pop-up's fold line on the base page: the wall stands here, at the far edge. */
const FOLD = 10;
/**
 * The rows of the pop-up, from the wall's fold toward the reader. On the left they stand on
 * the floor behind the left sheet's tear: furniture, the desk, the armchair (frontLeft),
 * spaced so the floor and each row's shadow show between them. On the right the room runs on
 * down to the right sheet's low tear: the foreground props (front) stand mid-page, and Harry
 * and Kim stand in front of them, on the rug (src/scene/puppets.ts).
 */
const ROWS = { furniture: 40, desk: 96, frontLeft: 128, front: 250 };
/** The rug on the floor (fold-relative book px): the desk's front stands on its far edge. */
const RUG = { x0: 380, y0: ROWS.desk - 20, x1: 1160, y1: 486 };
/**
 * Mean line of each tear. Left: under the armchair, a little above a quarter of the page,
 * which leaves the log the rest. Right: low, near the tail; only a strip of the sheet is left,
 * and the room's floor runs down to it.
 */
const LEFT_TEAR = 176;
const RIGHT_TEAR = 604;
const TAU = Math.PI * 2;
const TEAR = {
  // left: gently wavy, rising a little toward the gutter
  left: (x) => LEFT_TEAR - 0.02 * (x - 335) + 6 * Math.sin(TAU * x / 310 + 0.6) + 3 * Math.sin(TAU * x / 97 + 1.9) + 1.5 * Math.sin(TAU * x / 37 + 0.3),
  // right: as rough as the left, falling a little toward the fore-edge, with a shallow bay
  // where the paper tore away furthest
  right: (x) => {
    const u = x - 670;
    return RIGHT_TEAR - 16 * Math.exp(-(((u - 300) / 170) ** 2)) + 14 * u / 670
      + 7 * Math.sin(TAU * u / 150 + 0.4) + 4 * Math.sin(TAU * u / 53 + 2.2) + 2.2 * Math.sin(TAU * u / 23 + 1.1);
  },
};
/** feDisplacementMap scale on each tear (the edge moves by up to half of it). */
const DISP = { left: 7, right: 8 };
/** Width of the exposed-core fringe between the torn edge and the printed paper. */
const FRINGE = 7;
/** Depth of the floor sheet from the fold: past the deepest point of the right tear. */
const FLOOR_H = 640;

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const f1 = (n) => +n.toFixed(1);
const tears = Object.fromEntries(['left', 'right'].map((side) => {
  const [x0, x1] = side === 'left' ? [0, 670] : [670, 1340];
  const pts = [];
  for (let x = x0 - 14; x <= x1 + 14; x += 3) pts.push([x, f1(TEAR[side](x))]);
  const inside = pts.filter(([x]) => x >= x0 && x <= x1).map(([, y]) => y);
  const line = 'M' + pts.map(([x, y]) => `${x},${y}`).join(' L');
  const shape = `${line} L${x1 + 14},${BOOK_H + 14} L${x0 - 14},${BOOK_H + 14} Z`;
  // loose fibres along the edge, sticking out of it a little
  const R = mulberry32(side === 'left' ? 61 : 67);
  let whiskers = '';
  for (let x = x0; x < x1; x += 2 + R() * 5) {
    const y = TEAR[side](x), a = -Math.PI / 2 + (R() - 0.5) * 1.6, l = 1.5 + R() * (side === 'left' ? 3.5 : 5);
    whiskers += `M${f1(x)},${f1(y + 1 + R() * 3)} l${f1(Math.cos(a) * l)},${f1(Math.sin(a) * l)} `;
  }
  return [side, {
    pts, line, shape, whiskers,
    min: Math.floor(Math.min(...inside) - DISP[side] / 2),
    max: Math.ceil(Math.max(...inside) + DISP[side] / 2),
  }];
}));
/** The left page's text window starts under the lowest point of its tear, past the fringe. */
const COLUMN_Y0 = tears.left.max + FRINGE + 5;

// Each piece: source svg (selector), viewBox crop, selectors to delete, optional edit(svg, data)
// that runs in the page, optional attributes for the root (data-* ends up in the manifest).
const PIECES = [
  {
    name: 'far', src: '#farSvg', viewBox: [296, 40, 388, 364],
    note: 'Layer 0, outside the window: sky, roofs, the building across the yard, the fire escape, as they were before the snow (the snow is far-snow.svg, laid over it). Hinge at y=400. Cropped below the wall\'s top so it never peeks over it.',
    remove: ['path[stroke="#e8eeef"]', 'path[fill="#d9e0e2"]'],
  },
  {
    name: 'far-snow', src: '#farSvg', viewBox: [296, 40, 388, 364],
    note: 'The snow of the window view, laid over far.svg: caps on the roofs, a line along every rail of the fire escape, one still frame of falling flakes. It fades in when the snow starts (stage cue snow-start).',
    edit: (svg) => {
      const NS = 'http://www.w3.org/2000/svg';
      [...svg.children].forEach((c) => { if (c.tagName !== 'defs') c.remove(); });
      const caps = document.createElementNS(NS, 'g'); caps.setAttribute('filter', 'url(#cutS)');
      document.querySelectorAll('#farSvg path[fill="#d9e0e2"]').forEach((e) => caps.appendChild(e.cloneNode()));
      svg.appendChild(caps);
      document.querySelectorAll('#farSvg path[stroke="#e8eeef"]').forEach((e) => svg.appendChild(e.cloneNode()));
      const cp = document.createElementNS(NS, 'clipPath'); cp.id = 'skyClip';
      cp.innerHTML = '<rect x="300" y="0" width="380" height="400"/>';
      svg.querySelector('defs').appendChild(cp);
      const g = document.createElementNS(NS, 'g'); g.setAttribute('clip-path', 'url(#skyClip)');
      for (const c of document.querySelectorAll('#farSnow circle')) if (+c.getAttribute('cy') < 400) g.appendChild(c.cloneNode());
      svg.appendChild(g);
    },
  },
  {
    name: 'wall', src: '#wallSvg', viewBox: [-12, 6, 1364, 438],
    note: 'Layer 1, the back wall: scalloped cornice edge, wallpaper, window hole, photograph, calendar. Hinge at y=440. The snow on the sill is sill-snow.svg. Damp stains and tide marks at half the M0 board\'s strength.',
    edit: (svg) => {
      svg.querySelectorAll('[filter="url(#blotch)"], [filter="url(#tide)"]').forEach((e) => e.setAttribute('opacity', (+(e.getAttribute('opacity') ?? 1) * 0.5).toFixed(3)));
    },
    remove: ['rect[fill="url(#winSpill)"]', 'rect[fill="url(#candleSpill)"]', 'rect[fill="url(#wallH)"]', 'rect[height="440"][fill="url(#wallV)"]',
      'path[fill="#e2e8e9"]', 'path[d^="M386,316"]'],
  },
  {
    name: 'sill-snow', src: '#wallSvg', viewBox: [376, 304, 220, 16],
    note: 'The untouched snow on the window sill, laid on the wall (same coordinates). It fades in when the snow starts (stage cue snow-start).',
    edit: (svg) => {
      const NS = 'http://www.w3.org/2000/svg';
      const snow = document.querySelector('#wallSvg path[fill="#e2e8e9"]'), line = document.querySelector('#wallSvg path[d^="M386,316"]');
      [...svg.children].forEach((c) => { if (c.tagName !== 'defs') c.remove(); });
      const g = document.createElementNS(NS, 'g'); g.setAttribute('filter', 'url(#cutS)');
      g.appendChild(snow.cloneNode());
      svg.append(g, line.cloneNode());
    },
  },
  {
    name: 'furniture', src: '#furnSvg', viewBox: [40, 48, 1272, 386],
    note: 'Layer 2: bookshelf, curtain, mirror, fireplace, mantel clock, radiator. Hinge at y=430. The clock\'s hands and pendulum (clock-hour, clock-minute, pendulum.svg) and the window\'s casements (casement.svg) are separate pieces laid over it, so they can move.',
    remove: ['rect[fill="url(#coldGlow)"]', 'path[fill="url(#shaft)"]', 'path[fill="url(#shelfDark)"]', 'rect[fill="url(#clockHalo)"]',
      // the clock's hands, their cap, the pendulum rod and bob
      'path[d^="M0,-97 L"]', 'circle[cx="0"][cy="-97"][r="2"]', 'path[d="M0,-60 V-33"]', 'circle[cx="0"][cy="-30"][r="8"]',
      // the open casements and their glass, bars and glint
      'path[d^="M378,86 L334"]', 'path[d^="M592,86 L636"]', 'path[fill="url(#glassG)"]', 'path[d^="M372,168"]', 'path[d^="M345,90"]'],
  },
  {
    name: 'desk', src: '#deskSvg', viewBox: [392, 44, 424, 210],
    note: 'Layer 3: the desk, the dead clockmaker slumped on the ledger, his chair, the candle (the flame is a sprite in the scene). Hinge at y=250.',
    remove: ['circle[fill="url(#warmGlow)"]', 'path[fill="url(#flame)"]', 'path[fill="#fff8e2"]'],
  },
  {
    name: 'front-chair', src: '#frontSvg', viewBox: [88, 166, 210, 168],
    note: 'Layer 4 (foreground), left: the armchair back. Hinge at y=330.',
    edit: (svg) => {
      const grp = svg.querySelector('g[transform="translate(0 160)"]');
      [...svg.children].forEach((c) => { if (c !== grp && c.tagName !== 'defs') c.remove(); });
      [...grp.children].forEach((c, i) => { if (i > 3) c.remove(); }); // chair, two stroke paths, nails
    },
  },
  {
    name: 'front-right', src: '#frontSvg', viewBox: [1066, 28, 312, 306],
    note: 'Layer 4 (foreground), right: stack of books, wastebasket, coat stand with umbrella, overcoat and hat. Hinge at y=330.',
    edit: (svg) => {
      const grp = svg.querySelector('g[transform="translate(0 160)"]');
      [...grp.children].forEach((c, i) => { if (i <= 3) c.remove(); });
    },
  },
  {
    name: 'floor', src: '#floorSvg', viewBox: [-6, -4, 1352, FLOOR_H + 8],
    note: `The study floor on the base page, under the torn top sheets: boards, one large worn rug in the middle of the room (the desk's front stands on its far edge, Harry and Kim on its near half), loose papers, a faint gutter crease. y=0 is the pop-up's fold (book y=${FOLD}); the sheet reaches y=${FLOOR_H}, past the deepest point of the right tear. The strip along each tear line is the torn sheet's soft contact shadow, kept light: the curled sheet edge casts the real one.`,
    attrs: {
      'data-fold': FOLD, 'data-row-furniture': ROWS.furniture, 'data-row-desk': ROWS.desk, 'data-row-front-left': ROWS.frontLeft, 'data-row-front': ROWS.front,
      'data-rug-x0': RUG.x0, 'data-rug-y0': RUG.y0, 'data-rug-x1': RUG.x1, 'data-rug-y1': RUG.y1, 'data-bake-scale': 1.6,
    },
    data: { H: FLOOR_H, rows: ROWS, rug: RUG, tears: [tears.left.pts, tears.right.pts].map((pts) => pts.map(([x, y]) => [x, f1(y - FOLD)])) },
    edit: (svg, d) => {
      // the legacy board's floor script, re-run for the deeper sheet, printed in a faded,
      // dusty paper-toned grey-brown (a print of boards, not dark wood); the rug keeps its colour
      const NS = 'http://www.w3.org/2000/svg';
      const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
      const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const R = mulberry32(3), H = d.H;
      [...svg.children].forEach((c) => c.remove());
      const base = el('g', { filter: 'url(#cutL)' }, svg);
      el('path', { d: `M0,0 H1340 V${H} H0 Z`, fill: '#8a7f71' }, base);
      for (let x = 0; x < 1340; x += 46) {
        const t = R();
        // boards: half the M0 board's colour spread (a quieter print)
        el('rect', { x, y: 0, width: 46, height: H, fill: t < 0.33 ? '#837769' : t < 0.66 ? '#8a7e70' : '#86796b', opacity: 0.92 }, base);
        el('rect', { x, y: 0, width: 1.6, height: H, fill: '#554a3f', opacity: 0.8 }, base);
        for (let j = 10 + R() * 100; j < H; j += 150 + R() * 120) el('rect', { x, y: j.toFixed(1), width: 46, height: 1.4, fill: '#554a3f', opacity: 0.7 }, base);
        for (let k = 0; k < 11; k++) el('rect', { x: (x + 6 + R() * 34).toFixed(1), y: (R() * (H - 20)).toFixed(1), width: 0.8, height: (8 + R() * 20).toFixed(1), fill: '#a69a8a', opacity: 0.17 }, base);
      }
      // one large, faded rug in the middle of the room (the M0 board's colours and borders):
      // the desk's front stands on its far edge, Harry and Kim on its near half; its left end
      // runs on under the left sheet. Fringe on its two short ends.
      const { x0: RX0, y0: RY0, x1: RX1, y1: RY1 } = d.rug;
      const rw = RX1 - RX0, rh = RY1 - RY0, rcx = (RX0 + RX1) / 2, rcy = (RY0 + RY1) / 2;
      const rug = el('g', {}, base);
      el('rect', { x: RX0, y: RY0, width: rw, height: rh, fill: '#5a3226', opacity: 0.9 }, rug);
      el('rect', { x: RX0 + 12, y: RY0 + 10, width: rw - 24, height: rh - 20, fill: 'none', stroke: '#a57a4c', opacity: 0.4, 'stroke-width': 2 }, rug);
      el('rect', { x: RX0 + 30, y: RY0 + 24, width: rw - 60, height: rh - 48, fill: '#2b3148', opacity: 0.8 }, rug);
      el('rect', { x: RX0 + 42, y: RY0 + 34, width: rw - 84, height: rh - 68, fill: 'none', stroke: '#8a4a30', opacity: 0.55, 'stroke-width': 3, 'stroke-dasharray': '6 5' }, rug);
      el('ellipse', { cx: rcx, cy: rcy, rx: rw * 0.17, ry: rh * 0.28, fill: 'none', stroke: '#a57a4c', opacity: 0.4, 'stroke-width': 1.8 }, rug);
      el('ellipse', { cx: rcx, cy: rcy, rx: rw * 0.12, ry: rh * 0.2, fill: '#5a3226', opacity: 0.2 }, rug);
      el('path', { d: `M${rcx - rw * 0.07},${rcy} L${rcx},${rcy - rh * 0.12} L${rcx + rw * 0.07},${rcy} L${rcx},${rcy + rh * 0.12} Z`, fill: 'none', stroke: '#b98a5a', opacity: 0.35, 'stroke-width': 1.4 }, rug);
      // corner lozenges of the field
      for (const [cx, cy] of [[RX0 + 70, RY0 + 58], [RX1 - 70, RY0 + 58], [RX0 + 70, RY1 - 58], [RX1 - 70, RY1 - 58]]) {
        el('path', { d: `M${cx - 16},${cy} L${cx},${cy - 11} L${cx + 16},${cy} L${cx},${cy + 11} Z`, fill: '#8a4a30', opacity: 0.4 }, rug);
      }
      // worn paths: lighter where people walk (from the door side on the right to the desk)
      el('ellipse', { cx: rcx + rw * 0.18, cy: rcy + rh * 0.12, rx: rw * 0.2, ry: rh * 0.22, fill: '#b89b70', opacity: 0.045 }, rug);
      el('ellipse', { cx: rcx - rw * 0.12, cy: RY0 + rh * 0.2, rx: rw * 0.16, ry: rh * 0.14, fill: '#b89b70', opacity: 0.035 }, rug);
      for (let fy = RY0 + 3; fy < RY1 - 3; fy += 5) {
        el('rect', { x: RX0 - 6, y: fy, width: 6, height: 1.4, fill: '#b89b70', opacity: 0.5 }, rug);
        el('rect', { x: RX1, y: fy, width: 6, height: 1.4, fill: '#b89b70', opacity: 0.5 }, rug);
      }
      // loose sheets: behind the rows on the left, scattered across the room on the right
      [[300, 60, -14], [250, 104, 9], [612, 62, 22], [1000, 70, 12], [1230, 112, -11], [860, 150, -8],
        [1060, 196, -24], [742, 216, 14], [1188, 318, 19], [1262, 404, -18], [724, 470, 6], [1004, 540, -9],
        [1150, 560, 16], [840, 590, -20]].forEach((p) => {
        const g = el('g', { transform: `translate(${p[0]} ${p[1]}) rotate(${p[2]})` }, svg);
        el('rect', { x: -15, y: -11, width: 30, height: 22, fill: '#d9d0bb' }, el('g', { filter: 'url(#cutS)' }, g));
        for (let l = 0; l < 4; l++) el('rect', { x: -11, y: -7 + l * 4.5, width: (17 + R() * 5).toFixed(1), height: 0.8, fill: '#5d5445', opacity: 0.6 }, g);
      });
      // a faint gutter crease across the sheet (the base page lies flat; the fold barely shows)
      el('rect', { x: 663, y: 0, width: 14, height: H, fill: '#000', opacity: 0.18, filter: 'url(#soft4)' }, svg);
      el('rect', { x: 669.4, y: 0, width: 1, height: H, fill: '#cdb995', opacity: 0.2 }, svg);
      // contact shadow of each torn top sheet, falling back onto the floor just behind its edge
      const defs = el('defs', {}, svg);
      defs.innerHTML = '<filter id="tearShadow" x="-5%" y="-40%" width="110%" height="180%"><feGaussianBlur stdDeviation="2.6"/></filter>';
      for (const pts of d.tears) {
        const band = 'M' + pts.map(([x, y]) => `${x},${(y - 4).toFixed(1)}`).join(' L') + ' L' + pts.slice().reverse().map(([x, y]) => `${x},${(y + 8).toFixed(1)}`).join(' L') + ' Z';
        el('path', { d: band, fill: '#0b0704', opacity: 0.28, filter: 'url(#tearShadow)' }, svg);
      }
    },
  },
  // the two torn top sheets; the log is painted on the left one, the page number on the right
  ...['left', 'right'].map((side) => ({
    name: `page-${side}`, src: '#pageArt', viewBox: side === 'left' ? [0, 0, 670, BOOK_H] : [670, 0, 670, BOOK_H],
    note: `The ${side} top sheet: its upper part torn away (tear between y=${tears[side].min} and y=${tears[side].max}), a lighter fringe of exposed paper core along the tear with a faint line of thickness inside it; fibre, mottling, foxing, toned edges${side === 'left' ? ' (kept quiet under the text column)' : ''}. Text is painted at runtime.`,
    attrs: { 'data-page-h': BOOK_H, 'data-tear-min': tears[side].min, 'data-tear-max': tears[side].max, 'data-column-y0': COLUMN_Y0 },
    data: { H: BOOK_H, side, shape: tears[side].shape, line: tears[side].line, whiskers: tears[side].whiskers, disp: DISP[side], fringe: FRINGE, seed: side === 'left' ? 17 : 29, colY0: COLUMN_Y0 },
    remove: ['use', 'ellipse[fill="#140c06"]', 'g[fill="#120a05"]', '#hearts', 'path[fill="#a9c0cf"]', 'ellipse[fill="url(#warmGlow)"]',
      'path[d^="M1340,560"]', 'path[d^="M1340,558"]', 'path[d^="M1306,566"]'],
    edit: (svg, d) => {
      const NS = 'http://www.w3.org/2000/svg';
      const defs = svg.querySelector('defs');
      // the M0 board's printed rug under the puppets goes: Harry and Kim stand in the room now,
      // on the floor's rug; their stand tabs are paper in the scene (src/scene/puppets.ts)
      svg.querySelector('g[opacity=".2"]')?.remove();
      svg.querySelectorAll('path[d^="M855,32"], path[d^="M858,326"]').forEach((e) => e.remove());
      // the M0 page was 600 deep: stretch its paper layers to the deeper page
      const k = d.H / 600;
      svg.querySelectorAll('rect[filter="url(#pageTex)"], rect[filter="url(#pageMottle)"], #quietCol > rect:not([filter])').forEach((r) => r.setAttribute('height', d.H));
      const qm = svg.querySelector('#quietCol');
      if (qm) qm.setAttribute('height', d.H);
      const toned = svg.querySelector('rect[stroke="#6b4a26"]');
      if (toned) toned.setAttribute('height', d.H - 3);
      svg.querySelectorAll('#foxing circle').forEach((c) => c.setAttribute('cy', (+c.getAttribute('cy') * k).toFixed(0)));
      svg.querySelectorAll('circle[cx="770"][cy="540"]').forEach((c) => c.setAttribute('cy', 540 + d.H - 600));
      // cleaner, flatter paper (M1 review): the cloudy mottle, the foxing and the stains at
      // about 40% of the M0 board's (the right page, with no text to hide them, a little less),
      // the toned edges softer; the fine fibre (pageTex) stays
      const mottle = svg.querySelector('rect[filter="url(#pageMottle)"]');
      if (mottle) mottle.setAttribute('opacity', d.side === 'left' ? '.25' : '.2');
      svg.querySelectorAll('#foxing circle').forEach((c) => c.setAttribute('opacity', (+(c.getAttribute('opacity') ?? 1) * 0.4).toFixed(3)));
      svg.querySelectorAll('circle[filter="url(#tide)"], circle[cx="770"][cy="540"]').forEach((c) => c.setAttribute('opacity', (+(c.getAttribute('opacity') ?? 1) * 0.4).toFixed(3)));
      const edge = svg.querySelector('rect[stroke="#6b4a26"]');
      if (edge) edge.setAttribute('opacity', '.1');
      // keep the paper texture quiet under the (moved) text window
      const q = svg.querySelector('#quietCol rect[filter]');
      if (q) { q.setAttribute('y', d.colY0 - 8); q.setAttribute('height', d.H + 20 - d.colY0); }
      // the legacy page toning (aged paper, darker toward the edges): ellipse 72% x 78% of each page
      for (const [id, cx, cy, stops] of [
        // (M1 review: the darkening toward the edges at about 60% of the M0 board's)
        ['paperL', 295, 312 * k, '<stop offset="0" stop-color="#e8ddc6"/><stop offset=".55" stop-color="#e2d6bc"/><stop offset=".9" stop-color="#d3c4a7"/><stop offset="1" stop-color="#c6b698"/>'],
        ['paperR', 1018, 276 * k, '<stop offset="0" stop-color="#e6dbc3"/><stop offset=".5" stop-color="#e0d4b9"/><stop offset=".88" stop-color="#d2c3a6"/><stop offset="1" stop-color="#c4b495"/>'],
      ]) {
        const g = document.createElementNS(NS, 'radialGradient');
        g.id = id; g.setAttribute('gradientUnits', 'userSpaceOnUse');
        g.setAttribute('cx', cx); g.setAttribute('cy', cy); g.setAttribute('r', 482);
        g.setAttribute('gradientTransform', `translate(${cx} ${cy}) scale(1 ${0.97 * k}) translate(${-cx} ${-cy})`);
        g.innerHTML = stops;
        defs.appendChild(g);
      }
      // everything printed goes into one group, masked by the torn sheet inset below the fringe
      const content = document.createElementNS(NS, 'g');
      content.setAttribute('mask', 'url(#sheet)');
      content.innerHTML = `<rect x="0" y="0" width="670" height="${d.H}" fill="url(#paperL)"/><rect x="670" y="0" width="670" height="${d.H}" fill="url(#paperR)"/>`;
      [...svg.children].filter((c) => c.tagName !== 'defs').forEach((c) => content.appendChild(c));
      // the tear: low-frequency waviness is in the line itself; the displacement adds the
      // fibrous irregularity. The inner edge (where the printed paper starts) uses its own
      // noise, so the fringe of exposed core varies in width. Filters work in user space.
      const region = `filterUnits="userSpaceOnUse" x="-40" y="-40" width="1420" height="${d.H + 90}" color-interpolation-filters="sRGB"`;
      defs.insertAdjacentHTML('beforeend', `
        <filter id="tearEdge" ${region}>
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" seed="${d.seed}" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="${d.disp}" xChannelSelector="R" yChannelSelector="G" result="shape"/>
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="${d.seed + 3}" result="f"/>
          <feDiffuseLighting in="f" surfaceScale="1.3" diffuseConstant="1" lighting-color="#fff" result="fib"><feDistantLight azimuth="240" elevation="58"/></feDiffuseLighting>
          <feComposite in="fib" in2="shape" operator="arithmetic" k1="0.28" k2="0" k3="0.76" k4="0"/>
        </filter>
        <filter id="tearInner" ${region}>
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="${d.seed + 7}" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="${d.disp * 1.3}" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <mask id="sheet" maskUnits="userSpaceOnUse" x="-40" y="-40" width="1420" height="${d.H + 90}">
          <g transform="translate(0 ${d.fringe})"><g filter="url(#tearInner)"><path d="${d.shape}" fill="#fff"/></g></g>
        </mask>`);
      // the sheet's torn silhouette in the colour of exposed paper core, with loose fibres
      svg.insertAdjacentHTML('beforeend', `<g filter="url(#tearEdge)"><path d="${d.shape}" fill="#ebe1cc"/>`
        + `<path d="${d.whiskers}" stroke="#f1e9d9" stroke-opacity=".55" stroke-width=".6" stroke-linecap="round" fill="none"/></g>`);
      svg.appendChild(content);
      // thickness: a faint darker line just inside the fringe, on the printed paper's edge
      svg.insertAdjacentHTML('beforeend', `<g transform="translate(0 ${d.fringe})"><g filter="url(#tearInner)">`
        + `<path d="${d.line}" stroke="#5a4730" stroke-opacity=".3" stroke-width="1.3" fill="none"/></g></g>`);
    },
  })),
];

/**
 * Quieter paper (M1 review): the shared cut-paper filters as the pieces use them.
 *   cutS, cutL  fibre relief 40% lower (surfaceScale)
 *   cutL        the pigment mottle's contrast halved (grey noise pulled toward the neutral 0.5
 *               of its soft-light blend)
 * The hand-drawn pieces (puppets, M1 props) carry the same values in their own copies.
 */
function tone(svg) {
  return svg
    .replace(/(<filter id="cutS"[\s\S]*?surfaceScale=")1\.3(")/, '$10.78$2')
    .replace(/(<filter id="cutL"[\s\S]*?surfaceScale=")1\.6(")/, '$10.96$2')
    .replace(/(<filter id="cutL"[\s\S]*?result="tM"\/>\s*<feColorMatrix in="tM" type="matrix" values=")1 0 0 0 0 {2}1 0 0 0 0 {2}1 0 0 0 0 {2}0 0 0 0 1(")/,
      '$10.5 0 0 0 0.25  0.5 0 0 0 0.25  0.5 0 0 0 0.25  0 0 0 0 1$2');
}

// tileable wood (the legacy table filter, with stitchTiles so it repeats)
const TABLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 480" width="1600" height="480" data-bake-scale="1">
  <!-- The table: the legacy board's wood filter with stitchTiles, so the tile repeats seamlessly. Two planks per tile.
       Baked at 1x: it only ever shows dimly at the frame edges. -->
  <defs>
    <filter id="wood" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.00125 0.01875" numOctaves="5" seed="12" stitchTiles="stitch" result="g"/>
      <feColorMatrix in="g" type="matrix" values="0.36 0 0 0 -0.01  0.23 0 0 0 -0.008  0.15 0 0 0 -0.006  0 0 0 0 1" result="c"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.003125 0.160417" numOctaves="3" seed="5" stitchTiles="stitch" result="r"/>
      <feColorMatrix in="r" type="matrix" values="0 0 0 0 0.02  0 0 0 0 0.01  0 0 0 0 0.005  -2.2 0 0 0 1.25" result="ra"/>
      <feComposite in="ra" in2="c" operator="atop" result="w"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.9 0.9" numOctaves="2" seed="2" stitchTiles="stitch" result="p"/>
      <feColorMatrix in="p" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.5 0 0 0 .9" result="pa"/>
      <feComposite in="pa" in2="w" operator="atop"/>
    </filter>
  </defs>
  <rect width="1600" height="480" filter="url(#wood)"/>
  <rect y="0" width="1600" height="120" fill="#1a0f09" opacity=".22"/>
  <rect y="360" width="1600" height="120" fill="#1a0f09" opacity=".22"/>
  <rect y="120" width="1600" height="240" fill="#3b2415" opacity=".10"/>
  <g stroke-linecap="butt">
    <path d="M0,120 H1600 M0,360 H1600" stroke="#0a0604" stroke-width="3"/>
    <path d="M0,122.5 H1600 M0,362.5 H1600" stroke="#6b4a31" stroke-opacity=".18"/>
  </g>
</svg>
`;

// six paper die faces in a row (right, left, top, bottom, near, far are assigned in the scene)
function dice() {
  const P = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  let faces = '';
  for (let v = 1; v <= 6; v++) {
    const x0 = (v - 1) * 40;
    let pips = '';
    for (const c of P[v]) {
      const cx = x0 + 10 + ((c - 1) % 3) * 10, cy = 10 + Math.floor((c - 1) / 3) * 10;
      pips += v === 1
        ? `<circle cx="${cx}" cy="${cy}" r="4.4" fill="#9a2a22"/>`
        : `<circle cx="${cx}" cy="${cy}" r="3.4" fill="#2b2320"/><path d="M${cx - 2.2},${cy + 2.4} a3.3,3.3 0 0 0 4.4,0" stroke="#fff6e2" stroke-opacity=".35" stroke-width=".6" fill="none"/>`;
    }
    faces += `<g><rect x="${x0}" y="0" width="40" height="40" fill="#e7dcc2"/>
      <rect x="${x0 + 0.5}" y="0.5" width="39" height="39" fill="none" stroke="#5a4028" stroke-opacity=".42"/>
      <rect x="${x0 + 2}" y="2" width="36" height="36" fill="none" stroke="#5a4028" stroke-opacity=".12" stroke-width="3" filter="url(#edge)"/>
      <g filter="url(#fibre)">${pips}</g></g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 40" width="240" height="40" data-bake-scale="3">
  <!-- Paper dice: faces 1..6 left to right, 40x40 each. Shading comes from the scene's lights. -->
  <defs>
    <filter id="edge" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="fibre" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="tF"/>
      <feDiffuseLighting in="tF" surfaceScale="0.72" diffuseConstant="1" lighting-color="#fff" result="fib"><feDistantLight azimuth="235" elevation="60"/></feDiffuseLighting>
      <feComposite in="fib" in2="SourceGraphic" operator="arithmetic" k1="0.5" k2="0" k3="0.55" k4="0"/>
    </filter>
  </defs>
  <g filter="url(#fibre)"><rect width="240" height="40" fill="#e7dcc2"/></g>
  ${faces}
</svg>
`;
}

const browser = await chromium.launch({ executablePath: CHROMIUM, args: CHROMIUM_ARGS });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
await page.goto(pathToFileURL(join(root, 'demo', 'index.html')).href, { waitUntil: 'load' });

const specs = PIECES.map((p) => ({ ...p, edit: p.edit ? p.edit.toString() : null }));
const out = await page.evaluate((specs) => {
  const NS = 'http://www.w3.org/2000/svg';
  const refRe = /url\(#([^)"']+)\)/g;
  function refsOf(el) {
    const ids = new Set();
    (function walk(e) {
      for (const a of e.attributes || []) {
        for (const m of a.value.matchAll(refRe)) ids.add(m[1]);
        if ((a.name === 'href' || a.name === 'xlink:href') && a.value.startsWith('#')) ids.add(a.value.slice(1));
      }
      for (const c of e.children) walk(c);
    })(el);
    return ids;
  }
  return specs.map((spec) => {
    const svg = document.querySelector(spec.src).cloneNode(true);
    for (const a of ['id', 'class', 'style', 'aria-hidden', 'preserveAspectRatio']) svg.removeAttribute(a);
    if (!svg.querySelector(':scope > defs')) svg.prepend(document.createElementNS(NS, 'defs'));
    for (const sel of spec.remove || []) svg.querySelectorAll(sel).forEach((e) => e.remove());
    if (spec.edit) (0, eval)('(' + spec.edit + ')')(svg, spec.data);
    // pull in every shared def the piece references (transitively)
    const shared = document.createElementNS(NS, 'defs');
    const pending = [...refsOf(svg)];
    while (pending.length) {
      const id = pending.pop();
      if (svg.querySelector('#' + CSS.escape(id)) || shared.querySelector('#' + CSS.escape(id))) continue;
      const def = document.getElementById(id);
      if (!def) throw new Error(spec.name + ': missing def #' + id);
      const copy = def.cloneNode(true);
      shared.appendChild(copy);
      pending.push(...refsOf(copy));
    }
    svg.prepend(shared);
    // drop empty defs
    svg.querySelectorAll('defs').forEach((d) => { if (!d.children.length) d.remove(); });
    const [x, y, w, h] = spec.viewBox;
    svg.setAttribute('xmlns', NS);
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    for (const [k, v] of Object.entries(spec.attrs || {})) svg.setAttribute(k, v);
    svg.prepend(document.createComment(' ' + spec.note + ' '));
    return { name: spec.name, svg: new XMLSerializer().serializeToString(svg) };
  });
}, specs);
await browser.close();

const tidy = (s) => s.replace(/></g, '>\n<');
for (const { name, svg } of out) {
  writeFileSync(join(outDir, `${name}.svg`), tone(tidy(svg)) + '\n');
  console.log(`assets/art/${name}.svg`.padEnd(32), `${(svg.length / 1024).toFixed(1)} KB`);
}
writeFileSync(join(outDir, 'table.svg'), TABLE);
console.log('assets/art/table.svg');
writeFileSync(join(outDir, 'dice.svg'), dice());
console.log('assets/art/dice.svg');
