// Morale (§5.1, §6.5): four paper hearts lying in a row on the table beside the book. Losing
// a point, the heart lifts off the table, flips over and lands pale; regaining one flips it
// back to red. The hearts are left-right symmetric, so a half turn about the depth axis lands
// them exactly where they were, the other side up.
import { DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import type { Art } from '../assets';
import { ease, type Clock } from '../play/clock';
import { TABLE } from './tabletop';

/** A heart's width on the table (world units); the art is 28 x 29 board px. */
const SIZE = 0.36;

export function createHearts(art: Art, clock: Clock, max = 4) {
  const group = new Group();
  group.name = 'hearts';
  const [, , vw, vh] = art.heart.viewBox;
  const k = SIZE / (vw / 100);
  const full = art.heart.texture, empty = art['heart-empty'].texture;
  const hearts = Array.from({ length: max }, (_, i) => {
    const geometry = new PlaneGeometry((vw / 100) * k, (vh / 100) * k);
    geometry.rotateX(-Math.PI / 2);
    const material = new MeshStandardMaterial({ map: full, roughness: 0.9, alphaToCoverage: true, side: DoubleSide });
    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = 'heart';
    const pivot = new Group();
    pivot.position.set(TABLE.hearts.x + TABLE.hearts.step * i, 0.004, TABLE.hearts.z);
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
    meshes: hearts.map((h) => h.mesh),
    get value() { return value; },
    /** Sets morale without animating. */
    set(v: number) { value = v; hearts.forEach((h, i) => show(h, i < v)); },
    /** Animates the hearts that change, one after another. */
    async to(v: number) {
      const changed = hearts.filter((h, i) => h.full !== i < v);
      value = v;
      for (const h of v < hearts.filter((x) => x.full).length ? changed.reverse() : changed) {
        const target = !h.full;
        let swapped = false;
        await clock.tween(700, (t) => {
          h.pivot.position.y = 0.004 + 0.3 * Math.sin(Math.PI * t);
          h.pivot.rotation.z = Math.PI * t;
          if (t >= 0.5 && !swapped) { swapped = true; show(h, target); }
        }, ease.inOut);
        h.pivot.rotation.z = 0; // symmetric: a half turn looks the same as none
        h.pivot.position.y = 0.004;
      }
    },
  };
}
