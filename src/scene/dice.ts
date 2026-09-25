// The roll (§5.3): the two paper dice on the right page jump, tumble for about 0.8 s and
// settle on their rest spots showing the rolled faces. The tumble is one tween named 'dice'
// (a test harness can freeze time in the middle of it).
import { Euler, Quaternion, Vector3, type MeshBasicMaterial } from 'three';
import { ease, type Clock } from '../play/clock';
import { mulberry32 } from './snow';
import type { DieRig } from './puppets';

const AXES: [Vector3, number][] = [
  [new Vector3(0, 0, 1), 1], [new Vector3(0, 0, 1), -1],  // faces +x, -x: a quarter turn about z brings them up
  [new Vector3(1, 0, 0), 0], [new Vector3(1, 0, 0), 2],   // +y is up already; -y: half a turn about x
  [new Vector3(1, 0, 0), -1], [new Vector3(1, 0, 0), 1],  // +z, -z: turn about x
];

/** The orientation that puts `value` on top, then turns the die by its yaw. */
function faceUp(rig: DieRig, value: number): Quaternion {
  const i = rig.faces.indexOf(value);
  const [axis, quarter] = AXES[Math.max(0, i)];
  const up = new Quaternion().setFromAxisAngle(axis, (quarter * Math.PI) / 2);
  const yaw = new Quaternion().setFromEuler(new Euler(0, rig.yaw, 0));
  return yaw.multiply(up);
}

export function createDice(dice: DieRig[], clock: Clock) {
  const size = dice[0].mesh.geometry.boundingBox?.max.x ?? 0.2;
  // the committed frame shows 4 and 5
  dice.forEach((d, k) => d.mesh.quaternion.copy(faceUp(d, [4, 5][k])));
  let seq = 0;
  return {
    /** Tumbles both dice onto `values`. */
    async roll(values: [number, number]) {
      const R = mulberry32(values[0] * 7 + values[1] * 13 + ++seq * 101);
      const plans = dice.map((d, k) => {
        const end = faceUp(d, values[k]);
        const axis = new Vector3(R() - 0.5, R() * 0.3, R() - 0.5).normalize();
        return {
          d, end, axis,
          spin: Math.PI * 2 * (1.5 + R()),                                  // turns while in the air
          from: new Vector3(0.9 + 0.3 * R(), 0, -0.35 - 0.3 * R()),        // they come in from the upper right
          hop: 0.55 + 0.2 * R(),
          delay: k * 0.08,
        };
      });
      const q = new Quaternion();
      // the soft contact shadow under a die goes while it is in the air
      const contact = (d: DieRig, y: number) => {
        if (!d.contact) return;
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
          p.d.mesh.position.set(p.d.rest.x + p.from.x * slide, p.d.rest.y + y + size * 0.02, p.d.rest.z + p.from.z * slide);
          contact(p.d, y + Math.hypot(p.from.x, p.from.z) * slide * 0.3);
          q.setFromAxisAngle(p.axis, p.spin * (1 - ease.out(u)));
          p.d.mesh.quaternion.copy(p.end).premultiply(q);
        }
      }, ease.linear, 'dice');
      for (const p of plans) { p.d.mesh.position.copy(p.d.rest); p.d.mesh.quaternion.copy(p.end); contact(p.d, 0); }
    },
  };
}
