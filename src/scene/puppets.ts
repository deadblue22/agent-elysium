// The right page's stage: the two profile puppets (hinged like the pop-up planes),
// two paper dice showing 4 and 5, and the four morale hearts.
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, Color, Group, Mesh, MeshStandardMaterial, SRGBColorSpace, Sprite,
  SpriteMaterial, Vector3,
} from 'three';
import type { Art } from '../assets';
import { DEG, LEAN, curvedSheet, paperMaterial, pointOnStanding, standing, surfaceY, wx, wz, type StandOptions } from './space';

/** Placement from the M0 board: 0.95 scale, soles on the fold line; about 1.3x the desk's height. */
export const PUPPETS: Record<'villon' | 'kask', StandOptions> = {
  villon: { hinge: 318, baseY: 196.5, x0: 817, scale: 0.95 },
  kask: { hinge: 304, baseY: 186.5, x0: 1015, scale: 0.95 },
};

/** Faces per die in BoxGeometry order: +x (right), -x (left), +y (top), -y (bottom), +z (near), -z (far). */
const DICE = [
  { bx: 1188, by: 506, rot: -17, faces: [1, 6, 4, 3, 2, 5] },
  { bx: 1260, by: 532, rot: 26, faces: [6, 1, 5, 2, 3, 4] },
];
const DIE = 0.4;

export function createStage(art: Art) {
  const group = new Group();
  group.name = 'stage';

  for (const [name, o] of Object.entries(PUPPETS)) {
    const cx = (o.x0 ?? 0) + (art[name].viewBox[2] / 2) * (o.scale ?? 1);
    const material = paperMaterial(art[name].texture, 0.9);
    // light bouncing off the bright page onto the puppets' fronts (the direct lights miss it)
    material.emissive.setRGB(0.2, 0.18, 0.15);
    material.emissiveMap = art[name].texture;
    const { group: g, mesh } = standing(art[name], material, { ...o, y: surfaceY(cx) - 0.004 });
    mesh.name = name;
    group.add(g);
  }

  // the ember of Villon's cigarette
  const v = PUPPETS.villon;
  const e = pointOnStanding({ ...v, svgX: 95.8, svgY: 49.6 }, surfaceY(874) - 0.004);
  const ember = new Sprite(new SpriteMaterial({ map: glowTexture('255,170,90'), color: new Color(1.6, 1.3, 1.1), blending: AdditiveBlending, depthWrite: false, transparent: true }));
  ember.position.set(e.x, e.y, e.z).addScaledVector(new Vector3(0, Math.sin(LEAN), Math.cos(LEAN)), 0.01);
  ember.scale.setScalar(0.2);
  group.add(ember);

  const atlas = art.dice.texture;
  for (const d of DICE) {
    const mats = d.faces.map((f) => {
      const t = atlas.clone();
      t.repeat.set(1 / 6, 1);
      t.offset.set((f - 1) / 6, 0);
      return new MeshStandardMaterial({ map: t, roughness: 0.85 });
    });
    const die = new Mesh(new BoxGeometry(DIE, DIE, DIE), mats);
    die.position.set(wx(d.bx), surfaceY(d.bx) + DIE / 2, wz(d.by));
    die.rotation.y = d.rot * DEG;
    die.castShadow = die.receiveShadow = true;
    die.name = 'die';
    group.add(die);
  }

  const [hx, hy, hw, hh] = art.hearts.viewBox;
  const hearts = new Mesh(curvedSheet(hx, hx + hw, hy, hy + hh, 0.003, 2), paperMaterial(art.hearts.texture));
  hearts.receiveShadow = true;
  hearts.name = 'hearts';
  group.add(hearts);

  return { group };
}

/** A soft radial glow (for embers and the candle's halo). */
export function glowTexture(rgb: string, size = 64): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(0.18, `rgba(${rgb},.55)`);
  g.addColorStop(0.55, `rgba(${rgb},.12)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
