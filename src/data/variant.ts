// Plan-variant façade (docs/VARIANT-SPEC.md "Runtime contract" — binding).
// `activeVariant(state)` is the ONE place `prefs.planVariant` gets resolved
// into a concrete lens over the dataset; every variant-aware consumer
// (selectors, engine, screens) reads through this, never `state.prefs.planVariant`
// or `variantMorrisonsData` directly. "full" always returns the canonical,
// no-op shape below — REGRESSION CONTRACT: when `planVariant==="full"` (the
// default), every existing code path must behave bit-identically to before
// this module existed. See variant.test.ts's full-mode identity proof.
import type { Week, WeekTargets } from "./types";
import {
  variantMorrisonsData,
  type VariantBasket,
  type VariantDefrostItem,
  type VariantPrep,
  type VariantSlots,
} from "./variantMorrisons";

export type VariantId = "full" | "morrisons-tester";

export interface ActiveVariant {
  id: VariantId;
  isTester: boolean;
  label: string;
  /** The variant's own week (tester is Week-A-only); irrelevant in full mode. */
  week: Week;
  /** null in full mode — nothing is kept/cut, every slot resolves normally. */
  slots: VariantSlots | null;
  /** null in full mode — callers fall back to plan.json's own bands. */
  targets: WeekTargets | null;
  /** null in full mode — no authored basket; tripBuild() computes as before. */
  basket: VariantBasket | null;
  /** empty in full mode — dutyStack's calendar-derived defrost duties are unaffected. */
  defrost: VariantDefrostItem[];
  /** null in full mode — COOK's prep-session filtering is a no-op. */
  prep: VariantPrep | null;
  economics: { total: string; meals: number; perMeal: string } | null;
  /** True when `mealId` is one of the tester's stated cuts. Always false in full mode. */
  isCutMealId(mealId: string): boolean;
  /** The stated reason a cut meal was cut, or null (not cut / full mode). */
  cutReason(mealId: string): string | null;
  /** True when `mealId` is one of the tester's ten kept meals. Always true in
   * full mode (nothing is filtered — every meal counts as "in scope"). */
  isKeptMealId(mealId: string): boolean;
}

const NOOP_SLOTS = null;

export const FULL_VARIANT: ActiveVariant = Object.freeze({
  id: "full",
  isTester: false,
  label: "full fortnight",
  week: "A",
  slots: NOOP_SLOTS,
  targets: null,
  basket: null,
  defrost: [],
  prep: null,
  economics: null,
  isCutMealId: () => false,
  cutReason: () => null,
  isKeptMealId: () => true,
}) satisfies ActiveVariant;

function buildTesterVariant(): ActiveVariant {
  const data = variantMorrisonsData;
  // Defensive fallback (standing instruction): the data builder emits
  // `data/variant-morrisons.json` on its own schedule — if it hasn't landed
  // yet at this build's time, tester mode behaves exactly like full mode
  // rather than crashing or rendering an empty/broken tester screen.
  if (!data) return FULL_VARIANT;

  const cutReasons = new Map(data.slots.cut.map((c) => [c.mealId, c.reason]));
  const keptSet = new Set(data.slots.kept);
  const targets = data.targets[data.week] ?? null;

  return {
    id: "morrisons-tester",
    isTester: true,
    label: data.label,
    week: data.week,
    slots: data.slots,
    targets,
    basket: data.basket,
    defrost: data.defrost,
    prep: data.prep,
    economics: data.economics,
    isCutMealId: (mealId) => cutReasons.has(mealId),
    cutReason: (mealId) => cutReasons.get(mealId) ?? null,
    isKeptMealId: (mealId) => keptSet.has(mealId),
  };
}

// Built once per module load (the underlying JSON is static/compiled-in, so
// this never needs to be recomputed per-call) — cheap enough that a fresh
// call from `activeVariant` every render would also be fine, but memoizing
// avoids rebuilding the cut/kept Maps on every selector call.
let cachedTester: ActiveVariant | null = null;

export function activeVariant(state: { prefs: { planVariant: VariantId } }): ActiveVariant {
  if (state.prefs.planVariant !== "morrisons-tester") return FULL_VARIANT;
  if (!cachedTester) cachedTester = buildTesterVariant();
  return cachedTester;
}

/** Test-only: forces the next `activeVariant` tester-mode call to rebuild
 * from the current `variantMorrisonsData` rather than reusing the module-level
 * cache. Only meaningful inside vitest, where a test may swap the data module
 * out via vi.mock; harmless (never called) in production. */
export function __resetVariantCacheForTests(): void {
  cachedTester = null;
}
