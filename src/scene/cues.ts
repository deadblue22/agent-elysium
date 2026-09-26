// The stage cues of chapter one (docs/design.md §6.5; the reconstruction, §4.4), and the parts
// of the room they move:
//   - the window's two casements (casement.svg), hinged in the wall's window hole;
//   - the mantel clock's hands and pendulum (clock-*.svg, pendulum.svg) over the furniture;
//   - the snow outside the window and on the sill (far-snow.svg, sill-snow.svg);
//   - the stairwell with the landlady's dog (stairs.svg, dog.svg, dog-head.svg), a pop-up card
//     that rises from the floor on the right for the reconstruction, and Marek (marek.svg),
//     who climbs it, comes into the room from behind it, and walks from the desk to the clock,
//     to the window and back out, and down the stairs;
//   - the grade, the lights, the candle and the snow;
//   - at the end, Harry and Kim, who walk out of the room to the right.
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
/**
 * What really happened when (minutes), for the time marker: the clock lies (23:40), the
 * marker does not. Keyed by the cue that reaches the moment.
 */
const REAL_TIME: Record<string, number> = {
  flashback: 22 * 60 + 30, 'marek-blow': 22 * 60 + 40, 'clock-set': 22 * 60 + 44, 'window-open': 22 * 60 + 46,
  'marek-leave': 22 * 60 + 52, 'snow-start': 23 * 60 + 30,
};
/** Pendulum: swing (radians) and period (s). */
const SWING = 0.15, PERIOD = 1.1;
/** A card lying (nearly) flat on its fold, before it rises (degrees back from the vertical). */
const FLAT = 86;
/** Marek climbs this fast (stair px per s), a step every STEP px; he crosses the room faster. */
const PACE = 105, ROOM_PACE = 170, STEP = 15;

interface Puppet { group: Group; mesh: Mesh; lean: number }

interface Deps {
  art: Art;
  clock: Clock;
  popup: { group: Group; pieces: Record<string, PieceHandle> };
  stage: { group: Group; puppets: Record<'harry' | 'kim', Puppet>; ember: Object3D };
  lights: ReturnType<typeof createLights>;
  post: { uniforms: { uNight: { value: number }; uExposure: { value: number } } };
  snow: { setOpacity(o: number): void };
  /** Shows the chrome's time marker (「昨晚 22:30」) at these minutes, or hides it (null). */
  marker: (minutes: number | null) => void;
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
    const contact = standingContact(piece, opts, floorAt, { opacity: 0.9, behind: 16, front: 12 });
    contact.name = `contact-${name}`;
    stage.add(group, contact);
    const handle: PieceHandle & { contact: Mesh; lean: number } = { group, mesh, opts, contact, lean: o.lean };
    return handle;
  };
  // the stairwell stands on the right, between the fireplace and the foreground props; the
  // flight climbs to the right onto a landing, behind which lies the study's door
  const ST = { x0: 1000, hinge: fold0 + 150, scale: 1.3, lean: 10 };
  const sm = art.stairs.meta;
  const stairs = card('stairs', ST);
  const dogScale = 1.3, dogRight = ST.x0 + (sm.footX - 4) * ST.scale;
  const dog = card('dog', { hinge: ST.hinge + 16, x0: dogRight - 90 * dogScale, scale: dogScale, lean: 10 });
  const HEAD_DOWN = 0.38, HEAD_UP = -0.08;
  const head = overlay(dog, art['dog-head'], art.dog.meta.neckX, art.dog.meta.neckY, paperMaterial(art['dog-head'].texture, 0.92), { dz: 0.003 });
  head.mesh.castShadow = head.mesh.receiveShadow = true;
  head.pivot.rotation.z = HEAD_DOWN;

  // Marek: a card of his own, its origin at his feet, so he can walk, climb and fold. A shade
  // lighter than a silhouette, so the cold flashback light still models him.
  const mk = art.marek, mS = 1.25, M_LEAN = 10;
  const marekGeo = (flip: boolean) => {
    const [vx, vy, vw, vh] = mk.viewBox;
    const g = new PlaneGeometry((vw * mS) / UNIT, (vh * mS) / UNIT);
    g.translate(((vx + vw / 2 - mk.meta.feetX) * mS * (flip ? -1 : 1)) / UNIT, ((mk.meta.soles - (vy + vh / 2)) * mS) / UNIT, 0);
    if (flip) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    return g;
  };
  const facing = { right: marekGeo(false), left: marekGeo(true) };
  const marekMat = paperMaterial(mk.texture, 0.9);
  marekMat.emissive.setRGB(0.07, 0.075, 0.09);
  marekMat.emissiveMap = mk.texture;
  const marekMesh = new Mesh(facing.right, marekMat);
  marekMesh.name = 'marek';
  marekMesh.castShadow = marekMesh.receiveShadow = true;
  const marek = new Group();
  marek.add(marekMesh);
  stage.add(marek);
  /**
   * Where Marek can be: on the stair track (stair x; height from the treads), or on the room's
   * path, which runs behind the desk and in front of the fireplace (book x). The path's door
   * end is hidden behind the stairwell's landing.
   */
  const TRACK = ST.hinge + 6, ROOM = fold0 + 90;
  const SPOT = { door: 1262, entered: 1000, desk: 356, clock: 968, window: 520 };
  const treadH = (sx: number) => (sx < sm.footX ? 0 : sx < sm.pathX1 ? (sx - sm.footX) * 0.9 : (sm.pathX1 - sm.footX) * 0.9);
  const place = (bx: number, hinge: number, h: number, face: 'left' | 'right') => {
    const l = M_LEAN * DEG;
    marek.position.set(wx(bx), LAYER_Y + (h * Math.cos(l)) / UNIT, wz(hinge) - (h * Math.sin(l)) / UNIT);
    marekMesh.geometry = facing[face];
  };
  const onTrack = (sx: number, face: 'left' | 'right') => place(ST.x0 + sx * ST.scale, TRACK, treadH(sx) * ST.scale, face);
  const inRoom = (bx: number, face: 'left' | 'right') => place(bx, ROOM, 0, face);
  let at = SPOT.door;
  /** A card's lean while it rises (p 0 → 1) or folds (1 → 0). */
  const lean = (g: Group, deg: number, p: number) => { g.rotation.x = -lerp(FLAT, deg, p) * DEG; };
  const rise = async (g: Group, deg: number, ms: number, contact?: Mesh) => {
    g.visible = true;
    if (contact) contact.visible = true;
    await clock.tween(ms, (p) => { lean(g, deg, p); if (contact) (contact.material as MeshBasicMaterial).opacity = 0.9 * Math.min(1, Math.max(0, p)); }, ease.back);
  };
  const lay = async (g: Group, deg: number, ms: number, contact?: Mesh) => {
    await clock.tween(ms, (p) => { lean(g, deg, 1 - p); if (contact) (contact.material as MeshBasicMaterial).opacity = 0.9 * (1 - p); }, ease.in);
    g.visible = false;
    if (contact) contact.visible = false;
  };
  /** A walking card's step: a small bob and sway as each foot lands. */
  const step = (mesh: Mesh, phase: number, face: 'left' | 'right') => {
    mesh.position.y = 0.012 * Math.abs(Math.sin(phase));
    mesh.rotation.z = 0.02 * Math.sin(phase) * (face === 'right' ? -1 : 1);
  };
  const still = (mesh: Mesh) => { mesh.position.y = 0; mesh.rotation.z = 0; };
  const climb = async (from: number, to: number, face: 'left' | 'right') => {
    const dist = Math.abs(to - from);
    await clock.tween((dist / PACE) * 1000, (p) => {
      onTrack(lerp(from, to, p), face);
      step(marekMesh, (Math.PI * dist * p) / STEP, face);
    }, ease.linear, 'marek-walk');
    still(marekMesh);
  };
  const stroll = async (to: number) => {
    const from = at, dist = Math.abs(to - from), face = to < from ? 'left' : 'right';
    at = to;
    await clock.tween((dist / ROOM_PACE) * 1000, (p) => {
      inRoom(lerp(from, to, ease.inOut(p)), face);
      step(marekMesh, (Math.PI * dist * ease.inOut(p)) / (STEP * 1.3), face);
    }, ease.linear, 'marek-walk');
    still(marekMesh);
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
  const marker = (cue: string) => { if (cue in REAL_TIME) d.marker(REAL_TIME[cue]); };

  // ---------------------------------------------------------------- Harry and Kim leave
  const pups = d.stage.puppets;
  /** Turns a puppet round (its card seen from the back is its mirror image). */
  const turnRound = (p: Puppet) => { p.mesh.scale.x *= -1; };
  const walkOff = async (p: Puppet, dx: number) => {
    const g = p.group, x0 = g.position.x, y0 = g.position.y, dist = Math.abs(dx) * UNIT;
    for (const name of [`tab-${p.mesh.name}`, `contact-${p.mesh.name}`]) {
      const o = d.stage.group.getObjectByName(name);
      if (o) o.visible = false;
    }
    await clock.tween((dist / 150) * 1000, (q) => {
      const e = ease.inOut(q);
      g.position.x = x0 + dx * e;
      g.position.y = y0 + 0.014 * Math.abs(Math.sin((Math.PI * dist * e) / 20));
    }, ease.linear, 'exit');
    g.position.y = y0;
    await clock.tween(420, (q) => { lean(g, p.lean, 1 - q); }, ease.in, 'exit');
    g.visible = false;
  };

  // ---------------------------------------------------------------- the cues
  const cues: Record<string, () => Promise<void>> = {
    // last night: the grade goes cold, the candle burns a little brighter, the casements close,
    // the hands run back to 22:30 and the pendulum swings again
    async flashback() {
      marker('flashback');
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
    // Marek comes up the stairs (the dog lifts its head, and lowers it again), goes through
    // the door behind the landing and comes into the room from behind the stairwell
    async 'marek-climb'() {
      onTrack(sm.pathX0, 'right');
      lean(marek, M_LEAN, 0);
      await rise(marek, M_LEAN, 450);
      await climb(sm.pathX0, sm.footX, 'right');
      await Promise.all([
        climb(sm.footX, sm.pathX1, 'right'),
        headTo(HEAD_UP, 350).then(() => clock.wait(700)).then(() => headTo(HEAD_DOWN, 550)),
      ]);
      await climb(sm.pathX1, sm.landingX, 'right');
      await lay(marek, M_LEAN, 320);
      at = SPOT.door;
      inRoom(at, 'left');
      await rise(marek, M_LEAN, 380);
      await stroll(SPOT.entered);
    },
    // Marek crosses to the desk. A single blow: the candle gutters, the room goes dark for a
    // beat; the pendulum swings on
    async 'marek-blow'() {
      await stroll(SPOT.desk);
      marker('marek-blow');
      inRoom(SPOT.desk, 'right'); // he turns to the chair
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
      await stroll(SPOT.clock);
      marker('clock-set');
      const t0 = time;
      await clock.tween(1600, (p) => setTime(lerp(t0, STOPPED, p)), ease.inOut);
      const s0 = swing;
      await clock.tween(420, (p) => { swing = s0 * (1 - p); }, ease.out);
      swing = 0;
    },
    // at the window: the casements swing open into the room
    async 'window-open'() {
      await stroll(SPOT.window);
      marker('window-open');
      const o0 = open;
      await clock.tween(1300, (p) => setOpen(lerp(o0, OPEN, p)), ease.back, 'window-open');
    },
    // Marek goes back out behind the stairwell and down the stairs; the dog sleeps on
    async 'marek-leave'() {
      marker('marek-leave');
      await stroll(SPOT.door);
      await lay(marek, M_LEAN, 320);
      onTrack(sm.landingX, 'left');
      await rise(marek, M_LEAN, 380);
      await climb(sm.landingX, sm.pathX1, 'left');
      await climb(sm.pathX1, sm.footX, 'left');
      await climb(sm.footX, sm.pathX0, 'left');
      await lay(marek, M_LEAN, 380);
    },
    // the snow begins: flakes again, and it settles on the roofs, the fire escape and the sill
    async 'snow-start'() {
      marker('snow-start');
      const s0 = snowing;
      await clock.tween(2600, (p) => setSnow(lerp(s0, 1, Math.min(1, p * 1.6)), lerp(s0, 1, p)), ease.inOut);
    },
    // back to the morning: the grade and the lights return, the stairwell folds away
    async present() {
      d.marker(null);
      const n0 = night;
      await Promise.all([
        clock.tween(1600, (p) => setNight(lerp(n0, 0, p)), ease.inOut),
        marek.visible ? lay(marek, M_LEAN, 400) : Promise.resolve(),
        lay(dog.group, dog.lean, 800, dog.contact),
        clock.wait(200).then(() => lay(stairs.group, stairs.lean, 1000, stairs.contact)),
      ]);
    },
    // the end: Kim turns and goes, Harry follows him out to the right; they fold down at the
    // page's edge. Then the candle goes out, and the room is left to the snow
    async exit() {
      d.stage.ember.visible = false;
      turnRound(pups.kim);
      await Promise.all([
        walkOff(pups.kim, 2.5),
        clock.wait(500).then(() => walkOff(pups.harry, 3.5)),
      ]);
      await clock.wait(500);
      // the room goes dim like a stage after the last scene; the reading lamp stays on the log
      const e0 = post.uniforms.uExposure.value, k0 = lights.key.intensity, h0 = lights.hemi.intensity;
      await Promise.all([
        clock.tween(1500, (p) => { lights.candle.out = p; }, ease.inOut, 'candle-out'),
        clock.wait(400).then(() => clock.tween(2400, (p) => {
          lights.key.intensity = lerp(k0, k0 * 0.5, p);
          lights.hemi.intensity = lerp(h0, h0 * 0.7, p);
          post.uniforms.uExposure.value = lerp(e0, e0 * 0.92, p);
        }, ease.inOut)),
      ]);
      lights.settle(); // the frame loop does not flicker the candle under reduced motion
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
    [pups.harry.group, pups.kim.group],
  ];
  const upright = new Map<Group, number>(rows.flat().map((g) => [g, -g.rotation.x / DEG]));
  const contacts = () => [...popup.group.children, ...d.stage.group.children]
    .filter((o): o is Mesh => o.name.startsWith('contact-') && o instanceof Mesh);
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
    /** The moving parts, for the hover tips (src/scene/hotspots.ts). */
    parts: {
      window: [...casements.map((c) => c.mesh), ...casements.flatMap((c) => c.pivot.children.filter((o): o is Mesh => o.name === 'pane')), farSnow.mesh, sill.mesh],
      clock: [pendulum.mesh, hour.mesh, minute.mesh],
      stairs: [stairs.mesh],
      dog: [dog.mesh, head.mesh],
      marek: [marekMesh],
    },
    /** The window's opening in the wall (world), for the snow behind it. */
    window: { wall: P.wall, far: P.far },
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
