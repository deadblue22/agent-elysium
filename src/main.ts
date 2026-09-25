// 雪落之前 · the study.clock moment rendered with Three.js.
// URL flags: ?still freezes time (snow, grain, flicker, cursor) for screenshots; ?lang=en;
// ?debug exposes the painters, scene and renderer on window.__debug.
import { NoToneMapping, PCFShadowMap, PMREMGenerator, SRGBColorSpace, Scene, Vector3, WebGLRenderer, type PerspectiveCamera } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadArt, loadFonts } from './assets';
import type { Lang } from './content/schema';
import { chrome, clockMoment } from './content/study-clock';
import { PageHit } from './page/hit';
import { FADE, Measurer, PAGE, layoutLog, layoutRightPage, textColumn, type PageLayout, type Rect } from './page/layout';
import { PagePainter } from './page/painter';
import { createBook } from './scene/book';
import { FRAME, createCameraRig } from './scene/camera';
import { createLights } from './scene/lights';
import { createPopup, layers, roomLights } from './scene/popup';
import { createPost } from './scene/post';
import { createStage, heartsTop } from './scene/puppets';
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
    };
    /** Renders n frames synchronously and returns the mean ms per frame (for tools/shot.mjs). */
    __bench?: (n: number) => number;
  }
}

const params = new URLSearchParams(location.search);
const STILL = params.has('still') || matchMedia('(prefers-reduced-motion: reduce)').matches;
let lang: Lang = params.get('lang') === 'en' ? 'en' : 'zh';

const frameEl = document.getElementById('frame') as HTMLDivElement;
const canvas = document.getElementById('gl') as HTMLCanvasElement;

function frameSize() {
  const w = Math.max(320, Math.floor(Math.min(innerWidth, (innerHeight * 16) / 9)));
  return { w, h: Math.round((w * 9) / 16) };
}

/**
 * Canvas px per page px for the log: the page is about 1:1 with the 1600 frame across and
 * foreshortened to 0.55-0.77 along; 3x keeps the foreshortened glyphs crisp at 1:1.
 * The right page only carries two small labels.
 */
const inkScale = (w: number, pr: number) => Math.min(4, Math.max(3, (3 * w * pr) / FRAME.w));
const labelScale = (w: number, pr: number) => Math.min(3, Math.max(1.5, (1.5 * w * pr) / FRAME.w));

/** Frame position of a point on the top sheets (or at height h). */
function onFrame(camera: PerspectiveCamera, bx: number, by: number, h = sheetY(bx, by)) {
  const v = new Vector3(wx(bx), h, wz(by)).project(camera);
  return { x: ((v.x + 1) / 2) * FRAME.w, y: ((1 - v.y) / 2) * FRAME.h };
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
  renderer.shadowMap.autoUpdate = false; // nothing that casts moves; render the maps once
  renderer.setClearColor('#0b0806');
  const anisotropy = renderer.capabilities.getMaxAnisotropy();

  const [art] = await Promise.all([loadArt(anisotropy), loadFonts()]);

  const { w: w0 } = frameSize();
  const pr0 = Math.min(devicePixelRatio, 2);
  const leftInk = new PagePainter(anisotropy, inkScale(w0, pr0));
  const rightInk = new PagePainter(anisotropy, labelScale(w0, pr0));

  const scene = new Scene();
  const t0 = performance.now();
  const book = createBook(art, leftInk.texture, rightInk.texture);
  const popup = createPopup(art), stage = createStage(art, book.rightSheet);
  const buildMs = performance.now() - t0; // geometry, procedural textures and the baked occlusion
  const lights = createLights(roomLights(art.floor.meta));
  const cam = createCameraRig();
  scene.add(createTable(art), book.group, popup.group, stage.group, lights.group, cam.rig);
  // a soft, low environment light, so curved paper, page edges and board edges read through
  // gentle shading gradients and not only through the direct lights
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.16;
  pmrem.dispose();

  // the log starts under the left sheet's tear (its extent comes from the SVG, via the manifest)
  const tear = art['page-left'].meta;
  const col = textColumn(tear.columnY0);
  const column = projectRect(cam.camera, col.x0, col.y0, col.x1, col.y1);
  const pageRect = projectRect(cam.camera, 0, tear.tearMin - 14, PAGE.w, PAGE.h);
  const snow = createSnow(cam.camera, cam.lens, column);
  scene.add(snow.points);
  const post = createPost(renderer, scene, cam.camera);
  post.uniforms.uExposure.value = 1.08;
  post.uniforms.uQuiet.value.set(column.x / FRAME.w, 1 - (column.y + column.h) / FRAME.h, (column.x + column.w) / FRAME.w, 1 - column.y / FRAME.h);

  // ---- the pages
  const measurer = new Measurer();
  let layout: PageLayout = layoutLog(clockMoment, lang, measurer, col);
  let needsRender = true;
  const invalidate = () => { needsRender = true; };

  const a11y = document.getElementById('log') as HTMLOListElement;
  const choose = (index: number) => {
    const e = clockMoment.find((x) => x.kind === 'option' && x.index === index);
    console.info(`[study.clock] option ${index}`, e?.kind === 'option' ? e.option.text[lang] : '');
  };
  function applyLang() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    layout = layoutLog(clockMoment, lang, measurer, col);
    leftInk.setLayout(layout);
    rightInk.setLayout(layoutRightPage(lang, measurer, chrome.morale[lang], heartsTop(art)));
    document.getElementById('title')!.textContent = chrome.title[lang];
    document.getElementById('chapter')!.textContent = chrome.chapter[lang];
    document.getElementById('log-heading')!.textContent = chrome.logHeading[lang];
    for (const s of document.querySelectorAll<HTMLElement>('#lang [data-lang]')) s.classList.toggle('on', s.dataset.lang === lang);
    a11y.replaceChildren(...clockMoment.map((e, i) => {
      const li = document.createElement('li');
      if (e.kind === 'option') {
        const b = document.createElement('button');
        b.textContent = layout.plain[i];
        b.addEventListener('click', () => choose(e.index));
        li.append(b);
      } else li.textContent = layout.plain[i];
      return li;
    }));
    invalidate();
  }
  applyLang();
  document.getElementById('lang')!.addEventListener('click', () => { lang = lang === 'zh' ? 'en' : 'zh'; applyLang(); });

  const hit = new PageHit(canvas, cam.camera, book.leftPage, () => leftInk.optionRects(), {
    hover: (i) => { leftInk.setHover(i); invalidate(); },
    click: choose,
  });
  // the wheel over the left page scrolls the log's history (older lines come down out of the tear)
  canvas.addEventListener('wheel', (e) => {
    if (!hit.pagePoint(e)) return;
    e.preventDefault();
    const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    if (leftInk.scrollBy(-px * 0.6)) { invalidate(); hit.refresh(); }
  }, { passive: false });
  if (!STILL) {
    let on = true;
    setInterval(() => { on = !on; leftInk.setCursor(on); invalidate(); }, 500);
  }

  // ---- parallax
  frameEl.addEventListener('pointermove', (e) => {
    const r = frameEl.getBoundingClientRect();
    cam.setPointer(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2)), Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2)));
  });
  frameEl.addEventListener('pointerleave', () => cam.setPointer(0, 0));

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
    metrics: { ...composition(cam.camera, art, layout), buildMs: Math.round(buildMs) },
    points: { gutter: onFrame(cam.camera, 670, PAGE.h), corner: onFrame(cam.camera, 2 * 670, PAGE.h) },
  };
  window.__bench = (n: number) => {
    const gl = renderer.getContext(), px = new Uint8Array(4);
    const tb = performance.now();
    for (let i = 0; i < n; i++) { post.render(t); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    return (performance.now() - tb) / n;
  };
  if (params.has('debug')) Object.assign(window, { __debug: { leftInk, rightInk, scene, renderer, cam, post, lights, layout: () => layout } });

  // ---- loop
  renderer.shadowMap.needsUpdate = true;
  let last = performance.now();
  let t = 0;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (cam.update(dt)) {
      needsRender = true;
      hit.refresh();
    }
    if (!STILL) {
      t = now / 1000;
      snow.update(t);
      lights.update(t);
      needsRender = true;
    }
    if (!needsRender) return;
    needsRender = false;
    post.render(t);
    if (!window.__ready) requestAnimationFrame(() => { window.__ready = true; });
  };
  requestAnimationFrame(frame);
}

/**
 * Frame rows of the composition's landmarks (px), and how the text lies on the left page:
 * glyph height/width at mid-window and the glyph height on the bottom line over the top
 * fully visible line.
 */
function composition(camera: PerspectiveCamera, art: Awaited<ReturnType<typeof loadArt>>, log: PageLayout) {
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
  const scale = (by: number) => {
    const a = P(300, by), b = P(301, by), c = P(300, by + 1);
    return { v: c.y - a.y, h: b.x - a.x };
  };
  const w = log.window!;
  // narration and voice text (the serif body), fully visible below the fade: baselines and em size
  const body = log.items.filter((i): i is Extract<typeof i, { t: 'text' }> => i.t === 'text' && /Serif|Garamond/.test(i.font) && i.box.y >= w.y0 + FADE);
  const em = Math.max(...body.map((i) => Number(/(\d+(?:\.\d+)?)px/.exec(i.font)![1])));
  const baselines = [...new Set(body.map((i) => Math.round(i.y)))].sort((a, b) => a - b);
  const top = baselines[0] - em * 0.4, bottom = baselines[baselines.length - 1] - em * 0.4, mid = scale((top + bottom) / 2);
  const ink = 0.9 * em; // CJK glyphs carry about 0.9 em of ink
  const pitch = baselines.length > 1 ? Math.min(...baselines.slice(1).map((b, i) => b - baselines[i])) : 0;
  return {
    backdropTop: Y(335, L.wall.hinge, 418, L.wall.lean, rest('wall')), backdropBase: base('wall'),
    rowFurniture: base('furniture'), rowDesk: base('desk'), rowFront: base('front-chair'),
    leftTearTop: Y(335, tl.tearMin), leftTearBottom: Y(335, tl.tearMax), tongue: Y(1090, tr.tearMax), nearEdge: Y(335, PAGE.h),
    glyphHW: +(mid.v / mid.h).toFixed(3), glyphBottomOverTop: +(scale(bottom).v / scale(top).v).toFixed(3),
    glyphPxTop: +(ink * scale(top).v).toFixed(1), glyphPxBottom: +(ink * scale(bottom).v).toFixed(1),
    pitchPxTop: +(pitch * scale(top).v).toFixed(1), bodyEm: em,
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
