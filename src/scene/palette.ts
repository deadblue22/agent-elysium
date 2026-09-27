// The light and grade of ?style=2, after the original's paintings (docs/style-refs.md 乙组):
// Rostov's interiors keep a cold daylight at the windows against warm lamps, sink the shadows
// into blue-green and the surround into near black, and leave brushwork visible in the flat
// areas. Here: a blue-green window light and fill against a deeper orange lamp and candle, a
// split tone (blue-green darks, warm lights), a small saturation trim, paint mottling, a
// darker and wider vignette whose edge wanders like a painted frame's, and a teal flashback
// night. Applied before the stage cues read their base values, so the flashback, the blow
// and the ending scale from these.
import type { createLights } from './lights';
import type { createPost } from './post';

export function applyPainting(lights: ReturnType<typeof createLights>, post: ReturnType<typeof createPost>) {
  const { hemi, key, windowGlow, lamp, flame } = lights;
  hemi.color.set('#6f8a8f');
  hemi.groundColor.set('#3b2922');
  hemi.intensity = 0.3;
  key.color.set('#cde0e3');
  key.intensity = 4.5;
  windowGlow.color.set('#93bfca');
  windowGlow.intensity = 3;
  lamp.color.set('#ffc58a');
  lamp.intensity = 310;
  flame.color.set('#ff8f45'); // (its intensity follows the candle's flicker)
  const u = post.uniforms;
  u.uExposure.value = 1.04;
  u.uContrast.value = 1.14;
  u.uBlueShift.value.set(0.07, 0.12);
  u.uToneLow.value.set(0.34, 0.52, 0.54, 0.65);
  u.uToneHigh.value.set(0.66, 0.56, 0.42, 0.45);
  u.uSaturation.value = 0.92;
  u.uMottle.value = 0.1;
  u.uVignetteColor.value.set(3 / 255, 4 / 255, 6 / 255);
  u.uVignetteShape.value.set(0.4, 0.72, 0.52, 0.95);
  u.uNightTint.value.set(0.72, 0.93, 1.13);
  post.addGlow(0.32, 0.55, 0.92);
}
