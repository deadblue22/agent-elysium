// The Chromium the bake, screenshot and play tools drive (playwright-core; no `playwright install`):
// CHROMIUM_PATH if set; on macOS the installed Google Chrome, on the GPU; elsewhere the cloud
// container's preinstalled Chromium, where WebGL2 comes from ANGLE on SwiftShader (no GPU).
const MAC = process.platform === 'darwin';

export const CHROMIUM = process.env.CHROMIUM_PATH
  || (MAC ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');

export const CHROMIUM_ARGS = MAC
  ? ['--use-angle=metal', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'];
