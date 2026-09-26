// The camera: a lens-shifted pinhole looking down at the book from the front, about as a
// reader sitting at the table sees it (the reference pop-up book's angle). The long lens keeps
// the text on the page even in size from the top of the log to the bottom, while the pop-up
// stands up and shows its rows. The whole book is in frame with the table around it; the
// book sits a little left of centre, so the table on its right holds the dice, the hearts and
// the leads. The optical axis passes through the middle of the book's near edge, at frame
// point (bookX, nearEdgeY); the view offset shows the 1600 x 900 frame around it. Parallax
// orbits a rig around the middle of the book.
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { BASE_Y, BOOK_H, DEG, wz } from './space';

export const FRAME = { w: 1600, h: 900 };
export const VIEW = {
  elevation: 58,       // view direction below the horizon, degrees
  focal: 2600,         // focal length in frame px
  nearEdgeY: 858,      // frame row of the book's near edge; a strip of table shows below it
  nearEdgeWidth: 1190, // frame px spanned by the 13.76-unit cover at the near edge
  bookX: 736,          // frame column of the book's middle
  yaw: 3,              // parallax range, degrees
  pitch: 1.4,
};

export function createCameraRig() {
  const e = VIEW.elevation * DEG, f = VIEW.focal, px = VIEW.bookX, py = VIEW.nearEdgeY;
  const fullW = 2 * Math.max(px, FRAME.w - px), fullH = 2 * Math.max(py, FRAME.h - py);
  const camera = new PerspectiveCamera((2 * Math.atan(fullH / 2 / f)) / DEG, fullW / fullH, 1, 120);
  camera.setViewOffset(fullW, fullH, fullW / 2 - px, fullH / 2 - py, FRAME.w, FRAME.h);

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
    /** Frame-space pinhole of the resting camera and its distance to the near edge. */
    lens: { focal: f, principal: { x: px, y: py }, distance },
    /** nx, ny in -1..1 across the frame. */
    setPointer(nx: number, ny: number) { tx = nx; ty = ny; },
    /** Jumps to where the pointer asks (a test harness, which cannot wait for the easing). */
    snap() { cx = tx; cy = ty; rig.rotation.set(-cy * VIEW.pitch * DEG, -cx * VIEW.yaw * DEG, 0, 'YXZ'); rig.updateMatrixWorld(true); },
    /** Eases toward the pointer; returns true while still moving. */
    update(dt: number): boolean {
      const k = 1 - Math.exp(-dt * 3.5);
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      rig.rotation.set(-cy * VIEW.pitch * DEG, -cx * VIEW.yaw * DEG, 0, 'YXZ');
      return Math.abs(tx - cx) + Math.abs(ty - cy) > 1e-4;
    },
  };
}
