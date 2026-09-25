// Lays out the log on the left page: line breaking (CJK per character with kinsoku,
// Latin per word), indents, colours, the boxed check label and the cursor.
// Everything is in page px (the legacy board's CSS px; the page is 670 x 600).
// The painter scales it to the canvas.
import type { Lang, LogEntry } from '../content/schema';
import { ATTRIBUTE_INK, DIFFICULTY, RESULT, SKILLS, SPEAKERS } from '../content/skills';

/** One page in book px (the legacy board's CSS px); the page is deeper than M0's 600 now. */
export const PAGE = { w: 670, h: 900 };

export interface Rect { x: number; y: number; w: number; h: number }
export interface Column { x0: number; x1: number; y0: number; y1: number }

/** The text window on the left top sheet: from just under its tear down to the near edge. */
export const textColumn = (y0: number): Column => ({ x0: 34, x1: 620, y0, y1: PAGE.h - 20 });
/** Old lines fade out over this many page px as they rise into the tear. */
export const FADE = 60;

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
  rust: '#B04F28',     // past options: #C2562B 88% + #2b1a12
  now: '#A74824',      // the current option: #C2562B 80% + #3a1206
  hover: '#CC5A2A',    // hovered option: brighter rust
  cursor: '#C2562B',
  kask: '#465349',     // grey-green pushed to ink
  teal: '#38625D',     // success
  red: '#8E2A24',      // failure
  dc: '#3D3630',
};

type Family = 'serif' | 'sans' | 'mono';
interface Style { family: Family; size: number; weight: number; color: string; ls: number; stroke: number }

const STACKS: Record<Lang, Record<Family, string>> = {
  zh: {
    serif: '"Elysium Serif SC", "EB Garamond", serif',
    sans: '"Elysium Sans SC", "Inter", sans-serif',
    mono: '"Elysium Mono", "Elysium Mono SC", monospace',
  },
  en: {
    serif: '"EB Garamond", "Elysium Serif SC", serif',
    sans: '"Inter", "Elysium Sans SC", sans-serif',
    mono: '"JetBrains Mono", "Elysium Mono", monospace',
  },
};

interface Metrics { narr: number; mono: number; label: number; tag: number; roll: number; res: number; lineHeight: number }
/**
 * Sized for the screen, not the canvas. Under the camera the text window is foreshortened
 * to 0.57 (just below the fade) .. 0.77 (bottom) screen px per page px vertically, about
 * 1.0-1.1 horizontally; CJK glyphs have about 0.9 em of ink. So 31.5 page px gives
 * narration glyphs of 16-22 px on screen and a 44 page px line pitch of 25-34 px.
 * The M0 board's proportions between the styles are kept.
 */
const SIZES: Record<Lang, Metrics> = {
  zh: { narr: 31.5, mono: 28, label: 22.5, tag: 22.5, roll: 26.5, res: 24, lineHeight: 44 },
  en: { narr: 32, mono: 24.5, label: 18, tag: 18, roll: 23.5, res: 19, lineHeight: 41.5 },
};

const font = (lang: Lang, s: Style) => `${s.weight} ${s.size}px ${STACKS[lang][s.family]}`;

// ---------------------------------------------------------------- tokens

const CLOSE = new Set('。，、：；！？」』）》〉】…’”.,;:!?)]}%·'.split(''));
const OPEN = new Set('「『（《〈【‘“([{'.split(''));
const isCJK = (c: string) => /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/.test(c);
const SENTENCE_END = /[。！？]$/;
/** Full-width closing marks that may hang past the right edge of the column (行尾标点悬挂). */
const HANG = new Set('。，、：；！？」』）》'.split(''));

/** pad: horizontal margins; rule: draw a horizontal rule of this length instead of the text. */
interface Run { text: string; style: Style; glue?: boolean; option?: number; pad?: [number, number]; rule?: number }
interface Atom { text: string; style: Style; space: boolean; glueBefore: boolean; option?: number; pad?: [number, number]; rule?: number }

/** Splits runs into unbreakable atoms. Breaks are allowed before an atom unless glueBefore. */
function atomize(runs: Run[]): Atom[] {
  const atoms: Atom[] = [];
  for (const run of runs) {
    let first = true;
    const push = (text: string, space = false) => {
      atoms.push({ text, style: run.style, space, glueBefore: first && !!run.glue, option: run.option, pad: run.pad, rule: run.rule });
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

function breakLines(lang: Lang, m: Measurer, atoms: Atom[], maxW: number, indent: number,
  styleFor: (a: Atom, line: number) => Style, forced = new Set<number>()): Placed[][] {
  const lines: Placed[][] = [];
  let start = 0;
  while (start < atoms.length) {
    while (start < atoms.length && atoms[start].space) start++;
    if (start >= atoms.length) break;
    const li = lines.length;
    let x = li === 0 ? indent : 0;
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

export function layoutLog(entries: LogEntry[], lang: Lang, m: Measurer, col: Column): PageLayout {
  const S = SIZES[lang];
  const maxW = col.x1 - col.x0;
  const narr: Style = { family: 'serif', size: S.narr, weight: 400, color: INK.log, ls: 0, stroke: 0 };
  const mono = (color: string, stroke: number): Style => ({ family: 'mono', size: S.mono, weight: 400, color, ls: S.mono * 0.02, stroke });
  const label = (color: string): Style => ({ family: 'sans', size: S.label, weight: 600, color, ls: S.label * 0.16, stroke: 0.2 });
  const dash: Style = { family: 'sans', size: S.label, weight: 600, color: INK.log, ls: 0, stroke: 0 };

  const lastChoice = entries.map((e) => e.kind).lastIndexOf('choice');
  const items: DrawItem[] = [];
  const options: PageLayout['options'] = [];
  const plain: string[] = [];
  let cursor: Rect | null = null;
  let y = 0; // laid out from the top, anchored to the bottom of the window afterwards

  entries.forEach((e, idx) => {
    // older entries fade: past choices to 0.75, everything before the last choice to 0.84
    const alpha = e.kind === 'choice' ? 0.75 : idx < lastChoice ? 0.84 : 1;

    if (e.kind === 'check') {
      const lh = S.narr * 1.5;
      y += 3;
      const top = y, mid = top + lh / 2;
      const sk = SKILLS[e.check.skill];
      const tagSkill: Style = { family: 'sans', size: S.tag, weight: 600, color: ATTRIBUTE_INK[sk.attribute], ls: S.tag * 0.12, stroke: 0.2 };
      const tagDc: Style = { family: 'sans', size: S.tag, weight: 600, color: INK.dc, ls: S.tag * 0.05, stroke: 0 };
      const roll: Style = { family: 'mono', size: S.roll, weight: 400, color: INK.log, ls: S.roll * 0.05, stroke: 0.25 };
      const res: Style = { family: 'sans', size: S.res, weight: 600, color: e.success ? INK.teal : INK.red, ls: S.res * 0.3, stroke: 0.2 };
      const skill = sk.name[lang], dc = `[${DIFFICULTY[e.check.dc][lang]} ${e.check.dc}]`;
      const rollText = `${e.dice[0]} + ${e.dice[1]} + ${sk.value} = ${e.total}`;
      const resText = (e.success ? RESULT.success : RESULT.failure)[lang];
      const wSkill = m.width(lang, tagSkill, skill), wDc = m.width(lang, tagDc, dc), gap = S.tag * 0.3;
      const padX = S.tag * 0.62, padT = S.tag * 0.38, padB = S.tag * 0.31, sep = S.narr * 0.64;
      const boxW = 1 + padX + wSkill + gap + wDc + padX + 1, boxH = 1 + padT + S.tag + padB + 1;
      let x = col.x0;
      const box = { x, y: mid - boxH / 2, w: boxW, h: boxH };
      items.push({ t: 'tag', alpha, box });
      const tb = m.baseline(lang, tagSkill, box.y + 1 + padT, S.tag);
      pushText(items, lang, x + 1 + padX, tb, skill, tagSkill, alpha);
      pushText(items, lang, x + 1 + padX + wSkill + gap, tb, dc, tagDc, alpha);
      // the roll and the result follow the tag, or drop to a second row when they do not fit
      const wRoll = m.width(lang, roll, rollText), wRes = m.width(lang, res, resText);
      let rowMid = mid;
      if (boxW + sep + wRoll + sep + wRes > maxW) { x = col.x0 + padX; rowMid = mid + lh * 0.85; }
      else x += boxW + sep;
      pushText(items, lang, x, m.baseline(lang, roll, rowMid - lh / 2, lh), rollText, roll, alpha);
      x += wRoll + sep;
      pushText(items, lang, x, m.baseline(lang, res, rowMid - lh / 2, lh), resText, res, alpha);
      y = rowMid + lh / 2 + 4;
      plain.push(`${skill} ${dc} ${rollText} ${resText}`);
      return;
    }

    let runs: Run[];
    let base: Style = narr;
    let indent = 0;
    let firstBold = false;
    let optionIndex: number | undefined;
    if (e.kind === 'choice' || e.kind === 'option') {
      const now = e.kind === 'option';
      optionIndex = now ? e.index : undefined;
      base = mono(now ? INK.now : INK.rust, now ? 0.5 : 0.3);
      const text = now ? e.option.text[lang] : e.text[lang];
      runs = [
        { text: '>', style: { ...base, ls: 0 }, option: optionIndex },
        { text: ' ' + text, style: base, option: optionIndex },
      ];
      plain.push('> ' + text);
    } else {
      const { speaker, text } = e.line;
      if (speaker === 'narrator') {
        runs = [{ text: text[lang], style: narr }];
        indent = lang === 'zh' ? S.narr * 2 : S.narr * 1.2;
        firstBold = lang === 'zh';
        plain.push(text[lang]);
      } else {
        const name = speaker === 'kask' ? SPEAKERS.kask[lang] : SKILLS[speaker].name[lang];
        const color = speaker === 'kask' ? INK.kask : ATTRIBUTE_INK[SKILLS[speaker].attribute];
        // the M0 board's .who: label, then a dimmed dash with .25em / .45em margins
        // (drawn as a rule so its length does not depend on which font supplies the glyph)
        runs = [
          { text: name.replace(/ /g, '\u00a0'), style: label(color) },
          { text: '—', style: dash, glue: true, pad: [S.label * 0.25, S.label * 0.45], rule: S.label * 0.8 },
          { text: text[lang], style: narr },
        ];
        plain.push(`${name} — ${text[lang]}`);
      }
    }

    const atoms = atomize(runs);
    // NBSP glued the words of a label together; draw it as a plain space
    for (const a of atoms) a.text = a.text.replace(/\u00a0/g, ' ');
    const bold = (s: Style): Style => ({ ...s, weight: 600 });
    const styleFor = (a: Atom, line: number) => (firstBold && line === 0 && a.style === narr ? bold(a.style) : a.style);
    let lines = breakLines(lang, m, atoms, maxW, indent, styleFor);
    const keep = keepLastSentence(lang, m, atoms, lines, maxW, styleFor);
    if (keep !== null) lines = breakLines(lang, m, atoms, maxW, indent, styleFor, new Set([keep]));

    const lh = S.lineHeight;
    lines.forEach((line, li) => {
      const bl = m.baseline(lang, base, y, lh);
      let prevEnd = col.x0 + (li === 0 ? indent : 0);
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
      if (e.kind === 'option' && li === lines.length - 1) {
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
