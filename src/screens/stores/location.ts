// Register grouping (PLAN §6.7: "grouped by location (fridge/freezer/counter/
// cupboard from storage.location)"). ingredients.json's `storage.location` is
// free text (15 distinct values, e.g. "Fridge, paper bag", "Freezer → toaster",
// "Cool, dark, not the fridge") — not the four clean buckets the screen spec
// names. Bucketed here by a documented prefix/keyword rule, verified against
// every distinct value the dataset actually contains (0 unmatched, checked by
// hand against `data/ingredients.json` at build time of this screen).
//
// Freebie ingredients (32/97 — salt, spices, garlic, oils bought once…) are
// excluded from the register, matching the precedent already set by
// state/selectors.ts's coverageForMeal: "Freebie seasonings ... excluded ...
// PLAN's own 'spice shelf' note treats them as bought once and always on
// hand ... STORES' 30-item stocktake target implies they aren't part of the
// tracked register either." Same call here, for the same reason.
import { ingredientsList } from "../../data";
import type { Ingredient } from "../../data/types";

export type LocationGroup = "fridge" | "freezer" | "counter" | "cupboard";

export const LOCATION_GROUP_ORDER: LocationGroup[] = ["fridge", "freezer", "counter", "cupboard"];

export const LOCATION_GROUP_LABEL: Record<LocationGroup, string> = {
  fridge: "fridge",
  freezer: "freezer",
  counter: "counter",
  cupboard: "cupboard",
};

/** Bucket a raw `storage.location` string into one of the four register
 * groups. Falls back to "cupboard" (the pantry catch-all) for anything that
 * matches none of the prefixes — defensive only; every current value matches. */
export function bucketLocation(rawLocation: string): LocationGroup {
  const s = rawLocation.toLowerCase();
  if (s.startsWith("freezer")) return "freezer"; // incl. "Freezer → fridge", "Freezer → toaster", "Freezer, once opened"
  if (s.startsWith("fridge")) return "fridge"; // incl. "Fridge, paper bag", "Fridge, in water", "Fridge, once opened"
  if (s.startsWith("counter")) return "counter"; // incl. "Counter, not fridge", "Counter, then fridge"
  if (s.startsWith("cupboard") || s.includes("cool, dark")) return "cupboard"; // incl. "Cupboard, then fridge", "Cupboard, dark"
  return "cupboard";
}

/** Every register-tracked ingredient (non-freebie), grouped + name-sorted —
 * computed once at module load since ingredients.json is static data. */
export const REGISTER_GROUPS: Record<LocationGroup, Ingredient[]> = (() => {
  const groups: Record<LocationGroup, Ingredient[]> = { fridge: [], freezer: [], counter: [], cupboard: [] };
  for (const ing of ingredientsList) {
    if (ing.freebie) continue;
    groups[bucketLocation(ing.storage.location)].push(ing);
  }
  for (const g of LOCATION_GROUP_ORDER) {
    groups[g].sort((a, b) => a.name.short.localeCompare(b.name.short));
  }
  return groups;
})();

/** Flat register order (fridge, freezer, counter, cupboard; name-sorted
 * within each) — the sequence tap-to-focus / arrow-key stocktake advances
 * through, and the sequence the thumbwheel's "next row" targets. */
export const REGISTER_FLAT: Ingredient[] = LOCATION_GROUP_ORDER.flatMap((g) => REGISTER_GROUPS[g]);

export const REGISTER_COUNT = REGISTER_FLAT.length;
