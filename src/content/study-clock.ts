// Chapter 1, node study.clock (docs/design.md §4.4), and the frozen moment the style
// board shows: the clock examined, turned around, Visual Calculus passed, Kask noting it.
import type { Check, LogEntry, Node, Option } from './schema';
import { SKILLS } from './skills';

/** The study.intro option that leads here. */
export const examineClock: Option = {
  text: { zh: '检查壁炉上的钟。', en: 'Examine the clock on the mantel.' },
  next: 'study.clock',
};

const turnClockCheck: Check = {
  skill: 'visualCalculus', dc: 10, kind: 'white',
  success: 'study.clock.success', failure: 'study.clock.failure',
};

export const turnClock: Option = {
  text: { zh: '把钟转过来看背面。', en: 'Turn the clock around.' },
  check: turnClockCheck,
};

export const stepBack: Option = {
  text: { zh: '回到房间中央。', en: 'Step back.' },
  next: 'study.intro',
};

export const nodes: Record<string, Node> = {
  'study.clock': {
    id: 'study.clock',
    lines: [{
      speaker: 'narrator',
      text: {
        zh: '一座黄铜座钟，玻璃罩里的钟摆一动不动。指针停在 23:40。',
        en: 'A brass mantel clock, its pendulum motionless behind the glass. The hands are stopped at 23:40.',
      },
    }],
    passive: [{ skill: 'encyclopedia', dc: 6, kind: 'passive', success: 'study.clock.encyclopedia', failure: 'study.clock' }],
    options: [turnClock, stepBack],
  },
  'study.clock.encyclopedia': {
    id: 'study.clock.encyclopedia',
    lines: [{
      speaker: 'encyclopedia',
      text: {
        zh: '这种带钟摆的座钟受到撞击时会停摆。推理小说很喜欢这个桥段：死者倒下时撞停了钟，死亡时间就被永远记录下来。作家们很喜欢。凶手们也很喜欢。',
        en: 'Pendulum clocks of this kind stop when knocked. Detective novels are fond of the device: the victim falls, the clock stops, and the hour of death is recorded forever. Writers love it. So do murderers.',
      },
    }],
    options: [],
  },
  'study.clock.success': {
    id: 'study.clock.success',
    lines: [
      {
        speaker: 'visualCalculus',
        text: {
          zh: '后盖上的调针旋钮有新鲜的划痕，方向是顺时针，而且不止一圈。有人在钟停摆之后拨过指针。',
          en: 'The regulator knob on the back carries fresh scratches, clockwise, more than one turn. Someone moved the hands after the clock stopped.',
        },
      },
      { speaker: 'kask', text: { zh: '「记下了。」', en: '“Noted.”' } },
    ],
    options: [stepBack],
    effects: [{ type: 'flag', key: 'clock_tampered', value: true }],
  },
  'study.clock.failure': {
    id: 'study.clock.failure',
    lines: [
      {
        speaker: 'visualCalculus',
        text: {
          zh: '后盖上有划痕。也可能是六十七年的划痕。你分不出来。',
          en: "There are scratches on the back. They could be sixty-seven years of scratches. You can't tell.",
        },
      },
      { speaker: 'kask', text: { zh: '「警探，把它放回去。轻一点。」', en: '“Detective. Put it back. Gently.”' } },
    ],
    options: [stepBack],
  },
};

const dice: [number, number] = [4, 5];
const total = dice[0] + dice[1] + SKILLS.visualCalculus.value;

/** The log as it stands in the style-board moment (eight entries). */
export const clockMoment: LogEntry[] = [
  { kind: 'choice', text: examineClock.text },
  { kind: 'line', line: nodes['study.clock'].lines[0] },
  { kind: 'line', line: nodes['study.clock.encyclopedia'].lines[0] },
  { kind: 'choice', text: turnClock.text },
  { kind: 'check', check: turnClockCheck, dice, total, success: total >= turnClockCheck.dc },
  { kind: 'line', line: nodes['study.clock.success'].lines[0] },
  { kind: 'line', line: nodes['study.clock.success'].lines[1] },
  { kind: 'option', index: 0, option: stepBack },
];

/** Chrome and page furniture strings. */
export const chrome = {
  title: { zh: '《雪落之前》', en: 'Before the Snow' },
  chapter: { zh: '第一章', en: 'Chapter One' },
  morale: { zh: '士气', en: 'MORALE' },
  logHeading: { zh: '日志', en: 'Log' },
};
