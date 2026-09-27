// Renders every version of the puppets (docs/cast.md) in the ?still scene, at twice the frame's
// resolution, and saves
//   docs/cast-v0.png … docs/cast-vN.png  the two puppets of each version (v0: harry.svg, kim.svg;
//                                        vN: harry-vN.svg, kim-vN.svg), all with the same crop
//   docs/cast-sheet.png                  the crops side by side, labelled
// The versions are the harry-vN / kim-vN pairs in public/textures/manifest.json (npm run bake).
// Fails on console errors or page errors.
//
// Usage: node tools/cast.mjs [--no-build]
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { CHROMIUM, CHROMIUM_ARGS } from './chromium.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
/** What each version was drawn after (docs/cast.md). */
const LABELS = ['v0 · current (written descriptions)', 'v1 · dialogue portraits', 'v2 · in-game 3D models', 'v3 · cover art', 'v4 · concept art'];

if (!args.includes('--no-build')) {
  const r = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
const names = Object.keys(JSON.parse(readFileSync(join(root, 'public', 'textures', 'manifest.json'), 'utf8')).textures);
const versions = [0, ...names.map((n) => /^harry-v(\d+)$/.exec(n)?.[1]).filter((v) => v && names.includes(`kim-v${v}`)).map(Number).sort((a, b) => a - b)];

const server = await preview({ root, logLevel: 'warn', preview: { port: 4319, strictPort: false, open: false } });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: CHROMIUM, args: CHROMIUM_ARGS });
const problems = [];
/** Opens the still scene with version v; the frame fits the window, so 3200 x 1800 renders it at 2x. */
async function open(v, width) {
  const page = await browser.newPage({ viewport: { width, height: (width * 9) / 16 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`[v${v}] console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[v${v}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`[v${v}] requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  await page.goto(`${url}?still${v ? `&cast=${v}` : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 300_000, polling: 250 });
  return page;
}

// one crop for all: the union of the versions' puppet rects (frame px), with a margin
const rects = [];
for (const v of versions) {
  const page = await open(v, 1600);
  rects.push(await page.evaluate(() => window.__shot.puppets));
  await page.close();
}
const m = 24;
const x0 = Math.max(0, Math.floor(Math.min(...rects.map((r) => r.x)) - m)), y0 = Math.max(0, Math.floor(Math.min(...rects.map((r) => r.y)) - m));
const x1 = Math.min(1600, Math.ceil(Math.max(...rects.map((r) => r.x + r.w)) + m)), y1 = Math.min(900, Math.ceil(Math.max(...rects.map((r) => r.y + r.h)) + m));
const clip = { x: 2 * x0, y: 2 * y0, width: 2 * (x1 - x0), height: 2 * (y1 - y0) };

const files = [];
for (const v of versions) {
  const page = await open(v, 3200);
  const file = join(root, 'docs', `cast-v${v}.png`);
  await page.screenshot({ path: file, clip, timeout: 180_000 });
  files.push([v, file]);
  console.log(`saved ${file} (${clip.width}x${clip.height}, rendered at 2x)`);
  await page.close();
}

// the sheet: three to a row, each crop at its full resolution, labelled
const cells = files.map(([v, f]) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption>${LABELS[v] ?? `v${v}`}</figcaption></figure>`).join('');
const sheet = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
await sheet.setContent(`<!doctype html><html><head><style>
  body{margin:0;padding:16px;background:#1b1512;display:grid;grid-template-columns:repeat(${Math.min(3, files.length)},max-content);gap:16px;width:max-content}
  figure{margin:0} img{display:block;width:${clip.width}px}
  figcaption{font:600 22px/1.4 -apple-system,"Helvetica Neue",Arial,sans-serif;color:#e8dcc4;padding:8px 2px 0}
</style></head><body>${cells}</body></html>`);
await sheet.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
const sheetFile = join(root, 'docs', 'cast-sheet.png');
await sheet.screenshot({ path: sheetFile, fullPage: true, timeout: 120_000 });
console.log(`saved ${sheetFile}`);

await browser.close();
await new Promise((res) => server.httpServer.close(res));
if (problems.length) {
  console.error(`\n${problems.length} console problem(s):\n` + problems.join('\n'));
  process.exit(1);
}
console.log('no console errors or warnings');
