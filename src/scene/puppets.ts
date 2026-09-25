// The right page's stage, on the torn top sheet below the floor's tongue: Harry and Kim as
// profile puppets facing each other (hinged like the pop-up planes, each on a paper stand tab),
// two paper dice showing 4 and 5, the morale hearts.
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, Color, Group, Mesh, MeshStandardMaterial, SRGBColorSpace, Sprite,
  SpriteMaterial, Vector3,
} from 'three';
import type { Art } from '../assets';
import { contactSquare, decal, standTab, standingContact } from './paper';
import { DEG, leanNormal, paperMaterial, pointOnStanding, rectUV, standing, surfaceGrid, wx, wz, xSamples, ySamples, type StandOptions } from './space';

/** The puppets lean back a little so the high camera does not flatten them into slivers. */
const PUPPET_LEAN = 15;

/**
 * Where the puppets stand (book px, 0.95 scale, about 1.3x the desk's height as on the M0
 * board): Harry on the left facing right, Kim on the right facing left. The fold lines move
 * toward the reader by the right sheet's `puppetShift`, below the tongue. Each puppet's SVG
 * says where its soles are (data-soles) and what its stand tab must cover (data-feet-x0/x1).
 */
const PUPPETS: Record<'harry' | 'kim', { hinge: number; x0: number; scale: number }> = {
  harry: { hinge: 318, x0: 801, scale: 0.95 },
  kim: { hinge: 304, x0: 996, scale: 0.95 },
};

/** Faces per die in BoxGeometry order: +x (right), -x (left), +y (top), -y (bottom), +z (near), -z (far). */
const DICE = [
  { bx: 1188, by: 506, rot: -17, faces: [1, 6, 4, 3, 2, 5] },
  { bx: 1260, by: 532, rot: 26, faces: [6, 1, 5, 2, 3, 4] },
];
const DIE = 0.4;

/** Book y of the top of the morale hearts: the right sheet's `heartsY`, clear of its tear. */
export const heartsTop = (art: Art) => art['page-right'].meta.heartsY;

/** sheet: world height of the right top sheet at (bx, by), which everything here stands on. */
export function createStage(art: Art, sheet: (bx: number, by: number) => number) {
  const group = new Group();
  group.name = 'stage';
  const shift = art['page-right'].meta.puppetShift;
  const pageH = art['page-right'].meta.pageH;

  const puppets = Object.fromEntries(Object.entries(PUPPETS).map(([k, p]): [string, StandOptions] =>
    [k, { hinge: p.hinge + shift, x0: p.x0, scale: p.scale, baseY: art[k].meta.soles, lean: PUPPET_LEAN }]));
  /** the book x range of a puppet's feet */
  const feet = (name: string) => {
    const o = puppets[name], m = art[name].meta;
    return [o.x0! + m.feetX0 * o.scale!, o.x0! + m.feetX1 * o.scale!];
  };
  /** a puppet stands where the sheet is under the middle of its feet */
  const footY = (name: string) => { const [a, b] = feet(name); return sheet((a + b) / 2, puppets[name].hinge) - 0.002; };
  const tabTexture = standTab();
  for (const [name, o] of Object.entries(puppets)) {
    const material = paperMaterial(art[name].texture, 0.9);
    // light bouncing off the bright page onto the puppets' fronts (the direct lights miss it)
    material.emissive.setRGB(0.2, 0.18, 0.15);
    material.emissiveMap = art[name].texture;
    const { group: g, mesh } = standing(art[name], material, { ...o, y: footY(name) });
    mesh.name = name;
    group.add(g);
    // the stand tab: the flap folded forward under the feet and glued to the page
    const [a, b] = feet(name), bx0 = a - 4, bx1 = b + 4, by0 = o.hinge, by1 = o.hinge + 7;
    const tab = new Mesh(surfaceGrid(xSamples(bx0, bx1), ySamples(by0, by1, 3), (bx, by) => sheet(bx, by) + 0.002, rectUV(bx0, bx1, by0, by1)),
      new MeshStandardMaterial({ map: tabTexture, roughness: 0.95, alphaToCoverage: true }));
    tab.receiveShadow = true;
    tab.name = `tab-${name}`;
    group.add(tab);
    const contact = standingContact(art[name], o, sheet, { opacity: 0.75, behind: 12, front: 8 });
    contact.name = `contact-${name}`;
    group.add(contact);
  }

  // the ember of Harry's cigarette
  const h = puppets.harry, hm = art.harry.meta;
  const e = pointOnStanding({ ...h, svgX: hm.emberX, svgY: hm.emberY }, footY('harry'));
  const ember = new Sprite(new SpriteMaterial({ map: glowTexture('255,170,90'), color: new Color(1.4, 1.1, 0.9), blending: AdditiveBlending, depthWrite: false, transparent: true }));
  const n = leanNormal(PUPPET_LEAN);
  ember.position.set(e.x, e.y, e.z).addScaledVector(new Vector3(n.x, n.y, n.z), 0.01);
  ember.scale.setScalar(0.075); // a point of orange at the cigarette's tip, not a halo over the face
  group.add(ember);

  const atlas = art.dice.texture;
  for (const d of DICE) {
    const mats = d.faces.map((f) => {
      const t = atlas.clone();
      t.repeat.set(1 / 6, 1);
      t.offset.set((f - 1) / 6, 0);
      return new MeshStandardMaterial({ map: t, roughness: 0.85 });
    });
    const by = d.by + pageH - 600; // bottom right, as on M0
    const die = new Mesh(new BoxGeometry(DIE, DIE, DIE), mats);
    die.position.set(wx(d.bx), sheet(d.bx, by) + DIE / 2, wz(by));
    die.rotation.y = d.rot * DEG;
    die.castShadow = die.receiveShadow = true;
    die.name = 'die';
    group.add(die);
    // contact occlusion under the die
    const r = DIE * 100; // footprint, book px; the decal is twice as wide
    const under = decal(surfaceGrid(xSamples(d.bx - r, d.bx + r), ySamples(by - r, by + r, 8), (bx, y) => sheet(bx, y) + 0.004, rectUV(d.bx - r, d.bx + r, by - r, by + r)), contactSquare(), 0.8);
    under.geometry.center();
    under.position.set(wx(d.bx), sheet(d.bx, by) + 0.004, wz(by));
    under.rotation.y = d.rot * DEG;
    under.name = 'contact-die';
    group.add(under);
  }

  const [hx, hy, hw, hh] = art.hearts.viewBox;
  const dy = heartsTop(art) - (hy + 5); // the hearts are drawn from y + 5 in their SVG
  const hearts = new Mesh(surfaceGrid(xSamples(hx, hx + hw), ySamples(hy + dy, hy + hh + dy, 6), (bx, by) => sheet(bx, by) + 0.003,
    rectUV(hx, hx + hw, hy + dy, hy + hh + dy)), paperMaterial(art.hearts.texture));
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
