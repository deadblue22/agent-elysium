// The pop-up study standing on the base page: five depths of cut paper, each a plane
// hinged on its own fold line (docs/design.md §6.1). Fold lines are the M0 board's, offset
// by the floor sheet's `fold` (tools/extract-art.mjs FOLD), where the wall stands.
import { Group, MeshBasicMaterial, Vector3 } from 'three';
import type { Art } from '../assets';
import { BASE_Y, LEAN, paperMaterial, pointOnStanding, standing, type StandOptions } from './space';

/** Fold line (by, relative to the wall's fold) and the SVG y resting on it, per piece; back to front. */
const LAYERS: Record<string, StandOptions> = {
  far: { hinge: -22, baseY: 400 },         // outside the window: sky, roofs, fire escape (self-lit)
  wall: { hinge: 0, baseY: 440 },          // back wall, scalloped top edge, window hole
  furniture: { hinge: 26, baseY: 430 },    // shelf, casements, fireplace, clock, radiator
  desk: { hinge: 62, baseY: 250 },         // desk, the victim, the candle
  'front-chair': { hinge: 100, baseY: 330 },
  'front-right': { hinge: 100, baseY: 330 },
};

/** The layers stand on the floor sheet of the base page. */
export const LAYER_Y = BASE_Y + 0.003;

const NORMAL = new Vector3(0, Math.sin(LEAN), Math.cos(LEAN)); // normal of every standing plane

/** The pieces' placements with the pop-up standing on its fold. */
export function layers(fold: number): Record<string, StandOptions> {
  return Object.fromEntries(Object.entries(LAYERS).map(([k, o]) => [k, { ...o, hinge: o.hinge + fold }]));
}

/** Light positions in the room: the candle (its flame on the desk layer at SVG 770, 48), the window. */
export function roomLights(fold: number) {
  const L = layers(fold);
  const flame = pointOnStanding({ ...L.desk, svgX: 770, svgY: 48 }, LAYER_Y);
  const win = pointOnStanding({ ...L.wall, svgX: 485, svgY: 215 }, LAYER_Y);
  return {
    /** the candle's light, stood a little into the room so it reaches the desk's front */
    candleLight: new Vector3(flame.x, flame.y, flame.z).addScaledVector(NORMAL, 0.3),
    /** the flame sprite, on the paper over the drawn wick */
    candleFlame: new Vector3(flame.x, flame.y, flame.z).addScaledVector(NORMAL, 0.02),
    /** just inside the wall's window hole, between the wall and the furniture */
    windowGlow: new Vector3(win.x, win.y, win.z).addScaledVector(NORMAL, 0.24),
  };
}

export function createPopup(art: Art, fold: number) {
  const group = new Group();
  group.name = 'popup';
  for (const [name, o] of Object.entries(layers(fold))) {
    const piece = art[name];
    const material = name === 'far'
      ? new MeshBasicMaterial({ map: piece.texture, alphaToCoverage: true, color: '#d8dde0' })
      : paperMaterial(piece.texture);
    const { group: g, mesh } = standing(piece, material, { ...o, y: LAYER_Y });
    mesh.name = name;
    if (name === 'far') mesh.receiveShadow = false;
    group.add(g);
  }
  return { group };
}
