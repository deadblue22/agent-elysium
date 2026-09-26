// The dice (§5.3): two paper dice lying on the table to the right of the book, below the
// hearts. A roll throws them in from the right: they tumble for about 0.8 s and settle on
// their rest spots showing the rolled faces. The tumble is one tween named 'dice' (a test
// harness can freeze time in the middle of it).
import { BoxGeometry, Euler, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3, type MeshBasicMaterial } from 'three';
import type { Art } from '../assets';
import { ease, type Clock } from '../play/clock';
import { contactSquare, decal } from './paper';
import { mulberry32 } from './snow';
import { DEG } from './space';
import { TABLE } from './tabletop';

/** Faces per die in BoxGeometry order: +x (right), -x (left), +y (top), -y (bottom), +z (near), -z (far). */
const FACES = [[1, 6, 4, 3, 2, 5], [6, 1, 5, 2, 3, 4]];
const DIE = 0.44;

const AXES: [Vector3, number][] = [
  [new Vector3(0, 0, 1), 1], [new Vector3(0, 0, 1), -1],  // faces +x, -x: a quarter turn about z brings them up
  [new Vector3(1, 0, 0), 0], [new Vector3(1, 0, 0), 2],   // +y is up already; -y: half a turn about x
  [new Vector3(1, 0, 0), -1], [new Vector3(1, 0, 0), 1],  // +z, -z: turn about x
];

/** A die at rest: its mesh, the values on its faces (+x, -x, +y, -y, +z, -z), its yaw and position. */
export interface DieRig { mesh: Mesh; faces: number[]; yaw: number; rest: Vector3; contact: Mesh }

/** The orientation that puts `value` on top, then turns the die by its yaw. */
function faceUp(rig: DieRig, value: number): Quaternion {
  const i = rig.faces.indexOf(value);
  const [axis, quarter] = AXES[Math.max(0, i)];
  const up = new Quaternion().setFromAxisAngle(axis, (quarter * Math.PI) / 2);
  const yaw = new Quaternion().setFromEuler(new Euler(0, rig.yaw, 0));
  return yaw.multiply(up);
}

export function createDice(art: Art, clock: Clock) {
  const group = new Group();
  group.name = 'dice';
  const atlas = art.dice.texture;
  const shadow = contactSquare();
  const dice: DieRig[] = TABLE.dice.map((spot, k) => {
    const mats = FACES[k].map((f) => {
      const t = atlas.clone();
      t.repeat.set(1 / 6, 1);
      t.offset.set((f - 1) / 6, 0);
      return new MeshStandardMaterial({ map: t, roughness: 0.85 });
    });
    const mesh = new Mesh(new BoxGeometry(DIE, DIE, DIE), mats);
    mesh.position.set(spot.x, DIE / 2, spot.z);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = 'die';
    // contact occlusion under the die (twice its footprint)
    const contact = decal(new PlaneGeometry(2 * DIE, 2 * DIE).rotateX(-Math.PI / 2), shadow, 0.8);
    contact.position.set(spot.x, 0.003, spot.z);
    contact.rotation.y = spot.rot * DEG;
    contact.name = 'contact-die';
    group.add(mesh, contact);
    return { mesh, faces: FACES[k], yaw: spot.rot * DEG, rest: mesh.position.clone(), contact };
  });
  // the committed frame shows 4 and 5
  dice.forEach((d, k) => d.mesh.quaternion.copy(faceUp(d, [4, 5][k])));

  let seq = 0;
  return {
    group,
    meshes: dice.map((d) => d.mesh),
    /** Tumbles both dice onto `values`. */
    async roll(values: [number, number]) {
      const R = mulberry32(values[0] * 7 + values[1] * 13 + ++seq * 101);
      const plans = dice.map((d, k) => {
        const end = faceUp(d, values[k]);
        const axis = new Vector3(R() - 0.5, R() * 0.3, R() - 0.5).normalize();
        return {
          d, end, axis,
          spin: Math.PI * 2 * (1.5 + R()),                                  // turns while in the air
          from: new Vector3(1.6 + 0.4 * R(), 0, -0.5 - 0.4 * R()),         // thrown in from the right
          hop: 0.6 + 0.2 * R(),
          delay: k * 0.08,
        };
      });
      const q = new Quaternion();
      // the soft contact shadow under a die goes while it is in the air
      const contact = (d: DieRig, y: number) => {
        const m = d.contact.material as MeshBasicMaterial;
        m.userData.opacity ??= m.opacity;
        m.opacity = m.userData.opacity * Math.max(0, 1 - y / 0.06);
      };
      await clock.tween(820, (t) => {
        for (const p of plans) {
          const u = Math.min(1, Math.max(0, (t - p.delay) / (1 - p.delay)));
          const slide = 1 - ease.out(u);
          // a high hop, then one small bounce
          const y = u < 0.72 ? p.hop * Math.sin((Math.PI * u) / 0.72) : 0.07 * Math.sin((Math.PI * (u - 0.72)) / 0.28);
          p.d.mesh.position.set(p.d.rest.x + p.from.x * slide, p.d.rest.y + y, p.d.rest.z + p.from.z * slide);
          p.d.contact.position.set(p.d.rest.x + p.from.x * slide, 0.003, p.d.rest.z + p.from.z * slide);
          contact(p.d, y);
          q.setFromAxisAngle(p.axis, p.spin * (1 - ease.out(u)));
          p.d.mesh.quaternion.copy(p.end).premultiply(q);
        }
      }, ease.linear, 'dice');
      for (const p of plans) {
        p.d.mesh.position.copy(p.d.rest);
        p.d.mesh.quaternion.copy(p.end);
        p.d.contact.position.set(p.d.rest.x, 0.003, p.d.rest.z);
        contact(p.d, 0);
      }
    },
  };
}
