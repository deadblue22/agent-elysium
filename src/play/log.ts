// The left page as the story plays: entries arrive one by one and are typed out (§6.5: zh
// 55 ms, en 28 ms a character, longer after punctuation; an inner voice waits 0.3 s after its
// name), the log scrolls up to make room for each, and the current options follow, numbered.
// It also keeps the screen-reader mirror (an ordered list; options are real buttons), the
// options' tooltip and the continue marker the director raises while it waits for a click.
import type { Lang, LogEntry } from '../content/schema';
import { skillName } from '../content/skills';
import { ui } from '../content/ui';
import type { OptionView } from '../engine';
import { layoutLog, type Column, type Measurer, type PageLayout } from '../page/layout';
import type { PagePainter } from '../page/painter';
import { ease, type Clock } from './clock';

/** Typewriter speed, ms per character (§6.5). */
export const TYPE_MS: Record<Lang, number> = { zh: 55, en: 28 };
/** Extra ms after punctuation: a comma's breath, a sentence's stop (§6.5). */
const PAUSES: Record<Lang, [RegExp, number][]> = {
  zh: [[/[，、：；]/, 120], [/[。！？…」』]/, 260]],
  en: [[/[,;:]/, 80], [/[.!?]/, 180]],
};
/** Marks that close a clause without a pause of their own: the pause waits until after them. */
const CLOSERS = /[」』”’"')）\]…]/;

/**
 * When each character of `text` shows (ms from the start of typing): one step per character,
 * plus the pause after a comma or a sentence's end. A run of marks (「。」」, 「……」, `."`)
 * pauses once, after its last mark, for its longest pause. English pauses only before a space
 * (so 23:40 and "e.g." type straight through).
 */
export function typeSchedule(text: string, lang: Lang): number[] {
  const chars = [...text], base = TYPE_MS[lang], pauseOf = (c: string) => PAUSES[lang].find(([re]) => re.test(c))?.[1] ?? 0;
  const at: number[] = [];
  let t = 0, pending = 0;
  chars.forEach((c, i) => {
    t += base;
    at.push(t);
    pending = Math.max(pending, pauseOf(c));
    const next = chars[i + 1];
    if (next === undefined) return;
    if (pending && (pauseOf(next) || CLOSERS.test(next))) return; // still inside the run of marks
    if (pending && lang === 'en' && !/\s/.test(next)) { pending = 0; return; }
    t += pending;
    pending = 0;
  });
  return at;
}
/** How long the log takes to scroll a new entry into view. */
const SCROLL_MS = 240;

export class LogView {
  entries: LogEntry[] = [];
  options: OptionView[] = [];
  layout!: PageLayout;
  /** The entry being typed and how much of it shows; null when everything shows. */
  private reveal: { entry: number; chars: number } | null = null;
  /** A fixed page (the style board): these entries exactly, options included. */
  private fixed: LogEntry[] | null = null;

  constructor(
    private painter: PagePainter,
    private measurer: Measurer,
    private col: Column,
    private clock: Clock,
    private list: HTMLOListElement,
    public lang: Lang,
    /** A mirror button was pressed: choose this option number. */
    private onChoose: (number: number) => void,
    /** Whether options can be chosen now (the mirror's buttons are disabled otherwise). */
    private canChoose: () => boolean,
  ) {
    this.relayout();
  }

  /** What the page shows: the log, then the current options as numbered entries. */
  private page(): LogEntry[] {
    if (this.fixed) return this.fixed;
    return [
      ...this.entries,
      ...this.options.map((o): LogEntry => ({ kind: 'option', number: o.number, index: o.index, option: o.option, state: o.state })),
    ];
  }

  private relayout(offset?: number) {
    this.layout = layoutLog(this.page(), this.lang, this.measurer, this.col);
    this.painter.setLayout(this.layout, { reveal: this.reveal, offset });
    this.mirror();
  }

  /** Shows a fixed page, options and all (the style board's moment). */
  showFixed(entries: LogEntry[]) {
    this.fixed = entries;
    this.relayout();
  }

  /** The scroll offset being animated (page px; the painter draws the log this much lower). */
  private offset = 0;

  /**
   * Re-lays the page after it changed at the bottom (an entry or the options came or went):
   * the log is drawn first where it was, then scrolls into place, continuing any scroll still
   * running. Back at the newest line if the reader had scrolled back.
   */
  private shift(): Promise<void> {
    const before = this.layout.height;
    this.clock.cancel('scroll');
    this.painter.scrollToEnd();
    this.layout = layoutLog(this.page(), this.lang, this.measurer, this.col);
    const from = this.offset + this.layout.height - before;
    this.offset = from;
    this.painter.setLayout(this.layout, { reveal: this.reveal, offset: from });
    this.mirror();
    if (Math.abs(from) < 0.5) { this.offset = 0; this.painter.setOffset(0); return Promise.resolve(); }
    return this.clock.tween(SCROLL_MS, (p) => { this.offset = from * (1 - p); this.painter.setOffset(this.offset); }, ease.out, 'scroll');
  }

  /**
   * Appends an entry and types it out. `pause`: ms between the speaker's name and the words.
   * `speaking(on)` is told while the words type (the puppets bob).
   */
  async append(entry: LogEntry, o: { pause?: number; speaking?: (on: boolean) => void } = {}) {
    this.entries.push(entry);
    const idx = this.entries.length - 1;
    this.reveal = { entry: idx, chars: 0 };
    await this.shift();
    const total = this.layout.chars[idx] ?? 0;
    if (total > 0 && entry.kind === 'line') {
      if (o.pause) await this.clock.wait(o.pause);
      o.speaking?.(true);
      const at = typeSchedule(entry.line.text[this.lang], this.lang);
      const T = at[at.length - 1] ?? 0;
      await this.clock.tween(T, (p) => {
        // how many characters are due at this time (the language may change mid-line: that
        // finishes the line, so the count only needs to be right for the language it began in)
        const now = p * T;
        let lo = 0, hi = at.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (at[mid] <= now + 1e-6) lo = mid + 1; else hi = mid; }
        this.setReveal({ entry: idx, chars: p >= 1 ? this.layout.chars[idx] ?? lo : lo });
      }, ease.linear, 'type');
      o.speaking?.(false);
    }
    this.setReveal(null);
  }

  /** Raises or lowers the continue marker (「▼ 继续」) while the director waits for a click. */
  setContinue(on: boolean) { this.painter.setMarker(on); }

  private setReveal(r: { entry: number; chars: number } | null) {
    this.reveal = r;
    this.painter.setReveal(r);
  }

  /** True while a line is being typed. */
  get typing(): boolean { return this.reveal !== null; }

  /** Completes the line being typed (click, Space). */
  finishLine() { this.clock.finish('type'); }

  /** The options now available (they replace any shown before). */
  async setOptions(options: OptionView[]) {
    this.options = options;
    await this.shift();
  }

  /** The options go once one is chosen (the log slides down over them as the next line comes). */
  clearOptions() {
    if (!this.options.length) return;
    this.options = [];
    void this.shift();
  }

  setLang(lang: Lang) {
    if (lang === this.lang) return;
    this.finishLine();
    this.clock.finish('scroll');
    this.offset = 0;
    this.lang = lang;
    this.relayout(0);
  }

  /** The option view for a hit-box index (the option's place in its node). */
  optionAt(index: number): OptionView | undefined {
    return this.options.find((o) => o.index === index);
  }

  /** Refreshes the mirror's buttons (enabled only while options can be chosen). */
  refreshMirror() { this.mirror(); }

  // ---------------------------------------------------------------- the screen-reader mirror

  private mirror() {
    const page = this.page(), plain = this.layout.plain;
    const items = [...this.list.children] as HTMLLIElement[];
    page.forEach((e, i) => {
      let li = items[i];
      if (!li) { li = document.createElement('li'); this.list.append(li); }
      if (e.kind === 'option') {
        let b = li.querySelector('button');
        if (!b || li.childElementCount !== 1) {
          b = document.createElement('button');
          b.type = 'button';
          li.replaceChildren(b);
        }
        b.textContent = plain[i];
        const view = this.options.find((o) => o.number === e.number);
        const greyed = e.state === 'greyed';
        b.disabled = !this.fixed && !this.canChoose();
        b.setAttribute('aria-disabled', String(greyed));
        b.title = view ? tooltipText(view, this.lang).join(' ') : '';
        b.onclick = () => { if (!greyed) this.onChoose(e.number); };
      } else if (li.textContent !== plain[i] || li.firstElementChild) {
        li.textContent = plain[i];
      }
    });
    for (let i = page.length; i < items.length; i++) items[i].remove();
  }
}

/** The tooltip of an option: a check's chance and its modifiers; a greyed option's reason. */
export function tooltipText(o: OptionView, lang: Lang): string[] {
  const lines: string[] = [];
  if (o.state === 'greyed' && o.reason) lines.push(o.reason[lang]);
  const c = o.option.check;
  if (c && o.chance !== undefined) {
    if (o.state !== 'greyed') lines.push(`${ui.chance[lang]} ${Math.round(o.chance * 100)}%`);
    for (const m of o.modifiers ?? []) lines.push(`${m.value >= 0 ? '+' : ''}${m.value} ${m.label[lang]}`);
    if (c.kind === 'red') lines.push(ui.redCheck[lang]);
  }
  return lines;
}

/** Fills the tooltip element for an option (the first line set large), or hides it. */
export function renderTooltip(el: HTMLElement, o: OptionView | undefined, lang: Lang) {
  const lines = o ? tooltipText(o, lang) : [];
  if (!o || !lines.length) { el.hidden = true; return; }
  const c = o.option.check;
  el.replaceChildren(...lines.map((t, i) => {
    const div = document.createElement('div');
    div.textContent = t;
    div.className = i === 0 ? 'head' : c && t === ui.redCheck[lang] ? 'red' : 'mod';
    return div;
  }));
  if (c) {
    const skill = document.createElement('div');
    skill.className = 'skill';
    skill.textContent = skillName(c.skill, c.sense, lang);
    el.prepend(skill);
  }
  el.classList.toggle('greyed', o.state === 'greyed');
  el.hidden = false;
}
