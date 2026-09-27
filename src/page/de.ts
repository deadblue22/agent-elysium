// The original's dialogue panel, printed on the left page (?ui=de): a dark panel that bleeds
// off the page's outer and near edges and up into the tear (the tear cuts it, as if the panel
// had been printed before the page was torn), with a crisp edge toward the gutter; a film strip
// with frame codes down its outer edge; the scroll track with its knob down the gutter side;
// and the cyan CONTINUE bar with the red smear on its right end. The log's ink
// (src/page/layout.ts, look `de`) is printed on it. Everything is in page px; the painter maps
// it to its canvas.
import { INK_DE, PAGE, type Rect } from './layout';

/** The panel's edge toward the gutter (page px); it bleeds off the other three sides. */
const EDGE = 648;
/** The film strip down the outer edge, and the scroll track down the gutter side (page x). */
const STRIP = 15, TRACK = 617;

/** A small seeded PRNG (the same brush marks on every repaint). */
function prng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

/**
 * Paints the panel into `ctx` (already scaled to page px). `top`: the text window's top on the
 * page; the panel reaches `reach` px above it, into the tear. Painted once per canvas size; the
 * painter draws it under the ink.
 */
export function paintPanel(ctx: CanvasRenderingContext2D, top: number, reach = 60) {
  const rnd = prng(1937);
  const y0 = top - reach, y1 = PAGE.h;
  // the body: black, nearly opaque (the page's light lifts it to about the original's #141414
  // on screen), letting a little more of the paper through toward the tear, as the original's
  // panel lets the world through near its top
  const body = ctx.createLinearGradient(0, y0, 0, y1);
  body.addColorStop(0, 'rgba(4,3,3,.92)');
  body.addColorStop(0.3, 'rgba(3,3,2,.965)');
  body.addColorStop(1, 'rgba(2,2,2,.975)');
  ctx.fillStyle = body;
  ctx.fillRect(0, y0, EDGE, y1 - y0);
  // the brush's drag inside it: long, faint, darker streaks
  for (let i = 0; i < 180; i++) {
    const y = y0 + rnd() * (y1 - y0), x = rnd() * EDGE * 0.7, w = 60 + rnd() * 300;
    ctx.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.12})`;
    ctx.fillRect(x, y, Math.min(w, EDGE - 2 - x), 0.6 + rnd() * 1.4);
  }
  // the edge toward the gutter: a hairline, as the original's panel is edged
  ctx.fillStyle = 'rgba(206,200,188,.22)';
  ctx.fillRect(EDGE - 3, y0, 1, y1 - y0);
  // the film strip down the outer edge: a hairline, sprocket ticks, and the frame codes set
  // across it, faint, as along the original's panel
  ctx.fillStyle = 'rgba(214,208,196,.16)';
  ctx.fillRect(STRIP + 10, top + 20, 0.9, y1 - top - 44);
  for (let y = top + 26; y < y1 - 26; y += 13) ctx.fillRect(STRIP - 8, y, 3.2, 1.4);
  ctx.fillStyle = 'rgba(214,208,196,.3)';
  ctx.font = '500 9.5px "Barlow Condensed", "Inter", sans-serif';
  ctx.textBaseline = 'middle';
  ['01A16', '01A17', '01A18'].forEach((code, i) => {
    const cy = top + 96 + i * 168;
    if (cy > y1 - 50) return;
    ctx.save();
    ctx.translate(STRIP, cy);
    ctx.rotate(-Math.PI / 2);
    let cx = -15;
    for (const ch of code) { ctx.fillText(ch, cx, 0); cx += ctx.measureText(ch).width + 1.5; }
    ctx.restore();
    ctx.fillRect(STRIP - 3, cy - 30, 7, 1);
    ctx.fillRect(STRIP - 3, cy + 30, 7, 1);
  });
}

/**
 * The scroll track down the gutter side (layout px, drawn with the ink): a hairline with an
 * arrowhead at each end, and the white knob where the reader is in the history (at the bottom:
 * the newest line).
 */
export function paintTrack(ctx: CanvasRenderingContext2D, win: { y0: number; y1: number; fade: number }, scroll: number, max: number) {
  const x = TRACK, y0 = win.y0 + win.fade * 0.4, y1 = win.y1 + 2;
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(222,217,207,.34)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y0 + 3); ctx.lineTo(x, y1 - 3);
  ctx.moveTo(x - 3.2, y0 + 5); ctx.lineTo(x, y0); ctx.lineTo(x + 3.2, y0 + 5);
  ctx.moveTo(x - 3.2, y1 - 5); ctx.lineTo(x, y1); ctx.lineTo(x + 3.2, y1 - 5);
  ctx.stroke();
  const ky = y1 - 9 - (max ? (scroll / max) * (y1 - y0 - 20) : 0);
  ctx.fillStyle = '#EEEBE4';
  ctx.beginPath();
  ctx.arc(x, ky, 4.2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * The original's CONTINUE bar: cyan, its right end smeared with red paint that marbles into
 * the cyan (cells and rings of one colour floating in the other), its edges straight.
 */
export function continueBar(ctx: CanvasRenderingContext2D, b: Rect) {
  const rnd = prng(311);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();
  ctx.fillStyle = INK_DE.bar;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  // the smear: from about the middle the red takes over, unevenly, a greyed band where the
  // two paints meet
  const s0 = b.x + b.w * 0.5, s1 = b.x + b.w * 0.76;
  const wash = ctx.createLinearGradient(s0, 0, s1, 0);
  wash.addColorStop(0, 'rgba(120,120,122,0)');
  wash.addColorStop(0.35, 'rgba(118,96,94,.45)');
  wash.addColorStop(0.7, 'rgba(146,44,26,.8)');
  wash.addColorStop(1, 'rgba(140,36,20,.96)');
  ctx.fillStyle = wash;
  ctx.fillRect(s0, b.y, s1 - s0, b.h);
  ctx.fillStyle = INK_DE.splash;
  ctx.fillRect(s1, b.y, b.x + b.w - s1, b.h);
  /** An irregular blob: a few overlapping ellipses turned every way. */
  const blob = (x: number, y: number, r: number, fill: string) => {
    ctx.fillStyle = fill;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.ellipse(x + (rnd() - 0.5) * r, y + (rnd() - 0.5) * r * 0.6, r * (0.6 + rnd() * 0.8), r * (0.35 + rnd() * 0.4), rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  // blotches of red reaching into the cyan and the grey, lighter red floating in the red
  for (let i = 0; i < 26; i++) blob(s0 - 10 + rnd() * (s1 - s0 + 20), b.y + rnd() * b.h, 2.5 + rnd() * 6, `rgba(${rnd() > 0.5 ? '150,40,22' : '118,30,16'},${0.55 + rnd() * 0.4})`);
  for (let i = 0; i < 14; i++) blob(s1 + rnd() * (b.x + b.w - s1), b.y + rnd() * b.h, 2 + rnd() * 6, `rgba(${rnd() > 0.5 ? '184,60,34' : '96,22,12'},${0.35 + rnd() * 0.35})`);
  // veins of cyan left between the blotches, as marbled paint parts
  for (let i = 0; i < 12; i++) {
    const x = s0 + rnd() * (b.x + b.w - s0 - 10), y = b.y + rnd() * b.h;
    ctx.strokeStyle = `rgba(110,198,214,${0.3 + rnd() * 0.35})`;
    ctx.lineWidth = 0.5 + rnd() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 6 + rnd() * 14, y + (rnd() - 0.5) * 16, x + 10 + rnd() * 24, y + (rnd() - 0.5) * 10);
    ctx.stroke();
  }
  // and a few cells: rings, whole or broken
  for (let i = 0; i < 16; i++) {
    const x = s0 + 10 + rnd() * (b.x + b.w - s0 - 14), y = b.y + 2 + rnd() * (b.h - 4), r = 0.9 + rnd() * 3.4;
    ctx.strokeStyle = rnd() > 0.4 ? `rgba(128,208,222,${0.35 + rnd() * 0.35})` : `rgba(236,140,112,${0.3 + rnd() * 0.3})`;
    ctx.lineWidth = 0.5 + rnd() * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, r, rnd() * Math.PI, Math.PI * (1.2 + rnd() * 0.8) + rnd() * Math.PI);
    ctx.stroke();
  }
  // the paint's grain along the bar
  for (let i = 0; i < 24; i++) {
    const x = b.x + rnd() * b.w, y = b.y + 1 + rnd() * (b.h - 2);
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)';
    ctx.fillRect(x, y, 20 + rnd() * 80, 0.6 + rnd());
  }
  ctx.restore();
}
