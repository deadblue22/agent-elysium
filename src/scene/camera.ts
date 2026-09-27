// The camera: a pinhole looking down at the book from the front, as a reader sitting at the
// table sees it. Each view in VIEWS is set by what the frame shows: how steeply the camera
// looks down, its focal length, where the optical axis crosses the frame (the lens shift),
// and where and how wide the book's near edge shows; the eye's position follows from these.
// The book sits a little left of centre, so the table on its right holds the dice, the
// hearts and the leads. Parallax orbits a rig around the middle of the book.
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { BASE_Y, BOOK_H, DEG, wz } from './space';

export const FRAME = { w: 1600, h: 900 };

export interface View {
  /** The optical axis below the horizon, degrees. */
  elevation: number;
  /** Focal length, frame px. */
  focal: number;
  /** Frame row the optical axis passes through (the lens shift); its column is bookX. */
  axisY: number;
  /** Frame row of the book's near edge, at its middle; the table shows below it. */
  nearEdgeY: number;
  /** Frame px spanned by the 13.76-unit cover at the near edge (sets the distance). */
  nearEdgeWidth: number;
  /** Frame column of the book's middle. */
  bookX: number;
  /**
   * The log's glyphs are drawn this much taller than wide (src/main.ts): the camera sees the
   * left page at a slant, which squashes them; drawn taller, they show at about 0.9 of their
   * width, close to their true shape.
   */
  ink: number;
  /** Which way the table's boards run: 'x' left to right, 'z' away from the reader. */
  boards: 'x' | 'z';
}

/**
 * The candidate framings (docs/view.md), picked with ?view=N. 1 world unit is about 3 cm; the
 * eye's height and distance are measured from the table and the book's middle. Views 1-3 put
 * the optical axis through the middle of the frame, show the table in front of the book and
 * turn the boards to run away from the reader, so the table recedes with the book.
 */
export const VIEWS: readonly View[] = [
  // 0: the earlier framing: a long lens aimed at the near edge, which sits at the frame's
  // bottom; the eye 78 cm above the table, 96 cm from the book, 52 degrees over it
  { elevation: 58, focal: 2600, axisY: 858, nearEdgeY: 858, nearEdgeWidth: 1190, bookX: 736, ink: 1.1, boards: 'x' },
  // 1: about the same angle from closer: 66 cm up, 84 cm away, 50 degrees
  { elevation: 48, focal: 2200, axisY: 450, nearEdgeY: 788, nearEdgeWidth: 1190, bookX: 736, ink: 1.15, boards: 'z' },
  // 2: a reader sitting at the table: 47 cm up, 64 cm away, 45 degrees
  { elevation: 42, focal: 1700, axisY: 450, nearEdgeY: 770, nearEdgeWidth: 1250, bookX: 736, ink: 1.21, boards: 'z' },
  // 3: leaning in: 36 cm up, 54 cm away, 41 degrees; the most table in front, the strongest perspective
  { elevation: 38, focal: 1450, axisY: 450, nearEdgeY: 752, nearEdgeWidth: 1325, bookX: 736, ink: 1.285, boards: 'z' },
];
/** The view shown without ?view=. */
export const DEFAULT_VIEW = 2;

/** The view ?view=N asks for, or the default. */
export function pickView(q: string | null): View {
  const n = q === null || q.trim() === '' ? NaN : Number(q);
  return VIEWS[Number.isInteger(n) && n >= 0 && n < VIEWS.length ? n : DEFAULT_VIEW];
}

/** Parallax range, degrees. */
const PARALLAX = { yaw: 3, pitch: 1.4 };

export function createCameraRig(view: View) {
  const e = view.elevation * DEG, f = view.focal, px = view.bookX, py = view.axisY;
  const fullW = 2 * Math.max(px, FRAME.w - px), fullH = 2 * Math.max(py, FRAME.h - py);
  const camera = new PerspectiveCamera((2 * Math.atan(fullH / 2 / f)) / DEG, fullW / fullH, 1, 120);
  camera.setViewOffset(fullW, fullH, fullW / 2 - px, fullH / 2 - py, FRAME.w, FRAME.h);

  const fwd = new Vector3(0, -Math.sin(e), -Math.cos(e));
  const up = new Vector3(0, Math.cos(e), -Math.sin(e));
  // the near edge's middle shows (nearEdgeY - axisY) px below the axis, along this ray; its
  // depth along the axis follows from how wide the cover shows there
  const below = Math.atan((view.nearEdgeY - py) / f);
  const ray = new Vector3(0, -Math.sin(e + below), -Math.cos(e + below));
  const depth = (f * 13.76) / view.nearEdgeWidth;
  const nearEdge = new Vector3(0, BASE_Y, wz(BOOK_H));
  const eye = nearEdge.clone().addScaledVector(ray, -depth / Math.cos(below));

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
  const pose = () => rig.rotation.set(-cy * PARALLAX.pitch * DEG, -cx * PARALLAX.yaw * DEG, 0, 'YXZ');
  return {
    camera, rig, eye,
    /** Frame-space pinhole of the resting camera. */
    lens: { focal: f, principal: { x: px, y: py } },
    /** nx, ny in -1..1 across the frame. */
    setPointer(nx: number, ny: number) { tx = nx; ty = ny; },
    /** Jumps to where the pointer asks (a test harness, which cannot wait for the easing). */
    snap() { cx = tx; cy = ty; pose(); rig.updateMatrixWorld(true); },
    /** Eases toward the pointer; returns true while still moving. */
    update(dt: number): boolean {
      const k = 1 - Math.exp(-dt * 3.5);
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      pose();
      return Math.abs(tx - cx) + Math.abs(ty - cy) > 1e-4;
    },
  };
}
