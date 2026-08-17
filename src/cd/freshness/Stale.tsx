/**
 * src/cd/freshness/Stale.tsx — a reading that admits its own age.
 *
 * II.3.18's state set for a display: "stale (no data: needle HOLDS POSITION,
 * ink to 55%, stale lamp lit — the needle never invents motion)".
 * II.3.32 says the same for a data card: "Stale follows the gauge's law — held
 * value, ink to 55%, stale lamp."
 *
 * Four rules this component enforces so no screen has to remember them:
 *
 *  1. THE VALUE HOLDS. The last real reading stays on screen at full size and
 *     full position. It is not blanked, not dashed out, not replaced by a
 *     skeleton. A held reading is information; an em-dash is a shrug.
 *  2. INK TO 55%. The dimming is the second channel, never the only one.
 *  3. A PRINTED STATE WORD. II.7.7 — colour never travels alone; the word is
 *     what survives desaturation, forced-colours, and a squint.
 *  4. THE RECOVERY ACTION SITS AT A FIXED POSITION. It occupies its slot
 *     whether or not the reading is stale, so the control never moves under a
 *     hand that is reaching for it, and the layout never reflows when a value
 *     goes stale mid-glance.
 */

import type { ReactElement, ReactNode } from "react";
import type { Age } from "./classes";
import { STALE_INK_ALPHA } from "./classes";
import "./stale.css";

export interface StaleProps {
  /** The reading itself. Rendered identically whether fresh or stale. */
  children: ReactNode;
  /** The age, from useAge / ageOf. */
  age: Age;
  /**
   * The recovery action — "count this shelf", "check this price". Rendered in a
   * slot that is reserved whether or not it is currently offered, so it never
   * shifts the row.
   */
  action?: ReactNode;
  /** Accessible name for the reading, used to caption the age for screen readers. */
  label?: string;
  className?: string;
}

/**
 * Ink alpha is applied with `opacity` on an inner wrapper rather than by
 * swapping a colour token, for one reason: every language keys its own ink, and
 * a stale variant per language would be eight more hexes to keep in agreement
 * with eight fresh ones. 55% of whatever the world's committed ink already is
 * cannot drift out of step with it.
 *
 * The age line is NOT dimmed. When a reading is stale, its age is the most
 * load-bearing thing on the row.
 */
export function Stale({ children, age, action, label, className }: StaleProps): ReactElement {
  const stale = age.stale;
  return (
    <span
      className={["cd-stale", className].filter(Boolean).join(" ")}
      data-cd-stale={stale ? "true" : "false"}
    >
      <span
        className="cd-stale-value"
        style={{ opacity: stale ? STALE_INK_ALPHA : 1 }}
      >
        {children}
      </span>

      {/* The age, always printed. Honesty is not a stale-only courtesy. */}
      <span className="cd-stale-age cd-printed" aria-label={label ? `${label} age` : undefined}>
        {age.label}
      </span>

      {/* The state word. Printed, never a colour alone. Reserved so the row
          keeps its width when a reading crosses the threshold. */}
      <span className="cd-stale-word cd-silkscreen" aria-hidden={stale ? undefined : true}>
        {stale ? age.word : ""}
      </span>

      {/* The recovery action, at a FIXED position. The slot exists either way. */}
      <span className="cd-stale-action">{stale ? action : null}</span>
    </span>
  );
}

/**
 * The lamp half of II.3.18's stale state, for instruments that carry one.
 * Unlit it is still a lamp (II.3.24) — the lens and its well stay visible,
 * because a vanishing indicator is indistinguishable from a missing one.
 */
export function StaleLamp({ age, label = "stale" }: { age: Age; label?: string }): ReactElement {
  return (
    <span
      className="cd-lamp cd-stale-lamp"
      data-lit={age.stale ? "true" : "false"}
      role="img"
      aria-label={age.stale ? `${label}: ${age.word}, ${age.label}` : `${label}: current`}
    />
  );
}
