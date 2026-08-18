/**
 * src/screens/list/StationBar.tsx — the regulator, re-cast as which shop you
 * are standing in.
 *
 * §3, THE REGULATOR DIAL: "IRREDUCIBLE's delta is SCARCITY ... three seats
 * only ... because the real object offers exactly three flow rates, and a dial
 * pretending to finer resolution, OR ONE THAT COULD SPIN PAST ITS OWN LAST
 * SETTING, would be decorating an installer's decision with false precision."
 *
 * A trip offers exactly as many stations as it has shops. So this control has
 * exactly that many seats — two, three, or one — with a HARD STOP at each end
 * and never a wrap, which is the chapter's own refusal restated. The seated
 * value IS the semantic value (II.1.11); there is no position between seats.
 *
 * TWO DECLARED DELTAS FROM §3, both stated rather than smuggled:
 *
 * 1. IT IS NOT A DIAL. §3 puts the regulator "behind the maintenance latch,
 *    never on the primary faceplate", because on the real fixture a flow rate
 *    is an installer's decision. Which shop you are standing in is not: it is
 *    the second most frequent gesture on this screen, and screencraft/02's
 *    reach law puts daily gestures on the faceplate. It also does not rotate —
 *    §3's own argument against the dial for the flow gauge applies verbatim
 *    ("a dial would rotate a fact that has no rotation in it"), so the seats
 *    run in a line and the ink mark travels along them.
 * 2. Its SEAT GRAMMAR is unchanged: hard stops, no wrap, the 110ms snap on
 *    cubic-bezier(0.60, 0, 0.10, 1) (--cd-ease-snap), and the Foundry's own
 *    detent tick at 1800Hz, always through the 8/s coalescer, never raw —
 *    "a detent's pitch is the size of its seat, not a language's taste."
 */

import { useCallback, useRef } from "react";
import { Enclosure } from "../../cd/foundry";
import { cue } from "../../cd/sound/cues";
import type { Station } from "./model";

export interface StationBarProps {
  stations: Station[];
  activeCode: string;
  /** Rows still owed at each station, keyed by code. Zero prints CLEAR. */
  owed: Record<string, number>;
  onSeat: (code: string) => void;
}

export function StationBar({ stations, activeCode, owed, onSeat }: StationBarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const index = Math.max(0, stations.findIndex((s) => s.code === activeCode));

  const seat = useCallback(
    (next: number, focus: boolean) => {
      // The hard stop: clamped at both ends, NEVER wrapped (§3's own delta).
      const clamped = Math.min(stations.length - 1, Math.max(0, next));
      if (clamped === index) return;
      cue("detent"); // through the coalescer — II.5.11, never the raw tick
      onSeat(stations[clamped].code);
      if (focus) {
        const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>("[data-lst-seat]");
        buttons?.[clamped]?.focus();
      }
    },
    [index, onSeat, stations]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const key = event.key;
      if (key === "ArrowRight" || key === "ArrowDown") {
        event.preventDefault();
        seat(index + 1, true);
      } else if (key === "ArrowLeft" || key === "ArrowUp") {
        event.preventDefault();
        seat(index - 1, true);
      } else if (key === "Home") {
        event.preventDefault();
        seat(0, true);
      } else if (key === "End") {
        event.preventDefault();
        seat(stations.length - 1, true);
      }
    },
    [index, seat, stations.length]
  );

  if (stations.length === 0) return null;

  return (
    <Enclosure variant="pod" className="lst-stations">
      <div
        ref={rootRef}
        className="lst-station-track"
        role="radiogroup"
        aria-label="station"
        onKeyDown={onKeyDown}
        style={
          {
            "--lst-station-count": String(stations.length),
            "--lst-station-index": String(index),
          } as React.CSSProperties
        }
      >
        {/* THE SEATED WEDGE. One element, travelling — the dial's own ink mark
            rotated into a line, at §3's 110ms snap. */}
        <span className="lst-station-mark" aria-hidden="true" />

        {stations.map((station, i) => {
          const left = owed[station.code] ?? 0;
          return (
            <button
              key={station.code}
              type="button"
              data-lst-seat={i}
              className="lst-station cd-focusable"
              role="radio"
              aria-checked={i === index}
              tabIndex={i === index ? 0 : -1}
              data-lst-clear={left === 0 ? "true" : "false"}
              onClick={() => seat(i, false)}
            >
              <span className="lst-station-word">{station.seat}</span>
              <span className="lst-station-count cd-data">{left === 0 ? "clear" : left}</span>
              <span className="lst-vh">
                {`${station.name}, ${left === 0 ? "nothing left to fetch" : `${left} still owed`}`}
              </span>
            </button>
          );
        })}
      </div>
    </Enclosure>
  );
}
