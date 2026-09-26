import { describe, expect, it } from 'vitest';
import type { Goto, Line, LogEntry, Story } from '../content/schema';
import { study } from '../content/study';
import { clockMoment } from '../content/study-clock';
import { GREYED_REASON, RETRY_AFTER, Runner } from './runner';
import { chance, passiveFires, resolveRoll } from './rules';
import type { Beat } from './types';

const lines = (beats: Beat[]) => beats.filter((b): b is Extract<Beat, { kind: 'line' }> => b.kind === 'line').map((b) => b.line);
const optionsOf = (beats: Beat[]) => beats.filter((b): b is Extract<Beat, { kind: 'options' }> => b.kind === 'options').at(-1)?.options ?? [];
const zh = (l: Line) => l.text.zh;
const numberOf = (run: Runner, id: string) => {
  const view = run.options().find((o) => o.option.id === id);
  if (!view) throw new Error(`option ${id} not shown; shown: ${run.options().map((o) => o.option.id).join(', ')}`);
  return view.number;
};
const pick = (run: Runner, id: string) => run.choose(numberOf(run, id));

describe('rules', () => {
  it('passives fire on 6 + skill ≥ dc', () => {
    expect(passiveFires(2, 8)).toBe(true);
    expect(passiveFires(2, 9)).toBe(false);
  });

  it('snake eyes fail and boxcars succeed regardless of bonus', () => {
    expect(resolveRoll([1, 1], 99, 10)).toEqual({ success: false, crit: 'snake' });
    expect(resolveRoll([6, 6], -99, 10)).toEqual({ success: true, crit: 'boxcars' });
    expect(resolveRoll([4, 5], 3, 12)).toEqual({ success: true, crit: null });
    expect(resolveRoll([4, 4], 3, 12)).toEqual({ success: false, crit: null });
  });

  it('matches the success chances of design.md §5.2', () => {
    expect(chance(3, 10)).toBeCloseTo(21 / 36); // 见微知著 白 58%
    expect(chance(2, 10)).toBeCloseTo(15 / 36); // 五感发达 / 争强好胜 42%
    expect(chance(4, 12)).toBeCloseTo(15 / 36); // 逻辑思维 0 证据 42%
    expect(chance(6, 12)).toBeCloseTo(26 / 36); // 2 证据 72%
    expect(chance(7, 12)).toBeCloseTo(30 / 36); // 3 证据 83%
    expect(chance(99, 10)).toBeCloseTo(35 / 36);
    expect(chance(-99, 10)).toBeCloseTo(1 / 36);
  });
});

describe('story integrity', () => {
  const texts: { where: string; zh: string; en: string }[] = [];
  const targets: { where: string; node: string }[] = [];
  for (const node of Object.values(study.nodes)) {
    for (const l of [...node.lines, ...(node.revisit ?? [])]) texts.push({ where: node.id, ...l.text });
    for (const p of node.passive ?? []) texts.push({ where: `${node.id} passive`, ...p.text });
    node.options.forEach((o, i) => {
      texts.push({ where: `${node.id} option ${i}`, ...o.text });
      if (o.next) targets.push({ where: node.id, node: o.next });
      if (o.check) targets.push({ where: node.id, node: o.check.success }, { where: node.id, node: o.check.failure });
    });
    const next = node.next ? (Array.isArray(node.next) ? node.next : [node.next]) : [];
    next.forEach((g: Goto) => targets.push({ where: node.id, node: g.node }));
    if (!node.end && !node.options.length) expect(next.length, `${node.id} has no way out`).toBeGreaterThan(0);
  }

  it('every text has both languages', () => {
    for (const x of texts) {
      expect(x.zh.trim(), `${x.where} zh`).not.toBe('');
      expect(x.en.trim(), `${x.where} en`).not.toBe('');
    }
  });

  it('every target node exists', () => {
    for (const x of targets) expect(study.nodes[x.node], `${x.where} → ${x.node}`).toBeDefined();
  });

  it('option ids are unique', () => {
    const ids = Object.values(study.nodes).flatMap((n) => n.options.map((o) => o.id)).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the chapter', () => {
  it('opens with the room, Kim, and three passives', () => {
    const run = new Runner(study, { seed: 1 });
    const beats = run.start();
    const said = lines(beats);
    expect(said[0].speaker).toEqual({ zh: '书房', en: 'The Study' });
    expect(said[1].speaker).toBe('kim');
    expect(said.slice(2).map((l) => l.speaker)).toEqual(['perception', 'inlandEmpire', 'electrochemistry']);
    expect(said[2].result).toEqual({ dc: 8, success: true });
    expect(said[2].sense).toBe('sight');
    // the reconstruction needs two pieces of evidence
    expect(optionsOf(beats).map((o) => o.option.id)).toEqual(['intro.clock', 'intro.window', 'intro.kim', 'intro.brandy']);
  });

  it('passives fire once; revisits play the short line', () => {
    const run = new Runner(study, { seed: 1 });
    run.start();
    const first = lines(pick(run, 'intro.clock'));
    expect(first.map((l) => l.speaker)).toEqual(['you', { zh: '黄铜座钟', en: 'Brass Mantel Clock' }, 'encyclopedia']);
    pick(run, 'clock.back');
    const again = lines(pick(run, 'intro.clock'));
    expect(again.map(zh)).toEqual(['检查壁炉上的钟。', '指针依然停在 23:40。钟摆一动不动。']);
  });

  it('a passed white check hides itself and unlocks the follow-up', () => {
    const run = new Runner(study, { forcedDice: [[4, 5]] });
    run.start();
    pick(run, 'intro.clock');
    const beats = pick(run, 'clock.turn');
    const roll = beats.find((b) => b.kind === 'roll');
    expect(roll && roll.kind === 'roll' && roll.roll).toMatchObject({ dice: [4, 5], skillValue: 3, total: 12, success: true, crit: null });
    expect(beats.find((b) => b.kind === 'flag')).toEqual({ kind: 'flag', key: 'clock_tampered', evidence: true, count: 1, total: 3 });
    expect(optionsOf(beats).map((o) => o.option.id)).toEqual(['clock.lying', 'clock.back']);
  });

  it('a new lead lands after the words that found it, and is logged as a notice', () => {
    const run = new Runner(study, { forcedDice: [[4, 5]] });
    run.start();
    pick(run, 'intro.clock');
    const kinds = pick(run, 'clock.turn').map((b) => (b.kind === 'line' ? `line:${typeof b.line.speaker === 'string' ? b.line.speaker : 'thing'}` : b.kind));
    expect(kinds).toEqual(['line:you', 'roll', 'line:visualCalculus', 'line:kim', 'flag', 'options']);
    const log = run.log();
    expect(log.at(-1)).toEqual({ kind: 'notice', flag: 'clock_tampered', count: 1, total: 3 });
  });

  it('a morale loss lands after the failure it comes from', () => {
    const run = new Runner(study, { forcedDice: [[1, 2]] });
    run.start();
    pick(run, 'intro.window');
    const kinds = pick(run, 'window.lean').map((b) => b.kind);
    expect(kinds).toEqual(['line', 'roll', 'line', 'line', 'morale', 'options']);
  });

  it('a failed white check is greyed until new information or RETRY_AFTER choices', () => {
    const run = new Runner(study, { forcedDice: [[1, 2]] });
    run.start();
    pick(run, 'intro.clock');
    const beats = pick(run, 'clock.turn');
    const turn = optionsOf(beats).find((o) => o.option.id === 'clock.turn')!;
    expect(turn.state).toBe('greyed');
    expect(turn.reason).toEqual(GREYED_REASON);
    expect(run.choose(turn.number)).toEqual([]);
    // walk away and back: RETRY_AFTER choices later it is enabled again
    for (let i = 0; i < RETRY_AFTER - 1; i++) {
      pick(run, 'clock.back');
      pick(run, 'intro.clock');
    }
    expect(run.options().find((o) => o.option.id === 'clock.turn')!.state).toBe('enabled');
  });

  it('a failed Perception check costs morale and stays greyed on an immediate return', () => {
    const run = new Runner(study, { forcedDice: [[1, 2]] });
    run.start();
    pick(run, 'intro.window');
    pick(run, 'window.lean');
    expect(run.state.morale).toBe(3);
    pick(run, 'window.back');
    pick(run, 'intro.window');
    expect(run.options().find((o) => o.option.id === 'window.lean')!.state).toBe('greyed');
  });

  it('a red check is spent after one attempt, and costs morale on failure', () => {
    const run = new Runner(study, { forcedDice: [[1, 2]] });
    run.start();
    pick(run, 'intro.kim');
    const beats = pick(run, 'kim.notebook');
    expect(beats.find((b) => b.kind === 'morale')).toEqual({ kind: 'morale', value: 3, delta: -1, max: 4 });
    expect(lines(beats).at(-1)!.speaker).toBe('authority');
    expect(optionsOf(beats).map((o) => o.option.id)).not.toContain('kim.notebook');
  });

  it('once options disappear after being chosen', () => {
    const run = new Runner(study, { seed: 3 });
    run.start();
    pick(run, 'intro.kim');
    const beats = pick(run, 'kim.time');
    expect(optionsOf(beats).map((o) => o.option.id)).toEqual(['kim.who', 'kim.notebook', 'kim.goodcop', 'kim.back']);
  });

  it('shows the success chance and evidence modifiers on the reconstruction', () => {
    const run = new Runner(study, { forcedDice: [[4, 5]] });
    run.start();
    pick(run, 'intro.kim');
    pick(run, 'kim.who');
    pick(run, 'kim.back');
    pick(run, 'intro.clock');
    pick(run, 'clock.turn');
    pick(run, 'clock.back');
    const recon = run.options().find((o) => o.option.id === 'intro.reconstruct')!;
    expect(recon.chance).toBeCloseTo(26 / 36);
    expect(recon.modifiers!.map((m) => m.label.zh)).toEqual(['指针被拨过', '狗没有叫']);
  });

  it('plays through to the end with the reconstruction cues in order', () => {
    const run = new Runner(study, { forcedDice: [[4, 5], [5, 6]] });
    run.start();
    pick(run, 'intro.kim');
    pick(run, 'kim.who');
    pick(run, 'kim.back');
    pick(run, 'intro.clock');
    pick(run, 'clock.turn');
    pick(run, 'clock.back');
    const recon = pick(run, 'intro.reconstruct');
    const cues = recon.filter((b) => b.kind === 'stage').map((b) => (b as { cue: string }).cue);
    expect(cues).toEqual(['flashback', 'snow-stop', 'raise-stairs', 'marek-climb', 'marek-blow', 'clock-set', 'window-open', 'marek-leave', 'snow-start', 'present']);
    const said = lines(recon);
    expect(said[0].speaker).toBe('you');
    expect(said[1]).toMatchObject({ speaker: 'logic', result: { dc: 12, success: true } });
    expect(said.filter((l) => l.speaker === 'narrator')).toHaveLength(4);
    expect(said.at(-1)!.speaker).toBe('necktie');
    const end = pick(run, 'recon.upstairs');
    expect(end.map((b) => b.kind)).toEqual(['line', 'stage', 'end']);
    expect(run.isEnded).toBe(true);
    expect(run.choose(1)).toEqual([]);
  });

  it('a failed reconstruction returns to the room and can be retried', () => {
    const run = new Runner(study, { forcedDice: [[4, 5], [1, 2]] });
    run.start();
    pick(run, 'intro.kim');
    pick(run, 'kim.who');
    pick(run, 'kim.back');
    pick(run, 'intro.clock');
    pick(run, 'clock.turn');
    pick(run, 'clock.back');
    const beats = pick(run, 'intro.reconstruct');
    expect(lines(beats).at(-1)!.speaker).toBe('kim');
    expect(run.state.node).toBe('study.intro');
    expect(run.options().find((o) => o.option.id === 'intro.reconstruct')!.state).toBe('greyed');
  });

  it('never dead-ends and always reaches the end (random playthroughs)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const run = new Runner(study, { seed });
      let rnd = seed * 7919;
      const next = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      run.start();
      let steps = 0;
      while (!run.isEnded && steps < 600) {
        const enabled = run.options().filter((o) => o.state === 'enabled');
        expect(enabled.length, `seed ${seed} step ${steps} node ${run.state.node}`).toBeGreaterThan(0);
        const recon = enabled.find((o) => o.option.id === 'intro.reconstruct' || o.option.id === 'recon.upstairs');
        const choice = recon && next() < 0.5 ? recon : enabled[Math.floor(next() * enabled.length)];
        run.choose(choice.number);
        steps++;
      }
      expect(run.isEnded, `seed ${seed} did not end in ${steps} steps`).toBe(true);
    }
  });

  it('the same seed plays the same game', () => {
    const play = (seed: number) => {
      const run = new Runner(study, { seed });
      run.start();
      pick(run, 'intro.clock');
      return pick(run, 'clock.turn').find((b) => b.kind === 'roll');
    };
    expect(play(42)).toEqual(play(42));
  });
});

describe('the style-board moment', () => {
  it('is the committed frame, produced by the engine', () => {
    const kinds = clockMoment.map((e: LogEntry) => (e.kind === 'line' ? (typeof e.line.speaker === 'object' ? e.line.speaker.zh : e.line.speaker) : e.kind));
    expect(kinds).toEqual(['you', '黄铜座钟', 'encyclopedia', 'you', 'check', 'visualCalculus', 'kim', 'notice', 'option', 'option']);
    const check = clockMoment[4];
    expect(check.kind === 'check' && [check.dice, check.total, check.success]).toEqual([[4, 5], 12, true]);
    const opts = clockMoment.filter((e) => e.kind === 'option');
    expect(opts.map((e) => e.kind === 'option' && [e.number, e.index, e.option.text.zh])).toEqual([
      [1, 1, '「这只钟在撒谎，金。」'],
      [2, 2, '回到房间中央。'],
    ]);
  });
});

// Tiny stories pin single rules without the chapter's content.
describe('white retry on new information', () => {
  const tiny: Story = {
    start: 'a',
    evidence: ['clue'],
    sheet: study.sheet,
    morale: { start: 4, max: 4 },
    nodes: {
      a: {
        id: 'a', lines: [],
        options: [
          { id: 'try', text: { zh: '试', en: 'try' }, check: { skill: 'logic', dc: 18, kind: 'white', success: 'a', failure: 'a' } },
          { id: 'learn', text: { zh: '学', en: 'learn' }, once: true, effects: [{ type: 'flag', key: 'clue', value: true }] },
        ],
      },
    },
  };
  it('re-enables after one choice that sets a new flag', () => {
    const run = new Runner(tiny, { forcedDice: [[1, 2]] });
    run.start();
    run.choose(1);
    expect(run.options()[0].state).toBe('greyed');
    const beats = run.choose(2);
    expect(beats.find((b) => b.kind === 'flag')).toEqual({ kind: 'flag', key: 'clue', evidence: true, count: 1, total: 1 });
    expect(run.options()[0].state).toBe('enabled');
  });
});

describe('morale', () => {
  const tiny: Story = {
    start: 'a',
    evidence: [],
    sheet: study.sheet,
    morale: { start: 1, max: 4 },
    nodes: {
      a: {
        id: 'a', lines: [],
        options: [
          { id: 'hurt', text: { zh: '疼', en: 'ouch' }, effects: [{ type: 'morale', delta: -3 }] },
          { id: 'boss', text: { zh: '命令', en: 'order' }, requires: { minMorale: 1 }, next: 'a' },
        ],
      },
    },
  };
  it('clamps at zero and hides options that need morale', () => {
    const run = new Runner(tiny);
    run.start();
    const beats = run.choose(1);
    expect(beats.find((b) => b.kind === 'morale')).toEqual({ kind: 'morale', value: 0, delta: -1, max: 4 });
    expect(run.options().map((o) => o.option.id)).toEqual(['hurt']);
  });
});
