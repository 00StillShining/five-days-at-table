/**
 * src/screens/shop/model.ts — SHOP's arithmetic, in 11 TANGENT HORIZON.
 *
 * No DOM, no timers, no React. Everything here is a pure function over the
 * frozen store's own shapes and over `tripBuild()`'s lines, so every reading on
 * the screen can be proved in a test rather than eyeballed in a browser.
 *
 * ---------------------------------------------------------------------------
 * THE ONE IDEA THIS FILE ENCODES: WHAT "TRUE" MEANS ON A COSTED LINE
 * ---------------------------------------------------------------------------
 * TANGENT HORIZON's signature confirmation device is the flush-check: "At rest,
 * off a locked value, its ticks sit at a small constant angular offset from the
 * fixed index mark beside them — a visibly broken line. The instant the value
 * the crown governs reads true, every tick snaps flush ... A broken ring means
 * not yet; an unbroken ring means true."
 *
 * On a shopping trip the value that can be true or not-yet is COST. A line is
 * costed TRUE when the figure printed beside it is a real, current price:
 *
 *   CHECKED     the shopper typed a price back from the shelf (state.priceChecks)
 *   VERIFIED    the SKU carries a verifiedOn date inside the price class's own
 *               14-day threshold (src/cd/freshness/classes.ts)
 *   ------------------------------- above this line the ring reads true -------
 *   STALE       verifiedOn exists but is past 14 days — the value HOLDS at 55%
 *               ink with its printed state word (II.3.18 / II.3.32)
 *   ESTIMATE    the SKU declares itself an estimate — the figure-then-approx
 *               grammar, app-wide and unchanged
 *   UNVERIFIED  no verifiedOn at all — ageOf() reports NEVER, not an age of zero
 *
 * There is no sixth class and no invented middle. A line either carries a price
 * someone stood in front of, or it does not.
 *
 * ---------------------------------------------------------------------------
 * THE LINE RING'S ERROR IS BINARY, AND THAT IS DELIBERATE (CORRECTIONARY 6.5)
 * ---------------------------------------------------------------------------
 * The chapter's own setFlushCheck takes a live `errorDeg`. A LINE's error is
 * binary because the state behind it is binary — costed, or not — so grading its
 * tick offset would invent precision the price data does not carry. An AISLE's
 * error is genuinely gradable (how many of its lines are still uncosted) and is
 * graded. Both are live redraws of a real error, never idle animation (section 9,
 * "Ornament without function").
 */

import { ingredientsById } from "../../data";
import { ageOf, FRESHNESS, type Age } from "../../cd/freshness/classes";
import type { PriceCheck, PriceChecks } from "../../state/types";
import type { TripLine } from "../../state/selectors";
import type { EffectiveLine } from "./tripHelpers";

/* ------------------------------------------------------------------ */
/* committed constants                                                 */
/* ------------------------------------------------------------------ */

/**
 * Section 3, the flush-check: 24 hairline ticks at a 15deg pitch. A broken ring
 * sits "at a small constant angular offset"; half the pitch is the largest
 * offset that still reads as one ring rather than two, so it is the offset a
 * fully-broken ring takes.
 */
export const TICK_PITCH_DEG = 15;
export const BREAK_MAX_DEG = TICK_PITCH_DEG / 2;

/** The JS in section 3: `const locked = Math.abs(errorDeg) < 0.05`. */
export const LOCK_EPSILON_DEG = 0.05;

/**
 * Section 3, the track window: "HORIZON_SLEW_RATE = 220 // % of track width per
 * second", floored at 80ms "so even a one-tick nudge still reads as motion".
 * CD-BRIEF product ruling 1 governs NEEDLES (720 deg/s); this is a linear track,
 * and the chapter's own linear rate is the one that applies to it.
 */
export const TRACK_SLEW_PCT_PER_S = 220;
export const TRACK_SLEW_FLOOR_MS = 80;

/** Section 2: the hot lock frame decays back to lit/dim within 900ms. */
export const LOCK_DECAY_MS = 900;

/** The price class's declared threshold, printed on the screen's own label. */
export const PRICE_STALE_MS = FRESHNESS.price.staleAfterMs;
export const PRICE_STALE_DAYS = Math.round(PRICE_STALE_MS / 86_400_000);

/* ------------------------------------------------------------------ */
/* cost class                                                          */
/* ------------------------------------------------------------------ */

export type CostClass = "checked" | "verified" | "stale" | "estimate" | "unverified";

export interface CostReading {
  cls: CostClass;
  /** True iff the ring on this line reads flush. */
  costed: boolean;
  /** The age of whatever timestamp this class is judged against. */
  age: Age;
  /** The figure the screen prints, in pounds — the checked price when one exists. */
  unitPrice: number;
  /** The line total actually spent: packs x unit price. */
  lineTotal: number;
  /** Signed delta of a typed-back check against the sheet, or null. */
  delta: number | null;
  /**
   * The printed state word. ALWAYS present: II.7.7's second channel is not a
   * courtesy extended only to bad news, and a column that prints a word for
   * every failure and an em-dash for every success reads as an exception list
   * rather than as a report.
   */
  word: string;
}

/** The word each class prints. Colour never travels alone (II.7.7). */
export const COST_WORD: Record<CostClass, string> = {
  checked: "CHECKED",
  verified: "VERIFIED",
  stale: FRESHNESS.price.word, // UNPRICED
  estimate: "ESTIMATE",
  unverified: "NEVER",
};

/**
 * What every cost reading on this screen is judged against.
 *
 * `now` is passed in rather than read from a clock, so this is testable and so
 * the 60s age clock can live in the one component that prints an age (the
 * measured performance law's rule 4, "isolate clocks").
 *
 * `basketVerifiedOn` is the whole point of this being an object rather than three
 * arguments. docs/VARIANT-SPEC.md: in the tester "the trip IS the authored
 * basket verbatim ... all lines verified (no approx marks, no verify nominees)".
 * That basket carries ONE verification date for the whole receipt, and it is the
 * truth about those lines — the canonical SKU's own verifiedOn is a different
 * measurement of a different product string and has no authority over them. When
 * a basket date is supplied it replaces every SKU's own; when it is not, each
 * line is judged on its own SKU as usual.
 */
export interface CostContext {
  priceChecks: PriceChecks;
  now: number;
  basketVerifiedOn: string | null;
}

/** Read one line's cost state. */
export function costReading(el: EffectiveLine, ctx: CostContext): CostReading {
  const { priceChecks, now } = ctx;
  const line = el.line;
  const check: PriceCheck | undefined = priceChecks[line.ingId];
  const sku = ingredientsById[line.ingId]?.sku ?? null;

  if (check) {
    const age = ageOf("price", check.on, now);
    const delta = round2(check.price - line.price);
    return {
      cls: age.stale ? "stale" : "checked",
      costed: !age.stale,
      age,
      unitPrice: check.price,
      lineTotal: round2(el.effectivePacks * check.price),
      delta,
      word: age.stale ? COST_WORD.stale : COST_WORD.checked,
    };
  }

  const base = {
    unitPrice: line.price,
    lineTotal: round2(el.effectiveCost),
    delta: null,
  };

  if (line.estimate) {
    /* An estimate has no verification date to age and never gets one: the SKU
       says the figure was inferred, not read. Reporting an age here would be
       ageing a measurement that was never taken. */
    return { cls: "estimate", costed: false, age: ageOf("price", null, now), word: COST_WORD.estimate, ...base };
  }

  const age = ageOf("price", ctx.basketVerifiedOn ?? sku?.verifiedOn ?? null, now);
  if (age.ms === null) {
    return { cls: "unverified", costed: false, age, word: COST_WORD.unverified, ...base };
  }
  if (age.stale) {
    return { cls: "stale", costed: false, age, word: COST_WORD.stale, ...base };
  }
  return { cls: "verified", costed: true, age, word: COST_WORD.verified, ...base };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* the census — what the basket is made of                             */
/* ------------------------------------------------------------------ */

export interface Census {
  lines: number;
  costed: number;
  uncosted: number;
  estimates: number;
  unverified: number;
  stale: number;
  checked: number;
  /** Sum of every line total actually printed, in pounds. */
  total: number;
}

export function census(lines: EffectiveLine[], ctx: CostContext): Census {
  const out: Census = {
    lines: 0,
    costed: 0,
    uncosted: 0,
    estimates: 0,
    unverified: 0,
    stale: 0,
    checked: 0,
    total: 0,
  };
  for (const el of lines) {
    if (el.isDedupe || el.effectivePacks <= 0) continue;
    const r = costReading(el, ctx);
    out.lines += 1;
    out.total += r.lineTotal;
    if (r.costed) out.costed += 1;
    else out.uncosted += 1;
    if (r.cls === "estimate") out.estimates += 1;
    if (r.cls === "unverified") out.unverified += 1;
    if (r.cls === "stale") out.stale += 1;
    if (r.cls === "checked") out.checked += 1;
  }
  out.total = round2(out.total);
  return out;
}

/**
 * THE SIGNATURE'S OWN CONDITION.
 *
 * Section 7: "when every flush-check ring on the screen reads true at once — no
 * pending value, no live error anywhere — every ring aligns in the same frame
 * into one continuous unbroken line ... it fires only because the underlying
 * condition it reports — total agreement — has become true, and it un-fires the
 * instant any one value drifts again."
 *
 * An EMPTY basket is not agreement, it is absence: a trip with nothing in it has
 * no rings to read true, so the horizon stays open.
 */
export function horizonComplete(c: Census): boolean {
  return c.lines > 0 && c.uncosted === 0;
}

/**
 * The seam's break fraction, 0..1. The seam under the aluminium band renders as
 * a dashed line whose gap fraction IS this number, and closes to one continuous
 * rule at zero. A live redraw of a real error (section 9's repair), never idle.
 */
export function seamBreak(c: Census): number {
  if (c.lines === 0) return 1;
  return c.uncosted / c.lines;
}

/* ------------------------------------------------------------------ */
/* the cost track — position, never area                               */
/* ------------------------------------------------------------------ */

/**
 * Section 9, "Arc creep": "A gauge, a dial, or a rotating cluster appears where
 * a straight track window would tell the same truth." And IV.1 / section 3:
 * "never as a filled bar climbing from an origin, because nothing in this world
 * reports magnitude by area when it can report position by exact location."
 *
 * So the trip's money is not a bar and not an arc. It is one track running
 * 0 -> the trip total, carrying one index per retailer at the CUMULATIVE
 * position where that retailer's spend ends. Reading two adjacent indices gives
 * that retailer's share by the distance between them, which is a position
 * reading, not an area one.
 */
export interface TrackIndex {
  code: string;
  seat: string;
  name: string;
  subtotal: number;
  lines: number;
  /** 0..100, the cumulative position where this retailer's spend ends. */
  pct: number;
}

export const SEAT_WORD: Record<string, string> = { M: "mor", S: "sai", X: "mkt", H: "hea" };

export function trackIndices(
  columns: { code: string; displayName: string; subtotal: number; lines: number }[]
): TrackIndex[] {
  const total = columns.reduce((s, c) => s + c.subtotal, 0);
  let running = 0;
  return columns.map((c) => {
    running += c.subtotal;
    return {
      code: c.code,
      seat: SEAT_WORD[c.code] ?? c.code.slice(0, 3).toLowerCase(),
      name: c.displayName,
      subtotal: round2(c.subtotal),
      lines: c.lines,
      pct: total > 0 ? Math.min(100, (running / total) * 100) : 0,
    };
  });
}

/**
 * Section 3's own arithmetic, verbatim in behaviour: distance over a fixed rate,
 * floored so the smallest nudge still reads as motion. Duration is DERIVED from
 * distance; it is never chosen.
 */
export function trackSweepMs(fromPct: number, toPct: number): number {
  const ms = (Math.abs(toPct - fromPct) / TRACK_SLEW_PCT_PER_S) * 1000;
  return Math.max(TRACK_SLEW_FLOOR_MS, ms);
}

/* ------------------------------------------------------------------ */
/* aisle groups — R7's accordion                                       */
/* ------------------------------------------------------------------ */

export interface AisleGroup {
  id: string;
  aisle: string;
  rows: EffectiveLine[];
  costed: number;
  subtotal: number;
  /** The ring error for this aisle, in degrees. Gradable, and graded. */
  errorDeg: number;
}

/** The aisle a line belongs to, read from the same field the pinned envelope
 * carries to LIST (`ing?.aisle ?? ""`), so both screens group identically. */
export function aisleOf(line: TripLine): string {
  return ingredientsById[line.ingId]?.aisle || "unaisled";
}

export function aisleGroups(lines: EffectiveLine[], shop: string, ctx: CostContext): AisleGroup[] {
  const order: string[] = [];
  const byAisle = new Map<string, EffectiveLine[]>();
  for (const el of lines) {
    if (el.isDedupe || el.effectivePacks <= 0) continue;
    if (el.line.shop !== shop) continue;
    const aisle = aisleOf(el.line);
    if (!byAisle.has(aisle)) {
      byAisle.set(aisle, []);
      order.push(aisle);
    }
    byAisle.get(aisle)!.push(el);
  }
  return order.map((aisle) => {
    const rows = byAisle.get(aisle)!;
    let costed = 0;
    let subtotal = 0;
    for (const el of rows) {
      const r = costReading(el, ctx);
      if (r.costed) costed += 1;
      subtotal += r.lineTotal;
    }
    return {
      id: `${shop}:${aisle}`,
      aisle,
      rows,
      costed,
      subtotal: round2(subtotal),
      errorDeg: ringError(costed, rows.length),
    };
  });
}

/**
 * A ring's live error: the share of this set that is still uncosted, spent
 * across the largest legal break. Zero uncosted is zero error, which is what
 * makes the ring snap flush rather than merely get close.
 */
export function ringError(costed: number, total: number): number {
  if (total === 0) return BREAK_MAX_DEG; // nothing to be true about: not yet
  const uncosted = total - costed;
  if (uncosted === 0) return 0;
  return (uncosted / total) * BREAK_MAX_DEG;
}

export function isLocked(errorDeg: number): boolean {
  return Math.abs(errorDeg) < LOCK_EPSILON_DEG;
}

/* ------------------------------------------------------------------ */
/* the position readout — the track window as the list's own scrollbar  */
/* ------------------------------------------------------------------ */

export interface Position {
  /** 1-based index of the open aisle's first line within the whole trip. */
  first: number;
  /** How many lines the open aisle holds. */
  span: number;
  /** Every line in the trip. */
  total: number;
  /** 0..100 — where the open aisle starts. */
  pct: number;
}

/**
 * Where the open lid sits inside the trip, as a position on a line. Section 4's
 * List/Browser: "The track window is repurposed here as the list's own
 * scroll-position readout ... the same component, the same law, applied to a
 * different range."
 *
 * Takes ALREADY-GROUPED columns rather than raw lines: the scene groups once per
 * trip change and every reading downstream reads that one result, because the
 * measured performance law budgets renders, not layers.
 */
export function positionOf(columns: { groups: AisleGroup[] }[], openId: string | null): Position {
  const total = columns.reduce(
    (n, c) => n + c.groups.reduce((m, g) => m + g.rows.length, 0),
    0
  );
  if (!openId || total === 0) return { first: 0, span: 0, total, pct: 0 };
  let seen = 0;
  for (const col of columns) {
    for (const group of col.groups) {
      if (group.id === openId) {
        return { first: seen + 1, span: group.rows.length, total, pct: (seen / total) * 100 };
      }
      seen += group.rows.length;
    }
  }
  return { first: 0, span: 0, total, pct: 0 };
}

/** Every lid in the trip, in trip order — what the cueing cluster steps through. */
export function lidOrder(columns: { code: string; groups: AisleGroup[] }[]): { id: string; code: string }[] {
  return columns.flatMap((c) => c.groups.map((g) => ({ id: g.id, code: c.code })));
}

/* ------------------------------------------------------------------ */
/* the price sheet's own age                                           */
/* ------------------------------------------------------------------ */

/**
 * When the prices on this trip were last verified, read off the DATA rather than
 * asserted: the newest `verifiedOn` any SKU in the basket carries. Null when not
 * one line in the trip has ever been verified, which `ageOf` reports as NEVER
 * rather than as an age of zero.
 *
 * Measured on today's dataset: 23 of the 85 priced SKUs carry a verifiedOn, all
 * of them 2026-08-11, and 20 of the 44 lines in the full day-0 trip are among
 * them. The tester variant carries one date for the whole authored receipt.
 */
export function sheetVerifiedOn(lines: EffectiveLine[], testerDate?: string | null): string | null {
  if (testerDate) return testerDate;
  let newest: string | null = null;
  for (const el of lines) {
    const on = ingredientsById[el.line.ingId]?.sku?.verifiedOn ?? null;
    if (on && (newest === null || on > newest)) newest = on;
  }
  return newest;
}

/* ------------------------------------------------------------------ */
/* what the trip deliberately leaves out                               */
/* ------------------------------------------------------------------ */

/**
 * II.6.24 — "Every clip states its remainder as a number." A trip omits real
 * ingredients on purpose: D0-035's pantry-optional set carries no SKU and is
 * assumed already on hand, and 32 freebie seasonings are never separately
 * costed. A basket that quietly drops them is hiding how much it is hiding.
 *
 * Computed from the dataset, never typed by hand.
 */
export interface Omission {
  pantry: string[];
  freebies: number;
}

let omissionCache: Omission | null = null;

export function omissions(): Omission {
  if (omissionCache) return omissionCache;
  const all = Object.values(ingredientsById);
  omissionCache = {
    pantry: all.filter((i) => i.pantryOptional).map((i) => i.name.short),
    freebies: all.filter((i) => i.freebie).length,
  };
  return omissionCache;
}

/* ------------------------------------------------------------------ */
/* reconciliation                                                      */
/* ------------------------------------------------------------------ */

/*
  REMOVED, DELIBERATELY: `reconcileState`, which reported the arbiter's verify
  nominees as a ring of their own.

  The freshness layer's recovery action names the reconcile pad as the way to
  fix a stale price sheet, and a pad holding only two or three nominees cannot
  fix forty-four lines. So the pad holds every uncosted line (`uncostedLines`
  above) and the crown beside it reports the basket's own costed state. A second
  ring reporting a three-item subset would have been a ring whose truth had no
  consequence — section 9's "Fake locks", one level up.
*/

export interface PadRow {
  el: EffectiveLine;
  reading: CostReading;
  /** The arbiter nominated this one as the price most worth checking first. */
  nominated: boolean;
}

/**
 * EVERY LINE THE PAD CAN ACTUALLY FIX, in the order it should be offered: the
 * arbiter's own verify nominees first, then everything else that is not costed.
 * The two are different claims — a nominee is "this is the price most worth
 * checking", an uncosted line is "this price is not current" — and the pad
 * prints both rather than collapsing one into the other.
 */
export function uncostedLines(
  lines: EffectiveLine[],
  ctx: CostContext,
  nominees: readonly string[]
): PadRow[] {
  const nomSet = new Set(nominees);
  const out: PadRow[] = [];
  for (const el of lines) {
    if (el.isDedupe || el.effectivePacks <= 0) continue;
    const reading = costReading(el, ctx);
    if (reading.costed) continue;
    out.push({ el, reading, nominated: nomSet.has(el.line.ingId) });
  }
  /* A stable partition, not a sort by relevance: within each half the trip's own
     order is preserved, because that order is the order of the shop. */
  return [...out.filter((r) => r.nominated), ...out.filter((r) => !r.nominated)];
}

/* ------------------------------------------------------------------ */
/* printing                                                            */
/* ------------------------------------------------------------------ */

/** Money, always two decimals, always the same width. II.6.5. */
export function money(n: number): string {
  return n.toFixed(2);
}

/**
 * II.6.17 — "the sign always printed, never folded into parentheses beside a
 * value". II.6.5 — "Fill the blank sign slot with a figure space (U+2007) so
 * signed and unsigned readings hold one grid." The hyphen-minus is used rather
 * than U+2212 because the data voice is monospaced and the ASCII glyph is the
 * one guaranteed to hold the plus's own advance beside it (II.6.4).
 */
export const FIGURE_SPACE = "\u2007";

export function signedMoney(n: number): string {
  const s = Math.abs(n).toFixed(2);
  if (n > 0) return `+${s}`;
  if (n < 0) return `-${s}`;
  return `${FIGURE_SPACE}0.00`;
}

export function kindLabel(tripDay: number, tester: boolean): string {
  if (tester) return "morrisons starter";
  return tripDay === 0 ? "full shop" : "day-7 top-up";
}
