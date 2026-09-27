// The chapter's music: an original piece written for this demo (docs/music.md), in the manner
// of a 16-bit console game's quiet town theme at night. Only a mood is borrowed, the tired
// warmth of a run-down hostel cafeteria in the morning; no melody, harmony, bass line or
// rhythm is taken from any existing piece.
//
// D minor with the Dorian sixth (B natural), 76 BPM, 4/4, 24 bars that loop (75.8 s):
//   A   bars  1–8   the theme: a pulse lead over a broken-chord arpeggio, a quiet pad and a
//                   triangle bass; a clock ticks (tick, tock, the tock a little late)
//   A'  bars  9–16  the theme again, a second voice in sixths under its answer, a soft brush
//                   every other bar; it turns to F (C7)
//   B   bars 17–24  F major: the theme's opening figure over new chords, rolling triplets, a
//                   rounder lead, a brush a bar, no clock; B♭m → A (D♭ held as C♯) leads home
// This module is data and a small notation (see `bars`); src/audio/engine.ts plays the notes.
import { createRng } from '../engine/rng';

export const TEMPO = 76;
export const BEATS = 4;
/** Seconds per beat. */
export const BEAT = 60 / TEMPO;
/** The notation's unit: eighths per bar. */
const STEPS = 8;

export type Part = 'lead' | 'echo' | 'arp' | 'pad' | 'bass' | 'tick' | 'brush' | 'crackle';

export interface Note {
  part: Part;
  /** Start, in beats from the top of the loop. */
  at: number;
  /** Length, in beats. */
  len: number;
  /** MIDI key (60 = C4, 69 = A4). Tick: 1 tick, 0 tock. Crackle: which click (0–2). Brush: 0. */
  key: number;
  /** Loudness, 0–1. */
  vel: number;
  /** The pulse's duty cycle (lead, echo, arpeggio): 0.125 thin, 0.25, 0.5 round. */
  duty?: number;
  /** Stereo position, −1–1 (crackles; the other parts sit where the mix puts them). */
  pan?: number;
  /**
   * A pad note at the top of the loop that the last bar's pad already holds (a tie across the
   * loop): it sounds the first time through only, and the engine lets the tie ring on after.
   */
  tied?: boolean;
}

/**
 * The sections in order. `bars` is their length; per part: loudness and the pulse's duty.
 * The arpeggio plays `per` notes a beat, stepping through `order`: indices into the chord's
 * pool (its voicing, low to high, then the two lowest notes an octave up). The clock ticks
 * every beat at `tick` (0: silent; the flashback still ticks). Brushes: on `beats` (0–3) of
 * every `every`-th bar of the section.
 */
export const SECTIONS = [
  {
    name: 'A', bars: 8,
    lead: { vel: 0.85, duty: 0.25 }, echo: 0.8, bass: 0.85, pad: 0.5,
    arp: { per: 2, order: [0, 2, 4, 3, 1, 3, 2, 4], vel: 0.55, duty: 0.5 },
    tick: 0.7, brush: null,
  },
  {
    name: "A'", bars: 8,
    lead: { vel: 0.92, duty: 0.25 }, echo: 0.85, bass: 0.95, pad: 0.7,
    arp: { per: 2, order: [0, 2, 4, 3, 1, 3, 2, 4], vel: 0.65, duty: 0.5 },
    tick: 0.7, brush: { every: 2, beats: [2], vel: 0.55 },
  },
  {
    name: 'B', bars: 8,
    lead: { vel: 1, duty: 0.5 }, echo: 0.9, bass: 0.9, pad: 0.9,
    arp: { per: 3, order: [0, 1, 2, 1, 2, 3, 2, 3, 4, 3, 2, 1], vel: 0.5, duty: 0.25 },
    tick: 0, brush: { every: 1, beats: [2], vel: 0.45 },
  },
];
export const BARS = SECTIONS.reduce((n, s) => n + s.bars, 0);
export const LOOP_BEATS = BARS * BEATS;
/** The loop's length, seconds. */
export const LOOP = LOOP_BEATS * BEAT;

// Lines in eighths, bars separated by '|': 'A4:3' is A4 for three eighths, 'r:2' a quarter
// rest, 'Bb4' B flat, 'C#2' C sharp. Every bar must fill eight eighths.

/** The tune (pulse lead). */
const LEAD = `
  r:2 A4:1 C5:1 E5:4 | D5:3 C5:1 A4:4 | B4:2 D5:2 E5:1 D5:1 B4:2 | A4:6 r:2 |
  r:2 F5:3 E5:1 D5:2 | C5:3 A4:1 C5:2 D5:2 | Bb4:2 A4:1 G4:1 E4:4 | F4:2 E4:4 r:2 |

  r:2 A4:1 C5:1 E5:2 F5:1 E5:1 | D5:3 C5:1 A4:2 G4:1 A4:1 | B4:2 D5:2 G5:2 E5:2 | D5:6 r:2 |
  r:2 F5:3 E5:1 D5:2 | C5:3 A4:1 F4:2 A4:2 | G4:3 A4:1 Bb4:2 D5:2 | C5:6 r:2 |

  A4:3 C5:1 E5:4 | D5:3 E5:1 G5:4 | F5:4 E5:2 D5:2 | D5:6 C5:1 Bb4:1 |
  C5:4 E5:4 | D5:3 C5:1 Bb4:2 A4:2 | Db5:6 C5:2 | A4:4 G4:2 E4:2 |
`;

/** The second voice (thin pulse): answers in A, sixths under the lead in A', thirds in B. */
const ECHO = `
  r:8 | r:8 | r:8 | r:2 D4:2 E4:2 G4:2 |
  r:8 | r:8 | r:8 | r:4 A3:2 C#4:2 |

  r:8 | r:8 | r:8 | r:2 E4:2 G4:2 A4:2 |
  r:2 A4:3 G4:1 F4:2 | E4:3 C4:1 A3:2 C4:2 | Bb3:3 C4:1 D4:2 F4:2 | E4:6 r:2 |

  r:8 | r:8 | r:8 | r:8 |
  A4:4 C5:4 | Bb4:3 A4:1 G4:2 F4:2 | F4:6 G4:2 | C#4:4 r:4 |
`;

/** The bass (triangle): roots on the beat; the last bar's C♯ leads back to the top's D. */
const BASS = `
  D2:4 A2:2 C3:2 | D2:4 A2:2 D3:2 | D2:4 B2:2 D3:2 | D2:6 B1:2 |
  Bb1:4 F2:2 A2:2 | A1:4 C2:2 F2:2 | G1:4 D2:2 E2:2 | A1:4 E2:2 C#2:2 |

  D2:3 A2:1 C3:2 A2:2 | D2:3 A2:1 D3:2 C3:2 | D2:3 B2:1 D3:2 B2:2 | D2:3 A2:1 G2:2 B1:2 |
  Bb1:3 F2:1 A2:2 F2:2 | A1:3 E2:1 F2:2 A2:2 | G1:3 D2:1 Bb2:2 G2:2 | C2:4 G2:2 E2:2 |

  F2:4 C3:2 A2:2 | E2:4 G2:2 C3:2 | D2:4 A2:2 F2:2 | Bb1:4 F2:2 D2:2 |
  A1:4 E2:2 G2:2 | G1:4 D2:2 F2:2 | Bb1:4 Db2:2 F2:2 | A1:4 E2:2 C#2:2 |
`;

/** The chords, a bar each; two names split the bar in halves. The bass line carries the roots. */
const CHART = [
  'Dm9', 'Dm9', 'G6/D', 'G6/D', 'Bbmaj7', 'F/A', 'Gm6', 'Asus4 A7',
  'Dm9', 'Dm9', 'G6/D', 'G6/D', 'Bbmaj7', 'F/A', 'Gm7', 'C7sus4 C7',
  'Fmaj7', 'C/E', 'Dm7', 'Bbmaj7', 'Am7', 'Gm7', 'Bbm', 'A',
];

/**
 * How the pad and the arpeggio voice each chord: close, in the middle register, the notes
 * moving by step from chord to chord (Gm7 → B♭m → A moves D → D♭ = C♯, F → E, B♭ → A).
 */
const VOICING: Record<string, string> = {
  Dm9: 'F3 A3 C4 E4', 'G6/D': 'G3 B3 D4 E4', Bbmaj7: 'A3 D4 F4', 'F/A': 'A3 C4 F4',
  Gm6: 'Bb3 D4 E4', Gm7: 'Bb3 D4 F4', Asus4: 'A3 D4 E4', A7: 'G3 C#4 E4',
  C7sus4: 'Bb3 C4 F4', C7: 'Bb3 C4 E4', Fmaj7: 'A3 C4 E4', 'C/E': 'G3 C4 E4',
  Dm7: 'A3 C4 F4', Am7: 'G3 C4 E4', Bbm: 'Bb3 Db4 F4', A: 'A3 C#4 E4',
};

/** Each part's range (MIDI keys, inclusive), as the instruments are voiced. */
export const RANGE: Partial<Record<Part, [number, number]>> = {
  lead: [60, 81], echo: [53, 74], arp: [52, 76], pad: [48, 67], bass: [28, 52],
};

const PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'Bb4' → 70, 'C#2' → 37, 'A4' → 69. */
export function midi(name: string): number {
  const m = /^([A-G])(b|#)?(\d)$/.exec(name);
  if (!m) throw new Error(`[score] not a note: ${name}`);
  return 12 * (Number(m[3]) + 1) + PITCH[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** A line, bar by bar: each note's key (null for a rest), start and length in eighths. */
export function bars(src: string): { key: number | null; at: number; len: number }[][] {
  return src.split('|').map((s) => s.trim()).filter(Boolean).map((bar, b) => {
    let at = 0;
    const notes = bar.split(/\s+/).map((token) => {
      const [name, n] = token.split(':');
      const len = Number(n);
      if (!(len > 0)) throw new Error(`[score] bar ${b + 1}: no length in ${token}`);
      const note = { key: name === 'r' ? null : midi(name), at, len };
      at += len;
      return note;
    });
    if (at !== STEPS) throw new Error(`[score] bar ${b + 1} holds ${at} eighths, not ${STEPS}: ${bar}`);
    return notes;
  });
}

/** The section a bar (0-based) belongs to, and the bar's place in it. */
function section(bar: number) {
  let first = 0;
  for (const s of SECTIONS) {
    if (bar < first + s.bars) return { s, i: bar - first };
    first += s.bars;
  }
  throw new Error(`[score] bar ${bar + 1} is past the end`);
}

/** Every note of one pass through the loop, in time order. The same every time it is called. */
export function build(): Note[] {
  const notes: Note[] = [];
  const R = createRng(1979); // the arpeggio's and the bass's small unevenness, the crackles

  // the tune, the second voice and the bass, as written
  const line = (part: Part, src: string, shape: (bar: number) => { vel: number; duty?: number }) => {
    const all = bars(src);
    if (all.length !== BARS) throw new Error(`[score] ${part} has ${all.length} bars, not ${BARS}`);
    all.forEach((bar, b) => {
      for (const n of bar) {
        if (n.key === null) continue;
        const { vel, duty } = shape(b);
        notes.push({ part, at: b * BEATS + n.at / 2, len: n.len / 2, key: n.key, vel, ...(duty ? { duty } : {}) });
      }
    });
  };
  line('lead', LEAD, (b) => section(b).s.lead);
  line('echo', ECHO, (b) => ({ vel: section(b).s.echo, duty: 0.125 }));
  line('bass', BASS, (b) => ({ vel: section(b).s.bass * (0.92 + 0.12 * R()) }));

  // the chords by half bar
  if (CHART.length !== BARS) throw new Error(`[score] the chart has ${CHART.length} bars, not ${BARS}`);
  const halves = CHART.flatMap((c) => { const n = c.split(' '); return n.length === 1 ? [n[0], n[0]] : n; });
  const voicing = (name: string) => {
    if (!VOICING[name]) throw new Error(`[score] no voicing for ${name}`);
    return VOICING[name].split(' ').map(midi).sort((a, b) => a - b);
  };

  // the pad: a note held while the chords keep it (common tones are tied, not struck again)
  const held = new Map<number, Note>();
  halves.forEach((name, h) => {
    const keys = voicing(name);
    for (const key of [...held.keys()]) if (!keys.includes(key)) held.delete(key);
    for (const key of keys) {
      const n = held.get(key);
      if (n) { n.len += BEATS / 2; continue; }
      const note: Note = { part: 'pad', at: (h * BEATS) / 2, len: BEATS / 2, key, vel: section(Math.floor(h / 2)).s.pad };
      notes.push(note);
      held.set(key, note);
    }
  });
  // ties across the loop: the last chord's notes that the first chord keeps ring on into it
  for (const first of notes.filter((n) => n.part === 'pad' && n.at === 0)) {
    const last = held.get(first.key);
    if (!last) continue;
    last.len += first.len;
    first.tied = true;
  }

  // the arpeggio: the section's order through the chord's pool, the beat's first note a little louder
  for (let b = 0; b < BARS; b++) {
    const { arp } = section(b).s;
    for (let k = 0; k < arp.per * BEATS; k++) {
      const at = b * BEATS + k / arp.per;
      const v = voicing(halves[Math.floor(at / (BEATS / 2))]);
      const pool = [...v, v[0] + 12, v[1] + 12];
      const key = pool[arp.order[k % arp.order.length]];
      notes.push({ part: 'arp', at, len: 1 / arp.per, key, vel: arp.vel * (k % arp.per ? 0.82 : 1) * (0.9 + 0.2 * R()), duty: arp.duty });
    }
  }

  // the clock: tick on the beat, tock on the off beat a little late (an old clock, out of beat);
  // silent bars keep their ticks at 0 for the flashback, which always ticks
  for (let b = 0; b < BARS; b++) {
    const { tick } = section(b).s;
    for (let k = 0; k < BEATS; k++) notes.push({ part: 'tick', at: b * BEATS + k + (k % 2 ? 0.025 : 0), len: 0.1, key: k % 2 ? 0 : 1, vel: tick });
  }

  // brushes
  for (let b = 0; b < BARS; b++) {
    const { s, i } = section(b);
    if (!s.brush || (i + 1) % s.brush.every) continue;
    for (const k of s.brush.beats) notes.push({ part: 'brush', at: b * BEATS + k, len: 0.5, key: 0, vel: s.brush.vel });
  }

  // a worn record's crackle: none, one or two a bar, anywhere
  for (let b = 0; b < BARS; b++) {
    const count = R() < 0.35 ? 0 : R() < 0.7 ? 1 : 2;
    for (let c = 0; c < count; c++) {
      notes.push({ part: 'crackle', at: b * BEATS + R() * BEATS, len: 0.05, key: Math.floor(R() * 3), vel: 0.25 + 0.75 * R() ** 2, pan: R() * 1.4 - 0.7 });
    }
  }

  return notes.sort((a, b) => a.at - b.at);
}

export const SCORE = build();
