// Morale (§5.1, §6.5): four paper hearts lying on the right page. Losing a point, the heart
// lifts off the page, flips over and lands pale; regaining one flips it back to red. The
// hearts are left-right symmetric, so a half turn about the page's depth axis lands them
// exactly where they were, the other side up.
import { DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import type { Art } from '../assets';
import { ease, type Clock } from '../play/clock';
import { wx, wz } from './space';

/** Hearts start at x 1190 on the right page, 31 px apart (the M0 board's row); each is 22 px. */
const X0 = 1190, STEP = 31, SIZE = 22;

export function createHearts(art: Art, top: number, sheet: (bx: number, by: number) => number, clock: Clock, max = 4) {
  const group = new Group();
  group.name = 'hearts';
  const [, , vw, vh] = art.heart.viewBox;
  const full = art.heart.texture, empty = art['heart-empty'].texture;
  const hearts = Array.from({ length: max }, (_, k) => {
    const bx = X0 + STEP * k + SIZE / 2, by = top + SIZE / 2 - 0.5;
    const geometry = new PlaneGeometry(vw / 100, vh / 100);
    geometry.rotateX(-Math.PI / 2);
    const material = new MeshStandardMaterial({ map: full, roughness: 0.9, alphaToCoverage: true, side: DoubleSide });
    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    const pivot = new Group();
    pivot.position.set(wx(bx), sheet(bx, by) + 0.004, wz(by));
    pivot.add(mesh);
    group.add(pivot);
    return { pivot, mesh, material, full: true };
  });
  const show = (h: (typeof hearts)[number], isFull: boolean) => {
    h.full = isFull;
    h.material.map = isFull ? full : empty;
    h.material.needsUpdate = true;
  };
  let value = max;
  return {
    group,
    get value() { return value; },
    /** Sets morale without animating. */
    set(v: number) { value = v; hearts.forEach((h, k) => show(h, k < v)); },
    /** Animates the hearts that change, one after another. */
    async to(v: number) {
      const changed = hearts.filter((h, k) => h.full !== k < v);
      value = v;
      for (const h of v < hearts.filter((x) => x.full).length ? changed.reverse() : changed) {
        const target = !h.full;
        let swapped = false;
        await clock.tween(700, (t) => {
          h.pivot.position.y = h.pivot.userData.y ??= h.pivot.position.y;
          h.pivot.position.y = h.pivot.userData.y + 0.18 * Math.sin(Math.PI * t);
          h.pivot.rotation.z = Math.PI * t;
          if (t >= 0.5 && !swapped) { swapped = true; show(h, target); }
        }, ease.inOut);
        h.pivot.rotation.z = 0; // symmetric: a half turn looks the same as none
        h.pivot.position.y = h.pivot.userData.y;
      }
    },
  };
}
