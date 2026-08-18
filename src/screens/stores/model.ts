/**
 * src/screens/stores/model.ts — the arithmetic behind every instrument on STORES.
 *
 * Pure, and deliberately separate from the components, because every figure on
 * this screen is a claim about a real reading and a claim nothing checks is a
 * claim waiting to drift (see model.test.ts).
 *
 * Nothing here invents data. Every number below is derived from the FROZEN
 * store (`src/state/**`) and the FROZEN dataset (`src/data/**`) through their
 * own selectors — `remainingLifeDays`, `operativeLifeDays`, `formatRemainingDays`,
 * `coverageForAllMeals` — never re-implemented locally.
 *
 * COMMITTED GEOMETRY, with the clause each value came from:
 *
 *   POINTER_SLEW_PX_S      340 px/s   CLEAR LID section 3, the lamp scale's own
 *                                     pointer, unrolled from an arc into a
 *                                     straight line (II.4.8 — sweep is a RATE)
 *   SLEW_FLOOR_MS           80 ms     II.4.8's floor, so the smallest
 *                                     correction still registers
 *   WHEEL_TRACK  5 seats, 30 deg pitch, 12% band
 *                                     CLEAR LID section 3's fenestrated knob
 *                                     re-cuts the Foundry's thirteen seats at
 *                                     22.5 deg (II.3.6) to THREE at 30 deg. The
 *                                     inventory level is five-valued, so this is
 *                                     FIVE seats at the chapter's own 30 deg
 *                                     pitch over 120 deg of sweep. Pitch,
 *                                     hysteresis and seat time are unchanged.
 *   WHEEL_SEAT_MS          110 ms     CLEAR LID section 3, inside II.1.11's
 *                                     80-160ms seat window
 *   WINDOW_SHARPEN_MS       24 ms     CLEAR LID section 3's Signature
 *                                     escalation — the window sharpens a beat
 *                                     BEHIND the cap's arrival
 *
 * The printed life zone's own band edges (22% expired, 46% caution) live in
 * stores.css, which is their only consumer — one value, one place.
 */

import type { Ingredient } from "../../data/types";
import type { Inventory, InventoryEntry } from "../../state/types";
import type { DetentTrack } from "../../cd/physics/detent";
import { REGISTER_FLAT } from "./location";
import type { Countdown } from "./countdown";

/* ===========================================================================
   the thumbwheel's own track
   =========================================================================== */

/** Declared delta on CLEAR LID section 3 — see the module doc. */
export const WHEEL_TRACK: DetentTrack = { seats: 5, pitch: 30, band: 0.12 };
export const WHEEL_SEAT_MS = 110;
export const WHEEL_SWEEP_DEG = (WHEEL_TRACK.seats - 1) * WHEEL_TRACK.pitch; // 120
/** CLEAR LID section 3's Signature escalation — the window sharpens a beat
 *  BEHIND the cap's arrival. Committed here and spent in stores.css. */
export const WINDOW_SHARPEN_MS = 24;

/** The level as a WORD, printed on the plate and on every detent plate. */
export const LEVEL_WORD: readonly [string, string, string, string, string] = [
  "empty",
  "¼",
  "½",
  "¾",
  "full",
];

/**
 * The level as a FIGURE, for the fenestrated knob's own window — which is
 * "no wider than the digit it shows" (CLEAR LID section 3), so the window
 * cannot carry the word.
 */
export const LEVEL_GLYPH: readonly [string, string, string, string, string] = [
  "0",
  "¼",
  "½",
  "¾",
  "1",
];

/** What a screen reader hears. Never an index. */
export const LEVEL_ANNOUNCE: readonly [string, string, string, string, string] = [
  "empty",
  "a quarter",
  "about half",
  "three quarters",
  "full",
];

/* ===========================================================================
   the pointer's sweep — a RATE, never a duration (II.4.8)
   =========================================================================== */

/** CLEAR LID section 3: CLEARLID_POINTER_SLEW = 340 px/s of scale traversed. */
export const POINTER_SLEW_PX_S = 340;
/** II.4.8 — the floor, so the smallest correction still registers. */
export const SLEW_FLOOR_MS = 80;

export function slewMs(fromPx: number, toPx: number): number {
  return Math.max(SLEW_FLOOR_MS, (Math.abs(toPx - fromPx) / POINTER_SLEW_PX_S) * 1000);
}

/**
 * A SWEEP IS A REPORT OF A VALUE CHANGE, AND OF NOTHING ELSE.
 *
 * DEFECT FOUND BY RENDERING: every pointer on this screen is positioned in
 * pixels against a scale it measures, so the first measurement and every resize
 * change the target without the reading having changed at all. Left animated,
 * the larder gauge's needle swept 315px over 930ms on page load — motion with
 * nothing behind it, which is II.4.16 and CLEAR LID section 9's own
 * "ornamental hinge" failure ("acrylic clears while the number underneath holds
 * still").
 *
 * So a geometry change relocates the needle in ONE FRAME and a value change
 * sweeps at the committed rate. The position is identical either way; only the
 * time it takes to get there differs, which is exactly what II.4.8 governs.
 */
export function sweepMs(fromPx: number, toPx: number, valueChanged: boolean): number {
  return valueChanged ? slewMs(fromPx, toPx) : 0;
}

/**
 * Seat centre for a level on a five-seat printed scale of `widthPx`.
 * The seats are the CENTRES of five equal printed divisions, so level 0 does
 * not sit on the scale's own left edge — a needle hard against the wall reads
 * as a broken instrument, not as a zero.
 */
export function levelPx(level: number, widthPx: number): number {
  return ((level + 0.5) / 5) * widthPx;
}

/* ===========================================================================
   the printed life zone
   =========================================================================== */

/**
 * The life index's own x, on a channel of `widthPx`.
 *
 * Inset 2px at each end for the same reason the tuning pointer is: a mark
 * straddling the channel wall is half-clipped, and a half-clipped index reads
 * as damage rather than as a full reading (II.3.18's "off state parks the
 * needle against a physical rest stop", not through it).
 */
export function lifePxOf(fraction: number, widthPx: number): number {
  return coveragePx(fraction, widthPx);
}

/* ===========================================================================
   the larder's own readings
   =========================================================================== */

export interface Fill {
  /** Mean level over COUNTED rows, 0..1. Moves only when a hand moves it. */
  fraction: number;
  /** How many of these rows have an inventory entry at all. */
  counted: number;
  /** How many of them are above empty. */
  stocked: number;
  /** How many are at or below a quarter — the restock queue's own size. */
  low: number;
  total: number;
}

/**
 * Fill over a set of rows.
 *
 * `fraction` is the arithmetic mean level over COUNTED rows only, NOT over all
 * rows: an uncounted row is an absent reading, and averaging it in as a zero
 * would report a full fridge as half empty on the strength of rows nobody has
 * looked at. `counted` prints beside it so the denominator is never hidden.
 */
export function fillOf(rows: Ingredient[], inventory: Inventory): Fill {
  let sum = 0;
  let counted = 0;
  let stocked = 0;
  let low = 0;
  for (const ing of rows) {
    const entry = inventory[ing.id];
    if (!entry) continue;
    counted++;
    sum += entry.level;
    if (entry.level > 0) stocked++;
    if (entry.level <= 1) low++;
  }
  return {
    fraction: counted === 0 ? 0 : sum / (counted * 4),
    counted,
    stocked,
    low,
    total: rows.length,
  };
}

/** The most recent stocktake timestamp across a set of rows, or null. */
export function latestStocktake(rows: Ingredient[], inventory: Inventory): string | null {
  let best: string | null = null;
  for (const ing of rows) {
    const entry = inventory[ing.id];
    if (!entry) continue;
    if (best === null || entry.updatedAt > best) best = entry.updatedAt;
  }
  return best;
}

export interface Alert {
  ingId: string;
  name: string;
  status: "expired" | "expiring";
  /** The exact countdown text, printed beside the name. */
  text: string;
}

export interface ExpiryCensus {
  expired: number;
  expiring: number;
  frozen: number;
  /** Rows with an entry at or below a quarter — what SHOP is owed. */
  low: number;
  /** Rows that have never been counted at all. Absent, not empty. */
  uncounted: number;
  /**
   * Every expired row, then every expiring one, NAMED. A count alone tells the
   * operator that something is wrong; the annunciator's job is to say what, and
   * to put one press between the reading and the row that produced it.
   */
  alerts: Alert[];
}

/**
 * One pass over the whole register, so the annunciator, the larder gauge and
 * the restock figure can never disagree about the same fact.
 */
export function censusOf(
  inventory: Inventory,
  countdownFor: (ing: Ingredient, entry: InventoryEntry | undefined) => Countdown
): ExpiryCensus {
  let expired = 0;
  let expiring = 0;
  let frozen = 0;
  let low = 0;
  let uncounted = 0;
  const expiredRows: Alert[] = [];
  const expiringRows: Alert[] = [];
  for (const ing of REGISTER_FLAT) {
    const entry = inventory[ing.id];
    if (!entry) uncounted++;
    else if (entry.level <= 1) low++;
    const countdown = countdownFor(ing, entry);
    if (countdown.status === "expired") {
      expired++;
      expiredRows.push({ ingId: ing.id, name: ing.name.short, status: "expired", text: countdown.text });
    } else if (countdown.status === "expiring") {
      expiring++;
      expiringRows.push({ ingId: ing.id, name: ing.name.short, status: "expiring", text: countdown.text });
    } else if (countdown.status === "frozen") frozen++;
  }
  // Expired first: the arbiter's own priority order (expired > everything else),
  // so the strip and the act-now slot can never disagree about what leads.
  return { expired, expiring, frozen, low, uncounted, alerts: [...expiredRows, ...expiringRows] };
}

/* ===========================================================================
   the tuning scale
   =========================================================================== */

export interface Station {
  mealId: string;
  name: string;
  /** 0..1, the frozen selector's own grams-weighted figure. */
  coverage: number;
  /** How many of this meal's tracked ingredients are genuinely in stock. */
  inStock: number;
  /** How many tracked ingredients it needs in total. */
  needed: number;
  /** docs/VARIANT-SPEC.md — kept meals rank first in the tester. */
  keptThisWeek: boolean;
}

/**
 * The pointer's x for a station, on a scale of `widthPx`.
 *
 * Unlike the level scale there are no seats here: coverage is continuous, so
 * the pointer reads the value directly with a 2px inset at each end so the
 * needle never disappears into the well wall.
 */
export function coveragePx(coverage: number, widthPx: number): number {
  const clamped = Math.max(0, Math.min(1, coverage));
  return 2 + clamped * Math.max(0, widthPx - 4);
}

/* ===========================================================================
   the dinner ledger's portions
   =========================================================================== */

export interface Portion {
  key: string;
  label: string;
  fraction: number;
}

/** PLAN section 6.7's own four presets. */
export const PORTIONS: readonly Portion[] = [
  { key: "bit", label: "a bit", fraction: 0.25 },
  { key: "half", label: "half", fraction: 0.5 },
  { key: "most", label: "most", fraction: 0.75 },
  { key: "all", label: "all of it", fraction: 1 },
];

