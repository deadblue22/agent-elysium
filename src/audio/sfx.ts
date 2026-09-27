// Sound effects (docs/design.md §6.5), synthesised with Web Audio as they play (no audio files).
// The book is paper on a wooden table, so most of them are paper and wood: a pencil writing the
// log, the dice knocking on the table, cards swinging up and folding down, a heart flicking over,
// a card dropping onto the page; chimes for the checks and the inner voices; and the room's own
// sounds in the reconstruction: footsteps, a blow on the desk, the clock's hands and pendulum,
// the casements, the wind at the open window, the candle.
//
// The sounds are recipes of a few building blocks (a filtered noise burst, a tone, a bell), each
// varied a little every time it plays, panned toward where it happens, and sent through a small
// room reverb and a limiter. The bank runs on any BaseAudioContext, so an OfflineAudioContext can
// render a preview. The controller keeps its own AudioContext (the music has its own), made on
// the first click or key press as browsers ask; before that, and while switched off, sounds are
// dropped. The toggle's choice is kept in localStorage; ?still makes no sound.

export type SoundName =
  | 'write' | 'continue' | 'hover' | 'choose'
  | 'dice-throw' | 'die-land' | 'die-tick' | 'check-success' | 'check-failure' | 'voice'
  | 'lead-drop' | 'lead-file' | 'paper-land' | 'heart-flip' | 'morale-down' | 'morale-up'
  | 'card-rise' | 'card-fold' | 'casement' | 'clock-hands' | 'tick' | 'step' | 'blow' | 'wind'
  | 'rewind' | 'return' | 'candle-light' | 'candle-out';

export type Attribute = 'intellect' | 'psyche' | 'physique' | 'motorics';

export interface SoundOptions {
  /** Stereo position, -1 (left) .. 1 (right); see panAt. */
  pan?: number;
  /** Where the sound moves to while it plays (the lead card flying to the table). */
  panTo?: number;
  /** Loudness scale (1 = as designed). */
  gain?: number;
  /** Seconds from now. */
  delay?: number;
  /** Size or strength 0..1 for the sounds that scale with it (a card, a pendulum's swing). */
  size?: number;
  /** Seconds, for the sounds that last as long as a motion (the hands turning, a casement). */
  dur?: number;
  /** 'write': how many characters appeared. */
  count?: number;
  /** 'voice': the speaking skill's attribute; 'tick': the pendulum's tock. */
  tone?: Attribute | 'tock';
}

/** Plays a sound now (or after o.delay); dropped while audio is locked or switched off. */
export type Sound = (name: SoundName, o?: SoundOptions) => void;

/** Stereo position of a world x (the book spans -6.9..6.9, the table's props sit at 7.5..9). */
export const panAt = (x: number) => Math.max(-1, Math.min(1, x / 9)) * 0.85;

const KEY = 'agent-elysium:sfx';
const GESTURES = ['pointerdown', 'pointerup', 'keydown', 'touchend'];

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Bank { play(name: SoundName, t: number, o?: SoundOptions): void }

/** The sounds, played on `ctx` into `out`. Deterministic for a given seed and call sequence. */
export function createBank(ctx: BaseAudioContext, out: AudioNode, seed = 7): Bank {
  const rand = prng(seed);
  const vary = (x: number, k: number) => x * (1 + (rand() * 2 - 1) * k);

  // the bus: dry and a little small-room reverb, into a limiter that keeps stacked sounds clean
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12; limiter.knee.value = 6; limiter.ratio.value = 8;
  limiter.attack.value = 0.002; limiter.release.value = 0.12;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  limiter.connect(master).connect(out);
  const bus = ctx.createGain();
  bus.connect(limiter);
  const room = ctx.createConvolver();
  room.buffer = roomImpulse(ctx, 0.9, prng(seed + 1));
  const send = ctx.createGain();
  send.gain.value = 0.22;
  bus.connect(send).connect(room).connect(limiter);

  // two seconds of white noise, read from a random place each time
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  { const d = noise.getChannelData(0), r = prng(seed + 2); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }

  const panner = (t: number, pan: number, panTo?: number, dur = 0) => {
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
    if (panTo !== undefined) p.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, panTo)), t + dur);
    p.connect(bus);
    return p;
  };
  /** A gain that rises to `peak` in `attack` s, then decays so it is nearly gone after `dur` s. */
  const envelope = (t: number, peak: number, attack: number, dur: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0, t + attack, Math.max(0.004, (dur - attack) / 4));
    return g;
  };

  interface Burst { dur: number; gain: number; freq: number; freqTo?: number; q?: number; type?: BiquadFilterType; attack?: number; pan?: number; panTo?: number; rate?: number }
  /** Filtered noise: paper, wood, breath, wind. */
  const burst = (t: number, b: Burst) => {
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true; src.playbackRate.value = b.rate ?? 1;
    const f = ctx.createBiquadFilter();
    f.type = b.type ?? 'bandpass';
    f.frequency.setValueAtTime(b.freq, t);
    if (b.freqTo) f.frequency.exponentialRampToValueAtTime(b.freqTo, t + b.dur);
    f.Q.value = b.q ?? 1;
    const g = envelope(t, b.gain, b.attack ?? 0.002, b.dur);
    src.connect(f).connect(g).connect(panner(t, b.pan ?? 0, b.panTo, b.dur));
    src.start(t, rand() * 1.8);
    src.stop(t + b.dur + 0.3);
  };
  interface Tone { dur: number; gain: number; freq: number; freqTo?: number; type?: OscillatorType; attack?: number; pan?: number }
  /** A plain oscillator: the body of a knock, a chime's partial. */
  const tone = (t: number, o: Tone) => {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(o.freqTo, t + o.dur);
    const g = envelope(t, o.gain, o.attack ?? 0.004, o.dur);
    osc.connect(g).connect(panner(t, o.pan ?? 0));
    osc.start(t);
    osc.stop(t + o.dur + 0.3);
  };
  /** A small bell: the fundamental and two inharmonic partials that die away sooner. */
  const bell = (t: number, freq: number, gain: number, dur: number, pan = 0, attack = 0.003) => {
    tone(t, { freq, gain, dur, attack, pan });
    tone(t, { freq: freq * 2.76, gain: gain * 0.28, dur: dur * 0.45, attack, pan });
    tone(t, { freq: freq * 5.4, gain: gain * 0.08, dur: dur * 0.2, attack, pan });
  };
  /** A knock on wood: a short falling body under a click. */
  const knock = (t: number, gain: number, pan: number, pitch = 1) => {
    tone(t, { freq: vary(210, 0.08) * pitch, freqTo: 140 * pitch, dur: 0.07, gain: gain * 0.9, pan });
    burst(t, { freq: vary(1700, 0.12) * pitch, q: 2.5, dur: 0.03, gain: gain * 0.8, pan });
    burst(t, { freq: vary(3300, 0.1), q: 3, dur: 0.015, gain: gain * 0.3, pan });
  };
  /** Paper settling on a surface: a soft slap. */
  const pap = (t: number, gain: number, pan: number) => {
    burst(t, { type: 'lowpass', freq: vary(1100, 0.1), q: 0.7, dur: 0.06, gain, pan });
    tone(t, { freq: vary(140, 0.06), freqTo: 110, dur: 0.05, gain: gain * 0.45, pan });
  };
  /** One pencil stroke on the page. */
  const stroke = (t: number, gain: number, pan: number) => {
    burst(t, { freq: 2600 + rand() * 2000, q: 1.1 + rand() * 0.5, attack: 0.006, dur: 0.045 + rand() * 0.03, gain: vary(gain, 0.3), pan });
    if (rand() < 0.35) burst(t + 0.01, { freq: vary(900, 0.15), q: 0.8, dur: 0.05, gain: gain * 0.35, pan });
  };
  /** A clock's escapement, ticking. */
  const tick = (t: number, gain: number, freq: number, pan: number) => {
    burst(t, { freq: vary(freq, 0.03), q: 5, dur: 0.02, gain, pan });
    tone(t, { freq: freq * 0.8, dur: 0.012, gain: gain * 0.3, pan });
  };
  /** A soft footstep on the paper floor (or a wooden stair). */
  const step = (t: number, gain: number, pan: number, hollow: boolean) => {
    burst(t, { type: hollow ? 'bandpass' : 'lowpass', freq: vary(hollow ? 650 : 450, 0.12), q: hollow ? 1.4 : 0.7, dur: 0.09, gain, pan });
    tone(t, { freq: vary(hollow ? 110 : 85, 0.1), freqTo: 70, dur: 0.07, gain: gain * 0.7, pan });
    burst(t + 0.02, { freq: vary(2200, 0.2), q: 1, dur: 0.04, gain: gain * 0.18, pan });
  };
  /** A wooden creak: a rough, wandering buzz through a resonance, uneven in loudness. */
  const creak = (t: number, dur: number, gain: number, pan: number) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const n = Math.max(4, Math.round(dur * 24));
    const pitch = new Float32Array(n), amp = new Float32Array(n);
    let f = 140 + rand() * 40;
    for (let i = 0; i < n; i++) {
      f = Math.max(95, Math.min(230, f + (rand() - 0.5) * 30));
      pitch[i] = f;
      amp[i] = gain * (0.35 + rand() * 0.65) * Math.sin((Math.PI * (i + 0.5)) / n);
    }
    osc.frequency.setValueCurveAtTime(pitch, t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = vary(1000, 0.1); bp.Q.value = 5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.setValueCurveAtTime(amp, t + 0.001, dur);
    osc.connect(bp).connect(g).connect(panner(t, pan));
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  const sounds: Record<SoundName, (t: number, o: Required<Pick<SoundOptions, 'pan' | 'gain' | 'size'>> & SoundOptions) => void> = {
    // the log: a pencil writing it, a tick for moving on, for hovering and for choosing an option
    write: (t, o) => { for (let i = 0; i < Math.min(o.count ?? 1, 3); i++) stroke(t + i * 0.028, 0.032 * o.gain, o.pan); },
    continue: (t, o) => {
      burst(t, { type: 'highpass', freq: 2500, dur: 0.025, gain: 0.035 * o.gain, pan: o.pan });
      tone(t, { freq: 1400, dur: 0.03, gain: 0.012 * o.gain, pan: o.pan });
    },
    hover: (t, o) => burst(t, { freq: vary(4200, 0.05), q: 3, dur: 0.018, gain: 0.035 * o.gain, pan: o.pan }),
    choose: (t, o) => {
      burst(t, { freq: vary(2800, 0.05), q: 1.5, dur: 0.045, gain: 0.05 * o.gain, pan: o.pan });
      tone(t, { freq: 988, dur: 0.08, gain: 0.018 * o.gain, pan: o.pan });
    },
    // the dice: thrown in from the right, a knock at each landing, smaller ones as they tumble
    'dice-throw': (t, o) => burst(t, { freq: 700, freqTo: 1800, q: 0.8, attack: 0.05, dur: 0.28, gain: 0.035 * o.gain, pan: o.pan }),
    'die-land': (t, o) => knock(t, 0.13 * o.gain, o.pan),
    'die-tick': (t, o) => knock(t, 0.05 * o.gain, o.pan, 1.25),
    // a check's result: two rising bell notes, or a low, falling knell
    'check-success': (t, o) => {
      bell(t, 1046.5, 0.05 * o.gain, 1.1, o.pan);
      bell(t + 0.09, 1568, 0.045 * o.gain, 1.3, o.pan);
      burst(t + 0.05, { type: 'highpass', freq: 6000, attack: 0.05, dur: 0.45, gain: 0.008 * o.gain, pan: o.pan });
    },
    'check-failure': (t, o) => {
      tone(t, { type: 'triangle', freq: 196, freqTo: 174, dur: 0.8, gain: 0.06 * o.gain, pan: o.pan });
      tone(t, { freq: 98, freqTo: 87, dur: 0.9, gain: 0.07 * o.gain, pan: o.pan });
      burst(t, { type: 'lowpass', freq: 300, dur: 0.2, gain: 0.06 * o.gain, pan: o.pan });
    },
    // an inner voice speaks up: a quiet chime, pitched by the skill's attribute
    voice: (t, o) => {
      const f = { intellect: 1318.5, psyche: 1174.7, physique: 587.3, motorics: 880 }[o.tone === 'tock' || !o.tone ? 'psyche' : o.tone];
      bell(t, f, 0.022 * o.gain, 0.9, o.pan, 0.03);
      burst(t, { freq: f * 2, q: 6, attack: 0.05, dur: 0.5, gain: 0.006 * o.gain, pan: o.pan });
    },
    // a new lead: the card flutters down onto the page; filed, it slides away to the stack
    'lead-drop': (t, o) => {
      for (let i = 0; i < 6; i++) burst(t + i * 0.065, { freq: vary(1700, 0.15), q: 1.2, dur: 0.05, gain: 0.03 * (1 - i * 0.1) * o.gain, pan: o.pan });
      bell(t + 0.46, 880, 0.022 * o.gain, 0.5, o.pan);
      bell(t + 0.56, 1318.5, 0.02 * o.gain, 0.7, o.pan);
    },
    'lead-file': (t, o) => burst(t, { freq: 900, freqTo: 1700, q: 0.9, attack: 0.08, dur: 0.45, gain: 0.03 * o.gain, pan: o.pan, panTo: o.panTo }),
    'paper-land': (t, o) => pap(t, 0.06 * o.gain * (0.5 + o.size), o.pan),
    // morale: a heart flicks over; a falling phrase for a loss, a rising one for a gain
    'heart-flip': (t, o) => burst(t, { freq: vary(2600, 0.08), q: 1.4, dur: 0.07, gain: 0.04 * o.gain, pan: o.pan }),
    'morale-down': (t, o) => {
      tone(t, { freq: 440, freqTo: 415, dur: 0.35, gain: 0.035 * o.gain, pan: o.pan });
      tone(t + 0.28, { freq: 330, freqTo: 311, dur: 0.9, gain: 0.045 * o.gain, pan: o.pan });
      tone(t + 0.28, { type: 'triangle', freq: 110, dur: 1, gain: 0.03 * o.gain, pan: o.pan });
    },
    'morale-up': (t, o) => {
      tone(t, { freq: 330, dur: 0.3, gain: 0.035 * o.gain, pan: o.pan });
      tone(t + 0.22, { freq: 440, dur: 0.7, gain: 0.04 * o.gain, pan: o.pan });
    },
    // the pop-up: a card swings up with a swish and settles with a flap; folding, the reverse
    'card-rise': (t, o) => {
      const d = 0.32 + 0.2 * o.size;
      burst(t, { freq: 450, freqTo: 1500, q: 0.9, attack: 0.06, dur: d, gain: (0.025 + 0.05 * o.size) * o.gain, pan: o.pan });
      burst(t + d * 0.85, { type: 'lowpass', freq: 350, dur: 0.08, gain: (0.03 + 0.04 * o.size) * o.gain, pan: o.pan });
    },
    'card-fold': (t, o) => {
      const d = 0.3 + 0.2 * o.size;
      burst(t, { freq: 1500, freqTo: 450, q: 0.9, attack: 0.05, dur: d, gain: (0.022 + 0.045 * o.size) * o.gain, pan: o.pan });
      pap(t + d * 0.9, (0.03 + 0.04 * o.size) * o.gain, o.pan);
    },
    // the room
    casement: (t, o) => {
      const d = o.dur ?? 0.9;
      creak(t, d, 0.04 * o.gain, o.pan);
      burst(t + d, { freq: 2200, q: 3, dur: 0.03, gain: 0.045 * o.gain, pan: o.pan });
    },
    'clock-hands': (t, o) => {
      // a ratchet: sparse at the ends, fast in the middle, as the hands ease in and out
      const d = o.dur ?? 1.2, n = Math.max(6, Math.round(d * 16));
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
        tick(t + e * d, 0.045 * o.gain, 3600, o.pan);
      }
    },
    tick: (t, o) => tick(t, 0.05 * o.gain * o.size, o.tone === 'tock' ? 2100 : 3000, o.pan),
    step: (t, o) => step(t, 0.06 * o.gain * (0.5 + o.size), o.pan, o.tone === 'tock'),
    blow: (t, o) => {
      tone(t, { freq: 80, freqTo: 42, dur: 0.45, gain: 0.18 * o.gain, pan: o.pan });
      burst(t, { type: 'lowpass', freq: 1000, dur: 0.3, gain: 0.13 * o.gain, pan: o.pan });
      for (let i = 0; i < 5; i++) burst(t + 0.05 + rand() * 0.3, { freq: 2500 + rand() * 2000, q: 5, dur: 0.02, gain: 0.03 * o.gain, pan: o.pan + (rand() - 0.5) * 0.2 });
      burst(t + 0.03, { freq: 500, q: 0.6, attack: 0.02, dur: 0.5, gain: 0.03 * o.gain, pan: o.pan });
    },
    wind: (t, o) => {
      const d = o.dur ?? 1.8, src = ctx.createBufferSource();
      src.buffer = noise; src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.Q.value = 0.5;
      f.frequency.setValueCurveAtTime(new Float32Array([300, 1200, 800, 450]), t, d);
      const g = ctx.createGain();
      g.gain.setValueCurveAtTime(new Float32Array([0, 0.05 * o.gain, 0.042 * o.gain, 0]), t, d);
      src.connect(f).connect(g).connect(panner(t, o.pan));
      src.start(t, rand() * 1.8);
      src.stop(t + d + 0.1);
    },
    // last night and back: a rising, then a falling rush
    rewind: (t, o) => {
      burst(t, { freq: 250, freqTo: 2600, q: 1.2, attack: 0.7, dur: 0.9, gain: 0.055 * o.gain, pan: o.pan });
      tone(t + 0.2, { freq: 300, freqTo: 900, attack: 0.5, dur: 0.7, gain: 0.012 * o.gain, pan: o.pan });
    },
    return: (t, o) => {
      burst(t, { freq: 2600, freqTo: 250, q: 1.2, attack: 0.08, dur: 1, gain: 0.05 * o.gain, pan: o.pan });
      tone(t, { freq: 900, freqTo: 300, attack: 0.1, dur: 0.8, gain: 0.01 * o.gain, pan: o.pan });
    },
    'candle-light': (t, o) => {
      burst(t, { freq: 1400, q: 0.8, attack: 0.005, dur: 0.35, gain: 0.07 * o.gain, pan: o.pan });
      burst(t + 0.05, { type: 'lowpass', freq: 250, attack: 0.08, dur: 0.6, gain: 0.03 * o.gain, pan: o.pan });
    },
    'candle-out': (t, o) => burst(t, { freq: 700, freqTo: 400, q: 0.7, attack: 0.06, dur: 0.5, gain: 0.07 * o.gain, pan: o.pan }),
  };

  return {
    play(name, t, o = {}) {
      sounds[name](t, { ...o, pan: o.pan ?? 0, gain: o.gain ?? 1, size: Math.max(0, Math.min(1, o.size ?? 0.5)) });
    },
  };
}

/** A small room's reverb: stereo noise dying away over `seconds`, its highs sooner than its lows. */
function roomImpulse(ctx: BaseAudioContext, seconds: number, rand: () => number): AudioBuffer {
  const n = Math.round(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const u = i / n, x = rand() * 2 - 1;
      lp += (x - lp) * (0.6 - 0.45 * u); // darker as it dies
      d[i] = lp * Math.exp(-u * 6) * (i < 64 ? i / 64 : 1);
    }
  }
  return buf;
}

/** The toggle, the unlock on the first gesture, and the `play` the scene calls. */
export function createSfx({ button, still }: { button: HTMLButtonElement | null; still: boolean }) {
  let on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch { /* storage blocked: the default */ }
  let ctx: AudioContext | null = null, bank: Bank | null = null;
  const render = () => button?.setAttribute('aria-pressed', String(on));
  render();

  /** Makes the context inside a gesture (the first time) and wakes it. */
  const wake = () => {
    if (still) return;
    if (!ctx) {
      try {
        ctx = new AudioContext({ latencyHint: 'interactive' });
        bank = createBank(ctx, ctx.destination);
      } catch (err) {
        console.info('[sfx] no Web Audio:', err);
        ctx = null;
        return;
      }
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  };

  const play: Sound = (name, o = {}) => {
    if (still || !on || !ctx || !bank || ctx.state !== 'running' || document.hidden) return;
    bank.play(name, ctx.currentTime + 0.01 + (o.delay ?? 0), o);
  };

  button?.addEventListener('click', (e) => {
    e.stopPropagation();
    on = !on;
    render();
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* not kept */ }
    wake(); // a click is a gesture
    play('continue'); // switched on: a tick to say so
  });

  if (!still) {
    const unlock = (e: Event) => {
      if (e.target instanceof Node && button?.contains(e.target)) return; // the toggle decides for itself
      const activation = (navigator as { userActivation?: { isActive: boolean } }).userActivation;
      if (activation && !activation.isActive) return;
      for (const type of GESTURES) removeEventListener(type, unlock, true);
      wake();
    };
    for (const type of GESTURES) addEventListener(type, unlock, true);
  }

  return {
    play,
    /** For tests (?debug): whether it is on, and the context's state. */
    get state() { return { on, context: ctx?.state ?? null }; },
  };
}
