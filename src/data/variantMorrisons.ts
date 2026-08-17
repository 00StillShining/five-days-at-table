// Typed accessor over `data/variant-morrisons.json` (docs/VARIANT-SPEC.md's
// "Data contract"), emitted by a parallel extraction pipeline this file does
// not own or run. Defensive by construction: a plain
// `import raw from "../../data/variant-morrisons.json"` would fail Vite's
// build outright if the file doesn't exist yet at build time. `import.meta.glob`
// is a Vite-level feature (not Node fs) that's fine with zero matches — it
// returns an empty module map rather than erroring — so this compiles and
// runs correctly whether or not the data builder has emitted the file by the
// time this build runs. src/data/variant.ts's `activeVariant()` is the single
// consumer that falls back to "full" mode when `variantMorrissonsData` is null
// (VARIANT RUNTIME builder's standing instruction: ship a typed placeholder,
// never let an absent data file break full-mode behavior).
import type { Week, WeekTargets } from "./types";

export interface VariantCutSlot {
  mealId: string;
  reason: string;
}

export interface VariantSlots {
  kept: string[];
  cut: VariantCutSlot[];
}

export interface VariantBasketLine {
  ingId: string;
  label: string;
  product: string;
  packG: number;
  qty: number;
  /** Per-pack price, pence. D0-036: source-of-truth for the unit rate; the
   * LINE total is `lineP` below (source-verbatim, not always exactly
   * `packP * qty` to the penny after real-world rounding, so both fields
   * are carried rather than one being derived). */
  packP: number;
  /** Line total, pence, source-verbatim (matches the source document's own
   * printed line price — D0-036). `basket.totalP === Σ lineP` exactly. */
  lineP: number;
  aisle: string;
  tags: string[];
  note: string | null;
  storageClass: "freeze-on-arrival" | "freezer-aisle" | "counter" | "fridge" | "cupboard";
  /** ingId of a partner ingredient this line's SKU also covers (e.g. the
   * shared yoghurt tub covering greek_yog + skyr) — VARIANT-SPEC's
   * "coversAlso" field. */
  coversAlso?: string[];
}

export interface VariantPutAwayCard {
  heading: string;
  body: string;
  where: string;
}

export interface VariantBasket {
  retailer: string;
  verifiedOn: string; // ISO date
  totalP: number; // pennies
  lines: VariantBasketLine[];
  putAway: VariantPutAwayCard[];
}

export interface VariantCoverage {
  coveredByBasket: string[];
  assumedPantry: string[];
  missing: string[];
}

export interface VariantDefrostItem {
  dayNo: number;
  ingId: string;
  g: number;
  move: string;
  note: string;
}

/** One kept op, as the data pipeline actually emits it — richer than a bare
 * index (carries `clock`/`title` too, for provenance/debugging), but
 * `opIndex` is the one field src/engine/programs.ts's
 * `compilePrepProgramFiltered` needs to filter the base session's `ops`. */
export interface VariantKeptOp {
  opIndex: number;
  clock?: string;
  title?: string;
  /** Fable review FIX round (coordinate: regenerated data, code against this
   * being optional): a short, human, op-specific note for the tester's
   * reduced session — e.g. "skip tray B — jerk chickpeas aren't in the
   * starter; the tin is Monday's lunch." Rendered inline, quietly, next to
   * the op's own step display in COOK's running view (engine/programs.ts's
   * `compilePrepProgramFiltered` carries it through onto the compiled
   * `ProgramStep`). Absent on most ops — only some kept ops carry one. */
  testerNote?: string;
}

export interface VariantPrep {
  sessionBase: string; // "prep-a" | "prep-b"
  keptOps: VariantKeptOp[]; // ops (0-based index into the base session's `ops`) that feed a kept meal
  note: string;
}

export interface VariantEconomics {
  total: string;
  meals: number;
  perMeal: string;
}

export interface VariantMorrisonsData {
  id: "morrisons-tester";
  label: string;
  week: Week;
  slots: VariantSlots;
  targets: Partial<Record<Week, WeekTargets>>;
  basket: VariantBasket;
  coverage: VariantCoverage;
  defrost: VariantDefrostItem[];
  prep: VariantPrep;
  economics: VariantEconomics;
  anomalies: string[];
}

// Vite-only: fine with zero matches, unlike a static `import`. Keyed by the
// literal glob pattern string, so there's exactly one possible key here.
const modules = import.meta.glob<{ default: unknown }>("../../data/variant-morrisons.json", { eager: true });
const raw = modules["../../data/variant-morrisons.json"]?.default;

/**
 * The tester variant's data, or `null` if `data/variant-morrisons.json`
 * hasn't been emitted yet (data-builder pipeline runs independently — see
 * this module's top doc). Not validated against a zod schema here: the
 * extraction pipeline that emits the file owns validation (docs/VARIANT-SPEC.md
 * §"Validation") the same way every other `data/*.json` file's shape is
 * trusted by src/data/*'s other typed accessors, not re-checked at read time.
 */
export const variantMorrisonsData: VariantMorrisonsData | null = (raw as VariantMorrisonsData | undefined) ?? null;

export const VARIANT_MORRISONS_AVAILABLE = variantMorrisonsData != null;
