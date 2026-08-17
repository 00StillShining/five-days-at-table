/**
 * src/cd/sound/coalescer.ts — the two mixing laws, as pure arithmetic.
 *
 * II.5.11 — "Audible detents are capped at 8 events/second — one voice per
 * 125ms slot. Events that arrive inside a closed slot coalesce: the first
 * overflow books one merged tick at the slot boundary at -6 dB relative (0.5
 * gain multiplier); more than three in a slot — a rate above 24 events/second —
 * drops the merged tick to -12 dB relative. The ear keeps the rhythm of motion
 * without receiving a bill for every seat; the semantic layer, as always,
 * counted every one."
 *
 * II.5.12 — "The same cue re-fired within 1000ms plays 3 dB lower than the
 * last, stepping down to a floor of -12 dB relative; 1000ms of silence resets
 * it to full voice. THE WARNING IS EXEMPT — it repeats at fixed level until
 * acknowledged, because urgency does not fatigue on schedule."
 *
 * Both laws are separated from synthesis on purpose: they are the part with a
 * right answer, and the part a test can hold to it. The AudioContext clock is
 * passed in rather than reached for, so the whole module runs in node.
 */

/** II.5.11 — 8 slots per second. */
export const SLOT_MS = 125;

/** The two merged levels, as linear gain multipliers. */
export const MERGE_6DB = 0.5; // -6 dB relative — first overflow
export const MERGE_12DB = 0.25; // -12 dB relative — more than three pending
export const MERGE_THRESHOLD = 3; // "more than three in a slot"

/** II.5.12 — repeats duck 3 dB per repeat, floored at -12 dB, reset after 1000ms. */
export const DUCK_STEP_DB = -3;
export const DUCK_FLOOR_DB = -12;
export const DUCK_RESET_MS = 1000;

/** The one cue exempt from ducking. Urgency does not fatigue on schedule. */
export const DUCK_EXEMPT = "warning";

export type CoalesceDecision =
  | { fire: true; at: number; gain: number }
  | { fire: false; scheduleAt: number };

export interface CoalescerState {
  slotEnd: number;
  pending: number;
}

export function createCoalescerState(): CoalescerState {
  return { slotEnd: 0, pending: 0 };
}

/**
 * Decide what a detent arriving at `now` (audio-clock seconds) should do.
 *
 * - The slot is open and nothing is pending: fire at full voice, close the slot.
 * - Otherwise: count the arrival and report the boundary it should fire at. The
 *   caller schedules ONE merged tick there — never one per arrival.
 */
export function coalesce(state: CoalescerState, now: number): CoalesceDecision {
  if (now >= state.slotEnd && state.pending === 0) {
    state.slotEnd = now + SLOT_MS / 1000;
    return { fire: true, at: now, gain: 1 };
  }
  state.pending += 1;
  return { fire: false, scheduleAt: state.slotEnd };
}

/**
 * The gain the merged tick plays at, and the state reset that follows it.
 * Called when the scheduled boundary arrives.
 */
export function flushMerged(state: CoalescerState, now: number): number {
  const gain = state.pending > MERGE_THRESHOLD ? MERGE_12DB : MERGE_6DB;
  state.pending = 0;
  state.slotEnd = now + SLOT_MS / 1000;
  return gain;
}

export interface DuckState {
  at: number;
  db: number;
}

/**
 * II.5.12 — the duck multiplier for a cue, in linear gain. Multiply it into the
 * cue's own peak. The warning returns 1 always.
 *
 * @param nowMs wall-clock ms (performance.now), NOT the audio clock — this is a
 *              familiarity window, not a scheduling decision.
 */
export function duckGain(
  ducks: Map<string, DuckState>,
  cueName: string,
  nowMs: number
): number {
  if (cueName === DUCK_EXEMPT) return 1;
  const previous = ducks.get(cueName);
  // A cue that has never fired is not a repeat. Branching on PRESENCE rather
  // than on a sentinel timestamp matters: a default of { at: 0 } makes every
  // first fire inside the first second of the clock look like a repeat of
  // something that never happened, and the cue lands 3 dB under the peak
  // II.5.2's ladder committed it to.
  const db =
    previous !== undefined && nowMs - previous.at < DUCK_RESET_MS
      ? Math.max(previous.db + DUCK_STEP_DB, DUCK_FLOOR_DB)
      : 0;
  ducks.set(cueName, { at: nowMs, db });
  return Math.pow(10, db / 20);
}

/**
 * II.5.13 — sound sits where the control sits. A cue leans toward its control's
 * horizontal position: 0-1 across the viewport maps onto -0.3 .. +0.3. "The
 * range is a lean, not a location." The warning is exempt and plays dead
 * centre: danger has no address.
 */
export const PAN_LEAN = 0.3;

export function panFor(cueName: string, xFraction: number): number {
  if (cueName === DUCK_EXEMPT) return 0;
  const x = Math.min(1, Math.max(0, xFraction));
  return -PAN_LEAN + 2 * PAN_LEAN * x;
}
