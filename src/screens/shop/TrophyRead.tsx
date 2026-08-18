/**
 * src/screens/shop/TrophyRead.tsx — what survives when nobody is standing there.
 *
 * Owner ruling, this screen's own sharpest clause: "PRIVACY BY DECLARED CLASS IS
 * SHARPEST ON YOUR SCREEN: basket totals and per-line prices are MASKED behind a
 * milled blank plate. A kitchen screen facing a window must not publish the
 * household's grocery spend."
 *
 * So the survivor list is chosen by CLASS, not by importance: every reading
 * denominated in money is masked, and what stands at wall scale is the shape of
 * the trip rather than its cost. Four survivors, each printing its own exact
 * figure at 1.75rem and, where it has one, its age at 1.21875rem — IV.1's own
 * sizes, never omitted for the composition's sake:
 *
 *   LINES     how many lines the trip has
 *   COSTED    how many of them carry a real current price
 *   PRICED    when the price sheet was last verified, and how long ago
 *   DUTY      the one thing waiting, if anything is
 *
 * Section 4's Trophy clause for this chapter: "What never disappears: a warning
 * renders its resistance-amber flash at wall scale the instant it exists ...
 * every enlarged card carries its own freshness age, unconditionally; the exact
 * figure prints beneath every enlarged track window at all times."
 */

import { PRICE_STALE_DAYS } from "./model";
import type { Age } from "../../cd/freshness/classes";

export interface TrophyReadProps {
  lines: number;
  costed: number;
  /** The price sheet's own verification age. */
  priceAge: Age;
  verifiedOn: string | null;
  duty: string | null;
  horizon: boolean;
}

export function TrophyRead({ lines, costed, priceAge, verifiedOn, duty, horizon }: TrophyReadProps) {
  return (
    <div className="shop-trophy" role="group" aria-label="idle read">
      <p className="shop-trophy-row">
        <span className="shop-trophy-fig cd-data">{lines}</span>
        <span className="shop-trophy-word">lines on this trip</span>
      </p>

      <p className="shop-trophy-row">
        <span className="shop-trophy-fig cd-data">{costed}</span>
        <span className="shop-trophy-word">costed</span>
        <span className="shop-trophy-word">{horizon ? "· horizon closed" : "· horizon open"}</span>
      </p>

      <p className="shop-trophy-row">
        <span className="shop-trophy-fig cd-data">{verifiedOn ?? "never"}</span>
        <span className="shop-trophy-age cd-data">{priceAge.label}</span>
        <span className="shop-trophy-word">
          price sheet · stale after {PRICE_STALE_DAYS}d
        </span>
      </p>

      {duty && (
        <p className="shop-trophy-row">
          <span className="shop-trophy-word">duty</span>
          <span className="shop-trophy-age">{duty}</span>
        </p>
      )}

      <p className="shop-trophy-row">
        <span className="shop-mask" role="img" aria-label="basket total and line prices masked while idle">
          <span className="shop-mask-word">spend · private</span>
        </span>
      </p>
    </div>
  );
}
