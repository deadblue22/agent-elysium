import { describe, expect, it } from 'vitest';
import { parseUi } from './ui';

describe('parseUi', () => {
  it('reads the presentation, alongside the other parameters', () => {
    expect(parseUi('?ui=de')).toBe('de');
    expect(parseUi('?still&view=2&style=13&ui=de&lang=en')).toBe('de');
  });

  it('ignores anything else: no parameter is the current look', () => {
    expect(parseUi('')).toBeNull();
    expect(parseUi('?ui=')).toBeNull();
    expect(parseUi('?ui=DE')).toBeNull();
    expect(parseUi('?style=1')).toBeNull();
  });
});
