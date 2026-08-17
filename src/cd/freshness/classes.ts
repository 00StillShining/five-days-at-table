/**
 * src/cd/freshness/classes.ts — how old is too old, declared once.
 *
 * CORRECTIONARY 4, honesty, non-negotiable: "every live reading shows its exact
 * figure AND ITS AGE; a value that stops updating DECLARES ITSELF STALE instead
 * of silently going wrong; no invented data, no fake progress, no motion with
 * nothing behind it. Drama never lies."
 *
 * II.3.18 and II.3.32 both fix the same presentation: the value HOLDS, the ink
 * drops to 55%, and a stale lamp lights. "The needle never invents motion."
 *
 * The thresholds below are declared, not felt. Each names the reading it
 * governs and why that number and not another. A screen may not invent a sixth
 * class, and may not silently re-tune one of these five: a threshold that
 * exists in two places will disagree in one of them.
 */

export type FreshnessClass = "stocktake" | "price" | "eaten" | "timer" | "macros";

export interface FreshnessSpec {
  /** ms after which the reading declares itself stale. Infinity = never stale. */
  staleAfterMs: number;
  /** The word that PRINTS beside the held value. Never a colour alone (II.7.7). */
  word: string;
  /** Why this number. */
  reason: string;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const FRESHNESS: Record<FreshnessClass, FreshnessSpec> = {
  stocktake: {
    staleAfterMs: 72 * HOUR,
    word: "UNCOUNTED",
    reason:
      "A household counts its shelves on a rhythm, not continuously. Three days " +
      "covers a missed weekend without calling a Monday count wrong on Tuesday.",
  },
  price: {
    staleAfterMs: 14 * DAY,
    word: "UNPRICED",
    reason:
      "Supermarket shelf prices move on a fortnightly promo cycle, so a price " +
      "older than one full cycle can no longer be quoted as a current figure.",
  },
  eaten: {
    staleAfterMs: DAY,
    word: "YESTERDAY",
    reason:
      "An eaten tick answers 'did we eat this SLOT'. The question resets at the " +
      "day boundary, so the answer expires with the day it belongs to.",
  },
  timer: {
    staleAfterMs: 2000,
    word: "NO SIGNAL",
    reason:
      "II.3.18's own stale rule for a live display: no data for 2000ms and the " +
      "needle holds position with ink at 55%. A cook timer is the one reading " +
      "here that is genuinely per-second.",
  },
  macros: {
    staleAfterMs: Number.POSITIVE_INFINITY,
    word: "",
    reason:
      "Macros are computed from the plan, not sampled from the world. A derived " +
      "value has no age of its own, and giving it one would be invented data.",
  },
};

/** II.3.18 / II.3.32 — stale drops the ink to 55%. The VALUE never moves. */
export const STALE_INK_ALPHA = 0.55;

export interface Age {
  /** ms since the reading was taken. null when it has never been taken. */
  ms: number | null;
  stale: boolean;
  /** The printed word, empty when fresh or when the class is never-stale. */
  word: string;
  /** Never null when a reading exists: honesty requires the exact figure. */
  label: string;
}

/**
 * Age a timestamp against its class.
 *
 * A reading that has NEVER been taken is not "stale" — it is absent, and an
 * absent reading gets the word NEVER and no age, because claiming an age for a
 * value that was never sampled is the invented data the honesty rule forbids.
 */
export function ageOf(
  cls: FreshnessClass,
  takenAt: string | number | null | undefined,
  now: number
): Age {
  const spec = FRESHNESS[cls];
  if (takenAt === null || takenAt === undefined || takenAt === "") {
    return { ms: null, stale: true, word: "NEVER", label: "never" };
  }
  const t = typeof takenAt === "number" ? takenAt : Date.parse(takenAt);
  if (Number.isNaN(t)) {
    return { ms: null, stale: true, word: "NEVER", label: "never" };
  }
  const ms = Math.max(0, now - t);
  const stale = ms >= spec.staleAfterMs;
  return { ms, stale, word: stale ? spec.word : "", label: formatAge(ms) };
}

/**
 * The exact figure, in the coarsest unit that still states it exactly.
 * II.6.25 fixes the clock format at 24hr HH:MM:SS; an age is not a clock, so it
 * prints in whole units and never rounds up into a lie ("2d" for 47 hours would
 * claim a day that has not happened).
 */
export function formatAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** True when the class can go stale at all. Macros cannot. */
export function canGoStale(cls: FreshnessClass): boolean {
  return Number.isFinite(FRESHNESS[cls].staleAfterMs);
}
