import { describe, expect, it } from 'vitest';
import { parseUi } from './ui';

describe('parseUi', () => {
  it('is the original panel and HUD by default, and when asked for', () => {
    expect(parseUi('')).toBe('de');
    expect(parseUi('?ui=de')).toBe('de');
    expect(parseUi('?still&view=2&style=13&ui=de&lang=en')).toBe('de');
    expect(parseUi('?style=1')).toBe('de');
  });

  it('is the book (null) for ?ui=book only', () => {
    expect(parseUi('?ui=book')).toBeNull();
    expect(parseUi('?still&ui=book&look=warm&lang=en')).toBeNull();
    expect(parseUi('?ui=')).toBe('de');
    expect(parseUi('?ui=BOOK')).toBe('de');
  });
});
