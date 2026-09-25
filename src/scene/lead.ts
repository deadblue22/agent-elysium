// A new lead (§6.5 新线索): when a piece of evidence turns up, an index card held by a strip of
// tape drops onto the right page, in front of the puppets: 「新线索」, the lead in large type and
// how many of the chapter's leads are found. It stays until the player clicks on (the
// director waits on it like on a paragraph), then slides away. The card is the baked paper
// (lead-card.svg) with the words painted over it in a canvas, so a language switch can repaint.
import { CanvasTexture, Mesh, MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace } from 'three';
import type { Art } from '../assets';
import type { Lang } from '../content/schema';
import { ease, lerp, type Clock } from '../play/clock';
import { decal } from './paper';
import { rectUV, surfaceGrid, wx, wz, xSamples, ySamples } from './space';

/** Where the card lies (book px, card px 1:1): its left edge and its body's top edge. */
const X0 = 706, TOP = 398;
/** Canvas px per card px. */
const RES = 3;
/** The card body inside the SVG (the tape overhangs its top edge). */
const BODY = { x: 0, y: 0, w: 460, h: 190 };

const SERIF: Record<Lang, string> = { zh: '"Elysium Serif SC", "EB Garamond", serif', en: '"EB Garamond", "Elysium Serif SC", serif' };
const SANS: Record<Lang, string> = { zh: '"Elysium Sans SC", "Inter", "Elysium Serif SC", sans-serif', en: '"Inter", "Elysium Sans SC", "Elysium Serif SC", sans-serif' };
const GOLD = '#8F6A1C', INK = '#1E1A16', MUTED = '#6E655C';

export interface LeadText { heading: string; lead: string; count: number; total: number }

export function createLeadCard(art: Art, sheet: (bx: number, by: number) => number, clock: Clock) {
  const piece = art['lead-card'];
  const [vx, vy, vw, vh] = piece.viewBox;
  const canvas = document.createElement('canvas');
  canvas.width = vw * RES;
  canvas.height = vh * RES;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = piece.texture.anisotropy;

  // the card at rest follows the page under it, centred on its own origin so it can turn
  const bx0 = X0 + vx, bx1 = bx0 + vw, by0 = TOP + vy, by1 = by0 + vh;
  const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
  const lift = 0.012;
  const geometry = surfaceGrid(xSamples(bx0, bx1), ySamples(by0, by1, 10), (bx, by) => sheet(bx, by) + lift, rectUV(bx0, bx1, by0, by1));
  const y0 = sheet(cx, cy);
  geometry.translate(-wx(cx), -y0, -wz(cy));
  const material = new MeshStandardMaterial({ map: texture, roughness: 0.9, alphaToCoverage: true });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'lead-card';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.visible = false;
  const rest = { x: wx(cx), y: y0, z: wz(cy) };

  // its soft drop shadow on the page: the body's shape moved down and to the right, blurred
  const OFF = 20, BLUR = 16;
  const sx0 = X0 + BODY.x + OFF - BLUR, sx1 = X0 + BODY.w + OFF + BLUR, sy0 = TOP + OFF - BLUR, sy1 = TOP + BODY.h + OFF + BLUR;
  const shadow = decal(surfaceGrid(xSamples(sx0, sx1), ySamples(sy0, sy1, 12), (bx, by) => sheet(bx, by) + 0.004, rectUV(sx0, sx1, sy0, sy1)), softRect(sx1 - sx0, sy1 - sy0, BLUR), 0.72);
  shadow.name = 'lead-card-shadow';
  shadow.visible = false;
  const shadowMat = shadow.material as MeshBasicMaterial;

  let current: ((lang: Lang) => LeadText) | null = null;
  let lang: Lang = 'zh';
  const paint = () => {
    const x = canvas.getContext('2d')!;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, canvas.width, canvas.height);
    x.drawImage(piece.texture.image as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    if (!current) return;
    const t = current(lang);
    x.setTransform(RES, 0, 0, RES, -vx * RES, -vy * RES); // card px
    x.textBaseline = 'alphabetic';
    const left = 22, right = BODY.w - 22, width = right - left;
    // the heading, over the card's red rule
    x.fillStyle = GOLD;
    const hs = lang === 'zh' ? 28 : 21;
    x.font = `600 ${hs}px ${SANS[lang]}`;
    let hx = left;
    for (const ch of t.heading) { x.fillText(ch, hx, 31); hx += x.measureText(ch).width + hs * (lang === 'zh' ? 0.22 : 0.16); }
    // the count, right-aligned on the heading's line
    x.fillStyle = MUTED;
    x.font = `600 ${lang === 'zh' ? 22 : 19}px ${SANS[lang]}`;
    const count = `${t.count} / ${t.total}`;
    x.fillText(count, right - x.measureText(count).width, 31);
    // the lead: one line if it fits, else two, never smaller than 32 px
    x.fillStyle = INK;
    let size = lang === 'zh' ? 44 : 40;
    const fontAt = (s: number) => `400 ${s}px ${SERIF[lang]}`;
    x.font = fontAt(size);
    if (x.measureText(t.lead).width <= width) {
      x.fillText(t.lead, left, 112);
    } else {
      const words = lang === 'zh' ? [...t.lead] : t.lead.split(' ');
      const sp = lang === 'zh' ? '' : ' ';
      const fits = (s: number) => {
        x.font = fontAt(s);
        let best: [string, string] | null = null;
        for (let k = 1; k < words.length; k++) {
          const a = words.slice(0, k).join(sp), b = words.slice(k).join(sp);
          if (x.measureText(a).width <= width && x.measureText(b).width <= width) {
            if (!best || Math.abs(x.measureText(a).width - x.measureText(b).width) < Math.abs(x.measureText(best[0]).width - x.measureText(best[1]).width)) best = [a, b];
          }
        }
        return best;
      };
      let lines = fits(size);
      while (!lines && size > 32) lines = fits(--size);
      x.font = fontAt(size);
      const [a, b] = lines ?? [t.lead, ''];
      x.fillText(a, left, 90);
      x.fillText(b, left, 90 + size * 1.22);
    }
    texture.needsUpdate = true;
  };

  const place = (p: number, tilt: number) => {
    // p: 1 at rest; below 1 the card is in the air (above and a little behind its spot)
    const h = 1 - p;
    mesh.position.set(rest.x - 0.25 * h, rest.y + 1.6 * h, rest.z - 0.3 * h);
    mesh.rotation.set(0.18 * h, 0, (-0.09 + tilt) * h);
    shadowMat.opacity = 0.72 * Math.max(0, 1 - h * 3);
  };
  return {
    mesh, shadow,
    /** Drops the card onto the page (resolves once it has landed). */
    async show(text: (lang: Lang) => LeadText) {
      current = text;
      paint();
      mesh.visible = shadow.visible = true;
      material.opacity = 1;
      await clock.tween(460, (p) => place(p, 0.05), ease.in, 'lead');
      // a small bounce as it lands
      await clock.tween(170, (q) => { place(1, 0); mesh.position.y = rest.y + 0.035 * Math.sin(Math.PI * q); }, ease.out, 'lead');
      place(1, 0);
    },
    /** Slides the card away off the page's fore-edge. */
    async dismiss() {
      if (!mesh.visible) return;
      await clock.tween(420, (p) => {
        mesh.position.set(rest.x + lerp(0, 2.6, p), rest.y + 0.05 * Math.sin(Math.PI * p), rest.z + lerp(0, 0.35, p));
        mesh.rotation.set(0, 0, lerp(0, -0.12, p));
        material.opacity = 1 - Math.max(0, (p - 0.55) / 0.45);
        shadowMat.opacity = 0.72 * (1 - Math.min(1, p * 2.5));
      }, ease.in, 'lead');
      mesh.visible = shadow.visible = false;
      current = null;
    },
    setLang(l: Lang) { lang = l; if (current) paint(); },
  };
}

/** A soft-edged rectangle filling a w x h rect but for a `blur`-wide falloff (an alpha map, white inside). */
function softRect(w: number, h: number, blur: number): CanvasTexture {
  const k = 2, c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const x = c.getContext('2d')!;
  x.fillStyle = '#000';
  x.fillRect(0, 0, c.width, c.height);
  x.filter = `blur(${blur * k * 0.5}px)`;
  x.fillStyle = '#fff';
  x.fillRect(blur * k, blur * k, c.width - 2 * blur * k, c.height - 2 * blur * k);
  return new CanvasTexture(c);
}
