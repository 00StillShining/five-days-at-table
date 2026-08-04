// Register row name suffix — "eggs ×12" / "yoghurt 1kg" (PLAN §6.7's own
// worked example). Verified against the real dataset:
//   egg:  householdUnitG 50, sku.packG 600  -> 600/50  = 12 exactly -> "×12"
//   greek_yog: householdUnitG null, sku.packG 1000       -> no unit -> "1kg"
//   avocado: householdUnitG 140, sku.packG 560 -> 560/140 = 4 exactly -> "×4"
//   chicken: householdUnitG 175, sku.packG 1000 -> 5.71 (not integer) -> "1kg"
// Rule: show "×N" only when the pack divides evenly (within a tiny epsilon,
// hand-authored real-world pack sizes) into whole household units — a
// fractional count ("×5.7 breasts") is never useful. Otherwise show the pack
// size itself (kg above 1000g, g below), which is always meaningful.
import type { Ingredient } from "../../data/types";

const EPSILON = 0.02;

export function registerNameSuffix(ing: Ingredient): string {
  const sku = ing.sku;
  if (!sku) return "";
  const unitG = ing.spec.householdUnitG;
  if (unitG && unitG > 0) {
    const count = sku.packG / unitG;
    const rounded = Math.round(count);
    if (rounded >= 2 && Math.abs(count - rounded) < EPSILON) return ` ×${rounded}`;
  }
  const g = sku.packG;
  if (g >= 1000) {
    const kg = g / 1000;
    return ` ${Number.isInteger(kg) ? kg : kg.toFixed(1)}kg`;
  }
  return ` ${g}g`;
}

/**
 * Register disambiguation (wave-1-fix item 7): two `sharedSkuWith` pairs
 * reduce to byte-identical `name.short` + pack-suffix text — greek_yog/skyr
 * (both "Fat-free Greek yoghurt 1kg", one SKU, two register rows since
 * they're distinct ingredients with distinct macros) and raspberries/
 * blueberries (both "Frozen mixed berries ×25", same reason). Verified
 * against the full 65-item register: these are the only two collisions
 * (checked by grouping every non-freebie ingredient by `name.short`).
 * Explicit id -> word map rather than derived from `name.display` (which
 * would work here but reads long — "Skyr, plain natural" — where a single
 * word is enough to tell the two rows apart at a glance).
 */
const DISAMBIGUATOR: Record<string, string> = {
  greek_yog: "yoghurt",
  skyr: "skyr",
  raspberries: "raspberries",
  blueberries: "blueberries",
};

export function registerDisambiguator(ing: Ingredient): string {
  const word = DISAMBIGUATOR[ing.id];
  return word ? ` (${word})` : "";
}
