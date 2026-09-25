// Lights: a low hemisphere fill, the cool light from the window side (soft shadows), the
// candle on the desk (warm, shadows, physical falloff), and a warm lamp pooling on the table.
import {
  AdditiveBlending, CanvasTexture, Color, DirectionalLight, Group, HemisphereLight, PointLight, SRGBColorSpace, SpotLight,
  Sprite, SpriteMaterial, type OrthographicCamera, type Vector3,
} from 'three';
import { glowTexture } from './puppets';

export function createLights(at: { candleLight: Vector3; candleFlame: Vector3; windowGlow: Vector3 }) {
  const group = new Group();
  group.name = 'lights';

  const hemi = new HemisphereLight('#8b909b', '#4d3626', 0.62);
  group.add(hemi);

  // cool light from the window side of the room: from the left, fairly low and a little in
  // front, so every row of the pop-up throws its shadow sideways across the floor beside it
  const key = new DirectionalLight('#dae2ea', 2.9);
  key.position.set(-11, 11, 4.5);
  key.target.position.set(0.3, 0, -0.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera as OrthographicCamera;
  sc.left = -10.5; sc.right = 10.5; sc.top = 10.5; sc.bottom = -10.5; sc.near = 4; sc.far = 36;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 3;
  key.shadow.intensity = 0.92; // paper lets a little light through
  group.add(key, key.target);

  // the candle: the only warm light in the room
  const flame = new PointLight('#ffa35a', 9, 0, 2);
  flame.position.copy(at.candleLight);
  flame.castShadow = true;
  flame.shadow.mapSize.set(1024, 1024);
  flame.shadow.camera.near = 0.04;
  flame.shadow.camera.far = 14;
  flame.shadow.bias = -0.002;
  flame.shadow.normalBias = 0.01;
  flame.shadow.radius = 5;
  group.add(flame);

  // daylight spilling in at the window: lights the wall and floor around it (it sits between
  // the wall and the furniture plane, whose fronts face away from it), no shadows
  const windowGlow = new PointLight('#a9bdd0', 4.2, 0, 2);
  windowGlow.position.copy(at.windowGlow);
  group.add(windowGlow);

  // a reading lamp outside the frame, in front of the book: the warm pool on the table and the
  // near half of the pages (the text). Aimed below the pop-up, so its fill does not wash out
  // the key's shadows between the rows; it sits near the eye's line, so its own shadows
  // mostly hide behind their casters (they still ground the puppets and dice)
  const lamp = new SpotLight('#ffdcb4', 330, 0, 0.5, 0.9, 2);
  lamp.position.set(0.6, 15, 8);
  lamp.target.position.set(-0.3, 0, 1.9);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.camera.near = 8;
  lamp.shadow.camera.far = 26;
  lamp.shadow.bias = -0.0006;
  lamp.shadow.normalBias = 0.02;
  lamp.shadow.radius = 5;
  lamp.shadow.intensity = 0.8;
  group.add(lamp, lamp.target);

  // the flame itself and its halo (emissive sprites, drawn over the paper)
  const flameSprite = new Sprite(new SpriteMaterial({ map: flameTexture(), color: new Color(2.2, 1.9, 1.55), transparent: true, depthWrite: false }));
  flameSprite.position.copy(at.candleFlame);
  flameSprite.scale.set(0.2, 0.36, 1);
  flameSprite.renderOrder = 5;
  const halo = new Sprite(new SpriteMaterial({ map: glowTexture('255,176,102', 128), blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.32 }));
  halo.position.copy(at.candleFlame);
  halo.scale.setScalar(1.5);
  halo.renderOrder = 4;
  group.add(flameSprite, halo);

  const base = flame.intensity;
  /** Stage cues drive these: the candle brighter in the flashback, flickering hard at the blow. */
  const candle = { boost: 1, flicker: 0.05 };
  const apply = (t: number) => {
    const f = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 13.1 + 1.7) * 0.3 + Math.sin(t * 2.1) * 0.2;
    const hard = candle.flicker > 0.1 ? Math.sin(t * 31 + 0.7) * 0.6 + Math.sin(t * 53) * 0.4 : 0; // gusts
    const k = 1 + candle.flicker * (f + hard);
    flame.intensity = base * candle.boost * Math.max(0.15, k);
    flameSprite.scale.set(0.2, 0.36 * candle.boost ** 0.5 * (1 + 0.8 * candle.flicker * (f + hard)), 1);
  };
  return {
    group, hemi, key, flame, lamp, windowGlow, candle,
    /** A slow, small flicker (t in seconds). */
    update(t: number) { apply(t); },
    /** Applies the candle's boost and flicker without animating it (a still frame). */
    settle() { apply(0); },
  };
}

/** The legacy board's candle flame (its SVG path and gradient), drawn once into a canvas. */
function flameTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 80; c.height = 144; // board region x 760..780, y 30..66 at 4x
  const x = c.getContext('2d')!;
  x.scale(4, 4);
  x.translate(-760, -30);
  const g = x.createLinearGradient(0, 35, 0, 61);
  g.addColorStop(0, 'rgba(255,207,122,.2)');
  g.addColorStop(0.3, '#ffc062');
  g.addColorStop(0.7, '#fff0c4');
  g.addColorStop(1, 'rgba(156,179,214,.8)');
  x.fillStyle = g;
  x.fill(new Path2D('M770,35 C775.5,45.5 777,53 770,61 C763,53 764.5,45.5 770,35 Z'));
  x.fillStyle = 'rgba(255,248,226,.9)';
  x.fill(new Path2D('M770,45 C772.3,50 772.5,54.5 770,59 C767.5,54.5 767.7,50 770,45 Z'));
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
