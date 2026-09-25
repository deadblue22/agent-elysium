// The style-board moment (`?still`, `npm run shot`): study.clock right after Visual Calculus
// passes. It is produced by the engine itself, playing the real chapter along a scripted path
// with the dice forced to 4 + 5, so the board can never drift from the playable content.
import { Runner } from '../engine/runner';
import type { LogEntry } from './schema';
import { study } from './study';

function buildClockMoment(): LogEntry[] {
  const run = new Runner(study, { seed: 1, forcedDice: [[4, 5]] });
  run.start();
  run.choose(1); // 检查壁炉上的钟。
  run.choose(1); // [见微知著 - 中等 10] 把钟转过来，看看背面。 → 4 + 5 + 3 = 12
  const page = run.page();
  // start the board at the player's first choice, as the committed frame does
  let from = 0;
  page.forEach((e, i) => {
    if (e.kind === 'line' && e.line.speaker === 'you' && from === 0) from = i;
  });
  return page.slice(from);
}

/** The log as it stands in the style-board moment. */
export const clockMoment: LogEntry[] = buildClockMoment();

/** Chrome and page furniture strings. */
export const chrome = {
  title: { zh: '《雪落之前》', en: 'Before the Snow' },
  chapter: { zh: '第一章', en: 'Chapter One' },
  morale: { zh: '士气', en: 'MORALE' },
  logHeading: { zh: '日志', en: 'Log' },
};
