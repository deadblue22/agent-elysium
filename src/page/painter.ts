// Paints a page layout into a transparent Canvas 2D and exposes it as a CanvasTexture.
// The page mesh composites it over its paper, so the ink takes the page's perspective,
// light, shadows and post-processing like any other surface.
//
// The log is a bottom-anchored window: items are drawn with the current scroll offset,
// clipped to the window under the tear, and faded out as they rise into it. The typewriter
// reveals the newest entry character by character (`setReveal`); an animated offset lets a
// new entry push the older lines up smoothly. Partial repaints (hover, cursor blink) clip to
// a rect and redraw only what is inside.
//
// The ink can be stretched vertically about a line (the bottom of the log's window): the
// camera sees the page at a slant, which squashes the glyphs; drawn a little taller, they
// read with their true proportions. The layout stays unstretched (its own page px); the
// painter maps it, and hands out option boxes in the page's real px.
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import { INK, INK_ORIGINAL, PAGE, type DrawItem, type PageLayout, type Rect } from './layout';

/** When scrolled back, the newest lines leave through the bottom of the window over this many page px. */
const BOTTOM_FADE = 16;

export interface OptionRect { index: number; number: number; greyed: boolean; rect: Rect }

export class PagePainter {
  readonly canvas = document.createElement('canvas');
  readonly texture: CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private layout: PageLayout | null = null;
  private hover: number | null = null;
  private cursorOn = true;
  private scale = 0;
  private scroll = 0;
  /** Extra offset while new lines push the old ones up (page px, decays to 0). */
  private offset = 0;
  /** Entries after `entry` are hidden; entry `entry` shows `chars` body characters. */
  private reveal: { entry: number; chars: number } | null = null;
  /** The continue marker is up (it blinks with the cursor). */
  private marker = false;
  /** Vertical stretch of the ink about the row `anchor` (page px): page y = anchor + (y - anchor) * stretch. */
  private stretch = 1;
  private anchor = 0;
  /** The original panel's furniture in the margins (?style=3): the scroll track, the edge codes. */
  private decor = false;

  constructor(anisotropy: number, scale: number) {
    this.ctx = this.canvas.getContext('2d', { alpha: true })!;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = anisotropy;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.premultiplyAlpha = true; // filtering and mipmaps must not bleed black from transparent texels
    this.setScale(scale);
  }

  /** Canvas px per page px. Changing it reallocates the canvas and repaints. */
  setScale(scale: number) {
    scale = Math.round(scale * 4) / 4;
    if (scale === this.scale) return;
    this.scale = scale;
    this.canvas.width = Math.round(PAGE.w * scale);
    this.canvas.height = Math.round(PAGE.h * scale);
    this.texture.dispose(); // new storage size
    if (this.layout) this.paint(null);
  }

  get size() { return { w: this.canvas.width, h: this.canvas.height, scale: this.scale }; }

  /** Prints the original panel's scroll track and edge codes in the margins (?style=3). */
  setDecor(on: boolean) {
    this.decor = on;
    if (this.layout) this.paint(null);
  }

  /** Draws the layout `s` times taller about the page row `anchor`. */
  setStretch(s: number, anchor: number) {
    this.stretch = s;
    this.anchor = anchor;
    if (this.layout) this.paint(null);
  }

  /** Layout px → canvas: the page scale and the stretch. */
  private transform() {
    const { scale, stretch: s, anchor } = this;
    this.ctx.setTransform(scale, 0, 0, scale * s, 0, scale * anchor * (1 - s));
  }
  /** A layout y in the page's real px. */
  toPage(y: number): number { return this.anchor + (y - this.anchor) * this.stretch; }

  setLayout(layout: PageLayout, opts: { reveal?: { entry: number; chars: number } | null; offset?: number } = {}) {
    this.layout = layout;
    this.scroll = Math.min(this.scroll, layout.scrollMax);
    if ('reveal' in opts) this.reveal = opts.reveal ?? null;
    if (opts.offset !== undefined) this.offset = opts.offset;
    this.paint(null);
  }

  /** Typewriter state; repaints only when it changes. */
  setReveal(reveal: { entry: number; chars: number } | null) {
    const r = this.reveal;
    if (r === reveal || (r && reveal && r.entry === reveal.entry && r.chars === reveal.chars)) return;
    this.reveal = reveal;
    this.paint(null);
  }

  setOffset(offset: number) {
    if (Math.abs(offset - this.offset) < 0.01) return;
    this.offset = offset;
    this.paint(null);
  }

  /** Scrolls the history by delta page px (positive: back in time). Returns true if it moved. */
  scrollBy(delta: number): boolean {
    const max = this.layout?.scrollMax ?? 0;
    const next = Math.max(0, Math.min(max, this.scroll + delta / this.stretch));
    if (next === this.scroll) return false;
    this.scroll = next;
    this.paint(null);
    return true;
  }

  /** Back to the newest line. */
  scrollToEnd() { if (this.scroll) { this.scroll = 0; this.paint(null); } }

  /** The options' boxes as drawn now (layout px): scrolled, and cut to the visible window. */
  private drawnOptions(): OptionRect[] {
    const w = this.layout?.window;
    const dy = this.scroll + this.offset;
    return (this.layout?.options ?? []).flatMap(({ index, number, greyed, rect }) => {
      let y0 = rect.y + dy, y1 = y0 + rect.h;
      if (w) { y0 = Math.max(y0, w.y0 + w.fade * 0.5); y1 = Math.min(y1, w.y1 + 4); }
      return y1 > y0 ? [{ index, number, greyed, rect: { x: rect.x, y: y0, w: rect.w, h: y1 - y0 } }] : [];
    });
  }

  /** Hit boxes of the options as they are drawn now, in the page's real px. */
  optionRects(): OptionRect[] {
    return this.drawnOptions().map((o) => ({ ...o, rect: { ...o.rect, y: this.toPage(o.rect.y), h: o.rect.h * this.stretch } }));
  }

  setHover(index: number | null) {
    if (index === this.hover || !this.layout) return;
    const rects = this.drawnOptions().filter((o) => o.index === index || o.index === this.hover).map((o) => o.rect);
    this.hover = index;
    for (const r of rects) this.paint(r);
  }

  setCursor(on: boolean) {
    if (on === this.cursorOn) return;
    this.cursorOn = on;
    const c = this.layout?.cursor;
    if (c) this.paint({ x: c.x - 1, y: c.y + this.scroll + this.offset - 1, w: c.w + 2, h: c.h + 2 });
    if (this.marker) this.paint(this.markerRect());
  }

  /** Shows or hides the continue marker (「▼ 继续」) at the column's bottom right. */
  setMarker(on: boolean) {
    if (on === this.marker) return;
    this.marker = on;
    if (this.layout?.marker) this.paint(this.markerRect());
  }

  private markerRect(): Rect {
    const m = this.layout?.marker;
    if (m?.bar) return { x: m.bar.x - 4, y: m.bar.y - 4, w: m.bar.w + 8, h: m.bar.h + 8 };
    return m ? { x: m.x - 4, y: m.y - 22, w: PAGE.w - m.x, h: 30 } : { x: 0, y: 0, w: 0, h: 0 };
  }

  /**
   * The checks' bars (the original look), in layout px at scroll 0: every check sits on one,
   * a white check on a white slip of paper, a red check on an orange-red one.
   */
  private bars(): { rect: Rect; check: 'white' | 'red' }[] {
    const l = this.layout;
    if (!l || l.look.checks !== 'bars') return [];
    return l.options.flatMap((o) => (o.check ? [{ rect: { x: o.rect.x + 5, y: o.rect.y + 2, w: o.rect.w - 10, h: o.rect.h - 3 }, check: o.check }] : []));
  }

  /** Repaints the whole page (rect = null) or only what lies inside rect (page px, as drawn). */
  private paint(rect: Rect | null) {
    const { ctx } = this;
    const win = this.layout?.window ?? null;
    const dy = this.scroll + this.offset;
    ctx.save();
    this.transform();
    // the whole canvas, in layout px
    const r = rect ?? { x: 0, y: (this.anchor * (this.stretch - 1)) / this.stretch, w: PAGE.w, h: PAGE.h / this.stretch };
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.clearRect(r.x, r.y, r.w, r.h);
    if (win) { // nothing above the tear, nothing below the window
      ctx.beginPath();
      ctx.rect(0, win.y0, PAGE.w, win.y1 + 8 - win.y0);
      ctx.clip();
    }
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    const shifted = { x: r.x, y: r.y - dy, w: r.w, h: r.h };
    ctx.translate(0, dy);
    for (const b of this.bars()) {
      // the original's check bars as slips of paper, their right ends torn: a hairline of
      // shadow under the white one, which is only a little lighter than the page
      const { x, y, w, h } = b.rect;
      ctx.globalAlpha = 1;
      if (b.check === 'white') {
        ctx.fillStyle = 'rgba(70,56,40,.2)';
        roughRect(ctx, { x: x + 0.8, y: y + 1.2, w, h }, 3);
      }
      ctx.fillStyle = b.check === 'white' ? INK_ORIGINAL.white : INK_ORIGINAL.red;
      roughRect(ctx, { x, y, w, h }, 3);
    }
    for (const it of this.layout?.items ?? []) {
      if (!intersects(shifted, it.box)) continue;
      const shown = this.shown(it);
      if (shown === 0) continue;
      this.draw(it, shown);
    }
    ctx.restore();
    if (win) this.fades(r, win);
    if (win && this.decor) this.margins(r, win);
    const mk = this.layout?.marker;
    if (mk && this.marker) {
      // it pulses with the cursor between full and dim, so it never disappears (the bar holds
      // still; only its arrow pulses)
      ctx.save();
      this.transform();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      if (mk.bar) continueBar(ctx, mk.bar);
      ctx.font = mk.font;
      ctx.fillStyle = mk.color;
      ctx.globalAlpha = this.cursorOn || mk.bar ? 1 : 0.6;
      ctx.textBaseline = 'alphabetic';
      let x = mk.x;
      for (const ch of mk.text) { ctx.fillText(ch, x, mk.y); x += ctx.measureText(ch).width + mk.ls; }
      if (mk.bar) {
        // the arrow after the word: ►
        const s = mk.bar.h * 0.36, x0 = x - mk.ls + s * 0.9, cy = mk.bar.y + mk.bar.h / 2;
        ctx.globalAlpha = this.cursorOn ? 1 : 0.55;
        ctx.beginPath();
        ctx.moveTo(x0, cy - s * 0.62); ctx.lineTo(x0 + s * 1.15, cy); ctx.lineTo(x0, cy + s * 0.62);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    this.texture.needsUpdate = true;
  }

  /** How much of an item the typewriter shows: 0 nothing, Infinity all, n the first n characters. */
  private shown(it: DrawItem): number {
    const r = this.reveal;
    if (!r || it.entry === undefined || it.entry < r.entry) return Infinity;
    if (it.entry > r.entry) return 0;
    if (it.t !== 'text' || it.from === undefined) return Infinity; // labels come with the entry
    return Math.max(0, r.chars - it.from);
  }

  /** Old lines fade out as they rise into the tear; when scrolled back, new ones fade out at the bottom. */
  private fades(r: Rect, win: NonNullable<PageLayout['window']>) {
    const { ctx } = this;
    ctx.save();
    this.transform();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-out';
    const top = ctx.createLinearGradient(0, win.y0, 0, win.y0 + win.fade);
    top.addColorStop(0, 'rgba(0,0,0,1)');
    top.addColorStop(0.35, 'rgba(0,0,0,0.72)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, win.y0, PAGE.w, win.fade);
    if (this.scroll > 0) {
      const bottom = ctx.createLinearGradient(0, win.y1 + 8 - BOTTOM_FADE, 0, win.y1 + 8);
      bottom.addColorStop(0, 'rgba(0,0,0,0)');
      bottom.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = bottom;
      ctx.fillRect(0, win.y1 + 8 - BOTTOM_FADE, PAGE.w, BOTTOM_FADE);
    }
    ctx.restore();
  }

  /**
   * The original panel's furniture, printed in the margins: down the right margin the scroll
   * track (a hairline with a cap at its top) and its white knob where the reader is in the
   * history (at the bottom: the newest line); down the outer margin the edge codes, set small
   * and faint like the codes along the panel's film-strip edge (here they read as printer's marks).
   */
  private margins(r: Rect, win: NonNullable<PageLayout['window']>) {
    const { ctx } = this;
    ctx.save();
    this.transform();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.globalAlpha = 1;
    const x = 615, y0 = win.y0 + win.fade * 0.35, y1 = win.y1 + 4;
    ctx.strokeStyle = 'rgba(38,32,26,.42)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y0 + 2); ctx.lineTo(x, y1);
    ctx.moveTo(x - 3.5, y0 + 6); ctx.lineTo(x, y0); ctx.lineTo(x + 3.5, y0 + 6);
    ctx.stroke();
    const max = this.layout?.scrollMax ?? 0;
    const ky = y1 - 5 - (max ? (this.scroll / max) * (y1 - y0 - 16) : 0);
    ctx.fillStyle = '#F6F1E7';
    ctx.strokeStyle = 'rgba(38,32,26,.72)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(x, ky, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(38,32,26,.3)';
    ctx.font = '500 9px "Barlow Condensed", "Inter", sans-serif';
    ctx.textBaseline = 'middle';
    ['01A16', '01A17', '01A18'].forEach((code, i) => {
      const cy = win.y0 + 70 + i * 140;
      if (cy > win.y1 - 20) return;
      ctx.save();
      ctx.translate(13, cy);
      ctx.rotate(-Math.PI / 2);
      let cx = -14;
      for (const ch of code) { ctx.fillText(ch, cx, 0); cx += ctx.measureText(ch).width + 1.4; }
      ctx.restore();
      ctx.fillRect(10, cy + 24, 6, 0.8);
      ctx.fillRect(10, cy - 24, 6, 0.8);
    });
    ctx.restore();
  }

  private draw(it: DrawItem, shown: number) {
    const { ctx } = this;
    ctx.globalAlpha = 1;
    if (it.t === 'tag') {
      const { x, y, w, h } = it.box;
      ctx.globalAlpha = it.alpha;
      ctx.fillStyle = 'rgba(30,26,22,.22)';
      ctx.fillRect(x + 1.5, y + 1.5, w, h);
      ctx.fillStyle = it.fill ?? '#F2EFE6';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = it.stroke ?? 'rgba(30,26,22,.9)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + 0.6, y + 0.6, w - 1.2, h - 1.2);
      return;
    }
    if (it.t === 'rule') {
      ctx.globalAlpha = it.alpha;
      ctx.fillStyle = it.color;
      ctx.fillRect(it.box.x, it.box.y, it.box.w, it.box.h);
      return;
    }
    if (it.t === 'mark') {
      const { x, y, w, h } = it.box;
      ctx.globalAlpha = it.alpha;
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (it.t === 'cursor') {
      if (!this.cursorOn) return;
      ctx.fillStyle = it.color;
      ctx.fillRect(it.box.x, it.box.y, it.box.w, it.box.h);
      return;
    }
    const opt = it.option !== undefined ? this.layout?.options.find((o) => o.index === it.option) : undefined;
    const hovered = !!opt && it.option === this.hover && !opt.greyed;
    // hovered words: the board's brighter rust; in the original they turn white, its brightest
    // ink: on the page, black, and on a red check's bar, light
    const original = this.layout?.look.checks === 'bars';
    const color = !hovered ? it.color : !original ? INK.hover : opt.check === 'red' ? INK_ORIGINAL.redHover : INK_ORIGINAL.hover;
    const text = shown === Infinity ? it.text : [...it.text].slice(0, shown).join('');
    ctx.font = it.font;
    ctx.globalAlpha = it.alpha;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = it.stroke;
    if (!it.ls) {
      ctx.fillText(text, it.x, it.y);
      if (it.stroke) ctx.strokeText(text, it.x, it.y);
      return;
    }
    let x = it.x;
    for (const ch of text) {
      ctx.fillText(ch, x, it.y);
      if (it.stroke) ctx.strokeText(ch, x, it.y);
      x += ctx.measureText(ch).width + it.ls;
    }
  }
}

function intersects(a: Rect, b: Rect) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** A small seeded PRNG (the same brush marks on every repaint). */
function prng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

/** Fills a rect whose right end is brushed: its corner points jitter up to `jag` px inward. */
function roughRect(ctx: CanvasRenderingContext2D, r: Rect, jag: number) {
  const rnd = prng(Math.round(r.y * 7 + r.w * 3));
  const n = Math.max(2, Math.round(r.h / 7));
  ctx.beginPath();
  ctx.moveTo(r.x, r.y);
  for (let i = 0; i <= n; i++) ctx.lineTo(r.x + r.w - jag * rnd(), r.y + (r.h * i) / n);
  ctx.lineTo(r.x, r.y + r.h);
  ctx.closePath();
  ctx.fill();
}

/**
 * The original's CONTINUE bar, printed: a red strip across the column with a brushed right
 * end, faint streaks along it and a darker wash toward that end.
 */
function continueBar(ctx: CanvasRenderingContext2D, b: Rect & { fill: string }) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = b.fill;
  roughRect(ctx, b, 5);
  const wash = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
  wash.addColorStop(0, 'rgba(60,8,4,0)');
  wash.addColorStop(0.5, 'rgba(60,8,4,0)');
  wash.addColorStop(1, 'rgba(60,8,4,.3)');
  ctx.fillStyle = wash;
  ctx.fillRect(b.x, b.y, b.w - 5, b.h);
  const rnd = prng(29);
  for (let i = 0; i < 14; i++) {
    const x = b.x + b.w * (0.3 + rnd() * 0.55), y = b.y + 1.5 + rnd() * (b.h - 3), w = b.w * (0.06 + rnd() * 0.2);
    ctx.fillStyle = rnd() > 0.45 ? 'rgba(255,196,160,.1)' : 'rgba(40,6,2,.18)';
    ctx.fillRect(x, y, Math.max(0, Math.min(w, b.x + b.w - 8 - x)), 0.7 + rnd() * 1.3);
  }
}
