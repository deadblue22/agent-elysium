// Looks: bold presets of light, mood and grime after the original's cold, bleak and dramatic
// pictures (docs/look.md), against the earlier rounds' warm picture book. winter is the default
// (`?look=winter` says the same); ?look=noir; ?look=warm: the warm picture book, no preset.
//   winter  a low winter sun from behind the room on the window's side throws long, hard,
//           blue-grey shadows across the room and the table; the wall stops it but for the
//           window, which lets it in as a shaft with dust (src/scene/shaft.ts); the reading lamp
//           is off and the candle a small warm point; the snow outside glares; a drained grade
//           that keeps the rust, lifted cold blacks; grime (src/scene/grime.ts).
//   noir    night: the room is dark but for the moon through the window (the reading lamp moved
//           out behind it: a shaft with dust and motes) and the candle's warm pool with its
//           steep falloff, golden motes round it; narrow beams keep the log and the table's
//           leads, hearts and dice readable; Harry and Kim stand as silhouettes, Marek walks
//           the flashback in a cold light of his own; crushed blacks, a deep vignette that
//           spares the log; grime.
// Applied after the lights and the post pass exist and before the stage cues read their base
// values, so the flashback's night, the blow's dark beat and the ending's dimming scale from
// the look's. The cues never touch the reading lamp or the key's colour: the look drives those
// itself, following the flashback's night (update).
import {
  AdditiveBlending, Color, SpotLight, Sprite, SpriteMaterial, Vector3, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, type Scene,
} from 'three';
import type { Art } from '../assets';
import { applyGrime } from './grime';
import type { createLights } from './lights';
import type { PieceHandle } from './popup';
import type { createPost } from './post';
import { glowTexture } from './puppets';
import { createShaft } from './shaft';
import { BASE_Y, DEG, wx } from './space';

export type Mood = 'winter' | 'noir';

/** The look a query string asks for: winter unless it says `?look=noir`, or null for `?look=warm`. */
export function parseMood(search: string): Mood | null {
  const v = new URLSearchParams(search).get('look');
  return v === 'warm' ? null : v === 'noir' ? 'noir' : 'winter';
}

/**
 * The key's penumbra for createLights (it is compiled into the shaders): the winter sun is a
 * small, hard source; the other looks keep the default.
 */
export function moodShadows(mood: Mood | null): { angle: number; max: number } | undefined {
  return mood === 'winter' ? { angle: 1.2, max: 0.16 } : undefined;
}

interface Deps {
  art: Art;
  scene: Scene;
  lights: ReturnType<typeof createLights>;
  post: ReturnType<typeof createPost>;
  popup: { pieces: Record<string, PieceHandle> };
  /** The camera's focal length, frame px (the motes' size). */
  focal: number;
}

/** The window hole in wall.svg (the hover region and the snow use the same). */
const HOLE = { x0: 342, x1: 628, y0: 108, y1: 338, base: 440 };
/** The wall leans back this far, folded flat it lies forward at -80 (cues.ts FOLDED). */
const WALL_LEAN = 18, WALL_FOLDED = -80;

/**
 * A world direction of travel from its elevation (degrees below the horizon) and azimuth (degrees
 * from straight toward the reader, +z, turning right, +x).
 */
const along = (el: number, az: number) => new Vector3(Math.cos(el * DEG) * Math.sin(az * DEG), -Math.sin(el * DEG), Math.cos(el * DEG) * Math.cos(az * DEG));

export function applyMood(mood: Mood, d: Deps) {
  const { lights, post, scene } = d;
  const { hemi, key, windowGlow, lamp, flame, candle, halo } = lights;
  const u = post.uniforms;
  const W = mood === 'winter';

  // ---- the window hole, world, with the wall standing
  const wall = d.popup.pieces.wall.group;
  wall.updateMatrixWorld(true);
  const onWall = (x: number, y: number) => wall.localToWorld(new Vector3(wx(x), (HOLE.base - y) / 100, 0));
  const corner = onWall(HOLE.x0, HOLE.y1);
  const hole = { corner, across: onWall(HOLE.x1, HOLE.y1).sub(corner), up: onWall(HOLE.x0, HOLE.y0).sub(corner) };
  const middle = corner.clone().addScaledVector(hole.across, 0.5).addScaledVector(hole.up, 0.5);

  if (W) {
    // a low winter sun from the left and behind, the window's side: long, hard shadows run right
    // and toward the reader across the room and the table, blue-grey where it does not reach;
    // the wall stops it but for the window, which lets a shaft of it into the room. The
    // reading lamp is off by day; in the flashback's night it comes on, cold and dim, for the
    // log (without shadows: the sun grounds everything)
    key.position.set(0.3, 0, -0.8).addScaledVector(along(21, 52).negate(), 14);
    key.color.set('#fff1e0');
    key.intensity = 9;
    lamp.castShadow = false;
    lamp.color.set('#c9d5e8');
    lamp.intensity = 0;
    hemi.color.set('#8796ad');
    hemi.groundColor.set('#2c2f36');
    hemi.intensity = 0.42;
    scene.environmentIntensity = 0.09;
    windowGlow.color.set('#dbe7f3'); // the snow's glare, in at the window
    windowGlow.intensity = 3.6;
    flame.color.set('#ff9a4a');
    candle.power = 7; // a small, lonely warm point
    halo.scale.setScalar(0.9);
    u.uExposure.value = 1.0;
    u.uGrade.value = 0.3;
    u.uContrast.value = 1.2;
    u.uSaturation.value = 0.5;
    u.uBlueShift.value.set(0.03, 0.4); // the wallpaper and the rug toward a grey-blue
    u.uAccent.value.set(0.045, 0.075, 0.95, 1); // the rust, the options, Kim's jacket
    u.uToneLow.value.set(0.32, 0.41, 0.54, 0.7);
    u.uToneHigh.value.set(0.5, 0.51, 0.52, 0);
    u.uLift.value.set(0.035, 0.045, 0.06);
    u.uVignetteColor.value.set(0.04, 0.05, 0.065);
    u.uVignetteShape.value.set(0.45, 0.74, 0.34, 0.8);
    u.uQuietLook.value = 0.3; // the log keeps its black ink
    u.uNightTint.value.set(0.74, 0.9, 1.12);
  } else {
    // night: a faint cold moon over everything, and the room's own moon through the window: the
    // reading lamp, moved out behind it. It stands far off, so its rays run nearly parallel,
    // and its cone just takes in the hole (the wall stops the rest)
    key.position.set(0.3, 0, -0.8).addScaledVector(along(38, 30).negate(), 14);
    key.color.set('#8ea6d0');
    key.intensity = 0.55;
    const ray = along(21, 46), far = 30;
    lamp.position.copy(middle).addScaledVector(ray, -far);
    lamp.target.position.copy(middle).addScaledVector(ray, 6);
    lamp.angle = Math.atan(2.3 / far);
    lamp.penumbra = 0.3;
    lamp.decay = 0; // no falloff: moonlight, not a bulb
    lamp.color.set('#b9cdf2');
    lamp.intensity = 4.2;
    lamp.shadow.camera.near = far - 3;
    lamp.shadow.camera.far = far + 14;
    lamp.shadow.radius = 3;
    lamp.shadow.intensity = 1;
    lamp.shadow.bias = -0.0003;
    hemi.color.set('#26324a');
    hemi.groundColor.set('#040406');
    hemi.intensity = 0.1;
    scene.environmentIntensity = 0.02;
    windowGlow.color.set('#8fb2e6');
    windowGlow.intensity = 2.2;
    flame.color.set('#ff9440');
    flame.distance = 5.5; // the pool ends: a steep falloff into the dark
    candle.power = 30;
    halo.scale.setScalar(2.2);
    // the log in a narrow beam from above, so the text stays readable in the dark, and a dimmer
    // one on the table beside the book: the leads, the morale hearts and the dice
    const beam = (name: string, intensity: number, angle: number, from: [number, number, number], to: [number, number, number]) => {
      const b = new SpotLight('#e9edf2', intensity, 0, angle, 0.55, 0);
      b.name = name;
      b.position.set(...from);
      b.target.position.set(...to);
      lights.group.add(b, b.target);
    };
    beam('log-beam', 1.8, 0.26, [-3.1, 13, 6.2], [-3.45, BASE_Y, 1.25]);
    beam('table-beam', 1.1, 0.16, [7.6, 13, 5.2], [8.15, 0, 1.0]);
    u.uExposure.value = 1.05;
    u.uGrade.value = 0;
    u.uContrast.value = 1.22;
    u.uSaturation.value = 0.78;
    u.uAccent.value.set(0.09, 0.1, 1.05, 1); // the candle's gold
    u.uToneLow.value.set(0.3, 0.4, 0.56, 0.65);
    u.uToneHigh.value.set(0.62, 0.53, 0.4, 0.3);
    u.uLift.value.set(-0.018, -0.016, -0.01);
    u.uVignetteColor.value.set(0.004, 0.006, 0.012);
    u.uVignetteShape.value.set(0.3, 0.7, 0.55, 0.97);
    u.uQuietLook.value = 0.2; // the log out of the vignette
    u.uNightTint.value.set(0.8, 0.92, 1.1);
    u.uNightDepth.value = 0.5; // already night: the flashback only goes a little colder
    // Harry and Kim without the lamp's bounce on their fronts: silhouettes against the moon
    for (const who of ['harry', 'kim']) {
      const m = scene.getObjectByName(who) as Mesh | undefined;
      if (m) (m.material as MeshStandardMaterial).emissive.setScalar(0.004);
    }
  }
  // the key's own colour at full day; winter's sun goes to a dimmer cold light in the flashback's
  // night (the cues scale the key's intensity, never its colour), still enough for the log
  const sun = key.color.clone(), moonlit = new Color('#8298bd').multiplyScalar(0.72);
  // the view outside: the snow's glare by day, a moonlit night
  const outside = d.popup.pieces.far.mesh.material as MeshBasicMaterial;
  outside.color.copy(W ? new Color(1.35, 1.38, 1.42) : new Color(0.2, 0.26, 0.4));

  // the glare round the window: the snow outside by day, the moon by night (a sprite: a bloom
  // pass costs several ms a frame)
  const glare = new Sprite(new SpriteMaterial({
    map: glowTexture(W ? '222,234,250' : '150,178,235', 128), blending: AdditiveBlending, transparent: true, depthWrite: false,
  }));
  const glareOn = W ? 0.55 : 0.14;
  glare.position.copy(middle).addScaledVector(new Vector3(0, 0, 1).transformDirection(wall.matrixWorld), 0.12);
  glare.scale.set(6.5, 5, 1);
  glare.renderOrder = 4;
  glare.name = 'glare';
  scene.add(glare);

  const shaft = createShaft({
    light: W ? key : lamp, hole, length: W ? 13 : 9, floorY: BASE_Y + 0.01, focal: d.focal,
    color: W ? new Color(1, 0.96, 0.9) : new Color(0.62, 0.74, 1),
    density: W ? 0.42 : 0.95, thin: W ? 0.2 : 0.3,
    motes: {
      shaft: W ? 110 : 180, candle: W ? 0 : 90, size: 0.028,
      color: W ? new Color(2.2, 2.1, 1.9) : new Color(2.4, 2.0, 1.2),
      warm: new Color(3.2, 2.1, 0.8),
      candleAt: flame.position.clone(),
    },
  });
  scene.add(shaft.mesh);
  if (shaft.points) scene.add(shaft.points);

  // grime and decay over the room, the pages and the table (slush under the window by day)
  applyGrime(scene, d.art, W ? 1 : 0.85, W ? 1 : 0);

  const lampOn = W ? 190 : lamp.intensity;
  let late = false;
  return {
    /**
     * Per frame (t: seconds, 0 when frozen): the shaft rises with the wall and, by day, goes with
     * the flashback's night. True: render another frame (the shaft's light has no shadow map yet).
     */
    update(t: number): boolean {
      if (!late) {
        late = true;
        // made by the stage cues, after the look: the snow on the roofs outside, and Marek, who
        // in the dark needs a little cold light of his own (a figure remembered, not seen)
        const snow = scene.getObjectByName('far-snow') as Mesh | undefined;
        if (snow) (snow.material as MeshBasicMaterial).color.copy(W ? new Color(1.3, 1.34, 1.4) : new Color(0.34, 0.42, 0.58));
        const marek = scene.getObjectByName('marek') as Mesh | undefined;
        if (marek && !W) (marek.material as MeshStandardMaterial).emissive.setRGB(1.0, 1.15, 1.5); // (times his near-black drawing)
      }
      const lean = -wall.rotation.x / DEG;
      const rise = Math.min(1, Math.max(0, (lean - WALL_FOLDED) / (WALL_LEAN - WALL_FOLDED))) ** 6;
      const night = u.uNight.value, day = W ? 1 - night : 1;
      if (W) key.color.copy(sun).lerp(moonlit, night);
      lamp.intensity = W ? lampOn * night : lampOn * rise;
      (glare.material as SpriteMaterial).opacity = glareOn * rise * day;
      glare.visible = rise * day > 0.001;
      return shaft.update(t, rise * day, 1 - candle.out);
    },
    setScale: shaft.setScale,
  };
}
