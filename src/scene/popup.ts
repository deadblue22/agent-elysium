// The pop-up study rising from the far edge of the pages: five depths of cut paper,
// each a plane hinged on its own fold line (docs/design.md §6.1).
import { Group, MeshBasicMaterial, Vector3 } from 'three';
import type { Art } from '../assets';
import { BASE_Y, LEAN, paperMaterial, pointOnStanding, standing, type StandOptions } from './space';

/** Fold line (by) and the SVG y resting on it, per piece; back to front. */
export const LAYERS: Record<string, StandOptions> = {
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

/** Where the candle's light sits: its flame on the desk layer (SVG 770, 48), stood a little into the room. */
export function candleLightPosition(): Vector3 {
  const p = pointOnStanding({ ...LAYERS.desk, svgX: 770, svgY: 48 }, LAYER_Y);
  return new Vector3(p.x, p.y, p.z).addScaledVector(NORMAL, 0.3);
}

/** The flame sprite: on the paper, over the drawn wick. */
export function candleFlamePosition(): Vector3 {
  const p = pointOnStanding({ ...LAYERS.desk, svgX: 770, svgY: 48 }, LAYER_Y);
  return new Vector3(p.x, p.y, p.z).addScaledVector(NORMAL, 0.02);
}

/** Just inside the window hole of the wall (SVG 485, 200), between the wall and the furniture. */
export function windowGlowPosition(): Vector3 {
  const p = pointOnStanding({ ...LAYERS.wall, svgX: 485, svgY: 215 }, LAYER_Y);
  return new Vector3(p.x, p.y, p.z).addScaledVector(NORMAL, 0.24);
}

export function createPopup(art: Art) {
  const group = new Group();
  group.name = 'popup';
  for (const [name, o] of Object.entries(LAYERS)) {
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
