// Shared display-formatting helpers with no food-fact or state knowledge of
// their own (pure `value -> string`) — promoted here per the final
// integration review (INT-4) after two screens independently wrote
// byte-identical implementations. Screens adopt these in their own pass
// (ownership: src/screens/**); see the review report for the exact
// per-screen swap-out list.

/**
 * Pack-size display convention ("500g", "1kg", "1.5kg") — was duplicated
 * verbatim as SHOP's `formatPackG` (src/screens/shop/tripHelpers.ts) and
 * LIST's `formatGrams` (src/screens/list/model.ts). One canonical
 * implementation now; kept the SHOP name since both call sites already read
 * naturally as "format this many grams of a pack."
 */
export function formatPackG(g: number): string {
  if (g >= 1000) {
    const kg = g / 1000;
    return `${Number.isInteger(kg) ? kg : kg.toFixed(1)}kg`;
  }
  return `${g}g`;
}
