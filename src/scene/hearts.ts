// Morale (§5.1, §6.5): four matte paper hearts lying in a row on the table beside the book,
// each folded once down its middle, so it stands on the table as a low tent and throws a small
// shadow. Losing a point, the heart lifts off the table, flips over and lands pale; regaining
// one flips it back to red. The hearts are left-right symmetric, so a half turn about the depth
// axis lands them where they were, the other side up; the fold opens flat and closes the other
// way as it turns, so it lands a tent again.
import { CanvasTexture, DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, type Texture } from 'three';
import type { Art } from '../assets';
import { panAt, type Sound } from '../audio/sfx';
import { ease, type Clock } from '../play/clock';
import { TABLE } from './tabletop';

/** A heart's width on the table (world units); the art is 28 x 29 board px. */
const SIZE = 0.36;
/** Height of the fold's crease over the heart's width (about an 18 degree slope each side). */
const FOLD = 0.16;
/** The original's morale blue (its HUD: morale in blue, health in orange), as an HSL hue. */
const MORALE_HUE = 194 / 360;

/** `blue`: the hearts in the original's morale blue (?style=1). */
export function createHearts(art: Art, clock: Clock, max = 4, o: { blue?: boolean; sound?: Sound } = {}) {
  const sound = o.sound ?? (() => {});
  const group = new Group();
  group.name = 'hearts';
  const [, , vw, vh] = art.heart.viewBox;
  const k = SIZE / (vw / 100);
  // (a lost heart stays a pale ghost: nearly grey, so it reads apart from the blue ones)
  const full = o.blue ? rehue(art.heart.texture, MORALE_HUE, 0.72, 0.85) : art.heart.texture;
  const empty = o.blue ? rehue(art['heart-empty'].texture, MORALE_HUE, 1, 0.3) : art['heart-empty'].texture;
  const hearts = Array.from({ length: max }, (_, i) => {
    // folded down the middle: the crease raised, the two halves sloping to the table
    const w = (vw / 100) * k, geometry = new PlaneGeometry(w, (vh / 100) * k, 2, 1);
    geometry.rotateX(-Math.PI / 2);
    const p = geometry.attributes.position;
    for (let v = 0; v < p.count; v++) if (Math.abs(p.getX(v)) < 1e-6) p.setY(v, FOLD * w);
    geometry.computeVertexNormals();
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
      const lost = v < hearts.filter((x) => x.full).length;
      value = v;
      if (changed.length) sound(lost ? 'morale-down' : 'morale-up', { pan: panAt(TABLE.hearts.x + TABLE.hearts.step * 1.5) });
      for (const h of lost ? changed.reverse() : changed) {
        const target = !h.full;
        let swapped = false;
        sound('heart-flip', { pan: panAt(h.pivot.position.x) });
        await clock.tween(700, (t) => {
          h.pivot.position.y = 0.004 + 0.3 * Math.sin(Math.PI * t);
          h.pivot.rotation.z = Math.PI * t;
          h.mesh.scale.y = Math.cos(Math.PI * t); // the fold opens flat and closes the other way
          if (t >= 0.5 && !swapped) { swapped = true; show(h, target); }
        }, ease.inOut);
        sound('paper-land', { pan: panAt(h.pivot.position.x), size: 0.1 });
        h.pivot.rotation.z = 0; // symmetric: a half turn looks the same as none
        h.mesh.scale.y = 1;
        h.pivot.position.y = 0.004;
      }
    },
  };
}

/**
 * A copy of a baked paper texture with its colour turned to another hue: saturation scaled by
 * `sat`, lightness by `dark`, so the paper's fibres, cut edge and shading stay as baked.
 * Pale, unsaturated pixels (the cut edge's light rim) barely change.
 */
function rehue(t: Texture, hue: number, dark: number, sat: number): Texture {
  const img = t.image as CanvasImageSource & { width: number; height: number };
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    const s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
    const L = l * (1 - (1 - dark) * Math.min(1, s * 1.5)); // darken only the coloured paper
    const C = (1 - Math.abs(2 * L - 1)) * s * sat;
    const f = (n: number) => { const k = (n + hue * 12) % 12; return L - C / 2 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    p[i] = f(0) * 255; p[i + 1] = f(8) * 255; p[i + 2] = f(4) * 255;
  }
  x.putImageData(d, 0, 0);
  const out = new CanvasTexture(c);
  out.colorSpace = SRGBColorSpace;
  out.anisotropy = t.anisotropy;
  return out;
}
