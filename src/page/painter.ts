// Paints a page layout into a transparent Canvas 2D and exposes it as a CanvasTexture.
// The page mesh composites it over its paper, so the ink takes the page's perspective,
// light, shadows and post-processing like any other surface.
//
// The log is a bottom-anchored window: items are drawn with the current scroll offset,
// clipped to the window under the tear, and faded out as they rise into it. The typewriter
// reveals the newest entry character by character (`setReveal`); an animated offset lets a
// new entry push the older lines up smoothly. Partial repaints (hover, cursor blink) clip to
// a rect and redraw only what is inside.
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import { INK, PAGE, type DrawItem, type PageLayout, type Rect } from './layout';

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
    const next = Math.max(0, Math.min(max, this.scroll + delta));
    if (next === this.scroll) return false;
    this.scroll = next;
    this.paint(null);
    return true;
  }

  /** Back to the newest line. */
  scrollToEnd() { if (this.scroll) { this.scroll = 0; this.paint(null); } }

  /** Hit boxes of the options as they are drawn now: scrolled, and cut to the visible window. */
  optionRects(): OptionRect[] {
    const w = this.layout?.window;
    const dy = this.scroll + this.offset;
    return (this.layout?.options ?? []).flatMap(({ index, number, greyed, rect }) => {
      let y0 = rect.y + dy, y1 = y0 + rect.h;
      if (w) { y0 = Math.max(y0, w.y0 + w.fade * 0.5); y1 = Math.min(y1, w.y1 + 4); }
      return y1 > y0 ? [{ index, number, greyed, rect: { x: rect.x, y: y0, w: rect.w, h: y1 - y0 } }] : [];
    });
  }

  setHover(index: number | null) {
    if (index === this.hover || !this.layout) return;
    const rects = this.optionRects().filter((o) => o.index === index || o.index === this.hover).map((o) => o.rect);
    this.hover = index;
    for (const r of rects) this.paint(r);
  }

  setCursor(on: boolean) {
    if (on === this.cursorOn) return;
    this.cursorOn = on;
    const c = this.layout?.cursor;
    if (c) this.paint({ x: c.x - 1, y: c.y + this.scroll + this.offset - 1, w: c.w + 2, h: c.h + 2 });
  }

  /** Repaints the whole page (rect = null) or only what lies inside rect (page px, as drawn). */
  private paint(rect: Rect | null) {
    const { ctx } = this;
    const win = this.layout?.window ?? null;
    const dy = this.scroll + this.offset;
    ctx.save();
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const r = rect ?? { x: 0, y: 0, w: PAGE.w, h: PAGE.h };
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
    for (const it of this.layout?.items ?? []) {
      if (!intersects(shifted, it.box)) continue;
      const shown = this.shown(it);
      if (shown === 0) continue;
      this.draw(it, shown);
    }
    ctx.restore();
    if (win) this.fades(r, win);
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
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
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

  private draw(it: DrawItem, shown: number) {
    const { ctx } = this;
    ctx.globalAlpha = 1;
    if (it.t === 'tag') {
      const { x, y, w, h } = it.box;
      ctx.globalAlpha = it.alpha;
      ctx.fillStyle = 'rgba(30,26,22,.22)';
      ctx.fillRect(x + 1.5, y + 1.5, w, h);
      ctx.fillStyle = '#F2EFE6';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(30,26,22,.9)';
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
    const greyed = it.option !== undefined && this.layout?.options.find((o) => o.index === it.option)?.greyed;
    const color = it.option !== undefined && it.option === this.hover && !greyed ? INK.hover : it.color;
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
