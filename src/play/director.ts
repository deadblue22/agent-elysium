// Plays the runner's beats one after another (src/engine: the runner never waits, the view
// does). Each beat is awaited on the virtual clock before the next starts:
//   line     the entry is appended and typed (the speaker's puppet bobs; an inner voice
//            pauses 0.3 s after its name), then a short rest (longer after narration)
//   roll     the dice tumble and settle, then the dice line prints
//   morale   the hearts flip
//   flag     an evidence flag slides in a slip (not awaited: it comes and goes on its own)
//   stage    the cue plays; a cue listed in PARALLEL starts together with the one before it
//   options  the options are laid out, and the director waits for the player
//   end      the chapter is over
// Input is taken only while the director waits for the player (`idle`).
import type { Lang, Line, SkillId } from '../content/schema';
import { SKILLS } from '../content/skills';
import { EVIDENCE_LABELS } from '../content/study';
import { ui } from '../content/ui';
import type { Beat, RollResult, Runner } from '../engine';
import { PARALLEL } from '../scene/cues';
import type { Clock } from './clock';
import type { LogView } from './log';

export interface Stagehands {
  dice: { roll(values: [number, number]): Promise<void> };
  hearts: { to(value: number): Promise<void> };
  slip: { show(text: (lang: Lang) => [string, string]): Promise<void> };
  cues: { play(cue: string): Promise<void>; enter(): Promise<void> };
  /** Which puppet bobs while its line types. */
  speaking(who: 'harry' | 'kim' | null): void;
}

/** Rest after a line (ms), after narration, and after the dice line. */
const REST = { line: 200, narrator: 1000, roll: 350 };

export class Director {
  /** Waiting for the player's choice. */
  idle = false;
  /** The end beat has played. */
  ended = false;
  /** Beats played so far, by key (`narrator:2`, `stage:snow-start`, `roll`, …), for pauses. */
  private counts = new Map<string, number>();
  private pauses = new Set<string>();
  private resume: (() => void) | null = null;
  /** The pause the director is waiting in (a test harness asked for it), or null. */
  paused: string | null = null;
  onIdle: () => void = () => {};

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

  /** Click or Space: completes the line being typed. */
  skip() { if (this.log.typing) this.log.finishLine(); }

  /** Pause after the beat with this key has played (e.g. `narrator:2`, `stage:snow-start`), until resumed. */
  pauseAfter(key: string) { this.pauses.add(key); }
  continue() { this.paused = null; this.resume?.(); this.resume = null; }

  private async checkpoint(key: string) {
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    for (const k of [key, `${key}:${n}`]) {
      if (!this.pauses.has(k)) continue;
      this.pauses.delete(k);
      this.paused = k;
      await new Promise<void>((r) => { this.resume = r; });
    }
  }

  private async play(beats: Beat[]) {
    try {
      for (let i = 0; i < beats.length; i++) {
        const b = beats[i];
        switch (b.kind) {
          case 'line':
            await this.line(b.line);
            await this.checkpoint(`line:${speakerKey(b.line)}`);
            break;
          case 'roll':
            await this.roll(b.roll);
            await this.checkpoint('roll');
            break;
          case 'morale':
            await this.hands.hearts.to(b.value);
            await this.checkpoint('morale');
            break;
          case 'flag':
            if (b.evidence) {
              const key = b.key;
              void this.hands.slip.show((lang) => [ui.newLead[lang], EVIDENCE_LABELS[key]?.[lang] ?? key]);
            }
            await this.checkpoint(`flag:${b.key}`);
            break;
          case 'stage': {
            const group = [b.cue];
            while (beats[i + 1]?.kind === 'stage' && PARALLEL.has((beats[i + 1] as { cue: string }).cue)) group.push((beats[++i] as { cue: string }).cue);
            await Promise.all(group.map((c) => this.hands.cues.play(c)));
            for (const c of group) await this.checkpoint(`stage:${c}`);
            break;
          }
          case 'options':
            await this.log.setOptions(b.options);
            await this.checkpoint('options');
            break;
          case 'end':
            this.ended = true;
            await this.checkpoint('end');
            break;
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
    await this.clock.wait(s === 'narrator' ? REST.narrator : REST.line);
  }

  private async roll(r: RollResult) {
    await this.clock.wait(150);
    await this.hands.dice.roll(r.dice);
    await this.log.append({ kind: 'check', check: r.check, dice: r.dice, total: r.total, success: r.success });
    await this.clock.wait(REST.roll);
  }
}

/** A line's speaker as a pause key: you, kim, necktie, narrator, a skill id, or 'thing'. */
function speakerKey(line: Line): string {
  const s = line.speaker;
  return typeof s === 'object' ? 'thing' : (s as SkillId | 'you' | 'kim' | 'necktie' | 'narrator');
}
