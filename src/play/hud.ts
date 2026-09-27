// The original's HUD over the frame (?ui=de; styles in index.html under data-ui):
//   - bottom left, Harry's and Kim's portraits in round frames (src/play/portraits.ts); over
//     Harry's, health (orange) and morale (blue) as numbered crosses over a row of pips. Morale
//     follows the story; health stays full (the chapter has no health). The speaker's frame lights.
//   - bottom right, on a dark tray with film codes, the original's four tool icons (character
//     sheet, inventory, journal, thought cabinet); the journal carries the leads found as its
//     orange badge, and its hover tip lists them. Then the clock: the present runs from the
//     morning on, a minute a line, as the original's clock moves only with the dialogue; during
//     the reconstruction it shows the time marker's minutes, 「昨晚」 after them.
//   - over the top of the log's panel, an inner voice's cue: when a skill speaks, its name
//     flashes in its attribute's colour.
//   - the original's banners: CHECK SUCCESS / CHECK FAILURE under the dice when they settle,
//     DAMAGED MORALE beside the portraits when a point is lost.
// Its animations run on the virtual clock (tweens named 'hud'), so ?speed and reduced motion hold.
import type { Lang, Line } from '../content/schema';
import { ATTRIBUTES, SKILLS, skillName } from '../content/skills';
import { ui } from '../content/ui';
import { ease, type Clock } from './clock';
import { HARRY_SVG, KIM_SVG } from './portraits';

/** The present's time when the chapter opens (minutes): the morning after, the RCM on the scene. */
export const MORNING = 8 * 60 + 40;
/** Health is not played in this chapter: Harry's four points stay full. */
const HEALTH = 4;
/** How long a banner stays (virtual ms) before it goes. */
const HOLD = { banner: 1700 };

/** The original's tool icons, drawn as thin outlines (32 x 32). */
const ICONS = {
  sheet: '<rect x="4" y="7" width="6.4" height="7.6" rx="1.4"/><rect x="12.8" y="7" width="6.4" height="7.6" rx="1.4"/><rect x="21.6" y="7" width="6.4" height="7.6" rx="1.4"/><rect x="4" y="17.4" width="6.4" height="7.6" rx="1.4"/><rect x="12.8" y="17.4" width="6.4" height="7.6" rx="1.4"/><rect x="21.6" y="17.4" width="6.4" height="7.6" rx="1.4"/>',
  case: '<rect x="4" y="10.5" width="24" height="15.5" rx="2.4"/><path d="M12.2 10.5V8.1q0-1.6 1.6-1.6h4.4q1.6 0 1.6 1.6v2.4M4 16.4h24M10.2 14.6v3.6M21.8 14.6v3.6"/>',
  journal: '<g transform="rotate(9 16 16)"><rect x="8.6" y="4.6" width="16.4" height="23" rx="1.4"/><path d="M12.8 10h8.4M12.8 13.6h8.4M6.6 8.4h3.6M6.6 12.2h3.6M6.6 16h3.6M6.6 19.8h3.6M6.6 23.6h3.6"/></g>',
  cabinet: '<path d="M16 2.4 29.6 16 16 29.6 2.4 16z"/><path d="M13.4 22.6v-2.8q-3.2-1.2-3.2-5.2 0-5.2 5.6-5.2 5.4 0 5.4 4.8l1.6 2.6-1.6.5v1.9q0 1.7-2.8 1.7v1.7"/>',
};
const icon = (name: keyof typeof ICONS) => `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${ICONS[name]}</svg>`;

/** 530 → 「08:50」 */
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;

export interface HudOptions {
  clock: Clock;
  lang: Lang;
  morale: { value: number; max: number };
  /** The pointer is over a HUD item with a hover tip (a HOTSPOTS key), or has left it. */
  hover?: (key: string | null, at: { clientX: number; clientY: number }) => void;
}

export function createHud(frame: HTMLElement, o: HudOptions) {
  const { clock } = o;
  let lang = o.lang;
  const el = document.createElement('div');
  el.className = 'hud';
  el.setAttribute('aria-hidden', 'true');
  const pips = (cls: string, n: number) => Array.from({ length: n }, () => `<i class="${cls}"></i>`).join('');
  el.innerHTML = `
    <div class="party">
      <div class="lead">
        <div class="vitals"><span class="stat health"><b>${HEALTH}</b></span><span class="stat morale"><b></b></span></div>
        <div class="pips">${pips('hp', HEALTH)}${pips('mp', o.morale.max)}</div>
        <div class="face harry">${HARRY_SVG}</div>
      </div>
      <div class="face kim">${KIM_SVG}</div>
    </div>
    <div class="tray">
      <svg class="strip" viewBox="0 0 480 86" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M0 86 L34 32 L130 20 L480 8 L480 86Z" fill="rgba(9,8,7,.8)"/>
        <path d="M0 86 L34 32 L130 20 L480 8" fill="none" stroke="rgba(226,220,208,.26)" stroke-width="1"/>
        <path d="M30 38 L130 26 L480 14" fill="none" stroke="rgba(226,220,208,.1)" stroke-width="1" stroke-dasharray="3 9"/>
      </svg>
      <span class="code c1">01A19</span><span class="code c2">01A20</span>
      <div class="icons">
        <span class="ico">${icon('sheet')}</span><span class="ico">${icon('case')}</span>
        <span class="ico journal">${icon('journal')}<em class="badge" hidden></em></span><span class="ico">${icon('cabinet')}</span>
      </div>
      <div class="clock"><span class="t"></span><span class="d"></span></div>
    </div>
    <div class="voice" hidden><div class="in"><span class="skill"></span><span class="attr"></span></div></div>
    <div class="banner check" hidden><span></span></div>
    <div class="banner morale" hidden><span></span></div>`;
  frame.append(el);
  const $ = <T extends HTMLElement>(sel: string) => el.querySelector(sel) as T;
  const faces = { harry: $('.face.harry'), kim: $('.face.kim') };
  const moraleNum = $('.stat.morale b');
  const moralePips = [...el.querySelectorAll<HTMLElement>('.pips .mp')];
  const clockT = $('.clock .t'), clockD = $('.clock .d'), clockEl = $('.clock');
  const badge = $('.journal .badge'), journal = $('.journal');
  const voice = $('.voice'), voiceSkill = $('.voice .skill'), voiceAttr = $('.voice .attr');
  const banners = { check: $('.banner.check'), morale: $('.banner.morale') };

  // the journal's tip lists the leads found (the stack's tip on the table, HOTSPOTS.leads)
  journal.addEventListener('pointerenter', (e) => o.hover?.('leads', e));
  journal.addEventListener('pointermove', (e) => o.hover?.('leads', e));
  journal.addEventListener('pointerleave', (e) => o.hover?.(null, e));

  // ---- state
  let morale = o.morale.value, leads = 0, present = MORNING, night: number | null = null;
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
    /** Sets morale without a banner (the style board, the start). */
    setMorale(v: number) { morale = v; showMorale(); },
    /** Morale changes in the story: the pips follow; a lost point raises DAMAGED MORALE. */
    morale(v: number) {
      const lost = morale - v;
      morale = v;
      showMorale();
      if (lost <= 0) return;
      const b = banners.morale;
      said.set(b, { key: 'moraleSlip', tail: `  -${lost}` }); // (ASCII: the font subsets carry no U+2212)
      say(b);
      void live(b, HOLD.banner, (p) => { b.style.opacity = String(p); b.style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`; });
    },
    /** Leads found: the journal's badge (it pulses when one is added). */
    leads(count: number) {
      const added = count > leads;
      leads = count;
      badge.hidden = count === 0;
      badge.textContent = String(count);
      if (added) void clock.tween(700, (p) => { badge.style.transform = `scale(${1 + 0.6 * Math.sin(Math.PI * p)})`; }, ease.out, 'hud');
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
