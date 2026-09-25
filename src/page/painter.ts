// Paints a page layout into a transparent Canvas 2D and exposes it as a CanvasTexture.
// The page mesh composites it over its paper, so the ink takes the page's curvature,
// light, shadows and post-processing like any other surface.
// Partial repaints (hover, cursor blink) clip to a rect and redraw only what is inside.
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import { INK, PAGE, type DrawItem, type PageLayout, type Rect } from './layout';

export class PagePainter {
  readonly canvas = document.createElement('canvas');
  readonly texture: CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private layout: PageLayout | null = null;
  private hover: number | null = null;
  private cursorOn = true;
  private scale = 0;

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

  setLayout(layout: PageLayout) {
    this.layout = layout;
    this.paint(null);
  }

  setHover(index: number | null) {
    if (index === this.hover || !this.layout) return;
    const rects = this.layout.options.filter((o) => o.index === index || o.index === this.hover).map((o) => o.rect);
    this.hover = index;
    for (const r of rects) this.paint(r);
  }

  setCursor(on: boolean) {
    if (on === this.cursorOn) return;
    this.cursorOn = on;
    const c = this.layout?.cursor;
    if (c) this.paint({ x: c.x - 1, y: c.y - 1, w: c.w + 2, h: c.h + 2 });
  }

  /** Repaints the whole page (rect = null) or only the items inside rect. */
  private paint(rect: Rect | null) {
    const { ctx } = this;
    ctx.save();
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (rect) {
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
    } else {
      ctx.clearRect(0, 0, PAGE.w, PAGE.h);
    }
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    for (const it of this.layout?.items ?? []) {
      if (rect && !intersects(rect, it.box)) continue;
      this.draw(it);
    }
    ctx.restore();
    this.texture.needsUpdate = true;
  }

  private draw(it: DrawItem) {
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
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      return;
    }
    if (it.t === 'rule') {
      ctx.globalAlpha = it.alpha;
      ctx.fillStyle = it.color;
      ctx.fillRect(it.box.x, it.box.y, it.box.w, it.box.h);
      return;
    }
    if (it.t === 'cursor') {
      if (!this.cursorOn) return;
      ctx.fillStyle = it.color;
      ctx.fillRect(it.box.x, it.box.y, it.box.w, it.box.h);
      return;
    }
    const color = it.option !== undefined && it.option === this.hover ? INK.hover : it.color;
    ctx.font = it.font;
    ctx.globalAlpha = it.alpha;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = it.stroke;
    if (!it.ls) {
      ctx.fillText(it.text, it.x, it.y);
      if (it.stroke) ctx.strokeText(it.text, it.x, it.y);
      return;
    }
    let x = it.x;
    for (const ch of it.text) {
      ctx.fillText(ch, x, it.y);
      if (it.stroke) ctx.strokeText(ch, x, it.y);
      x += ctx.measureText(ch).width + it.ls;
    }
  }
}

function intersects(a: Rect, b: Rect) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
