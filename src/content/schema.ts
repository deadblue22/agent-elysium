// Content types (docs/design.md §7.3).

export type Lang = 'zh' | 'en';

export type Text = { zh: string; en: string };

export type SkillId =
  | 'logic' | 'encyclopedia' | 'visualCalculus'
  | 'inlandEmpire' | 'empathy' | 'authority' | 'perception';

export type CheckKind = 'white' | 'red' | 'passive';

export interface Modifier { flag: string; value: number; label: Text }

export interface Check {
  skill: SkillId;
  dc: number;
  kind: CheckKind;
  modifiers?: Modifier[];
  success: string; // node id
  failure: string; // node id
}

export interface Line {
  speaker: 'narrator' | 'kask' | SkillId;
  text: Text;
}

export type Effect =
  | { type: 'flag'; key: string; value: boolean }
  | { type: 'morale'; delta: number }
  | { type: 'stage'; cue: string };

export interface Option {
  text: Text;
  next?: string;
  check?: Check;
  requires?: { flags?: string[]; minEvidence?: number };
  effects?: Effect[];
}

export interface Node {
  id: string;
  lines: Line[];
  passive?: Check[];
  options: Option[];
  stage?: string[]; // stage cues fired on entering the node
  /** Applied on entering the node (check outcomes such as `clock_tampered`). Not in §7.3's draft. */
  effects?: Effect[];
}

/**
 * What the left page shows: the log the runner has produced so far.
 * (View-level; the engine of §7.2 will emit these while walking nodes.)
 */
export type LogEntry =
  | { kind: 'choice'; text: Text }                         // an option the player already took
  | { kind: 'line'; line: Line }                           // narration, an inner voice, or Kask
  | { kind: 'check'; check: Check; dice: [number, number]; total: number; success: boolean }
  | { kind: 'option'; index: number; option: Option };     // a currently available option
