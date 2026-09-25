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
// assets/art/*.svg are the sources from now on; re-running this overwrites them.
// Usage: node tools/extract-art.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CHROMIUM, CHROMIUM_ARGS } from './chromium.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', 'art');
mkdirSync(outDir, { recursive: true });

// Each piece: source svg (selector), viewBox crop, selectors to delete, optional edit (runs in page).
const PIECES = [
  {
    name: 'far', src: '#farSvg', viewBox: [296, 40, 388, 364],
    note: 'Layer 0, outside the window: sky, roofs, the building across the yard, fire escape, snow. Hinge at y=400. Cropped below the wall\'s top so it never peeks over it.',
    edit: (svg) => {
      // bake one static tile of the falling snow that the legacy page animated
      const NS = 'http://www.w3.org/2000/svg';
      const defs = svg.querySelector('defs');
      const cp = document.createElementNS(NS, 'clipPath'); cp.id = 'skyClip';
      cp.innerHTML = '<rect x="300" y="0" width="380" height="400"/>'; defs.appendChild(cp);
      const g = document.createElementNS(NS, 'g'); g.setAttribute('clip-path', 'url(#skyClip)');
      for (const c of document.querySelectorAll('#farSnow circle')) if (+c.getAttribute('cy') < 400) g.appendChild(c.cloneNode());
      svg.appendChild(g);
    },
  },
  {
    name: 'wall', src: '#wallSvg', viewBox: [-12, 6, 1364, 438],
    note: 'Layer 1, the back wall: scalloped cornice edge, wallpaper, window hole, photograph, calendar. Hinge at y=440.',
    remove: ['rect[fill="url(#winSpill)"]', 'rect[fill="url(#candleSpill)"]', 'rect[fill="url(#wallH)"]', 'rect[height="440"][fill="url(#wallV)"]'],
  },
  {
    name: 'furniture', src: '#furnSvg', viewBox: [40, 48, 1272, 386],
    note: 'Layer 2: bookshelf, casements and curtain, mirror, fireplace, mantel clock (23:40), radiator. Hinge at y=430.',
    remove: ['rect[fill="url(#coldGlow)"]', 'path[fill="url(#shaft)"]', 'path[fill="url(#shelfDark)"]', 'rect[fill="url(#clockHalo)"]'],
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
    name: 'floor', src: '#floorSvg', viewBox: [-6, -4, 1352, 134],
    note: 'The study floor: a flat sheet on the pages along the fold (boards, rug, loose papers, gutter crease). Lies on the page.',
    remove: ['rect[fill="url(#floorFade)"]', 'path[fill="#b4c8d6"]', 'ellipse[fill="url(#warmGlow)"]', 'g[fill="#050303"]', ':scope > path[filter="url(#soft10)"]'],
  },
  {
    name: 'villon', src: '.pup.villon svg', viewBox: [0, 0, 120, 200],
    note: 'Detective August Villon, profile puppet. Soles at y=196.5.',
    remove: ['circle[fill="url(#ember)"]'],
  },
  {
    name: 'kask', src: '.pup.kask svg', viewBox: [0, 0, 110, 190],
    note: 'Lieutenant Elena Kask, profile puppet. Soles at y=186.5.',
  },
  {
    name: 'hearts', src: '#pageArt', viewBox: [1184, 130, 136, 36],
    note: 'Morale: four paper hearts, the last one gone pale. Lies on the right page.',
    edit: (svg) => {
      const h = svg.querySelector('#hearts');
      [...svg.children].forEach((c) => { if (c.tagName !== 'defs') c.remove(); });
      svg.querySelectorAll('defs > *').forEach((d) => d.remove());
      svg.appendChild(h);
    },
  },
  ...['left', 'right'].map((side) => ({
    name: `page-${side}`, src: '#pageArt', viewBox: side === 'left' ? [0, 0, 670, 600] : [670, 0, 670, 600],
    note: `The ${side} page's paper: fibre, mottling, foxing, toned edges${side === 'right' ? ', the faint printed rug and the puppets\' stand tabs' : ' (kept quiet under the text column)'}. Text is painted at runtime.`,
    remove: ['use', 'ellipse[fill="#140c06"]', 'g[fill="#120a05"]', '#hearts', 'path[fill="#a9c0cf"]', 'ellipse[fill="url(#warmGlow)"]',
      'path[d^="M1340,560"]', 'path[d^="M1340,558"]', 'path[d^="M1306,566"]'],
    edit: (svg) => {
      const NS = 'http://www.w3.org/2000/svg';
      const defs = svg.querySelector('defs');
      // the legacy page toning (aged paper, darker toward the edges): ellipse 72% x 78% of each page
      for (const [id, cx, cy, stops] of [
        ['paperL', 295, 312, '<stop offset="0" stop-color="#e8ddc6"/><stop offset=".55" stop-color="#ded1b5"/><stop offset=".9" stop-color="#c8b797"/><stop offset="1" stop-color="#b5a383"/>'],
        ['paperR', 1018, 276, '<stop offset="0" stop-color="#e6dbc3"/><stop offset=".5" stop-color="#dccfb2"/><stop offset=".88" stop-color="#c8b797"/><stop offset="1" stop-color="#b3a180"/>'],
      ]) {
        const g = document.createElementNS(NS, 'radialGradient');
        g.id = id; g.setAttribute('gradientUnits', 'userSpaceOnUse');
        g.setAttribute('cx', cx); g.setAttribute('cy', cy); g.setAttribute('r', 482);
        g.setAttribute('gradientTransform', `translate(${cx} ${cy}) scale(1 0.97) translate(${-cx} ${-cy})`);
        g.innerHTML = stops;
        defs.appendChild(g);
      }
      const base = document.createElementNS(NS, 'g');
      base.innerHTML = '<rect x="0" y="0" width="670" height="600" fill="url(#paperL)"/><rect x="670" y="0" width="670" height="600" fill="url(#paperR)"/>';
      defs.after(base);
    },
  })),
  {
    name: 'stack', src: '#stackSvg', viewBox: [0, 0, 1344, 20],
    note: 'The page block seen from the fore-edge.',
  },
];

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
      <feDiffuseLighting in="tF" surfaceScale="1.2" diffuseConstant="1" lighting-color="#fff" result="fib"><feDistantLight azimuth="235" elevation="60"/></feDiffuseLighting>
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
    if (spec.edit) (0, eval)('(' + spec.edit + ')')(svg);
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
    svg.prepend(document.createComment(' ' + spec.note + ' '));
    return { name: spec.name, svg: new XMLSerializer().serializeToString(svg) };
  });
}, specs);
await browser.close();

const tidy = (s) => s.replace(/></g, '>\n<');
for (const { name, svg } of out) {
  writeFileSync(join(outDir, `${name}.svg`), tidy(svg) + '\n');
  console.log(`assets/art/${name}.svg`.padEnd(32), `${(svg.length / 1024).toFixed(1)} KB`);
}
writeFileSync(join(outDir, 'table.svg'), TABLE);
console.log('assets/art/table.svg');
writeFileSync(join(outDir, 'dice.svg'), dice());
console.log('assets/art/dice.svg');
