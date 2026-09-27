import { describe, expect, it } from 'vitest';
import { createRng } from '../engine/rng';
import { hiss, impulse, pulseSeries, triangleSeries } from './engine';
import { BARS, BEAT, BEATS, LOOP, LOOP_BEATS, RANGE, SCORE, SECTIONS, TEMPO, bars, build, midi } from './score';

const of = (part: string) => SCORE.filter((n) => n.part === part);

describe('score', () => {
  it('loops every 24 bars of 4/4 at 76 BPM: 75.8 s, between one and two minutes', () => {
    expect(TEMPO).toBeGreaterThanOrEqual(70);
    expect(TEMPO).toBeLessThanOrEqual(84);
    expect(SECTIONS.map((s) => s.name)).toEqual(['A', "A'", 'B']);
    expect(BARS).toBe(24);
    expect(LOOP_BEATS).toBe(BARS * BEATS);
    expect(LOOP).toBeCloseTo(LOOP_BEATS * BEAT, 9);
    expect(LOOP).toBeCloseTo(75.789, 3);
    expect(LOOP).toBeGreaterThan(60);
    expect(LOOP).toBeLessThan(120);
  });

  it('reads the notation: names to MIDI keys, bars of eight eighths', () => {
    expect([midi('A4'), midi('C4'), midi('Bb4'), midi('C#2'), midi('Db5')]).toEqual([69, 60, 70, 37, 73]);
    expect(bars('D5:3 C5:1 A4:4 | r:8')).toEqual([
      [{ key: 74, at: 0, len: 3 }, { key: 72, at: 3, len: 1 }, { key: 69, at: 4, len: 4 }],
      [{ key: null, at: 0, len: 8 }],
    ]);
    expect(() => bars('D5:3 C5:1')).toThrow(/holds 4 eighths/);
    expect(() => bars('H4:8')).toThrow(/not a note/);
  });

  it('keeps every note inside the loop, so nothing is cut at the seam', () => {
    for (const n of SCORE) {
      expect(n.at).toBeGreaterThanOrEqual(0);
      expect(n.at).toBeLessThan(LOOP_BEATS);
      expect(n.len).toBeGreaterThan(0);
      if (n.part !== 'pad') expect(n.at + n.len).toBeLessThanOrEqual(LOOP_BEATS + 1e-9);
    }
    // the only notes past the end are the pad's last chord tied into the first, which then sounds once
    const over = SCORE.filter((n) => n.at + n.len > LOOP_BEATS + 1e-9);
    const tied = SCORE.filter((n) => n.tied);
    expect(over.map((n) => n.key).sort()).toEqual(tied.map((n) => n.key).sort());
    expect(tied.map((n) => n.key).sort()).toEqual([midi('A3'), midi('E4')]); // A (A C♯ E) → Dm9 (F A C E)
    for (const n of tied) expect(n.at).toBe(0);
  });

  it('keeps each part in its instrument’s range', () => {
    for (const [part, [lo, hi]] of Object.entries(RANGE)) {
      const keys = of(part).map((n) => n.key);
      expect(keys.length).toBeGreaterThan(0);
      expect(Math.min(...keys)).toBeGreaterThanOrEqual(lo);
      expect(Math.max(...keys)).toBeLessThanOrEqual(hi);
    }
    for (const n of SCORE) {
      expect(n.vel).toBeGreaterThanOrEqual(0);
      expect(n.vel).toBeLessThanOrEqual(1);
    }
  });

  it('leads home across the seam: the last bar is A, its bass C♯ a semitone under the first D', () => {
    const bass = of('bass');
    expect(bass[0]).toMatchObject({ at: 0, key: midi('D2') });
    expect(bass[bass.length - 1].key).toBe(midi('C#2'));
    // the tune rests over the seam: its last note ends with the loop, its first starts on beat 2
    const lead = of('lead');
    expect(lead[0].at).toBe(1);
    expect(lead[lead.length - 1].at + lead[lead.length - 1].len).toBe(LOOP_BEATS);
  });

  it('ticks through A and A′ and is silent in B, where only the flashback ticks', () => {
    const ticks = of('tick');
    expect(ticks).toHaveLength(LOOP_BEATS);
    expect(ticks.filter((n) => n.vel > 0)).toHaveLength(16 * BEATS);
    expect(ticks.every((n) => (n.at < 16 * BEATS) === n.vel > 0)).toBe(true);
  });

  it('is the same every time it is built', () => {
    expect(build()).toEqual(build());
    expect(build()).toEqual(SCORE);
  });
});

describe('engine sounds', () => {
  it('makes pulse waves of a sine’s loudness; a square has no even harmonics', () => {
    for (const duty of [0.125, 0.25, 0.5]) {
      const re = pulseSeries(duty, 14);
      expect(re.reduce((e, x) => e + x * x, 0)).toBeCloseTo(1, 5);
    }
    const square = pulseSeries(0.5, 14);
    for (let k = 2; k < square.length; k += 2) expect(Math.abs(square[k])).toBeLessThan(1e-6);
  });

  it('makes the stepped triangle: odd harmonics, falling as 1/n², and the steps’ faint buzz', () => {
    const { re, im } = triangleSeries();
    const mag = (m: number) => Math.hypot(re[m], im[m]);
    expect(mag(2)).toBeLessThan(1e-6);
    expect(mag(3) / mag(1)).toBeCloseTo(1 / 9, 2);
    expect(mag(31) / mag(1)).toBeGreaterThan(0.02); // the 32 steps alias to 31 and 33
    expect(mag(31) / mag(1)).toBeLessThan(0.05);
  });

  it('generates the same reverb impulse and hiss from the same seed', () => {
    const a = impulse(8000, createRng(11)), b = impulse(8000, createRng(11));
    expect(a[0]).toEqual(b[0]);
    expect(a[0]).not.toEqual(a[1]); // two uncorrelated channels
    const energy = (x: Float32Array, from: number, to: number) => x.slice(from, to).reduce((e, v) => e + v * v, 0);
    const n = a[0].length;
    expect(energy(a[0], 0, n)).toBeCloseTo(1, 4);
    expect(energy(a[0], Math.floor(n * 0.9), n)).toBeLessThan(1e-4 * energy(a[0], 0, Math.floor(n * 0.1)));
    expect(hiss(8000, createRng(8))).toEqual(hiss(8000, createRng(8)));
  });

  it('crossfades the hiss loop so its end runs into its start', () => {
    const h = hiss(8000, createRng(8));
    const steps = [...h.slice(1)].map((v, i) => Math.abs(v - h[i]));
    const typical = steps.reduce((s, v) => s + v, 0) / steps.length;
    expect(Math.abs(h[0] - h[h.length - 1])).toBeLessThan(4 * typical);
  });
});
