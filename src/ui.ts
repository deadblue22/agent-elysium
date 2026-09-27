// Presentations of the dialogue and the HUD after the original's interface (docs/ui.md).
// `?ui=de`: the log is set as the original's dark dialogue panel, painted over the left page
// (white serif, bold capital names, skills in their attribute colours, check slips, the cyan
// CONTINUE bar with its red smear), with the original's HUD over the frame: Harry and Kim's
// portraits with health and morale pips, the clock, the tool icons, the inner voices' cue,
// the check banner. No parameter: the current look, unchanged.

export type Ui = 'de';

/** The presentation a query string asks for, or null. */
export function parseUi(search: string): Ui | null {
  return new URLSearchParams(search).get('ui') === 'de' ? 'de' : null;
}
