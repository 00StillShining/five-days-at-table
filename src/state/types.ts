// AppState shape — contract-pinned (docs/PHASE2-CONTRACT.md "State core API").
// The pinned fields must not be removed or retyped; additions are fine
// ("the contract API is law, supersets fine").
import type { Cover, Slot, Week } from "../data/types";

/** Plan-variant selector (docs/VARIANT-SPEC.md "Runtime contract"): "full" is
 * the canonical fortnight (default); "morrisons-tester" swaps the whole app
 * onto the owner's hand-authored 10-meal/one-retailer tester week. Additive —
 * the full dataset never changes, this only picks which lens src/data/variant.ts's
 * `activeVariant(state)` returns. Migration-safe: absent on any prefs blob
 * persisted before this field existed (schemas.ts's PrefsSchema `.default("full")`
 * fills it in on hydrate — see state/persist.ts's zod-validated hydration). */
export type PlanVariant = "full" | "morrisons-tester";

export interface Prefs {
  cover: Cover;
  week: Week;
  scale: number;
  serveTime: string; // "HH:MM", default "19:30"
  cycleStartSaturday: string | null; // ISO date (the Saturday the fortnight anchors to); null -> onboarding
  planVariant: PlanVariant;
}

export type InventoryLevel = 0 | 1 | 2 | 3 | 4;

export interface InventoryEntry {
  level: InventoryLevel;
  /** ISO datetime. The general "this row was touched" marker — bumped by
   * every write (stocktake, prep-yield stamping, restock) and used as the
   * freshness anchor for shelf-life countdowns on non-freezer stock, AND as
   * the "defrost done" signal (a defrost duty is considered actioned once
   * this is bumped on/after the duty's calendar date) — see selectors.ts
   * dutyStack for the documented reasoning. */
  updatedAt: string;
  /**
   * ISO datetime, optional. Freeze-day0/buy-frozen ingredients ONLY
   * (src/data/lifeEstimate.ts's `isFreezerStock`): the moment this specific
   * item was actually moved from freezer to fridge, set by the
   * `inventory/markThawed` action (the defrost-duty "done" tap). Deliberately
   * a SEPARATE field from `updatedAt` — P1 wave-1-review bug ("false-expired
   * flood"): a Saturday stocktake bumps `updatedAt` on an item that's still
   * sitting in the freezer, and if the short post-thaw `freshDays` countdown
   * anchored to THAT timestamp, an item correctly still frozen on Tuesday
   * would read as "expired" days before it was ever actually thawed. With
   * `thawedAt` separate: no `thawedAt` -> still frozen -> no countdown shown
   * at all (selectors.ts `remainingLifeDays` returns null); `thawedAt` set ->
   * the post-thaw countdown anchors to THAT instant, not to whenever the row
   * last happened to be touched.
   * Migration-safe: absent/undefined on every inventory entry persisted
   * before this field existed (optional in InventoryEntrySchema) — treated
   * identically to "not yet thawed," which is the correct conservative
   * default for pre-existing data.
   */
  thawedAt?: string | null;
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
  /** The defrost-duty "done" action (P1 wave-1-review fix) — marks this
   * specific freezer item as thawed as of `at` (default now), starting its
   * post-thaw shelf-life countdown. Preserves the entry's existing `level`
   * (a defrost move doesn't change how much you have) if one exists, else
   * defaults to full (4) — the calendar listing a defrost move for this
   * ingredient already implies it's in stock. */
  | { type: "inventory/markThawed"; ingId: string; at?: string }
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
  /** Multi-tab race fix: StoreProvider's cross-tab `storage`-event handler
   * dispatches this when a FOREIGN tab writes a slice this tab has no
   * pending local write for — replaces just that one slice with the
   * (already zod-validated) foreign value. Never dispatched by screens
   * directly. */
  | { type: "slice/replace"; slice: SliceKey; value: AppState[SliceKey] }
  | { type: "state/replace"; state: AppState }; // used by importExport
