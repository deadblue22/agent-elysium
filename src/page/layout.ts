// Lays out the log on the left page in the original's dialogue-log format: every line starts
// with its speaker's name (sans, letterspaced; EN in capitals) and an em dash; inner voices
// carry their result tag ([极易：成功]); the dice line is a boxed check tag and the roll;
// the current options are numbered, in rust, with the cursor after the last one.
// Line breaking: CJK per character with kinsoku, Latin per word.
// Everything is in page px (the legacy board's CSS px; the page is 670 x 600).
// The painter scales it to the canvas.
import type { Lang, LogEntry } from '../content/schema';
import { checkTag, resultTag, speakerInk, speakerName } from '../content/skills';

/** One page in book px (the legacy board's CSS px). Must match tools/extract-art.mjs BOOK_H. */
export const PAGE = { w: 670, h: 600 };

export interface Rect { x: number; y: number; w: number; h: number }
export interface Column { x0: number; x1: number; y0: number; y1: number }

/**
 * The text window on the left top sheet: from just under its tear down to the near edge,
 * its right margin (596, 11% of the page from the gutter) kept off the steep part of the
 * pages' curve into the gutter.
 */
export const textColumn = (y0: number): Column => ({ x0: 30, x1: 596, y0, y1: PAGE.h - 20 });
/** Old lines fade out over this many page px as they rise into the tear. */
export const FADE = 44;

export type DrawItem =
  | { t: 'text'; x: number; y: number; text: string; font: string; color: string; alpha: number; ls: number; stroke: number; option?: number; box: Rect }
  | { t: 'tag'; alpha: number; box: Rect }
  | { t: 'rule'; color: string; alpha: number; box: Rect }
  | { t: 'cursor'; color: string; box: Rect };

export interface PageLayout {
  /** Positions with the log scrolled to its newest line (scroll = 0). */
  items: DrawItem[];
  /** Hit boxes of the currently available options (at scroll = 0). */
  options: { index: number; rect: Rect }[];
  cursor: Rect | null;
  /** Plain text of each entry, in order, for the screen-reader mirror. */
  plain: string[];
  /** The visible window (page px): text is clipped above y0 and fades in over `fade` below it. */
  window: { y0: number; y1: number; fade: number } | null;
  /** How far the history can be scrolled back (page px). */
  scrollMax: number;
}

// ---------------------------------------------------------------- style

export const INK = {
  log: '#1E1A16',
  name: '#4F4943',     // one neutral colour for people, objects, places and 你 / YOU
  muted: '#6E655C',    // result tags and the check tag's brackets and tier
  rust: '#B04F28',     // the player's past words: #C2562B 88% + #2b1a12
  now: '#A74824',      // the current options: #C2562B 80% + #3a1206
  hover: '#CC5A2A',    // hovered option: brighter rust
  cursor: '#C2562B',
  red: '#8E2A24',      // red checks
};

type Family = 'serif' | 'sans' | 'mono';
interface Style { family: Family; size: number; weight: number; color: string; ls: number; stroke: number }

/**
 * Font stacks. The sans and mono CJK subsets hold only the characters of their roles
 * (labels, options; tools/subset-fonts.mjs), so the serif subset, which holds every
 * character of the script, is their last resort: a stray character never draws as tofu.
 */
const STACKS: Record<Lang, Record<Family, string>> = {
  zh: {
    serif: '"Elysium Serif SC", "EB Garamond", serif',
    sans: '"Elysium Sans SC", "Inter", "Elysium Serif SC", sans-serif',
    mono: '"JetBrains Mono", "Elysium Mono SC", "Elysium Serif SC", monospace',
  },
  en: {
    serif: '"EB Garamond", "Elysium Serif SC", serif',
    sans: '"Inter", "Elysium Sans SC", "Elysium Serif SC", sans-serif',
    mono: '"JetBrains Mono", "Elysium Mono SC", "Elysium Serif SC", monospace',
  },
};

interface Metrics { narr: number; mono: number; label: number; tag: number; roll: number; res: number; lineHeight: number }
/**
 * Sized for the screen, not the canvas. Under the camera the text window shows at about
 * 0.74 (top) .. 0.82 (bottom) screen px per page px vertically and 0.86-0.9 horizontally;
 * CJK glyphs have about 0.9 em of ink. So 24.5 page px gives narration glyphs of about
 * 16.3-18 px on screen and a 34.4 page px line pitch of 25-28 px (npm run shot prints the
 * measured values). The M0 board's proportions between the styles are kept.
 */
const SIZES: Record<Lang, Metrics> = {
  zh: { narr: 24.5, mono: 22.3, label: 17.8, tag: 17.8, roll: 21.2, res: 19, lineHeight: 34.4 },
  en: { narr: 25, mono: 19.3, label: 14.4, tag: 14.4, roll: 18.2, res: 15.1, lineHeight: 32.8 },
};

const font = (lang: Lang, s: Style) => `${s.weight} ${s.size}px ${STACKS[lang][s.family]}`;

// ---------------------------------------------------------------- tokens

const CLOSE = new Set('。，、：；！？」』）》〉】…’”.,;:!?)]}%·'.split(''));
const OPEN = new Set('「『（《〈【‘“([{'.split(''));
const isCJK = (c: string) => /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/.test(c);
const SENTENCE_END = /[。！？]$/;
/** Full-width closing marks that may hang past the right edge of the column (行尾标点悬挂). */
const HANG = new Set('。，、：；！？」』）》'.split(''));

/**
 * glue: no break before the run; keep: no break inside it; pad: horizontal margins;
 * rule: draw a horizontal rule of this length instead of the text.
 */
interface Run { text: string; style: Style; glue?: boolean; keep?: boolean; option?: number; pad?: [number, number]; rule?: number }
interface Atom { text: string; style: Style; space: boolean; glueBefore: boolean; option?: number; pad?: [number, number]; rule?: number }

/** Splits runs into unbreakable atoms. Breaks are allowed before an atom unless glueBefore. */
function atomize(runs: Run[]): Atom[] {
  const atoms: Atom[] = [];
  for (const run of runs) {
    let first = true;
    const from = atoms.length;
    // a run's margins belong to its first and last atoms
    const push = (text: string, space = false) => {
      atoms.push({ text, style: run.style, space, glueBefore: first ? !!run.glue : !!run.keep, option: run.option, pad: run.pad && first ? [run.pad[0], 0] : undefined, rule: run.rule });
      first = false;
    };
    for (const c of run.text) {
      const prev = atoms[atoms.length - 1];
      const prevOwn = prev && !first ? prev : null; // only merge inside a run (one style per atom)
      if (c === ' ') { push(' ', true); continue; }
      if (CLOSE.has(c) && prevOwn && !prevOwn.space) { prevOwn.text += c; continue; } // never starts a line
      if (prevOwn && !prevOwn.space && OPEN.has(prevOwn.text[prevOwn.text.length - 1])) { prevOwn.text += c; continue; } // never ends one
      if (!isCJK(c) && prevOwn && !prevOwn.space && !isCJK(prevOwn.text[prevOwn.text.length - 1])) { prevOwn.text += c; continue; } // Latin word
      push(c);
    }
    if (run.pad && atoms.length > from) {
      const last = atoms[atoms.length - 1];
      last.pad = [last.pad?.[0] ?? 0, run.pad[1]];
    }
  }
  return atoms;
}

// ---------------------------------------------------------------- measuring

export class Measurer {
  private ctx: CanvasRenderingContext2D;
  private cache = new Map<string, number>();
  constructor() {
    this.ctx = document.createElement('canvas').getContext('2d')!;
  }
  width(lang: Lang, s: Style, text: string): number {
    const f = font(lang, s);
    const key = f + '|' + text;
    let w = this.cache.get(key);
    if (w === undefined) {
      this.ctx.font = f;
      w = this.ctx.measureText(text).width;
      this.cache.set(key, w);
    }
    return w + s.ls * [...text].length;
  }
  /** CSS-like baseline inside a line box of height lh. */
  baseline(lang: Lang, s: Style, top: number, lh: number): number {
    this.ctx.font = font(lang, s);
    const m = this.ctx.measureText('中Hg');
    const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
    return top + (lh - (asc + desc)) / 2 + asc;
  }
}

// ---------------------------------------------------------------- line breaking

interface Placed { atom: Atom; x: number; w: number }

/** indent: where the first line starts; hang: where the following lines start. */
function breakLines(lang: Lang, m: Measurer, atoms: Atom[], maxW: number, indent: number,
  styleFor: (a: Atom, line: number) => Style, forced = new Set<number>(), hang = 0): Placed[][] {
  const lines: Placed[][] = [];
  let start = 0;
  while (start < atoms.length) {
    while (start < atoms.length && atoms[start].space) start++;
    if (start >= atoms.length) break;
    const li = lines.length;
    let x = li === 0 ? indent : hang;
    let end = atoms.length, lastOk = -1;
    const placed: Placed[] = [];
    for (let i = start; i < atoms.length; i++) {
      const a = atoms[i];
      const st = styleFor(a, li);
      const w = (a.rule ?? m.width(lang, st, a.text)) + (a.pad ? a.pad[0] + a.pad[1] : 0);
      const last = a.text[a.text.length - 1];
      const hang = HANG.has(last) ? m.width(lang, st, last) : 0;
      const breakable = i > start && !a.glueBefore;
      if (i > start && forced.has(i)) { end = i; break; }
      if (breakable) lastOk = i;
      if (x + w - hang > maxW + 0.01 && i > start && !a.space) {
        end = breakable ? i : (lastOk > start ? lastOk : i);
        break;
      }
      placed.push({ atom: a, x, w });
      x += w;
    }
    const kept = placed.slice(0, end - start);
    while (kept.length && kept[kept.length - 1].atom.space) kept.pop();
    lines.push(kept);
    start = end;
  }
  return lines;
}

/** CJK: never leave the head of a paragraph's short last sentence dangling at a line end. */
function keepLastSentence(lang: Lang, m: Measurer, atoms: Atom[], lines: Placed[][], maxW: number,
  styleFor: (a: Atom, line: number) => Style): number | null {
  if (lang !== 'zh' || lines.length < 2) return null;
  let s = -1;
  for (let i = atoms.length - 2; i >= 0; i--) if (SENTENCE_END.test(atoms[i].text)) { s = i + 1; break; }
  if (s <= 0) return null;
  const lineOf = (idx: number) => lines.findIndex((line) => line.some((p) => p.atom === atoms[idx]));
  const ls = lineOf(s), le = lineOf(atoms.length - 1);
  if (ls < 0 || ls === le || lines[ls][0].atom === atoms[s]) return null;
  const tailW = atoms.slice(s).reduce((w, a) => w + m.width(lang, styleFor(a, le), a.text), 0);
  return tailW <= maxW ? s : null;
}

// ---------------------------------------------------------------- the log

const lastIndex = <T>(xs: T[], f: (x: T) => boolean) => { for (let i = xs.length - 1; i >= 0; i--) if (f(xs[i])) return i; return -1; };

export function layoutLog(entries: LogEntry[], lang: Lang, m: Measurer, col: Column): PageLayout {
  const S = SIZES[lang];
  const maxW = col.x1 - col.x0;
  const narr: Style = { family: 'serif', size: S.narr, weight: 400, color: INK.log, ls: 0, stroke: 0 };
  const mono = (color: string, stroke: number): Style => ({ family: 'mono', size: S.mono, weight: 400, color, ls: S.mono * 0.02, stroke });
  const label = (color: string): Style => ({ family: 'sans', size: S.label, weight: 600, color, ls: S.label * (lang === 'zh' ? 0.1 : 0.12), stroke: 0.2 });
  const result: Style = { family: 'sans', size: S.label * 0.94, weight: 600, color: INK.muted, ls: S.label * 0.04, stroke: 0 };
  const dash: Style = { family: 'sans', size: S.label, weight: 600, color: INK.log, ls: 0, stroke: 0 };
  const caps = (t: string) => (lang === 'en' ? t.toUpperCase() : t);
  const nbsp = (t: string) => t.replace(/ /g, '\u00a0');

  const isYou = (e: LogEntry) => e.kind === 'line' && e.line.speaker === 'you';
  const lastYou = lastIndex(entries, isYou);
  const lastOption = lastIndex(entries, (e) => e.kind === 'option');
  const items: DrawItem[] = [];
  const options: PageLayout['options'] = [];
  const plain: string[] = [];
  let cursor: Rect | null = null;
  let y = 0; // laid out from the top, anchored to the bottom of the window afterwards

  entries.forEach((e, idx) => {
    // older entries fade: the player's past words to 0.75, everything before the last of them to 0.84
    const alpha = isYou(e) ? 0.75 : idx < lastYou ? 0.84 : 1;

    if (e.kind === 'check') {
      // the dice line: a boxed check tag, then the roll; the result tag rides on the voice's line
      const lh = S.narr * 1.5;
      y += 3;
      const top = y, mid = top + lh / 2;
      const tag = checkTag(e.check, lang);
      const tagMuted: Style = { family: 'sans', size: S.tag, weight: 600, color: INK.muted, ls: S.tag * 0.05, stroke: 0 };
      const tagSkill: Style = { ...tagMuted, color: speakerInk(e.check.skill, INK.name), ls: S.tag * 0.1, stroke: 0.2 };
      const roll: Style = { family: 'mono', size: S.roll, weight: 400, color: INK.log, ls: S.roll * 0.05, stroke: 0.25 };
      const rollText = `${e.dice[0]} + ${e.dice[1]} + ${e.total - e.dice[0] - e.dice[1]} = ${e.total}`;
      const wOpen = m.width(lang, tagMuted, tag.open), wSkill = m.width(lang, tagSkill, tag.skill), wRest = m.width(lang, tagMuted, tag.rest);
      const padX = S.tag * 0.55, padT = S.tag * 0.38, padB = S.tag * 0.31, sep = S.narr * 0.7;
      const boxW = 1 + padX + wOpen + wSkill + wRest + padX + 1, boxH = 1 + padT + S.tag + padB + 1;
      let x = col.x0;
      const box = { x, y: mid - boxH / 2, w: boxW, h: boxH };
      items.push({ t: 'tag', alpha, box });
      const tb = m.baseline(lang, tagSkill, box.y + 1 + padT, S.tag);
      pushText(items, lang, x + 1 + padX, tb, tag.open, tagMuted, alpha);
      pushText(items, lang, x + 1 + padX + wOpen, tb, tag.skill, tagSkill, alpha);
      pushText(items, lang, x + 1 + padX + wOpen + wSkill, tb, tag.rest, tagMuted, alpha);
      // the roll follows the tag, or drops to a second row when it does not fit
      let rowMid = mid;
      if (boxW + sep + m.width(lang, roll, rollText) > maxW) { x = col.x0 + padX; rowMid = mid + lh * 0.85; }
      else x += boxW + sep;
      pushText(items, lang, x, m.baseline(lang, roll, rowMid - lh / 2, lh), rollText, roll, alpha);
      y = rowMid + lh / 2 + 4;
      plain.push(`${tag.open}${tag.skill}${tag.rest} ${rollText}`);
      return;
    }

    let runs: Run[];
    let base: Style = narr;
    let indent = 0, hang = 0;
    let firstBold = false;
    let optionIndex: number | undefined;
    if (e.kind === 'option') {
      // a current option: its number, its check tag if it has one, its words
      optionIndex = e.index;
      base = mono(INK.now, 0.5);
      const num = `${e.number}.`;
      runs = [{ text: num, style: base, option: optionIndex, keep: true }];
      let words = e.option.text[lang];
      if (e.option.check) {
        const t = checkTag(e.option.check, lang);
        const tagText = `${t.open}${t.skill}${t.rest}`;
        runs.push({ text: ' ' + nbsp(tagText), style: e.option.check.kind === 'red' ? mono(INK.red, 0.5) : base, option: optionIndex, keep: true });
        words = `${tagText} ${words}`;
      }
      runs.push({ text: ' ' + e.option.text[lang], style: base, option: optionIndex });
      hang = m.width(lang, base, `${num} `);
      plain.push(`${num} ${words}`);
    } else {
      const { line } = e;
      if (line.speaker === 'narrator') {
        runs = [{ text: line.text[lang], style: narr }];
        indent = lang === 'zh' ? S.narr * 2 : S.narr * 1.2;
        firstBold = lang === 'zh';
        plain.push(line.text[lang]);
      } else {
        // speaker, [result tag], em dash (drawn as a rule so its length does not depend on the font), words
        const name = speakerName(line, lang);
        runs = [{ text: nbsp(caps(name)), style: label(speakerInk(line.speaker, INK.name)), keep: true }];
        const tag = line.result ? resultTag(line.result, lang) : '';
        if (tag) runs.push({ text: nbsp(tag), style: result, glue: true, keep: true, pad: [S.label * 0.4, 0] });
        runs.push({ text: '—', style: dash, glue: true, pad: [S.label * 0.3, S.label * 0.45], rule: S.label * 0.8 });
        // the player's own past words stay in the options' face and rust, dimmed
        if (line.speaker === 'you') base = mono(INK.rust, 0.3);
        runs.push({ text: line.text[lang], style: base });
        plain.push(`${caps(name)}${tag ? ' ' + tag : ''} — ${line.text[lang]}`);
      }
    }

    const atoms = atomize(runs);
    // NBSP glued the words of a label together; draw it as a plain space
    for (const a of atoms) a.text = a.text.replace(/\u00a0/g, ' ');
    const bold = (s: Style): Style => ({ ...s, weight: 600 });
    const styleFor = (a: Atom, line: number) => (firstBold && line === 0 && a.style === narr ? bold(a.style) : a.style);
    let lines = breakLines(lang, m, atoms, maxW, indent, styleFor, undefined, hang);
    const keep = keepLastSentence(lang, m, atoms, lines, maxW, styleFor);
    if (keep !== null) lines = breakLines(lang, m, atoms, maxW, indent, styleFor, new Set([keep]), hang);

    const lh = S.lineHeight;
    lines.forEach((line, li) => {
      const bl = m.baseline(lang, base, y, lh);
      let prevEnd = col.x0 + (li === 0 ? indent : hang);
      for (const p of line) {
        if (p.atom.space) continue;
        const st = styleFor(p.atom, li);
        const x = col.x0 + p.x + (p.atom.pad?.[0] ?? 0);
        if (p.atom.rule) {
          const h = Math.max(1, S.label * 0.07);
          items.push({ t: 'rule', color: st.color, alpha: alpha * 0.55, box: { x, y: bl - S.narr * 0.36 - h / 2, w: p.atom.rule, h } });
          continue;
        }
        pushText(items, lang, x, bl, p.atom.text, st, alpha, p.atom.option);
        prevEnd = col.x0 + p.x + p.w;
      }
      if (idx === lastOption && li === lines.length - 1) {
        const em = base.size;
        cursor = { x: prevEnd + em * 0.35, y: bl + em * 0.2 - em * 1.08, w: em * 0.6, h: em * 1.08 };
        items.push({ t: 'cursor', color: INK.cursor, box: cursor });
      }
      y += lh;
    });
    if (optionIndex !== undefined) {
      const top = y - lines.length * lh;
      options.push({ index: optionIndex, rect: { x: col.x0 - 10, y: top, w: maxW + 20, h: lines.length * lh } });
    }
    y += 2;
  });

  // bottom-anchored: the newest line sits at the bottom of the window; older lines rise
  // toward the tear, fade, and are clipped there (scroll back with the wheel to read them)
  const content = y - 2;
  const shift = col.y1 - content;
  for (const it of items) {
    it.box.y += shift; // the cursor rect is its item's box, so it moves too
    if (it.t === 'text') it.y += shift;
  }
  for (const o of options) o.rect.y += shift;
  const room = col.y1 - col.y0 - FADE * 0.6;
  return { items, options, cursor, plain, window: { y0: col.y0, y1: col.y1, fade: FADE }, scrollMax: Math.max(0, content - room) };
}

function pushText(items: DrawItem[], lang: Lang, x: number, y: number, text: string, s: Style, alpha: number, option?: number) {
  const f = font(lang, s);
  const w = s.size * [...text].length; // generous bbox; exact width is not needed for repaint clipping
  items.push({
    t: 'text', x, y, text, font: f, color: s.color, alpha, ls: s.ls, stroke: s.stroke, option,
    box: { x: x - 2, y: y - s.size * 1.05, w: w + 4, h: s.size * 1.4 },
  });
}

/** Page furniture on the right page: the morale label and the page number. */
export function layoutRightPage(lang: Lang, m: Measurer, moraleLabel: string, heartsTop: number): PageLayout {
  const items: DrawItem[] = [];
  const label: Style = { family: 'sans', size: lang === 'zh' ? 13 : 11, weight: 600, color: '#2B2622', ls: (lang === 'zh' ? 13 : 11) * 0.35, stroke: 0 };
  const w = m.width(lang, label, moraleLabel);
  pushText(items, lang, 1180 - 670 - 12 - w, m.baseline(lang, label, heartsTop + 1, 16), moraleLabel, label, 0.72);
  const pno: Style = { family: 'serif', size: 12, weight: 400, color: '#2B2622', ls: 12 * 0.2, stroke: 0 };
  const pw = m.width(lang, pno, '18');
  pushText(items, lang, PAGE.w - 48 - pw, m.baseline(lang, pno, PAGE.h - 22, 16), '18', pno, 0.45);
  return { items, options: [], cursor: null, plain: [], window: null, scrollMax: 0 };
}
