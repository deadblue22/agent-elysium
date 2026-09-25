// The camera reproduces the M0 board's projection: a 1600 x 900 frame seen from 3200 px
// with the eye above frame point (800, 100), the pages tilted 22 degrees from the frame.
// That is a lens-shifted perspective camera: a symmetric frustum 1600 px tall around the
// principal point, of which the view offset shows rows 700..1600. Parallax orbits a rig
// around the middle of the book by a few degrees.
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { DEG, PAGE_BASE } from './space';

export const FRAME = { w: 1600, h: 900 };
export const VIEW = {
  distance: 32,       // 3200 px, 100 px per unit
  tilt: 22,           // pages tilted away from the frame (M0 --theta)
  principal: { x: 800, y: 100 },
  nearEdgeY: 888,     // frame y of the book's near edge (M0: top 288 + height 600)
  yaw: 2.6,           // parallax range, degrees
  pitch: 1.3,
};

export function createCameraRig() {
  const D = VIEW.distance, t = VIEW.tilt * DEG;
  const camera = new PerspectiveCamera((2 * Math.atan(800 / 3200)) / DEG, 1, 4, 90);
  camera.setViewOffset(1600, 1600, 0, 800 - VIEW.principal.y, FRAME.w, FRAME.h);

  const fwd = new Vector3(0, -Math.cos(t), -Math.sin(t));
  const up = new Vector3(0, Math.sin(t), -Math.cos(t));
  // the near edge's centre sits (nearEdgeY - principal.y) px below the principal point, D ahead
  const nearEdge = new Vector3(0, PAGE_BASE, 3);
  const eye = nearEdge.clone()
    .addScaledVector(fwd, -D)
    .addScaledVector(up, (VIEW.nearEdgeY - VIEW.principal.y) / 100);

  const pivot = new Vector3(0, PAGE_BASE, 0);
  const rig = new Group();
  rig.name = 'camera-rig';
  rig.position.copy(pivot);
  rig.add(camera);
  camera.position.copy(eye).sub(pivot);
  camera.up.copy(up);
  camera.lookAt(eye.clone().add(fwd));
  rig.updateMatrixWorld(true);

  let tx = 0, ty = 0, cx = 0, cy = 0;
  return {
    camera, rig, eye,
    /** nx, ny in -1..1 across the frame. */
    setPointer(nx: number, ny: number) { tx = nx; ty = ny; },
    /** Eases toward the pointer; returns true while still moving. */
    update(dt: number): boolean {
      const k = 1 - Math.exp(-dt * 3.5);
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      rig.rotation.set(-cy * VIEW.pitch * DEG, -cx * VIEW.yaw * DEG, 0, 'YXZ');
      return Math.abs(tx - cx) + Math.abs(ty - cy) > 1e-4;
    },
  };
}
