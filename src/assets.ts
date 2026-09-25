// Loads the baked paper textures (public/textures, see tools/bake.mjs) and the fonts.
import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';

export interface ArtPiece {
  texture: Texture;
  /** The SVG viewBox the texture was baked from: [x, y, w, h] in board px. */
  viewBox: [number, number, number, number];
  /** World size (1 unit = 100 board px). */
  world: [number, number];
  px: [number, number];
  /** data-* attributes of the source SVG (e.g. tearMin, tearMax, columnY0 on the torn sheets). */
  meta: Record<string, number>;
}
export type Art = Record<string, ArtPiece>;

interface Manifest {
  unit: number;
  textures: Record<string, { file: string; px: [number, number]; viewBox: [number, number, number, number]; world: [number, number]; scale: number; meta?: Record<string, number> }>;
}

const BASE = import.meta.env.BASE_URL;

export async function loadArt(anisotropy: number): Promise<Art> {
  const res = await fetch(`${BASE}textures/manifest.json`);
  if (!res.ok) throw new Error(`textures/manifest.json: ${res.status} (run npm run bake)`);
  const manifest = (await res.json()) as Manifest;
  const loader = new TextureLoader();
  const entries = await Promise.all(Object.entries(manifest.textures).map(async ([name, t]) => {
    const texture = await loader.loadAsync(BASE + t.file);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = anisotropy;
    texture.name = name;
    if (name === 'table') texture.wrapS = texture.wrapT = RepeatWrapping;
    return [name, { texture, viewBox: t.viewBox, world: t.world, px: t.px, meta: t.meta ?? {} }] as const;
  }));
  return Object.fromEntries(entries);
}

/** The subsets written by tools/subset-fonts.mjs (npm run fonts). */
const FACES: [family: string, file: string, weight: string][] = [
  ['Elysium Serif SC', 'serif-sc-400.woff2', '400'],
  ['Elysium Serif SC', 'serif-sc-600.woff2', '600'],
  ['Elysium Sans SC', 'sans-sc-600.woff2', '600'],
  ['Elysium Mono SC', 'mono-sc-400.woff2', '400'],
  ['EB Garamond', 'eb-garamond-400.woff2', '400'],
  ['EB Garamond', 'eb-garamond-600.woff2', '600'],
  ['Inter', 'inter-600.woff2', '600'],
  ['JetBrains Mono', 'jetbrains-mono-400.woff2', '400'],
];

/** Resolves once every face is loaded, so the first canvas paint never uses a fallback font. */
export async function loadFonts(): Promise<void> {
  await Promise.all(FACES.map(async ([family, file, weight]) => {
    const face = new FontFace(family, `url(${BASE}fonts/${file}) format("woff2")`, { weight, display: 'block' });
    document.fonts.add(face);
    await face.load();
  }));
  await document.fonts.ready;
}
