// Pure helpers for the MEAL screen (PLAN §6.5). No food facts of its own —
// everything here operates on the typed accessors from src/data (screens must
// stay food-fact-free; this file is arithmetic + formatting only).
import type { Ingredient } from "../../data";

// ---------------------------------------------------------------------------
// The portion knob's contract range (PLAN §6.5 / PHASE2-CONTRACT): 0.70–1.30,
// 13 detents at 0.05 steps.
// ---------------------------------------------------------------------------

export const SCALE_MIN = 0.7;
export const SCALE_MAX = 1.3;
export const SCALE_STEP = 0.05;

export const SCALE_DETENTS: number[] = Array.from({ length: 13 }, (_, i) =>
  Math.round((SCALE_MIN + i * SCALE_STEP) * 100) / 100
);

/** Clamp to [min,max] and snap to the nearest 0.05 detent, rounded to avoid
 * float artifacts (0.7500000000001 etc). The single choke point every input
 * path (keyboard, steppers, typed value, pointer drag) must run through. */
export function clampSnapScale(v: number): number {
  const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, v));
  const snapped = Math.round(clamped / SCALE_STEP) * SCALE_STEP;
  return Math.round(snapped * 100) / 100;
}

// ---------------------------------------------------------------------------
// Per-meal, per-cover macro recomputation at the current scale used to live
// here as a local `scaledMealMacros` (this screen couldn't add to
// state/selectors.ts under its original ownership). Wave-1 integration
// review hoisted the identical formula into `mealMacros(mealId, cover,
// scale)` in src/state/selectors.ts (verified equivalent) so COOK/PLAN can
// share it too — CoverColumn.tsx now calls that directly; nothing local
// left to duplicate it here.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Household-unit hints ("½ avocado", "2 eggs") — PLAN §6.5.
// ---------------------------------------------------------------------------

const FRACTION_GLYPHS: [number, string][] = [
  [0.75, "¾"],
  [0.5, "½"],
  [0.25, "¼"],
];

function roundToQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

/**
 * Converts a (already-scaled) gram figure into a household-unit phrase using
 * the ingredient's spec.householdUnitG hint, e.g. 105g avocado (unit 140g) ->
 * "¾ avocado". Rounds to the nearest quarter-unit — a genuine approximation
 * of the authoritative gram figure, which is why callers pair this with
 * <EstimateMark/> (PHASE2-CONTRACT: "estimates = ink ≈ + dotted underline,
 * never color alone"). Returns null when the ingredient carries no household
 * unit, or the scaled amount rounds to nothing worth stating.
 */
export function formatHouseholdHint(scaledGrams: number, ing: Ingredient): string | null {
  const unit = ing.spec.householdUnitG;
  if (!unit || unit <= 0) return null;
  const count = roundToQuarter(scaledGrams / unit);
  if (count <= 0) return null;
  const whole = Math.floor(count);
  const frac = Math.round((count - whole) * 4) / 4;
  const fracGlyph = frac === 0 ? "" : FRACTION_GLYPHS.find(([f]) => f === frac)?.[1] ?? "";
  const numberText = whole > 0 ? `${whole}${fracGlyph}` : fracGlyph || null;
  if (!numberText) return null;
  const word = count > 1 ? ing.spec.unitPlural : ing.spec.unitSingular;
  if (!word) return null;
  return `${numberText} ${word}`;
}

// ---------------------------------------------------------------------------
// Step duration formatting (method preview).
// ---------------------------------------------------------------------------

export function formatStepDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  const whole = Math.floor(minutes);
  const seconds = Math.round((minutes - whole) * 60);
  return seconds > 0 ? `${whole}m ${seconds}s` : `${whole}m`;
}

// ---------------------------------------------------------------------------
// In-stock marks (fuzzy 0-4 inventory level -> glyph + accessible text).
// ---------------------------------------------------------------------------

export const STOCK_LEVEL_GLYPH: Record<number, string> = {
  0: "○",
  1: "◔",
  2: "◑",
  3: "◕",
  4: "●",
};

export const STOCK_LEVEL_TEXT: Record<number, string> = {
  0: "out of stock",
  1: "in stock · about a quarter",
  2: "in stock · about half",
  3: "in stock · about three-quarters",
  4: "in stock",
};
