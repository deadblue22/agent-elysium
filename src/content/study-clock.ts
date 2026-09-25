// Chapter 1, node study.clock (docs/design.md §4.4), and the frozen moment the style board
// shows: the clock examined, turned around, Visual Calculus passed, Kim noting it.
import type { Check, LogEntry, Node, Option } from './schema';
import { SKILLS } from './skills';

/** The study.intro option that leads here. */
export const examineClock: Option = {
  text: { zh: '检查壁炉上的钟。', en: 'Examine the clock on the mantelpiece.' },
  next: 'study.clock',
};

const turnClockCheck: Check = {
  skill: 'visualCalculus', dc: 10, kind: 'white',
  success: 'study.clock.success', failure: 'study.clock.failure',
};

export const turnClock: Option = {
  text: { zh: '把钟转过来，看看背面。', en: 'Turn the clock around.' },
  check: turnClockCheck,
};

export const clockIsLying: Option = {
  text: { zh: '「这只钟在撒谎，金。」', en: '"This clock is lying, Kim."' },
  requires: { flags: ['clock_tampered'] },
  next: 'study.clock.lying',
};

export const stepBack: Option = {
  text: { zh: '回到房间中央。', en: 'Step back.' },
  next: 'study.intro',
};

export const nodes: Record<string, Node> = {
  'study.clock': {
    id: 'study.clock',
    lines: [{
      speaker: { zh: '黄铜座钟', en: 'Brass Mantel Clock' },
      text: {
        zh: '一只黄铜座钟。玻璃罩后的钟摆一动不动。指针停在 23:40。',
        en: 'A brass mantel clock. Behind the glass the pendulum hangs motionless. The hands have stopped at 23:40.',
      },
    }],
    passive: [{ skill: 'encyclopedia', dc: 6, kind: 'passive', success: 'study.clock.encyclopedia', failure: 'study.clock' }],
    options: [turnClock, clockIsLying, stepBack],
  },
  'study.clock.encyclopedia': {
    id: 'study.clock.encyclopedia',
    lines: [{
      speaker: 'encyclopedia',
      result: { dc: 6, success: true },
      text: {
        zh: '瑞瓦肖晚期工坊的摆钟，受到重击就会停摆。侦探小说对此情有独钟：死者倒下，钟停了，死亡时间被永远保存下来。作家喜欢这个桥段。凶手也喜欢。',
        en: 'A late Revacholian workshop pendulum clock. Knock one hard and it stops. Detective fiction adores the device: the victim falls, the clock stops, the hour of death is preserved forever. Writers love it. So do murderers.',
      },
    }],
    options: [],
  },
  'study.clock.success': {
    id: 'study.clock.success',
    lines: [
      {
        speaker: 'visualCalculus',
        result: { dc: 10, success: true },
        text: {
          zh: '模型在你脑中搭了起来：调针旋钮上有三道新鲜划痕，全是顺时针，转了不止一圈。钟停摆之后，有人拨过指针。',
          en: 'The model assembles itself: three fresh scratches on the regulator knob, all clockwise, more than one full turn. Someone moved the hands after the clock had stopped.',
        },
      },
      {
        speaker: 'kim',
        text: { zh: '「记下了。」他在笔记本上写了一行字。', en: '"Noted." He writes a line in his notebook.' },
      },
    ],
    // the white check passed, so its option is gone; the lie can now be called
    options: [clockIsLying, stepBack],
    effects: [{ type: 'flag', key: 'clock_tampered', value: true }],
  },
  'study.clock.failure': {
    id: 'study.clock.failure',
    lines: [
      {
        speaker: 'visualCalculus',
        result: { dc: 10, success: false },
        text: {
          zh: '后盖上有划痕。可能是昨晚的，也可能是六十七年攒下来的。模型拒绝成形。',
          en: "There are scratches on the back. Last night's, or sixty-seven years' worth. The model refuses to form.",
        },
      },
      { speaker: 'kim', text: { zh: '「警探，把它放回去。轻一点。」', en: '"Detective. Put it back. Gently."' } },
    ],
    options: [stepBack],
  },
  'study.clock.lying': {
    id: 'study.clock.lying',
    lines: [{
      speaker: 'kim',
      text: { zh: '「钟不会撒谎，警探。」他看了一眼表盘。「拨它的人会。」', en: '"Clocks don\'t lie, detective." He glances at the dial. "The people who set them do."' },
    }],
    options: [stepBack],
  },
};

const dice: [number, number] = [4, 5];
const total = dice[0] + dice[1] + SKILLS.visualCalculus.value;
const success = nodes['study.clock.success'];

/** The log as it stands in the style-board moment. */
export const clockMoment: LogEntry[] = [
  { kind: 'line', line: { speaker: 'you', text: examineClock.text } },
  { kind: 'line', line: nodes['study.clock'].lines[0] },
  { kind: 'line', line: nodes['study.clock.encyclopedia'].lines[0] },
  { kind: 'line', line: { speaker: 'you', text: turnClock.text } },
  { kind: 'check', check: turnClockCheck, dice, total, success: total >= turnClockCheck.dc },
  { kind: 'line', line: success.lines[0] },
  { kind: 'line', line: success.lines[1] },
  ...success.options.map((option, i): LogEntry => ({ kind: 'option', number: i + 1, index: nodes['study.clock'].options.indexOf(option), option })),
];

/** Chrome and page furniture strings. */
export const chrome = {
  title: { zh: '《雪落之前》', en: 'Before the Snow' },
  chapter: { zh: '第一章', en: 'Chapter One' },
  morale: { zh: '士气', en: 'MORALE' },
  logHeading: { zh: '日志', en: 'Log' },
};
