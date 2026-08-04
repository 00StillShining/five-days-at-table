// Use-by countdown text (PLAN §6.7: "4d" / "low" / "34d" — "computed from
// updatedAt + storage.life via the documented helpers; countdown is TEXT,
// color only reinforcement"). Built entirely on data/lifeEstimate.ts's
// `operativeLifeDays` — the same function state/selectors.ts's `dutyStack`
// uses for its "use today / expiring" duties — so this screen's per-row
// reading and TODAY's duty stack can never disagree (PLAN: "Expired/expiring
// items feed TODAY's duty stack ... verify, don't duplicate logic": the
// `remainingDays > 1` cutoff below is copied verbatim from dutyStack's own
// threshold in state/selectors.ts, not reinvented).
//
// The "low" text is a deliberate reuse of operativeLifeDays' own
// LifeConfidence — when only a bare "Months"/"Years" prose exists (no number
// to recover), operativeLifeDays returns a large sentinel (90d/365d) tagged
// confidence:"low" specifically so a caller CAN choose not to print a false-
// precision number. Printing "low" (short for "shelf life not tracked to the
// day — long, low-urgency") instead of a fake "90d" is exactly that choice,
// and happens to be the literal string PLAN's own worked example uses.
import { operativeLifeDays } from "../../data";
import type { Ingredient } from "../../data/types";
import type { InventoryEntry } from "../../state/store";

export type CountdownStatus = "empty" | "expired" | "expiring" | "low-confidence" | "ok";

export interface Countdown {
  text: string;
  status: CountdownStatus;
}

const EXPIRING_WINDOW_DAYS = 1; // matches dutyStack's own "remainingDays > 1 -> not yet expiring" cutoff

export function countdownForIngredient(ing: Ingredient, entry: InventoryEntry | undefined, now: Date): Countdown {
  if (!entry || entry.level === 0) return { text: "—", status: "empty" };

  const life = operativeLifeDays(ing);
  if (life.confidence === "low") return { text: "low", status: "low-confidence" };

  const updatedMs = new Date(entry.updatedAt).getTime();
  const remainingDays = life.days - (now.getTime() - updatedMs) / 86_400_000;
  if (remainingDays < 0) return { text: "expired", status: "expired" };
  const days = Math.ceil(remainingDays);
  if (days === 0) return { text: "today", status: "expiring" };
  return { text: `${days}d`, status: remainingDays <= EXPIRING_WINDOW_DAYS ? "expiring" : "ok" };
}

/** Same text/status contract, for leftovers[] rows which carry a computed
 * `useBy` ISO date directly rather than an ingredient life estimate. */
export function countdownForUseBy(useByIso: string, now: Date): Countdown {
  const remainingDays = (new Date(`${useByIso}T23:59:59`).getTime() - now.getTime()) / 86_400_000;
  if (remainingDays < 0) return { text: "expired", status: "expired" };
  const days = Math.ceil(remainingDays);
  if (days === 0) return { text: "today", status: "expiring" };
  return { text: `${days}d`, status: remainingDays <= EXPIRING_WINDOW_DAYS ? "expiring" : "ok" };
}
