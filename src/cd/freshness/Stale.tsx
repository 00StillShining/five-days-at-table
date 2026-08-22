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
 * ORCHESTRATOR REPAIR. This used to dim the value with `opacity: 0.55`, and the
 * reasoning above it was half right: an alpha cannot drift out of step with a
 * world's committed ink, which is true, and it also cannot be stopped from
 * crossing the Floor, which is fatal.
 *
 * MEASURED, on three consumers of this very component:
 *   PLAN  DayRegister "logged"   #1F5C3D -> #7C997F   2.52:1
 *   PLAN  SwapDeck coverage %    #143C28 -> #768874   3.06:1
 *   PLAN  SwapDeck the % unit    #6F6659 -> #A89F8F   2.11:1
 * and independently on STORES, where the held level word printed at 2.68:1 and
 * rendered as a visible ghost beside its neighbour.
 *
 * The fix keeps the original concern and drops the alpha: `--cd-muted-ink` is
 * ALREADY declared per language and ALREADY verified against that world's own
 * ground, so it cannot drift either — and it is a colour, not a veil over one.
 * A world that wants a distinct stale ink declares `--cd-stale-ink`; the
 * default is the muted ink it already keeps in agreement.
 *
 * The alpha remains exported from ./classes for the reduced-motion transition
 * and for anything that dims a NON-READING, but no reading may wear it.
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
      <span className="cd-stale-value">{children}</span>

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
