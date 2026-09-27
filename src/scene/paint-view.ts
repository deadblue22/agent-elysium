// ?paint: the view out of the window as an expressionist painting after Rostov's concept art of
// Revachol (docs/paint.md): a winter-morning sky of palette-knife slabs, teal and violet over
// an orange horizon with a low sun; a harbour city of blocky buildings with small warm
// windows, a crane, a strip of dark water; in front, the iron railing of the fire escape.
// Drawn once at startup into canvases the size of the baked far.webp and far-snow.webp, which
// they replace, so the popup, the hover tips and the cues use them unchanged. The snow (roof
// caps, the crane's jib, the rails) is on the second canvas, so the flashback can take it away
// as it does the baked snow. The window shows about canvas y 60..470 of it.
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Art } from '../assets';
import { mulberry32 } from './snow';

type RGB = [number, number, number];

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB, k = 1) => `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v * k)))).join(',')})`;

/** The sky from the top of the canvas down to the horizon (canvas y 0..HORIZON). */
const SKY: [number, RGB][] = [
  [0, [34, 40, 82]], [0.22, [58, 58, 112]], [0.42, [44, 112, 122]], [0.62, [118, 170, 160]],
  [0.78, [226, 188, 138]], [0.9, [232, 142, 78]], [1, [240, 206, 150]],
];
const HORIZON = 405;
/** The fire escape's top rail, canvas y; the water runs from the city down to it. */
const RAIL = 436;

const skyAt = (y: number): RGB => {
  const t = Math.max(0, Math.min(1, y / HORIZON));
  for (let i = 1; i < SKY.length; i++) {
    if (t <= SKY[i][0]) return mix(SKY[i - 1][1], SKY[i][1], (t - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]));
  }
  return SKY[SKY.length - 1][1];
};

/**
 * A slab of paint laid with a knife: a straight leading edge, a ragged trailing one, a lighter
 * ridge where the knife lifted and a few scratches along the drag.
 */
function slab(x: CanvasRenderingContext2D, R: () => number, cx: number, cy: number, len: number, wid: number, ang: number, c: RGB, alpha = 1) {
  const l = len / 2, w = wid / 2;
  x.save();
  x.translate(cx, cy);
  x.rotate(ang);
  x.globalAlpha = alpha;
  x.fillStyle = css(c);
  x.beginPath();
  x.moveTo(-l, -w);
  x.lineTo(l, -w + (R() - 0.5) * w * 0.4);
  x.lineTo(l + (R() - 0.3) * w * 1.2, w);
  for (let i = 5; i >= 0; i--) x.lineTo(-l + (len * i) / 5, w + (R() - 0.5) * w * 0.6);
  x.closePath();
  x.fill();
  x.globalAlpha = alpha * 0.55;
  x.strokeStyle = css(mix(c, [255, 250, 235], 0.35));
  x.lineWidth = Math.max(1.2, wid * 0.09);
  x.beginPath();
  x.moveTo(-l, -w + x.lineWidth / 2);
  x.lineTo(l, -w + x.lineWidth / 2);
  x.stroke();
  x.globalAlpha = alpha * 0.3;
  x.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const y = -w + R() * wid;
    x.strokeStyle = css(c, R() < 0.5 ? 0.82 : 1.15);
    x.beginPath();
    x.moveTo(-l + R() * l * 0.5, y);
    x.lineTo(l - R() * l * 0.5, y + (R() - 0.5) * 2);
    x.stroke();
  }
  x.restore();
}

function paintSky(x: CanvasRenderingContext2D, R: () => number, W: number) {
  const g = x.createLinearGradient(0, 0, 0, HORIZON);
  for (const [t, c] of SKY) g.addColorStop(t, css(c));
  x.fillStyle = g;
  x.fillRect(0, 0, W, HORIZON + 20);
  // the low sun, left of centre, and the glow round it
  const sun = { x: W * 0.3, y: HORIZON - 70 };
  // knife slabs: the sky's own colour at their height, now and then a complementary one; they
  // run in a wind from lower left to upper right
  for (let i = 0; i < 260; i++) {
    const y = R() * (HORIZON + 10), cx = R() * (W + 120) - 60;
    let c = skyAt(y + (R() - 0.5) * 70);
    const k = R();
    if (k < 0.12) c = y < HORIZON * 0.6 ? [214, 124, 66] : [96, 76, 138]; // orange among the teal, violet among the orange
    else if (k < 0.3) c = mix(c, [240, 228, 204], 0.55); // cream cloud slabs
    else if (k < 0.4) c = mix(c, [40, 36, 78], 0.35); // violet shadow under the clouds
    const len = 50 + R() * 150, wid = 10 + R() * 26;
    slab(x, R, cx, y, len, wid, -0.28 + (R() - 0.5) * 0.4, c, 0.85 + R() * 0.15);
  }
  for (let i = 0; i < 26; i++) {
    const a = R() * Math.PI * 2, d = R() * 70;
    slab(x, R, sun.x + Math.cos(a) * d * 1.4, sun.y + Math.sin(a) * d * 0.6, 30 + R() * 60, 8 + R() * 14, -0.2 + (R() - 0.5) * 0.5,
      mix([255, 236, 170], [236, 150, 80], d / 70), 0.9);
  }
}

/** The harbour city on the horizon: blocky buildings, small warm windows, a crane; then the water. */
function paintCity(x: CanvasRenderingContext2D, s: CanvasRenderingContext2D, R: () => number, W: number) {
  const base = HORIZON + 8;
  // the far row lighter and bluer (haze), the near row darker and warmer
  for (const [row, top, dark] of [[0, 300, 0.62], [1, 330, 0.42]] as const) {
    let bx = -20 - R() * 30;
    while (bx < W + 20) {
      const bw = 26 + R() * 70, bh = base - top - R() * 70 + row * 20;
      const y0 = base - bh;
      const wall: RGB = row === 0 ? mix([92, 104, 138], [120, 108, 140], R()) : mix([46, 58, 74], [70, 56, 76], R());
      const lit = mix(wall, [226, 160, 104], 0.28); // the sun side, on the left
      x.fillStyle = css(wall, dark / 0.5);
      const gable = R() < 0.35, chimney = R() < 0.4, apex = y0 - 14 - R() * 16;
      x.beginPath();
      x.moveTo(bx, base);
      x.lineTo(bx, y0);
      if (gable) x.lineTo(bx + bw / 2, apex);
      x.lineTo(bx + bw, y0);
      x.lineTo(bx + bw, base);
      x.fill();
      if (chimney) x.fillRect(bx + bw * (0.2 + R() * 0.5), y0 - 16, 6, 18);
      // knife strokes down the walls, the sunlit side warmer
      for (let k = 0; k < 3; k++) slab(x, R, bx + bw * (0.15 + R() * 0.7), y0 + bh * 0.5, bh * 0.9, 6 + R() * 8, Math.PI / 2 + (R() - 0.5) * 0.1, k === 0 ? lit : wall, 0.5);
      // windows: a few lit, warm; big enough to come through the painting as specks
      for (let wy = y0 + 8; wy < base - 10; wy += 15) {
        for (let wx = bx + 5; wx < bx + bw - 8; wx += 13) {
          if (R() < 0.28) {
            x.fillStyle = css(R() < 0.6 ? [255, 214, 120] : [250, 150, 70]);
            x.fillRect(wx, wy, 7, 9);
          }
        }
      }
      // snow on the roof: the second canvas
      s.strokeStyle = css([222, 218, 240]);
      s.lineWidth = 5;
      s.lineCap = 'round';
      s.beginPath();
      s.moveTo(bx - 1, y0 - 1);
      if (gable) s.lineTo(bx + bw / 2, apex - 1);
      s.lineTo(bx + bw + 1, y0 - 1);
      s.stroke();
      bx += bw + R() * 8 - 4;
    }
  }
  // a harbour crane on the right: mast, jib and cable
  x.strokeStyle = css([28, 30, 40]);
  x.lineWidth = 5;
  x.beginPath();
  x.moveTo(W * 0.74, base);
  x.lineTo(W * 0.74, 215);
  x.lineTo(W * 0.97, 228);
  x.moveTo(W * 0.74, 228);
  x.lineTo(W * 0.6, 240);
  x.stroke();
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(W * 0.91, 228);
  x.lineTo(W * 0.91, 320);
  x.moveTo(W * 0.74, 215);
  x.lineTo(W * 0.64, 240);
  x.moveTo(W * 0.74, 215);
  x.lineTo(W * 0.88, 228);
  x.stroke();
  s.strokeStyle = css([222, 218, 240]);
  s.lineWidth = 3;
  s.beginPath();
  s.moveTo(W * 0.74, 212);
  s.lineTo(W * 0.97, 225);
  s.stroke();
  // the water: dark teal, the sun and the windows in it as orange streaks
  x.fillStyle = css([18, 32, 42]);
  x.fillRect(0, base, W, RAIL - base + 8);
  for (let i = 0; i < 34; i++) {
    const near = R() < 0.35;
    slab(x, R, R() * W, base + 3 + R() * (RAIL - base), 20 + R() * 70, 3 + R() * 4, (R() - 0.5) * 0.08,
      near ? [236, 150, 74] : mix([34, 64, 76], [60, 96, 104], R()), near ? 0.85 : 0.7);
  }
}

/** In front: the fire escape outside the window, its iron railing and grated floor. */
function paintRailing(x: CanvasRenderingContext2D, s: CanvasRenderingContext2D, R: () => number, W: number, H: number) {
  const iron: RGB = [24, 24, 30];
  x.fillStyle = css([30, 30, 36]);
  x.fillRect(0, RAIL + 34, W, H - RAIL - 34);
  // the grating, a few cold glints of the sky on the iron
  for (let i = 0; i < 30; i++) slab(x, R, R() * W, RAIL + 40 + R() * (H - RAIL - 40), 30 + R() * 60, 4 + R() * 6, (R() - 0.5) * 0.1, R() < 0.5 ? [52, 62, 72] : [40, 36, 40], 0.7);
  x.fillStyle = css(iron);
  x.fillRect(0, RAIL, W, 9);
  x.fillRect(0, RAIL + 26, W, 8);
  for (let rx = 6; rx < W; rx += 19) x.fillRect(rx, RAIL, 4, 34);
  // the ladder down, on the right
  x.save();
  x.translate(W * 0.82, RAIL + 30);
  x.rotate(-0.45);
  x.fillRect(0, 0, 6, 200);
  x.fillRect(26, 0, 6, 200);
  for (let ry = 10; ry < 200; ry += 18) x.fillRect(0, ry, 32, 4);
  x.restore();
  s.fillStyle = css([232, 228, 246]);
  s.fillRect(0, RAIL - 5, W, 6);
  s.fillRect(0, RAIL + 22, W, 5);
  s.fillRect(0, RAIL + 34, W, 7);
}

/** Replaces the baked view out of the window and its snow with the painted ones. */
export function paintWindowView(art: Art, anisotropy: number) {
  const far = art.far, snow = art['far-snow'];
  if (!far || !snow) return;
  const [W, H] = far.px;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  };
  const view = make(), cover = make();
  const x = view.getContext('2d')!, s = cover.getContext('2d')!;
  const R = mulberry32(1976);
  paintSky(x, R, W);
  paintCity(x, s, R, W);
  paintRailing(x, s, R, W, H);
  for (const [piece, canvas] of [[far, view], [snow, cover]] as const) {
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = anisotropy;
    t.name = piece.texture.name;
    piece.texture.dispose();
    piece.texture = t;
  }
}
