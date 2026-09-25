// The right page's stage, on the torn top sheet below the floor's tongue: the two profile
// puppets (hinged like the pop-up planes), two paper dice showing 4 and 5, the morale hearts.
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, Color, Group, Mesh, MeshStandardMaterial, SRGBColorSpace, Sprite,
  SpriteMaterial, Vector3,
} from 'three';
import type { Art } from '../assets';
import { DEG, SHEET_Y, flatSheet, leanNormal, paperMaterial, pointOnStanding, standing, wx, wz, type StandOptions } from './space';

/** The puppets lean back a little so the high camera does not flatten them into slivers. */
const PUPPET_LEAN = 15;

/**
 * Placement from the M0 board (0.95 scale, soles on the fold line, about 1.3x the desk's
 * height), moved toward the reader by the right sheet's `puppetShift` so both stand on the
 * cream below the tongue (their printed stand tabs and rug moved with them in the art).
 */
const PUPPETS: Record<'villon' | 'kask', StandOptions> = {
  villon: { hinge: 318, baseY: 196.5, x0: 817, scale: 0.95, lean: PUPPET_LEAN },
  kask: { hinge: 304, baseY: 186.5, x0: 1015, scale: 0.95, lean: PUPPET_LEAN },
};

/** Faces per die in BoxGeometry order: +x (right), -x (left), +y (top), -y (bottom), +z (near), -z (far). */
const DICE = [
  { bx: 1188, by: 506, rot: -17, faces: [1, 6, 4, 3, 2, 5] },
  { bx: 1260, by: 532, rot: 26, faces: [6, 1, 5, 2, 3, 4] },
];
const DIE = 0.4;

/** Book y of the top of the morale hearts: the right sheet's `heartsY`, clear of its tear. */
export const heartsTop = (art: Art) => art['page-right'].meta.heartsY;

export function createStage(art: Art) {
  const group = new Group();
  group.name = 'stage';
  const shift = art['page-right'].meta.puppetShift;
  const pageH = art['page-right'].meta.pageH;

  const puppets = Object.fromEntries(Object.entries(PUPPETS).map(([k, o]) => [k, { ...o, hinge: o.hinge + shift }]));
  for (const [name, o] of Object.entries(puppets)) {
    const material = paperMaterial(art[name].texture, 0.9);
    // light bouncing off the bright page onto the puppets' fronts (the direct lights miss it)
    material.emissive.setRGB(0.2, 0.18, 0.15);
    material.emissiveMap = art[name].texture;
    const { group: g, mesh } = standing(art[name], material, { ...o, y: SHEET_Y - 0.002 });
    mesh.name = name;
    group.add(g);
  }

  // the ember of Villon's cigarette
  const v = puppets.villon;
  const e = pointOnStanding({ ...v, svgX: 95.8, svgY: 49.6 }, SHEET_Y - 0.002);
  const ember = new Sprite(new SpriteMaterial({ map: glowTexture('255,170,90'), color: new Color(1.6, 1.3, 1.1), blending: AdditiveBlending, depthWrite: false, transparent: true }));
  const n = leanNormal(PUPPET_LEAN);
  ember.position.set(e.x, e.y, e.z).addScaledVector(new Vector3(n.x, n.y, n.z), 0.01);
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
    die.position.set(wx(d.bx), SHEET_Y + DIE / 2, wz(d.by + pageH - 600)); // bottom right, as on M0
    die.rotation.y = d.rot * DEG;
    die.castShadow = die.receiveShadow = true;
    die.name = 'die';
    group.add(die);
  }

  const [hx, hy, hw, hh] = art.hearts.viewBox;
  const dy = heartsTop(art) - (hy + 5); // the hearts are drawn from y + 5 in their SVG
  const hearts = flatSheet(hx, hx + hw, hy + dy, hy + hh + dy, SHEET_Y + 0.003);
  hearts.material = paperMaterial(art.hearts.texture);
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
