// Pointer -> ray -> left page mesh -> UV -> page px -> option line box -> option index.
// Hover reports the pointer too (for the tooltip); click reports every click, on an option
// or not (a click anywhere completes the line being typed).
import { Raycaster, Vector2, type Camera, type Mesh } from 'three';
import { PAGE, type Rect } from './layout';

export interface HitHandlers {
  hover: (index: number | null, at: { clientX: number; clientY: number } | null) => void;
  click: (index: number | null) => void;
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
    /** Option hit boxes as currently drawn (scrolled, cut to the visible window), page px. */
    private options: () => { index: number; rect: Rect }[],
    private on: HitHandlers,
  ) {
    el.addEventListener('pointermove', (e) => this.update(e));
    el.addEventListener('pointerleave', () => { this.last = null; this.set(null); });
    el.addEventListener('click', (e) => this.on.click(this.pick(e)));
  }

  /** The point on the page (page px) under a client-space point, or null off the page. */
  pagePoint(e: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const r = this.el.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.ray.intersectObject(this.page, false)[0];
    return hit?.uv ? { x: hit.uv.x * PAGE.w, y: (1 - hit.uv.y) * PAGE.h } : null;
  }

  /** Option index under a client-space point, or null. */
  pick(e: { clientX: number; clientY: number }): number | null {
    const p = this.pagePoint(e);
    if (!p) return null;
    const o = this.options().find(({ rect: b }) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
    return o ? o.index : null;
  }

  /** Re-picks under the last pointer position (the page moves under it while the camera eases). */
  refresh() {
    if (this.last) this.set(this.pick(this.last));
  }

  /** Whether the option under the pointer can be chosen (greyed ones cannot); sets the cursor. */
  choosable: (index: number) => boolean = () => true;

  private update(e: PointerEvent) {
    this.last = { clientX: e.clientX, clientY: e.clientY };
    const i = this.pick(e);
    const moved = i === this.current;
    this.set(i);
    if (moved && i !== null) this.on.hover(i, this.last); // the tooltip follows the pointer
  }

  private set(i: number | null) {
    if (i === this.current) return;
    this.current = i;
    this.el.style.cursor = i === null ? '' : this.choosable(i) ? 'pointer' : 'not-allowed';
    this.on.hover(i, this.last);
  }
}
