// Selectors (docs/PHASE2-CONTRACT.md "State core API"). The contract names
// these functions tersely (e.g. "todayInfo(now)"); each below takes exactly
// the state it needs as explicit parameters rather than the whole AppState,
// which is a superset-compatible, more testable expansion of the same
// surface — see PHASE2-CONTRACT.md's "supersets fine."
//
// IMPORTANT semantic note for screens: the physically-executing fortnight is
// always **Week A, twice** (D5/PLAN §1). `prefs.week` is a *browsing* toggle
// (PLAN/MEAL screens looking at Week B as the swap/variety pool), not which
// week is actually being cooked. dutyStack's defrost/start-by duties and
// tripBuild() therefore always read Week A's meals/calendar, independent of
// `prefs.week`. dayMacros/bands take `week` explicitly because PLAN needs to
// show both weeks' figures side by side.
import type { Band, Cover, Ingredient, Macros, Meal, Slot, Week } from "../data/types";
import { bandsFor, canonicalCalendar, getMeal, ingredientShortName, ingredientsById, ingredientsList, mealForSlot, mealsByWeek, mealsByWeekDay, referenceUnitG, requireMeal } from "../data";
import { isFreezerStock, operativeLifeDays, type LifeConfidence } from "../data/lifeEstimate";
import { criticalPathMinutes } from "../engine/programs";
import { addCalendarDays, londonCalendarDaysBetween, londonDateIso, londonParts, londonWallTimeToEpochMs } from "./london";
import type { AppState, Inventory, InventoryEntry, Swaps } from "./types";

const FORTNIGHT_DAYS = 14;
const DEFROST_DUE_HOUR = 18; // "by 18:00" — PLAN §6.3's own worked example; see dutyStack doc below.

// ---------------------------------------------------------------------------
// todayInfo
// ---------------------------------------------------------------------------

export interface TodayInfo {
  /** false when prefs.cycleStartSaturday is null — PLAN: "null -> onboarding
   * card on TODAY asks once." Callers must handle this rather than assume a
   * fortnight position exists. */
  anchored: boolean;
  fortnightDay: number | null; // 0..13 within the a-twice cycle
  weekIndex: 1 | 2 | null; // which pass through Week A
  dayNo: number | "weekend"; // 1..5 (Mon..Fri) or "weekend" (Sat/Sun)
  weekday: string; // "Mon".."Sun", Europe/London
  station: "shop" | "cook" | "today" | "stores"; // D6 rhythm
}

const WEEKDAY_DAYNO: Record<string, number | "weekend"> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: "weekend", Sun: "weekend" };

export function todayInfo(now: Date, cycleStartSaturday: string | null): TodayInfo {
  const { weekday, hour } = londonParts(now);
  let station: TodayInfo["station"];
  if (weekday === "Sat") station = "shop";
  else if (weekday === "Sun") station = "cook";
  else if (weekday === "Fri" && hour >= DEFROST_DUE_HOUR) station = "stores"; // D6: "day-6 eve -> stores"
  else station = "today";

  if (!cycleStartSaturday) {
    return { anchored: false, fortnightDay: null, weekIndex: null, dayNo: WEEKDAY_DAYNO[weekday] ?? "weekend", weekday, station };
  }
  const diff = londonCalendarDaysBetween(cycleStartSaturday, now);
  const fortnightDay = ((diff % FORTNIGHT_DAYS) + FORTNIGHT_DAYS) % FORTNIGHT_DAYS;
  const weekIndex: 1 | 2 = fortnightDay < 7 ? 1 : 2;
  const offset = fortnightDay % 7; // 0=Sat,1=Sun,2=Mon,3=Tue,4=Wed,5=Thu,6=Fri
  const dayNo: number | "weekend" = offset === 0 || offset === 1 ? "weekend" : offset - 1;
  return { anchored: true, fortnightDay, weekIndex, dayNo, weekday, station };
}

// ---------------------------------------------------------------------------
// swaps (P2-PLAN-001 / PLAN §6.4) — resolving what's actually planned
// ---------------------------------------------------------------------------

/** The meal that actually occupies `planned`'s slot: the swap replacement if
 * one is committed, else the plan as authored. A swap pointing at an id that
 * no longer resolves (stale data) falls back to the planned meal rather than
 * throwing. */
function effectiveMeal(planned: Meal, swaps: Swaps): Meal {
  const replacementId = swaps[planned.id];
  if (!replacementId) return planned;
  return getMeal(replacementId) ?? planned;
}

/**
 * The meal actually shown/cooked for a given week/day/slot, honoring any
 * committed swap (contract addition P2-PLAN-001: PLAN §6.4's swap deck).
 * Returns undefined only when the slot itself doesn't exist (defensive —
 * every real week/day/slot combination in the dataset has a meal).
 */
export function effectiveMealForSlot(week: Week, day: number, slot: Slot, state: Pick<AppState, "swaps">): Meal | undefined {
  const planned = mealForSlot(week, day, slot);
  if (!planned) return undefined;
  return effectiveMeal(planned, state.swaps);
}

// ---------------------------------------------------------------------------
// dayMacros / mealMacros / bands
// ---------------------------------------------------------------------------

function roundMacros(m: Macros): Macros {
  return {
    kcal: Math.round(m.kcal),
    protein: Math.round(m.protein * 10) / 10,
    netCarb: Math.round(m.netCarb * 10) / 10,
    fat: Math.round(m.fat * 10) / 10,
    fibre: Math.round(m.fibre * 10) / 10,
  };
}

/** Unrounded macro totals for one gram table (a single meal's `covers[cover]`,
 * scaled). The one place per-ingredient macro math happens — mealMacros and
 * dayMacros both build on this so the formula can't drift between "one meal"
 * and "a whole day" (this used to be duplicated per-screen; MEAL's own local
 * `scaledMealMacros` used the identical formula, now hoisted here). */
function macrosFromCovers(covers: Record<string, number>, scale: number): Macros {
  const totals: Macros = { kcal: 0, protein: 0, netCarb: 0, fat: 0, fibre: 0 };
  for (const [ingId, g] of Object.entries(covers)) {
    const ing = ingredientsById[ingId];
    if (!ing) continue; // defensive; join verified complete (data/validation.json)
    const factor = (g * scale) / 100;
    const carb = ing.per100g.carb * factor;
    const fibre = ing.per100g.fibre * factor;
    totals.kcal += ing.per100g.kcal * factor;
    totals.protein += ing.per100g.protein * factor;
    totals.fat += ing.per100g.fat * factor;
    totals.fibre += fibre;
    totals.netCarb += carb - fibre;
  }
  return totals;
}

/** Recomputed (never read from Meal.macros directly) from covers x per100g,
 * so it stays correct under future portion scaling. netCarb is derived
 * (carb - fibre) at the ingredient level, per PLAN §2's join rule. Scaled
 * macros for exactly ONE meal — MEAL's portion knob (§6.5) and PLAN's swap
 * band-impact preview (§6.4, "Δkcal/ΔP before committing") both want this
 * atomic unit rather than a whole day. */
export function mealMacros(mealId: string, cover: Cover, scale = 1): Macros {
  const meal = requireMeal(mealId);
  return roundMacros(macrosFromCovers(meal.covers[cover], scale));
}

/**
 * `swaps` (default {}, fully backward compatible with every existing 3-arg
 * call site) resolves each of the day's four slots through
 * `effectiveMealForSlot` before summing — a committed swap changes the day's
 * macro totals, which is exactly PLAN §6.4's "recompute the day's ladders."
 * Always Week A in practice (the only week actually executed, D5), but this
 * takes `week` explicitly since PLAN also shows Week B's own (unswapped)
 * figures for comparison.
 */
export function dayMacros(week: Week, dayNo: number, cover: Cover, scale = 1, swaps: Swaps = {}): Macros {
  const meals = mealsByWeekDay(week, dayNo).map((planned) => effectiveMeal(planned, swaps));
  const totals: Macros = { kcal: 0, protein: 0, netCarb: 0, fat: 0, fibre: 0 };
  for (const meal of meals) {
    const m = macrosFromCovers(meal.covers[cover], scale);
    totals.kcal += m.kcal;
    totals.protein += m.protein;
    totals.fat += m.fat;
    totals.fibre += m.fibre;
    totals.netCarb += m.netCarb;
  }
  return roundMacros(totals);
}

/**
 * Sum of `mealMacros` for whichever of the day's slots have actually been
 * ticked (`state.eaten`) — as opposed to `dayMacros`, which is the full
 * PLANNED day regardless of what's actually been eaten yet. Wave-1
 * integration review: the arbiter's over-band candidate was comparing the
 * full planned day against the band, which — since the plan is authored to
 * sit right at the band edge — fired on nearly every day regardless of the
 * time of day or what had actually been eaten. TODAY's console needs the
 * identical number for its own "so far" reading, hence this being a shared
 * selector rather than living inside arbiter.ts.
 *
 * `now` is required (not just week/dayNo) because `state.eaten` is keyed by
 * calendar date, not by fortnight position — the a-twice cycle cooks the
 * same (week, dayNo) slot twice, on two different real dates, so only `now`
 * (via `londonDateIso`) disambiguates which pass's ticks to sum.
 *
 * Swaps-aware by construction, not by re-deriving `effectiveMealForSlot`
 * here: an `eaten` tick's own `mealId` is written at the moment of cooking
 * (engine/timers.ts `completeMeal()`, using whichever program was actually
 * loaded — the swap replacement if one was committed) and is therefore
 * already the authoritative record of what was actually eaten. Re-resolving
 * it through the CURRENT swap state would be wrong: eating dinner doesn't
 * retroactively change if the swap is cleared later.
 */
export function eatenSoFar(week: Week, dayNo: number, cover: Cover, state: Pick<AppState, "eaten">, now: Date): Macros {
  const dayTicks = state.eaten[londonDateIso(now)] ?? {};
  const plannedSlots = mealsByWeekDay(week, dayNo).map((m) => m.slot);
  const totals: Macros = { kcal: 0, protein: 0, netCarb: 0, fat: 0, fibre: 0 };
  for (const slot of plannedSlots) {
    const tick = dayTicks[slot];
    if (!tick) continue;
    const meal = getMeal(tick.mealId);
    if (!meal) continue; // defensive: stale/unknown mealId in the log
    const m = macrosFromCovers(meal.covers[cover], 1);
    totals.kcal += m.kcal;
    totals.protein += m.protein;
    totals.fat += m.fat;
    totals.fibre += m.fibre;
    totals.netCarb += m.netCarb;
  }
  return roundMacros(totals);
}

export function bands(week: Week, cover: Cover): { kcal: Band; protein: Band; netCarb: Band; fat: Band; fibre: Band } {
  return bandsFor(week, cover);
}

/** True when every macro in `macros` sits within its band (inclusive). */
export function withinBands(macros: Macros, macroBands: ReturnType<typeof bands>): boolean {
  return (Object.keys(macros) as (keyof Macros)[]).every((k) => macros[k] >= macroBands[k][0] && macros[k] <= macroBands[k][1]);
}

/** Macros that exceed their band's max, worst (largest overage relative to
 * the band's max) first — the arbiter names `[0]` as "the worst macro in
 * text" per PLAN §6.0, and TODAY's ladder hollow-segment state needs the
 * same set. */
export function overBandMacros(macros: Macros, macroBands: ReturnType<typeof bands>): (keyof Macros)[] {
  return (Object.keys(macros) as (keyof Macros)[])
    .filter((k) => macros[k] > macroBands[k][1])
    .sort((a, b) => (macros[b] - macroBands[b][1]) / macroBands[b][1] - (macros[a] - macroBands[a][1]) / macroBands[a][1]);
}

// ---------------------------------------------------------------------------
// ticksFor
// ---------------------------------------------------------------------------

export function ticksFor(state: Pick<AppState, "eaten">, date: string) {
  return state.eaten[date] ?? {};
}

// ---------------------------------------------------------------------------
// dutyStack
// ---------------------------------------------------------------------------

export interface DefrostDuty {
  kind: "defrost";
  id: string;
  ingId: string;
  g: number;
  text: string;
  fortnightDay: number;
  dueAt: string; // ISO datetime (epoch-correct London 18:00)
  overdue: boolean;
}

export interface ExpiringDuty {
  kind: "expiring";
  id: string;
  ingId: string;
  text: string;
  remainingDays: number; // may be negative (already expired)
  expired: boolean;
  confidence: LifeConfidence;
}

export interface StartByDuty {
  kind: "start-by";
  id: string;
  mealId: string;
  text: string;
  startBy: string; // "HH:MM"
  startByAt: string; // ISO datetime, today
}

export type Duty = DefrostDuty | ExpiringDuty | StartByDuty;

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins: number): string {
  const wrapped = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Days of shelf life remaining for one inventory row, or null when there's
 * genuinely no countdown to show (out of stock, or a freezer-class
 * ingredient that hasn't been thawed yet — see below). The single place this
 * computation happens, shared by dutyStack's "expiring" duties and STORES'
 * own per-row countdown display (STORES calls this directly rather than
 * re-deriving the same arithmetic).
 *
 * P1 wave-1-review fix ("false-expired flood"): freeze-day0/buy-frozen
 * ingredients (`isFreezerStock`) anchor their post-thaw `freshDays`
 * countdown to `entry.thawedAt`, NOT `entry.updatedAt`. `updatedAt` is
 * bumped by every inventory touch, including a routine stocktake on an item
 * that's still sitting in the freezer — anchoring the short 2-4 day
 * post-thaw figure to that would make a still-frozen item read as "expired"
 * days before it was ever actually moved to the fridge. Without a
 * `thawedAt` (nothing has explicitly marked this item as defrosted — see
 * `inventory/markThawed`), there is no meaningful countdown to show at all:
 * frozen stock doesn't degrade on this app's visible 2-week horizon, so this
 * returns null rather than guessing.
 */
export function remainingLifeDays(ing: Ingredient, entry: InventoryEntry | undefined, now: Date): number | null {
  if (!entry || entry.level <= 0) return null;
  if (isFreezerStock(ing) && !entry.thawedAt) return null; // still frozen — no countdown applies yet
  const anchor = isFreezerStock(ing) ? entry.thawedAt! : entry.updatedAt;
  const life = operativeLifeDays(ing);
  return life.days - (now.getTime() - new Date(anchor).getTime()) / 86_400_000;
}

/**
 * Text for a remaining-days figure, with the ONE rounding rule every screen
 * must share (wave-1 integration review: TODAY was flooring — 0.97 days
 * left read as "0d" — while STORES was ceiling the same number to "1d" for
 * the identical underlying item; two screens disagreeing about the same
 * fact is worse than either rule alone).
 *
 * Rule: `Math.ceil(remainingDays) - 1`, floored at 0, "today" at 0, "expired"
 * below 0. This is "ceil, with today counted as 0" collapsed to one formula:
 * any remainingDays in (0, 1] — expires sometime before tomorrow — reads as
 * "today" (act now), not "1d" (which would wrongly suggest a full spare
 * day); (1, 2] reads "1d" (today plus one more full day in hand); and so on.
 * A single formula, not a special-cased boundary, so it can't drift out of
 * sync with itself at the edges.
 */
export function formatRemainingDays(remainingDays: number): string {
  if (remainingDays < 0) return "expired";
  const days = Math.max(0, Math.ceil(remainingDays) - 1);
  return days === 0 ? "today" : `${days}d`;
}

/**
 * Ordered duty stack: defrost moves due, then use-today/expiring stock, then
 * tonight's start-by — the order PLAN §6.3 lists them in (arbiter.ts is what
 * ranks these against timer-due/over-band/verify-nominee for the single
 * act-now slot; this function's own ordering is the TODAY-screen list order).
 *
 * HEURISTIC — defrost "done" detection (documented, no dedicated ledger
 * exists in AppState for it): a defrost duty is considered actioned once
 * `inventory[ingId].updatedAt`'s London calendar date is on/after the duty's
 * scheduled calendar date. This deliberately still reads `updatedAt` (bumped
 * by ANY inventory touch, e.g. a stocktake), not `thawedAt` — "done" only
 * needs to know the row was touched on/after the scheduled day, it doesn't
 * need to know WHY. The separate `thawedAt` field (P1 wave-1-review fix)
 * governs a different question — when the post-thaw shelf-life countdown
 * itself starts — and is set specifically by `inventory/markThawed`, not by
 * this "done" check. See `remainingLifeDays` below and
 * src/data/lifeEstimate.ts's `isFreezerStock`.
 */
export function dutyStack(state: AppState, now: Date): Duty[] {
  const info = todayInfo(now, state.prefs.cycleStartSaturday);
  const duties: Duty[] = [];

  if (info.anchored && info.fortnightDay != null && state.prefs.cycleStartSaturday) {
    const nowMs = now.getTime();
    for (const entry of canonicalCalendar()) {
      if (entry.phase !== "defrost" || entry.day > info.fortnightDay) continue;
      const dueDateIso = addCalendarDays(state.prefs.cycleStartSaturday, entry.day);
      for (const item of entry.items) {
        if (item.move !== "freezer → fridge") continue;
        const updatedAt = state.inventory[item.ingId]?.updatedAt;
        const done = updatedAt != null && londonDateIso(new Date(updatedAt)) >= dueDateIso;
        if (done) continue;
        const dueAtMs = londonWallTimeToEpochMs(dueDateIso, DEFROST_DUE_HOUR, 0);
        const overdue = entry.day < info.fortnightDay || nowMs >= dueAtMs;
        duties.push({
          kind: "defrost",
          id: `${entry.day}:${item.ingId}`,
          ingId: item.ingId,
          g: item.g,
          text: `move ${ingredientShortName(item.ingId)} fz → fr`,
          fortnightDay: entry.day,
          dueAt: new Date(dueAtMs).toISOString(),
          overdue,
        });
      }
    }
  }

  for (const [ingId, entry] of Object.entries(state.inventory)) {
    const ing = ingredientsById[ingId];
    if (!ing) continue;
    const remainingDays = remainingLifeDays(ing, entry, now);
    if (remainingDays == null) continue; // out of stock, or still-frozen with no thawedAt — no countdown (P1 fix)
    if (remainingDays > 1) continue; // not yet within the "use today / expiring" window
    duties.push({
      kind: "expiring",
      id: ingId,
      ingId,
      text: remainingDays < 0 ? `expired · ${ingredientShortName(ingId)}` : `use today · ${ingredientShortName(ingId)}`,
      remainingDays,
      expired: remainingDays < 0,
      confidence: operativeLifeDays(ing).confidence,
    });
  }

  if (info.anchored && info.dayNo !== "weekend") {
    // Always Week A — see module doc: the executing fortnight is Week A
    // twice. effectiveMealForSlot (not the raw mealForSlot) so a committed
    // swap changes what "tonight's cook" actually points at — its method's
    // own critical path drives the start-by time, per P2-PLAN-001.
    const dinner = effectiveMealForSlot("A", info.dayNo as number, "dinner", state);
    if (dinner) {
      const criticalPath = criticalPathMinutes(dinner.method.steps);
      const startByMin = timeToMinutes(state.prefs.serveTime) - criticalPath;
      const startBy = minutesToTime(startByMin);
      const dateIso = londonDateIso(now);
      duties.push({
        kind: "start-by",
        id: dinner.id,
        mealId: dinner.id,
        text: `${dinner.name} · start by ${startBy}`,
        startBy,
        startByAt: `${dateIso}T${startBy}:00`,
      });
    }
  }

  const kindOrder: Record<Duty["kind"], number> = { defrost: 0, expiring: 1, "start-by": 2 };
  return duties.sort((a, b) => {
    if (kindOrder[a.kind] !== kindOrder[b.kind]) return kindOrder[a.kind] - kindOrder[b.kind];
    if (a.kind === "defrost" && b.kind === "defrost") return Number(b.overdue) - Number(a.overdue) || a.fortnightDay - b.fortnightDay;
    if (a.kind === "expiring" && b.kind === "expiring") return a.remainingDays - b.remainingDays;
    return 0;
  });
}

// ---------------------------------------------------------------------------
// coverageForMeal
// ---------------------------------------------------------------------------

export interface IngredientCoverage {
  ingId: string;
  needG: number;
  haveG: number;
  ratio: number; // haveG / needG, uncapped (can exceed 1)
}

export interface MealCoverage {
  mealId: string;
  /** 0..1, grams-weighted, each ingredient's contribution capped at 100% (a
   * surplus of one ingredient can't mask a shortage of another). */
  coverage: number;
  byIngredient: IngredientCoverage[];
}

/**
 * HEURISTIC (per contract): fuzzy stock % from the 5-level (0-4) inventory
 * vs. this meal's `covers` grams. Level L -> estimated grams on hand =
 * (L/4) * referenceUnitG, where referenceUnitG is the household unit
 * (one egg, one avocado…) or, failing that, the SKU pack size — exactly the
 * "0/¼/½/¾/full of the SKU pack or household unit" rule the contract states.
 * Freebie seasonings (32/97 ingredients — salt, spices, garlic…) are excluded
 * from both the numerator and denominator: PLAN's own "spice shelf" note
 * treats them as bought once and always on hand, and STORES' 30-item
 * stocktake target implies they aren't part of the tracked register either.
 * Ingredients with no household unit AND no SKU pack (a few loose freebies)
 * are excluded for the same "no way to size a level" reason.
 */
export function coverageForMeal(inventory: Inventory, mealId: string, cover: Cover): MealCoverage {
  const meal = requireMeal(mealId);
  const covers = meal.covers[cover];
  let needTotal = 0;
  let haveCappedTotal = 0;
  const byIngredient: IngredientCoverage[] = [];
  for (const [ingId, needG] of Object.entries(covers)) {
    const ing = ingredientsById[ingId];
    if (!ing || ing.freebie) continue;
    const refUnit = referenceUnitG(ing);
    if (refUnit == null) continue;
    const level = inventory[ingId]?.level ?? 0;
    const haveG = (level / 4) * refUnit;
    needTotal += needG;
    haveCappedTotal += Math.min(needG, haveG);
    byIngredient.push({ ingId, needG, haveG, ratio: needG > 0 ? haveG / needG : 1 });
  }
  const coverage = needTotal > 0 ? haveCappedTotal / needTotal : 1;
  return { mealId, coverage, byIngredient };
}

/**
 * Cook-from-stock strip (STORES §6.7): every meal ranked by coverage %.
 *
 * `weeks` (default `["A"]`, preserving every existing call site's behavior
 * unchanged): which week(s)' meals to rank. STORES' cook-from-stock strip
 * wants BOTH — Week B is the swap/variety pool (D5), and "what can I cook
 * from what's in the fridge right now" is a genuine question about Week B
 * dishes too, not just the executing Week-A plan (unlike dutyStack/tripBuild,
 * which stay Week-A-only because they drive the actual shop/defrost/cook
 * loop — see this module's top doc). Pass `["A", "B"]` to rank across both;
 * a sibling function wasn't worth it since the only difference is which
 * `mealsByWeek` calls get concatenated.
 */
export function coverageForAllMeals(inventory: Inventory, cover: Cover, weeks: Week[] = ["A"]): MealCoverage[] {
  return weeks
    .flatMap((week) => mealsByWeek(week))
    .map((m) => coverageForMeal(inventory, m.id, cover))
    .sort((a, b) => b.coverage - a.coverage);
}

// ---------------------------------------------------------------------------
// tripBuild
// ---------------------------------------------------------------------------

export type TripDay = 0 | 7;

export interface TripLine {
  ingId: string;
  name: string;
  shop: "S" | "M" | "X";
  product: string;
  packG: number;
  price: number;
  estimate: boolean;
  needG: number; // household total (both covers), across the whole a-twice cycle's relevant pass(es)
  haveG: number;
  buyG: number;
  packsToBuy: number;
  lineCost: number;
  /** ingId of a partner ingredient merged into this line (sharedSkuWith), e.g. skyr into greek_yog. */
  mergedWith: string | null;
}

export interface TripBuild {
  tripDay: TripDay;
  lines: TripLine[];
  /** 2-3 estimate:true lines, deterministically selected (sorted by ingId) so
   * repeated calls against the same inventory return the same nominees. */
  verifyNominees: string[];
  subtotal: number;
}

/**
 * HEURISTIC (per contract): day-0 vs day-7 split by provisioning class
 * (ingredients.json `storage.class`) — day-0 buys buy-once/freeze-day0/
 * buy-frozen (shelf-stable or freezer-stable enough to cover both passes of
 * the fortnight in one trip); day-7 buys topup/stagger (short-life produce
 * that wouldn't survive from day 0 to the second Week-A pass) — this exactly
 * reproduces calendar.json's day-7 "THE TOP-UP" ingredient set. Day-0 needs
 * are doubled (the a-twice cycle cooks Week A twice from one bulk shop, per
 * D5); day-7 needs one pass's worth only. `sharedSkuWith` pairs (greek_yog/
 * skyr, raspberries/blueberries) merge onto one shopping line, need summed.
 *
 * `swaps` (default {}, backward compatible): P2-PLAN-001's shopping-deltas
 * requirement — every slot's need is read through `effectiveMeal`, so a
 * committed swap's ingredients replace the originally-planned meal's in the
 * `need` totals below. There's no separate "delta" structure: tripBuild
 * always recomputes the full list from scratch, so a swap's effect is simply
 * that `needG`/`buyG` (and therefore `packsToBuy`/`lineCost`/`verifyNominees`/
 * `subtotal`) come out different — ingredients only the swapped-OUT meal used
 * drop in needG (possibly to 0, removing the line entirely once nothing else
 * needs it), ingredients only the swapped-IN meal uses appear/increase. This
 * IS "recompute the shopping deltas" (PLAN §6.4) — the recomputed trip is the
 * delta view.
 */
export function tripBuild(inventory: Inventory, tripDay: TripDay, swaps: Swaps = {}): TripBuild {
  const classesForTrip = tripDay === 0 ? ["buy-once", "freeze-day0", "buy-frozen"] : ["topup", "stagger"];
  const passMultiplier = tripDay === 0 ? 2 : 1;

  const need: Record<string, number> = {};
  for (const planned of mealsByWeek("A")) {
    const meal = effectiveMeal(planned, swaps);
    for (const cover of ["w", "m"] as Cover[]) {
      for (const [ingId, g] of Object.entries(meal.covers[cover])) {
        need[ingId] = (need[ingId] ?? 0) + g;
      }
    }
  }

  const lines: TripLine[] = [];
  const absorbed = new Set<string>();
  for (const ing of ingredientsList) {
    if (absorbed.has(ing.id)) continue;
    if (!ing.sku) continue; // no SKU -> not a shopping-list line (homemade/freebie)
    if (!classesForTrip.includes(ing.storage.class)) continue;

    let needG = need[ing.id] ?? 0;
    const partnerId = ing.sku.sharedSkuWith;
    let mergedWith: string | null = null;
    if (partnerId) {
      const partner = ingredientsById[partnerId];
      if (partner && classesForTrip.includes(partner.storage.class)) {
        needG += need[partnerId] ?? 0;
        absorbed.add(partnerId);
        mergedWith = partnerId;
      }
    }
    needG *= passMultiplier;
    if (needG <= 0) continue;

    const level = inventory[ing.id]?.level ?? 0;
    const refUnit = referenceUnitG(ing) ?? ing.sku.packG;
    const haveG = (level / 4) * refUnit;
    const buyG = Math.max(0, needG - haveG);
    const packsToBuy = buyG > 0 ? Math.ceil(buyG / ing.sku.packG) : 0;
    lines.push({
      ingId: ing.id,
      name: ing.name.display,
      shop: ing.sku.shop,
      product: ing.sku.product,
      packG: ing.sku.packG,
      price: ing.sku.price,
      estimate: ing.sku.estimate,
      needG,
      haveG,
      buyG,
      packsToBuy,
      lineCost: packsToBuy * ing.sku.price,
      mergedWith,
    });
  }

  const verifyNominees = lines
    .filter((l) => l.estimate && l.packsToBuy > 0)
    .map((l) => l.ingId)
    .sort()
    .slice(0, 3);
  const subtotal = lines.reduce((s, l) => s + l.lineCost, 0);
  return { tripDay, lines, verifyNominees, subtotal };
}
