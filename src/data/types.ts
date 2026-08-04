// Hand-written interfaces matching PLAN.md §5's data model spec, over the
// canonical JSON in data/*.json. No codegen — these are kept in sync by hand
// against the extraction pipeline's output shape (tools/extract, data/validation.json).
//
// The UI (src/app, src/screens, src/components) must contain no food facts:
// everything reads through src/data/*'s typed accessors, which return these types.

export type Cover = "w" | "m"; // her (70kg) | him (85kg) — matches AppState.prefs.cover
export type Week = "A" | "B";
export type Slot = "breakfast" | "lunch" | "dinner" | "snack";
export type MealTag = "batch" | "fresh";
export type Shop = "S" | "M" | "X"; // Sainsbury's, Morrisons, Lewisham market (H is dead per PLAN §2)
export type StorageClass = "buy-once" | "freeze-day0" | "buy-frozen" | "stagger" | "topup";
export type CalendarVariant = "a-twice" | "a+b" | "3-week";
export type CalendarPhase = "shop" | "prep" | "defrost";
export type CalendarMove = "buy" | "freezer → fridge";

export interface Macros {
  kcal: number;
  protein: number;
  netCarb: number;
  fat: number;
  fibre: number;
}

export interface PerCover<T> {
  w: T;
  m: T;
}

// ---- ingredients.json ----------------------------------------------------

export interface IngredientLife {
  /** Free-text shelf-life description, always present — the only field guaranteed
   * populated. Structured day counts below are populated for 24/97 ingredients only;
   * see src/data/lifeEstimate.ts for the prose-parsing fallback used for the rest. */
  prose: string;
  sealedDays: number | null;
  openDays: number | null;
  frozenDays: number | null;
  freshDays: number | null;
}

export interface IngredientStorage {
  class: StorageClass;
  location: string;
  note: string;
  life: IngredientLife;
}

export interface IngredientSku {
  shop: Shop;
  product: string;
  packG: number;
  price: number;
  estimate: boolean;
  estimateSource: string | null;
  verifiedOn: string | null; // ISO date
  sharedSkuWith: string | null; // ingId of the ingredient this shopping line merges with
}

export interface Ingredient {
  id: string;
  name: { display: string; short: string; canonical: string };
  aliases: string[];
  per100g: { kcal: number; protein: number; fat: number; carb: number; fibre: number };
  spec: {
    weightState: string;
    householdUnitG: number | null;
    unitSingular: string;
    unitPlural: string;
  };
  aisle: string;
  freebie: boolean;
  addedInExtraction?: boolean;
  storage: IngredientStorage;
  /** null for a handful of freebie seasonings never separately purchased (soy sauce,
   * mirin, honey, sugar, suya spice) or made at home (vinegar). */
  sku: IngredientSku | null;
}

// ---- meals.json ------------------------------------------------------------

export interface MethodStep {
  n: number;
  text: string;
  minutes: number | null;
  tempC: number | null;
  track: string | null;
  station: string | null;
  clockStart: number | null; // minutes elapsed since program start; absolute, shared across tracks
  untimed?: boolean;
}

export interface BatchTakeG {
  w: number;
  m: number;
  total: number;
}

export interface MealMethod {
  steps: MethodStep[];
  why: string;
  batchSource: string | null; // prep session id ("prep-a" | "prep-b")
  batchTakeG: BatchTakeG | null;
  approved: boolean;
  rev: string;
}

export interface Meal {
  id: string; // a-d1b … b-d5s
  week: Week;
  day: number; // 1–5
  slot: Slot;
  name: string;
  origin: string;
  tag: MealTag;
  activeMin: number;
  covers: PerCover<Record<string, number>>; // ingId -> grams
  macros: PerCover<Macros>;
  method: MealMethod;
}

// ---- prep.json ---------------------------------------------------------

export interface PrepOpIngredient {
  ingId: string;
  g: number;
}

export interface PrepOp {
  clock: string; // "H:MM" elapsed since session start
  title: string;
  body: string;
  station: string;
  minutes: number | null;
  tempC: number | null;
  untimed?: boolean;
  ingredients: PrepOpIngredient[];
}

export interface PrepYield {
  component: string;
  qty: string;
  consumers: string[] | null; // meal ids
  storage: string; // free text, e.g. "Fridge, whole, 4 days"
  note: string | null;
}

export interface PrepMidweek {
  heading: string;
  body: string;
}

export interface PrepSession {
  week: Week;
  sessionName: string;
  totalMin: number;
  ops: PrepOp[];
  yields: PrepYield[];
  midweek: PrepMidweek[];
  rev?: string;
  approved?: boolean;
}

// ---- calendar.json -------------------------------------------------------

export interface CalendarItem {
  ingId: string;
  g: number;
  move: CalendarMove;
}

export interface CalendarEntry {
  variant: CalendarVariant;
  day: number; // 0-indexed, fortnight day (0–13 for a-twice)
  weekday: string;
  phase: CalendarPhase;
  title: string;
  body: string;
  station: string;
  items: CalendarItem[];
}

// ---- plan.json -----------------------------------------------------------

export type Band = [number, number]; // [min, max]

export interface WeekTargets {
  w: { kcal: Band; protein: Band; netCarb: Band; fat: Band; fibre: Band };
  m: { kcal: Band; protein: Band; netCarb: Band; fat: Band; fibre: Band };
}

export interface PlanEconomicsLine {
  amount: number;
  basis: string;
}

export interface Plan {
  variant: "a-twice";
  targets: { A: WeekTargets; B: WeekTargets };
  shops: Record<Shop | "H", { name: string; sub: string }>;
  days: string[];
  themes: string[];
  train: string[];
  notes: [string, string][];
  economics: Record<string, PlanEconomicsLine>;
}

// ---- retired.json ----------------------------------------------------------

export interface RetiredIngredient {
  id: string;
  name: string;
  per100g: { kcal: number; protein: number; fibre: number; carb: number; fat: number };
  spec: { weightState: string; householdUnitG: number | null; unitSingular: string; unitPlural: string };
  price: unknown;
  aisle: string;
  reason: string;
}
