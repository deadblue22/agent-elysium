import { describe, expect, it } from 'vitest';
import { parseStyle } from './style';

describe('parseStyle', () => {
  it('reads one preset, or several as digits', () => {
    expect([...parseStyle('?style=2')]).toEqual([2]);
    expect([...parseStyle('?still&style=13')].sort()).toEqual([1, 3]);
  });

  it('ignores anything else: no parameter is the current look', () => {
    expect(parseStyle('').size).toBe(0);
    expect(parseStyle('?style=').size).toBe(0);
    expect([...parseStyle('?style=4x1')]).toEqual([1]);
  });
});
