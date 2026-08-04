import raw from "../../data/ingredients.json";
import retiredRaw from "../../data/retired.json";
import type { Ingredient, RetiredIngredient } from "./types";

// Static import — compiled in at build (Vite `resolveJsonModule`), zod-validated
// by the existing extraction pipeline (tools/extract). The UI trusts this JSON.
export const ingredientsList: Ingredient[] = raw as Ingredient[];

export const retiredIngredients: RetiredIngredient[] = retiredRaw as RetiredIngredient[];
const retiredIds = new Set(retiredIngredients.map((r) => r.id));

// Defensive: retired ingredients are already absent from data/ingredients.json
// (verified — 0 overlap), but filter defensively so a future data regen that
// forgets to purge one can't silently leak a retired item into the UI.
export const ingredientsById: Record<string, Ingredient> = Object.fromEntries(
  ingredientsList.filter((i) => !retiredIds.has(i.id)).map((i) => [i.id, i])
);

export function getIngredient(id: string): Ingredient | undefined {
  return ingredientsById[id];
}

export function requireIngredient(id: string): Ingredient {
  const ing = ingredientsById[id];
  if (!ing) throw new Error(`Unknown ingredient id: ${id}`);
  return ing;
}

/**
 * The ingredient's short display name (falling back to `display`, then to
 * the raw id if the ingredient can't be resolved at all — every id used in
 * duty/trip text is already join-verified against data/validation.json, but
 * text-formatting code shouldn't assume that rather than degrade gracefully).
 * INT-3 (final integration review): the one place duty/trip text should turn
 * an `ingId` into words — e.g. engine/arbiter.ts's verify-nominee text and
 * state/selectors.ts's dutyStack defrost text, which previously rendered the
 * raw id ("verify price · banana", "move beef_mince fz -> fr").
 */
export function ingredientShortName(ingId: string): string {
  const ing = ingredientsById[ingId];
  if (!ing) return ingId;
  return ing.name.short || ing.name.display || ingId;
}

export const aisles: string[] = [...new Set(ingredientsList.map((i) => i.aisle))];

export function ingredientsByAisle(aisle: string): Ingredient[] {
  return ingredientsList.filter((i) => i.aisle === aisle && !retiredIds.has(i.id));
}

/**
 * Reference gram quantity for one inventory "unit" of this ingredient, used by
 * the fuzzy 5-level (0..4) inventory heuristic: level maps to 0/¼/½/¾/full of
 * this reference quantity. Prefers the household unit (e.g. one egg, one
 * avocado) since that's what a person actually perceives on a shelf; falls
 * back to the SKU pack size (85/97 ingredients carry a householdUnitG; the
 * rest resolve via packG). Returns null only for the handful of freebies with
 * neither (loose seasonings bought once and never tracked by count) — callers
 * should treat those as always-available rather than computing a level.
 */
export function referenceUnitG(ing: Ingredient): number | null {
  return ing.spec.householdUnitG ?? ing.sku?.packG ?? null;
}
