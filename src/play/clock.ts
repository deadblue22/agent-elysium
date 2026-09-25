// A virtual clock for the demo's animations: every tween, wait and typewriter reads it, so
//   - playback speed can be scaled (?speed=N) and reduced motion can skip tweens to their end,
//   - a test harness can freeze time at an exact point of a named tween (hold) and take a
//     screenshot, even when frames take seconds to render (software WebGL).
// It is ticked by the render loop and by a timer, so waits resolve even between slow frames.

export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  out: (t: number) => 1 - (1 - t) ** 3,
  in: (t: number) => t * t * t,
  /** overshoots a little and settles: pop-up pieces springing up */
  back: (t: number) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
};

interface Tween { name?: string; start: number; dur: number; fn: (p: number) => void; ease: Ease; done: () => void }
interface Waiter { at: number; done: () => void }

export class Clock {
  /** Virtual ms per real ms. */
  speed = 1;
  /** prefers-reduced-motion: tweens jump to their end state. */
  reduced = false;
  private t = 0;
  private last = performance.now();
  private tweens = new Set<Tween>();
  private waiters = new Set<Waiter>();
  private holdReq: { name: string; at: number } | null = null;
  private heldName: string | null = null;

  constructor() {
    setInterval(() => this.tick(), 16);
  }

  /** Virtual time, ms. */
  now(): number { return this.t; }

  /** True while any tween runs (the render loop keeps rendering). */
  get busy(): boolean { return this.tweens.size > 0; }

  /**
   * True while a tween that moves something in the scene runs (the render loop refreshes the
   * shadow maps). Tweens named in `still` (the typewriter, the log's scroll) move nothing.
   */
  get moving(): boolean {
    for (const tw of this.tweens) if (!tw.name || !Clock.still.has(tw.name)) return true;
    return false;
  }
  static still = new Set(['type', 'scroll']);

  /**
   * Counts the tweens started that move something in the scene, instant ones included (under
   * reduced motion every tween is instant, so `moving` never shows them): the render loop
   * refreshes the shadow maps when it changes.
   */
  changes = 0;

  /** Stops every running tween called `name` where it is (its promise resolves). */
  cancel(name: string) {
    for (const tw of [...this.tweens]) if (tw.name === name) { this.tweens.delete(tw); tw.done(); }
  }

  /** Ends every running tween called `name` now, at its end state. */
  finish(name: string) {
    for (const tw of [...this.tweens]) {
      if (tw.name !== name) continue;
      tw.fn(tw.ease(1));
      this.tweens.delete(tw);
      tw.done();
    }
  }

  /** Name of the tween time is frozen in, if any. */
  get held(): string | null { return this.heldName; }

  /** Freeze time when the next tween called `name` reaches progress `at` (0..1). */
  hold(name: string, at: number) { this.holdReq = { name, at }; }

  release() { this.heldName = null; this.holdReq = null; this.last = performance.now(); }

  tick(real = performance.now()) {
    const dt = Math.max(0, real - this.last);
    this.last = real;
    if (this.heldName) return;
    let next = this.t + dt * this.speed;
    if (this.holdReq) {
      for (const tw of this.tweens) {
        if (tw.name !== this.holdReq.name) continue;
        const limit = tw.start + tw.dur * this.holdReq.at;
        // only a tween still short of the point (time never runs backwards)
        if (this.t <= limit && next >= limit) { next = limit; this.heldName = tw.name; }
      }
    }
    this.t = next;
    for (const tw of [...this.tweens]) {
      if (!this.tweens.has(tw)) continue; // finished by an earlier tween's callback
      const p = Math.min(1, (this.t - tw.start) / tw.dur);
      tw.fn(tw.ease(p));
      if (p >= 1 && !this.heldName) { this.tweens.delete(tw); tw.done(); }
    }
    for (const w of [...this.waiters]) if (this.t >= w.at) { this.waiters.delete(w); w.done(); }
  }

  /** Resolves after `ms` of virtual time. */
  wait(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((done) => this.waiters.add({ at: this.t + ms, done }));
  }

  /** Calls fn(progress) every tick for `ms`, ending with fn(1). Reduced motion: fn(1) at once. */
  tween(ms: number, fn: (p: number) => void, easing: Ease = ease.inOut, name?: string): Promise<void> {
    if (!name || !Clock.still.has(name)) this.changes++;
    if (this.reduced || ms <= 0) { fn(1); return Promise.resolve(); }
    fn(0);
    return new Promise((done) => this.tweens.add({ name, start: this.t, dur: ms, fn, ease: easing, done }));
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
