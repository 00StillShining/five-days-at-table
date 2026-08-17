// docs/VARIANT-SPEC.md's runtime contract, binding: `activeVariant(state)`
// is the ONE place `prefs.planVariant` resolves into a concrete lens.
// REGRESSION CONTRACT: full mode must be bit-identical to pre-variant
// behavior — the tests below are the "full-mode identity proof" the
// orchestrator's final-report checklist asks for.
import { describe, expect, it } from "vitest";
import { activeVariant, FULL_VARIANT } from "./variant";
import { VARIANT_MORRISONS_AVAILABLE, variantMorrisonsData } from "./variantMorrisons";

describe("activeVariant — full-mode identity", () => {
  it("returns the frozen FULL_VARIANT singleton for planVariant: \"full\"", () => {
    const result = activeVariant({ prefs: { planVariant: "full" } });
    expect(result).toBe(FULL_VARIANT);
  });

  it("full mode never flags any meal id as cut", () => {
    const v = activeVariant({ prefs: { planVariant: "full" } });
    expect(v.isCutMealId("a-d3b")).toBe(false);
    expect(v.isCutMealId("anything-at-all")).toBe(false);
  });

  it("full mode treats every meal id as kept", () => {
    const v = activeVariant({ prefs: { planVariant: "full" } });
    expect(v.isKeptMealId("a-d3b")).toBe(true);
    expect(v.isKeptMealId("literally-anything")).toBe(true);
  });

  it("full mode carries no targets/basket/prep — callers must fall back to the canonical dataset", () => {
    const v = activeVariant({ prefs: { planVariant: "full" } });
    expect(v.slots).toBeNull();
    expect(v.targets).toBeNull();
    expect(v.basket).toBeNull();
    expect(v.prep).toBeNull();
    expect(v.defrost).toEqual([]);
    expect(v.isTester).toBe(false);
  });

  it("cutReason is always null in full mode", () => {
    const v = activeVariant({ prefs: { planVariant: "full" } });
    expect(v.cutReason("a-d3b")).toBeNull();
  });
});

describe("activeVariant — tester mode", () => {
  it("falls back to FULL_VARIANT if the data file hasn't been emitted yet (defensive contract)", () => {
    if (VARIANT_MORRISONS_AVAILABLE) return; // this build has the real data — see the block below instead
    const v = activeVariant({ prefs: { planVariant: "morrisons-tester" } });
    expect(v).toBe(FULL_VARIANT);
  });

  // These assertions run only once data/variant-morrisons.json has actually
  // been emitted by the parallel DATA builder (docs/VARIANT-SPEC.md) — the
  // "if yes, verify against it live" instruction. Skipped (not failed) when
  // the file is absent, so this test file passes either way the build lands.
  it.runIf(VARIANT_MORRISONS_AVAILABLE)("resolves the real tester dataset when present", () => {
    const v = activeVariant({ prefs: { planVariant: "morrisons-tester" } });
    expect(v.isTester).toBe(true);
    expect(v.id).toBe("morrisons-tester");
    expect(v.week).toBe("A");
    expect(v.slots?.kept).toHaveLength(10);
    expect(v.slots?.cut).toHaveLength(10); // 5 b/l/d cuts + 5 snacks, per VARIANT-SPEC
    expect(v.basket?.lines).toHaveLength(39);
    expect(v.basket?.totalP).toBe(6983); // £69.83 exact
    expect(v.economics?.meals).toBe(10);
  });

  it.runIf(VARIANT_MORRISONS_AVAILABLE)("isKeptMealId/isCutMealId/cutReason agree with the data's own slots block", () => {
    const v = activeVariant({ prefs: { planVariant: "morrisons-tester" } });
    const data = variantMorrisonsData!;
    for (const mealId of data.slots.kept) {
      expect(v.isKeptMealId(mealId)).toBe(true);
      expect(v.isCutMealId(mealId)).toBe(false);
      expect(v.cutReason(mealId)).toBeNull();
    }
    for (const cut of data.slots.cut) {
      expect(v.isCutMealId(cut.mealId)).toBe(true);
      expect(v.isKeptMealId(cut.mealId)).toBe(false);
      expect(v.cutReason(cut.mealId)).toBe(cut.reason);
    }
  });

  it.runIf(VARIANT_MORRISONS_AVAILABLE)("kept and cut are disjoint and don't overlap the wrong way", () => {
    const v = activeVariant({ prefs: { planVariant: "morrisons-tester" } });
    const data = variantMorrisonsData!;
    const keptSet = new Set(data.slots.kept);
    for (const cut of data.slots.cut) expect(keptSet.has(cut.mealId)).toBe(false);
  });
});
