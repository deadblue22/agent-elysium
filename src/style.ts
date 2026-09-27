// Style presets: prototypes of three directions drawn from the original's look, one per
// reference set in docs/style-refs.md. `?style=1`, `?style=2`, `?style=3`; digits combine
// (`?style=13`, `?style=123`). No parameter: the current look, unchanged.
//   1  the log and its overlays set in the original's UI conventions (甲组 对话与界面): speaker
//      names in bold serif, an en dash, hanging continuation lines, options in the body face
//      after 「1. -」, a CONTINUE bar, a band behind the hovered option, the check tooltip as the
//      original's check card, hover tips as its black captions, morale in its blue
//   2  light and colour after the original's paintings (乙组 油画与光色): blue-green shadows and
//      warm lights, a darker surround, paint mottling, a teal night for the flashback
//   3  the original's small iconic details, drawn at runtime (丙组 标志性细节): the film strip of
//      the dialogue panel and its scroll track, interaction markers, the check result slip,
//      the HUD clock, a torn paper title plaque, the Horrific Necktie as a bookmark ribbon

export type Preset = 1 | 2 | 3;

/** The presets a query string asks for (`?style=13` → 1 and 3). */
export function parseStyle(search: string): ReadonlySet<Preset> {
  const v = new URLSearchParams(search).get('style') ?? '';
  return new Set([...v].filter((c): c is '1' | '2' | '3' => c === '1' || c === '2' || c === '3').map((c) => Number(c) as Preset));
}
