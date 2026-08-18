/**
 * src/screens/meal/model.ts — MEAL's arithmetic, with no DOM and no React in it.
 *
 * Everything here is pure so a keypress and a drag land on the identical value
 * (II.3.4: "A keypress that skips the mechanical layer still lands on the same
 * semantic core — the value it produces is identical to the dragged one"), and
 * so the fence below can be tested rather than asserted.
 *
 * ---------------------------------------------------------------------------
 * THE FENCE — MEAL NEVER OPENS OVER COOK
 * ---------------------------------------------------------------------------
 * CD-BRIEF: "MEAL is a tray over the screen that summoned it (PLAN or TODAY),
 * NEVER over COOK." That is not a stylistic preference — it is a named curdle
 * in ch.16 section 8: "REEL LOGIC collides on physics rather than palette: both
 * fuse a rotary and its own readout into one control, but one earns coast
 * through traversal and the other refuses coast on principle — placed side by
 * side, the same fast spin would mean two contradictory things depending on
 * which control the hand happened to land on."
 *
 * MEAL is URL-addressable (`#/meal/:id?from=plan`), so the summoning screen
 * arrives as untrusted text in a hash. `summonerFrom` is the ONLY way this
 * screen resolves it, and it admits exactly two values. "cook", "COOK", a typo,
 * an empty string and a hand-edited URL all resolve to "plan" — the tray's
 * home, never the room the fence forbids.
 */

import type { Cover, Ingredient, Macros, Meal, Slot } from "../../data";
import type { IngredientCoverage, MealCoverage } from "../../state/selectors";

/* ========================================================================== */
/* THE FENCE                                                                  */
/* ========================================================================== */

/** The only two screens a MEAL tray may be a tray OVER. */
export type Summoner = "plan" | "today";

export const SUMMONERS: readonly Summoner[] = ["plan", "today"];

/**
 * Resolve `?from=` into a summoner. Anything that is not literally "plan" or
 * "today" — including "cook" — resolves to "plan".
 *
 * `query` is the router's RAW query string (it deliberately does not parse into
 * URLSearchParams; see app/router.ts on lz-string's "+" characters), so this
 * matches the key itself rather than trusting a parser.
 */
export function summonerFrom(query: string): Summoner {
  const match = /(?:^|&)from=([^&]*)/.exec(query ?? "");
  const raw = match ? decodeURIComponent(match[1]) : "";
  return (SUMMONERS as readonly string[]).includes(raw) ? (raw as Summoner) : "plan";
}

/** The hash a bench card links to, carrying the summoner forward unchanged. */
export function mealHref(mealId: string, from: Summoner): string {
  return `#/meal/${mealId}?from=${from}`;
}

/* ========================================================================== */
/* THE WHEEL — 13 seats, and a value that clamps dead                         */
/* ========================================================================== */
/*
  THE DECLARED REVERT (orchestrator ruling, recorded here because it is the one
  place this screen departs from its own chapter's numbers).

  ch.16 section 3 scales the Foundry's detented knob "from twelve intervals at
  22.5deg to a hundred and fifty at 2.4deg" and makes the wheel an unbounded
  incremental encoder. FD-5's portion scale is a BOUNDED 0.70-1.30 at 0.05, which
  is 13 seats — the Foundry's own detented knob (II.3.6) exactly: 13 seats over a
  270deg sweep at 22.5deg pitch, seating in 110ms on --cd-ease-snap.

  What is carried forward from ch.16 is everything that makes it THAT wheel:
  Ø4.5rem cap in a 0.375rem recessed collar, Weighted spring(1.4,260,30), the
  refusal of coast at any speed, the 2100Hz / 18ms / -24dBFS sine tick, and the
  two-layer ring-and-catch split. 150 free steps on a value with 13 legal ones
  would be a wheel that lied about how many decisions it had actually made,
  which is the one thing this language will not do.
*/

/** The contract range (PLAN §6.5 / PHASE2-CONTRACT). */
export const SCALE_MIN = 0.7;
export const SCALE_MAX = 1.3;
export const SCALE_STEP = 0.05;

/** II.3.6 — 13 seats, 12 intervals, 22.5deg pitch over a 270deg sweep. */
export const WHEEL_SEATS = 13;
export const WHEEL_PITCH_DEG = 22.5;
export const WHEEL_SWEEP_DEG = 270;
/** II.3.6's own snap: 110ms on cubic-bezier(0.60, 0, 0.10, 1). */
export const WHEEL_SEAT_MS = 110;

export const SCALE_DETENTS: readonly number[] = Array.from({ length: WHEEL_SEATS }, (_, i) =>
  Math.round((SCALE_MIN + i * SCALE_STEP) * 100) / 100
);

/** Seat index -> the portion scale it commits. */
export function scaleForSeat(seat: number): number {
  const clamped = Math.min(WHEEL_SEATS - 1, Math.max(0, Math.round(seat)));
  return SCALE_DETENTS[clamped];
}

/**
 * Portion scale -> seat index. The inverse of `scaleForSeat`, and the single
 * choke point every arriving value runs through — a scale persisted by an older
 * build, a hand-edited store, or a future step size all resolve to a real seat
 * rather than leaving the pointer between wells (II.1.11: "a pointer resting
 * between seats is a rendering error, not a state").
 */
export function seatForScale(scale: number): number {
  const raw = Math.round((scale - SCALE_MIN) / SCALE_STEP);
  return Math.min(WHEEL_SEATS - 1, Math.max(0, raw));
}

/** The committed angle of a seat: -135deg at 0.70, +135deg at 1.30. */
export function seatAngle(seat: number): number {
  return -WHEEL_SWEEP_DEG / 2 + seat * WHEEL_PITCH_DEG;
}

/** True at either hard stop — II.1.14's 0% give, held for the at-limit state. */
export function atLimit(seat: number): "min" | "max" | null {
  if (seat <= 0) return "min";
  if (seat >= WHEEL_SEATS - 1) return "max";
  return null;
}

/** The wheel's printed figure. Always two decimals — a portion is never "×1.2". */
export function formatScale(scale: number): string {
  return scale.toFixed(2);
}

/* ========================================================================== */
/* THE COVER RING — a categorical fact, never the scale                       */
/* ========================================================================== */
/*
  ch.16 section 9, the named failure this screen must not commit:

    "FORMAT-LAMP ORNAMENT. The ring lights or shifts hue with no real stream
     behind it, decoration wearing the wheel's honest indicator. Earliest sign:
     colour on an empty queue or a paused, unloaded screen. Repair: bind the
     lamp strictly to the format field of the file playing."

  So the ring is bound to WHICH COVER'S PLATE THE TRAY IS CUT TO — a categorical
  fact about the object, exactly as bit depth is a categorical fact about a file.
  It is NOT bound to the portion scale: a scale is a continuous quantity the hand
  sets, and a ring that shifted hue as the wheel turned would be the ornament
  above, wearing this language's one licensed emissive.

  TWO LAMPS, NOT FOUR, and the arithmetic is declared rather than borrowed:
  ch.16 lays four 82deg arcs with 2deg gaps (328 + 8 = 336) and reserves the
  remaining 24deg AT THE BASE for the lit lamp's bloom to breathe. FD-5's cover
  code has exactly two values, so the same 336/24 split is spent on two arcs:
  2 x 166 + 2 x 2 = 336, with the identical 24deg reserved at the base. An
  invented third and fourth lamp would be a code with nothing behind it.

  Laid out clockwise from twelve o'clock, which is how a conic-gradient reads:

      him    0deg -> 166deg   (166)
      gap  166deg -> 168deg   (2)
      base 168deg -> 192deg   (24, reserved — the bloom breathes here)
      her  192deg -> 358deg   (166)
      gap  358deg -> 360deg   (2)
*/

export interface CoverLamp {
  cover: Cover;
  /** The lit hex, from ch.16 section 2's own format-code registry. */
  hue: string;
  /** The dim print — a committed hex, never an opacity blend (ch.16 §3). */
  dim: string;
  /** The 1px lens rim, at this lamp's own hot value (world.css measured repair). */
  rim: string;
  /** The printed word. II.7.7 — colour never travels alone. */
  word: string;
  /** The arc's start angle, measured from the ring's 12 o'clock. */
  startDeg: number;
  sweepDeg: number;
}

export const RING_ARC_DEG = 166;
export const RING_GAP_DEG = 2;
/** The base reserve, kept from ch.16: the lit lamp's bloom breathes here. */
export const RING_RESERVE_DEG = 24;

export const COVER_LAMPS: readonly CoverLamp[] = [
  {
    cover: "m",
    hue: "#3e7fd6",
    dim: "#3e5a81",
    rim: "#82ace4",
    word: "HIM · 85 KG",
    startDeg: 0,
    sweepDeg: RING_ARC_DEG,
  },
  {
    cover: "w",
    hue: "#4e9c5c",
    dim: "#45654f",
    rim: "#8cbf95",
    word: "HER · 70 KG",
    startDeg: RING_ARC_DEG + RING_GAP_DEG + RING_RESERVE_DEG,
    sweepDeg: RING_ARC_DEG,
  },
];

/**
 * The ring's own arithmetic, proved rather than asserted: the two arcs, the two
 * gaps and the reserved base must account for exactly 360 degrees, with the
 * reserve sitting at the base (centred on 180deg).
 */
export function ringGeometry(): {
  total: number;
  reserveStart: number;
  reserveEnd: number;
} {
  const arcs = COVER_LAMPS.length * RING_ARC_DEG;
  const gaps = COVER_LAMPS.length * RING_GAP_DEG;
  return {
    total: arcs + gaps + RING_RESERVE_DEG,
    reserveStart: RING_ARC_DEG + RING_GAP_DEG,
    reserveEnd: RING_ARC_DEG + RING_GAP_DEG + RING_RESERVE_DEG,
  };
}

/**
 * The ring's two conic tracks, painted from the committed arithmetic rather
 * than from hand-typed stops so the 336/24 split cannot drift.
 *
 * `dim` carries BOTH arcs at their committed dim prints — "unlit, it is still a
 * lamp" (II.3.24), and the dim print is a committed hex, never an opacity blend
 * (ch.16 §3). `lit` carries ONLY the arc whose cover is active, so the bloom
 * applied to it cannot leak onto a lamp that is not reporting anything.
 */
export function ringTracks(cover: Cover): { dim: string; lit: string; hue: string } {
  const dimStops: string[] = [];
  let cursor = 0;
  for (const lamp of COVER_LAMPS) {
    if (lamp.startDeg > cursor) dimStops.push(`#00000000 ${cursor}deg ${lamp.startDeg}deg`);
    const end = lamp.startDeg + lamp.sweepDeg;
    dimStops.push(`${lamp.dim} ${lamp.startDeg}deg ${end}deg`);
    cursor = end;
  }
  if (cursor < 360) dimStops.push(`#00000000 ${cursor}deg 360deg`);

  const active = COVER_LAMPS.find((l) => l.cover === cover) ?? COVER_LAMPS[0];
  const litEnd = active.startDeg + active.sweepDeg;
  const litStops = [
    `#00000000 0deg ${active.startDeg}deg`,
    `${active.hue} ${active.startDeg}deg ${litEnd}deg`,
    `#00000000 ${litEnd}deg 360deg`,
  ];

  return {
    dim: `conic-gradient(${dimStops.join(",")})`,
    lit: `conic-gradient(${litStops.join(",")})`,
    hue: active.hue,
  };
}

/** The lens-rim track: 1px at each lamp's own hot value, present in BOTH
 *  states, because that rim is what carries the 3:1 graphical channel the
 *  cores cannot (measured: 2.35-4.09:1 for the cores, 4.73-6.57:1 for the rims). */
export function ringRims(): string {
  const stops: string[] = [];
  let cursor = 0;
  for (const lamp of COVER_LAMPS) {
    if (lamp.startDeg > cursor) stops.push(`#00000000 ${cursor}deg ${lamp.startDeg}deg`);
    const end = lamp.startDeg + lamp.sweepDeg;
    stops.push(`${lamp.rim} ${lamp.startDeg}deg ${end}deg`);
    cursor = end;
  }
  if (cursor < 360) stops.push(`#00000000 ${cursor}deg 360deg`);
  return `conic-gradient(${stops.join(",")})`;
}

export const COVER_LABEL: Record<Cover, string> = { w: "her · 70 kg", m: "him · 85 kg" };
export const COVER_SHORT: Record<Cover, string> = { w: "her", m: "him" };

/** The other cover. The rocker's whole semantic. */
export function otherCover(cover: Cover): Cover {
  return cover === "w" ? "m" : "w";
}

/* ========================================================================== */
/* THE PLATE — grams, at this portion                                         */
/* ========================================================================== */

export interface PlateRow {
  ingId: string;
  name: string;
  /** The authoritative figure: grams at the committed scale, rounded once. */
  grams: number;
  /** The household approximation, or null when the ingredient carries no unit. */
  hint: string | null;
  /** 0-4 fuzzy stocktake level, or null when this ingredient is never tracked. */
  level: number | null;
  /** True for spice-shelf staples, which are excluded from coverage entirely. */
  freebie: boolean;
  /** ISO datetime of the stocktake behind `level`, or null if never counted. */
  countedAt: string | null;
}

/** Total plate weight, in grams, at the committed scale. The drum's own figure. */
export function plateWeight(meal: Meal, cover: Cover, scale: number): number {
  let total = 0;
  for (const g of Object.values(meal.covers[cover])) total += g * scale;
  return Math.round(total);
}

const FRACTION_GLYPHS: [number, string][] = [
  [0.75, "¾"],
  [0.5, "½"],
  [0.25, "¼"],
];

/**
 * A household-unit phrase for an already-scaled gram figure ("¾ avocado").
 * Rounds to the nearest quarter-unit, which is a genuine approximation of the
 * authoritative gram figure — which is why every caller pairs it with the
 * estimate mark rather than printing it as if it were exact.
 */
export function formatHouseholdHint(scaledGrams: number, ing: Ingredient): string | null {
  const unit = ing.spec.householdUnitG;
  if (!unit || unit <= 0) return null;
  const count = Math.round((scaledGrams / unit) * 4) / 4;
  if (count <= 0) return null;
  const whole = Math.floor(count);
  const frac = Math.round((count - whole) * 4) / 4;
  const fracGlyph = frac === 0 ? "" : FRACTION_GLYPHS.find(([f]) => f === frac)?.[1] ?? "";
  const numberText = whole > 0 ? `${whole}${fracGlyph}` : fracGlyph || null;
  if (!numberText) return null;
  const word = count > 1 ? ing.spec.unitPlural : ing.spec.unitSingular;
  if (!word) return null;
  return `${numberText} ${word}`;
}

/** II.6.25's neighbour: a step duration in whole units, never rounded up. */
export function formatStepDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  const whole = Math.floor(minutes);
  const seconds = Math.round((minutes - whole) * 60);
  return seconds > 0 ? `${whole}m ${seconds}s` : `${whole}m`;
}

/* ========================================================================== */
/* THE STOCK METER — coverage, at THIS portion                                */
/* ========================================================================== */
/*
  `coverageForMeal` (src/state/selectors.ts, FROZEN) answers the question at
  x1.00 only. The wheel changes what the plate NEEDS, so the answer has to move
  with it — but the formula must not be copied, or the two will disagree one day.

  So this scales the selector's OWN OUTPUT: it already returns, per ingredient,
  `needG` at x1.00 and `haveG` estimated off the fuzzy stocktake level. The need
  scales; what is in the house does not. Each ingredient's contribution is capped
  at its own need, exactly as the selector caps it, so a surplus of one cannot
  mask a shortage of another.
*/

export interface StockRead {
  /** 0-1, grams-weighted, capped per ingredient. */
  coverage: number;
  /** Ingredients whose own ratio is under 1 at this scale. */
  short: IngredientCoverage[];
  /** How many ingredients the coverage figure is computed over. */
  counted: number;
}

export function stockAtScale(base: MealCoverage, scale: number): StockRead {
  let need = 0;
  let have = 0;
  const short: IngredientCoverage[] = [];
  for (const row of base.byIngredient) {
    const needG = row.needG * scale;
    need += needG;
    have += Math.min(needG, row.haveG);
    if (row.haveG < needG) short.push(row);
  }
  return {
    coverage: need > 0 ? have / need : 1,
    short,
    counted: base.byIngredient.length,
  };
}

/**
 * The meter's printed zones (II.3.19 — "the zone colors live on the track; an
 * unlit cover hides the unfilled region, so zone geometry never moves").
 * Three bands, and each one is a real decision the operator makes:
 *   0-60%    short      the shop happens before this plate does
 *   60-100%  partial    cookable with a substitution or a smaller portion
 *   100%     covered
 */
export const STOCK_ZONE_SHORT = 0.6;

export function stockZone(coverage: number): "short" | "partial" | "covered" {
  if (coverage >= 0.999) return "covered";
  if (coverage < STOCK_ZONE_SHORT) return "short";
  return "partial";
}

export const STOCK_ZONE_WORD: Record<ReturnType<typeof stockZone>, string> = {
  short: "SHORT",
  partial: "PART",
  covered: "COVERED",
};

/** II.3.19's segments. 20 segments = one per 5% of the meter's own travel. */
export const STOCK_SEGMENTS = 20;

/* ========================================================================== */
/* THE SPEC PLATE — the inspector's complete sheet                            */
/* ========================================================================== */

export interface SpecChannel {
  key: keyof Macros;
  label: string;
  unit: string;
  decimals: number;
  /** Widest legal rendering, for II.6.5's reserved width. */
  ch: number;
}

export const SPEC_CHANNELS: readonly SpecChannel[] = [
  { key: "kcal", label: "energy", unit: "kcal", decimals: 0, ch: 4 },
  { key: "protein", label: "protein", unit: "g", decimals: 1, ch: 5 },
  { key: "netCarb", label: "net carb", unit: "g", decimals: 1, ch: 5 },
  { key: "fat", label: "fat", unit: "g", decimals: 1, ch: 5 },
  { key: "fibre", label: "fibre", unit: "g", decimals: 1, ch: 5 },
];

export function formatMacro(value: number, spec: SpecChannel): string {
  return value.toFixed(spec.decimals);
}

export const SLOT_LABEL: Record<Slot, string> = {
  breakfast: "bfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
};

export const SLOT_ORDER: readonly Slot[] = ["breakfast", "lunch", "dinner", "snack"];

/* ========================================================================== */
/* THE DAY BENCH                                                              */
/* ========================================================================== */

export interface BenchSeat {
  slot: Slot;
  label: string;
  /** null when the slot is cut in the active variant — never a fabricated meal. */
  mealId: string | null;
  name: string | null;
  tag: "batch" | "fresh" | null;
  /** The tester's stated reason this slot is cut, or null. */
  cutReason: string | null;
  /** True when a swap has replaced the planned meal in this slot. */
  swapped: boolean;
  /** True when this seat is the meal the tray is currently reporting. */
  current: boolean;
  /**
   * This plate's own energy at the active cover and the committed portion.
   * Real, per-plate, and the reason a shelf of cards is a comparison surface
   * rather than a row of links: the day's four plates are only comparable if
   * each one states what it costs.
   */
  kcal: number | null;
  /** This plate's own coverage at the committed portion, 0-1. */
  coverage: number | null;
  /** This plate's own weight in grams at the committed portion. */
  grams: number | null;
}

/* ========================================================================== */
/* TROPHY MODE — what survives                                                */
/* ========================================================================== */
/*
  Owner ruling: "3-5 survivors at 2x scale; age at 1.21875rem, exact figure at
  1.75rem, always visible; others disappear rather than shrink."

  ch.16's own Trophy variant names what may never disappear: "the lit format
  lamp itself, since the whole language's argument is that the ring never lies
  about what is actually playing; the [hero] figure ... never an icon standing
  in for one; every survivor's own age".

  Four survivors, and each one is a fact the room can read from across it:
    1  the wheel, at 2x, with its own faceted pattern intact
    2  the hero figure, the committed portion scale
    3  the cover ring's lit lamp and its printed word
    4  the stock meter, with its age and its state word
*/
export const TROPHY_SURVIVORS = 4;
export const TROPHY_AGE_REM = 1.21875;
export const TROPHY_FIGURE_REM = 1.75;
