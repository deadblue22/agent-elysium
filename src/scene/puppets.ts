// Harry and Kim as profile puppets standing in the room, on the rug in front of the desk and
// the fireplace (the right half of the floor runs down to the right sheet's low tear): Harry
// on the left facing right, Kim on the right facing left, each hinged on a paper stand tab
// glued to the floor, like the pop-up's rows. The dice, the morale hearts and the leads lie
// on the table (src/scene/dice.ts, hearts.ts, lead.ts).
import {
  AdditiveBlending, CanvasTexture, Color, Group, Mesh, MeshStandardMaterial, SRGBColorSpace, Sprite, SpriteMaterial, Vector3,
} from 'three';
import type { Art } from '../assets';
import { standTab, standingContact } from './paper';
import { baseY, leanNormal, paperMaterial, pointOnStanding, rectUV, standing, surfaceGrid, xSamples, ySamples, type StandOptions } from './space';

/** The puppets lean back a little, as the pop-up's front rows do. */
const PUPPET_LEAN = 9;

/**
 * Where the puppets stand (book px): the fold line (hinge, from the far edge), the SVG's
 * x = 0 and the scale. 1.3x their SVG size: Harry a little over twice the desk's height, Kim
 * a head shorter. Each puppet's SVG says where its soles are (data-soles) and what its stand
 * tab must cover (data-feet-x0/x1).
 */
const PUPPETS: Record<'harry' | 'kim', { hinge: number; x0: number; scale: number }> = {
  harry: { hinge: 452, x0: 760, scale: 1.3 },
  kim: { hinge: 438, x0: 1000, scale: 1.3 },
};

/** The floor sheet's surface (the pop-up and the puppets stand on it). */
export const floorAt = (bx: number, by: number) => baseY(bx, by) + 0.003;

export function createStage(art: Art) {
  const group = new Group();
  group.name = 'stage';

  const place = Object.fromEntries(Object.entries(PUPPETS).map(([k, p]): [string, StandOptions] =>
    [k, { hinge: p.hinge, x0: p.x0, scale: p.scale, baseY: art[k].meta.soles, lean: PUPPET_LEAN }]));
  /** the book x range of a puppet's feet */
  const feet = (name: string) => {
    const o = place[name], m = art[name].meta;
    return [o.x0! + m.feetX0 * o.scale!, o.x0! + m.feetX1 * o.scale!];
  };
  /** a puppet stands where the floor is under the middle of its feet */
  const footY = (name: string) => { const [a, b] = feet(name); return floorAt((a + b) / 2, place[name].hinge) - 0.002; };
  const tabTexture = standTab();
  const puppets = {} as Record<'harry' | 'kim', { group: Group; mesh: Mesh; lean: number; y: number; opts: StandOptions }>;
  for (const [name, o] of Object.entries(place)) {
    const material = paperMaterial(art[name].texture, 0.9);
    // a little of the lamp's light bouncing off the pages onto their fronts
    material.emissive.setRGB(0.06, 0.055, 0.045);
    material.emissiveMap = art[name].texture;
    const opts = { ...o, y: footY(name) };
    const { group: g, mesh } = standing(art[name], material, opts);
    mesh.name = name;
    group.add(g);
    puppets[name as 'harry' | 'kim'] = { group: g, mesh, lean: PUPPET_LEAN, y: mesh.position.y, opts };
    // the stand tab: the flap folded forward under the feet and glued to the floor
    const [a, b] = feet(name), bx0 = a - 4, bx1 = b + 4, by0 = o.hinge, by1 = o.hinge + 7;
    const tab = new Mesh(surfaceGrid(xSamples(bx0, bx1), ySamples(by0, by1, 3), (bx, by) => floorAt(bx, by) + 0.002, rectUV(bx0, bx1, by0, by1)),
      new MeshStandardMaterial({ map: tabTexture, roughness: 0.95, alphaToCoverage: true }));
    tab.receiveShadow = true;
    tab.name = `tab-${name}`;
    group.add(tab);
    const contact = standingContact(art[name], o, floorAt, { opacity: 0.92, behind: 12, front: 8 });
    contact.name = `contact-${name}`;
    group.add(contact);
  }

  // the ember of Harry's cigarette
  const h = place.harry, hm = art.harry.meta;
  const e = pointOnStanding({ ...h, svgX: hm.emberX, svgY: hm.emberY }, footY('harry'));
  const ember = new Sprite(new SpriteMaterial({ map: glowTexture('255,170,90'), color: new Color(1.4, 1.1, 0.9), blending: AdditiveBlending, depthWrite: false, transparent: true }));
  const n = leanNormal(PUPPET_LEAN);
  ember.position.set(e.x, e.y, e.z).addScaledVector(new Vector3(n.x, n.y, n.z), 0.01);
  ember.scale.setScalar(0.08); // a point of orange at the cigarette's tip, not a halo over the face
  group.add(ember);

  return { group, puppets, ember };
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
