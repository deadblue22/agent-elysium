// The pop-up study standing on the base page: five rows of cut paper, each a plane hinged on
// its own fold line (docs/design.md §6.1), spread across the floor so the floor and the rows'
// shadows show between them. The row depths come with the floor sheet (tools/extract-art.mjs
// FOLD and ROWS); the wall leans back most, rows nearer the reader stand more upright.
import { Group, MeshBasicMaterial, Vector3, type Mesh } from 'three';
import type { Art } from '../assets';
import { standingContact } from './paper';
import { BASE_Y, baseY, envelope, leanNormal, lift, paperMaterial, pointOnStanding, standing, type StandOptions } from './space';

type Row = 'wall' | 'furniture' | 'desk' | 'frontLeft' | 'front';
/**
 * Per piece: its row, fold offset within the row, the SVG y on the fold, its lean (degrees),
 * and optionally a scale about its own centre (cx, board px).
 */
const PIECES: Record<string, { row: Row; offset: number; baseY: number; lean: number; scale?: number; cx?: number }> = {
  far: { row: 'wall', offset: -22, baseY: 400, lean: 18 },      // outside the window: sky, roofs, fire escape (self-lit)
  wall: { row: 'wall', offset: 0, baseY: 440, lean: 18 },       // back wall, scalloped top edge, window hole
  furniture: { row: 'furniture', offset: 0, baseY: 430, lean: 15 }, // shelf, casements, fireplace, clock, radiator
  desk: { row: 'desk', offset: 0, baseY: 250, lean: 12 },       // desk, the victim, the candle
  // the armchair back, 1.25x the M0 size (a chair back about 1.3x the desk's height), framing the left
  // (it stands close behind the left sheet's tear, which leaves the log a tall window)
  'front-chair': { row: 'frontLeft', offset: 0, baseY: 330, lean: 10, scale: 1.25, cx: 180 },
  'front-right': { row: 'front', offset: 0, baseY: 330, lean: 10 },
};

/** The layers stand on the floor sheet of the base page. */
export const LAYER_Y = BASE_Y + 0.003;

/** Placements of every piece, from the floor sheet's metadata (fold and row depths, book px). */
export function layers(floor: Record<string, number>): Record<string, StandOptions> {
  const rowAt: Record<Row, number> = { wall: 0, furniture: floor.rowFurniture, desk: floor.rowDesk, frontLeft: floor.rowFrontLeft, front: floor.rowFront };
  return Object.fromEntries(Object.entries(PIECES).map(([k, p]) => {
    const hinge = floor.fold + rowAt[p.row] + p.offset;
    // each card rests on the page along its fold line, bridging the gutter valley
    const o: StandOptions = { hinge, baseY: p.baseY, lean: p.lean, rest: (bx) => envelope(bx, hinge) };
    if (p.scale && p.cx !== undefined) Object.assign(o, { scale: p.scale, x0: p.cx - (p.cx - 0) * p.scale });
    return [k, o];
  }));
}

const along = (v: { x: number; y: number; z: number }, lean: number | undefined, d: number) => {
  const n = leanNormal(lean);
  return new Vector3(v.x, v.y, v.z).add(new Vector3(n.x, n.y, n.z).multiplyScalar(d));
};

/** Light positions in the room: the candle (its flame on the desk layer at SVG 770, 48), the window. */
export function roomLights(floor: Record<string, number>) {
  const L = layers(floor);
  const flame = pointOnStanding({ ...L.desk, svgX: 770, svgY: 48 }, LAYER_Y);
  const win = pointOnStanding({ ...L.wall, svgX: 485, svgY: 215 }, LAYER_Y);
  return {
    /** the candle's light, stood a little into the room so it reaches the desk's front */
    candleLight: along(flame, L.desk.lean, 0.3),
    /** the flame sprite, on the paper over the drawn wick */
    candleFlame: along(flame, L.desk.lean, 0.02),
    /** just inside the wall's window hole, between the wall and the furniture */
    windowGlow: along(win, L.wall.lean, 0.24),
  };
}

export interface PieceHandle { group: Group; mesh: Mesh; opts: StandOptions }

export function createPopup(art: Art) {
  const group = new Group();
  group.name = 'popup';
  const pieces: Record<string, PieceHandle> = {};
  for (const [name, o] of Object.entries(layers(art.floor.meta))) {
    const piece = art[name];
    const material = name === 'far'
      ? new MeshBasicMaterial({ map: piece.texture, alphaToCoverage: true, color: '#d8dde0' })
      : paperMaterial(piece.texture);
    const opts = { ...o, y: LAYER_Y };
    const { group: g, mesh } = standing(piece, material, opts);
    mesh.name = name;
    if (name === 'far') mesh.receiveShadow = false;
    group.add(g);
    pieces[name] = { group: g, mesh, opts };
    if (name === 'far') continue; // stands behind the wall
    // baked contact occlusion on the floor where the card meets it
    const contact = standingContact(piece, o, (bx, by) => baseY(bx, by) + 0.003, {
      opacity: 0.95, behind: 22, front: 18, gap: (bx) => envelope(bx, o.hinge) - lift(bx, o.hinge),
    });
    contact.name = `contact-${name}`;
    group.add(contact);
  }
  return { group, pieces };
}
