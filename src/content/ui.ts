// Interface strings of the playable chapter that are not dialogue: the flashback's time
// marker, the new-lead notice, card and counter, the continue marker, the end page, the
// check tooltip, the crit phrases.
// tools/subset-fonts.mjs sets everything exported as `ui` in the sans subset (labels), and
// every string here is in the serif as well.
import { GREYED_REASON } from '../engine/runner';
import type { Text } from './schema';

const t = (zh: string, en: string): Text => ({ zh, en });

export const ui = {
  /** The chrome's time marker while the reconstruction plays (stage cue flashback). */
  lastNight: t('昨晚 22:30', 'Last night, 22:30'),
  /** A new lead: the log's boxed tag (「新线索　指针被拨过（1/3）」) and the card's heading. */
  leadTag: t('新线索', 'NEW LEAD'),
  /** Under the morale hearts: 「线索 1/3」. */
  leads: t('线索', 'LEADS'),
  /** The blinking continue marker at the bottom right of the log, while it waits for a click. */
  continue: t('▼ 继续', '▼ CONTINUE'),
  /** The blank page under the right sheet (stage cue page-turn). */
  chapterEnd: t('第一章 完', 'End of Chapter One'),
  /** Check tooltip: 「成功率 72%」. */
  chance: t('成功率', 'Chance'),
  /** Tooltip heading over a check's modifiers. */
  modifiers: t('修正', 'Modifiers'),
  /** Tooltip of a greyed option: why it waits. */
  greyed: GREYED_REASON,
  /** A red check can be tried only once. */
  redCheck: t('红色检定：只有一次机会。', 'Red check: one attempt only.'),
  /** A white check can be retried later. */
  whiteCheck: t('白色检定：失败后可以再试。', 'White check: can be retried after a failure.'),
};

/** Snake eyes and boxcars (§5.3), printed after the roll. */
export const CRIT = {
  snake: t('蛇眼。', 'Snake eyes.'),
  boxcars: t('满贯。', 'Boxcars.'),
};
