// 雪落之前 · the study.clock moment rendered with Three.js.
// URL flags: ?still freezes time (snow, grain, flicker, cursor) for screenshots; ?lang=en;
// ?debug exposes the painters, scene and renderer on window.__debug.
import { NoToneMapping, PCFShadowMap, SRGBColorSpace, Scene, Vector3, WebGLRenderer, type PerspectiveCamera } from 'three';
import { loadArt, loadFonts } from './assets';
import type { Lang } from './content/schema';
import { chrome, clockMoment } from './content/study-clock';
import { PageHit } from './page/hit';
import { COLUMN, Measurer, PAGE, layoutLog, layoutRightPage, type PageLayout, type Rect } from './page/layout';
import { PagePainter } from './page/painter';
import { createBook } from './scene/book';
import { FRAME, createCameraRig } from './scene/camera';
import { createLights } from './scene/lights';
import { candleFlamePosition, candleLightPosition, createPopup, windowGlowPosition } from './scene/popup';
import { createPost } from './scene/post';
import { createStage } from './scene/puppets';
import { createSnow } from './scene/snow';
import { surfaceY, wx, wz } from './scene/space';
import { createTable } from './scene/table';

declare global {
  interface Window {
    __ready?: boolean;
    /** For tools/shot.mjs: frame-space rects and renderer facts. */
    __shot?: { page: Rect; column: Rect; renderer: string; webgl2: boolean; anisotropy: number; ink: { w: number; h: number } };
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

/** Canvas px per page px: twice the page's on-screen size (the page is ~1:1 with the 1600 frame). */
const inkScale = (w: number, pr: number) => Math.min(3.5, Math.max(2, (2 * w * pr) / FRAME.w));

/** Frame-space bounding box of a rect on the pages. */
function projectRect(camera: PerspectiveCamera, bx0: number, by0: number, bx1: number, by1: number): Rect {
  const xs: number[] = [], ys: number[] = [];
  for (const bx of [bx0, bx1]) for (const by of [by0, by1]) {
    const v = new Vector3(wx(bx), surfaceY(bx), wz(by)).project(camera);
    xs.push(((v.x + 1) / 2) * FRAME.w);
    ys.push(((1 - v.y) / 2) * FRAME.h);
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
  const rightInk = new PagePainter(anisotropy, inkScale(w0, pr0));

  const scene = new Scene();
  const book = createBook(art, leftInk.texture, rightInk.texture);
  const lights = createLights({ candleLight: candleLightPosition(), candleFlame: candleFlamePosition(), windowGlow: windowGlowPosition() });
  const cam = createCameraRig();
  scene.add(createTable(art), book.group, createPopup(art).group, createStage(art).group, lights.group, cam.rig);

  const column = projectRect(cam.camera, COLUMN.x0, COLUMN.y0, COLUMN.x1, COLUMN.y1);
  const pageRect = projectRect(cam.camera, 0, 112, PAGE.w, PAGE.h);
  const snow = createSnow(cam.camera, column);
  scene.add(snow.points);
  const post = createPost(renderer, scene, cam.camera);
  post.uniforms.uExposure.value = 1.08;
  post.uniforms.uQuiet.value.set(column.x / FRAME.w, 1 - (column.y + column.h) / FRAME.h, (column.x + column.w) / FRAME.w, 1 - column.y / FRAME.h);

  // ---- the pages
  const measurer = new Measurer();
  let layout: PageLayout = layoutLog(clockMoment, lang, measurer);
  let needsRender = true;
  const invalidate = () => { needsRender = true; };

  const a11y = document.getElementById('log') as HTMLOListElement;
  const choose = (index: number) => {
    const e = clockMoment.find((x) => x.kind === 'option' && x.index === index);
    console.info(`[study.clock] option ${index}`, e?.kind === 'option' ? e.option.text[lang] : '');
  };
  function applyLang() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    layout = layoutLog(clockMoment, lang, measurer);
    leftInk.setLayout(layout);
    rightInk.setLayout(layoutRightPage(lang, measurer, chrome.morale[lang]));
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

  const hit = new PageHit(canvas, cam.camera, book.leftPage, () => layout, {
    hover: (i) => { leftInk.setHover(i); invalidate(); },
    click: choose,
  });
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
    rightInk.setScale(inkScale(w, pr));
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

function rendererName(r: WebGLRenderer): string {
  const gl = r.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
}

main().catch((err) => {
  console.error(err);
  document.getElementById('nogl')!.hidden = false;
});
