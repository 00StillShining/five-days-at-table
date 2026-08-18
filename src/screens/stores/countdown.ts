// Use-by countdown text (PLAN §6.7: "4d" / "low" / "34d" — countdown is
// TEXT, color only reinforcement).
//
// Wave-1-fix item 5 (integration review): rebuilt on the SHARED selectors
// rather than this screen's own copy of the arithmetic —
//   `remainingLifeDays` (state/selectors.ts) for the day-count. It's
//   freezer/thawedAt-aware: a freeze-day0/buy-frozen item with no
//   `thawedAt` yet returns null (still in the freezer, no countdown
//   applies), instead of the old local logic which anchored to
//   `updatedAt` and could read a still-frozen item as "expired" the moment
//   a routine stocktake touched it.
//   `formatRemainingDays` for the display text. It's the ONE place the
//   day -> text rounding rule lives now: this screen used to ceil() its own
//   remaining-days figure while TODAY floored the identical underlying
//   number, so the same fridge item could read "1d" here and "0d" there.
//   Both now call the same formatter, so they can't drift again.
import { operativeLifeDays } from "../../data";
import type { Ingredient } from "../../data/types";
import type { InventoryEntry } from "../../state/store";
import { formatRemainingDays, remainingLifeDays } from "../../state/selectors";

export type CountdownStatus = "empty" | "frozen" | "expired" | "expiring" | "low-confidence" | "ok";

export interface Countdown {
  text: string;
  status: CountdownStatus;
  /**
   * Remaining life as a fraction of this ingredient's OPERATIVE life, 0..1, or
   * null when the question does not apply — never stocked, still frozen, or a
   * shelf-life prose string with no number behind it.
   *
   * The register's life channel reads this and NOTHING ELSE. It is null rather
   * than 0 in the "does not apply" cases on purpose: an index parked at zero
   * claims "this is out of life", which is a different (and false) statement
   * from "there is no reading here". CORRECTIONARY 4 — no invented data.
   */
  fraction: number | null;
}

const EXPIRING_WINDOW_DAYS = 1; // matches dutyStack's own "remainingDays > 1 -> not yet expiring" cutoff

export function countdownForIngredient(ing: Ingredient, entry: InventoryEntry | undefined, now: Date): Countdown {
  if (!entry || entry.level === 0) return { text: "—", status: "empty", fraction: null };

  const remainingDays = remainingLifeDays(ing, entry, now);
  if (remainingDays == null) {
    // Freezer-class stock, no thawedAt yet — still in the freezer; genuinely
    // no countdown applies (see state/selectors.ts remainingLifeDays doc).
    return { text: "frozen", status: "frozen", fraction: null };
  }

  const life = operativeLifeDays(ing);
  // Reuse: printing "low" instead of a false-precision "90d"/"365d" for
  // ingredients whose prose carries no number at all (bare "Months"/"Years")
  // — see data/lifeEstimate.ts's LifeConfidence doc.
  if (life.confidence === "low") return { text: "low", status: "low-confidence", fraction: null };

  const fraction = life.days > 0 ? Math.max(0, Math.min(1, remainingDays / life.days)) : null;

  return {
    text: formatRemainingDays(remainingDays),
    status: remainingDays < 0 ? "expired" : remainingDays <= EXPIRING_WINDOW_DAYS ? "expiring" : "ok",
    fraction,
  };
}

/** Same text/status contract, for leftovers[] rows which carry a computed
 * `useBy` ISO date directly rather than an ingredient life estimate — there
 * is no shared selector for "days until an arbitrary date" (remainingLifeDays
 * is ingredient/inventory-entry shaped), so the raw day-delta is still
 * computed locally, but the TEXT comes from the same `formatRemainingDays`
 * every other countdown in the app uses, so the rounding rule can't drift
 * here either. */
export function countdownForUseBy(useByIso: string, now: Date, totalDays = LEFTOVER_LIFE_DAYS): Countdown {
  const remainingDays = (new Date(`${useByIso}T23:59:59`).getTime() - now.getTime()) / 86_400_000;
  return {
    text: formatRemainingDays(remainingDays),
    status: remainingDays < 0 ? "expired" : remainingDays <= EXPIRING_WINDOW_DAYS ? "expiring" : "ok",
    // A leftover's own life IS the window logDinner stamped on it, so the
    // fraction is measured against that same declared span rather than against
    // an ingredient shelf life this row does not have.
    fraction: totalDays > 0 ? Math.max(0, Math.min(1, remainingDays / totalDays)) : null,
  };
}

/** logDinner.tsx's own COOKED_LEFTOVER_FRIDGE_DAYS, restated as the leftover
 *  life channel's denominator so the two cannot drift apart. */
export const LEFTOVER_LIFE_DAYS = 3;
