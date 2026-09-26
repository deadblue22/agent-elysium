// Plays the runner's beats one after another (src/engine: the runner never waits, the view
// does). Each beat is awaited on the virtual clock before the next starts:
//   line     the entry is appended and typed (the speaker's puppet bobs; an inner voice
//            pauses 0.3 s after its name). Then it stops: the continue marker blinks until
//            the player clicks, or presses Space or Enter (§6.5 逐段推进). No stop after the
//            player's own words, or before options (the options are the stop).
//   roll     the dice tumble and settle, then the dice line prints (the result line stops)
//   morale   the hearts flip
//   flag     evidence: a notice line in the log, and the lead card drops onto the right page;
//            it stops there, and on the click the card is filed on the stack on the table
//   stage    the cue plays; a cue listed in PARALLEL starts together with the one before it
//   options  the options are laid out, and the director waits for the player's choice
//   end      the chapter is over: 「第一章 完」 closes the log
// Input: a choice only while the options wait (`idle`); a click, Space or Enter completes the
// line being typed, or else moves on from a stop.
import type { Lang, Line, SkillId } from '../content/schema';
import { SKILLS } from '../content/skills';
import { EVIDENCE_LABELS } from '../content/study';
import { ui } from '../content/ui';
import type { Beat, RollResult, Runner } from '../engine';
import type { LeadText } from '../scene/lead';
import { PARALLEL } from '../scene/cues';
import type { Clock } from './clock';
import type { LogView } from './log';

export interface Stagehands {
  dice: { roll(values: [number, number]): Promise<void> };
  hearts: { to(value: number): Promise<void> };
  lead: { show(text: (lang: Lang) => LeadText): Promise<void>; dismiss(): Promise<void> };
  /** How many leads are found (the stack's hover tip counts them). */
  leads(count: number, total: number): void;
  cues: { play(cue: string): Promise<void>; enter(): Promise<void> };
  /** Which puppet bobs while its line types. */
  speaking(who: 'harry' | 'kim' | null): void;
}

/** Rest after a line that does not stop (ms), after a stop's click, after the dice line. */
const REST = { line: 200, stop: 120, roll: 350, end: 600 };

export class Director {
  /** Waiting for the player's choice. */
  idle = false;
  /** The end beat has played. */
  ended = false;
  /** The stop the director waits at for a click (`line:kim:3`, `notice:1`, …), or null. */
  stop: string | null = null;
  private advance: (() => void) | null = null;
  /** Beats played so far, by kind (`line:narrator`, `stage:snow-start`, `roll`, …), for the keys. */
  private counts = new Map<string, number>();
  private pauses = new Set<string>();
  private resume: (() => void) | null = null;
  /** The pause the director is waiting in (a test harness asked for it), or null. */
  paused: string | null = null;
  onIdle: () => void = () => {};
  onStop: () => void = () => {};

  constructor(private runner: Runner, private clock: Clock, private log: LogView, private hands: Stagehands) {}

  async start() {
    await this.hands.cues.enter();
    await this.play(this.runner.start());
  }

  /** Chooses an option by its number. Returns false if it cannot be chosen now. */
  choose(number: number): boolean {
    if (!this.idle) return false;
    const view = this.runner.options().find((o) => o.number === number);
    if (!view || view.state !== 'enabled') return false;
    this.idle = false;
    this.log.clearOptions();
    this.log.refreshMirror();
    void this.play(this.runner.choose(number));
    return true;
  }

  /**
   * A click, Space or Enter: completes the line being typed, or moves on from a stop.
   * Returns true if it did something.
   */
  proceed(): boolean {
    if (this.log.typing) { this.log.finishLine(); return true; }
    if (this.advance) { const go = this.advance; this.advance = null; go(); return true; }
    return false;
  }

  /** Pause after the beat with this key has played (e.g. `line:narrator:2`, `stage:snow-start`), until resumed. */
  pauseAfter(key: string) { this.pauses.add(key); }
  continue() { this.paused = null; this.resume?.(); this.resume = null; }

  /** Counts a beat of this kind and returns its key: `line:narrator` → `line:narrator:2`. */
  private key(kind: string): string {
    const n = (this.counts.get(kind) ?? 0) + 1;
    this.counts.set(kind, n);
    return `${kind}:${n}`;
  }

  private async checkpoint(key: string) {
    const kind = key.slice(0, key.lastIndexOf(':'));
    for (const k of [kind, key]) {
      if (!this.pauses.has(k)) continue;
      this.pauses.delete(k);
      this.paused = k;
      await new Promise<void>((r) => { this.resume = r; });
    }
  }

  /** Waits for the player: the continue marker blinks until a click, Space or Enter. */
  private async wait(key: string) {
    this.stop = key;
    this.log.setContinue(true);
    this.onStop();
    await new Promise<void>((r) => { this.advance = r; });
    this.stop = null;
    this.log.setContinue(false);
    await this.clock.wait(REST.stop);
  }

  private async play(beats: Beat[]) {
    try {
      for (let i = 0; i < beats.length; i++) {
        const b = beats[i];
        switch (b.kind) {
          case 'line': {
            const key = this.key(`line:${speakerKey(b.line)}`);
            await this.line(b.line);
            if (b.line.speaker !== 'you' && !optionsNext(beats, i)) await this.wait(key);
            else await this.clock.wait(REST.line);
            await this.checkpoint(key);
            break;
          }
          case 'roll': {
            const key = this.key('roll');
            await this.roll(b.roll);
            await this.checkpoint(key);
            break;
          }
          case 'morale': {
            const key = this.key('morale');
            await this.hands.hearts.to(b.value);
            await this.checkpoint(key);
            break;
          }
          case 'flag': {
            const key = this.key(`flag:${b.key}`);
            if (b.evidence) {
              const notice = this.key('notice');
              const count = b.count ?? 0, total = b.total ?? 0, flag = b.key;
              await this.log.append({ kind: 'notice', flag, count, total });
              this.hands.leads(count, total);
              await this.hands.lead.show((lang) => ({ heading: ui.leadTag[lang], lead: EVIDENCE_LABELS[flag]?.[lang] ?? flag, count, total }));
              await this.wait(notice);
              await this.hands.lead.dismiss();
              await this.checkpoint(notice);
            }
            await this.checkpoint(key);
            break;
          }
          case 'stage': {
            const group = [b.cue];
            while (beats[i + 1]?.kind === 'stage' && PARALLEL.has((beats[i + 1] as { cue: string }).cue)) group.push((beats[++i] as { cue: string }).cue);
            const keys = group.map((c) => this.key(`stage:${c}`));
            await Promise.all(group.map((c) => this.hands.cues.play(c)));
            for (const k of keys) await this.checkpoint(k);
            break;
          }
          case 'options': {
            const key = this.key('options');
            await this.log.setOptions(b.options);
            await this.checkpoint(key);
            break;
          }
          case 'end': {
            const key = this.key('end');
            await this.clock.wait(REST.end);
            await this.log.append({ kind: 'end' });
            this.ended = true;
            await this.checkpoint(key);
            break;
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
    if (!this.ended) {
      this.idle = true;
      this.log.refreshMirror();
      this.onIdle();
    }
  }

  private async line(line: Line) {
    const s = line.speaker;
    const who = s === 'you' ? 'harry' : s === 'kim' ? 'kim' : null;
    const voice = (typeof s === 'string' && s in SKILLS) || s === 'necktie';
    await this.log.append({ kind: 'line', line }, {
      pause: voice ? 300 : 0,
      speaking: (on) => this.hands.speaking(on ? who : null),
    });
  }

  private async roll(r: RollResult) {
    await this.clock.wait(150);
    await this.hands.dice.roll(r.dice);
    await this.log.append({ kind: 'check', check: r.check, dice: r.dice, total: r.total, success: r.success });
    await this.clock.wait(REST.roll);
  }
}

/** Whether the next beat the player will see after beat i is the options (flags without evidence show nothing). */
function optionsNext(beats: Beat[], i: number): boolean {
  for (let k = i + 1; k < beats.length; k++) {
    const b = beats[k];
    if (b.kind === 'flag' && !b.evidence) continue;
    return b.kind === 'options';
  }
  return false;
}

/** A line's speaker as a pause key: you, kim, necktie, narrator, a skill id, or 'thing'. */
function speakerKey(line: Line): string {
  const s = line.speaker;
  return typeof s === 'object' ? 'thing' : (s as SkillId | 'you' | 'kim' | 'necktie' | 'narrator');
}
