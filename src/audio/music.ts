// The chapter's background music: a recorded track (public/audio/elysium.mp3, chosen by the
// user), streamed by an <audio> element into Web Audio for its level and the story's colour:
// the flashback muffles it (a low-pass filter, a little quieter), the present clears it again,
// the chapter's end fades it out. It starts on the first click or key
// press (browsers keep audio off until then, and warn about a page that tries earlier), loops,
// pauses while the tab is hidden, and the toggle's choice is kept in localStorage. ?still makes
// no sound at all.

const KEY = 'agent-elysium:music';
const SRC = `${import.meta.env.BASE_URL}audio/elysium.mp3`;
/**
 * Playback level (-19 dB). The track is mastered loud (-15.5 LUFS integrated); this sits it at
 * -34.7 LUFS, under the sound effects: the dice and the checks peak 7 to 9 LU above it
 * (momentary loudness), the lead cards and morale about level with it (docs/music.md).
 */
const VOLUME = 0.11;
/** Fades (time constants, s): in at the start, out at the toggle or a hidden tab, back in, out at the end, into and out of the flashback. */
const FADE = { start: 1.2, off: 0.15, back: 0.4, end: 2.2, mood: 0.5 };
/** The flashback: the low-pass cut-off (Hz) and the level (times VOLUME). */
const COLD = { cutoff: 1400, level: 0.7 };
/** Events that can carry the gesture a browser asks for before it plays audio. */
const GESTURES = ['pointerdown', 'pointerup', 'keydown', 'touchend'];

export function createMusic({ button, still }: { button: HTMLButtonElement; still: boolean }) {
  let on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch { /* storage blocked: the default */ }
  let ctx: AudioContext | null = null, audio: HTMLAudioElement | null = null;
  let gain: GainNode | null = null, filter: BiquadFilterNode | null = null;
  let playing = false, cold = false, over = false, unlocked = false, started = false;
  let sleep = 0;

  const render = () => button.setAttribute('aria-pressed', String(on));
  render();

  const level = () => VOLUME * (cold ? COLD.level : 1);

  /** The element and its graph, made inside a gesture the first time. */
  function setup(): boolean {
    if (ctx) return true;
    try {
      ctx = new AudioContext({ latencyHint: 'playback' });
      audio = new Audio(SRC);
      audio.loop = true;
      audio.preload = 'auto';
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 20000;
      filter.Q.value = 0.6;
      gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(audio).connect(filter).connect(gain).connect(ctx.destination);
      return true;
    } catch (err) {
      console.info('[music] no Web Audio:', err);
      ctx = null;
      return false;
    }
  }

  /** Plays (inside a gesture, the first time: the AudioContext is only made then). */
  function play() {
    if (!setup()) return;
    const c = ctx!, a = audio!;
    clearTimeout(sleep);
    if (c.state !== 'running') c.resume().catch(() => {});
    a.play().catch(() => {}); // a file the browser cannot play leaves the page silent, nothing more
    gain!.gain.setTargetAtTime(level(), c.currentTime, started ? FADE.back : FADE.start);
    started = true;
    playing = true;
  }

  /** Fades out, then pauses the element (and `then`). */
  function pause(tc: number, then?: () => void) {
    if (!ctx || !audio || !gain || !playing) return;
    const c = ctx, a = audio;
    playing = false;
    gain.gain.setTargetAtTime(0, c.currentTime, tc);
    clearTimeout(sleep);
    sleep = window.setTimeout(() => {
      a.pause();
      then?.();
      c.suspend().catch(() => {});
    }, tc * 6000 + 50);
  }

  /** Plays or pauses as the toggle, the story and the tab say. */
  const update = () => {
    if (on && unlocked && !over && !document.hidden) play();
    else pause(FADE.off);
  };

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    on = !on;
    render();
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* not kept */ }
    if (still) return;
    unlocked = true; // a click is a gesture
    if (on) over = false; // asked for after the chapter's end: it plays again
    update();
  });

  if (!still) {
    const unlock = (e: Event) => {
      if (e.target instanceof Node && button.contains(e.target)) return; // the toggle decides for itself
      // a key or pointer event the browser does not count as a gesture: wait for the next
      const activation = (navigator as { userActivation?: { isActive: boolean } }).userActivation;
      if (activation && !activation.isActive) return;
      for (const type of GESTURES) removeEventListener(type, unlock, true);
      unlocked = true;
      update();
    };
    for (const type of GESTURES) addEventListener(type, unlock, true);
    document.addEventListener('visibilitychange', () => { if (unlocked) update(); });
  }

  return {
    /** A stage cue has started (src/scene/cues.ts): the music follows the story. */
    cue(name: string) {
      if (name === 'flashback' || name === 'present') {
        cold = name === 'flashback';
        if (!ctx || !filter || !gain) return;
        const now = ctx.currentTime;
        filter.frequency.setTargetAtTime(cold ? COLD.cutoff : 20000, now, FADE.mood);
        if (playing) gain.gain.setTargetAtTime(level(), now, FADE.mood);
      } else if (name === 'exit') {
        over = true;
        // back to the top once faded, so music asked for again starts from the beginning
        pause(FADE.end, () => { if (audio) audio.currentTime = 0; });
      }
    },
    /** For tests (?debug): whether it plays, and the context's and the element's state. */
    get state() { return { on, playing, cold, over, context: ctx?.state ?? null, paused: audio?.paused ?? null, time: audio?.currentTime ?? null }; },
  };
}
