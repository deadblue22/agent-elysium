// Content types (docs/design.md §7.3).

export type Lang = 'zh' | 'en';

export type Text = { zh: string; en: string };

export type SkillId =
  | 'logic' | 'encyclopedia' | 'visualCalculus'
  | 'inlandEmpire' | 'empathy' | 'authority'
  | 'perception' | 'electrochemistry' | 'shivers';

/** Perception reports by sense, e.g. 五感发达（视觉）/ PERCEPTION (SIGHT). */
export type Sense = 'sight' | 'smell' | 'hearing';

export type CheckKind = 'white' | 'red' | 'passive';

export interface Modifier { flag: string; value: number; label: Text }

export interface Check {
  skill: SkillId;
  dc: number;
  kind: CheckKind;
  /** For Perception checks: which sense (shown in the check tag). Not in §7.3's draft. */
  sense?: Sense;
  modifiers?: Modifier[];
  success: string; // node id
  failure: string; // node id
}

/**
 * Who speaks a log line: 'you' is the player's chosen words, 'kim' the lieutenant,
 * 'necktie' the Horrific Necktie, a SkillId an inner voice, and a Text an object or place
 * (「黄铜座钟」). 'narrator' lines carry no speaker (the reconstruction only).
 */
export type Speaker = 'narrator' | 'you' | 'kim' | 'necktie' | SkillId | Text;

export interface Line {
  speaker: Speaker;
  text: Text;
  /** The check result tag of an inner voice, e.g. [中等：成功]. */
  result?: { dc: number; success: boolean };
  /** Perception's sense, e.g. （视觉）. */
  sense?: Sense;
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
 * What the left page shows: the log the runner has produced so far, in the original's
 * dialogue-log format (view-level; the engine of §7.2 will emit these while walking nodes).
 */
export type LogEntry =
  /** Anything said: an object, a place, an inner voice, Kim, or the player's chosen words ('you'). */
  | { kind: 'line'; line: Line }
  /** The dice line of an active check: [见微知著 - 中等 10]  4 + 5 + 3 = 12 (the result tag follows on the voice's line). */
  | { kind: 'check'; check: Check; dice: [number, number]; total: number; success: boolean }
  /** A currently available option, numbered as shown; index is its place in the node's options. */
  | { kind: 'option'; number: number; index: number; option: Option };
