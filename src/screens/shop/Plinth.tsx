/**
 * src/screens/shop/Plinth.tsx — everything above the seam, which is one thing.
 *
 * Section 2's geometry law is held literally: "nothing in this world may rise
 * above the band's own seam. Controls, indices, and labels live at or below the
 * band." So there is no control here, and the one readout that IS here sits on a
 * plate MILLED INTO the rosewood — a recess, not an object standing on it.
 *
 * Section 4's Hero Screen grants exactly this: "Above the band ... nothing but
 * the rosewood-toned ground and the single hero readout of the screen's own
 * dominant value."
 *
 * The dominant value on SHOP is what the trip costs. It prints at II.6.20's
 * reserved top step — 4.25rem, one numeral per screen — over a cost track that
 * reports where the money sits between the retailers as POSITION, never as a
 * filled bar and never as an arc (section 9's "Arc creep", named).
 *
 * ---------------------------------------------------------------------------
 * TROPHY: THE PRIVACY PLATE
 * ---------------------------------------------------------------------------
 * Owner ruling: "basket totals and per-line prices are MASKED behind a milled
 * blank plate. A kitchen screen facing a window must not publish the household's
 * grocery spend." So in Trophy the figure and the whole cost track are replaced
 * by a real machined blank carrying an engraved word — never a blur, never a
 * redaction bar, and never a smaller version of the number.
 */

import { forwardRef } from "react";
import { Enclosure, Escutcheon, PressKey } from "../../cd/foundry";
import { Stale } from "../../cd/freshness/Stale";
import type { Age } from "../../cd/freshness/classes";
import { TrackWindow, type TrackWindowHandle } from "./Instruments";
import { PRICE_STALE_DAYS, money, type Census, type TrackIndex } from "./model";

export interface PlinthProps {
  /** The trip's own overall figure, in pounds. */
  total: number;
  kind: string;
  census: Census;
  indices: TrackIndex[];
  /** Trip identity. II.6.11: micro-etch REPEATS, it never carries a fact alone. */
  etch: string;
  /** The price sheet's own age — the total is computed from those prices. */
  age: Age;
  pricedOn: string | null;
  /** This month's binned value, from state.waste. */
  wasted: number;
  /** The fixed-position recovery: open the pad and type a current price. */
  onRecover: () => void;
  trophy: boolean;
}

export const Plinth = forwardRef<TrackWindowHandle, PlinthProps>(function Plinth(
  { total, kind, census, indices, etch, age, pricedOn, wasted, onRecover, trophy },
  ref
) {
  return (
    <div className="shop-plinth">
      <Enclosure variant="well" as="section" className="shop-readout" surface="data" aria-label="trip total">
        <div className="shop-figure">
          {trophy ? (
            <span className="shop-mask" role="img" aria-label="basket total masked while idle">
              <span className="shop-mask-word">private</span>
            </span>
          ) : (
            /*
              CORRECTIONARY 4, honesty: "every live reading shows its exact
              figure AND ITS AGE; a value that stops updating declares itself
              stale". This total is computed from the price sheet, so the sheet's
              age IS its age. II.3.18's four rules come from the shared component
              rather than being re-implemented here: the value HOLDS, its ink
              drops to 55% (measured 5.15:1 on this field), a state word prints,
              and the recovery action sits in a slot that is reserved whether or
              not the reading is currently stale.
            */
            <Stale
              age={age}
              label="trip total"
              action={
                <PressKey
                  className="shop-cap-key"
                  sound="none"
                  cap="check"
                  onPress={onRecover}
                  aria-label="open the reconcile pad and type a current price"
                />
              }
            >
              <span className="shop-total-unit" aria-hidden="true">
                £
              </span>
              <span className="shop-total cd-data" aria-label={`trip total ${money(total)} pounds`}>
                {money(total)}
              </span>
            </Stale>
          )}
          <Escutcheon as="span" className="shop-figure-name">
            {kind}
          </Escutcheon>
        </div>

        {/* II.6.24 — every clip states its remainder as a number. These are the
            counts the basket is made of, and each one is measured, never typed. */}
        <div className="shop-census">
          <span className="shop-census-cell">
            <span className="shop-census-fig cd-data">{census.lines}</span>
            <span className="shop-census-word">lines</span>
          </span>
          <span className="shop-census-cell">
            <span className="shop-census-fig cd-data">{census.costed}</span>
            <span className="shop-census-word">costed</span>
          </span>
          <span className="shop-census-cell">
            <span className="shop-census-fig cd-data">{census.estimates}</span>
            <span className="shop-census-word">estimated</span>
          </span>
          <span className="shop-census-cell">
            <span className="shop-census-fig cd-data">{census.unverified + census.stale}</span>
            <span className="shop-census-word">unpriced</span>
          </span>
          {/* THE SHEET'S OWN DATE, at the label floor rather than in the etch.
              II.6.11 forbids micro-type carrying a fact nothing else states. */}
          <span className="shop-census-cell">
            <span className="shop-census-fig cd-data">{pricedOn ?? "never"}</span>
            <span className="shop-census-word">priced · stale after {PRICE_STALE_DAYS}d</span>
          </span>
          {/* PLAN §6.8's waste readout: what last month's produce actually cost
              in the bin. A real figure from state.waste, and the one number on
              this plate that is not part of the trip. */}
          <span className="shop-census-cell">
            <span className="shop-census-fig cd-data">£{money(wasted)}</span>
            <span className="shop-census-word">binned this month</span>
          </span>
        </div>

        {!trophy && (
          <TrackWindow
            ref={ref}
            className="shop-costtrack"
            ticks={Math.max(1, census.lines)}
            legend
            legendOrigin="cumulative · £0.00 →"
            label={`cost track — cumulative from zero: ${indices
              .map((i) => `${i.name} £${money(i.subtotal)}`)
              .join(", ")}, total £${money(total)}`}
            marks={indices.map((i) => ({
              key: i.code,
              pct: i.pct,
              seat: i.seat,
              figure: `£${money(i.subtotal)}`,
            }))}
          />
        )}
      </Enclosure>

      {!trophy && (
        <p className="shop-etch" aria-hidden="true">
          {etch}
        </p>
      )}
    </div>
  );
});
