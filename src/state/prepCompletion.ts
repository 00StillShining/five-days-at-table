// Prep-session completion: "prep session done -> stamp yields into inventory
// with computed use-by dates" (contract). Pure function so reducer.ts stays
// a thin dispatch table and this logic is independently unit-testable.
//
// See src/data/yieldMap.ts for the full documented reasoning: yields that
// reduce to exactly one raw ingredient (Roast chicken -> chicken, Boiled eggs
// -> egg, …) are stamped straight into `inventory` (level: full, updatedAt:
// completion time — the freshness anchor lifeEstimate.ts then counts down
// from). Composite yields (Turkey bolognese, Efo riro base, …) have no
// single ingId to stamp, so they become `leftovers[]` entries instead, with
// a use-by computed from the yield's own free-text `storage` field via the
// same prose-fallback parser used for ingredients.
import { estimateFreeTextLifeDays } from "../data/lifeEstimate";
import { prepSessionForWeek, prepSessionId } from "../data/prep";
import type { Week } from "../data/types";
import { ingIdForYield } from "../data/yieldMap";
import { addCalendarDays, londonDateIso } from "./london";
import { makeId } from "./ids";
import type { Inventory, InventoryLevel, LeftoverEntry } from "./types";

/** First "N g" / "N kg" figure found anywhere in a free-text quantity string
 * (e.g. "600 g raw", "~1.4 kg raw", "makes plenty" -> null). Display-only —
 * never used for coverage/macro math, which reads `covers` directly. */
export function parseLeadingGrams(qty: string): number | null {
  const m = qty.match(/([\d,]+(?:\.\d+)?)\s*(kg|g)\b/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return m[2].toLowerCase() === "kg" ? n * 1000 : n;
}

const FULL_LEVEL: InventoryLevel = 4;

export interface PrepCompletionResult {
  inventory: Inventory;
  newLeftovers: LeftoverEntry[];
}

/** Pure: given the current inventory and a week, returns the inventory
 * patch + new leftover entries a completed prep session produces. Returns
 * null if the week has no session (defensive). */
export function computePrepCompletion(week: Week, inventory: Inventory, atIso: string): PrepCompletionResult | null {
  const session = prepSessionForWeek(week);
  if (!session) return null;
  const dateOnly = londonDateIso(new Date(atIso));
  const nextInventory: Inventory = { ...inventory };
  const newLeftovers: LeftoverEntry[] = [];

  for (const y of session.yields) {
    const ingId = ingIdForYield(week, y.component);
    if (ingId) {
      nextInventory[ingId] = { level: FULL_LEVEL, updatedAt: atIso };
      continue;
    }
    const { days, confidence } = estimateFreeTextLifeDays(y.storage);
    newLeftovers.push({
      id: makeId("lo"),
      source: "prep",
      ref: y.component,
      g: parseLeadingGrams(y.qty),
      price: null,
      date: dateOnly,
      useBy: addCalendarDays(dateOnly, Math.round(days)),
      consumers: y.consumers ?? [],
      sourceWeek: week,
      sourceSession: prepSessionId(session),
      note: [y.note, confidence === "low" ? "use-by is a low-confidence estimate" : null].filter(Boolean).join(" — ") || null,
      consumedAt: null,
    });
  }

  return { inventory: nextInventory, newLeftovers };
}
