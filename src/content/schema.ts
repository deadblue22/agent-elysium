// Content types (docs/design.md §7.3), as the dialogue engine (src/engine) walks them.

export type Lang = 'zh' | 'en';

export type Text = { zh: string; en: string };

export type SkillId =
  | 'logic' | 'encyclopedia' | 'visualCalculus'
  | 'inlandEmpire' | 'empathy' | 'authority'
  | 'perception' | 'electrochemistry' | 'shivers';

/** Perception reports by sense, e.g. 五感发达（视觉）/ PERCEPTION (SIGHT). */
export type Sense = 'sight' | 'smell' | 'hearing';

export type CheckKind = 'white' | 'red' | 'passive';

/** A bonus an active check gets while a flag is set: 「+1 指针被拨过」. */
export interface Modifier { flag: string; value: number; label: Text }

/** A condition on the game state. Every listed part must hold. */
export interface Condition {
  /** All of these flags are set. */
  flags?: string[];
  /** None of these flags is set. */
  notFlags?: string[];
  /** At least this many of the story's evidence flags are set. */
  minEvidence?: number;
  /** Each listed skill is at least this value. */
  skillAtLeast?: Partial<Record<SkillId, number>>;
  /** Morale is at least this value. */
  minMorale?: number;
}

/** An active check on an option. White checks can be retried later; red ones only once. */
export interface Check {
  skill: SkillId;
  dc: number;
  kind: CheckKind;
  /** For Perception checks: which sense (shown in the check tag). */
  sense?: Sense;
  modifiers?: Modifier[];
  success: string; // node id
  failure: string; // node id
}

/**
 * A passive check: no dice. It fires once, the first time its node is entered, when
 * 6 + skill ≥ dc (the original's rule), and inserts its voice line with a result tag.
 */
export interface Passive {
  skill: SkillId;
  dc: number;
  sense?: Sense;
  text: Text;
  when?: Condition;
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
  /** Shown only while this holds. */
  when?: Condition;
}

export type Effect =
  | { type: 'flag'; key: string; value: boolean }
  | { type: 'morale'; delta: number }
  | { type: 'stage'; cue: string };

/** Where the story goes next. `silent` shows the target's options without replaying its lines. */
export interface Goto { node: string; silent?: boolean; when?: Condition }

export interface Option {
  /** A stable key for once/white/red bookkeeping. Defaults to `${node.id}#${index}`. */
  id?: string;
  text: Text;
  /** For options without a check. */
  next?: string;
  /** With `next`: go there without replaying its lines (e.g. 回到房间中央). */
  silent?: boolean;
  check?: Check;
  /** Hidden while this does not hold. */
  requires?: Condition;
  /** Hidden once chosen. Checks hide themselves on success (white) or after any attempt (red). */
  once?: boolean;
  /** Applied when chosen, before moving on. */
  effects?: Effect[];
  /** Log the choice as 「你 — …」. Default true. */
  echo?: boolean;
}

export interface Node {
  id: string;
  lines: Line[];
  /** Played instead of `lines` when the node is entered again (not silently). */
  revisit?: Line[];
  passive?: Passive[];
  options: Option[];
  /** For nodes without options: where to go after the lines. The first Goto whose `when` holds wins. */
  next?: Goto | Goto[];
  /** Stage cues fired on entering the node. */
  stage?: string[];
  /** Applied on entering the node (check outcomes such as `clock_tampered`). */
  effects?: Effect[];
  /** The chapter ends here. */
  end?: boolean;
}

/** A chapter: its nodes, where it starts, which flags count as evidence, and the fixed sheet. */
export interface Story {
  start: string;
  nodes: Record<string, Node>;
  evidence: string[];
  sheet: Record<SkillId, number>;
  morale: { start: number; max: number };
}

/**
 * What the left page shows: the log the runner has produced so far, in the original's
 * dialogue-log format.
 */
export type LogEntry =
  /** Anything said: an object, a place, an inner voice, Kim, or the player's chosen words ('you'). */
  | { kind: 'line'; line: Line }
  /** The dice line of an active check: [见微知著 - 中等 10]  4 + 5 + 3 = 12 (the result tag follows on the voice's line). */
  | { kind: 'check'; check: Check; dice: [number, number]; total: number; success: boolean }
  /** A currently shown option, numbered as shown; index is its place in the node's options. */
  | { kind: 'option'; number: number; index: number; option: Option; state?: 'enabled' | 'greyed' }
  /** A new piece of evidence: 「新线索：指针被拨过（1/3）」. `count` of `total` found so far. */
  | { kind: 'notice'; flag: string; count: number; total: number };
