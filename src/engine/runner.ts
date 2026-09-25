// The dialogue runner (docs/design.md §7.4). It walks a Story's nodes and returns, for each
// step, the beats the view should play in order. It never waits: animation is the view's job.
//
// Rules beyond §5.2:
// - Passives fire once each, the first time their node is entered (not on silent returns).
// - A white check hides itself on success. On failure it is greyed until a new flag is set
//   or the player has made RETRY_AFTER more choices, so the chapter can never dead-end.
// - A red check hides itself after any attempt.
import type { Effect, Goto, Line, LogEntry, Node, Option, SkillId, Story, Text } from '../content/schema';
import { createRng, randomSeed, roll2d6, type Rng } from './rng';
import { applicableModifiers, chance, evidenceCount, holds, passiveFires, resolveRoll } from './rules';
import type { Beat, GameStateView, OptionView, RollResult } from './types';

/** Choices a failed white check waits before it can be retried without new information. */
export const RETRY_AFTER = 3;

export const GREYED_REASON: Text = {
  zh: '需要新线索，或者先去别处看看。',
  en: 'Needs new information, or look elsewhere first.',
};

export interface RunnerOptions {
  seed?: number;
  /** Dice to use for the next rolls, in order, before the seeded ones (tests, the style board). */
  forcedDice?: [number, number][];
}

export class Runner {
  private readonly story: Story;
  private readonly rng: Rng;
  private readonly forced: [number, number][];
  readonly seed: number;

  private node = '';
  private morale: number;
  private readonly flags = new Set<string>();
  private readonly visited = new Set<string>();
  private readonly firedPassives = new Set<string>();
  private readonly chosenOnce = new Set<string>();
  private readonly succeeded = new Set<string>();
  private readonly spentRed = new Set<string>();
  private readonly failedWhite = new Map<string, { flagsAt: number; choiceAt: number }>();
  /** Every flag ever set, so a flag set again later does not count as new information. */
  private readonly everSet = new Set<string>();
  private choices = 0;
  private ended = false;
  private readonly entries: LogEntry[] = [];
  private shown: OptionView[] = [];

  constructor(story: Story, opts: RunnerOptions = {}) {
    this.story = story;
    this.seed = opts.seed ?? randomSeed();
    this.rng = createRng(this.seed);
    this.forced = [...(opts.forcedDice ?? [])];
    this.morale = story.morale.start;
  }

  get state(): GameStateView {
    return {
      node: this.node,
      morale: this.morale,
      flags: this.flags,
      sheet: this.story.sheet,
      evidence: evidenceCount(this.story, this.flags),
    };
  }

  get isEnded(): boolean {
    return this.ended;
  }

  /** The log so far: lines and dice lines, without the current options. */
  log(): LogEntry[] {
    return [...this.entries];
  }

  /** The log plus the current options as numbered entries: what the left page shows. */
  page(): LogEntry[] {
    return [
      ...this.entries,
      ...this.shown.map((o): LogEntry => ({ kind: 'option', number: o.number, index: o.index, option: o.option, state: o.state })),
    ];
  }

  /** The options currently shown. */
  options(): OptionView[] {
    return [...this.shown];
  }

  start(): Beat[] {
    const beats: Beat[] = [];
    this.enter(this.story.start, false, beats);
    return beats;
  }

  /** Choose a shown, enabled option by its 1-based number. Returns [] if it cannot be chosen. */
  choose(number: number): Beat[] {
    if (this.ended) return [];
    const view = this.shown.find((o) => o.number === number);
    if (!view || view.state !== 'enabled') return [];
    const node = this.nodeById(this.node);
    const option = view.option;
    const id = optionId(node, view.index);
    const beats: Beat[] = [];
    this.shown = [];
    this.choices++;

    if (option.echo !== false) this.say({ speaker: 'you', text: option.text }, beats);
    if (option.once) this.chosenOnce.add(id);
    this.apply(option.effects, beats);

    if (option.check) {
      const roll = this.roll(option);
      beats.push({ kind: 'roll', roll });
      this.entries.push({ kind: 'check', check: option.check, dice: roll.dice, total: roll.total, success: roll.success });
      if (option.check.kind === 'red') this.spentRed.add(id);
      else if (roll.success) {
        this.succeeded.add(id);
        this.failedWhite.delete(id);
      } else this.failedWhite.set(id, { flagsAt: this.everSet.size, choiceAt: this.choices });
      this.enter(roll.success ? option.check.success : option.check.failure, false, beats);
    } else if (option.next) {
      this.enter(option.next, option.silent ?? false, beats);
    } else {
      // an option that only has effects: stay, and show the node's options again
      this.showOptions(node, beats);
    }
    return beats;
  }

  // --- internals ---------------------------------------------------------------------

  private nodeById(id: string): Node {
    const node = this.story.nodes[id];
    if (!node) throw new Error(`unknown node: ${id}`);
    return node;
  }

  private cond() {
    return { flags: this.flags, morale: this.morale, sheet: this.story.sheet };
  }

  private enter(id: string, silent: boolean, beats: Beat[], depth = 0): void {
    if (depth > 64) throw new Error(`runaway goto chain at ${id}`);
    const node = this.nodeById(id);
    this.node = id;
    for (const cue of node.stage ?? []) beats.push({ kind: 'stage', cue });

    if (!silent) {
      const lines = this.visited.has(id) && node.revisit ? node.revisit : node.lines;
      for (const line of lines) if (holds(line.when, this.cond(), this.story)) this.say(line, beats);
      (node.passive ?? []).forEach((p, i) => {
        const key = `${id}#${i}`;
        if (this.firedPassives.has(key) || !holds(p.when, this.cond(), this.story)) return;
        if (!passiveFires(this.story.sheet[p.skill], p.dc)) return;
        this.firedPassives.add(key);
        this.say({ speaker: p.skill, sense: p.sense, text: p.text, result: { dc: p.dc, success: true } }, beats);
      });
    }
    // effects land after the node's words: the new lead or the morale loss follows what caused it
    this.apply(node.effects, beats);
    this.visited.add(id);

    if (node.end) {
      this.ended = true;
      beats.push({ kind: 'end' });
      return;
    }
    if (this.visibleOptions(node).length) {
      this.showOptions(node, beats);
      return;
    }
    const next = this.route(node.next);
    if (!next) throw new Error(`dead end at ${id}: no options, no next`);
    this.enter(next.node, next.silent ?? false, beats, depth + 1);
  }

  private route(next: Goto | Goto[] | undefined): Goto | undefined {
    if (!next) return undefined;
    const list = Array.isArray(next) ? next : [next];
    return list.find((g) => holds(g.when, this.cond(), this.story));
  }

  private say(line: Line, beats: Beat[]): void {
    beats.push({ kind: 'line', line });
    this.entries.push({ kind: 'line', line });
  }

  private apply(effects: Effect[] | undefined, beats: Beat[]): void {
    for (const e of effects ?? []) {
      if (e.type === 'flag') {
        if (e.value) {
          if (this.flags.has(e.key)) continue;
          this.flags.add(e.key);
          this.everSet.add(e.key);
          if (this.story.evidence.includes(e.key)) {
            const count = evidenceCount(this.story, this.flags), total = this.story.evidence.length;
            beats.push({ kind: 'flag', key: e.key, evidence: true, count, total });
            this.entries.push({ kind: 'notice', flag: e.key, count, total });
          } else beats.push({ kind: 'flag', key: e.key, evidence: false });
        } else this.flags.delete(e.key);
      } else if (e.type === 'morale') {
        const before = this.morale;
        this.morale = Math.max(0, Math.min(this.story.morale.max, this.morale + e.delta));
        if (this.morale !== before) beats.push({ kind: 'morale', value: this.morale, delta: this.morale - before, max: this.story.morale.max });
      } else beats.push({ kind: 'stage', cue: e.cue });
    }
  }

  private roll(option: Option): RollResult {
    const check = option.check!;
    const dice = this.forced.shift() ?? roll2d6(this.rng);
    const skillValue = this.story.sheet[check.skill as SkillId];
    const modifiers = applicableModifiers(check.modifiers, this.flags);
    const bonus = skillValue + modifiers.reduce((s, m) => s + m.value, 0);
    const { success, crit } = resolveRoll(dice, bonus, check.dc);
    return { check, dice, skillValue, modifiers, total: dice[0] + dice[1] + bonus, success, crit };
  }

  private visibleOptions(node: Node): { option: Option; index: number; id: string }[] {
    return node.options
      .map((option, index) => ({ option, index, id: optionId(node, index) }))
      .filter(({ option, id }) =>
        holds(option.requires, this.cond(), this.story) &&
        !(option.once && this.chosenOnce.has(id)) &&
        !this.succeeded.has(id) &&
        !this.spentRed.has(id));
  }

  private showOptions(node: Node, beats: Beat[]): void {
    this.shown = this.visibleOptions(node).map(({ option, index, id }, i): OptionView => {
      const view: OptionView = { number: i + 1, index, option, state: 'enabled' };
      const failed = this.failedWhite.get(id);
      if (failed) {
        const newInfo = this.everSet.size > failed.flagsAt;
        const waited = this.choices - failed.choiceAt >= RETRY_AFTER;
        if (newInfo || waited) this.failedWhite.delete(id);
        else {
          view.state = 'greyed';
          view.reason = GREYED_REASON;
        }
      }
      if (option.check) {
        const modifiers = applicableModifiers(option.check.modifiers, this.flags);
        const bonus = this.story.sheet[option.check.skill] + modifiers.reduce((s, m) => s + m.value, 0);
        view.chance = chance(bonus, option.check.dc);
        view.modifiers = modifiers;
      }
      return view;
    });
    beats.push({ kind: 'options', options: [...this.shown] });
  }
}

export function optionId(node: Node, index: number): string {
  return node.options[index].id ?? `${node.id}#${index}`;
}
