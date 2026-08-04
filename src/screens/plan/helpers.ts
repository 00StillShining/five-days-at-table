// Pure domain + presentation helpers for the PLAN screen only (no food facts
// invented — everything here reads through src/data's typed accessors and
// src/state/selectors.ts's exported pure functions, per PHASE2-CONTRACT).
import { getMeal, mealForSlot, mealsByWeek, mealsByWeekDay } from "../../data";
import type { Band, Cover, Macros, Meal, Slot, Week } from "../../data/types";
import { bands, coverageForMeal, overBandMacros } from "../../state/selectors";
import type { Eaten, Inventory } from "../../state/types";
import { swapKeyOf, type SwapMap } from "./swapStore";

// ---------------------------------------------------------------------------
// Macro group presentation (the hero's four dials — PLAN §6.4: "kcal/protein/
// fat/carb", deliberately not all five Macros keys; fibre isn't part of this
// hero per the spec's own list).
// ---------------------------------------------------------------------------

export const MACRO_GROUPS = ["kcal", "protein", "fat", "netCarb"] as const;
export type MacroGroup = (typeof MACRO_GROUPS)[number];

export const MACRO_LABEL: Record<keyof Macros, string> = {
  kcal: "kcal",
  protein: "protein",
  fat: "fat",
  netCarb: "carb",
  fibre: "fibre",
};

export const MACRO_UNIT: Record<keyof Macros, string> = {
  kcal: "",
  protein: "g",
  fat: "g",
  netCarb: "g",
  fibre: "g",
};

export function fmtMacro(value: number, key: keyof Macros): string {
  return key === "kcal" ? String(Math.round(value)) : value.toFixed(1);
}

export function fmtSigned(value: number, key: keyof Macros): string {
  const sign = value > 0 ? "+" : value < 0 ? "" : "±"; // toFixed/round already carries "-" for negatives
  return `${sign}${fmtMacro(value, key)}${MACRO_UNIT[key]}`;
}

// ---------------------------------------------------------------------------
// Swap resolution — reading src/screens/plan/swapStore.ts's session-only map
// (see data/raw/decision-request.plan.json for why this isn't real AppState).
// ---------------------------------------------------------------------------

/** The meal actually shown in a slot: the swap candidate if one is
 * committed for this exact (week, day, slot), else the originally planned
 * meal. Falls back to `original` defensively if a stored candidate id
 * somehow no longer resolves (should not happen — candidates are only ever
 * written from ids this module itself looked up). */
export function effectiveMeal(week: Week, day: number, slot: Slot, original: Meal, swaps: SwapMap): Meal {
  const candidateId = swaps[swapKeyOf(week, day, slot)];
  if (!candidateId) return original;
  return getMeal(candidateId) ?? original;
}

// ---------------------------------------------------------------------------
// Macro totals with swaps applied
// ---------------------------------------------------------------------------

const ZERO_MACROS: Macros = { kcal: 0, protein: 0, netCarb: 0, fat: 0, fibre: 0 };

function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    netCarb: a.netCarb + b.netCarb,
    fat: a.fat + b.fat,
    fibre: a.fibre + b.fibre,
  };
}

function subMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal - b.kcal,
    protein: a.protein - b.protein,
    netCarb: a.netCarb - b.netCarb,
    fat: a.fat - b.fat,
    fibre: a.fibre - b.fibre,
  };
}

/**
 * A day's macro total, honoring any committed swaps. Deliberately sums each
 * shown meal's own precomputed `macros[cover]` field rather than
 * re-summing ingredient covers the way state/selectors.ts's dayMacros()
 * does: PLAN never applies MEAL's portion-scale knob, so at scale=1 the two
 * approaches agree to well within a rounding unit (verified against
 * dayMacros() during build — the two ways of summing round distinct
 * intermediate values, e.g. day totals can differ by ~1 kcal from summing
 * five already-rounded per-meal figures vs rounding one raw sum, which is
 * cosmetic, not a food-fact error). Reusing the field lets a swapped-in
 * candidate (which may come from the *other* week) contribute correctly
 * without a scale-aware recompute helper — and dayMacros() itself has no
 * hook to substitute one meal's covers for another's, so it can't take a
 * hypothetical swap as input at all.
 */
export function dayMacrosWithSwaps(week: Week, day: number, cover: Cover, swaps: SwapMap): Macros {
  let total = ZERO_MACROS;
  for (const meal of mealsByWeekDay(week, day)) {
    const shown = effectiveMeal(week, day, meal.slot, meal, swaps);
    total = addMacros(total, shown.macros[cover]);
  }
  return total;
}

export function dayOverBand(week: Week, day: number, cover: Cover, swaps: SwapMap): (keyof Macros)[] {
  const macros = dayMacrosWithSwaps(week, day, cover, swaps);
  return overBandMacros(macros, bands(week, cover));
}

export function weekBand(week: Week, cover: Cover, days: number): Record<MacroGroup, Band> {
  const b = bands(week, cover);
  return {
    kcal: [b.kcal[0] * days, b.kcal[1] * days],
    protein: [b.protein[0] * days, b.protein[1] * days],
    fat: [b.fat[0] * days, b.fat[1] * days],
    netCarb: [b.netCarb[0] * days, b.netCarb[1] * days],
  };
}

export function weekTotals(week: Week, cover: Cover, swaps: SwapMap, days: number): Record<MacroGroup, number> {
  const totals: Record<MacroGroup, number> = { kcal: 0, protein: 0, fat: 0, netCarb: 0 };
  for (let day = 1; day <= days; day++) {
    const m = dayMacrosWithSwaps(week, day, cover, swaps);
    totals.kcal += m.kcal;
    totals.protein += m.protein;
    totals.fat += m.fat;
    totals.netCarb += m.netCarb;
  }
  return totals;
}

/** The Δ this specific swap causes to the day's totals (kcal/protein only —
 * PLAN §6.4: "each showing band impact (Δkcal/ΔP for the day)"). Since only
 * one meal in the day changes, the day-level delta is exactly the two
 * meals' own macro difference — no need to re-sum the whole day. */
export function swapDelta(current: Meal, candidate: Meal, cover: Cover): Macros {
  return subMacros(candidate.macros[cover], current.macros[cover]);
}

/** Which macros this candidate would newly push over band (excludes macros
 * that were already over band before the swap — the swap deck should only
 * warn about damage *this* swap causes, not pre-existing overage). */
export function newlyOverBand(week: Week, day: number, cover: Cover, swaps: SwapMap, current: Meal, candidate: Meal): (keyof Macros)[] {
  const before = dayMacrosWithSwaps(week, day, cover, swaps);
  const after = addMacros(before, swapDelta(current, candidate, cover));
  const b = bands(week, cover);
  const wasOver = new Set(overBandMacros(before, b));
  return overBandMacros(after, b).filter((k) => !wasOver.has(k));
}

// ---------------------------------------------------------------------------
// Logged state — scans the shared household `eaten` ticks for this exact
// meal id. Deliberately id-addressed rather than date-addressed: the a-twice
// fortnight cooks Week A twice from the same content, so a given (week, day,
// slot) cell can correspond to two different real calendar dates across the
// fortnight, and the PLAN board (unlike TODAY) shows content, not a specific
// date. Meal ids are already unique per (week, day, slot) — see data/meals.ts
// ids like "a-d2d" — so "was this exact card ever ticked" is a clean,
// date-independent proxy for "logged" that needs no cycleStartSaturday
// anchor at all (and degrades gracefully — always "not logged" — for the
// Week B browsing pool, which is never actually executed/ticked per D5).
// ---------------------------------------------------------------------------

export function mealLoggedAt(eaten: Eaten, mealId: string): string | null {
  let latest: string | null = null;
  for (const day of Object.values(eaten)) {
    for (const tick of Object.values(day)) {
      if (tick && tick.mealId === mealId && (!latest || tick.at > latest)) {
        latest = tick.at;
      }
    }
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Swap candidates — "Week-B (and cook-from-stock) candidates ranked by stock
// coverage %" (PLAN §6.4). Candidate source = the *other* week's meals of
// the same slot type (breakfast pairs with breakfast, etc. — the natural
// reading of "Week-B ... variety/swap pool", selectors.ts's own module doc);
// ranking dimension = coverageForMeal, which is what "cook-from-stock" means
// throughout this codebase (STORES' identical ranking, reused verbatim, no
// new heuristic invented here). Symmetric by week so the deck also works
// when Week B itself is the browsed board (candidates then come from A).
// ---------------------------------------------------------------------------

export interface SwapCandidate {
  meal: Meal;
  coverage: number; // 0..1, uncapped upstream in coverageForMeal
}

export function candidatesForSlot(week: Week, slot: Slot, cover: Cover, inventory: Inventory): SwapCandidate[] {
  const otherWeek: Week = week === "A" ? "B" : "A";
  return mealsByWeek(otherWeek)
    .filter((m) => m.slot === slot)
    .map((meal) => ({ meal, coverage: coverageForMeal(inventory, meal.id, cover).coverage }))
    .sort((a, b) => b.coverage - a.coverage);
}

export { mealForSlot };

// ---------------------------------------------------------------------------
// Needle-dial geometry (the hero's one precision object) — pure trig, no
// food facts, kept here so AdherenceGauge.tsx stays declarative JSX.
// ---------------------------------------------------------------------------

export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

export function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const p1 = polarToCartesian(cx, cy, r, startAngle);
  const p2 = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
}

/** Display range for a gauge: padded around the band so the needle has room
 * to show "under" / "over" without clipping in the common case, widened
 * further if the actual value itself falls outside that padded range. */
export function gaugeDisplayRange(band: Band, value: number): [number, number] {
  const span = band[1] - band[0] || Math.max(1, Math.abs(band[0]) * 0.1) || 1;
  const pad = span * 0.6;
  let lo = band[0] - pad;
  let hi = band[1] + pad;
  if (value < lo) lo = value - span * 0.15;
  if (value > hi) hi = value + span * 0.15;
  return [lo, hi];
}

/** Maps a value onto a -90..+90 degree needle angle within [lo, hi], clamped
 * at the extremes (a value far outside the display range still points to
 * the dial's physical limit — the text table beside it always carries the
 * exact number regardless, per the Sol gauge rule). */
export function gaugeAngle(value: number, lo: number, hi: number): number {
  const t = hi === lo ? 0.5 : (value - lo) / (hi - lo);
  const clamped = Math.min(1, Math.max(0, t));
  return -90 + clamped * 180;
}
