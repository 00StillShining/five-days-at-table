/**
 * src/screens/cook/glyphs.ts — the 5x7 cell font, and nothing else.
 *
 * II.3.21 — "Character cell 5x7 dots; pitch 0.625rem; dot diameter 80% of
 * pitch; one empty column between characters. Off-dots sit 4% in luminance
 * above the field — the grid is always readable as hardware."
 *
 * 02 REEL LOGIC section 3 binds the strip to `HH:MM:SS` and adds "a single
 * flanking dot-matrix glyph for transport state — a filled triangle for play,
 * two bars for pause — so the counter and the transport status share one strip
 * rather than two." That glyph is a clip-path shape (see cook.css), not a cell
 * pattern, exactly as the chapter's own fence draws it.
 *
 * THE FULL A-Z IS CAST, and it did not start that way. The first cut cast only
 * the letters COOK's own words needed, on the reasoning that "a font with
 * letters no screen uses is a font that lies about how much of it was checked".
 * That reasoning was wrong twice inside one build: W was missed, so the strip
 * printed the transport word WAIT with a blank first cell, and G was missed, so
 * the freshness word NO SIGNAL would have done the same. An uncast glyph fails
 * SILENTLY — the fallback is a blank — and a partial alphabet turns every later
 * word change into a chance to ship one. Eight more entries close the class.
 * cook.test.ts pins both halves: full coverage, and 5x7 cells throughout.
 */

export const CELL_ROWS = 7;
export const CELL_COLS = 5;

/** Row-major, "1" lit. Seven strings of five, one glyph. */
export const FONT: Record<string, readonly string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "01010", "00100", "00100", "00100", "01010", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};

const BLANK = FONT[" "];

/**
 * The pattern for one character.
 *
 * AN UNCAST GLYPH IS A SILENT LIE, and this build shipped one: the strip
 * printed the transport word WAIT with a blank first cell for a full render
 * cycle, because W was never cast and the fallback returned a blank instead of
 * complaining. A readout that prints nothing where a letter should be is worse
 * than one that prints a box — the operator reads "AIT" and believes it.
 *
 * So the fallback still degrades to blank in production (a strip that throws
 * mid-cook would be a far worse failure than a missing stroke), but in
 * development it says so, loudly, the first time it happens.
 */
export function glyphFor(ch: string): readonly string[] {
  const hit = FONT[ch.toUpperCase()];
  if (!hit) {
    if (import.meta.env?.DEV) {
      console.error(
        "[cook/glyphs] '%s' is not cast in the 5x7 font — the dot-matrix strip " +
          "will print a BLANK cell where a letter belongs. Cast it in glyphs.ts.",
        ch
      );
    }
    return BLANK;
  }
  return hit;
}
