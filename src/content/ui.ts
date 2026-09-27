// Interface strings of the playable chapter that are not dialogue: the flashback's time
// marker, the new-lead notice, card and counter, the continue marker, the end page, the
// check tooltip, the crit phrases.
// tools/subset-fonts.mjs sets everything exported as `ui` in the sans subset (labels), and
// every string here is in the serif as well.
import { GREYED_REASON } from '../engine/runner';
import type { Text } from './schema';

const t = (zh: string, en: string): Text => ({ zh, en });

export const ui = {
  /** The chrome's time marker while the reconstruction plays: what the time really was ({t}: 22:30). */
  lastNight: t('昨晚 {t}', 'Last night, {t}'),
  /** A new lead: the log's boxed tag (「新线索　指针被拨过（1/3）」) and the card's heading. */
  leadTag: t('新线索', 'NEW LEAD'),
  /** The blinking continue marker at the bottom right of the log, while it waits for a click. */
  continue: t('▼ 继续', '▼ CONTINUE'),
  /** The same as the original's CONTINUE bar (?style=1), its arrow drawn after it. */
  continueBar: t('继续', 'CONTINUE'),
  /** A new lead as the original's system line (?style=1): 「新线索：指针被拨过（1/3）」. */
  leadLine: t('新线索：', 'New lead: '),
  /** The log's last line, once the candle is out. */
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
  /** The check card's two fixed rolls (?style=1): snake eyes always fail, boxcars always pass (§5.2). */
  alwaysLoses: t('必定失败', 'ALWAYS LOSES'),
  alwaysWins: t('必定成功', 'ALWAYS WINS'),
  /** The slips on the table (?style=3), as the original's banners. */
  checkSuccess: t('检定成功', 'CHECK SUCCESS'),
  checkFailure: t('检定失败', 'CHECK FAILURE'),
  moraleSlip: t('士气受损', 'DAMAGED MORALE'),
};

/** Snake eyes and boxcars (§5.3), printed after the roll. */
export const CRIT = {
  snake: t('蛇眼。', 'Snake eyes.'),
  boxcars: t('满贯。', 'Boxcars.'),
};
