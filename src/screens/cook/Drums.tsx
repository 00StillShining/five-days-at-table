/**
 * src/screens/cook/Drums.tsx — the tape-counter, as drums rather than as type.
 *
 * 02 REEL LOGIC section 2: "Numerals are cast as tape-counter digits — a
 * mechanical-odometer read, each digit column FIXED-WIDTH and right-aligned,
 * NEVER a proportional font pretending to be a wheel."
 *
 * CORRECTIONARY 5.3: "Every value is an instrument. A needle over a printed
 * arc, a DRUM COUNTER, segmented digits ... plus its exact figure. A number
 * typeset on a background is not a readout and is not acceptable as one."
 *
 * So each character sits in its own machined column with a cylinder shade
 * across it, a hairline seam between columns, and the digit printed on the
 * drum's own equator. The columns never move — a wheel that spun on every
 * change would be motion with a value already committed behind it, which is
 * legal, but a 1Hz odometer roll is a motion the operator must wait through on
 * the hundredth use. The DRUM is the material claim; the change is instant.
 *
 * Each column is its own memo boundary for the same reason DotMatrix's
 * characters are: at 1Hz only the seconds column reconciles.
 */

import { memo } from "react";
import "./cook.css";

const Column = memo(function Column({ ch, separator }: { ch: string; separator: boolean }) {
  if (separator) {
    return (
      <span className="ck-drum-sep" aria-hidden="true">
        {ch}
      </span>
    );
  }
  return (
    <span className="ck-drum-col">
      <span className="ck-drum-face">{ch}</span>
    </span>
  );
});

export interface DrumsProps {
  /** The exact figure. Digits get drums; ':' and '-' get a printed separator. */
  value: string;
  /** Type step for the drum face. Default --cd-size-5 (1.75rem). */
  size?: string;
  /** II.3.18 — a frozen reading HOLDS at 55% ink. */
  held?: boolean;
  className?: string;
  label: string;
}

export function Drums({ value, size, held = false, className, label }: DrumsProps) {
  return (
    <span
      className={["ck-drums", "cd-data", className].filter(Boolean).join(" ")}
      style={size ? ({ "--ck-drum-size": size } as React.CSSProperties) : undefined}
      data-ck-held={held ? "true" : undefined}
      role="img"
      aria-label={`${label}: ${value}`}
    >
      {Array.from(value).map((ch, i) => (
        <Column key={i} ch={ch} separator={ch === ":" || ch === "-" || ch === "+"} />
      ))}
    </span>
  );
}
