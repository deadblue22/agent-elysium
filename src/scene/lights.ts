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

  const hemi = new HemisphereLight('#8b909b', '#4d3626', 1.05);
  group.add(hemi);

  // cool daylight from the window side of the room: upper left, a little in front
  const key = new DirectionalLight('#dae2ea', 1.9);
  key.position.set(-8.5, 14, 5);
  key.target.position.set(0.3, 0, -0.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera as OrthographicCamera;
  sc.left = -9.5; sc.right = 9.5; sc.top = 8.5; sc.bottom = -8.5; sc.near = 4; sc.far = 34;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 3;
  key.shadow.intensity = 0.88; // paper lets a little light through
  group.add(key, key.target);

  // the candle: the only warm light in the room
  const flame = new PointLight('#ffa35a', 8, 0, 2);
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
  const windowGlow = new PointLight('#a9bdd0', 3.2, 0, 2);
  windowGlow.position.copy(at.windowGlow);
  group.add(windowGlow);

  // a reading lamp outside the frame: the warm pool on the table and the pages
  const lamp = new SpotLight('#ffdcb4', 330, 0, 0.55, 1, 2);
  lamp.position.set(0.6, 15.5, 6.5);
  lamp.target.position.set(-0.3, 0, 0.5);
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
  return {
    group, hemi, key, flame, lamp, windowGlow,
    /** A slow, small flicker. */
    update(t: number) {
      const f = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 13.1 + 1.7) * 0.3 + Math.sin(t * 2.1) * 0.2;
      flame.intensity = base * (1 + 0.05 * f);
      flameSprite.scale.set(0.2, 0.36 * (1 + 0.04 * f), 1);
    },
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
