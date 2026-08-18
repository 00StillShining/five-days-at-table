/**
 * src/screens/plan/model.ts — PLAN's arithmetic, with no DOM in it.
 *
 * THE QUESTION: how is the fortnight tracking against its targets?
 *
 * Everything here is pure, so the needle, the printed zone, the inset figure,
 * the day lid and the swap deck's delta all read ONE computation (II.4.13 —
 * one clock, one truth). No food facts are invented: every number arrives
 * through src/data's typed accessors and src/state/selectors.ts's pure
 * functions, both FROZEN.
 *
 * ---------------------------------------------------------------------------
 * THE LOAD-BEARING STATE FACT (D5, "a-twice")
 * ---------------------------------------------------------------------------
 * The executing fortnight is ALWAYS Week A, twice. `prefs.week` is a BROWSING
 * toggle and nothing else. PLAN is the screen where confusing the two would be
 * most invisible and most wrong, so the fact is not a footnote here — it is the
 * arithmetic. `SCOPES.fortnight` multiplies BOTH the reading and the band by
 * exactly 2, which is only true because the fortnight IS the week run twice.
 * That identity is why the Signature move (the crown's held re-commission)
 * leaves every needle at the same angle while every printed figure re-casts:
 *
 *      value x 2                 value
 *     ------------  ===  ------------------          (the needle cannot move)
 *      band   x 2                 band
 *
 * And it is why the fortnight scope is REFUSED while the board is browsing
 * Week B: B is never executed, so "B, twice" is not a fact about anything.
 *
 * ---------------------------------------------------------------------------
 * THE SCALE IS FIXED BY THE BAND, NEVER BY THE READING
 * ---------------------------------------------------------------------------
 * "A dial whose ticks move is not a dial" (II.3.18's whole premise). The
 * display range here is derived from the BAND alone — band edges at 37.5% and
 * 62.5% of the arc — so it is a constant for a given channel, scope, cover and
 * variant, and the needle is the only thing that moves.
 *
 * A zero-to-max scale was tried first and rejected on measurement, not taste:
 * plan.json's kcal band is [1649, 1730], a span of 4.7% of its own ceiling. On
 * a 0..2595 scale that band prints as a 2.6% sliver of a 270 degree arc — an
 * instrument that cannot resolve the one question it exists to answer. Real
 * gauges offset their zero for exactly this reason; the minimum tick carries
 * its own real numeral, so nothing is hidden.
 */

import { ARC_START_DEG, ARC_SWEEP_DEG } from "../../cd/physics/slew";
import { getMeal, mealForSlot, mealsByWeek, mealsByWeekDay, planDays, planThemes } from "../../data";
import type { Band, Cover, Macros, Meal, Slot, Week } from "../../data/types";
import { FULL_VARIANT, type ActiveVariant } from "../../data/variant";
import {
  bands,
  coverageForMeal,
  dayMacros,
  mealMacros,
  overBandMacros,
} from "../../state/selectors";
import type { Eaten, Inventory, Swaps } from "../../state/types";

/* ========================================================================== */
/* 1 · THE FIVE CHANNELS, IN THE FIVE-CASE ROW                                */
/* ========================================================================== */

export type ChannelKey = keyof Macros;

export interface ChannelSpec {
  key: ChannelKey;
  /** The engraved word on the dial's own escutcheon. */
  label: string;
  /** The spoken name, for the aria sentence. */
  spoken: string;
  /** II.6.6 — the unit trails the value at 40% of its size. */
  unit: string;
  /** kcal is whole; the four macro channels keep one decimal (roundMacros). */
  decimals: 0 | 1;
  /** II.6.5 — reserve the width for the widest legal rendering. */
  valueCh: number;
  /**
   * THE WINK (ch.17 section 2). "One dial in this world may carry one authored
   * over-range wink — a numeral run pushed one digit past the round number
   * every other gauge on the panel would stop at — drawn once and spent on
   * exactly one dial." Spent HERE, on kcal, and nowhere else on the panel:
   * kcal's tick ring runs one extra major past the arc every other dial stops
   * at, and it prints that major's numeral where the every-second-major rule
   * says there should not be one. The extra travel is REAL — `hi` is extended
   * by exactly that major — so the joke is drawn, never faked.
   */
  wink?: true;
}

/**
 * The row's OWN order, left to right. ch.17 section 1 fixes the arrangement —
 * "one instrument centered, two flanking it, two more outboard, in that order
 * and no other" — and section 2 fixes the ratio SET off the real cluster's case
 * diameters, 115/100/100/80/80mm => 24.2 / 21.1 / 21.1 / 16.8 / 16.8. Placing
 * the set by that arrangement gives the row 16.8 / 21.1 / 24.2 / 21.1 / 16.8,
 * which sums to 100.0 exactly. Section 4 then names which one is the hero:
 * "The center instrument alone takes the tier-3 hero treatment."
 *
 * Rank is by consequence to the question. kcal is the headline; protein and net
 * carb are the two the plan is actually engineered around (a protein floor and
 * a carb ceiling); fat and fibre ride outboard.
 */
/*
  II.6.5 — "reserve the width for the WIDEST LEGAL RENDERING", and the widest
  legal rendering is a figure from the real dataset, never a round demo number.
  Measured across both weeks, both covers and both scopes, the fortnight totals
  are the worst case and they are wider than they look:

      kcal      21960              5
      protein    1644.8            6   (week B, him)
      netCarb    1805.8            6   (week A, him)
      fat         897.0            5
      fibre       524.0            5   (510.2 on week B, him)

  A 5ch reservation was committed first and model.test.ts's real-data width
  check failed it on protein and netCarb at once: one decimal place on a
  four-digit fortnight total is six characters, and a column that reflows when
  the operator re-commissions the scope is a column that moves under a hand.
*/
export const CHANNELS: readonly ChannelSpec[] = [
  { key: "fat", label: "fat", spoken: "grams fat", unit: "g", decimals: 1, valueCh: 6 },
  { key: "protein", label: "prot", spoken: "grams protein", unit: "g", decimals: 1, valueCh: 6 },
  { key: "kcal", label: "kcal", spoken: "kilocalories", unit: "kcal", decimals: 0, valueCh: 5, wink: true },
  { key: "netCarb", label: "carb", spoken: "grams net carb", unit: "g", decimals: 1, valueCh: 6 },
  { key: "fibre", label: "fibre", spoken: "grams fibre", unit: "g", decimals: 1, valueCh: 6 },
];

/** The rank-one seat: the centre of the row, and the only inset on the panel. */
export const HERO_INDEX = 2;

/* ========================================================================== */
/* 2 · SCOPE — the week, or the a-twice fortnight                             */
/* ========================================================================== */

export type ScopeId = "week" | "fortnight";

export interface ScopeSpec {
  id: ScopeId;
  /** The engraved word. */
  label: string;
  /** Plated days the scope covers. */
  days: number;
  /** What the week's figures are multiplied by. */
  passes: number;
  /** Printed under the commission plate's own rule. */
  note: string;
}

/** Mon-Fri are the plated days; the weekend carries duties, not banded plates. */
export const PLATED_DAYS = 5;

export const SCOPES: Record<ScopeId, ScopeSpec> = {
  week: {
    id: "week",
    label: "one plated week",
    days: PLATED_DAYS,
    passes: 1,
    note: "five plated days · mon to fri",
  },
  fortnight: {
    id: "fortnight",
    label: "the executing fortnight",
    days: PLATED_DAYS * 2,
    passes: 2,
    note: "week a, twice · ten plated days (D5, a-twice)",
  },
};

/**
 * D5 again, as a guard rather than as prose: the fortnight scope is only a fact
 * about Week A. Browsing Week B and asking for "the fortnight" would be asking
 * for a fortnight that is never cooked.
 */
export function scopeAllowed(scope: ScopeId, week: Week): boolean {
  return scope === "week" || week === "A";
}

/* ========================================================================== */
/* 3 · THE READINGS                                                           */
/* ========================================================================== */

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, netCarb: 0, fat: 0, fibre: 0 };

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    netCarb: a.netCarb + b.netCarb,
    fat: a.fat + b.fat,
    fibre: a.fibre + b.fibre,
  };
}

export function scaleMacros(m: Macros, k: number): Macros {
  return {
    kcal: m.kcal * k,
    protein: m.protein * k,
    netCarb: m.netCarb * k,
    fat: m.fat * k,
    fibre: m.fibre * k,
  };
}

/** The per-day band for every channel, variant-aware (frozen selector). */
export function dayBands(week: Week, cover: Cover, variant: ActiveVariant): Record<ChannelKey, Band> {
  return bands(week, cover, variant);
}

/** The scope's band: the day band multiplied by the days the scope covers. */
export function scopeBands(
  week: Week,
  cover: Cover,
  variant: ActiveVariant,
  scope: ScopeId
): Record<ChannelKey, Band> {
  const day = dayBands(week, cover, variant);
  const n = SCOPES[scope].days;
  const out = {} as Record<ChannelKey, Band>;
  for (const k of Object.keys(day) as ChannelKey[]) out[k] = [day[k][0] * n, day[k][1] * n];
  return out;
}

/** One plated week's totals, swaps- and variant-aware. */
export function weekTotals(
  week: Week,
  cover: Cover,
  swaps: Swaps,
  variant: ActiveVariant
): Macros {
  let total = ZERO_MACROS;
  for (let day = 1; day <= PLATED_DAYS; day++) {
    total = addMacros(total, dayMacros(week, day, cover, 1, swaps, variant));
  }
  return total;
}

/** The scope's totals. `fortnight` is the week, twice — that is the whole of D5. */
export function scopeTotals(
  week: Week,
  cover: Cover,
  swaps: Swaps,
  variant: ActiveVariant,
  scope: ScopeId
): Macros {
  return scaleMacros(weekTotals(week, cover, swaps, variant), SCOPES[scope].passes);
}

/* ========================================================================== */
/* 4 · GAUGE GEOMETRY (II.3.18, with the range chosen by the band)            */
/* ========================================================================== */

/** Minors per arc on every dial. Majors every fifth minor => nine majors. */
export const MINORS = 40;
export const MAJOR_EVERY = 5;
/** The wink dial gets one extra major of real travel. */
export const WINK_MINORS = MINORS + MAJOR_EVERY;

/** How far past each band edge the arc runs, as a multiple of the band's span. */
export const RANGE_PAD = 1.5;

export interface DialScale {
  lo: number;
  hi: number;
  minors: number;
  /** Fractions along the arc, 0..1. */
  zones: { dangerLow: number; bandStart: number; bandEnd: number; warnHigh: number };
  /** Where the printed numerals sit, 0..1, with their real values. */
  labels: { at: number; value: number }[];
}

/**
 * The dial's printed scale. Band edges land at 37.5% and 62.5% of the base arc;
 * the two symmetric caution zones run 25-37.5% and 62.5-75%; the two redlines
 * take the outer quarters. Every dial in the row therefore prints the SAME
 * geometry, which is what lets five needles be read as one row rather than as
 * five separate arguments — and the wink dial's own 12.5% overrun is the one
 * deliberate exception, which is the point of a wink.
 */
export function dialScale(band: Band, wink = false, labelEvery = 2): DialScale {
  const span = band[1] - band[0] || Math.max(1, Math.abs(band[1]) * 0.05) || 1;
  const lo = band[0] - RANGE_PAD * span;
  const baseHi = band[1] + RANGE_PAD * span;
  const minors = wink ? WINK_MINORS : MINORS;
  const hi = lo + (baseHi - lo) * (minors / MINORS);
  const f = (v: number) => (v - lo) / (hi - lo);
  const labels: { at: number; value: number }[] = [];
  const majors = minors / MAJOR_EVERY; // 8 base, 9 on the wink dial
  for (let i = 0; i <= majors; i++) {
    const winkMajor = i === majors && wink;
    /*
      Every `labelEvery`-th major carries a numeral. The rank-one dial runs the
      full scale at every second major; the four subordinate dials, which are
      physically smaller by the case-diameter ratio, print every fourth — which
      is what a real instrument does when its face is smaller, and is a scale
      decision rather than a shrink (II.6.11: below 0.6875rem type is TEXTURE).

      The wink dial prints one MORE, on the major past the end of that run —
      "one digit past the round number every other gauge on the panel would
      stop at", drawn once and spent on exactly one dial.
    */
    if (i % labelEvery !== 0 && !winkMajor) continue;
    const at = i / majors;
    labels.push({ at, value: lo + (hi - lo) * at });
  }
  return {
    lo,
    hi,
    minors,
    zones: {
      dangerLow: f(band[0] - RANGE_PAD * span * (1 / 3)),
      bandStart: f(band[0]),
      bandEnd: f(band[1]),
      warnHigh: f(band[1] + RANGE_PAD * span * (1 / 3)),
    },
    labels,
  };
}

/** 0..1 along the arc, clamped. The exact figure always prints regardless. */
export function fractionOf(value: number, scale: DialScale): number {
  return Math.min(1, Math.max(0, (value - scale.lo) / (scale.hi - scale.lo)));
}

/** II.3.18 — the 270 degree arc, minimum at 7 o'clock, maximum at 5 o'clock. */
export function angleOf(value: number, scale: DialScale): number {
  return ARC_START_DEG + ARC_SWEEP_DEG * fractionOf(value, scale);
}

/** True when the reading is off the printed scale and the needle is on a stop. */
export function isPinned(value: number, scale: DialScale): boolean {
  return value < scale.lo || value > scale.hi;
}

export type BandState = "under" | "in" | "over";

export function bandState(value: number, band: Band): BandState {
  if (value < band[0]) return "under";
  if (value > band[1]) return "over";
  return "in";
}

export const BAND_WORD: Record<BandState, string> = {
  under: "UNDER BAND",
  in: "IN BAND",
  over: "OVER BAND",
};

/** The signed distance to the nearest band edge; 0 when inside. */
export function bandMiss(value: number, band: Band): number {
  if (value < band[0]) return value - band[0];
  if (value > band[1]) return value - band[1];
  return 0;
}

/* ========================================================================== */
/* 5 · THE CROWN'S REFERENCE MARKER                                           */
/* ========================================================================== */

/**
 * ch.17 section 3, the hybrid gauge's Signature: "overlays a hairline reference
 * mark on the arc, driven by whichever marker the crown last set, so the analog
 * face carries the OPERATOR'S OWN INTENT beside the process's own reading."
 *
 * The mark seats on the band's ceiling — a real printed fact, not a guess — and
 * the crown's fine gear walks it one minor tick per 48px of drag. It is UI
 * intent, never domain data: it lives in the chassis panel store, so it
 * survives navigation and dies on reload, and no figure derived from it is ever
 * presented as a plan value.
 */
export function markValue(band: Band, scale: DialScale, offsetTicks: number): number {
  const perTick = (scale.hi - scale.lo) / scale.minors;
  return band[1] + offsetTicks * perTick;
}

export const MARK_TICKS_MAX = 20;

export function clampMarkTicks(n: number): number {
  return Math.min(MARK_TICKS_MAX, Math.max(-MARK_TICKS_MAX, Math.round(n)));
}

/* ========================================================================== */
/* 6 · FORMATTING                                                             */
/* ========================================================================== */

export function formatChannel(value: number, spec: ChannelSpec): string {
  if (spec.decimals === 0) return String(Math.round(value));
  const oneDp = Math.round(value * 10) / 10;
  return Number.isInteger(oneDp) ? String(oneDp) : oneDp.toFixed(1);
}

export function formatSigned(value: number, spec: ChannelSpec): string {
  const body = formatChannel(Math.abs(value), spec);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${sign}${body}`;
}

/* ========================================================================== */
/* 7 · THE DAY REGISTER                                                       */
/* ========================================================================== */

export const SLOTS: Slot[] = ["breakfast", "lunch", "dinner", "snack"];

export const SLOT_LABEL: Record<Slot, string> = {
  breakfast: "bfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
};

export interface SlotReading {
  slot: Slot;
  label: string;
  /** The meal actually on the board: the swap replacement when one is committed. */
  meal: Meal | null;
  /** The meal the plan authored, when a swap has displaced it. */
  displaced: Meal | null;
  /** The tester's stated reason this slot is cut, or null. */
  cutReason: string | null;
  /** batch | fresh | swap | cut | empty — the row's own mark (II.6.12 slot 1). */
  mark: string;
  macros: Macros;
  /** The newest `eaten` tick for this exact meal id, or null. */
  loggedAt: string | null;
}

export interface DayReading {
  dayNo: number;
  /** "mon" .. "fri" */
  abbr: string;
  /** The authored theme for the day. */
  theme: string;
  slots: SlotReading[];
  macros: Macros;
  band: Record<ChannelKey, Band>;
  /** Which channels are over their day band, worst first (frozen selector). */
  over: ChannelKey[];
  /**
   * EVERY channel off its day band, in either direction.
   *
   * The lid reports whichever channel the crown is focused on, and a day can
   * be over band on a channel the crown is not pointed at — measured live:
   * committing the Beef-kofta swap into Monday lunch put protein over band
   * while the lid, focused on kcal, said UNDER BAND and nothing on the board
   * mentioned protein at all. A board whose answer depends on where a knob
   * happens to point is not answering the question.
   */
  off: { key: ChannelKey; dir: "under" | "over" }[];
  cutCount: number;
  loggedCount: number;
  cookableCount: number;
}

/**
 * "Was this exact card ever ticked." Deliberately id-addressed rather than
 * date-addressed: the a-twice fortnight cooks Week A twice from the same
 * content, so one (week, day, slot) cell maps to two real calendar dates, and
 * PLAN shows CONTENT, not a date. Meal ids are already unique per cell.
 */
export function mealLoggedAt(eaten: Eaten, mealId: string): string | null {
  let latest: string | null = null;
  for (const day of Object.values(eaten)) {
    for (const tick of Object.values(day)) {
      if (tick && tick.mealId === mealId && (!latest || tick.at > latest)) latest = tick.at;
    }
  }
  return latest;
}

export function readDay(
  week: Week,
  dayNo: number,
  cover: Cover,
  swaps: Swaps,
  variant: ActiveVariant,
  eaten: Eaten
): DayReading {
  const authored = mealsByWeekDay(week, dayNo);
  const bySlot = new Map(authored.map((m) => [m.slot, m]));
  const slots: SlotReading[] = [];
  let cutCount = 0;
  let loggedCount = 0;
  let cookableCount = 0;

  for (const slot of SLOTS) {
    const planned = bySlot.get(slot);
    if (!planned) {
      slots.push({
        slot,
        label: SLOT_LABEL[slot],
        meal: null,
        displaced: null,
        cutReason: null,
        mark: "empty",
        macros: ZERO_MACROS,
        loggedAt: null,
      });
      continue;
    }
    const cutReason = variant.cutReason(planned.id);
    if (cutReason != null) {
      cutCount += 1;
      slots.push({
        slot,
        label: SLOT_LABEL[slot],
        meal: null,
        displaced: planned,
        cutReason,
        mark: "cut",
        macros: ZERO_MACROS,
        loggedAt: null,
      });
      continue;
    }
    const replacementId = swaps[planned.id];
    const shown = (replacementId ? getMeal(replacementId) : null) ?? planned;
    const swapped = shown.id !== planned.id;
    const loggedAt = mealLoggedAt(eaten, shown.id);
    if (loggedAt) loggedCount += 1;
    cookableCount += 1;
    slots.push({
      slot,
      label: SLOT_LABEL[slot],
      meal: shown,
      displaced: swapped ? planned : null,
      cutReason: null,
      mark: swapped ? "swap" : shown.tag,
      macros: mealMacros(shown.id, cover),
      loggedAt,
    });
  }

  const macros = dayMacros(week, dayNo, cover, 1, swaps, variant);
  const band = dayBands(week, cover, variant);
  const off: { key: ChannelKey; dir: "under" | "over" }[] = [];
  for (const spec of CHANNELS) {
    const state = bandState(macros[spec.key], band[spec.key]);
    if (state !== "in") off.push({ key: spec.key, dir: state });
  }
  return {
    off,
    dayNo,
    abbr: (planDays[dayNo - 1] ?? "").slice(0, 3).toLowerCase(),
    theme: planThemes[dayNo - 1] ?? "",
    slots,
    macros,
    band,
    over: overBandMacros(macros, band) as ChannelKey[],
    cutCount,
    loggedCount,
    cookableCount,
  };
}

/**
 * The day's off-band statement, in the fewest words that stay exact.
 *
 * Rendered as a raw list it ran to three lines on the tester's Wednesday —
 * "fat under · prot under · kcal under · carb under · fibre under" — which
 * pushed that one lid to 58px and the board 149px past its budget. Grouping by
 * direction says the same thing in one line and drops nothing: a reader still
 * learns exactly which channels are off and which way.
 */
export function offSentence(off: DayReading["off"]): string {
  if (off.length === 0) return "all five in band";
  const label = (k: ChannelKey) => CHANNELS.find((c) => c.key === k)?.label ?? k;
  if (off.length === CHANNELS.length && off.every((o) => o.dir === off[0].dir)) {
    return `all five ${off[0].dir}`;
  }
  const over = off.filter((o) => o.dir === "over").map((o) => label(o.key));
  const under = off.filter((o) => o.dir === "under").map((o) => label(o.key));
  const parts: string[] = [];
  if (over.length) parts.push(`${over.join(", ")} over`);
  if (under.length) parts.push(`${under.join(", ")} under`);
  return parts.join(" · ");
}

export function readWeek(
  week: Week,
  cover: Cover,
  swaps: Swaps,
  variant: ActiveVariant,
  eaten: Eaten
): DayReading[] {
  const out: DayReading[] = [];
  for (let d = 1; d <= PLATED_DAYS; d++) out.push(readDay(week, d, cover, swaps, variant, eaten));
  return out;
}

/* ========================================================================== */
/* 8 · THE SWAP DECK                                                          */
/* ========================================================================== */

export interface SwapCandidate {
  meal: Meal;
  /** 0..1 — how much of this meal the shelves already cover (frozen selector). */
  coverage: number;
  /**
   * The ingredient ids the coverage figure was actually computed over. The deck
   * ages its ranking against the OLDEST count among these — a ranking is only
   * as fresh as its stalest input, and taking the newest would flatter it.
   */
  coverageIngredients: string[];
  /** The day-level delta this swap would cause. */
  delta: Macros;
  /** Channels this swap would NEWLY push over the day band. */
  newlyOver: ChannelKey[];
}

/**
 * "Week-B (and cook-from-stock) candidates ranked by stock coverage %".
 * Candidate source is the OTHER week's meals of the same slot type; the ranking
 * dimension is `coverageForMeal`, which is what cook-from-stock means
 * everywhere else in this codebase. No new heuristic is invented here.
 */
export function candidatesForSlot(
  week: Week,
  dayNo: number,
  slot: Slot,
  cover: Cover,
  inventory: Inventory,
  swaps: Swaps,
  variant: ActiveVariant
): SwapCandidate[] {
  const planned = mealForSlot(week, dayNo, slot);
  if (!planned) return [];
  const otherWeek: Week = week === "A" ? "B" : "A";
  const band = dayBands(week, cover, variant);
  const before = dayMacros(week, dayNo, cover, 1, swaps, variant);
  const wasOver = new Set(overBandMacros(before, band));
  const currentId = swaps[planned.id] ?? planned.id;
  const current = mealMacros(currentId, cover);

  return mealsByWeek(otherWeek)
    .filter((m) => m.slot === slot)
    .map((meal) => {
      const cand = mealMacros(meal.id, cover);
      const after = dayMacros(week, dayNo, cover, 1, { ...swaps, [planned.id]: meal.id }, variant);
      const cov = coverageForMeal(inventory, meal.id, cover);
      return {
        meal,
        coverage: cov.coverage,
        coverageIngredients: cov.byIngredient.map((b) => b.ingId),
        delta: {
          kcal: cand.kcal - current.kcal,
          protein: cand.protein - current.protein,
          netCarb: cand.netCarb - current.netCarb,
          fat: cand.fat - current.fat,
          fibre: cand.fibre - current.fibre,
        },
        newlyOver: (overBandMacros(after, band) as ChannelKey[]).filter((k) => !wasOver.has(k)),
      };
    })
    .sort((a, b) => b.coverage - a.coverage);
}

export { FULL_VARIANT, type ActiveVariant };
