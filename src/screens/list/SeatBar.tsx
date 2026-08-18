/**
 * src/screens/list/SeatBar.tsx — one seat per line on the trip, filled as it goes.
 *
 * II.3.19's bar meter, adapted the way §3 adapts it: "base casting 1.25rem
 * wide, segmented fill under an unlit cover ... the zone colors live on the
 * track; an unlit cover hides the unfilled region, so ZONE GEOMETRY NEVER
 * MOVES." Here it runs horizontally and its segments are the trip's own lines —
 * forty-four on a full Week-A shop, thirty-nine on the Morrisons tester, seven
 * on a day-7 top-up. The segment count is DERIVED from the envelope; there is
 * no place to type it.
 *
 * WHY THIS EXISTS BESIDE THE TILL. They answer different questions with
 * different arithmetic: the till says what the till will say, and the seat bar
 * says how much walking is left. Money is continuous and gets a continuous
 * column; lines are discrete and get discrete seats. The formal difference is
 * the argument that they are two readings and not one drawn twice.
 *
 * MEASURED: ink #333435 on the nickel channel floor #C7CBCD = 7.63:1, so a lit
 * seat and an unlit one are separated far past the 3:1 graphical floor without
 * spending a single hue — which is this world's whole §2 argument.
 */

import { forwardRef, useImperativeHandle, useRef } from "react";
import { Enclosure, Escutcheon } from "../../cd/foundry";

export interface SeatBarHandle {
  report: (got: number, total: number) => void;
}

export interface SeatBarProps {
  got: number;
  total: number;
  trophy: boolean;
}

export const SeatBar = forwardRef<SeatBarHandle, SeatBarProps>(function SeatBar(
  { got, total, trophy },
  handleRef
) {
  const coverRef = useRef<HTMLSpanElement | null>(null);
  const gotRef = useRef<HTMLSpanElement | null>(null);

  useImperativeHandle(handleRef, () => ({
    report(nextGot: number, nextTotal: number) {
      const pct = nextTotal <= 0 ? 0 : (nextGot / nextTotal) * 100;
      coverRef.current?.style.setProperty("--lst-got", `${pct}%`);
      if (gotRef.current) gotRef.current.textContent = String(nextGot);
    },
  }));

  const pct = total <= 0 ? 0 : (got / total) * 100;

  return (
    <Enclosure variant="hero" className="lst-seats" data-lst-masked={trophy ? "true" : "false"}>
      <p className="lst-seats-head">
        <Escutcheon className="lst-seats-name">picked up</Escutcheon>
        <span className="lst-seats-figure" aria-hidden="true">
          <span className="cd-data lst-seats-got" ref={gotRef}>
            {got}
          </span>
          <span className="lst-seats-of">of</span>
          <span className="cd-data lst-seats-total">{total}</span>
        </span>
      </p>

      <div
        className="lst-seatbar"
        style={{ "--lst-seat-count": String(Math.max(1, total)) } as React.CSSProperties}
        role="img"
        aria-label={`${got} of ${total} lines picked up`}
      >
        <span className="lst-seatbar-track" aria-hidden="true" />
        {/* the unlit cover — the geometry beneath it never moves (II.3.19) */}
        <span
          className="lst-seatbar-cover"
          ref={coverRef}
          aria-hidden="true"
          style={{ "--lst-got": `${pct}%` } as React.CSSProperties}
        />
      </div>
    </Enclosure>
  );
});
