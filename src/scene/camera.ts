// The camera: a lens-shifted pinhole looking at the book from the front and above, like
// the reference pop-up book (lower than the M0 board's near top-down 68 degrees, so the
// wall stands tall and the pages recede). The optical axis passes through the middle of
// the book's near edge, which sits at frame row `nearEdgeY`; the view offset shows the
// 1600 x 900 frame above it. Parallax orbits a rig around the middle of the book.
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { BASE_Y, BOOK_H, DEG, wz } from './space';

export const FRAME = { w: 1600, h: 900 };
export const VIEW = {
  elevation: 44,      // view direction below the horizon, degrees (M0: 68)
  focal: 2200,        // focal length in frame px (M0: 3200)
  nearEdgeY: 866,     // frame row of the book's near edge; the stack and cover show below it
  nearEdgeWidth: 1540, // frame px spanned by the 13.76-unit cover at the near edge
  yaw: 2.4,           // parallax range, degrees
  pitch: 1.2,
};

export function createCameraRig() {
  const e = VIEW.elevation * DEG, f = VIEW.focal, py = VIEW.nearEdgeY;
  const fullH = 2 * Math.max(py, FRAME.h - py);
  const camera = new PerspectiveCamera((2 * Math.atan(fullH / 2 / f)) / DEG, FRAME.w / fullH, 1, 90);
  camera.setViewOffset(FRAME.w, fullH, 0, fullH / 2 - py, FRAME.w, FRAME.h);

  const fwd = new Vector3(0, -Math.sin(e), -Math.cos(e));
  const up = new Vector3(0, Math.cos(e), -Math.sin(e));
  const distance = (f * 13.76) / VIEW.nearEdgeWidth;
  const nearEdge = new Vector3(0, BASE_Y, wz(BOOK_H));
  const eye = nearEdge.clone().addScaledVector(fwd, -distance);

  const pivot = new Vector3(0, BASE_Y, 0);
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
    /** Frame-space pinhole of the resting camera (for the snow). */
    lens: { focal: f, principal: { x: FRAME.w / 2, y: py } },
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
