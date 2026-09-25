// Bakes every paper piece in assets/art/*.svg into public/textures/<name>.png
// (transparent background, 2x unless the SVG root says data-bake-scale="n"),
// and writes public/textures/manifest.json with each texture's pixel size, viewBox,
// world size (1 world unit = 100 SVG units, the legacy board's CSS pixels) and any
// data-* attributes of the SVG root as `meta`.
//
// The paper filters (torn edges, fibre, burnt rims) run here, once. The legacy `cutS`
// filter also paints a small drop shadow under each piece: inside a piece that is the
// shadow of a glued-on scrap (books on a shelf) and is kept, but outside the piece's
// silhouette it would be a painted shadow, so the alpha channel is taken from a second
// render with that drop removed. Cast shadows between pieces come from the renderer.
//
// Usage: node tools/bake.mjs [name ...]
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHROMIUM, CHROMIUM_ARGS } from './chromium.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const artDir = join(root, 'assets', 'art');
const outDir = join(root, 'public', 'textures');
mkdirSync(outDir, { recursive: true });
const UNIT = 100;

const only = process.argv.slice(2);
const files = readdirSync(artDir).filter((f) => f.endsWith('.svg') && (!only.length || only.includes(basename(f, '.svg')))).sort();
const manifestPath = join(outDir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { unit: UNIT, textures: {} };
manifest.unit = UNIT;

const browser = await chromium.launch({ executablePath: CHROMIUM, args: CHROMIUM_ARGS });
const contexts = new Map();
async function pageAt(scale) {
  if (!contexts.has(scale)) {
    const ctx = await browser.newContext({ deviceScaleFactor: scale, viewport: { width: 800, height: 600 } });
    contexts.set(scale, await ctx.newPage());
  }
  return contexts.get(scale);
}

async function render(page, svg, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block}</style></head><body>${svg}</body></html>`);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h }, type: 'png' });
}

for (const f of files) {
  const name = basename(f, '.svg');
  const svg = readFileSync(join(artDir, f), 'utf8');
  const vb = svg.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);
  const scale = Number(svg.match(/data-bake-scale="([\d.]+)"/)?.[1] ?? 2);
  const [w, h] = [Math.round(vb[2]), Math.round(vb[3])];
  const page = await pageAt(scale);
  const t0 = Date.now();
  let png = await render(page, svg, w, h);
  if (/<feMergeNode in="drop"\s*\/>/.test(svg)) {
    const alphaPng = await render(page, svg.replace(/<feMergeNode in="drop"\s*\/>/g, ''), w, h);
    const b64 = await page.evaluate(async ([a, b]) => {
      const load = (s) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + s; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(ib, 0, 0); const alpha = x.getImageData(0, 0, c.width, c.height).data;
      x.clearRect(0, 0, c.width, c.height);
      x.drawImage(ia, 0, 0); const img = x.getImageData(0, 0, c.width, c.height); const d = img.data;
      for (let i = 3; i < d.length; i += 4) d[i] = alpha[i];
      x.putImageData(img, 0, 0);
      return c.toDataURL('image/png').split(',')[1];
    }, [png.toString('base64'), alphaPng.toString('base64')]);
    png = Buffer.from(b64, 'base64');
  }
  writeFileSync(join(outDir, `${name}.png`), png);
  const px = [png.readUInt32BE(16), png.readUInt32BE(20)];
  // other data-* attributes on the root travel to the app (e.g. where a torn sheet's tear runs)
  const root = svg.match(/<svg\b[^>]*>/)[0];
  const meta = Object.fromEntries([...root.matchAll(/data-([a-z0-9-]+)="([^"]*)"/g)]
    .filter(([, k]) => k !== 'bake-scale')
    .map(([, k, v]) => [k.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()), Number.isNaN(Number(v)) ? v : Number(v)]));
  manifest.textures[name] = {
    file: `textures/${name}.png`,
    px,
    viewBox: vb,
    world: [+(vb[2] / UNIT).toFixed(4), +(vb[3] / UNIT).toFixed(4)],
    scale,
    ...(Object.keys(meta).length ? { meta } : {}),
  };
  console.log(`${name.padEnd(12)} ${String(px[0]).padStart(5)}x${String(px[1]).padEnd(5)} @${scale}x  ${(png.length / 1024).toFixed(0).padStart(5)} KB  ${Date.now() - t0} ms`);
}
await browser.close();

// drop textures whose source SVG is gone
const sources = new Set(readdirSync(artDir).filter((f) => f.endsWith('.svg')).map((f) => basename(f, '.svg')));
for (const name of Object.keys(manifest.textures)) {
  if (sources.has(name)) continue;
  delete manifest.textures[name];
  rmSync(join(outDir, `${name}.png`), { force: true });
  console.log(`${name.padEnd(12)} removed (no assets/art/${name}.svg)`);
}
manifest.textures = Object.fromEntries(Object.entries(manifest.textures).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const total = Object.keys(manifest.textures).reduce((s, n) => s + readFileSync(join(outDir, `${n}.png`)).length, 0);
console.log(`manifest: ${Object.keys(manifest.textures).length} textures, ${(total / 1048576).toFixed(1)} MB on disk`);
