// A new lead (§6.5): when an evidence flag is set, a torn paper slip reading
// 「新线索：指针被拨过」 slides onto the right page below the morale hearts, stays a moment and
// slides back out. The slip is the baked paper (slip.svg) with the words painted over it in
// a canvas, so a language switch can repaint them.
import { CanvasTexture, Mesh, MeshStandardMaterial, SRGBColorSpace } from 'three';
import type { Art } from '../assets';
import type { Lang } from '../content/schema';
import { ease, type Clock } from '../play/clock';
import { rectUV, surfaceGrid, wx, wz, xSamples, ySamples } from './space';

/** The slip's size on the page (book px per slip px) and where it rests, right-aligned below the hearts. */
const S = 1.25, RIGHT = 1328;
/** Canvas px per slip px. */
const RES = 3;
/** Slide distance (book px) and timings (ms). */
const TRAVEL = 70, IN = 520, STAY = 2600, OUT = 480;

const SERIF: Record<Lang, string> = { zh: '"Elysium Serif SC", "EB Garamond", serif', en: '"EB Garamond", "Elysium Serif SC", serif' };
const SANS: Record<Lang, string> = { zh: '"Elysium Sans SC", "Inter", "Elysium Serif SC", sans-serif', en: '"Inter", "Elysium Sans SC", sans-serif' };

export function createSlip(art: Art, top: number, sheet: (bx: number, by: number) => number, clock: Clock) {
  const piece = art.slip;
  const [vx, vy, vw, vh] = piece.viewBox;
  const canvas = document.createElement('canvas');
  canvas.width = vw * RES;
  canvas.height = vh * RES;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = piece.texture.anisotropy;

  // the slip at rest, on the sheet: a grid that follows the page, centred on its own origin
  const bx1 = RIGHT, bx0 = RIGHT - vw * S, by0 = top, by1 = top + vh * S;
  const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
  const geometry = surfaceGrid(xSamples(bx0, bx1), ySamples(by0, by1, 8), (bx, by) => sheet(bx, by) + 0.006, rectUV(bx0, bx1, by0, by1));
  const y0 = sheet(cx, cy);
  geometry.translate(-wx(cx), -y0, -wz(cy));
  const material = new MeshStandardMaterial({ map: texture, roughness: 0.9, alphaToCoverage: true, transparent: false });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'slip';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.visible = false;
  const rest = { x: wx(cx), y: y0, z: wz(cy) };

  let current: ((lang: Lang) => [string, string]) | null = null;
  let lang: Lang = 'zh';
  const paint = () => {
    const x = canvas.getContext('2d')!;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, canvas.width, canvas.height);
    x.drawImage(piece.texture.image as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    if (!current) return;
    const [label, lead] = current(lang);
    x.setTransform(RES, 0, 0, RES, -vx * RES, -vy * RES); // slip px
    const left = 18, right = 173, width = right - left;
    // one line if it fits ("新线索：指针被拨过"), else the label small above the lead
    let size = lang === 'zh' ? 12.5 : 11.5;
    const fit = (text: string, font: (s: number) => string, s: number, max: number) => {
      x.font = font(s);
      const w = x.measureText(text).width;
      return w > max ? (s * max) / w : s;
    };
    const labelFont = (s: number) => `600 ${s}px ${SANS[lang]}`, leadFont = (s: number) => `400 ${s}px ${SERIF[lang]}`;
    x.font = labelFont(size * 0.86);
    const lw = x.measureText(label).width;
    x.font = leadFont(size);
    const one = lw + x.measureText(lead).width <= width;
    x.textBaseline = 'alphabetic';
    if (one) {
      x.fillStyle = '#A3232B';
      x.font = labelFont(size * 0.86);
      x.fillText(label, left, 20);
      x.fillStyle = '#1E1A16';
      x.font = leadFont(size);
      x.fillText(lead, left + lw, 20);
    } else {
      size = fit(lead, leadFont, size, width);
      x.fillStyle = '#A3232B';
      x.font = labelFont(7);
      x.fillText(label.trim().replace(/[:：]$/, '').toUpperCase(), left, 9.2);
      x.fillStyle = '#1E1A16';
      x.font = leadFont(size);
      x.fillText(lead, left, 24.5);
    }
    texture.needsUpdate = true;
  };

  let queue = Promise.resolve();
  const place = (p: number, o: number) => {
    // p: 0 off to the right, 1 at rest; the slip lifts a little while it moves
    mesh.position.set(rest.x + (TRAVEL / 100) * (1 - p), rest.y + 0.012 * Math.sin(Math.PI * p), rest.z + 0.03 * (1 - p));
    mesh.rotation.y = 0.05 * (1 - p);
    material.opacity = o;
  };
  return {
    mesh,
    /** Slides a slip in and out; slips queue up. text(lang) gives the label and the lead. */
    show(text: (lang: Lang) => [string, string]): Promise<void> {
      queue = queue.then(async () => {
        current = text;
        paint();
        mesh.visible = true;
        await clock.tween(IN, (p) => place(p, Math.min(1, p * 1.6)), ease.out, 'slip');
        await clock.wait(STAY);
        await clock.tween(OUT, (p) => place(1 - p, Math.min(1, (1 - p) * 1.6)), ease.in);
        mesh.visible = false;
        current = null;
      });
      return queue;
    },
    setLang(l: Lang) { lang = l; if (current) paint(); },
  };
}
