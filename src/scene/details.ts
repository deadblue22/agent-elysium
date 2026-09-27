// Small details of the original, drawn at runtime (?style=3, docs/style-refs.md 丙组):
//   - interaction markers over what the intro's options point at: a white disc in a green
//     ring over things to look at, a yellow speech marker over someone to talk to, as the
//     original marks what can be clicked. They show while the options wait.
//   - check and morale slips on the table: the original's CHECK SUCCESS / CHECK FAILURE banner
//     under the dice and its DAMAGED MORALE banner, as strips of coloured paper beside the
//     dice and the hearts. A slip drops when the dice settle or a heart turns, and is taken
//     away at the next choice.
import {
  CanvasTexture, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Sprite, SpriteMaterial, type Camera, type Vector3,
} from 'three';
import type { Lang } from '../content/schema';
import { ui } from '../content/ui';
import { ease, type Clock } from '../play/clock';
import { DEG } from './space';

/**
 * Which marker each target gets (something to look at, or someone to talk to), and where it
 * floats from the target's middle (world units): beside the clock's face, low in the window,
 * by Kim's head, so the marker never covers what it points at.
 */
const MARKERS: Record<string, { kind: 'look' | 'talk'; dx: number; dy: number }> = {
  clock: { kind: 'look', dx: 0.62, dy: 0.2 },
  window: { kind: 'look', dx: -0.5, dy: -0.72 },
  bookshelf: { kind: 'look', dx: 0.1, dy: 0.25 },
  kim: { kind: 'talk', dx: 0.45, dy: 0.85 },
};
/** A marker's size (world units; its ring is about 19 frame px across over the room). */
const ORB = 0.34;
/** Where the slips lie on the table (world units; see tabletop.ts), their size and turn. */
const SLIPS = {
  check: { x: 8.2, z: 3.02, w: 1.8, h: 0.36, turn: -3 },
  morale: { x: 8.16, z: 1.36, w: 1.9, h: 0.34, turn: 2 },
};
/** Canvas px per world unit for the slips. */
const RES = 220;
const COLORS = { success: '#2E9E68', failure: '#B3372A', morale: '#2A7F98' };

type SlipKind = 'success' | 'failure' | 'morale';

export function createDetails(o: { clock: Clock; camera: Camera; centers: (key: string) => Vector3 | null; lang: Lang }) {
  const group = new Group();
  group.name = 'details';
  let lang = o.lang;

  // ---- interaction markers
  const tex = { look: orbTexture('look'), talk: orbTexture('talk') };
  const orbs = new Map<string, Sprite>();
  const markers = new Group();
  markers.name = 'markers';
  group.add(markers);
  for (const [key, { kind }] of Object.entries(MARKERS)) {
    const s = new Sprite(new SpriteMaterial({ map: tex[kind], transparent: true, depthWrite: false }));
    s.scale.setScalar(ORB);
    s.renderOrder = 6;
    s.name = `marker-${key}`;
    orbs.set(key, s);
    markers.add(s);
  }
  /** Places the markers by their targets, a little toward the camera (placed each time they show: Kim moves at the end). */
  const place = () => {
    for (const [key, s] of orbs) {
      const p = o.centers(key);
      s.visible = !!p;
      if (!p) continue;
      const toCam = o.camera.position.clone().sub(p).normalize();
      s.position.set(p.x + MARKERS[key].dx, p.y + MARKERS[key].dy, p.z).addScaledVector(toCam, 0.2);
    }
  };

  // ---- slips
  const slips: Record<'check' | 'morale', { mesh: Mesh; material: MeshStandardMaterial; canvas: HTMLCanvasElement; texture: CanvasTexture; kind: SlipKind; text: string }> = {} as never;
  for (const name of ['check', 'morale'] as const) {
    const at = SLIPS[name];
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(at.w * RES); canvas.height = Math.round(at.h * RES);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    const material = new MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.85, depthWrite: false });
    const mesh = new Mesh(new PlaneGeometry(at.w, at.h).rotateX(-Math.PI / 2), material);
    mesh.receiveShadow = true;
    mesh.renderOrder = 2;
    mesh.visible = false;
    mesh.name = `slip-${name}`;
    group.add(mesh);
    slips[name] = { mesh, material, canvas, texture, kind: 'success', text: '' };
  }
  const paintSlip = (name: 'check' | 'morale') => {
    const s = slips[name];
    s.text = s.kind === 'morale' ? `${ui.moraleSlip[lang]} −1` : ui[s.kind === 'success' ? 'checkSuccess' : 'checkFailure'][lang];
    drawSlip(s.canvas, COLORS[s.kind], s.text, lang);
    s.texture.needsUpdate = true;
  };
  const pose = (name: 'check' | 'morale', p: number) => {
    const at = SLIPS[name], m = slips[name].mesh, h = 1 - p;
    m.position.set(at.x + 0.25 * h, 0.006 + 0.7 * h, at.z - 0.2 * h);
    m.rotation.set(0.25 * h, (at.turn + 9 * h) * DEG, 0);
  };
  const drop = async (name: 'check' | 'morale', kind: SlipKind, instant: boolean) => {
    const s = slips[name];
    s.kind = kind;
    paintSlip(name);
    s.material.opacity = 1;
    s.mesh.visible = true;
    if (instant) { pose(name, 1); return; }
    await o.clock.tween(300, (p) => pose(name, p), ease.in, 'slip');
  };

  return {
    group,
    /** Shows or hides the markers (they show while the options wait). */
    markers(on: boolean) {
      markers.visible = on;
      if (on) place();
    },
    /** Swells the marker of the hovered target (or none). */
    hover(key: string | null) { for (const [k, s] of orbs) s.scale.setScalar(k === key ? ORB * 1.3 : ORB); },
    /** The dice have settled: the check's slip drops beside them. */
    check(success: boolean, instant = false) { return drop('check', success ? 'success' : 'failure', instant); },
    /** Morale changed: a lost point drops the morale slip beside the hearts. */
    morale(delta: number) { return delta < 0 ? drop('morale', 'morale', false) : Promise.resolve(); },
    /** The next choice: the slips are taken away. */
    clear() {
      for (const s of Object.values(slips)) {
        if (!s.mesh.visible) continue;
        void o.clock.tween(220, (p) => { s.material.opacity = 1 - p; }, ease.out, 'slip').then(() => { s.mesh.visible = false; });
      }
    },
    setLang(l: Lang) {
      lang = l;
      for (const name of ['check', 'morale'] as const) if (slips[name].mesh.visible) paintSlip(name);
    },
  };
}

/**
 * A marker: a white disc in a green ring (look), or in a yellow ring with a speech tail
 * (talk), cut from paper: a soft shadow under it and a light rim.
 */
function orbTexture(kind: 'look' | 'talk'): CanvasTexture {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  const cx = S / 2, cy = S / 2 - 4, R = 40;
  const ring = kind === 'look' ? '#35C08A' : '#E9B21E';
  const shape = (r: number) => {
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    if (kind === 'talk') { // the speech tail, down and to the right
      x.moveTo(cx + r * 0.55, cy + r * 0.72);
      x.lineTo(cx + r * 1.02, cy + r * 1.22);
      x.lineTo(cx + r * 0.12, cy + r * 0.97);
    }
  };
  x.save();
  x.shadowColor = 'rgba(0,0,0,.45)';
  x.shadowBlur = 8;
  x.shadowOffsetY = 4;
  x.fillStyle = ring;
  shape(R);
  x.fill();
  x.restore();
  x.fillStyle = '#1B1A18'; // the dark gap between the ring and the disc
  x.beginPath(); x.arc(cx, cy, R * 0.66, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#F7F4EE';
  x.beginPath(); x.arc(cx, cy, R * 0.55, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.35)'; // the cut edge catching the light
  x.lineWidth = 2;
  x.beginPath(); x.arc(cx, cy, R - 1, Math.PI * 1.05, Math.PI * 1.75); x.stroke();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A small seeded PRNG (the same brush marks on every repaint). */
function prng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

/**
 * A slip: a band of coloured paper with brushed ends, streaks along it, and the words in light
 * condensed capitals, as the original's banners.
 */
function drawSlip(c: HTMLCanvasElement, color: string, text: string, lang: Lang) {
  const x = c.getContext('2d')!, W = c.width, H = c.height;
  x.clearRect(0, 0, W, H);
  const rnd = prng(7 + text.length * 13);
  const top = H * 0.08, bottom = H * 0.92, n = 9;
  x.beginPath();
  x.moveTo(W * 0.03 + rnd() * W * 0.02, top);
  for (let i = 1; i <= n; i++) x.lineTo(W * (0.965 - rnd() * 0.035), top + ((bottom - top) * i) / n);
  for (let i = n; i >= 0; i--) x.lineTo(W * (0.012 + rnd() * 0.03), top + ((bottom - top) * i) / n);
  x.closePath();
  x.fillStyle = color;
  x.fill();
  x.save();
  x.clip();
  for (let i = 0; i < 26; i++) { // brush streaks
    const y = top + rnd() * (bottom - top), w = W * (0.1 + rnd() * 0.4), sx = rnd() * W;
    x.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.1)';
    x.fillRect(sx, y, w, 1 + rnd() * 3);
  }
  x.restore();
  const size = H * (lang === 'zh' ? 0.5 : 0.58);
  x.font = lang === 'zh' ? `600 ${size}px "Elysium Sans SC", "Inter", sans-serif` : `500 ${size}px "Barlow Condensed", "Inter", sans-serif`;
  x.fillStyle = '#F8F5EF';
  x.textBaseline = 'middle';
  const ls = size * (lang === 'zh' ? 0.3 : 0.08);
  const width = [...text].reduce((w, ch) => w + x.measureText(ch).width + ls, -ls);
  let px = (W - width) / 2;
  for (const ch of text) { x.fillText(ch, px, H * 0.53); px += x.measureText(ch).width + ls; }
}

export type Details = ReturnType<typeof createDetails>;
