/**
 * src/screens/plan/CommissionPlate.tsx — ch.17 section 3's fourth component.
 *
 * "Built on the data card of II.3.32 at its own 20rem by 11.25rem casting —
 * 2rem header, one hero value at 2.75rem with its unit at 40%, a 3rem trend
 * strip, a footer rule — RESTOMOD prints the header in tracked caps over ivory,
 * the hero value engraved in crackle black, and a heritage-green underline that
 * STATES WHICH NAMED COMMISSION'S FINISH IS CURRENTLY LIVE on the cluster it
 * describes."
 *
 * FD-5's named commission is the PLAN VARIANT (docs/VARIANT-SPEC.md): "full
 * fortnight", or "morrisons starter · 10 meals week A". Every figure the five
 * gauges report is a figure taken under that commission, so the plate that
 * names it belongs beside them and nowhere else.
 *
 * ---------------------------------------------------------------------------
 * THE ONE FACT THIS SCREEN CANNOT AFFORD TO LEAVE IMPLICIT
 * ---------------------------------------------------------------------------
 * D5: the executing fortnight is ALWAYS Week A, twice. `prefs.week` is a
 * BROWSING toggle, and the chassis' own settings tray already prints "browsing
 * only · the executing week is always a" beside it. PLAN is the screen where
 * conflating the two would be most invisible and most wrong — a board titled
 * "week b" that looks exactly like a plan somebody is about to cook — so the
 * plate engraves BOTH facts, permanently, side by side: what is being browsed,
 * and what is being executed. They are different rows because they are
 * different claims.
 *
 * WHAT THIS PLATE DOES NOT PRINT: the scope. It carried a `reading` row saying
 * "one plated week" while the READING plate immediately beneath it said the
 * same words and then added what the scope covers — the eye landing on one fact
 * twice, in two adjacent plates, which is a reading-order fault whatever the
 * fact is worth. The scope belongs to the plate named after it.
 *
 * The trend strip is a real readout, not decoration: five upright bars, one per
 * plated day, each day's kcal against that day's own band, so the week's SHAPE
 * is on the plate beside the week's total. II.3.32's trend strip earns its
 * 3rem by carrying a fact the gauges cannot: which day is the outlier.
 */

import { memo } from "react";
import { Escutcheon, Plate } from "../../cd/foundry";
import type { Cover, Week } from "../../data/types";
import { bandState, fractionOf, dialScale, type DayReading } from "./model";

export interface CommissionPlateProps {
  variantLabel: string;
  isTester: boolean;
  /** How many plated meals the live commission actually cooks. */
  mealCount: number;
  /** How many slots the commission cuts, and why (tester only). */
  cutCount: number;
  browsing: Week;
  cover: Cover;
  days: DayReading[];
}

const COVER_WORD: Record<Cover, string> = { w: "her · 70kg", m: "him · 85kg" };

export const CommissionPlate = memo(function CommissionPlate({
  variantLabel,
  isTester,
  mealCount,
  cutCount,
  browsing,
  cover,
  days,
}: CommissionPlateProps) {
  return (
    <Plate as="section" className="pln-commission" surface="data" aria-label="commission plate">
      <Escutcheon as="h2" className="pln-commission-head">
        commission
      </Escutcheon>

      <p className="pln-commission-hero">
        <span className="cd-value pln-commission-value">{mealCount}</span>
        <span className="cd-unit">meals</span>
      </p>
      <span className="pln-commission-underline" aria-hidden="true" />

      {/* THE TREND STRIP — five plated days, each against its own day band. */}
      <div className="pln-trend" role="img" aria-label={trendSentence(days)}>
        {days.map((d) => {
          const scale = dialScale(d.band.kcal);
          const f = fractionOf(d.macros.kcal, scale);
          const state = bandState(d.macros.kcal, d.band.kcal);
          /* The printed band is DERIVED from the same scale the bar is derived
             from. It was a hard-coded 37.5% / 25% first, which agreed with the
             bar only for as long as RANGE_PAD stayed 1.5 — a strip that would
             have gone on saying which day was off target after it stopped
             being true. */
          const z = scale.zones;
          return (
            <span key={d.dayNo} className="pln-trend-col" data-pln-state={state}>
              <span className="pln-trend-well" aria-hidden="true">
                <span
                  className="pln-trend-band"
                  aria-hidden="true"
                  style={{
                    insetBlockEnd: `${(z.bandStart * 100).toFixed(1)}%`,
                    blockSize: `${((z.bandEnd - z.bandStart) * 100).toFixed(1)}%`,
                  }}
                />
                <span className="pln-trend-bar" style={{ blockSize: `${(f * 100).toFixed(1)}%` }} />
              </span>
              <span className="pln-trend-day cd-silkscreen">{d.abbr}</span>
            </span>
          );
        })}
      </div>

      <dl className="pln-commission-rule cd-printed">
        <div>
          <dt>finish</dt>
          <dd>{variantLabel}</dd>
        </div>
        <div>
          <dt>browsing</dt>
          <dd>week {browsing.toLowerCase()}</dd>
        </div>
        <div>
          <dt>executes</dt>
          <dd>
            week a, twice
            <span className="pln-commission-note"> · always (D5)</span>
          </dd>
        </div>
        <div>
          <dt>cover</dt>
          <dd>{COVER_WORD[cover]}</dd>
        </div>
        {isTester && (
          <div>
            <dt>cut</dt>
            <dd>
              {cutCount} of {cutCount + mealCount} slots
            </dd>
          </div>
        )}
      </dl>
    </Plate>
  );
});

function trendSentence(days: DayReading[]): string {
  const parts = days.map(
    (d) => `${d.abbr} ${Math.round(d.macros.kcal)} kcal, ${bandState(d.macros.kcal, d.band.kcal)} band`
  );
  return `five plated days, kcal against each day's own band: ${parts.join("; ")}`;
}
