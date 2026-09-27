// Plays the score (./score.ts) with Web Audio, the way a 16-bit console would voice it:
// band-limited pulse waves at three duty cycles (PeriodicWave) for the lead, the second voice,
// the arpeggio and the pad; a stepped, 4-bit triangle for the bass; noise for the brushes, the
// clock, tape hiss and a worn record's crackle; a ping-pong echo on the lead and a convolution
// reverb from a generated impulse. It runs on any BaseAudioContext: live (./music.ts feeds it
// from a lookahead timer) and offline (an OfflineAudioContext renders a preview). The noise
// and the impulse are seeded, so a start at the same time renders the same samples.
//
//   parts → music bus → cold: lowpass → highpass → wobble → master → out
//   parts → reverb → music bus;  lead → echo → music bus
//   clock, hiss, crackle → master: they stay in the room when the music turns cold
import { createRng, type Rng } from '../engine/rng';
import { BEAT, LOOP_BEATS, SCORE, type Note, type Part } from './score';

/** Master gain at full volume: quiet, under reading (docs/music.md gives the measured levels). */
export const LEVEL = 0.36;

type Voice = Exclude<Part, 'crackle'>;

/**
 * Each part's level, stereo position, lowpass (Hz), and sends to the reverb and the lead's echo.
 * Balanced by A-weighted level over the loop against the lead: the second voice, the arpeggio
 * and the pad about −10 dB, the bass −13 (felt more than heard), the hiss −31; the clock's
 * ticks peak about 13 dB under the lead's notes.
 */
const MIX: Record<Voice, { gain: number; pan: number; low: number; reverb: number; echo?: number }> = {
  lead: { gain: 0.2, pan: -0.12, low: 3400, reverb: 0.3, echo: 0.32 },
  echo: { gain: 0.11, pan: 0.32, low: 2600, reverb: 0.4 },
  arp: { gain: 0.25, pan: 0.2, low: 2100, reverb: 0.45 },
  pad: { gain: 0.045, pan: 0, low: 1500, reverb: 0.55 },
  bass: { gain: 0.28, pan: 0, low: 2600, reverb: 0.06 },
  tick: { gain: 0.125, pan: 0.35, low: 9000, reverb: 0.25 },
  brush: { gain: 0.07, pan: -0.2, low: 7500, reverb: 0.3 },
};
/** Tape hiss and the record's crackle, straight into the master. */
const HISS = 0.002, CRACKLE = 0.16;

interface Shape {
  /** Attack, decay (s), sustain (of the peak), release (s). */
  a: number; d: number; s: number; r: number;
  /** Vibrato: after `delay` s it grows over `rise` s to ±`cents` at `rate` Hz. */
  vib?: { delay: number; rise: number; cents: number; rate: number };
  /** Each note slides up into its pitch from this many cents below. */
  scoop?: number;
}
const SHAPE: Record<'lead' | 'echo' | 'arp' | 'pad' | 'bass', Shape> = {
  lead: { a: 0.012, d: 0.4, s: 0.7, r: 0.14, vib: { delay: 0.26, rise: 0.4, cents: 13, rate: 5.2 }, scoop: 18 },
  echo: { a: 0.025, d: 0.5, s: 0.62, r: 0.2, vib: { delay: 0.35, rise: 0.5, cents: 9, rate: 4.7 } },
  arp: { a: 0.004, d: 0.24, s: 0.18, r: 0.08 },
  pad: { a: 0.9, d: 1, s: 0.85, r: 1.4 },
  bass: { a: 0.006, d: 0.6, s: 0.82, r: 0.06 },
};

/**
 * The flashback's colour: the music bus darker (lowpass from 16 kHz to 1.1 kHz) and thinner
 * (highpass from 25 Hz to 170 Hz), both moved in cents so the sweep is even to the ear; a
 * slow wobble of pitch, like a worn tape (s of delay swing at 0.47 Hz: ±9 cents); more
 * reverb; the clock louder, and ticking through every section.
 */
const COLD = { low: -1200 * Math.log2(16000 / 1100), high: 1200 * Math.log2(170 / 25), wobble: 0.0018, reverb: 1.7, clock: 1.6 };

export interface Band {
  /** Starts the loop from its first bar at context time `at` (the master stays where it is). */
  start(at: number): void;
  /** Stops making notes at `at`; what sounds rings out. */
  halt(at: number): void;
  /** Schedules every note that starts before context time `until`. */
  schedule(until: number): void;
  readonly running: boolean;
  /** The master level, toward `level` (0–1) from `at` with time constant `tc` (s); 0: at once. */
  fade(level: number, at: number, tc: number): void;
  /** The flashback's cold colour (true) or the present's (false), from `at`. */
  mood(cold: boolean, at: number, tc?: number): void;
}

export function createBand(ctx: BaseAudioContext, out: AudioNode = ctx.destination): Band {
  const rate = ctx.sampleRate;
  const gain = (v: number) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filter = (type: BiquadFilterType, f: number, q = Math.SQRT1_2) => {
    const b = ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q;
    return b;
  };
  const panner = (p: number) => { const s = ctx.createStereoPanner(); s.pan.value = p; return s; };
  const buffer = (channels: Float32Array<ArrayBuffer>[]) => {
    const b = ctx.createBuffer(channels.length, channels[0].length, rate);
    channels.forEach((c, i) => b.copyToChannel(c, i));
    return b;
  };

  // ---- the master and the flashback's cold chain
  const master = gain(0);
  master.connect(out);
  const wobble = ctx.createDelay(0.1);
  wobble.delayTime.value = 0.03;
  const lfo = ctx.createOscillator(), depth = gain(0);
  lfo.frequency.value = 0.47;
  lfo.connect(depth).connect(wobble.delayTime);
  lfo.start();
  const low = filter('lowpass', 16000, 0.8), high = filter('highpass', 25, 0.6);
  const music = gain(1);
  music.connect(low).connect(high).connect(wobble).connect(master);

  // ---- the reverb: a dark room, 2.6 s to silence
  const reverb = gain(1), convolver = ctx.createConvolver();
  convolver.normalize = false;
  convolver.buffer = buffer(impulse(rate, createRng(11)));
  reverb.connect(convolver).connect(gain(0.5)).connect(music);

  // ---- the lead's echo: a dotted eighth, left then right, each repeat darker and half as loud.
  // One stereo delay whose repeats cross over to the other side: the feedback loop holds a
  // single DelayNode and leaves only through it, so the browser always closes the loop at the
  // same node and the echo is rendered the same every time (with two delays in the loop, which
  // of them lags a render quantum depends on the order the graph happens to be walked).
  const echo = gain(1), sum = gain(1), delay = ctx.createDelay(2), merge = ctx.createChannelMerger(2), split = ctx.createChannelSplitter(2);
  for (const g of [echo, sum]) { g.channelCount = 1; g.channelCountMode = 'explicit'; }
  delay.delayTime.value = 0.75 * BEAT;
  echo.connect(filter('highpass', 350)).connect(filter('lowpass', 2600)).connect(sum);
  sum.connect(merge, 0, 0); // new sound and the right's repeats go left
  merge.connect(delay).connect(filter('lowpass', 2000)).connect(split);
  split.connect(gain(0.5), 0).connect(merge, 0, 1); // the left's repeats go right
  split.connect(gain(0.5), 1).connect(sum);
  delay.connect(music);
  delay.connect(gain(0.3)).connect(reverb);

  // ---- the parts: level, lowpass, pan, sends; the clock bypasses the cold chain
  const clock = gain(1);
  clock.connect(master);
  const bus = {} as Record<Voice, GainNode>;
  for (const part of Object.keys(MIX) as Voice[]) {
    const m = MIX[part], g = gain(m.gain), p = panner(m.pan);
    g.connect(filter('lowpass', m.low)).connect(p);
    p.connect(part === 'tick' ? clock : music);
    p.connect(gain(m.reverb)).connect(reverb);
    if (m.echo) p.connect(gain(m.echo)).connect(echo);
    bus[part] = g;
  }

  // ---- the instruments' waves and samples
  const waves = new Map<string, PeriodicWave>();
  const pulse = (duty: number, soft: number) => {
    const id = `${duty}/${soft}`;
    let w = waves.get(id);
    if (!w) {
      const re = pulseSeries(duty, soft);
      w = ctx.createPeriodicWave(re, new Float32Array(re.length), { disableNormalization: true });
      waves.set(id, w);
    }
    return w;
  };
  const tri = triangleSeries();
  const triangle = ctx.createPeriodicWave(tri.re, tri.im, { disableNormalization: true });
  const knocks = [buffer([knock(rate, false, createRng(3))]), buffer([knock(rate, true, createRng(4))])];
  const brushed = buffer([brush(rate, createRng(5))]);
  const clicks = [0, 1, 2].map((k) => buffer([click(rate, k, createRng(20 + k))]));
  const hissed = buffer([hiss(rate, createRng(8)), hiss(rate, createRng(9))]);

  const hz = (key: number) => 440 * 2 ** ((key - 69) / 12);

  /** A note: an envelope over one or more oscillators (pitch offsets in cents), into `dest`. */
  function tone(dest: AudioNode, wave: PeriodicWave, key: number, t: number, len: number, vel: number, sh: Shape, cents = [0]) {
    const g = ctx.createGain(), end = t + Math.max(len, sh.a), stop = end + sh.r * 3;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + sh.a);
    g.gain.setTargetAtTime(vel * sh.s, t + sh.a, sh.d / 3);
    g.gain.setTargetAtTime(0, end, sh.r / 3);
    g.connect(dest);
    for (const c of cents) {
      const o = ctx.createOscillator();
      o.setPeriodicWave(wave);
      o.frequency.value = hz(key);
      o.detune.value = c;
      if (sh.scoop) {
        o.detune.setValueAtTime(c - sh.scoop, t);
        o.detune.linearRampToValueAtTime(c, t + 0.07);
      }
      if (sh.vib && len > sh.vib.delay) {
        const l = ctx.createOscillator(), amount = gain(0);
        l.frequency.value = sh.vib.rate;
        amount.gain.setValueAtTime(0, t + sh.vib.delay);
        amount.gain.linearRampToValueAtTime(sh.vib.cents, t + sh.vib.delay + sh.vib.rise);
        l.connect(amount).connect(o.detune);
        l.start(t);
        l.stop(stop);
      }
      o.connect(g);
      o.start(t);
      o.stop(stop);
    }
  }

  function sample(b: AudioBuffer, dest: AudioNode, t: number, vel: number) {
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(gain(vel)).connect(dest);
    s.start(t);
  }

  let running = false, cold = false, t0 = 0, index = 0, loop = 0;
  let tape: { src: AudioBufferSourceNode; level: GainNode } | null = null;

  function play(n: Note, t: number, len: number) {
    switch (n.part) {
      case 'lead':
      case 'echo':
        // a little shorter than written, so repeated notes are heard as two
        return tone(bus[n.part], pulse(n.duty ?? 0.25, 14), n.key, t, len - 0.03, n.vel, SHAPE[n.part]);
      case 'arp': return tone(bus.arp, pulse(n.duty ?? 0.5, 10), n.key, t, len, n.vel, SHAPE.arp);
      case 'pad': return tone(bus.pad, pulse(0.5, 5), n.key, t, len, n.vel, SHAPE.pad, [-6, 6]);
      case 'bass': return tone(bus.bass, triangle, n.key, t, len - 0.02, n.vel, SHAPE.bass);
      case 'tick': {
        // the flashback's clock is running: it ticks in every section, the silent ones too
        const v = cold ? Math.max(n.vel, 0.8) : n.vel;
        if (v > 0) sample(knocks[n.key], bus.tick, t, v);
        return;
      }
      case 'brush': return sample(brushed, bus.brush, t, n.vel);
      case 'crackle': {
        const p = panner(n.pan ?? 0);
        p.connect(master);
        return sample(clicks[n.key], p, t, n.vel * CRACKLE);
      }
    }
  }

  return {
    get running() { return running; },
    start(at) {
      if (running) this.halt(at);
      running = true;
      t0 = at; index = 0; loop = 0;
      const src = ctx.createBufferSource(), level = gain(0);
      src.buffer = hissed;
      src.loop = true;
      src.connect(level).connect(master);
      level.gain.setTargetAtTime(HISS, at, 0.5);
      src.start(at);
      tape = { src, level };
    },
    halt(at) {
      running = false;
      if (!tape) return;
      tape.level.gain.setTargetAtTime(0, at, 0.05);
      tape.src.stop(at + 0.5);
      tape = null;
    },
    schedule(until) {
      if (!running) return;
      const now = ctx.currentTime;
      for (;;) {
        const n = SCORE[index], t = t0 + (loop * LOOP_BEATS + n.at) * BEAT;
        if (t >= until) break;
        // a pad note the last bar already holds, tied over the loop, sounds the first time only
        if (!(n.tied && loop > 0)) {
          // a note found late (the main thread stalled) plays what is left of it, unless most has passed
          const len = n.len * BEAT, late = Math.max(0, now - t);
          if (late < Math.max(0.05, len / 2)) play(n, t + late, len - late);
        }
        if (++index === SCORE.length) { index = 0; loop++; }
      }
    },
    fade(level, at, tc) {
      if (tc > 0) master.gain.setTargetAtTime(level * LEVEL, at, tc);
      else master.gain.setValueAtTime(level * LEVEL, at);
    },
    mood(c, at, tc = c ? 0.8 : 1.1) {
      cold = c;
      const to = (p: AudioParam, v: number) => (tc > 0 ? p.setTargetAtTime(v, at, tc) : p.setValueAtTime(v, at));
      to(low.detune, c ? COLD.low : 0);
      to(high.detune, c ? COLD.high : 0);
      to(depth.gain, c ? COLD.wobble : 0);
      to(reverb.gain, c ? COLD.reverb : 1);
      to(clock.gain, c ? COLD.clock : 1);
    },
  };
}

/**
 * A pulse wave's Fourier series (cosine terms; index 0 is the unused DC) with duty cycle `duty`,
 * rolled off above harmonic `soft` like a first-order lowpass, which takes the console's edge
 * off; scaled so every wave has a sine's loudness (the sum of squared terms is 1).
 */
export function pulseSeries(duty: number, soft: number, harmonics = 48): Float32Array<ArrayBuffer> {
  const re = new Float32Array(harmonics + 1);
  for (let k = 1; k <= harmonics; k++) re[k] = (2 * Math.sin(k * Math.PI * duty)) / (k * Math.PI) / Math.sqrt(1 + (k / soft) ** 2);
  return unit(re);
}

/**
 * The console's triangle: 32 steps down and up (15 … 0, 0 … 15), its Fourier series. The steps
 * add the faint buzz of the original around the 31st and 33rd harmonics.
 */
export function triangleSeries(harmonics = 40): { re: Float32Array<ArrayBuffer>; im: Float32Array<ArrayBuffer> } {
  const N = 32, v = Array.from({ length: N }, (_, k) => (k < 16 ? 15 - k : k - 16) - 7.5);
  const re = new Float32Array(harmonics + 1), im = new Float32Array(harmonics + 1);
  for (let m = 1; m <= harmonics; m++) {
    const w = 2 * Math.PI * m;
    for (let k = 0; k < N; k++) {
      // the step k holds v[k] from k/N to (k+1)/N
      re[m] += (2 * v[k] * (Math.sin((w * (k + 1)) / N) - Math.sin((w * k) / N))) / w;
      im[m] += (2 * v[k] * (Math.cos((w * k) / N) - Math.cos((w * (k + 1)) / N))) / w;
    }
  }
  let e = 0;
  for (let m = 1; m <= harmonics; m++) e += re[m] ** 2 + im[m] ** 2;
  const s = 1 / Math.sqrt(e);
  for (let m = 1; m <= harmonics; m++) { re[m] *= s; im[m] *= s; }
  return { re, im };
}

function unit(a: Float32Array<ArrayBuffer>) {
  let e = 0;
  for (const x of a) e += x * x;
  const s = 1 / Math.sqrt(e);
  for (let i = 0; i < a.length; i++) a[i] *= s;
  return a;
}

/**
 * A room's impulse response, one channel per call of `R` (so the two are uncorrelated): a
 * soft onset after a 20 ms gap, then noise decaying by 60 dB in `rt60` s and darkening as it
 * goes (its cutoff falls from about 7 kHz to 900 Hz). Unit energy per channel.
 */
export function impulse(rate: number, R: Rng, rt60 = 2.6, seconds = 3.2): Float32Array<ArrayBuffer>[] {
  const n = Math.round(rate * seconds), gap = Math.round(rate * 0.02);
  return [0, 1].map(() => {
    const a = new Float32Array(n);
    let lp = 0;
    for (let i = gap; i < n; i++) {
      const t = (i - gap) / rate;
      const k = 1 - Math.exp((-2 * Math.PI * (6200 * Math.exp(-t / 0.8) + 900)) / rate);
      lp += k * (R() * 2 - 1 - lp);
      a[i] = lp * 10 ** ((-3 * t) / rt60) * Math.min(1, t / 0.03);
    }
    return unit(a);
  });
}

/** The clock: a tick (high) or a tock, a knock of a wooden case and two brass partials, 60 ms. */
export function knock(rate: number, high: boolean, R: Rng): Float32Array<ArrayBuffer> {
  const n = Math.round(rate * 0.06), a = new Float32Array(n);
  const [f1, f2, body] = high ? [2350, 3900, 760] : [1650, 2800, 620];
  for (let i = 0; i < n; i++) {
    const t = i / rate, w = 2 * Math.PI * t;
    a[i] = 0.5 * Math.sin(w * f1) * Math.exp(-t / 0.007) + 0.28 * Math.sin(w * f2) * Math.exp(-t / 0.004)
      + 0.3 * Math.sin(w * body) * Math.exp(-t / 0.012) + 0.45 * (R() * 2 - 1) * Math.exp(-t / 0.0012);
  }
  return a;
}

/** A brush on a snare, far off: noise between about 1.2 and 6.5 kHz, a soft attack, a short tail. */
export function brush(rate: number, R: Rng): Float32Array<ArrayBuffer> {
  const n = Math.round(rate * 0.35), a = new Float32Array(n);
  const kl = 1 - Math.exp((-2 * Math.PI * 6500) / rate), kh = Math.exp((-2 * Math.PI * 1200) / rate);
  let lp = 0, prev = 0, hp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    lp += kl * (R() * 2 - 1 - lp);
    hp = kh * (hp + lp - prev);
    prev = lp;
    a[i] = 2.2 * hp * Math.min(1, t / 0.012) * Math.exp(-t / 0.075);
  }
  return a;
}

/** A crackle: a few samples of noise dying within a millisecond (three sizes). */
function click(rate: number, size: number, R: Rng): Float32Array<ArrayBuffer> {
  const n = Math.round(rate * 0.003), a = new Float32Array(n), tau = 0.00012 + 0.00015 * size;
  for (let i = 0; i < n; i++) a[i] = (R() * 2 - 1) * Math.exp(-i / rate / tau);
  return a;
}

/**
 * Tape hiss: pink noise (Paul Kellet's filter) above about 500 Hz, RMS 1, `seconds` long and
 * looped; its end is crossfaded into its start, so the loop has no seam. Its length is not a
 * whole number of bars, so it never lines up with the music.
 */
export function hiss(rate: number, R: Rng, seconds = 7.37): Float32Array<ArrayBuffer> {
  const n = Math.round(rate * seconds), fade = Math.round(rate * 0.1), raw = new Float32Array(n + fade);
  const kh = Math.exp((-2 * Math.PI * 500) / rate);
  let b0 = 0, b1 = 0, b2 = 0, prev = 0, hp = 0;
  for (let i = 0; i < raw.length; i++) {
    const w = R() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    const pink = b0 + b1 + b2 + w * 0.1848;
    hp = kh * (hp + pink - prev);
    prev = pink;
    raw[i] = hp;
  }
  const a = raw.slice(0, n);
  for (let i = 0; i < fade; i++) {
    const x = (i + 0.5) / fade; // the tail (raw[n + i]) fades out as the head fades in: equal power
    a[i] = raw[i] * Math.sin((x * Math.PI) / 2) + raw[n + i] * Math.cos((x * Math.PI) / 2);
  }
  let e = 0;
  for (const x of a) e += x * x;
  const s = Math.sqrt(n / e);
  for (let i = 0; i < n; i++) a[i] *= s;
  return a;
}
