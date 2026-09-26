// What lies on the table to the right of the book (world units; the table is y = 0, the
// book's right board ends at x = 6.85, +z toward the reader): the leads found, filed in a
// small stack of index cards furthest back; the four morale hearts in a row; the two dice in
// front, nearest the reader's hand.
export const TABLE = {
  /** The leads' stack: its middle, and each card's turn about the vertical (degrees). */
  leads: { x: 8.25, z: -0.5, turns: [-6, 3, -2] },
  /** The hearts: the first one's middle, the step between them, their depth. */
  hearts: { x: 7.45, step: 0.47, z: 0.85 },
  /** The dice's rest spots and turns (degrees). */
  dice: [{ x: 7.75, z: 2.05, rot: -17 }, { x: 8.62, z: 2.45, rot: 26 }],
};
