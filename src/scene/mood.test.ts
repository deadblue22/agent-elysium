import { describe, expect, it } from 'vitest';
import { moodShadows, parseMood } from './mood';

describe('parseMood', () => {
  it('reads the look, among the other parameters', () => {
    expect(parseMood('?look=winter')).toBe('winter');
    expect(parseMood('?still&style=13&look=noir&view=0')).toBe('noir');
    expect(parseMood('?still&look=warm&ui=book')).toBeNull();
  });

  it('is winter without a parameter, or with one it does not know', () => {
    expect(parseMood('')).toBe('winter');
    expect(parseMood('?look=')).toBe('winter');
    expect(parseMood('?look=summer')).toBe('winter');
    expect(parseMood('?style=2')).toBe('winter');
  });
});

describe('moodShadows', () => {
  it('hardens the key only for the winter sun; the default keeps its penumbra', () => {
    expect(moodShadows(null)).toBeUndefined();
    expect(moodShadows('noir')).toBeUndefined();
    const s = moodShadows('winter')!;
    expect(s.angle).toBeLessThan(4);
    expect(s.max).toBeLessThan(0.4);
  });
});
