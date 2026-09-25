// Builds the app, serves dist/, renders it in the preinstalled Chromium with WebGL
// (SwiftShader when there is no GPU), and saves
//   docs/style-board-three.png       the 1600 x 900 frame
//   docs/style-board-three-text.png  a 1:1 crop of the left page
// Fails on console errors or page errors.
//
// Usage: node tools/shot.mjs [--no-build] [--lang en] [--hover]
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { CHROMIUM, CHROMIUM_ARGS } from './chromium.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'zh';
const suffix = lang === 'zh' ? '' : `-${lang}`;

if (!args.includes('--no-build')) {
  const r = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const server = await preview({ root, logLevel: 'warn', preview: { port: 4317, strictPort: false, open: false } });
const url = server.resolvedUrls.local[0];

const browser = await chromium.launch({ executablePath: CHROMIUM, args: CHROMIUM_ARGS });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

const t0 = Date.now();
await page.goto(`${url}?still${lang === 'zh' ? '' : `&lang=${lang}`}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 300_000, polling: 250 });
const info = await page.evaluate(() => window.__shot);
console.log(`ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`renderer: ${info.renderer}  webgl2: ${info.webgl2}  anisotropy: ${info.anisotropy}  ink canvas: ${info.ink.w}x${info.ink.h}`);
console.log('composition (frame px):', JSON.stringify(info.metrics));

mkdirSync(join(root, 'docs'), { recursive: true });
const full = join(root, 'docs', `style-board-three${suffix}.png`);
await page.screenshot({ path: full, timeout: 120_000 });
const r = info.page;
const clip = { x: Math.max(0, Math.floor(r.x)), y: Math.max(0, Math.floor(r.y)), width: Math.ceil(r.w), height: Math.ceil(r.h) };
const crop = join(root, 'docs', `style-board-three-text${suffix}.png`);
await page.screenshot({ path: crop, clip, timeout: 120_000 });
console.log(`saved ${full}\nsaved ${crop} (${clip.width}x${clip.height} at ${clip.x},${clip.y})`);

if (args.includes('--hover')) {
  // hover the current option: it repaints in a brighter rust
  const c = info.column;
  await page.mouse.move(c.x + c.w * 0.3, c.y + c.h - 16);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(root, 'docs', `style-board-three-hover${suffix}.png`), clip, timeout: 120_000 });
  console.log('saved hover crop');
}

await browser.close();
await new Promise((res) => server.httpServer.close(res));

if (problems.length) {
  console.error(`\n${problems.length} console problem(s):\n` + problems.join('\n'));
  process.exit(1);
}
console.log('no console errors or warnings');
