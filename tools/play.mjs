// Plays chapter one headless from study.intro to 「第一章 完」, along a scripted path, with the
// dice forced (?dice=4-5,3-3,5-6), choosing every option through the real input path (its
// number key), and saves
//   docs/m1-intro.png     the opening, once its beats have settled
//   docs/m1-roll.png      the dice mid-tumble (Visual Calculus on the clock)
//   docs/m1-recon-2.png   the reconstruction after marek-blow's narration
//   docs/m1-recon-4.png   the reconstruction after snow-start's narration
//   docs/m1-end.png       the page turned: the blank page and 「第一章 完」
//   docs/m1-end-en.png    the same path in English, its end
// Fails on console errors or page errors, if an option on the path is missing or not in the
// expected state, or if the end beat is never reached.
//
// Usage: node tools/play.mjs [--no-build] [--speed N] [--only zh|en]
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { CHROMIUM, CHROMIUM_ARGS } from './chromium.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const speed = Number(arg('--speed', 3));
const only = arg('--only', null);

/** The path, by option id. `expect`: checks on the options shown after the step. */
const PATH = [
  { id: 'intro.kim' }, { id: 'kim.who' }, { id: 'kim.back' },
  { id: 'intro.clock' }, { id: 'clock.turn', roll: true }, { id: 'clock.lying' }, { id: 'clock.back' },
  { id: 'intro.window' },
  { id: 'window.lean', expect: { greyed: 'window.lean', morale: 3 } }, // 3 + 3 + 2 = 8 < 10: fails, morale 4 → 3
  { id: 'window.back' },
  { id: 'intro.reconstruct', recon: true }, // 5 + 6 + 4 + 2 = 17 ≥ 12
  { id: 'recon.turn', end: true },
];
const DICE = '4-5,3-3,5-6';

if (!args.includes('--no-build')) {
  const r = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
const server = await preview({ root, logLevel: 'warn', preview: { port: 4318, strictPort: false, open: false } });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: CHROMIUM, args: CHROMIUM_ARGS });
mkdirSync(join(root, 'docs'), { recursive: true });

const problems = [];
const T = 900_000; // software WebGL renders a frame in seconds; be patient
const t0 = Date.now();
const since = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`;

async function playthrough(lang) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${lang}] console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[${lang}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`[${lang}] requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  const capture = lang === 'zh';
  const shot = async (name) => {
    // two fresh frames, so the capture shows the state reached, not the frame in flight
    const f = await page.evaluate(() => window.__play.frames);
    await until((f) => window.__play.frames >= f + 2, f);
    const file = join(root, 'docs', `${name}.png`);
    await page.screenshot({ path: file, timeout: T });
    console.log(`  saved docs/${name}.png (${since()})`);
  };
  /** Waits for fn(arg) in the page; stops early on a page error, a console error or the timeout. */
  const until = async (fn, arg) => {
    const start = Date.now(), seen = problems.length;
    for (;;) {
      if (await page.evaluate(fn, arg)) return;
      if (problems.length > seen) throw new Error(`[${lang}] stopped: ${problems[problems.length - 1]}`);
      if (Date.now() - start > T) throw new Error(`[${lang}] timed out waiting for ${fn}`);
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  await page.goto(`${url}?dice=${DICE}&speed=${speed}${lang === 'en' ? '&lang=en' : ''}`, { waitUntil: 'load' });
  await until(() => window.__ready === true && !!window.__play);
  await until(() => window.__play.idle);
  console.log(`[${lang}] opening settled (${since()})`);
  if (capture) await shot('m1-intro');

  for (const step of PATH) {
    const options = await page.evaluate(() => window.__play.options());
    const o = options.find((x) => x.id === step.id);
    if (!o) throw new Error(`[${lang}] option ${step.id} not shown; shown: ${options.map((x) => `${x.number}:${x.id}(${x.state})`).join(' ')}`);
    if (o.state !== 'enabled') throw new Error(`[${lang}] option ${step.id} is ${o.state}`);
    if (step.roll && capture) await page.evaluate(() => window.__play.hold('dice', 0.42));
    if (step.recon && capture) await page.evaluate(() => { window.__play.pauseAfter('line:narrator:2'); window.__play.pauseAfter('line:narrator:4'); });
    await page.keyboard.press(String(o.number));
    console.log(`[${lang}] ${o.number}. ${step.id} (${since()})`);

    if (step.roll && capture) {
      await until(() => window.__play.held === 'dice');
      await shot('m1-roll');
      await page.evaluate(() => window.__play.release());
    }
    if (step.recon && capture) {
      for (const [key, name] of [['line:narrator:2', 'm1-recon-2'], ['line:narrator:4', 'm1-recon-4']]) {
        await until((k) => window.__play.paused === k, key);
        await shot(name);
        await page.evaluate(() => window.__play.resume());
      }
    }
    if (step.end) {
      await until(() => window.__play.ended);
      console.log(`[${lang}] end reached (${since()})`);
      await shot(lang === 'zh' ? 'm1-end' : 'm1-end-en');
      break;
    }
    await until(() => window.__play.idle);
    if (step.expect) {
      const s = await page.evaluate(() => ({ options: window.__play.options(), morale: window.__play.morale }));
      const g = s.options.find((x) => x.id === step.expect.greyed);
      if (!g || g.state !== 'greyed') throw new Error(`[${lang}] expected ${step.expect.greyed} greyed, got ${JSON.stringify(g)}`);
      if (s.morale !== step.expect.morale) throw new Error(`[${lang}] expected morale ${step.expect.morale}, got ${s.morale}`);
      console.log(`[${lang}]    ${step.expect.greyed} greyed, morale ${s.morale}`);
    }
  }
  const flags = await page.evaluate(() => window.__play.flags);
  console.log(`[${lang}] flags: ${flags.join(', ')}`);
  for (const f of ['dog_silent', 'clock_tampered', 'case_reconstructed']) if (!flags.includes(f)) throw new Error(`[${lang}] flag ${f} not set`);
  await page.close();
}

let failed = false;
try {
  for (const lang of only ? [only] : ['zh', 'en']) await playthrough(lang);
} catch (err) {
  console.error(err.message ?? err);
  failed = true;
}
await browser.close();
await new Promise((res) => server.httpServer.close(res));
if (problems.length) {
  console.error(`\n${problems.length} console problem(s):\n` + problems.join('\n'));
  failed = true;
}
if (failed) process.exit(1);
console.log(`played through to the end (${only ?? "zh, en"}), no console errors (${since()})`);
