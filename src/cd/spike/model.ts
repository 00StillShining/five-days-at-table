/**
 * src/cd/spike/model.ts — the REAL register, rebuilt inside the spike.
 *
 * The spike must not import from src/screens/** (another builder owns that
 * folder this round), so the bucketing rule is restated here VERBATIM from
 * src/screens/stores/location.ts, which documents it as verified against every
 * distinct `storage.location` string in data/ingredients.json (0 unmatched).
 * Everything else — the ingredients themselves, the life estimate, the
 * remaining-days arithmetic, the display formatter — is imported from the
 * FROZEN modules, never re-implemented, so the spike cannot drift from the
 * product's own numbers.
 *
 * CD-BRIEF self-critique, "Real data": "the longest ingredient name, the
 * 65-row register, ... the tester variant, an expired item, an empty state."
 * All five are reachable from this module and wired into the harness.
 */

import { ingredientsList, operativeLifeDays, isFreezerStock } from "../../data";
import type { Ingredient } from "../../data/types";
import type { Inventory, InventoryEntry, InventoryLevel } from "../../state/types";
import { formatRemainingDays, remainingLifeDays } from "../../state/selectors";

export type LocationGroup = "fridge" | "freezer" | "counter" | "cupboard";

export const GROUP_ORDER: LocationGroup[] = ["fridge", "freezer", "counter", "cupboard"];

export const GROUP_LABEL: Record<LocationGroup, string> = {
  fridge: "fridge",
  freezer: "freezer",
  counter: "counter",
  cupboard: "cupboard",
};

/** Restated from src/screens/stores/location.ts — see the module doc. */
function bucketLocation(rawLocation: string): LocationGroup {
  const s = rawLocation.toLowerCase();
  if (s.startsWith("freezer")) return "freezer";
  if (s.startsWith("fridge")) return "fridge";
  if (s.startsWith("counter")) return "counter";
  if (s.startsWith("cupboard") || s.includes("cool, dark")) return "cupboard";
  return "cupboard";
}

export const REGISTER_GROUPS: Record<LocationGroup, Ingredient[]> = (() => {
  const groups: Record<LocationGroup, Ingredient[]> = { fridge: [], freezer: [], counter: [], cupboard: [] };
  for (const ing of ingredientsList) {
    if (ing.freebie) continue;
    groups[bucketLocation(ing.storage.location)].push(ing);
  }
  for (const g of GROUP_ORDER) groups[g].sort((a, b) => a.name.short.localeCompare(b.name.short));
  return groups;
})();

export const REGISTER_FLAT: Ingredient[] = GROUP_ORDER.flatMap((g) => REGISTER_GROUPS[g]);

/** 65. Asserted at module load so a data regen that changes it is loud. */
export const REGISTER_COUNT = REGISTER_FLAT.length;

/** Pack suffix, restated from src/screens/stores/registerName.ts. */
const EPSILON = 0.02;
export function nameSuffix(ing: Ingredient): string {
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

const DISAMBIGUATOR: Record<string, string> = {
  greek_yog: "yoghurt",
  skyr: "skyr",
  raspberries: "raspberries",
  blueberries: "blueberries",
};
export function disambiguator(ing: Ingredient): string {
  const w = DISAMBIGUATOR[ing.id];
  return w ? ` (${w})` : "";
}

// ---------------------------------------------------------------------------
// countdown — restated from src/screens/stores/countdown.ts, same selectors
// ---------------------------------------------------------------------------

export type CountdownStatus = "empty" | "frozen" | "expired" | "expiring" | "low-confidence" | "ok";

export interface Countdown {
  text: string;
  status: CountdownStatus;
  /** Remaining life as a fraction of operative life, 0..1, or null when the
   *  question does not apply (never stocked, still frozen, prose with no
   *  number behind it). The LIFE SCALE reads this; it never invents one. */
  fraction: number | null;
}

const EXPIRING_WINDOW_DAYS = 1;

export function countdownFor(ing: Ingredient, entry: InventoryEntry | undefined, now: Date): Countdown {
  if (!entry || entry.level === 0) return { text: "—", status: "empty", fraction: null };

  const remainingDays = remainingLifeDays(ing, entry, now);
  if (remainingDays == null) return { text: "frozen", status: "frozen", fraction: null };

  const life = operativeLifeDays(ing);
  if (life.confidence === "low") return { text: "low", status: "low-confidence", fraction: null };

  const total = life.days;
  const fraction = total && total > 0 ? Math.max(0, Math.min(1, remainingDays / total)) : null;

  return {
    text: formatRemainingDays(remainingDays),
    status: remainingDays < 0 ? "expired" : remainingDays <= EXPIRING_WINDOW_DAYS ? "expiring" : "ok",
    fraction,
  };
}

// ---------------------------------------------------------------------------
// seeding — REAL rows, real actions, real timestamps. No lorem, no fake data.
// ---------------------------------------------------------------------------

export const LEVEL_WORD: [string, string, string, string, string] = ["empty", "¼", "½", "¾", "full"];
/** The fenestrated knob's window is "no wider than the digit it shows" (CLEAR
 *  LID section 3), so the wheel reads the level as a figure, not as a word. The
 *  word still prints on the detent plates and in every accessible name. */
export const LEVEL_GLYPH: [string, string, string, string, string] = ["0", "¼", "½", "¾", "1"];
export const LEVEL_ANNOUNCE: [string, string, string, string, string] = [
  "empty",
  "a quarter",
  "about half",
  "three quarters",
  "full",
];

export interface SeedEntry {
  ingId: string;
  level: InventoryLevel;
  at: string;
}

/**
 * A plausible real stocktake, deterministic so a trace is repeatable.
 *
 * Deliberately includes:
 *   - an EXPIRED item: the shortest-lived fresh row, stamped one whole
 *     operative life ago plus a day, so `remainingLifeDays` returns a genuinely
 *     negative number. Nothing is faked — the reducer writes the timestamp and
 *     the frozen selector does the arithmetic.
 *   - an EXPIRING item: the same trick, landed inside the 1-day window.
 *   - untouched rows, so the "never counted" / empty state renders alongside.
 */
export function seedEntries(now: Date): SeedEntry[] {
  const out: SeedEntry[] = [];
  const fresh: { ing: Ingredient; days: number }[] = [];

  REGISTER_FLAT.forEach((ing, i) => {
    if (i % 7 === 6) return; // ~9 rows left genuinely uncounted
    const level = ((i * 3 + 1) % 5) as InventoryLevel;
    if (level === 0) {
      out.push({ ingId: ing.id, level, at: new Date(now.getTime() - 36 * 3600_000).toISOString() });
      return;
    }
    const life = operativeLifeDays(ing);
    if (!isFreezerStock(ing) && life.confidence !== "low" && life.days > 0) fresh.push({ ing, days: life.days });
    out.push({ ingId: ing.id, level, at: new Date(now.getTime() - ((i % 5) + 1) * 3600_000).toISOString() });
  });

  fresh.sort((a, b) => a.days - b.days);
  const expired = fresh[0];
  const expiring = fresh[1] ?? fresh[0];
  if (expired) {
    const idx = out.findIndex((e) => e.ingId === expired.ing.id);
    const at = new Date(now.getTime() - (expired.days + 1) * 86_400_000).toISOString();
    if (idx >= 0) out[idx] = { ingId: expired.ing.id, level: 2, at };
    else out.push({ ingId: expired.ing.id, level: 2, at });
  }
  if (expiring && expiring !== expired) {
    const idx = out.findIndex((e) => e.ingId === expiring.ing.id);
    const at = new Date(now.getTime() - (expiring.days - 0.5) * 86_400_000).toISOString();
    if (idx >= 0) out[idx] = { ingId: expiring.ing.id, level: 3, at };
    else out.push({ ingId: expiring.ing.id, level: 3, at });
  }
  return out;
}

/** Group fill: the arithmetic mean level over COUNTED rows, 0..1. Real, and
 *  it moves only when a hand moves it — CD-BRIEF ruling 6's own test. */
export function groupFill(rows: Ingredient[], inventory: Inventory): { fraction: number; counted: number; stocked: number } {
  let sum = 0;
  let counted = 0;
  let stocked = 0;
  for (const ing of rows) {
    const e = inventory[ing.id];
    if (!e) continue;
    counted++;
    sum += e.level;
    if (e.level > 0) stocked++;
  }
  return { fraction: counted === 0 ? 0 : sum / (counted * 4), counted, stocked };
}

/** The most recent stocktake timestamp across a set of rows, or null. */
export function latestStocktake(rows: Ingredient[], inventory: Inventory): string | null {
  let best: string | null = null;
  for (const ing of rows) {
    const e = inventory[ing.id];
    if (!e) continue;
    if (best === null || e.updatedAt > best) best = e.updatedAt;
  }
  return best;
}
