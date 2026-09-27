// Presentations of the dialogue and the HUD (docs/ui.md).
// The default (`?ui=de` says the same): the log is set as the original's dark dialogue panel,
// painted over the left page (white serif, bold capital names, skills in their attribute
// colours, check slips, the cyan CONTINUE bar with its red smear), with the original's HUD over
// the frame: Harry and Kim's portraits with morale over Harry's, the clock, the inner voices'
// cue, the check banner.
// `?ui=book`: the log printed on the page as the earlier rounds had it, morale as paper hearts
// on the table, no HUD.

export type Ui = 'de';

/** The presentation a query string asks for: 'de', or null for the book's (`?ui=book`). */
export function parseUi(search: string): Ui | null {
  return new URLSearchParams(search).get('ui') === 'book' ? null : 'de';
}
