/**
 * src/screens/list/Till.tsx — the hero. What the till will say, as a column.
 *
 * §3, the Flow Gauge: "the fill renders as a COLUMN, NOT A DIAL, because a dial
 * would rotate a fact that has no rotation in it." Money does not rotate
 * either, so the running total is a filled column in a milled channel, and the
 * exact figure is printed beside it at the scale's reserved top step —
 * II.6.20's one numeral per screen, 4.25rem, which on LIST is this one.
 *
 * THE FILL IS INSTANT, BY THE CHAPTER'S OWN RULE. §3: "transition: height 0ms;
 * commit is instant, never eased (II.1.1)". A basket total that eases into
 * place is a report arriving after the fact it reports. Zero script per frame,
 * and the only motion in the whole gauge family on this screen is the run-out
 * taper — which is the one value here that genuinely unfolds over time.
 *
 * HUE COUNT ZERO. This column is NOT live. §9's fourth failure mode is live
 * creep — "the one hue spreads past the single commit frame into chrome, rails,
 * or idle chips, spending the one color on furniture rather than fact." Spend
 * is not a running process, so the fill is ink in a nickel channel (measured
 * 7.63:1), and the only red anywhere on this screen is a window that is
 * genuinely open.
 *
 * TROPHY PRIVACY (owner ruling). "Basket totals and per-line prices are MASKED
 * with a milled blank plate — a kitchen screen facing a window must not publish
 * the household's grocery spend." The mask is a DECLARED state with its own
 * printed word, not a removal: the instrument is still there, still saying what
 * it is, and saying that it is not saying.
 */

import { forwardRef, useImperativeHandle, useRef } from "react";
import { Enclosure, Escutcheon } from "../../cd/foundry";
import { FRESHNESS, ageOf } from "../../cd/freshness/classes";
import { useAgeClock } from "../../cd/freshness/useAge";
import { formatPence, type TillReading } from "./model";

/**
 * ONE CLOCK, AND IT LIVES HERE (CD-BRIEF perf law, rule 4: "Isolate clocks ...
 * put it inside the one component that reads it, and give day-granularity
 * countdowns a 60s clock, not a 1s one"). The `price` class's threshold is
 * fourteen days, so a minute is already far finer than the reading needs, and
 * the register above never re-renders for it.
 */
const AGE_CLOCK_MS = 60_000;

/** The class's own declared threshold, printed on its own label. */
const PRICE_THRESHOLD = `${Math.round(FRESHNESS.price.staleAfterMs / 86_400_000)}d`;

/** The exact instant behind the age — spoken as a date, never as a wire string. */
const SPOKEN_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/London",
});

function spoken(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "an unknown date" : SPOKEN_DATE.format(new Date(t));
}

export interface TillHandle {
  /**
   * Write the reading straight to the DOM, inside the input's own task.
   * CD-BRIEF's measured perf law: "a `dispatch` alone does NOT satisfy the
   * Floor's 16ms acknowledgement, because the reducer runs during the NEXT
   * render." React re-renders afterwards and prints the same figures.
   */
  report: (reading: TillReading) => void;
}

export interface TillProps {
  reading: TillReading;
  /** ISO datetime the trip's prices were fixed — the envelope's own createdOn. */
  pricedOn: string;
  trophy: boolean;
}

export const Till = forwardRef<TillHandle, TillProps>(function Till(
  { reading, pricedOn, trophy },
  handleRef
) {
  const now = useAgeClock(AGE_CLOCK_MS);
  const age = ageOf("price", pricedOn, now);
  const fillRef = useRef<HTMLSpanElement | null>(null);
  const figureRef = useRef<HTMLSpanElement | null>(null);
  const overRef = useRef<HTMLSpanElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(handleRef, () => ({
    report(next: TillReading) {
      fillRef.current?.style.setProperty("--lst-fill", String(next.fill));
      if (figureRef.current) figureRef.current.textContent = formatPence(next.spentP);
      if (overRef.current) overRef.current.textContent = formatPence(next.overP);
      rootRef.current?.setAttribute("data-lst-over", next.overP > 0 ? "true" : "false");
    },
  }));

  return (
    <Enclosure
      variant="hero"
      className="lst-till"
      data-lst-over={reading.overP > 0 ? "true" : "false"}
      data-lst-stale={age.stale ? "true" : "false"}
      data-lst-masked={trophy ? "true" : "false"}
    >
      <div className="lst-till-body" ref={rootRef}>
        {/* THE CHANNEL. A recess milled through the epoxy coat into the nickel
            beneath it — II.2.3's inverted pair, the one place the full 1:2 cast
            vector is spent, and the reason the fill reads at 7.63:1. */}
        <div className="lst-column" role="img" aria-label={`spend against plan, ${Math.round(reading.fill * 100)} percent`}>
          <span
            className="lst-column-fill"
            ref={fillRef}
            style={{ "--lst-fill": String(reading.fill) } as React.CSSProperties}
          />
          {/* the printed index: the plan's own line, engraved at full height */}
          <span className="lst-column-index" aria-hidden="true" />
        </div>

        <div className="lst-till-read">
          <Escutcheon as="p" className="lst-till-name">
            till
          </Escutcheon>

          {trophy ? (
            /* the milled blank plate — the mask, declared and named */
            <p className="lst-mask" aria-label="basket total masked for privacy">
              <span className="lst-mask-word">private</span>
            </p>
          ) : (
            <p className="lst-till-figure">
              <span className="cd-hero-value lst-hero" ref={figureRef}>
                {formatPence(reading.spentP)}
              </span>
            </p>
          )}

          <div className="lst-till-band">
            <p className="lst-till-line" aria-hidden={trophy || undefined}>
              <span className="lst-till-key">plan</span>
              <span className="lst-till-val cd-data">
                {trophy ? "——" : formatPence(reading.plannedP)}
              </span>
            </p>

            <p className="lst-till-line" data-lst-role="warning">
              <span className="lst-till-key">over</span>
              <span className="lst-till-val cd-data" ref={overRef}>
                {trophy ? "——" : formatPence(reading.overP)}
              </span>
            </p>
          </div>

          {/* FRESHNESS. "Each class prints its DECLARED THRESHOLD on its own
              label; stale HOLDS the value ... with a printed state word and a
              fixed-position recovery action." The value below never moves; on
              this world the 55% ink of II.3.18 is spent in WEIGHT rather than
              alpha, because 55% of ink over epoxy measures 2.19:1 — see
              list.css's declared departure. */}
          <p className="lst-till-age">
            <span className="lst-till-key">price · {PRICE_THRESHOLD}</span>
            <span className="lst-till-val cd-data">{age.label}</span>
            {age.stale ? <span className="lst-till-word">{age.word}</span> : null}
            <span className="lst-vh">, priced {spoken(pricedOn)}</span>
          </p>
        </div>
      </div>
    </Enclosure>
  );
});
