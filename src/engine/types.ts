// What the dialogue engine hands the view. The runner is synchronous: each call returns
// the beats to play, in order; the view animates them (typewriter, dice, stage cues).
import type { Check, Line, Option, SkillId, Text } from '../content/schema';

export interface AppliedModifier { label: Text; value: number }

/** One active check, rolled. */
export interface RollResult {
  check: Check;
  dice: [number, number];
  skillValue: number;
  modifiers: AppliedModifier[];
  /** dice + skill + modifiers */
  total: number;
  success: boolean;
  /** 2 always fails (snake eyes), 12 always succeeds (boxcars). */
  crit: 'snake' | 'boxcars' | null;
}

export interface OptionView {
  /** 1-based, as shown on the page and bound to the number keys. */
  number: number;
  /** The option's place in its node's `options`. */
  index: number;
  option: Option;
  /** 'greyed': a failed white check waiting for new information; shown but not choosable. */
  state: 'enabled' | 'greyed';
  /** Active checks: chance of success (0–1) and the modifiers that apply now. */
  chance?: number;
  modifiers?: AppliedModifier[];
  /** Why a greyed option is waiting, for its tooltip. */
  reason?: Text;
}

export type Beat =
  /** A log line: object, place, voice, Kim, narrator, or the player's echoed choice ('you'). */
  | { kind: 'line'; line: Line }
  /** An active check: animate the dice, then print the dice line. */
  | { kind: 'roll'; roll: RollResult }
  /** Morale changed. */
  | { kind: 'morale'; value: number; delta: number; max: number }
  /** A flag was set for the first time; `evidence` when it counts toward the reconstruction. */
  | { kind: 'flag'; key: string; evidence: boolean }
  /** A stage cue (docs/design.md §6.5): night, snow-stop, snow-start, raise-stairs, … */
  | { kind: 'stage'; cue: string }
  /** The options now available, replacing any shown before. */
  | { kind: 'options'; options: OptionView[] }
  /** The chapter is over. */
  | { kind: 'end' };

export interface GameStateView {
  node: string;
  morale: number;
  flags: ReadonlySet<string>;
  sheet: Readonly<Record<SkillId, number>>;
  evidence: number;
}
