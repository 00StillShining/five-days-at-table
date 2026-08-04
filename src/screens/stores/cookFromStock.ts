// Cook-from-stock ranking for STORES' strip (PLAN §6.7: "meals ranked by
// coverage % against current levels ... stated as '~92%'").
//
// SHARED-CHANGE FLAG (documented per the F2 standing rule — not a STOP, since
// it's resolvable within this screen's own ownership; noted for the
// integration reviewer / state owner):
//
// My task brief states, verbatim: "KEY FACT: executing week always 'A';
// cook-from-stock ranks BOTH weeks' meals (Week B is the swap pool)." But the
// shared selector `coverageForAllMeals` (state/selectors.ts, re-exported by
// engine/arbiter.ts) is Week-A-only:
//
//   export function coverageForAllMeals(inventory: Inventory, cover: Cover) {
//     return mealsByWeek("A").map(...).sort(...);
//   }
//
// state/** and engine/** are outside this screen's ownership (PHASE2-
// CONTRACT), so it can't be edited here. Rather than fork or duplicate its
// substantive fuzzy-coverage math (state/selectors.ts's `coverageForMeal`,
// which this file calls unchanged), this wraps it with the trivial
// both-weeks gather+sort PLAN §6.7 actually needs. Suggested shared fix: make
// `coverageForAllMeals` take an explicit `weeks: Week[]` (default `["A"]"` to
// stay source-compatible with today's only other caller, engine/arbiter.ts,
// which doesn't currently use the ranking at all) or add a sibling
// `coverageForAllMealsAcrossWeeks`.
import { mealsByWeek } from "../../data";
import { coverageForMeal, type MealCoverage } from "../../state/selectors";
import type { Cover, Inventory } from "../../state/store";

export function coverageForAllMealsBothWeeks(inventory: Inventory, cover: Cover): MealCoverage[] {
  const meals = [...mealsByWeek("A"), ...mealsByWeek("B")];
  return meals.map((m) => coverageForMeal(inventory, m.id, cover)).sort((a, b) => b.coverage - a.coverage);
}
