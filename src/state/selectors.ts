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
import type { Band, Cover, Macros, Week } from "../data/types";
import { bandsFor, canonicalCalendar, ingredientsById, ingredientsList, mealForSlot, mealsByWeek, mealsByWeekDay, referenceUnitG, requireMeal } from "../data";
import { operativeLifeDays } from "../data/lifeEstimate";
import { criticalPathMinutes } from "../engine/programs";
import { addCalendarDays, londonCalendarDaysBetween, londonDateIso, londonParts, londonWallTimeToEpochMs } from "./london";
import type { AppState, Inventory } from "./types";

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
// dayMacros / bands
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

/** Recomputed (never read from Meal.macros directly) from covers x
 * per100g, so it stays correct under future portion scaling. netCarb is
 * derived (carb - fibre) at the ingredient level, per PLAN §2's join rule. */
export function dayMacros(week: Week, dayNo: number, cover: Cover, scale = 1): Macros {
  const meals = mealsByWeekDay(week, dayNo);
  const totals: Macros = { kcal: 0, protein: 0, netCarb: 0, fat: 0, fibre: 0 };
  for (const meal of meals) {
    for (const [ingId, g] of Object.entries(meal.covers[cover])) {
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
  confidence: "numeric" | "parsed" | "low";
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
 * Ordered duty stack: defrost moves due, then use-today/expiring stock, then
 * tonight's start-by — the order PLAN §6.3 lists them in (arbiter.ts is what
 * ranks these against timer-due/over-band/verify-nominee for the single
 * act-now slot; this function's own ordering is the TODAY-screen list order).
 *
 * HEURISTIC — defrost "done" detection (documented, no dedicated ledger
 * exists in AppState for it): a defrost duty is considered actioned once
 * `inventory[ingId].updatedAt`'s London calendar date is on/after the duty's
 * scheduled calendar date. This reuses inventory's existing freshness-anchor
 * field rather than inventing a new state slot — semantically consistent,
 * since "moved from freezer to fridge" IS a freshness-resetting event (see
 * src/data/lifeEstimate.ts's freeze-day0/buy-frozen bucket choice, which
 * already assumes `updatedAt` marks the thaw moment).
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
        const ing = ingredientsById[item.ingId];
        duties.push({
          kind: "defrost",
          id: `${entry.day}:${item.ingId}`,
          ingId: item.ingId,
          g: item.g,
          text: `move ${ing?.name.short ?? item.ingId} fz → fr`,
          fortnightDay: entry.day,
          dueAt: new Date(dueAtMs).toISOString(),
          overdue,
        });
      }
    }
  }

  for (const [ingId, entry] of Object.entries(state.inventory)) {
    if (entry.level <= 0) continue;
    const ing = ingredientsById[ingId];
    if (!ing) continue;
    const life = operativeLifeDays(ing);
    const updatedMs = new Date(entry.updatedAt).getTime();
    const remainingDays = life.days - (now.getTime() - updatedMs) / 86_400_000;
    if (remainingDays > 1) continue; // not yet within the "use today / expiring" window
    duties.push({
      kind: "expiring",
      id: ingId,
      ingId,
      text: remainingDays < 0 ? `expired · ${ing.name.short}` : `use today · ${ing.name.short}`,
      remainingDays,
      expired: remainingDays < 0,
      confidence: life.confidence,
    });
  }

  if (info.anchored && info.dayNo !== "weekend") {
    // Always Week A — see module doc: the executing fortnight is Week A twice.
    const dinner = mealForSlot("A", info.dayNo as number, "dinner");
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

/** Cook-from-stock strip (STORES §6.7): every meal ranked by coverage %. */
export function coverageForAllMeals(inventory: Inventory, cover: Cover): MealCoverage[] {
  return mealsByWeek("A")
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
 */
export function tripBuild(inventory: Inventory, tripDay: TripDay): TripBuild {
  const classesForTrip = tripDay === 0 ? ["buy-once", "freeze-day0", "buy-frozen"] : ["topup", "stagger"];
  const passMultiplier = tripDay === 0 ? 2 : 1;

  const need: Record<string, number> = {};
  for (const meal of mealsByWeek("A")) {
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
