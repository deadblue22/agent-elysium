// 雪落之前 · chapter one, playable, rendered with Three.js.
// URL flags:
//   ?still        the style board: the study.clock moment, frozen (snow, grain, flicker,
//                 cursor), no playing; for npm run shot
//   ?lang=en      start in English
//   ?seed=N       seed the dice;  ?dice=4-5,3-3,5-6  force the next rolls (then the seed's)
//   ?speed=N      play animations and the typewriter N times faster (test harness)
//   ?debug        expose the painters, scene and renderer on window.__debug
// prefers-reduced-motion: every tween jumps to its end, the snow and grain hold still.
import { Box3, NoToneMapping, PCFShadowMap, PMREMGenerator, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer, type Mesh, type PerspectiveCamera } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadArt, loadFonts } from './assets';
import type { Lang } from './content/schema';
import { EVIDENCE_LABELS, study } from './content/study';
import { chrome, clockMoment } from './content/study-clock';
import { ui } from './content/ui';
import { Runner, optionId } from './engine';
import { PageHit } from './page/hit';
import { FADE, Measurer, PAGE, layoutRightPage, textColumn, type PageLayout, type Rect } from './page/layout';
import { PagePainter } from './page/painter';
import { Clock } from './play/clock';
import { Director } from './play/director';
import { LogView, renderTooltip } from './play/log';
import { createBook } from './scene/book';
import { FRAME, createCameraRig } from './scene/camera';
import { createCues } from './scene/cues';
import { createDice } from './scene/dice';
import { createHearts } from './scene/hearts';
import { createLights } from './scene/lights';
import { createPopup, layers, roomLights } from './scene/popup';
import { createPost } from './scene/post';
import { createStage } from './scene/puppets';
import { createLeadCard } from './scene/lead';
import { createHotspots } from './scene/hotspots';
import { HOTSPOTS } from './content/hotspots';
import { holds } from './engine/rules';
import { createSnow } from './scene/snow';
import { BASE_Y, DEG, envelope, sheetY, wx, wz } from './scene/space';
import { createTable } from './scene/table';

declare global {
  interface Window {
    __ready?: boolean;
    /** For tools/shot.mjs: frame-space rects, composition metrics and renderer facts. */
    __shot?: {
      page: Rect; column: Rect; renderer: string; webgl2: boolean; anisotropy: number; ink: { w: number; h: number };
      metrics: Record<string, number>;
      /** Frame points for the close-up crops: the gutter at the near edge, the right page's near outer corner. */
      points: { gutter: { x: number; y: number }; corner: { x: number; y: number } };
      /** Frame rect around the two puppets. */
      puppets: Rect;
    };
    /** Renders n frames synchronously and returns the mean ms per frame (for tools/shot.mjs). */
    __bench?: (n: number) => number;
    /** For tools/play.mjs: the state of play, and ways to stop time at a chosen moment. */
    __play?: {
      options(): { number: number; id: string; state: 'enabled' | 'greyed' }[];
      readonly idle: boolean;
      readonly ended: boolean;
      readonly node: string;
      readonly morale: number;
      readonly flags: string[];
      /** The log as the screen-reader mirror has it. */
      log(): string[];
      /** Client position of a point on a hover-tip target (tests), or null. */
      hotspot(key: string): { x: number; y: number } | null;
      /** The hover tip showing, by key, or null. */
      readonly hover: string | null;
      /** Ends the camera's parallax easing at once. */
      snapCamera(): void;
      /** The stop the story waits at for a click (`line:narrator:2`, `notice:1`, …), or null. */
      readonly stop: string | null;
      /** Pause after a beat (`line:narrator:2`, `stage:snow-start`, …) until resume(). */
      pauseAfter(key: string): void;
      readonly paused: string | null;
      resume(): void;
      /** Freeze time when the next tween called `name` reaches `at` (0..1), until release(). */
      hold(name: string, at: number): void;
      readonly held: string | null;
      release(): void;
      /** Frames rendered so far. */
      readonly frames: number;
    };
  }
}

const params = new URLSearchParams(location.search);
const STILL = params.has('still');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** No ambient motion: snow, grain, candle flicker and the cursor hold still. */
const FROZEN = STILL || REDUCED;
let lang: Lang = params.get('lang') === 'en' ? 'en' : 'zh';

const frameEl = document.getElementById('frame') as HTMLDivElement;
const canvas = document.getElementById('gl') as HTMLCanvasElement;
const tipEl = document.getElementById('tip') as HTMLDivElement;
const whenEl = document.getElementById('when') as HTMLDivElement;
const hotEl = document.getElementById('hot') as HTMLDivElement;

function frameSize() {
  const w = Math.max(320, Math.floor(Math.min(innerWidth, (innerHeight * 16) / 9)));
  return { w, h: Math.round((w * 9) / 16) };
}

/**
 * Canvas px per page px for the log: the page shows at about 0.85 frame px per page px across
 * and a little less along; 3x keeps the glyphs crisp at 1:1 and on a 2x screen.
 * The right page only carries its page number.
 */
const inkScale = (w: number, pr: number) => Math.min(4, Math.max(3, (3 * w * pr) / FRAME.w));
const labelScale = (w: number, pr: number) => Math.min(3, Math.max(1.5, (1.5 * w * pr) / FRAME.w));
/**
 * The log's glyphs are drawn this much taller than wide: the camera sees the left page at
 * about 55 degrees, which squashes them to about 0.82 of their height; drawn 1.1x, they show
 * at about 0.9, close to their true shape.
 */
const INK_STRETCH = 1.1;

/** Frame position of a point on the top sheets (or at height h). */
function onFrame(camera: PerspectiveCamera, bx: number, by: number, h = sheetY(bx, by)) {
  const v = new Vector3(wx(bx), h, wz(by)).project(camera);
  return { x: ((v.x + 1) / 2) * FRAME.w, y: ((1 - v.y) / 2) * FRAME.h };
}

/** Frame-space bounding box of world-space boxes. */
function frameRect(camera: PerspectiveCamera, boxes: Box3[]): Rect {
  const xs: number[] = [], ys: number[] = [];
  for (const b of boxes) {
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const v = new Vector3(x, y, z).project(camera);
      xs.push(((v.x + 1) / 2) * FRAME.w);
      ys.push(((1 - v.y) / 2) * FRAME.h);
    }
  }
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Frame-space bounding box of a rect on the top sheets (sampled along its edges: the sheets are curved). */
function projectRect(camera: PerspectiveCamera, bx0: number, by0: number, bx1: number, by1: number): Rect {
  const xs: number[] = [], ys: number[] = [];
  for (let k = 0; k <= 16; k++) {
    for (const [bx, by] of [[bx0 + ((bx1 - bx0) * k) / 16, by0], [bx0 + ((bx1 - bx0) * k) / 16, by1], [bx0, by0 + ((by1 - by0) * k) / 16], [bx1, by0 + ((by1 - by0) * k) / 16]]) {
      const p = onFrame(camera, bx, by);
      xs.push(p.x); ys.push(p.y);
    }
  }
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** 1330 minutes → 「22:10」 */
const clockTime = (min: number) => `${Math.floor(min / 60) % 24}:${String(Math.round(min % 60)).padStart(2, '0')}`;

/** ?dice=4-5,3-3 → [[4, 5], [3, 3]] */
function parseDice(s: string | null): [number, number][] {
  if (!s) return [];
  return s.split(',').map((p) => p.split('-').map(Number)).filter((d) => d.length === 2 && d.every((v) => v >= 1 && v <= 6)) as [number, number][];
}

async function main() {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch {
    document.getElementById('nogl')!.hidden = false;
    return;
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping; // exposure and the shoulder live in the post pass
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap; // soft: r186's PCF samples a Vogel disk scaled by shadow.radius
  renderer.shadowMap.autoUpdate = false; // re-rendered only while something that casts moves
  renderer.setClearColor('#0b0806');
  const anisotropy = renderer.capabilities.getMaxAnisotropy();

  const [art] = await Promise.all([loadArt(anisotropy), loadFonts()]);

  const clock = new Clock();
  clock.speed = Math.max(0.1, Number(params.get('speed')) || 1);
  clock.reduced = FROZEN;

  const { w: w0 } = frameSize();
  const pr0 = Math.min(devicePixelRatio, 2);
  const leftInk = new PagePainter(anisotropy, inkScale(w0, pr0));
  const rightInk = new PagePainter(anisotropy, labelScale(w0, pr0));

  const scene = new Scene();
  const t0 = performance.now();
  const book = createBook(art, leftInk.texture, rightInk.texture);
  const popup = createPopup(art), stage = createStage(art);
  // on the table beside the book: the leads found, the morale hearts, the dice
  const hearts = createHearts(art, clock, study.morale.max);
  const lead = createLeadCard(art, clock, book.rightSheet);
  const dice = createDice(art, clock);
  const buildMs = performance.now() - t0; // geometry, procedural textures and the baked occlusion
  const lights = createLights(roomLights(art.floor.meta));
  const cam = createCameraRig();
  scene.add(createTable(art), book.group, popup.group, stage.group, hearts.group, lead.group, dice.group, lights.group, cam.rig);
  // a soft, low environment light, so curved paper, page edges and board edges read through
  // gentle shading gradients and not only through the direct lights
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.1;
  pmrem.dispose();

  // the log starts under the left sheet's tear (its extent comes from the SVG, via the manifest)
  const tear = art['page-left'].meta;
  const col = textColumn(tear.columnY0);
  const column = projectRect(cam.camera, col.x0, col.y0, col.x1, col.y1);
  // the ink is drawn INK_STRETCH times taller about the window's bottom, so the slanted page
  // shows the glyphs in their true proportions; the log is laid out in a window that much shorter
  leftInk.setStretch(INK_STRETCH, col.y1);
  const logCol = { ...col, y0: col.y1 - (col.y1 - col.y0) / INK_STRETCH };
  const pageRect = projectRect(cam.camera, 0, tear.tearMin - 14, PAGE.w, PAGE.h);
  // snow outside the window: flakes behind the wall's window hole (wall.svg's window region)
  const snow = createSnow(popup.pieces.wall.group, { x0: wx(342), x1: wx(628), y0: (440 - 338) / 100, y1: (440 - 76) / 100, depth: 0.2 }, cam.lens.focal);
  const post = createPost(renderer, scene, cam.camera);
  post.uniforms.uExposure.value = 1.08;
  post.uniforms.uQuiet.value.set(column.x / FRAME.w, 1 - (column.y + column.h) / FRAME.h, (column.x + column.w) / FRAME.w, 1 - column.y / FRAME.h);

  // ---- the stage cues
  /** The time the flashback's marker shows (minutes), or null when it is hidden. */
  let when: number | null = null;
  const showWhen = () => {
    if (when !== null) whenEl.textContent = ui.lastNight[lang].replace('{t}', clockTime(when));
    whenEl.classList.toggle('on', when !== null);
    whenEl.setAttribute('aria-hidden', String(when === null));
  };
  const cues = createCues({
    art, clock, popup, stage, lights, post, snow,
    marker: (minutes) => { when = minutes; showWhen(); },
  });

  // ---- the pages
  const measurer = new Measurer();
  let needsRender = true;
  const invalidate = () => { needsRender = true; };
  const a11y = document.getElementById('log') as HTMLOListElement;

  const runner = new Runner(study, { seed: params.has('seed') ? Number(params.get('seed')) >>> 0 : undefined, forcedDice: parseDice(params.get('dice')) });
  let director: Director | null = null;
  const log = new LogView(leftInk, measurer, logCol, clock, a11y, lang, (n) => { director?.choose(n); }, () => !!director?.idle);

  /** Re-renders the hover tip in the current language (set once the hover tips exist). */
  let refreshHot = () => {};
  /** Leads found so far (the stack of cards on the table; its hover tip lists them). */
  let leads = { count: 0, total: study.evidence.length };

  // who bobs while their line types (Harry for 你 lines, Kim for his)
  let speaker: 'harry' | 'kim' | null = null;
  const bob = { harry: 0, kim: 0 };

  if (STILL) {
    // the style board: study.clock right after Visual Calculus passes; morale 3 of 4
    log.showFixed(clockMoment);
    hearts.set(3);
    leads = { count: 1, total: study.evidence.length }; // 指针被拨过
    lead.fileAt((l) => ({ heading: ui.leadTag[l], lead: EVIDENCE_LABELS.clock_tampered[l], count: 1, total: study.evidence.length }));
  } else {
    hearts.set(study.morale.start);
    director = new Director(runner, clock, log, {
      dice, hearts, cues,
      lead,
      leads: (count, total) => { leads = { count, total }; invalidate(); },
      speaking: (who) => { speaker = who; },
    });
    director.onIdle = () => { hit.refresh(); invalidate(); };
  }

  function layoutRight() {
    rightInk.setLayout(layoutRightPage(lang, measurer));
  }

  function applyLang() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    log.setLang(lang);
    layoutRight();
    lead.setLang(lang);
    document.getElementById('title')!.textContent = chrome.title[lang];
    document.getElementById('chapter')!.textContent = chrome.chapter[lang];
    document.getElementById('log-heading')!.textContent = chrome.logHeading[lang];
    showWhen();
    refreshHot();
    for (const s of document.querySelectorAll<HTMLElement>('#lang [data-lang]')) s.classList.toggle('on', s.dataset.lang === lang);
    tipEl.hidden = true;
    invalidate();
  }
  applyLang();
  document.getElementById('lang')!.addEventListener('click', (e) => {
    e.stopPropagation();
    lang = lang === 'zh' ? 'en' : 'zh';
    applyLang();
  });

  // ---- input: number keys and clicks choose; a click or Space completes the line being typed
  const chooseIndex = (index: number) => {
    if (STILL) {
      const e = clockMoment.find((x) => x.kind === 'option' && x.index === index);
      console.info(`[study.clock] option ${index}`, e?.kind === 'option' ? e.option.text[lang] : '');
      return;
    }
    const view = log.optionAt(index);
    if (view) director?.choose(view.number);
  };
  const hit = new PageHit(canvas, cam.camera, book.leftPage, () => leftInk.optionRects(), {
    hover: (index, at) => {
      leftInk.setHover(index !== null && (STILL || director?.idle) ? index : null);
      const view = index !== null && !STILL ? log.optionAt(index) : undefined;
      renderTooltip(tipEl, view, lang);
      if (view && at && !tipEl.hidden) {
        const r = frameEl.getBoundingClientRect();
        const x = Math.min(at.clientX - r.left + 18, r.width - tipEl.offsetWidth - 8);
        const y = at.clientY - r.top + 20 + tipEl.offsetHeight > r.height - 8 ? at.clientY - r.top - tipEl.offsetHeight - 14 : at.clientY - r.top + 20;
        tipEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      }
      invalidate();
    },
    click: (index) => {
      // a click completes the line being typed or moves on from a stop; otherwise it may choose
      if (director?.proceed()) return;
      if (index !== null) chooseIndex(index);
    },
  });
  hit.choosable = (index) => STILL || (!!director?.idle && log.optionAt(index)?.state === 'enabled');
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !director) return;
    if (/^[1-9]$/.test(e.key)) {
      director.choose(Number(e.key));
    } else if ((e.key === ' ' || e.key === 'Enter') && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      director.proceed();
    }
  });
  // the wheel over the left page scrolls the log's history (older lines come down out of the tear)
  canvas.addEventListener('wheel', (e) => {
    if (!hit.pagePoint(e)) return;
    e.preventDefault();
    const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    if (leftInk.scrollBy(-px * 0.6)) { invalidate(); hit.refresh(); }
  }, { passive: false });
  if (!FROZEN) {
    let on = true;
    setInterval(() => { on = !on; leftInk.setCursor(on); invalidate(); }, 500);
  }

  // ---- parallax
  frameEl.addEventListener('pointermove', (e) => {
    const r = frameEl.getBoundingClientRect();
    cam.setPointer(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2)), Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2)));
  });
  frameEl.addEventListener('pointerleave', () => { cam.setPointer(0, 0); tipEl.hidden = true; });

  // ---- hover tips on the stage (src/content/hotspots.ts): look only, never a click
  const hot = createHotspots({
    art, pieces: popup.pieces, floor: book.group.getObjectByName('floor') as Mesh,
    puppets: { harry: stage.puppets.harry.mesh, kim: stage.puppets.kim.mesh },
    table: { dice: dice.meshes, morale: hearts.meshes, leads: () => lead.filed },
    cues: cues.parts,
    blockers: [{ mesh: book.leftPage, piece: art['page-left'] }, { mesh: book.rightPage, piece: art['page-right'] }],
  });
  scene.add(hot.group);
  let hotKey: string | null = null, hotShown: string | null = null, hotTimer = 0;
  let hotAt = { clientX: 0, clientY: 0 };
  const hotState = () => STILL
    ? { flags: new Set(['clock_tampered']), morale: 3, sheet: study.sheet }
    : { flags: runner.state.flags, morale: runner.state.morale, sheet: study.sheet };
  const renderHot = () => {
    if (!hotShown) { hotEl.hidden = true; return; }
    const spot = HOTSPOTS[hotShown];
    const state = hotState();
    const tip = spot.variants?.find((v) => holds(v.when, state, study))?.tip ?? spot.tip;
    // the morale and the leads name their count; the leads list what was found
    const count = hotShown === 'morale' ? ` ${state.morale} / ${study.morale.max}` : hotShown === 'leads' ? ` ${leads.count} / ${leads.total}` : '';
    const found = hotShown === 'leads' ? study.evidence.filter((f) => state.flags.has(f)).map((f) => EVIDENCE_LABELS[f][lang]) : [];
    hotEl.querySelector('.name')!.textContent = spot.name[lang] + count;
    hotEl.querySelector('.line')!.textContent = found.length ? found.join(lang === 'zh' ? '；' : '; ') + (lang === 'zh' ? '。' : '.') : tip[lang];
    hotEl.hidden = false;
    // near the pointer, inside the frame, and never over the log's column
    const r = frameEl.getBoundingClientRect(), s = r.width / FRAME.w;
    const w = hotEl.offsetWidth, h = hotEl.offsetHeight;
    const px = hotAt.clientX - r.left, py = hotAt.clientY - r.top;
    let x = Math.min(Math.max(8, px + 16), r.width - w - 8), y = py + 20;
    const col = { x0: column.x * s, y0: column.y * s, x1: (column.x + column.w) * s };
    const overCol = (yy: number) => x < col.x1 && x + w > col.x0 && yy + h > col.y0 - 6;
    if (y + h > r.height - 8 || overCol(y)) y = py - h - 14;
    if (overCol(y)) y = col.y0 - h - 10;
    y = Math.max(8, y);
    hotEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };
  const setHot = (key: string | null) => {
    if (key === hotKey) { if (hotShown) renderHot(); return; }
    hotKey = key;
    clearTimeout(hotTimer);
    hot.highlight(null);
    hotShown = null;
    hotEl.hidden = true;
    if (key) hotTimer = window.setTimeout(() => { hotShown = key; hot.highlight(key); renderHot(); invalidate(); }, 120);
    invalidate();
  };
  const ndc = new Vector2();
  canvas.addEventListener('pointermove', (e) => {
    hotAt = { clientX: e.clientX, clientY: e.clientY };
    // the options keep their own tooltip
    if (!tipEl.hidden || hit.pick(e) !== null) { setHot(null); return; }
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const key = hot.pick(ndc, cam.camera);
    setHot(key && HOTSPOTS[key] ? key : null);
  });
  canvas.addEventListener('pointerleave', () => setHot(null));
  refreshHot = () => { if (hotShown) renderHot(); };

  // ---- size
  function resize() {
    const { w, h } = frameSize();
    const pr = Math.min(devicePixelRatio, 2);
    frameEl.style.width = `${w}px`;
    frameEl.style.height = `${h}px`;
    frameEl.style.setProperty('--s', String(w / FRAME.w));
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    post.setSize(w, h, pr);
    snow.setScale((w * pr) / FRAME.w);
    leftInk.setScale(inkScale(w, pr));
    rightInk.setScale(labelScale(w, pr));
    invalidate();
  }
  resize();
  let resizeTimer = 0;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(resize, 120); });

  window.__shot = {
    page: pageRect, column,
    renderer: rendererName(renderer),
    webgl2: renderer.capabilities.isWebGL2,
    anisotropy,
    ink: { w: leftInk.size.w, h: leftInk.size.h },
    metrics: { ...(STILL ? composition(cam.camera, art, log.layout, leftInk) : {}), buildMs: Math.round(buildMs) },
    points: { gutter: onFrame(cam.camera, 670, PAGE.h), corner: onFrame(cam.camera, 2 * 670, PAGE.h) },
    puppets: frameRect(cam.camera, ['harry', 'kim'].map((n) => new Box3().setFromObject(scene.getObjectByName(n)!))),
  };
  let t = 0;
  window.__bench = (n: number) => {
    const gl = renderer.getContext(), px = new Uint8Array(4);
    const tb = performance.now();
    for (let i = 0; i < n; i++) { post.render(t); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    return (performance.now() - tb) / n;
  };
  if (params.has('debug')) Object.assign(window, { __debug: { leftInk, rightInk, scene, renderer, cam, post, lights, clock, cues, book, lead, hot, layout: () => log.layout } });

  let frames = 0;
  if (director) {
    const d = director;
    window.__play = {
      options: () => {
        const node = study.nodes[runner.state.node];
        return runner.options().map((o) => ({ number: o.number, id: optionId(node, o.index), state: o.state }));
      },
      get idle() { return d.idle; },
      get ended() { return d.ended && !clock.busy; },
      get node() { return runner.state.node; },
      get morale() { return runner.state.morale; },
      get flags() { return [...runner.state.flags]; },
      log: () => [...a11y.children].map((li) => li.textContent ?? ''),
      pauseAfter: (key) => d.pauseAfter(key),
      get paused() { return d.paused; },
      get stop() { return d.stop; },
      hotspot: (key) => {
        const w = hot.center(key);
        if (!w) return null;
        const v = w.project(cam.camera);
        const r = canvas.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
      get hover() { return hotShown; },
      snapCamera: () => { cam.snap(); invalidate(); },
      resume: () => d.continue(),
      hold: (name, at) => clock.hold(name, at),
      get held() { return clock.held; },
      release: () => clock.release(),
      get frames() { return frames; },
    };
  }

  // ---- loop
  if (director) cues.flatten(); // the first frame shows the book with its pop-up folded flat
  renderer.shadowMap.needsUpdate = true;
  let last = performance.now();
  let shadowFrames = 0, changes = clock.changes;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    clock.tick();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (cam.update(dt)) {
      needsRender = true;
      hit.refresh();
    }
    const ct = clock.now() / 1000;
    // the speaking puppet bobs about 2 px while its line types
    let bobbing = false;
    for (const name of ['harry', 'kim'] as const) {
      const target = speaker === name ? 1 : 0;
      bob[name] += (target - bob[name]) * Math.min(1, dt * 12);
      if (bob[name] < 0.002 && target === 0) bob[name] = 0;
      const p = stage.puppets[name];
      p.mesh.position.y = p.y + bob[name] * 0.02 * Math.abs(Math.sin(ct * Math.PI * 2.4 + (name === 'kim' ? 1 : 0)));
      bobbing ||= bob[name] > 0;
    }
    cues.update(ct);
    if (!FROZEN) {
      t = now / 1000;
      snow.update(t);
      lights.update(t);
      needsRender = true;
    }
    // shadows follow what moves, and a few frames more: a tween's last step, and what its
    // continuation changes (a card hidden once it has folded), land after it stops
    if (clock.moving || bobbing || clock.changes !== changes) shadowFrames = 3;
    changes = clock.changes;
    if (shadowFrames > 0) { renderer.shadowMap.needsUpdate = true; shadowFrames--; needsRender = true; }
    // while playing, every frame: the log, the stage and the hearts change on their own
    if (director || clock.busy || bobbing || cues.animating) needsRender = true;
    if (!needsRender) return;
    needsRender = false;
    post.render(t);
    frames++;
    if (!window.__ready) requestAnimationFrame(() => { window.__ready = true; });
  };
  requestAnimationFrame(frame);

  if (director) {
    // wait for the first frame, so the book is on screen before the pop-up rises
    await new Promise<void>((r) => { const check = () => (frames > 0 ? r() : setTimeout(check, 30)); check(); });
    void director.start();
  }
}

/**
 * Frame rows of the composition's landmarks (px), and how the text lies on the left page:
 * glyph height/width at mid-window and the glyph height on the bottom line over the top
 * fully visible line.
 */
function composition(camera: PerspectiveCamera, art: Awaited<ReturnType<typeof loadArt>>, log: PageLayout, ink: PagePainter) {
  const P = (bx: number, by: number, up = 0, lean = 0, h = sheetY(bx, by)) => {
    const r = lean * DEG;
    const v = new Vector3(wx(bx), h + (up / 100) * Math.cos(r), wz(by) - (up / 100) * Math.sin(r)).project(camera);
    return { x: ((v.x + 1) / 2) * FRAME.w, y: ((1 - v.y) / 2) * FRAME.h };
  };
  const Y = (bx: number, by: number, up = 0, lean = 0, h = sheetY(bx, by)) => Math.round(P(bx, by, up, lean, h).y);
  const L = layers(art.floor.meta), tl = art['page-left'].meta, tr = art['page-right'].meta;
  // the pop-up measured where its cards stand on the flat part of the left page
  const rest = (k: string) => BASE_Y + 0.003 + envelope(335, L[k].hinge);
  const base = (k: string) => Y(335, L[k].hinge, 0, 0, rest(k));
  /** Frame px per page px at page row by: along the page (v) and across it (h). */
  const scale = (by: number) => {
    const a = P(300, by), b = P(301, by), c = P(300, by + 1);
    return { v: c.y - a.y, h: b.x - a.x };
  };
  const w = log.window!;
  // narration and voice text (the serif body), fully visible below the fade: baselines and em
  // size in layout px; the painter draws them INK_STRETCH times taller on the page
  const body = log.items.filter((i): i is Extract<typeof i, { t: 'text' }> => i.t === 'text' && /px "(Elysium Serif SC|EB Garamond)"/.test(i.font) && i.box.y >= w.y0 + FADE);
  const em = Math.max(...body.map((i) => Number(/(\d+(?:\.\d+)?)px/.exec(i.font)![1])));
  const baselines = [...new Set(body.map((i) => Math.round(i.y)))].sort((a, b) => a - b);
  const top = ink.toPage(baselines[0] - em * 0.4), bottom = ink.toPage(baselines[baselines.length - 1] - em * 0.4);
  const mid = scale((top + bottom) / 2), k = INK_STRETCH;
  const glyph = 0.9 * em; // CJK glyphs carry about 0.9 em of ink
  const pitch = baselines.length > 1 ? Math.min(...baselines.slice(1).map((b, i) => b - baselines[i])) : 0;
  return {
    backdropTop: Y(335, L.wall.hinge, 418, L.wall.lean, rest('wall')), backdropBase: base('wall'),
    rowFurniture: base('furniture'), rowDesk: base('desk'), rowFront: base('front-chair'),
    leftTearTop: Y(335, tl.tearMin), leftTearBottom: Y(335, tl.tearMax), rightTear: Y(1090, tr.tearMax), nearEdge: Y(335, PAGE.h),
    glyphHW: +((k * mid.v) / mid.h).toFixed(3), glyphBottomOverTop: +(scale(bottom).v / scale(top).v).toFixed(3),
    glyphPxTop: +(glyph * k * scale(top).v).toFixed(1), glyphPxBottom: +(glyph * k * scale(bottom).v).toFixed(1),
    glyphWidthPx: +(glyph * mid.h).toFixed(1), pitchPxTop: +(pitch * k * scale(top).v).toFixed(1), bodyEm: em,
    lines: baselines.length,
  };
}

function rendererName(r: WebGLRenderer): string {
  const gl = r.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
}

main().catch((err) => {
  console.error(err);
  document.getElementById('nogl')!.hidden = false;
});
