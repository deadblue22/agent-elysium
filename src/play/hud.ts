// The original's HUD over the frame (?ui=de; styles in index.html under data-ui). Only what
// this chapter plays has a place on it:
//   - bottom left, Harry's and Kim's portraits in round frames (src/play/portraits.ts); the
//     speaker's frame lights. Over Harry's, morale (the chapter's one resource) as the original's
//     numbered blue cross over a row of pips; it is the only morale on screen (the table has no
//     paper hearts under ?ui=de), and its hover tip is theirs.
//   - bottom right, on a dark strip, the clock: the present runs from the morning on, a minute a
//     line, as the original's clock moves only with the dialogue; during the reconstruction it
//     shows the time marker's minutes, 「昨晚」 after them.
//   - over the top of the log's panel, an inner voice's cue: when a skill speaks, its name
//     flashes in its attribute's colour.
//   - the original's banners: CHECK SUCCESS / CHECK FAILURE under the dice when they settle,
//     DAMAGED MORALE beside the portraits when a point is lost.
// The original's health, tool icons (character sheet, inventory, journal, thought cabinet) and
// film codes are left out: nothing in the chapter uses them (docs/ui.md 3.3).
// Its animations run on the virtual clock (tweens named 'hud'), so ?speed and reduced motion hold.
import type { Sound } from '../audio/sfx';
import type { Lang, Line } from '../content/schema';
import { ATTRIBUTES, SKILLS, skillName } from '../content/skills';
import { ui } from '../content/ui';
import { ease, type Clock } from './clock';
import { HARRY_SVG, KIM_SVG } from './portraits';

/** The present's time when the chapter opens (minutes): the morning after, the RCM on the scene. */
export const MORNING = 8 * 60 + 40;
/** How long a banner stays (virtual ms) before it goes; how long each morale pip takes to turn. */
const HOLD = { banner: 1700, pip: 700 };
/** Morale's sounds come from the bottom left, where it is shown. */
const MORALE_PAN = -0.85;

/** 530 → 「08:50」 */
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;

export interface HudOptions {
  clock: Clock;
  lang: Lang;
  morale: { value: number; max: number };
  /**
   * The pointer is over a HUD item with a hover tip (a HOTSPOTS key), or has left it. `at`
   * (client px) is where the tip goes: its left edge, at its vertical middle.
   */
  hover?: (key: string | null, at: { clientX: number; clientY: number }) => void;
  /** Sound effects (src/audio/sfx.ts). */
  sound?: Sound;
}

export function createHud(frame: HTMLElement, o: HudOptions) {
  const { clock } = o;
  const sound = o.sound ?? (() => {});
  let lang = o.lang;
  const el = document.createElement('div');
  el.className = 'hud';
  el.setAttribute('aria-hidden', 'true');
  const pips = (cls: string, n: number) => Array.from({ length: n }, () => `<i class="${cls}"></i>`).join('');
  el.innerHTML = `
    <div class="party">
      <div class="lead">
        <div class="vitals"><span class="stat morale"><b></b></span><div class="pips">${pips('mp', o.morale.max)}</div></div>
        <div class="face harry">${HARRY_SVG}</div>
      </div>
      <div class="face kim">${KIM_SVG}</div>
    </div>
    <div class="tray">
      <svg class="strip" viewBox="0 0 260 72" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M0 72 L30 24 L260 12 L260 72Z" fill="rgba(9,8,7,.8)"/>
        <path d="M0 72 L30 24 L260 12" fill="none" stroke="rgba(226,220,208,.26)" stroke-width="1"/>
      </svg>
      <div class="clock"><span class="t"></span><span class="d"></span></div>
    </div>
    <div class="voice" hidden><div class="in"><span class="skill"></span><span class="attr"></span></div></div>
    <div class="banner check" hidden><span></span></div>
    <div class="banner morale" hidden><span></span></div>`;
  frame.append(el);
  const $ = <T extends HTMLElement>(sel: string) => el.querySelector(sel) as T;
  const faces = { harry: $('.face.harry'), kim: $('.face.kim') };
  const vitals = $('.vitals'), moraleStat = $('.stat.morale'), moraleNum = $('.stat.morale b');
  const moralePips = [...el.querySelectorAll<HTMLElement>('.pips .mp')];
  const clockT = $('.clock .t'), clockD = $('.clock .d'), clockEl = $('.clock');
  const voice = $('.voice'), voiceSkill = $('.voice .skill'), voiceAttr = $('.voice .attr');
  const banners = { check: $('.banner.check'), morale: $('.banner.morale') };

  // morale's hover tip (the paper hearts' on the table, HOTSPOTS.morale), beside Kim's portrait,
  // where the table is clear and the tip covers neither the log nor its continue bar
  const tipAt = () => {
    const r = faces.kim.getBoundingClientRect();
    return { clientX: r.right + r.width * 0.2, clientY: r.top + r.height / 2 };
  };
  vitals.addEventListener('pointerenter', () => o.hover?.('morale', tipAt()));
  vitals.addEventListener('pointerleave', () => o.hover?.(null, tipAt()));

  // ---- state
  let morale = o.morale.value, present = MORNING, night: number | null = null;
  let voiced: Line | null = null;
  /** What each banner says (it is re-set when the language changes). */
  const said = new Map<HTMLElement, { key: 'checkSuccess' | 'checkFailure' | 'moraleSlip'; tail: string }>();
  const say = (b: HTMLElement) => { const t = said.get(b); b.firstElementChild!.textContent = t ? ui[t.key][lang] + t.tail : ''; };
  const showMorale = () => {
    moraleNum.textContent = String(morale);
    moralePips.forEach((p, i) => p.classList.toggle('off', i >= morale));
  };
  const showClock = () => {
    const t = hhmm(night ?? present);
    clockT.innerHTML = `${t.slice(0, 2)}<span class="colon">:</span>${t.slice(3)}`;
    clockD.textContent = night === null ? ui.day[lang] : ui.lastNight[lang].replace('{t}', '').replace(/[,，\s]+$/, '');
    clockEl.classList.toggle('night', night !== null);
  };
  const showVoice = () => {
    const s = voiced?.speaker;
    if (typeof s !== 'string' || !(s in SKILLS)) return;
    const skill = SKILLS[s as keyof typeof SKILLS];
    voiceSkill.textContent = skillName(s as keyof typeof SKILLS, voiced!.sense, lang);
    voiceAttr.textContent = ATTRIBUTES[skill.attribute].name[lang];
    voice.style.setProperty('--attr', ATTRIBUTES[skill.attribute].panel);
  };
  showMorale();
  showClock();

  /**
   * A cue's life on the virtual clock: in (0..1), then out (1..0) after `hold` ms, or when
   * `leave` is called (hold = Infinity). A newer showing of the same cue takes over.
   */
  const lives = new Map<HTMLElement, { run: number; leave: () => void }>();
  async function live(node: HTMLElement, hold: number, frame: (p: number, out: boolean) => void) {
    const run = (lives.get(node)?.run ?? 0) + 1;
    lives.get(node)?.leave(); // the showing it takes over from ends quietly
    let leave = () => {};
    const left = new Promise<void>((r) => { leave = r; });
    lives.set(node, { run, leave });
    const mine = () => lives.get(node)?.run === run;
    node.hidden = false;
    await clock.tween(360, (p) => { if (mine()) frame(p, false); }, ease.out, 'hud');
    await (hold === Infinity ? left : Promise.race([left, clock.wait(hold)]));
    if (!mine()) return;
    await clock.tween(420, (p) => { if (mine()) frame(1 - p, true); }, ease.inOut, 'hud');
    if (mine()) node.hidden = true;
  }
  /** Lets a cue shown until further notice go. */
  const release = (node: HTMLElement) => lives.get(node)?.leave();

  return {
    el,
    setLang(l: Lang) {
      lang = l;
      showClock();
      showVoice();
      for (const b of Object.values(banners)) say(b);
    },
    /** Morale as shown. */
    get value() { return morale; },
    /** Sets morale without animating (the style board, the start). */
    set(v: number) { morale = v; showMorale(); },
    /**
     * Morale changes in the story (resolves once it is shown): a lost point raises DAMAGED
     * MORALE; the pips that change turn one after another, each flaring as it goes, and the
     * cross swells as its number changes (the paper hearts' pace, so the story's rests hold).
     */
    async to(v: number) {
      const from = morale;
      if (v === from) return;
      const lost = v < from;
      morale = v;
      sound(lost ? 'morale-down' : 'morale-up', { pan: MORALE_PAN });
      if (lost) {
        const b = banners.morale;
        said.set(b, { key: 'moraleSlip', tail: `  -${from - v}` }); // (ASCII: the font subsets carry no U+2212)
        say(b);
        void live(b, HOLD.banner, (p) => { b.style.opacity = String(p); b.style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`; });
      }
      const turning = lost ? moralePips.slice(v, from).reverse() : moralePips.slice(from, v);
      for (const [n, pip] of turning.entries()) {
        let turned = false;
        await clock.tween(HOLD.pip, (p) => {
          const k = Math.sin(Math.PI * p);
          pip.style.transform = `scale(${1 + 0.5 * k}, ${1 + 0.9 * k})`;
          pip.style.filter = `brightness(${1 + 1.6 * k})`;
          moraleStat.style.transform = `scale(${1 + 0.16 * k})`;
          if (p >= 0.5 && !turned) {
            turned = true;
            pip.classList.toggle('off', lost);
            moraleNum.textContent = String(lost ? from - n - 1 : from + n + 1);
          }
        }, ease.inOut, 'hud');
        pip.style.transform = pip.style.filter = moraleStat.style.transform = '';
      }
      showMorale();
    },
    /**
     * A line starts: the present moves on a minute. A skill's line flashes its cue, which stays
     * while the line is the newest; any other line lets it go.
     */
    line(line: Line) {
      if (night === null) { present++; showClock(); }
      const s = line.speaker;
      if (typeof s !== 'string' || !(s in SKILLS)) { release(voice); return; }
      voiced = line;
      showVoice();
      // the flash: the strip lights in the skill's colour and settles to black, the name to that colour
      void live(voice, Infinity, (p, out) => {
        voice.style.opacity = String(out ? p : Math.min(1, p * 2.5));
        voice.style.setProperty('--flash', out ? '0' : String(1 - p));
        if (!out) voice.style.clipPath = `inset(0 ${(1 - Math.min(1, p * 1.6)) * 100}% 0 0)`;
      });
    },
    /** The options are up (or the chapter is over): the last voice's cue goes. */
    quiet() { release(voice); },
    /** Who is speaking (their line is typing): their frame lights. */
    speaking(who: 'harry' | 'kim' | null) {
      faces.harry.classList.toggle('speaking', who === 'harry');
      faces.kim.classList.toggle('speaking', who === 'kim');
    },
    /** The reconstruction's time (minutes), or null back in the present. */
    when(minutes: number | null) { night = minutes; showClock(); },
    /** The present's time (the style board's moment). */
    setTime(minutes: number) { present = minutes; showClock(); },
    /** The dice have settled: the banner under them (`at`: frame px of the dice's bottom middle). */
    checked(success: boolean, at: { x: number; y: number }) {
      const b = banners.check;
      said.set(b, { key: success ? 'checkSuccess' : 'checkFailure', tail: '' });
      say(b);
      b.classList.toggle('fail', !success);
      b.style.left = `calc(${at.x}px * var(--s))`;
      b.style.top = `calc(${at.y}px * var(--s))`;
      void live(b, HOLD.banner, (p) => { b.style.opacity = String(p); b.style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`; });
    },
    /** Where the voice cue sits: frame px of the panel's top left. */
    place(at: { x: number; y: number }) {
      voice.style.left = `calc(${at.x}px * var(--s))`;
      voice.style.top = `calc(${at.y}px * var(--s))`;
    },
  };
}

export type Hud = ReturnType<typeof createHud>;
