// The chapter's background music (the piece: ./score.ts; its instruments: ./engine.ts): the
// toggle beside the language switch, the start on the first click or key press (browsers keep
// audio off until then, and warn about a page that tries earlier), the lookahead timer that
// feeds the engine, and the story's hooks (src/scene/cues.ts): the flashback turns the music
// cold, the present warms it again, the chapter's end fades it out. The toggle's choice is
// kept in localStorage; the music pauses while the tab is hidden. ?still makes no sound at all.
import { createBand, type Band } from './engine';

const KEY = 'agent-elysium:music';
/** Notes are scheduled this far ahead (s), every TICK ms: the main thread may stall for a frame or two. */
const AHEAD = 0.5, TICK = 60;
/** Fades (time constants, s): in at the start, out at the toggle or a hidden tab, back in, out at the end. */
const FADE = { start: 1, off: 0.12, back: 0.35, end: 2.2 };
/** Events that can carry the gesture a browser asks for before it plays audio. */
const GESTURES = ['pointerdown', 'pointerup', 'keydown', 'touchend'];

export function createMusic({ button, still }: { button: HTMLButtonElement; still: boolean }) {
  let on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch { /* storage blocked: the default */ }
  let ctx: AudioContext | null = null, band: Band | null = null;
  let playing = false, cold = false, over = false, unlocked = false;
  let timer = 0, sleep = 0;

  const render = () => button.setAttribute('aria-pressed', String(on));
  render();

  const feed = () => { if (ctx && band) band.schedule(ctx.currentTime + AHEAD); };

  /** Plays (inside a gesture, the first time: the AudioContext is only made then). */
  function play() {
    if (!ctx) {
      try {
        ctx = new AudioContext({ latencyHint: 'playback' });
        band = createBand(ctx);
      } catch (err) {
        console.info('[music] no Web Audio:', err);
        ctx = null;
        return;
      }
    }
    const b = band!;
    clearTimeout(sleep);
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    if (!b.running) {
      // from the top, fading in
      b.mood(cold, now, 0);
      b.fade(0, now, 0);
      b.start(now + 0.05);
      b.fade(1, now + 0.05, FADE.start);
    } else if (!playing) b.fade(1, now, FADE.back);
    playing = true;
    feed();
    clearInterval(timer);
    timer = window.setInterval(feed, TICK);
  }

  /** Fades out, keeps feeding the notes while it does, then sleeps (and `then`). */
  function pause(tc: number, then?: () => void) {
    if (!ctx || !band || !playing) return;
    const c = ctx, b = band;
    playing = false;
    b.fade(0, c.currentTime, tc);
    clearTimeout(sleep);
    sleep = window.setTimeout(() => {
      clearInterval(timer);
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
        if (ctx && band) band.mood(cold, ctx.currentTime);
      } else if (name === 'exit') {
        over = true;
        // the transport stops once faded, so music asked for again starts from the top
        const halt = () => { if (ctx && band) band.halt(ctx.currentTime); };
        if (playing) pause(FADE.end, halt);
        else halt();
      }
    },
    /** For tests (?debug): whether it plays, and the context's state. */
    get state() { return { on, playing, cold, over, context: ctx?.state ?? null }; },
  };
}
