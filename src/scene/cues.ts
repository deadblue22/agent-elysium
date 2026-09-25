// The stage cues of chapter one (docs/design.md §6.5; the reconstruction, §4.4), and the parts
// of the room they move:
//   - the window's two casements (casement.svg), hinged in the wall's window hole;
//   - the mantel clock's hands and pendulum (clock-*.svg, pendulum.svg) over the furniture;
//   - the snow outside the window and on the sill (far-snow.svg, sill-snow.svg);
//   - the stairwell with the landlady's dog (stairs.svg, dog.svg, dog-head.svg), a pop-up card
//     that rises from the floor on the right for the reconstruction, and Marek (marek.svg),
//     who climbs it, stands at the desk and at the clock, and goes back down;
//   - the grade, the lights and the global snow.
// Every cue is a sequence of clock tweens (src/play/clock.ts), so reduced motion jumps to the
// end states and a test harness can freeze them. The room's resting state (the present, after
// the fact: casements open, hands at 23:40, pendulum still, snow) is also the style board's.
import {
  DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, type Material, type Object3D,
} from 'three';
import type { Art, ArtPiece } from '../assets';
import { ease, lerp, type Clock } from '../play/clock';
import type { createLights } from './lights';
import { standingContact } from './paper';
import { LAYER_Y, type PieceHandle } from './popup';
import { DEG, LEAN_DEG, UNIT, baseY, paperMaterial, standing, wx, wz } from './space';

/** Cues that start together with the cue before them instead of after it. */
export const PARALLEL = new Set(['snow-stop']);

/** The casements stand open this far (degrees) in the present; the flashback closes them. */
const OPEN = 70;
/** The clock: the time it shows in the present, and at the start of the flashback (minutes). */
const STOPPED = 23 * 60 + 40, FLASHBACK = 22 * 60 + 30;
/** Pendulum: swing (radians) and period (s). */
const SWING = 0.15, PERIOD = 1.1;
/** A card lying (nearly) flat on its fold, before it rises (degrees back from the vertical). */
const FLAT = 86;
/** Marek walks this fast (book px per s), a step every STEP px. */
const PACE = 105, STEP = 15;

interface Deps {
  art: Art;
  clock: Clock;
  popup: { group: Group; pieces: Record<string, PieceHandle> };
  stage: { group: Group; puppets: Record<'harry' | 'kim', { group: Group; lean: number }>; ember: Object3D };
  lights: ReturnType<typeof createLights>;
  post: { uniforms: { uNight: { value: number }; uExposure: { value: number } } };
  snow: { setOpacity(o: number): void };
  /** Shows or hides the chrome's time marker (「昨晚 22:30」). */
  marker: (on: boolean) => void;
  /** The page turn: progress 0..1. */
  turn: (p: number) => void;
}

/**
 * Lays `piece` over a standing host at the host's SVG point (sx, sy): the piece's own SVG
 * origin lands there, and it can turn about it. The piece bends with the host's fold line
 * (rest) exactly as the host does, so a closed casement fits its window hole.
 */
function overlay(host: PieceHandle, piece: ArtPiece, sx: number, sy: number, material: Material,
  o: { dz?: number; flip?: boolean; segments?: number } = {}) {
  const h = host.opts, s = h.scale ?? 1, lean = (h.lean ?? LEAN_DEG) * DEG, rest = h.rest ?? (() => 0);
  const bx0 = (h.x0 ?? 0) + sx * s;
  const [vx, vy, vw, vh] = piece.viewBox;
  const g = new PlaneGeometry((vw * s) / UNIT, (vh * s) / UNIT, o.segments ?? 1, 1);
  const cx = ((vx + vw / 2) * s) / UNIT;
  g.translate(o.flip ? -cx : cx, (-(vy + vh / 2) * s) / UNIT, 0);
  if (o.flip) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
  const e0 = rest(bx0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const e = rest(bx0 + p.getX(i) * UNIT) - e0;
    p.setY(i, p.getY(i) + e * Math.cos(lean));
    p.setZ(i, p.getZ(i) + e * Math.sin(lean));
  }
  g.computeVertexNormals();
  const mesh = new Mesh(g, material);
  mesh.name = piece.texture.name;
  const pivot = new Group();
  pivot.position.set(wx(bx0), ((h.baseY - sy) * s) / UNIT + e0 * Math.cos(lean), e0 * Math.sin(lean) + (o.dz ?? 0.004));
  pivot.add(mesh);
  host.group.add(pivot);
  return { pivot, mesh };
}

export function createCues(d: Deps) {
  const { art, clock, popup, lights, post, snow } = d;
  const P = popup.pieces;
  const fold0 = art.floor.meta.fold;

  // ---------------------------------------------------------------- the window
  const casementMat = new MeshStandardMaterial({ map: art.casement.texture, color: '#c4c8ca', roughness: 0.85, alphaToCoverage: true, side: DoubleSide });
  const segs = 6;
  const casements = [
    { ...overlay(P.wall, art.casement, 378, 146, casementMat, { dz: 0.01, segments: segs }), dir: -1 },
    { ...overlay(P.wall, art.casement, 592, 146, casementMat, { dz: 0.01, segments: segs, flip: true }), dir: 1 },
  ];
  // the panes: the texture's glass is too faint for alpha-to-coverage, so each sash gets a
  // tinted, see-through pane of its own (it does not cast)
  const glassMat = new MeshStandardMaterial({ color: '#a7b9c2', roughness: 0.3, transparent: true, opacity: 0.3, depthWrite: false, side: DoubleSide });
  for (const c of casements) {
    c.mesh.castShadow = true;
    c.mesh.receiveShadow = true;
    const pane = new Mesh(new PlaneGeometry(0.95, 1.6), glassMat);
    pane.position.set(-c.dir * 0.535, -0.86, -0.002);
    pane.name = 'pane';
    c.pivot.add(pane);
  }
  let open = OPEN;
  const setOpen = (deg: number) => { open = deg; for (const c of casements) c.pivot.rotation.y = c.dir * deg * DEG; };

  // ---------------------------------------------------------------- the clock
  const brass = (t: ArtPiece, roughness: number, metalness = 0) =>
    new MeshStandardMaterial({ map: t.texture, roughness, metalness, alphaToCoverage: true });
  const pendulum = overlay(P.furniture, art.pendulum, 970, 188.6, brass(art.pendulum, 0.45, 0.25), { dz: 0.002 });
  const hour = overlay(P.furniture, art['clock-hour'], 970, 157.5, brass(art['clock-hour'], 0.6), { dz: 0.003 });
  const minute = overlay(P.furniture, art['clock-minute'], 970, 157.5, brass(art['clock-minute'], 0.6), { dz: 0.004 });
  for (const m of [pendulum, hour, minute]) m.mesh.receiveShadow = true;
  let time = STOPPED;
  const setTime = (min: number) => {
    time = min;
    minute.pivot.rotation.z = -((min % 60) / 60) * 2 * Math.PI;
    hour.pivot.rotation.z = -(((min / 60) % 12) / 12) * 2 * Math.PI;
  };
  let swing = 0;

  // ---------------------------------------------------------------- the snow
  const farSnowMat = new MeshBasicMaterial({ map: art['far-snow'].texture, color: '#d8dde0', transparent: true, depthWrite: false });
  const farSnow = overlay(P.far, art['far-snow'], 0, 0, farSnowMat, { dz: 0.003, segments: Math.ceil(art['far-snow'].viewBox[2] / 6) });
  const sillMat = new MeshStandardMaterial({ map: art['sill-snow'].texture, roughness: 0.95, transparent: true, depthWrite: false });
  const sill = overlay(P.wall, art['sill-snow'], 0, 0, sillMat, { dz: 0.006, segments: 12 });
  sill.mesh.receiveShadow = true;
  let snowing = 1;
  const setSnow = (o: number, settled = o) => {
    snowing = o;
    snow.setOpacity(o);
    farSnowMat.opacity = settled;
    sillMat.opacity = settled;
    farSnow.mesh.visible = sill.mesh.visible = settled > 0.001;
  };

  // ---------------------------------------------------------------- the stairwell, the dog, Marek
  const stage = new Group();
  stage.name = 'reconstruction';
  popup.group.add(stage);
  const floorAt = (bx: number, by: number) => baseY(bx, by) + 0.003;
  const card = (name: string, o: { hinge: number; x0: number; scale: number; lean: number }) => {
    const piece = art[name];
    const opts = { ...o, baseY: piece.meta.soles, y: LAYER_Y };
    const { group, mesh } = standing(piece, paperMaterial(piece.texture, 0.92), opts);
    mesh.name = name;
    const contact = standingContact(piece, opts, floorAt, { opacity: 0.72, behind: 16, front: 12 });
    contact.name = `contact-${name}`;
    stage.add(group, contact);
    const handle: PieceHandle & { contact: Mesh; lean: number } = { group, mesh, opts, contact, lean: o.lean };
    return handle;
  };
  const STAIRS_X0 = 1030;
  const stairs = card('stairs', { hinge: fold0 + 92, x0: STAIRS_X0, scale: 1, lean: 12 });
  const dogScale = 1.1, dogRight = 1046;
  const dog = card('dog', { hinge: fold0 + 104, x0: dogRight - 90 * dogScale, scale: dogScale, lean: 12 });
  const HEAD_DOWN = 0.38, HEAD_UP = -0.08;
  const head = overlay(dog, art['dog-head'], art.dog.meta.neckX, art.dog.meta.neckY, paperMaterial(art['dog-head'].texture, 0.92), { dz: 0.003 });
  head.mesh.castShadow = head.mesh.receiveShadow = true;
  head.pivot.rotation.z = HEAD_DOWN;

  // Marek: a card of his own, its origin at his feet, so he can walk, climb and fold
  const mk = art.marek, mS = 0.95, M_LEAN = 12;
  const marekGeo = (flip: boolean) => {
    const [vx, vy, vw, vh] = mk.viewBox;
    const g = new PlaneGeometry((vw * mS) / UNIT, (vh * mS) / UNIT);
    g.translate(((vx + vw / 2 - mk.meta.feetX) * mS * (flip ? -1 : 1)) / UNIT, ((mk.meta.soles - (vy + vh / 2)) * mS) / UNIT, 0);
    if (flip) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    return g;
  };
  const facing = { right: marekGeo(false), left: marekGeo(true) };
  const marekMat = paperMaterial(mk.texture, 0.9);
  const marekMesh = new Mesh(facing.right, marekMat);
  marekMesh.name = 'marek';
  marekMesh.castShadow = marekMesh.receiveShadow = true;
  const marek = new Group();
  marek.add(marekMesh);
  stage.add(marek);
  /** Where Marek can be: on the stair track (stair x; height from the treads) or on the floor by the desk, by the clock. */
  const TRACK = fold0 + 98, SPOTS = { desk: { bx: 356, hinge: fold0 + 101 }, clock: { bx: 900, hinge: fold0 + 101 } };
  const treadH = (sx: number) => (sx < 16 ? 0 : sx < 186 ? (sx - 16) * 0.9 : 153);
  const place = (bx: number, hinge: number, h: number, face: 'left' | 'right') => {
    const l = M_LEAN * DEG;
    marek.position.set(wx(bx), LAYER_Y + (h * Math.cos(l)) / UNIT, wz(hinge) - (h * Math.sin(l)) / UNIT);
    marekMesh.geometry = facing[face];
  };
  const onTrack = (sx: number, face: 'left' | 'right') => place(STAIRS_X0 + sx, TRACK, treadH(sx), face);
  /** A card's lean while it rises (p 0 → 1) or folds (1 → 0). */
  const lean = (g: Group, deg: number, p: number) => { g.rotation.x = -lerp(FLAT, deg, p) * DEG; };
  const rise = async (g: Group, deg: number, ms: number, contact?: Mesh) => {
    g.visible = true;
    if (contact) contact.visible = true;
    await clock.tween(ms, (p) => { lean(g, deg, p); if (contact) (contact.material as MeshBasicMaterial).opacity = 0.72 * Math.min(1, Math.max(0, p)); }, ease.back);
  };
  const lay = async (g: Group, deg: number, ms: number, contact?: Mesh) => {
    await clock.tween(ms, (p) => { lean(g, deg, 1 - p); if (contact) (contact.material as MeshBasicMaterial).opacity = 0.72 * (1 - p); }, ease.in);
    g.visible = false;
    if (contact) contact.visible = false;
  };
  const walk = async (from: number, to: number, face: 'left' | 'right') => {
    const dist = Math.abs(to - from);
    await clock.tween((dist / PACE) * 1000, (p) => {
      const sx = lerp(from, to, p), stepPhase = (Math.PI * dist * p) / STEP;
      onTrack(sx, face);
      marekMesh.position.y = 0.012 * Math.abs(Math.sin(stepPhase));
      marekMesh.rotation.z = 0.02 * Math.sin(stepPhase) * (face === 'right' ? -1 : 1);
    }, ease.linear, 'marek-walk');
    marekMesh.position.y = 0;
    marekMesh.rotation.z = 0;
  };
  const headTo = (to: number, ms: number) => {
    const from = head.pivot.rotation.z;
    return clock.tween(ms, (p) => { head.pivot.rotation.z = lerp(from, to, p); }, ease.inOut);
  };

  // ---------------------------------------------------------------- grade and light
  const base = {
    key: lights.key.intensity, hemi: lights.hemi.intensity, glow: lights.windowGlow.intensity, exposure: post.uniforms.uExposure.value,
  };
  let night = 0;
  const setNight = (n: number) => {
    night = n;
    post.uniforms.uNight.value = n;
    lights.key.intensity = base.key * lerp(1, 0.82, n);
    lights.hemi.intensity = base.hemi * lerp(1, 0.8, n);
    lights.windowGlow.intensity = base.glow * lerp(1, 0.08, n); // no daylight at night
    lights.candle.boost = lerp(1, 1.35, n);
    lights.candle.flicker = lerp(0.05, 0.09, n);
  };

  // ---------------------------------------------------------------- the cues
  const cues: Record<string, () => Promise<void>> = {
    // last night: the grade goes cold, the candle burns a little brighter, the casements close,
    // the hands run back to 22:30 and the pendulum swings again
    async flashback() {
      d.marker(true);
      const t0 = time, o0 = open, n0 = night;
      await Promise.all([
        clock.tween(1400, (p) => setNight(lerp(n0, 1, p)), ease.inOut),
        clock.tween(900, (p) => setOpen(lerp(o0, 0, p)), ease.inOut),
        clock.tween(1200, (p) => setTime(lerp(t0, FLASHBACK, p)), ease.inOut)
          .then(() => clock.tween(600, (p) => { swing = SWING * p; }, ease.out)),
      ]);
    },
    // no snow yet: the flakes thin out and stop, the snow outside and on the sill goes
    async 'snow-stop'() {
      const s0 = snowing;
      await clock.tween(1200, (p) => setSnow(lerp(s0, 0, p)), ease.inOut);
    },
    // the stairwell rises from the floor on the right, the dog asleep at its foot
    async 'raise-stairs'() {
      await Promise.all([
        rise(stairs.group, stairs.lean, 1100, stairs.contact),
        clock.wait(260).then(() => rise(dog.group, dog.lean, 800, dog.contact)),
      ]);
    },
    // Marek comes up the stairs; the dog lifts its head, and lowers it again
    async 'marek-climb'() {
      onTrack(-40, 'right');
      lean(marek, M_LEAN, 0);
      await rise(marek, M_LEAN, 450);
      await walk(-40, 16, 'right');
      await Promise.all([
        walk(16, 186, 'right'),
        headTo(HEAD_UP, 350).then(() => clock.wait(700)).then(() => headTo(HEAD_DOWN, 550)),
      ]);
      await walk(186, 222, 'right');
      await lay(marek, M_LEAN, 380);
    },
    // Marek at the desk. A single blow: the candle gutters, the room goes dark for a beat;
    // the pendulum swings on
    async 'marek-blow'() {
      place(SPOTS.desk.bx, SPOTS.desk.hinge, 0, 'right');
      lean(marek, M_LEAN, 0);
      await rise(marek, M_LEAN, 450);
      await clock.wait(300);
      const e0 = base.exposure;
      await Promise.all([
        clock.tween(110, (p) => { marekMesh.position.x = 0.07 * p; marekMesh.rotation.z = -0.1 * p; }, ease.out)
          .then(() => clock.tween(420, (p) => { marekMesh.position.x = 0.07 * (1 - p); marekMesh.rotation.z = -0.1 * (1 - p); }, ease.inOut)),
        clock.tween(1100, (p) => { lights.candle.flicker = p < 1 ? 0.75 * (1 - p) ** 0.5 + 0.09 * p : 0.09; }, ease.linear),
        clock.tween(110, (p) => { post.uniforms.uExposure.value = lerp(e0, e0 * 0.42, p); }, ease.out)
          .then(() => clock.wait(260))
          .then(() => clock.tween(650, (p) => { post.uniforms.uExposure.value = lerp(e0 * 0.42, e0, p); }, ease.inOut)),
      ]);
    },
    // at the clock: the hands run on to 23:40, and a hand stills the pendulum
    async 'clock-set'() {
      await lay(marek, M_LEAN, 320);
      place(SPOTS.clock.bx, SPOTS.clock.hinge, 0, 'right');
      await rise(marek, M_LEAN, 450);
      const t0 = time;
      await clock.tween(1600, (p) => setTime(lerp(t0, STOPPED, p)), ease.inOut);
      const s0 = swing;
      await clock.tween(420, (p) => { swing = s0 * (1 - p); }, ease.out);
      swing = 0;
    },
    // the casements swing open into the room
    async 'window-open'() {
      const o0 = open;
      await clock.tween(1300, (p) => setOpen(lerp(o0, OPEN, p)), ease.back, 'window-open');
    },
    // Marek goes back down the stairs; the dog sleeps on
    async 'marek-leave'() {
      await lay(marek, M_LEAN, 320);
      onTrack(222, 'left');
      await rise(marek, M_LEAN, 450);
      await walk(222, 186, 'left');
      await walk(186, 16, 'left');
      await walk(16, -40, 'left');
      await lay(marek, M_LEAN, 380);
    },
    // the snow begins: flakes again, and it settles on the roofs, the fire escape and the sill
    async 'snow-start'() {
      const s0 = snowing;
      await clock.tween(2600, (p) => setSnow(lerp(s0, 1, Math.min(1, p * 1.6)), lerp(s0, 1, p)), ease.inOut);
    },
    // back to the morning: the grade and the lights return, the stairwell folds away
    async present() {
      d.marker(false);
      const n0 = night;
      await Promise.all([
        clock.tween(1600, (p) => setNight(lerp(n0, 0, p)), ease.inOut),
        marek.visible ? lay(marek, M_LEAN, 400) : Promise.resolve(),
        lay(dog.group, dog.lean, 800, dog.contact),
        clock.wait(200).then(() => lay(stairs.group, stairs.lean, 1000, stairs.contact)),
      ]);
    },
    // the right sheet turns over onto the left page; the puppets fold flat first
    async 'page-turn'() {
      const pups = Object.values(d.stage.puppets);
      d.stage.ember.visible = false;
      await clock.tween(500, (p) => { for (const pp of pups) pp.group.rotation.x = -lerp(pp.lean, FLAT, p) * DEG; }, ease.inOut);
      await clock.tween(2600, (p) => d.turn(p), ease.linear, 'page-turn');
    },
  };

  /** The present, without animating: the morning after, as the style board shows it. */
  function present() {
    setNight(0);
    setOpen(OPEN);
    setTime(STOPPED);
    swing = 0;
    setSnow(1);
    for (const g of [stairs, dog]) { g.group.visible = false; g.contact.visible = false; }
    marek.visible = false;
    head.pivot.rotation.z = HEAD_DOWN;
    lights.settle();
  }
  present();

  // entering the scene (§6.5): the pop-up rises from flat, row after row, then the puppets
  const rows: Group[][] = [
    [P.far.group, P.wall.group], [P.furniture.group], [P.desk.group], [P['front-chair'].group, P['front-right'].group],
    [d.stage.puppets.harry.group, d.stage.puppets.kim.group],
  ];
  const upright = new Map<Group, number>(rows.flat().map((g) => [g, -g.rotation.x / DEG]));
  const contacts = () => [...popup.group.children, ...d.stage.group.children]
    .filter((o): o is Mesh => o.name.startsWith('contact-') && o instanceof Mesh && o.name !== 'contact-die');
  const contactOpacity = new Map(contacts().map((c) => [c, (c.material as MeshBasicMaterial).opacity]));
  /** Lays the pop-up flat, ready to rise. */
  function flatten() {
    for (const g of rows.flat()) lean(g, upright.get(g)!, 0);
    for (const c of contacts()) (c.material as MeshBasicMaterial).opacity = 0;
  }
  async function enter() {
    await Promise.all([
      ...rows.map((row, k) => clock.wait(150 * k).then(() => Promise.all(row.map((g) =>
        clock.tween(700, (p) => lean(g, upright.get(g)!, p), ease.back, 'enter'))))),
      clock.wait(250).then(() => clock.tween(900, (p) => {
        for (const c of contacts()) (c.material as MeshBasicMaterial).opacity = (contactOpacity.get(c) ?? 0.75) * p;
      }, ease.inOut)),
    ]);
  }

  return {
    group: stage,
    present,
    flatten,
    enter,
    /** Plays a cue; an unknown cue is reported and skipped. */
    async play(cue: string): Promise<void> {
      const fn = cues[cue];
      if (!fn) { console.warn(`[stage] unknown cue: ${cue}`); return; }
      await fn();
    },
    has: (cue: string) => cue in cues,
    /** Per frame: the pendulum (t: clock seconds). */
    update(t: number) { pendulum.pivot.rotation.z = swing * Math.sin((2 * Math.PI * t) / PERIOD); },
    /** True while something moves without a tween (the pendulum): keep rendering. */
    get animating() { return swing > 0; },
  };
}
