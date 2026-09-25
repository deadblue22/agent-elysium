// The preinstalled Chromium used by the bake and screenshot tools (no `playwright install`).
// In a GPU-less container, WebGL2 comes from ANGLE on SwiftShader.
export const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export const CHROMIUM_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--use-gl=angle',
];
