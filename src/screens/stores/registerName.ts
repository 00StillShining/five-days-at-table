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
