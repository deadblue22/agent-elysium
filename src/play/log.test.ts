import { describe, expect, it } from 'vitest';
import { TYPE_MS, typeSchedule } from './log';

describe('typeSchedule', () => {
  it('types one character per step, 55 ms in Chinese and 28 ms in English', () => {
    expect(TYPE_MS).toEqual({ zh: 55, en: 28 });
    expect(typeSchedule('一二三', 'zh')).toEqual([55, 110, 165]);
    expect(typeSchedule('abc', 'en')).toEqual([28, 56, 84]);
  });

  it('pauses after a comma (+120) and after a sentence (+260) in Chinese', () => {
    // 甲，乙。丙: the pause lands before the character after the mark
    expect(typeSchedule('甲，乙。丙', 'zh')).toEqual([55, 110, 110 + 120 + 55, 285 + 55, 340 + 260 + 55]);
  });

  it('pauses once after a run of marks, for its longest pause', () => {
    // 「好。」他 — the sentence pause waits until after the closing quote
    const at = typeSchedule('「好。」他', 'zh');
    expect(at[3] - at[2]).toBe(55);
    expect(at[4] - at[3]).toBe(55 + 260);
    // …… pauses once
    const e = typeSchedule('啊……嗯', 'zh');
    expect(e[2] - e[1]).toBe(55);
    expect(e[3] - e[2]).toBe(55 + 260);
  });

  it('pauses in English only before a space (+80 comma, +180 sentence), after closing quotes', () => {
    const at = typeSchedule('Yes, no. "Stop." 23:40', 'en');
    const gap = (i: number) => at[i] - at[i - 1];
    expect(gap(4)).toBe(28 + 80);   // the space after "Yes,"
    expect(gap(8)).toBe(28 + 180);  // the space after "no."
    expect(gap(15)).toBe(28);       // the closing quote follows the full stop at once
    expect(gap(16)).toBe(28 + 180); // and the pause comes after it
    expect(gap(20)).toBe(28);       // 23:40 types straight through
  });

  it('adds no pause after the last character', () => {
    expect(typeSchedule('完。', 'zh')).toEqual([55, 110]);
  });
});
