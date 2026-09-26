// A new lead (§6.5 新线索): when a piece of evidence turns up, an index card held by a strip of
// tape drops onto the front of the right page, in front of Harry and Kim: 「新线索」, the lead in
// large type and how many of the chapter's leads are found. It stays until the player clicks
// on (the director waits on it like on a paragraph), then it is filed: it flies to the table
// beside the book and lands, smaller, on the stack of leads found so far. The card is the
// baked paper (lead-card.svg) with the words painted over it in a canvas, so a language switch
// can repaint every card.
import { CanvasTexture, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import type { Art } from '../assets';
import type { Lang } from '../content/schema';
import { ease, lerp, type Clock } from '../play/clock';
import { decal } from './paper';
import { DEG, wx, wz } from './space';
import { TABLE } from './tabletop';

/** Where the card lands on the right page (book px, its middle) and its size there. */
const DROP = { bx: 1040, by: 632, scale: 0.72, turn: -3 };
/** Its size on the stack. */
const FILED = 0.4;
/** Canvas px per card px. */
const RES = 3;
/** The card body inside the SVG (the tape overhangs its top edge). */
const BODY = { x: 0, y: 0, w: 460, h: 190 };

const SERIF: Record<Lang, string> = { zh: '"Elysium Serif SC", "EB Garamond", serif', en: '"EB Garamond", "Elysium Serif SC", serif' };
const SANS: Record<Lang, string> = { zh: '"Elysium Sans SC", "Inter", "Elysium Serif SC", sans-serif', en: '"Inter", "Elysium Sans SC", "Elysium Serif SC", sans-serif' };
const GOLD = '#8F6A1C', INK = '#1E1A16', MUTED = '#6E655C';

export interface LeadText { heading: string; lead: string; count: number; total: number }

interface Card { mesh: Mesh; material: MeshStandardMaterial; canvas: HTMLCanvasElement; texture: CanvasTexture; text: (lang: Lang) => LeadText }

/** sheet: world height of the right top sheet (with its curl) at (bx, by). */
export function createLeadCard(art: Art, clock: Clock, sheet: (bx: number, by: number) => number) {
  const piece = art['lead-card'];
  const [vx, vy, vw, vh] = piece.viewBox;
  // the card is stiff: on the page it rests on the highest point under it (the curled tear, or
  // the rise of the pages toward the gutter), a little above the floor behind the tear
  const hw = (vw * DROP.scale) / 2, hh = (vh * DROP.scale) / 2;
  let top = 0;
  for (let bx = DROP.bx - hw; bx <= DROP.bx + hw; bx += 8) for (let by = DROP.by - hh; by <= Math.min(720, DROP.by + hh); by += 4) top = Math.max(top, sheet(bx, by));
  const ON_PAGE = top + 0.012;
  const group = new Group();
  group.name = 'leads';
  // one card's shape, 1 world unit per 100 card px, lying flat, centred on the card body
  const cx = BODY.x + BODY.w / 2, cy = BODY.y + BODY.h / 2;
  const geometry = new PlaneGeometry(vw / 100, vh / 100);
  geometry.translate((vx + vw / 2 - cx) / 100, -(vy + vh / 2 - cy) / 100, 0);
  geometry.rotateX(-Math.PI / 2);

  // the stack's soft contact on the table, shown once the first card is filed
  const under = decal(new PlaneGeometry((BODY.w * FILED) / 100 + 0.3, (BODY.h * FILED) / 100 + 0.3).rotateX(-Math.PI / 2), softRect(BODY.w * FILED + 30, BODY.h * FILED + 30, 15), 0.55);
  under.position.set(TABLE.leads.x + 0.03, 0.002, TABLE.leads.z + 0.04);
  under.rotation.y = TABLE.leads.turns[0] * DEG;
  under.visible = false;
  under.name = 'leads-contact';
  group.add(under);

  const cards: Card[] = [];
  let showing: Card | null = null;
  let lang: Lang = 'zh';

  const paint = (c: Card) => {
    const x = c.canvas.getContext('2d')!;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.canvas.width, c.canvas.height);
    x.drawImage(piece.texture.image as CanvasImageSource, 0, 0, c.canvas.width, c.canvas.height);
    const t = c.text(lang);
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
    c.texture.needsUpdate = true;
  };

  const newCard = (text: (lang: Lang) => LeadText): Card => {
    const canvas = document.createElement('canvas');
    canvas.width = vw * RES;
    canvas.height = vh * RES;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = piece.texture.anisotropy;
    const material = new MeshStandardMaterial({ map: texture, roughness: 0.9, alphaToCoverage: true });
    const mesh = new Mesh(geometry, material);
    mesh.name = 'lead-card';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const c = { mesh, material, canvas, texture, text };
    paint(c);
    return c;
  };

  /** Pose on the page (p = 1) or in the air above it (p < 1). */
  const onPage = (m: Mesh, p: number, tilt: number) => {
    const h = 1 - p;
    m.scale.setScalar(DROP.scale);
    m.position.set(wx(DROP.bx) - 0.3 * h, ON_PAGE + 1.8 * h, wz(DROP.by) - 0.4 * h);
    m.rotation.set(0.2 * h, (DROP.turn + 5 * h) * DEG, (-0.08 + tilt) * h);
  };
  /** Pose of the n-th card on the stack. */
  const stackPose = (n: number) => ({
    x: TABLE.leads.x + 0.03 * n, y: 0.004 + 0.004 * n, z: TABLE.leads.z - 0.05 * n,
    turn: TABLE.leads.turns[n % TABLE.leads.turns.length],
  });

  return {
    group,
    /** The cards on the table, for the hover tip. */
    get filed() { return cards.filter((c) => c !== showing).map((c) => c.mesh); },
    /** Drops a new card onto the page (resolves once it has landed). */
    async show(text: (lang: Lang) => LeadText) {
      const c = newCard(text);
      showing = c;
      await clock.tween(460, (p) => onPage(c.mesh, p, 0.05), ease.in, 'lead');
      // a small bounce as it lands
      await clock.tween(170, (q) => { onPage(c.mesh, 1, 0); c.mesh.position.y = ON_PAGE + 0.035 * Math.sin(Math.PI * q); }, ease.out, 'lead');
      onPage(c.mesh, 1, 0);
    },
    /** Files the card on the page: it flies to the stack on the table and lands on top. */
    async dismiss() {
      const c = showing;
      if (!c) return;
      const n = cards.length;
      const to = stackPose(n);
      const from = c.mesh.position.clone(), turn0 = DROP.turn;
      await clock.tween(620, (p) => {
        const e = ease.inOut(p);
        c.mesh.position.set(lerp(from.x, to.x, e), lerp(from.y, to.y, e) + 0.9 * Math.sin(Math.PI * p), lerp(from.z, to.z, e));
        c.mesh.scale.setScalar(lerp(DROP.scale, FILED, e));
        c.mesh.rotation.set(0, lerp(turn0, to.turn, e) * DEG, 0.12 * Math.sin(Math.PI * p));
      }, ease.linear, 'lead');
      c.mesh.position.set(to.x, to.y, to.z);
      c.mesh.scale.setScalar(FILED);
      c.mesh.rotation.set(0, to.turn * DEG, 0);
      cards.push(c);
      showing = null;
      under.visible = true;
    },
    setLang(l: Lang) { lang = l; for (const c of [...cards, ...(showing ? [showing] : [])]) paint(c); },
    /** The style board: the first lead, already filed. */
    fileAt(text: (lang: Lang) => LeadText) {
      const c = newCard(text);
      const to = stackPose(cards.length);
      c.mesh.position.set(to.x, to.y, to.z);
      c.mesh.scale.setScalar(FILED);
      c.mesh.rotation.set(0, to.turn * DEG, 0);
      cards.push(c);
      under.visible = true;
    },
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
