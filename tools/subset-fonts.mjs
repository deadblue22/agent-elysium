// Writes the self-hosted font subsets to public/fonts, fetched from the Google Fonts css2
// `text=` API (all families SIL OFL 1.1).
//
// The characters come from every string the demo can draw: the content modules
// (src/content/**/*.ts), the chrome in index.html, and the whole chapter-1 script in
// docs/design.md §4.4, so the rest of chapter 1 needs no re-subset. They are split by role:
//   serif (Noto Serif SC 400)   every character: dialogue, objects, places, chrome
//   serif (Noto Serif SC 600)   narration (first lines are set bold)
//   sans  (Noto Sans SC 600)    labels: speaker names, skills, result and check tags, chrome labels,
//                               the play's interface strings (src/content/ui.ts), evidence labels
//   mono  (LXGW WenKai Mono TC) the player's words: options and 你 / YOU lines
//   EB Garamond 400/600, Inter 600, JetBrains Mono 400: every non-CJK character, plus printable ASCII
// The app's font stacks end in the serif subset, so a character missing from a role's
// subset still draws (in the serif) rather than as tofu. Each file's cmap is checked
// against what was asked for.
//
// Usage: node tools/subset-fonts.mjs   (needs curl and network access to Google Fonts)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'fonts');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

// ---------------------------------------------------------------- the corpus

const isCJK = (c) => c.codePointAt(0) >= 0x2e80;
const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
const role = { serif: new Set(), bold: new Set(), sans: new Set(), mono: new Set() };
const add = (r, text) => { for (const c of text) if (c >= ' ') role[r].add(c); };

// 1. the content modules, loaded through Vite so the strings are classified by what they are
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts')) files.push(p);
  }
})(join(root, 'src', 'content'));
const vite = await createServer({ root, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } });
const isText = (v) => v && typeof v === 'object' && typeof v.zh === 'string' && typeof v.en === 'string' && Object.keys(v).length === 2;
const texts = (v) => [v.zh, v.en];
function classify(v, seen = new Set()) {
  if (!v || typeof v !== 'object' || seen.has(v)) return;
  seen.add(v);
  if (isText(v)) { texts(v).forEach((t) => add('serif', t)); return; }
  if (isText(v.text) && 'speaker' in v) {                      // a log line
    if (v.speaker === 'you') texts(v.text).forEach((t) => add('mono', t));
    if (v.speaker === 'narrator') texts(v.text).forEach((t) => add('bold', t));
    if (isText(v.speaker)) texts(v.speaker).forEach((t) => add('sans', t));
  }
  if (isText(v.text) && ('next' in v || 'check' in v || 'requires' in v)) texts(v.text).forEach((t) => add('mono', t)); // an option
  for (const x of Object.values(v)) classify(x, seen);
}
const every = (v, fn) => JSON.stringify(v, (k, x) => (typeof x === 'string' ? (fn(x), x) : x));
for (const f of files) {
  const mod = await vite.ssrLoadModule('/' + relative(root, f).replaceAll('\\', '/'));
  for (const [name, v] of Object.entries(mod)) {
    // skills.ts: names, tiers, results, senses are labels, and appear in options' check tags
    if (/skills\.ts$/.test(f)) every(v, (x) => { add('sans', x); add('mono', x); });
    // chrome: page furniture labels (士气 / MORALE) are set in the sans; so is the play's
    // interface (ui.ts: the check tooltip, the evidence slip's label, the greyed reason), and
    // the evidence labels, which the tooltip lists as modifiers (「+1 指针被拨过」)
    if (name === 'chrome' || name === 'ui' || name === 'EVIDENCE_LABELS') every(v, (x) => add('sans', x));
    classify(v);
  }
}
await vite.close();
// every string in the content files, whatever its role, is at least in the serif
for (const f of files) add('serif', [...readFileSync(f, 'utf8').matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1] ?? m[2]).join(''));

// 2. the chrome in index.html (text between tags, and aria labels)
const html = readFileSync(join(root, 'index.html'), 'utf8').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '');
const chrome = [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1]).join('') + [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]).join('');
add('serif', chrome);
add('sans', chrome);

// 3. the chapter-1 script, docs/design.md §4.4
const design = readFileSync(join(root, 'docs', 'design.md'), 'utf8');
const script = design.slice(design.indexOf('### 4.4'), design.indexOf('## 5.'));
add('serif', script);
let block = '';
for (const raw of script.split('\n')) {
  const line = raw.replace(/^: /, '');
  if (!raw.startsWith(': ')) block = raw.trim();
  // "说话者 [标签] — ……": the speaker and its tags are labels
  const speaker = /^(.{1,40}?) — /.exec(line);
  if (speaker && !/^\d+\./.test(line)) add('sans', speaker[1]);
  for (const tag of line.matchAll(/\[[^\]]*\]|（[^）]*）/g)) add('sans', tag[0]);
  // options ("1. ……") and the player's words ("你 — ……") are in the mono face
  if (/^\d+\. /.test(line) && block === '选项') add('mono', line.replace(/→.*$/, ''));
  if (line.startsWith('你 — ')) add('mono', line);
  // narration
  if (block === '旁白') add('bold', line);
}
for (const tag of script.matchAll(/「\+1 [^」]*」/g)) add('sans', tag[0]); // modifier labels

// ---------------------------------------------------------------- the faces

const all = new Set([...role.serif, ...role.bold, ...role.sans, ...role.mono]);
const latin = [...all].filter((c) => !isCJK(c)).join('') + ASCII;
const FACES = [
  { file: 'serif-sc-400.woff2', family: 'Noto Serif SC', weight: 400, text: [...all].join('') + ASCII },
  { file: 'serif-sc-600.woff2', family: 'Noto Serif SC', weight: 600, text: [...role.bold].join('') + ASCII },
  { file: 'sans-sc-600.woff2', family: 'Noto Sans SC', weight: 600, text: [...role.sans].join('') + ASCII },
  { file: 'mono-sc-400.woff2', family: 'LXGW WenKai Mono TC', weight: 400, text: [...role.mono].filter(isCJK).join('') },
  { file: 'eb-garamond-400.woff2', family: 'EB Garamond', weight: 400, text: latin },
  { file: 'eb-garamond-600.woff2', family: 'EB Garamond', weight: 600, text: latin },
  { file: 'inter-600.woff2', family: 'Inter', weight: 600, text: latin },
  { file: 'jetbrains-mono-400.woff2', family: 'JetBrains Mono', weight: 400, text: latin },
];

const curl = (url) => execFileSync('curl', ['-sS', '-f', '-A', UA, url], { maxBuffer: 1 << 26 });

mkdirSync(out, { recursive: true });
let total = 0, problems = 0;
const keep = new Set(FACES.map((f) => f.file));
for (const f of FACES) {
  const chars = [...new Set(f.text)].filter((c) => c !== ' ').sort().join('');
  const css = curl(`https://fonts.googleapis.com/css2?family=${f.family.replaceAll(' ', '+')}:wght@${f.weight}&text=${encodeURIComponent(' ' + chars)}`).toString();
  const urls = [...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1]);
  if (urls.length !== 1) throw new Error(`${f.family} ${f.weight}: expected one font file, got ${urls.length}`);
  const data = curl(urls[0]);
  const cmap = woff2Cmap(data);
  // characters the font itself does not have (e.g. JetBrains Mono has no curly quotes) fall back by design
  const missing = [...chars].filter((c) => !cmap.has(c.codePointAt(0)));
  writeFileSync(join(out, f.file), data);
  total += data.length;
  console.log(`${f.file.padEnd(26)} ${(data.length / 1024).toFixed(1).padStart(6)} KB  ${String(cmap.size).padStart(4)} glyphs  ${f.family} ${f.weight}${missing.length ? `  not in font: ${missing.join('')}` : ''}`);
  if (isCJKFace(f) && missing.some(isCJK)) problems++;
}
for (const f of readdirSync(out)) if (f.endsWith('.woff2') && !keep.has(f)) { rmSync(join(out, f)); console.log(`${f.padEnd(26)} removed`); }
console.log(`total ${(total / 1024).toFixed(1)} KB; corpus: ${all.size} characters (${[...all].filter(isCJK).length} CJK), sans ${role.sans.size}, mono ${role.mono.size}, bold ${role.bold.size}`);
if (problems) { console.error(`${problems} CJK face(s) are missing requested characters`); process.exit(1); }

function isCJKFace(f) { return f.file.includes('-sc-'); }

// ---------------------------------------------------------------- WOFF2 cmap reader

/** The code points a WOFF2 font maps to a glyph (its cmap, format 4 or 12). */
function woff2Cmap(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a WOFF2 file');
  const numTables = buf.readUInt16BE(12), compressed = buf.readUInt32BE(20);
  let p = 48, stream = 0, cmapAt = -1, cmapLen = 0;
  const base128 = () => { let v = 0; for (let i = 0; i < 5; i++) { const b = buf[p++]; v = v * 128 + (b & 0x7f); if (!(b & 0x80)) break; } return v; };
  for (let i = 0; i < numTables; i++) {
    const flags = buf[p++], tagIndex = flags & 0x3f, version = flags >> 6;
    if (tagIndex === 63) p += 4;
    const orig = base128();
    const transformed = tagIndex === 10 || tagIndex === 11 ? version === 0 : version !== 0;
    const len = transformed ? base128() : orig;
    if (tagIndex === 0) { cmapAt = stream; cmapLen = len; }
    stream += len; // tables follow each other in the decompressed stream without padding
  }
  if (cmapAt < 0) throw new Error('no cmap');
  const t = brotliDecompressSync(buf.subarray(p, p + compressed)).subarray(cmapAt, cmapAt + cmapLen);
  const u16 = (o) => t.readUInt16BE(o), u32 = (o) => t.readUInt32BE(o), s16 = (o) => t.readInt16BE(o);
  const records = [];
  for (let i = 0; i < u16(2); i++) records.push({ pid: u16(4 + 8 * i), eid: u16(6 + 8 * i), off: u32(8 + 8 * i) });
  const pick = records.find((r) => u16(r.off) === 12) ?? records.find((r) => u16(r.off) === 4);
  const set = new Set();
  if (!pick) return set;
  const o = pick.off;
  if (u16(o) === 12) {
    for (let g = 0, n = u32(o + 12); g < n; g++) {
      const start = u32(o + 16 + 12 * g), end = u32(o + 20 + 12 * g);
      for (let c = start; c <= end; c++) set.add(c);
    }
    return set;
  }
  const segs = u16(o + 6) / 2, ends = o + 14, starts = ends + 2 * segs + 2, deltas = starts + 2 * segs, ranges = deltas + 2 * segs;
  for (let s = 0; s < segs; s++) {
    const start = u16(starts + 2 * s), end = u16(ends + 2 * s), delta = s16(deltas + 2 * s), range = u16(ranges + 2 * s);
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let g = range === 0 ? (c + delta) & 0xffff : u16(ranges + 2 * s + range + 2 * (c - start));
      if (range !== 0 && g !== 0) g = (g + delta) & 0xffff;
      if (g !== 0) set.add(c);
    }
  }
  return set;
}
