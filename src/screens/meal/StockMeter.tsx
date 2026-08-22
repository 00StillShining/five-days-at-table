/**
 * src/screens/meal/StockMeter.tsx — II.3.19's bar meter, on the one question the
 * wheel changes the answer to.
 *
 * ch.16's Dense Dashboard names this exact treatment: "buffer health renders as
 * a BAR METER (→II.3.19) rather than a percentage numeral, segments printed
 * under an unlit cover, because this world reports capacity as a FILLED SHAPE
 * before it reports capacity as a digit."
 *
 * WHY THIS INSTRUMENT AND NOT A FIFTH MACRO GAUGE. CD-BRIEF ruling 6 bans
 * ornament without function, and the five macros all scale by exactly the same
 * factor as the wheel — five bars would be one bar drawn five times, and the
 * Refined rung would delete four of them. Coverage does not: what the plate
 * NEEDS scales with the wheel, what is in the house does not, and each
 * ingredient's contribution is capped at its own need. So turning the wheel
 * moves this meter non-linearly, past thresholds, and the movement is the
 * answer to a question the operator actually has.
 *
 * HONESTY. The figure is the exact percentage; the age is the newest stocktake
 * behind it; the class threshold (72h, FRESHNESS.stocktake) prints on the
 * label; stale HOLDS the value at 55% ink with the printed word UNCOUNTED and a
 * fixed-position recovery action that occupies its slot whether or not the
 * reading is stale (II.3.18, and cd/freshness/Stale.tsx's four rules).
 */

import { forwardRef, useImperativeHandle, useRef } from "react";
import { Enclosure, Escutcheon, Plate, PressKey } from "../../cd/foundry";
import { type Age } from "../../cd/freshness/classes";
import { STOCK_SEGMENTS, STOCK_ZONE_WORD, stockZone } from "./model";

export interface StockMeterHandle {
  /** Retarget the meter NOW, off the freshly-committed model. */
  report(coverage: number, shortCount: number): void;
}

export interface StockMeterProps {
  /** 0-1, grams-weighted at the committed portion scale. */
  coverage: number;
  /** How many of this plate's tracked ingredients are short at this scale. */
  shortCount: number;
  /** How many ingredients the figure is computed over. */
  counted: number;
  /** The age of the newest stocktake behind the reading. Never invented. */
  age: Age;
  /** That stocktake's own HH:MM, or null when nothing has ever been counted. */
  at: string | null;
  /** The declared threshold this class prints on its own label. */
  threshold: string;
  /** The recovery action — a fixed slot, occupied whether or not it is offered. */
  onStores: () => void;
  trophy: boolean;
}

const SEGMENTS = Array.from({ length: STOCK_SEGMENTS }, (_, i) => i);

export const StockMeter = forwardRef<StockMeterHandle, StockMeterProps>(function StockMeter(
  { coverage, shortCount, counted, age, at, threshold, onStores, trophy },
  handleRef
) {
  const barRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLSpanElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const shortRef = useRef<HTMLSpanElement>(null);

  /**
   * The 16ms ack, structural. A React dispatch runs its reducer during the NEXT
   * render, so the wheel writes this meter in the input's own task off the
   * COMMITTED model. The re-render that follows finds these values already
   * correct and does nothing.
   */
  useImperativeHandle(
    handleRef,
    () => ({
      report(next: number, short: number) {
        const zone = stockZone(next);
        if (barRef.current) {
          barRef.current.style.setProperty("--mea-fill", String(Math.min(1, Math.max(0, next))));
          barRef.current.dataset.meaZone = zone;
        }
        if (figureRef.current) figureRef.current.textContent = (next * 100).toFixed(0);
        if (wordRef.current) wordRef.current.textContent = STOCK_ZONE_WORD[zone];
        if (shortRef.current)
          shortRef.current.textContent = short === 0 ? "none short" : `${short} short`;
      },
    }),
    []
  );

  const zone = stockZone(coverage);
  const pct = (coverage * 100).toFixed(0);

  return (
    <Enclosure
      variant="hero"
      as="section"
      grain
      className="mea-stock"
      aria-label="ingredients in the house, at this portion"
      data-mea-zone={zone}
    >
      <header className="mea-stock-head">
        <Escutcheon as="h2">in the house</Escutcheon>
        {/* The class's declared threshold, printed on its own label — the
            operator never has to know 72h from somewhere else. */}
        <Escutcheon className="mea-stock-threshold">stocktake · {threshold}</Escutcheon>
      </header>

      {/*
        II.3.19 — the zone colours live ON THE TRACK and an unlit cover hides the
        unfilled region, so zone geometry never moves as the level does. The
        printed band from 0 to 60% is the SHORT zone; 60-100% is PART; the
        100% mark is a printed keyline, not a lamp (II.7.8).
      */}
      <div
        className="mea-stock-bar"
        ref={barRef}
        data-mea-zone={zone}
        role="img"
        aria-label={`${pct} per cent of this plate's tracked ingredients are in the house at this portion; ${shortCount} of ${counted} short`}
        style={{ "--mea-fill": String(coverage) } as React.CSSProperties}
      >
        <span className="mea-stock-track" aria-hidden="true" />
        <span className="mea-stock-cover" aria-hidden="true">
          {SEGMENTS.map((i) => (
            <span key={i} className="mea-stock-seg" />
          ))}
        </span>
        <span className="mea-stock-full" aria-hidden="true" />
      </div>

      <Plate className="mea-stock-readout" surface="data">
        <p className="mea-stock-figure-line">
          <span
            className="mea-stock-figure cd-value"
            ref={figureRef}
            /* ORCHESTRATOR REPAIR, and the figure stated honestly: unlike PLAN
               and STORES, this one did NOT cross the Floor. Measured on this
               world's own well, the figure went 11.85:1 awake to 4.71:1 under
               `opacity: STALE_INK_ALPHA` -- passing, but with 0.21 of margin on
               a dark-polarity world where the ink is unusually bright. It is
               repaired for the same reason the others were: the drop is an INK,
               not a veil over one. --cd-muted-ink is declared by this scope and
               already verified against this ground (6.12:1), so the reading
               cannot drift and cannot be dimmed under the Floor by a future
               change to the ground beneath it. */
            data-mea-stale={age.stale ? "true" : "false"}
            style={{ "--cd-value-ch": 3 } as React.CSSProperties}
          >
            {pct}
          </span>
          <span className="cd-unit">%</span>
          <span className="mea-stock-word" ref={wordRef} data-mea-zone={zone}>
            {STOCK_ZONE_WORD[zone]}
          </span>
        </p>
        <p className="mea-stock-count cd-printed">
          <span ref={shortRef}>{shortCount === 0 ? "none short" : `${shortCount} short`}</span>
          <span aria-hidden="true"> · </span>
          <span>of {counted} tracked</span>
        </p>
        {/*
          The age line is NEVER dimmed: when a reading is stale, its age is the
          most load-bearing thing on the instrument. The exact figure prints
          beside the coarse age so it can never drift with the sample rate.
        */}
        <p className="mea-stock-age cd-printed" data-mea-stale={age.stale ? "true" : "false"}>
          <span className="cd-silkscreen">counted</span>
          <span>{at == null ? "never" : `${at} · ${age.label}`}</span>
          <span className="mea-stock-stale-word cd-silkscreen">{age.stale ? age.word : ""}</span>
        </p>
        {/* The recovery action holds its slot whether or not it is offered, so
            the control never moves under a hand reaching for it. */}
        <span className="mea-stock-action">
          {age.stale && !trophy ? (
            <PressKey onPress={onStores} cap="count the shelves →" className="mea-stock-key" />
          ) : null}
        </span>
      </Plate>
    </Enclosure>
  );
});
