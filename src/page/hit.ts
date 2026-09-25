// Pointer -> ray -> left page mesh -> UV -> page px -> option line box -> option index.
import { Raycaster, Vector2, type Camera, type Mesh } from 'three';
import { PAGE, type PageLayout } from './layout';

export interface HitHandlers {
  hover: (index: number | null) => void;
  click: (index: number) => void;
}

export class PageHit {
  private ray = new Raycaster();
  private ndc = new Vector2();
  private current: number | null = null;
  private last: { clientX: number; clientY: number } | null = null;

  constructor(
    private el: HTMLElement,
    private camera: Camera,
    private page: Mesh,
    private layout: () => PageLayout | null,
    private on: HitHandlers,
  ) {
    el.addEventListener('pointermove', (e) => this.update(e));
    el.addEventListener('pointerleave', () => { this.last = null; this.set(null); });
    el.addEventListener('click', (e) => {
      const i = this.pick(e);
      if (i !== null) this.on.click(i);
    });
  }

  /** Option index under a client-space point, or null. */
  pick(e: { clientX: number; clientY: number }): number | null {
    const r = this.el.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.ray.intersectObject(this.page, false)[0];
    const layout = this.layout();
    if (!hit?.uv || !layout) return null;
    const x = hit.uv.x * PAGE.w, y = (1 - hit.uv.y) * PAGE.h;
    const o = layout.options.find(({ rect: b }) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    return o ? o.index : null;
  }

  /** Re-picks under the last pointer position (the page moves under it while the camera eases). */
  refresh() {
    if (this.last) this.set(this.pick(this.last));
  }

  private update(e: PointerEvent) {
    this.last = { clientX: e.clientX, clientY: e.clientY };
    this.set(this.pick(e));
  }

  private set(i: number | null) {
    if (i === this.current) return;
    this.current = i;
    this.el.style.cursor = i === null ? '' : 'pointer';
    this.on.hover(i);
  }
}
