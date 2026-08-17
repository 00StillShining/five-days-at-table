// Coordinator round (D0-035): ingredients may carry `pantryOptional: true`
// with `sku: null` (cottage/apple/banana/chia/pumpkin_seeds/coconut_des —
// assumed on hand, not part of the canonical shopping basket). This file
// verifies logDinner.tsx's £ waste/leftover pro-rating (`computeMealTotals`)
// stays robust when a dinner's ingredient list includes one of these — no
// crash, and the null-sku ingredient contributes 0 to cost (not NaN/throw)
// while still contributing its grams to the portion-size total.
import { describe, expect, it } from "vitest";
import { requireMeal } from "../../data";
import { ingredientsById } from "../../data/ingredients";
import { computeMealTotals } from "./logDinner";

describe("computeMealTotals — pantryOptional (sku: null) robustness", () => {
  // a-d5d (Friday dinner, "Jerk salmon, rice & red beans") carries
  // coconut_des in its covers — verified against data/meals.json.
  const meal = requireMeal("a-d5d");

  it("coconut_des is genuinely sku:null in the current dataset (sanity check the fixture still holds)", () => {
    expect(ingredientsById.coconut_des?.pantryOptional).toBe(true);
    expect(ingredientsById.coconut_des?.sku).toBeNull();
  });

  it("does not throw, and returns finite, non-negative totals", () => {
    expect(() => computeMealTotals(meal)).not.toThrow();
    const { totalG, totalCost } = computeMealTotals(meal);
    expect(Number.isFinite(totalG)).toBe(true);
    expect(Number.isFinite(totalCost)).toBe(true);
    expect(totalG).toBeGreaterThan(0);
    expect(totalCost).toBeGreaterThan(0); // every other ingredient in this dinner is priced
  });

  it("the null-sku ingredient's grams count toward totalG but contribute 0 to totalCost", () => {
    const withCoconut = computeMealTotals(meal);
    // Build a synthetic covers table with coconut_des removed from both
    // covers, to isolate its own contribution.
    const stripped = {
      ...meal,
      covers: {
        w: Object.fromEntries(Object.entries(meal.covers.w).filter(([id]) => id !== "coconut_des")),
        m: Object.fromEntries(Object.entries(meal.covers.m).filter(([id]) => id !== "coconut_des")),
      },
    };
    const withoutCoconut = computeMealTotals(stripped);
    const coconutG = (meal.covers.w.coconut_des ?? 0) + (meal.covers.m.coconut_des ?? 0);
    expect(withCoconut.totalG - withoutCoconut.totalG).toBe(coconutG);
    // Cost is unaffected by removing a null-sku ingredient — it was already
    // contributing 0.
    expect(withCoconut.totalCost).toBeCloseTo(withoutCoconut.totalCost, 6);
  });
});
