// Plays chapter one headless from study.intro to 「第一章 完」, along a scripted path, with the
// dice forced (?dice=4-5,3-3,5-6), the way a player would: every option is chosen with its
// number key, and every stop (the blinking 「▼ 继续」 after a paragraph, a new-lead card) is
// passed with Space. Saves
//   docs/m1-intro.png        the opening, at its options
//   docs/m1-hover-kim.png    the hover tip on Kim
//   docs/m1-lead.png         the first new-lead card, with the continue marker
//   docs/m1-roll.png         the dice mid-tumble (Visual Calculus on the clock)
//   docs/m1-hover-clock.png  the hover tip on the clock, once the hands are known to be moved
//   docs/m1-recon-2.png      the reconstruction at marek-blow's narration
//   docs/m1-recon-4.png      the reconstruction at snow-start's narration
//   docs/m1-end.png          the page turned: the blank page and 「第一章 完」
//   docs/m1-end-en.png       the same path in English, its end
// Fails on console errors or page errors, if an option on the path is missing or not in the
// expected state, if a hover tip does not show, or if the end beat is never reached.
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

/**
 * The path, by option id. `before`: captures at the options before choosing (hover tips);
 * `expect`: checks on the options shown after the step.
 */
const PATH = [
  { id: 'intro.kim', before: [['kim', 'm1-hover-kim']] },
  { id: 'kim.who' }, // the dog didn't bark: the first new lead
  { id: 'kim.back' },
  { id: 'intro.clock' }, { id: 'clock.turn', roll: true }, // 4 + 5 + 3 = 12: the hands were moved
  { id: 'clock.lying', before: [['clock', 'm1-hover-clock']] }, { id: 'clock.back' },
  { id: 'intro.window' },
  { id: 'window.lean', expect: { greyed: 'window.lean', morale: 3 } }, // 3 + 3 + 2 = 8 < 10: fails, morale 4 → 3
  { id: 'window.back' },
  { id: 'intro.reconstruct' }, // 5 + 6 + 4 + 2 = 17 ≥ 12
  { id: 'recon.turn', end: true },
];
/** Captures taken at a stop, by the stop's key. */
const AT_STOP = { 'notice:1': 'm1-lead', 'line:narrator:2': 'm1-recon-2', 'line:narrator:4': 'm1-recon-4' };
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
  /** Waits for fn(arg) in the page; stops early on a page error, a console error or the timeout. */
  const until = async (fn, arg) => {
    const start = Date.now();
    for (;;) {
      if (problems.length) throw new Error(`[${lang}] stopped: ${problems[problems.length - 1]}`);
      if (await page.evaluate(fn, arg)) return;
      if (Date.now() - start > T) throw new Error(`[${lang}] timed out waiting for ${fn}`);
      await new Promise((r) => setTimeout(r, 250));
    }
  };
  const shot = async (name) => {
    // two fresh frames, so the capture shows the state reached, not the frame in flight
    const f = await page.evaluate(() => window.__play.frames);
    await until((f) => window.__play.frames >= f + 2, f);
    await page.screenshot({ path: join(root, 'docs', `${name}.png`), timeout: T });
    console.log(`  saved docs/${name}.png (${since()})`);
  };
  /** Presses Space at every stop until `done` holds (capturing the stops listed in AT_STOP). */
  const advance = async (done) => {
    for (;;) {
      const s = await page.evaluate(() => ({ stop: window.__play.stop, idle: window.__play.idle, ended: window.__play.ended }));
      if (await page.evaluate(done)) return;
      if (s.stop) {
        if (capture && AT_STOP[s.stop]) await shot(AT_STOP[s.stop]);
        await page.keyboard.press('Space');
        await until((k) => window.__play.stop !== k, s.stop);
        continue;
      }
      if (problems.length) throw new Error(`[${lang}] stopped: ${problems[problems.length - 1]}`);
      await new Promise((r) => setTimeout(r, 250));
    }
  };
  /** Hovers a stage object, waits for its tip, captures, and moves the pointer away again. */
  const hover = async (key, name) => {
    let p = await page.evaluate((k) => window.__play.hotspot(k), key);
    await page.mouse.move(p.x, p.y);
    await page.evaluate(() => window.__play.snapCamera()); // the parallax would move it from under the pointer
    p = await page.evaluate((k) => window.__play.hotspot(k), key);
    await page.mouse.move(p.x + 1, p.y + 1);
    await until((k) => window.__play.hover === k, key);
    await shot(name);
    await page.evaluate(() => {
      for (const id of ['gl', 'frame']) document.getElementById(id).dispatchEvent(new PointerEvent('pointerleave'));
      window.__play.snapCamera();
    });
  };

  await page.goto(`${url}?dice=${DICE}&speed=${speed}${lang === 'en' ? '&lang=en' : ''}`, { waitUntil: 'load' });
  await until(() => window.__ready === true && !!window.__play);
  await advance(() => window.__play.idle);
  console.log(`[${lang}] opening settled (${since()})`);
  if (capture) await shot('m1-intro');

  for (const step of PATH) {
    if (capture) for (const [key, name] of step.before ?? []) await hover(key, name);
    const options = await page.evaluate(() => window.__play.options());
    const o = options.find((x) => x.id === step.id);
    if (!o) throw new Error(`[${lang}] option ${step.id} not shown; shown: ${options.map((x) => `${x.number}:${x.id}(${x.state})`).join(' ')}`);
    if (o.state !== 'enabled') throw new Error(`[${lang}] option ${step.id} is ${o.state}`);
    if (step.roll && capture) await page.evaluate(() => window.__play.hold('dice', 0.42));
    await page.keyboard.press(String(o.number));
    console.log(`[${lang}] ${o.number}. ${step.id} (${since()})`);

    if (step.roll && capture) {
      await until(() => window.__play.held === 'dice');
      await shot('m1-roll');
      await page.evaluate(() => window.__play.release());
    }
    if (step.end) {
      await advance(() => window.__play.ended);
      console.log(`[${lang}] end reached (${since()})`);
      await shot(lang === 'zh' ? 'm1-end' : 'm1-end-en');
      break;
    }
    await advance(() => window.__play.idle);
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
console.log(`played through to the end (${only ?? 'zh, en'}), no console errors (${since()})`);
