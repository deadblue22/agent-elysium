import { describe, expect, it } from 'vitest';
import { LOOKS, kuwaharaTaps, parsePaint } from './paint';

describe('parsePaint', () => {
  it('reads ?paint, ?paint=1 and ?paint=2', () => {
    expect(parsePaint('?paint')).toBe(1);
    expect(parsePaint('?paint=1')).toBe(1);
    expect(parsePaint('?still&view=3&paint=2&style=13')).toBe(2);
  });

  it('ignores anything else: no parameter is the current look', () => {
    expect(parsePaint('')).toBe(0);
    expect(parsePaint('?paint=0')).toBe(0);
    expect(parsePaint('?paint=3')).toBe(0);
    expect(parsePaint('?paints=1')).toBe(0);
  });
});

describe('LOOKS', () => {
  it('keeps every stroke within the 3 x 3 cells a pixel looks at', () => {
    for (const k of Object.values(LOOKS)) {
      for (const [, half, width] of [k.coarse, k.fine]) {
        expect(half).toBeLessThanOrEqual(1);
        expect(width).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('kuwaharaTaps', () => {
  it('weighs every sector, with finite, non-negative weights', () => {
    for (const { radius } of Object.values(LOOKS)) {
      const { centre, taps } = kuwaharaTaps(radius);
      expect(centre).toBeGreaterThan(0);
      // a sector's total: the centre, its own weight at each point and its opposite's at the mirror image
      const total = Array.from({ length: 8 }, (_, k) => centre + taps.reduce((s, t) => s + t.w[k] + t.w[(k + 4) % 8], 0));
      for (const t of taps) for (const w of t.w) expect(Number.isFinite(w) && w >= 0).toBe(true);
      // the half rings are not four-fold symmetric, so the sectors differ a little, but none starves
      expect(Math.min(...total) / Math.max(...total)).toBeGreaterThan(0.8);
    }
  });
});
