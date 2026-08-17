// VARIANT RUNTIME builder's own test scope (docs/VARIANT-SPEC.md's runtime
// contract): variant-aware selector threading — dayMacros/bands/tripBuild/
// dutyStack/effectiveMealForSlot's new optional `variant`/`prefs` params.
// selectors.test.ts (F2's own suite) already pins the pre-variant behavior
// of these functions when called WITHOUT a variant — this file is additive,
// covering only the new variant-aware branch, so it can't regress F2's own
// full-mode coverage.
import { describe, expect, it } from "vitest";
import { activeVariant, FULL_VARIANT } from "../data/variant";
import { VARIANT_MORRISONS_AVAILABLE, variantMorrisonsData } from "../data/variantMorrisons";
import { defaultState } from "./reducer";
import { bands, cutReasonForSlot, dayMacros, dutyStack, effectiveMealForSlot, tripBuild } from "./selectors";
import type { AppState } from "./types";

const ANCHOR = "2026-08-01"; // Saturday
function londonNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

function testerState(overrides: Partial<AppState> = {}): AppState {
  const clone = structuredClone(defaultState);
  return { ...clone, prefs: { ...clone.prefs, planVariant: "morrisons-tester", cycleStartSaturday: ANCHOR }, ...overrides };
}

describe("effectiveMealForSlot — variant-aware (optional prefs)", () => {
  it("without prefs on the state param, behaves exactly as before (full mode, no cut check)", () => {
    const meal = effectiveMealForSlot("A", 2, "dinner", { swaps: {} });
    expect(meal?.id).toBe("a-d2d");
  });

  it("with prefs.planVariant \"full\", still resolves normally", () => {
    const meal = effectiveMealForSlot("A", 2, "dinner", { swaps: {}, prefs: { planVariant: "full" } });
    expect(meal?.id).toBe("a-d2d");
  });

  it.runIf(VARIANT_MORRISONS_AVAILABLE)("with prefs.planVariant tester, a cut slot resolves to undefined", () => {
    const cutMealId = variantMorrisonsData!.slots.cut[0].mealId; // e.g. "a-d3b"
    // meals.ts ids are "a-d<day><slotInitial>" — pull day/slot back out to call the selector the same way screens do.
    const day = Number(cutMealId.slice(3, 4));
    const slotInitial = cutMealId.slice(4);
    const slot = ({ b: "breakfast", l: "lunch", d: "dinner", s: "snack" } as const)[slotInitial as "b" | "l" | "d" | "s"];
    const meal = effectiveMealForSlot("A", day, slot, { swaps: {}, prefs: { planVariant: "morrisons-tester" } });
    expect(meal).toBeUndefined();
  });

  it.runIf(VARIANT_MORRISONS_AVAILABLE)("a kept slot still resolves normally under the tester", () => {
    const keptMealId = variantMorrisonsData!.slots.kept[0]; // "a-d1b"
    const meal = effectiveMealForSlot("A", 1, "breakfast", { swaps: {}, prefs: { planVariant: "morrisons-tester" } });
    expect(meal?.id).toBe(keptMealId);
  });
});

describe("cutReasonForSlot", () => {
  it("full mode: never cut", () => {
    expect(cutReasonForSlot("A", 3, "breakfast", { prefs: { planVariant: "full" } })).toBeNull();
  });

  it.runIf(VARIANT_MORRISONS_AVAILABLE)("tester mode: matches the data's own stated reason for a cut slot", () => {
    const cut = variantMorrisonsData!.slots.cut[0];
    const day = Number(cut.mealId.slice(3, 4));
    const slotInitial = cut.mealId.slice(4);
    const slot = ({ b: "breakfast", l: "lunch", d: "dinner", s: "snack" } as const)[slotInitial as "b" | "l" | "d" | "s"];
    expect(cutReasonForSlot("A", day, slot, { prefs: { planVariant: "morrisons-tester" } })).toBe(cut.reason);
  });
});

describe("dayMacros — variant targets/cut-aware", () => {
  it("default variant param preserves pre-variant behavior exactly", () => {
    expect(dayMacros("A", 1, "w")).toEqual(dayMacros("A", 1, "w", 1, {}, FULL_VARIANT));
  });

  it.runIf(VARIANT_MORRISONS_AVAILABLE)("a fully-cut day (Wednesday) comes out all-zero under the tester", () => {
    const variant = activeVariant({ prefs: { planVariant: "morrisons-tester" } });
    // Wednesday is day 3 — VARIANT-SPEC: "all Wednesday" cut.
    const macros = dayMacros("A", 3, "w", 1, {}, variant);
    expect(macros).toEqual({ kcal: 0, protein: 0, netCarb: 0, fat: 0, fibre: 0 });
  });

  it.runIf(VARIANT_MORRISONS_AVAILABLE)("a day with only its snack cut (Monday) excludes just that slot's macros", () => {
    const variant = activeVariant({ prefs: { planVariant: "morrisons-tester" } });
    // VARIANT-SPEC: every weekday's snack is cut (5 snacks absent from the
    // tester entirely), so even Monday (otherwise fully kept: b/l/d) comes
    // out lower than the full plan's day total, not identical to it.
    const full = dayMacros("A", 1, "w");
    const tester = dayMacros("A", 1, "w", 1, {}, variant);
    expect(tester.kcal).toBeLessThan(full.kcal);
    expect(tester.kcal).toBeGreaterThan(0); // b/l/d still contribute
  });
});

describe("bands — variant targets switch", () => {
  it("default variant param preserves pre-variant behavior exactly", () => {
    expect(bands("A", "w")).toEqual(bands("A", "w", FULL_VARIANT));
  });

  it.runIf(VARIANT_MORRISONS_AVAILABLE)("tester mode substitutes the variant's own recomputed targets", () => {
    const variant = activeVariant({ prefs: { planVariant: "morrisons-tester" } });
    const testerBands = bands("A", "w", variant);
    expect(testerBands).toEqual(variantMorrisonsData!.targets.A!.w);
    expect(testerBands).not.toEqual(bands("A", "w")); // genuinely different from the full plan's own bands
  });
});

describe("tripBuild — tester basket verbatim", () => {
  it("default variant param preserves pre-variant behavior exactly", () => {
    expect(tripBuild({}, 0)).toEqual(tripBuild({}, 0, {}, FULL_VARIANT));
  });

  it.runIf(VARIANT_MORRISONS_AVAILABLE)("tester mode returns the authored basket verbatim — no dedupe, all verified", () => {
    const variant = activeVariant({ prefs: { planVariant: "morrisons-tester" } });
    const trip = tripBuild({ chicken: { level: 4, updatedAt: "2026-08-01T00:00:00.000Z" } }, 0, {}, variant);
    expect(trip.lines).toHaveLength(variantMorrisonsData!.basket.lines.length);
    expect(trip.verifyNominees).toEqual([]); // "all lines verified — no verify nominees"
    expect(trip.lines.every((l) => l.estimate === false)).toBe(true);
    expect(trip.lines.every((l) => l.haveG === 0)).toBe(true); // no have-list dedupe, even with stock on hand
    expect(Math.round(trip.subtotal * 100)).toBe(variantMorrisonsData!.basket.totalP);
  });

  it.runIf(VARIANT_MORRISONS_AVAILABLE)("tester mode ignores the tripDay param — one trip, not a day-0/day-7 split", () => {
    const variant = activeVariant({ prefs: { planVariant: "morrisons-tester" } });
    const day0 = tripBuild({}, 0, {}, variant);
    const day7 = tripBuild({}, 7, {}, variant);
    expect(day0).toEqual(day7);
  });
});

describe("dutyStack — tester defrost list", () => {
  it.runIf(VARIANT_MORRISONS_AVAILABLE)("uses the variant's own defrost items, not the canonical a-twice calendar", () => {
    // Thursday (fortnightDay 5) — VARIANT-SPEC's own worked example: beef_steak
    // due Wednesday night, salmon due Thursday night, beef_mince due Wednesday.
    const state = testerState();
    const duties = dutyStack(state, londonNoon("2026-08-06")); // Thu
    const defrostIds = duties.filter((d) => d.kind === "defrost").map((d) => d.ingId);
    expect(defrostIds).toEqual(expect.arrayContaining(["beef_steak", "salmon", "beef_mince"]));
  });
});
