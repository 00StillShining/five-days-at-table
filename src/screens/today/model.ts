/**
 * src/screens/today/model.ts — TODAY's arithmetic, with no DOM in it.
 *
 * Everything here is pure so the dial, the ladder and the printed figure all
 * read ONE computation (II.4.13 — "one clock, one truth"). The first Sol build
 * of this screen had the ladder computing its own scale per channel while the
 * printed figure rounded differently; two numbers wearing one instrument is the
 * defect II.4.13 exists to forbid.
 *
 * THE SCALE IS FIXED PER CHANNEL, NOT PER READING. The old build recomputed
 * `scaleMax` from `max(bandMax*1.3, target*1.1, value)`, which moved the ticks
 * under the needle every time a slot was ticked. A dial whose ticks move is not
 * a dial. Here the scale is `bandMax * 1.5`, decided by the band alone, so the
 * engraved ring is a constant for that channel and the needle is the only thing
 * that moves (II.3.18's whole premise).
 */

import type { Band, Macros } from "../../data/types";
import { ARC_START_DEG, ARC_SWEEP_DEG } from "../../cd/physics/slew";

export type ChannelKey = "kcal" | "protein" | "fat" | "netCarb";

export interface ChannelSpec {
  key: ChannelKey;
  /** The engraved word on the ladder's own cream plate. */
  label: string;
  /** The word the dial's escutcheon carries when this channel is selected. */
  title: string;
  /** II.6.6 — the unit trails the value at 40% of its size. */
  unit: string;
  /**
   * CD-BRIEF repair 2: `ink` is legal only on a cream face, `lift` is the
   * anthracite/carbon set (4.53-4.58:1). kcal is the day total rather than one
   * of the four macro channels, so it carries no hue at all and reads by
   * position, engraved label and segment fill alone.
   *
   * `ink` points at this SCREEN's own tokens, not at `--cd-ch-*-ink`. The world
   * tokens are certified against cream's MIDDLE stop; these labels sit on the
   * selector cap, whose SEATED state carries a cognac wash beneath the label
   * and measures #D5C7AF. The world inks read 3.86-4.03 there. See today.css.
   */
  ink: string | null;
  lift: string;
  /** II.6.5 — reserve the width for the widest legal rendering. */
  valueCh: number;
  /** kcal is whole; the three macro channels keep one decimal (roundMacros). */
  decimals: 0 | 1;
  /** For the aria sentence. */
  spoken: string;
}

/**
 * The four channels PLAN 6.3's console names, in its own order. Fibre is
 * deliberately absent: the console omits it, and a fifth seat on the knob that
 * selected a channel no ladder shows would be a detent that seats on nothing.
 */
export const CHANNELS: readonly ChannelSpec[] = [
  {
    key: "kcal",
    label: "kcal",
    title: "energy",
    unit: "kcal",
    ink: null,
    lift: "var(--cd-mirror)",
    valueCh: 4,
    decimals: 0,
    spoken: "kilocalories",
  },
  {
    key: "protein",
    label: "prot",
    title: "protein",
    unit: "g",
    ink: "var(--tdy-ch-protein)",
    lift: "var(--cd-ch-protein-lift)",
    valueCh: 5,
    decimals: 1,
    spoken: "grams protein",
  },
  {
    key: "fat",
    label: "fat",
    title: "fat",
    unit: "g",
    ink: "var(--tdy-ch-fat)",
    lift: "var(--cd-ch-fat-lift)",
    valueCh: 5,
    decimals: 1,
    spoken: "grams fat",
  },
  {
    key: "netCarb",
    label: "carb",
    title: "net carb",
    unit: "g",
    ink: "var(--tdy-ch-carb)",
    lift: "var(--cd-ch-carb-lift)",
    valueCh: 5,
    decimals: 1,
    spoken: "grams net carb",
  },
];

/** II.3.6's pitch, verbatim. The seat COUNT is this control's own (see below). */
export const KNOB_PITCH = 22.5;

/**
 * DECLARED DELTA from II.3.6's thirteen-seat casting: this knob has FOUR seats,
 * because the value it selects has exactly four positions and "a pointer off
 * its seat is a lie". The PITCH is untouched at 22.5 degrees — which is what
 * the rocker arm and the hero porthole are geared to — so the only figure that
 * moves is the sweep: 3 intervals x 22.5 = 67.5 degrees, centred on zero.
 */
export const KNOB_SEATS = CHANNELS.length;
export const KNOB_SWEEP = KNOB_PITCH * (KNOB_SEATS - 1);

/** The commit angle of a seat, centred so seat 0 and seat 3 straddle vertical. */
export function seatAngle(index: number): number {
  return -KNOB_SWEEP / 2 + index * KNOB_PITCH;
}

/**
 * The dial's full-scale reading for a channel: 1.5x the week band's own top.
 * 1.5 and not 1.3: the plan is authored to sit AT the band edge, so a 1.3x
 * scale puts every honest day's needle in the last quarter of the arc, where a
 * 270 degree instrument has no resolution left to spend.
 */
export const DIAL_HEADROOM = 1.5;

export function dialScaleMax(band: Band): number {
  return Math.max(1, band[1] * DIAL_HEADROOM);
}

/** II.3.18 — angle of a value on [0, scaleMax] over the 270 degree arc. */
export function dialAngle(value: number, scaleMax: number): number {
  const t = Math.min(1, Math.max(0, value / scaleMax));
  return ARC_START_DEG + ARC_SWEEP_DEG * t;
}

/** Where a value sits along the arc as a fraction, for printing a zone band. */
export function dialFraction(value: number, scaleMax: number): number {
  return Math.min(1, Math.max(0, value / scaleMax));
}

export interface DialZones {
  /** The in-band arc: from the band's own floor to its own ceiling. */
  bandStart: number;
  bandEnd: number;
  /**
   * The warning band: the first 15% past the ceiling. A margin worth watching,
   * per ch.05's own separation of warning from redline ("the arc under the top
   * of the ring states a hard limit, the amber band beneath it states a margin
   * worth watching, and neither ever fills for the other's condition").
   */
  warnEnd: number;
}

export const OVER_BAND_WARN_MARGIN = 0.15;

export function dialZones(band: Band, scaleMax: number): DialZones {
  return {
    bandStart: dialFraction(band[0], scaleMax),
    bandEnd: dialFraction(band[1], scaleMax),
    warnEnd: dialFraction(band[1] * (1 + OVER_BAND_WARN_MARGIN), scaleMax),
  };
}

/** kcal whole; protein/fat/netCarb at one decimal, trimmed when integral. */
export function formatChannel(value: number, spec: ChannelSpec): string {
  if (spec.decimals === 0) return String(Math.round(value));
  const oneDp = Math.round(value * 10) / 10;
  return Number.isInteger(oneDp) ? String(oneDp) : oneDp.toFixed(1);
}

/* ------------------------------------------------------------------------ */
/* the ladder                                                                */
/* ------------------------------------------------------------------------ */

export const SEGMENTS = 20;

export type SegState = "on" | "hollow" | "off";

/**
 * The four subordinate ladders share the dial's scale exactly, so the small
 * gauge and the big one cannot disagree about where a reading sits.
 *
 * "hollow" is a SHAPE channel for over-band (II.7.7 — colour never travels
 * alone): a lit segment past the band's ceiling renders as an outline instead
 * of a fill. Carried over from the Sol build, including its fix: a real overage
 * that rounds onto the same segment index as the ceiling still forces one
 * hollow segment, so "just over" and "exactly at" are never identical.
 */
export function segmentStates(value: number, band: Band, scaleMax: number): SegState[] {
  const filled = Math.min(SEGMENTS, Math.max(0, Math.round((value / scaleMax) * SEGMENTS)));
  const ceiling = Math.min(SEGMENTS, Math.max(0, Math.round((band[1] / scaleMax) * SEGMENTS)));
  const states: SegState[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    states.push(i >= filled ? "off" : i >= ceiling ? "hollow" : "on");
  }
  if (value > band[1] && filled > 0) states[filled - 1] = "hollow";
  return states;
}

/** The band bracket's grid columns, floored at two so it never reads as a hairline. */
export function bracketColumns(band: Band, scaleMax: number): { start: number; end: number } {
  const start = Math.min(SEGMENTS, Math.max(0, Math.round((band[0] / scaleMax) * SEGMENTS)));
  let end = Math.min(SEGMENTS, Math.max(start, Math.round((band[1] / scaleMax) * SEGMENTS)));
  if (end - start < 1) {
    if (end < SEGMENTS) end = start + 1;
    else return { start: Math.max(0, end - 1) + 1, end: end + 2 };
  }
  return { start: start + 1, end: end + 2 };
}

/* ------------------------------------------------------------------------ */
/* the chronometer                                                           */
/* ------------------------------------------------------------------------ */

/**
 * Full scale: six hours in hand. Longer than any real gap between waking and a
 * 19:30 serve minus the longest critical path in the dataset, so the needle is
 * on scale for the whole working day and pins only when it is genuinely late.
 */
export const CHRONO_FULL_MIN = 360;

/** The hard limit, printed: inside this the cook has to start now. */
export const CHRONO_REDLINE_MIN = 30;

/** The margin worth watching, printed as an amber band beneath the redline. */
export const CHRONO_WARN_MIN = 90;

/** One tooth of the escapement, in degrees. 24 teeth, one consumed per minute. */
export const ESCAPEMENT_TEETH = 24;
export const ESCAPEMENT_TOOTH_DEG = 360 / ESCAPEMENT_TEETH;

export function chronoAngle(minutesInHand: number): number {
  return dialAngle(Math.max(0, minutesInHand), CHRONO_FULL_MIN);
}

/** "3h 12m", "12m", "-42m". Whole units; never rounded up into a lie. */
export function formatMinutes(mins: number): string {
  const late = mins < 0;
  const m = Math.abs(Math.trunc(mins));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  const body = h > 0 ? `${h}h ${String(rem).padStart(2, "0")}m` : `${rem}m`;
  return late ? `-${body}` : body;
}

export type ChronoState = "in-hand" | "watch" | "now" | "late" | "off";

export function chronoState(minutesInHand: number | null): ChronoState {
  if (minutesInHand == null) return "off";
  if (minutesInHand < 0) return "late";
  if (minutesInHand <= CHRONO_REDLINE_MIN) return "now";
  if (minutesInHand <= CHRONO_WARN_MIN) return "watch";
  return "in-hand";
}

export const CHRONO_WORD: Record<ChronoState, string> = {
  "in-hand": "IN HAND",
  watch: "WATCH",
  now: "START NOW",
  late: "LATE",
  off: "NO COOK",
};

/* ------------------------------------------------------------------------ */
/* the tally                                                                 */
/* ------------------------------------------------------------------------ */

export interface Tally {
  ticked: number;
  cookable: number;
  cut: number;
}

/** Whole-day summary used by the deck's escutcheon and by Trophy Mode. */
export function tallyOf(ticked: number, cookable: number, cut: number): Tally {
  return { ticked, cookable, cut };
}

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, netCarb: 0, fat: 0, fibre: 0 };
