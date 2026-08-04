// AppState shape — contract-pinned (docs/PHASE2-CONTRACT.md "State core API").
// The pinned fields must not be removed or retyped; additions are fine
// ("the contract API is law, supersets fine").
import type { Cover, Slot, Week } from "../data/types";

export interface Prefs {
  cover: Cover;
  week: Week;
  scale: number;
  serveTime: string; // "HH:MM", default "19:30"
  cycleStartSaturday: string | null; // ISO date (the Saturday the fortnight anchors to); null -> onboarding
}

export type InventoryLevel = 0 | 1 | 2 | 3 | 4;

export interface InventoryEntry {
  level: InventoryLevel;
  /** ISO datetime. Doubles as the freshness anchor for shelf-life countdowns
   * (src/data/lifeEstimate.ts) AND as the "defrost done" signal (a defrost
   * duty is considered actioned once this is bumped on/after the duty's
   * calendar date) — see selectors.ts dutyStack for the documented reasoning. */
  updatedAt: string;
}

export type Inventory = Record<string, InventoryEntry>;

export interface EatenTick {
  mealId: string;
  at: string; // ISO datetime
}

/** Shared household ticks (R2, docs/SOL-BRIEF.md): one tick per date+slot,
 * not per cover — both covers eat the same plate. */
export type Eaten = Record<string, Partial<Record<Slot, EatenTick>>>; // isoDate -> slot -> tick

export interface ShopTick {
  at: string; // ISO datetime
}

/** Keyed tripId -> ingId -> tick, explicitly never DOM/list order (PLAN §5). */
export type ShopTicks = Record<string, Record<string, ShopTick>>;

export type LeftoverSource = "prep" | "meal";

export interface LeftoverEntry {
  id: string; // synthetic, stable
  source: LeftoverSource;
  /** prep source: the yield's `component` name. meal source: the meal id. */
  ref: string;
  g: number | null;
  price: number | null; // "£" per PLAN §5's {ref, g, £, date} shape; null when not costed
  date: string; // ISO date the leftover was produced/logged
  useBy: string; // ISO date, computed
  consumers: string[]; // meal ids expected to draw on this (prep-sourced only)
  sourceWeek: Week | null;
  sourceSession: string | null; // "prep-a" | "prep-b" | null
  note: string | null;
  consumedAt: string | null; // ISO datetime once used up / discarded
}

export interface WasteEntry {
  id: string;
  ref: string; // mealId or ingId or free description
  g: number | null;
  price: number | null; // "£" — the wasted value
  date: string; // ISO date
  note: string | null;
}

export interface PriceCheck {
  price: number;
  on: string; // ISO date
}

export type PriceChecks = Record<string, PriceCheck>;

/**
 * PLAN §6.4 swap deck: which meal is actually shown/cooked for a slot, when
 * it differs from the plan. Keyed by the ORIGINAL (planned) meal's id ->
 * replacement meal's id — e.g. `{ "a-d2d": "b-d2d" }` means "day 2's dinner
 * slot, planned as a-d2d, is swapped to b-d2d." Meal ids already encode
 * "<week>-d<day><slotInitial>" (P2-PLAN-001's suggested slotKey shape is
 * exactly the existing meal-id format), so keying by the planned meal's own
 * id — rather than re-deriving a parallel "week:day:slot" string — reuses an
 * identifier that's already unique, already validated by data/validation.json,
 * and needs no parsing to resolve (`getMeal(swaps[plannedId])`). The
 * executing fortnight is always Week A (D5), so in practice every key is an
 * "a-d#…" id, but nothing here enforces that — see selectors.ts
 * `effectiveMealForSlot`.
 */
export type Swaps = Record<string, string>;

// ---- timers (engine-owned slice; src/engine/timers.ts drives it) ---------

export interface TimerSliceState {
  programId: string | null;
  /** epoch ms; null until start() */
  startedAt: number | null;
  /** epoch ms while paused; null while running or not started */
  pausedAt: number | null;
  /** total ms spent paused so far, excluding any currently-open pause */
  accumulatedPauseMs: number;
  /** cumulative "+1 minute" extensions, delaying the virtual elapsed clock */
  extraMs: number;
  /** step numbers explicitly marked done (advances stepNow/stepNext, clears dueNow) */
  doneSteps: number[];
}

export interface AppState {
  prefs: Prefs;
  inventory: Inventory;
  eaten: Eaten;
  shopTicks: ShopTicks;
  leftovers: LeftoverEntry[];
  waste: WasteEntry[];
  priceChecks: PriceChecks;
  timers: TimerSliceState;
  swaps: Swaps;
}

export type SliceKey = keyof AppState;

// ---- Actions ---------------------------------------------------------------

export type Action =
  | { type: "prefs/set"; patch: Partial<Prefs> }
  | { type: "inventory/set"; ingId: string; level: InventoryLevel; at?: string }
  | { type: "inventory/setMany"; entries: { ingId: string; level: InventoryLevel; at?: string }[] }
  | { type: "eaten/tick"; date: string; slot: Slot; mealId: string; at?: string }
  | { type: "eaten/untick"; date: string; slot: Slot }
  | { type: "shopTicks/tick"; tripId: string; ingId: string; at?: string }
  | { type: "shopTicks/untick"; tripId: string; ingId: string }
  | { type: "leftovers/add"; entry: Omit<LeftoverEntry, "id"> & { id?: string } }
  | { type: "leftovers/consume"; id: string; at?: string }
  | { type: "leftovers/remove"; id: string }
  | { type: "waste/add"; entry: Omit<WasteEntry, "id"> & { id?: string } }
  | { type: "priceChecks/set"; ingId: string; price: number; on?: string }
  | { type: "timers/load"; programId: string }
  | { type: "timers/start"; at?: number }
  | { type: "timers/pause"; at?: number }
  | { type: "timers/resume"; at?: number }
  | { type: "timers/plusOneMinute" }
  | { type: "timers/doneStep"; step: number }
  | { type: "timers/reset" }
  | { type: "prep/completeSession"; week: Week; at?: string }
  | { type: "swaps/commit"; slotMealId: string; replacementMealId: string }
  | { type: "swaps/clear"; slotMealId: string }
  | { type: "swaps/clearAll" }
  | { type: "state/replace"; state: AppState }; // used by importExport
