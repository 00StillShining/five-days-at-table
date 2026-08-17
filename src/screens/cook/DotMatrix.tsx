/**
 * src/screens/cook/DotMatrix.tsx — II.3.21's strip, cast as real cells.
 *
 * Not a font pretending to be hardware: every dot is an element, lit or unlit,
 * and the unlit grid is always visible ("off-dots sit 4% in luminance above the
 * field — the grid is always readable as hardware"). 02 REEL LOGIC section 2:
 * "lit ink is a FLAT FILL, never a glow, because the doctrine grants one bulb
 * per world and the strip is a phosphor pretending to be print, not a second
 * light source." The one bulb is the record lamp; this strip does not glow.
 *
 * PERFORMANCE (CD-BRIEF measured performance law, rule 4 — budget renders, not
 * layers). A five-character strip is 175 cells. Re-rendering all 175 every
 * second to change one digit is the reconciliation cost that law is about, so
 * each CHARACTER is its own memo boundary keyed on its glyph: at 1Hz only the
 * seconds column's 35 cells reconcile, the tens column every ten seconds, and
 * the minutes columns once a minute. Measured in the browser: see the report.
 */

import { memo } from "react";
import { CELL_COLS, CELL_ROWS, glyphFor } from "./glyphs";
import "./cook.css";

const ROW_INDEX = Array.from({ length: CELL_ROWS }, (_, i) => i);
const COL_INDEX = Array.from({ length: CELL_COLS }, (_, i) => i);

const Char = memo(function Char({ ch }: { ch: string }) {
  const pattern = glyphFor(ch);
  return (
    <span className="ck-dm-char">
      {ROW_INDEX.map((r) =>
        COL_INDEX.map((c) => (
          <span
            key={`${r}-${c}`}
            className="ck-dm-dot"
            data-on={pattern[r][c] === "1" ? "true" : undefined}
          />
        ))
      )}
    </span>
  );
});

export type TransportGlyph = "play" | "pause" | "stop" | "alert" | "none";

export interface DotMatrixProps {
  /** The string to print. Uppercased; anything uncast prints blank. */
  text: string;
  /**
   * The flanking transport glyph (02 REEL LOGIC section 3 — "the counter and
   * the transport status share ONE strip rather than two").
   */
  glyph?: TransportGlyph;
  /** Cell pitch. Default is the chapter's committed 0.625rem. */
  pitch?: string;
  /** II.3.18's stale presentation: the value HOLDS, the ink drops to 55%. */
  held?: boolean;
  className?: string;
  /** The strip is decorative to assistive tech; the caller prints the words. */
  label?: string;
}

export function DotMatrix({
  text,
  glyph = "none",
  pitch,
  held = false,
  className,
  label,
}: DotMatrixProps) {
  return (
    <span
      className={["ck-dm", className].filter(Boolean).join(" ")}
      style={pitch ? ({ "--ck-dm-pitch": pitch } as React.CSSProperties) : undefined}
      data-ck-held={held ? "true" : undefined}
      role="img"
      aria-label={label ?? text}
    >
      {glyph !== "none" && <span className="ck-dm-glyph" data-ck-glyph={glyph} aria-hidden="true" />}
      {Array.from(text).map((ch, i) => (
        <Char key={i} ch={ch} />
      ))}
    </span>
  );
}
