/**
 * src/cd/physics/detent.ts — the potential well.
 *
 * II.1.11 — "A detent is a potential well in travel, not a grid line on a
 * readout. The capture zone is +/-40% of pitch around each seat; on release,
 * the seat completes in the 80-160ms window — 120ms default — on
 * cubic-bezier(0.60, 0, 0.10, 1): late, sharp, committed. The seated value IS
 * the semantic value; a pointer resting between seats is a rendering error, not
 * a state."
 *
 * II.1.12 — "Crossing a threshold and re-crossing it are different distances:
 * the commit boundary and the release boundary are separated by a band of 12%
 * of pitch, centered on the midpoint — forward commits at 56% of the gap,
 * return releases at 44%."
 *
 * This module is pure arithmetic on detent INDICES. It holds no DOM, no timers
 * and no rendering — a keypress and a drag both land here and both produce the
 * identical value, which is the whole point of II.1.18 and II.3.4.
 */

/** II.1.11 — capture zone is +/-40% of pitch around each seat. */
export const CAPTURE_FRACTION = 0.4;

/** II.1.12 — the hysteresis band: 12% of pitch, centred on the midpoint. */
export const HYSTERESIS_BAND = 0.12;

/** II.1.11 / II.1.5 — the seat completes in this window. 120ms is the default. */
export const SEAT_MIN_MS = 80;
export const SEAT_DEFAULT_MS = 120;
export const SEAT_MAX_MS = 160;

/** II.3.6 — the detented knob: 13 seats over a 270 degree sweep, 22.5 pitch. */
export const KNOB_PITCH_DEG = 22.5;
export const KNOB_SEATS = 13;
export const KNOB_SWEEP_DEG = 270;

/** II.1.16 — fine mode re-gears to 10-25% of coarse. 20% is the default. */
export const FINE_GEAR = 0.2;
export const FINE_GEAR_MIN = 0.1;
export const FINE_GEAR_MAX = 0.25;

export interface DetentTrack {
  /** Number of seats. Index runs 0 .. seats - 1. */
  seats: number;
  /** Travel between adjacent seats, in the track's own unit (deg, px, 0-1). */
  pitch: number;
  /**
   * Hysteresis band as a fraction of pitch. Defaults to 12% (II.1.12).
   * II.1.12's escalation clause widens this to 20% for values fed by NOISY
   * STREAMS rather than by hands — "sensor jitter needs a deeper moat than a
   * fingertip does". Nothing in FD-5 is sensor-fed, so nothing here uses it.
   */
  band?: number;
}

/** The seat index a continuous travel value belongs to, ignoring hysteresis. */
export function nearestSeat(track: DetentTrack, travel: number): number {
  const raw = Math.round(travel / track.pitch);
  return Math.min(track.seats - 1, Math.max(0, raw));
}

/** The exact travel value of a seat — where the pointer must actually rest. */
export function seatTravel(track: DetentTrack, index: number): number {
  return index * track.pitch;
}

/**
 * Is `travel` inside the capture zone of `index`? +/-40% of pitch (II.1.11).
 * Outside every capture zone the pointer is between wells, which is a position
 * the hand can occupy during a drag and a state the model never can.
 */
export function isCaptured(track: DetentTrack, travel: number, index: number): boolean {
  return Math.abs(travel - seatTravel(track, index)) <= track.pitch * CAPTURE_FRACTION;
}

/**
 * Quantise continuous travel to a seat index, WITH hysteresis.
 *
 * Forward motion commits at 56% of the gap; return releases at 44%. Without the
 * band, a hand resting at a boundary makes the value flicker at frame rate, and
 * every flicker re-fires the seat, the tick and the readout. With it, the
 * boundary moves behind you each time you cross.
 *
 * @param seated the index the track is CURRENTLY seated at — the caller owns
 *               this, because hysteresis is memory and memory is state.
 */
export function quantise(track: DetentTrack, travel: number, seated: number): number {
  const band = track.band ?? HYSTERESIS_BAND;
  const inDetents = travel / track.pitch;
  let next = seated;
  if (inDetents > seated + 0.5 + band / 2) {
    next = Math.floor(inDetents + 0.5 - band / 2); // commit at 56% forward
  } else if (inDetents < seated - 0.5 - band / 2) {
    next = Math.ceil(inDetents - 0.5 + band / 2); // release at 44% back
  }
  return Math.min(track.seats - 1, Math.max(0, next));
}

/**
 * Seat duration for a given distance, held inside the 80-160ms window.
 * A short correction seats fast; a full-pitch commit takes the default. The
 * window is a band, not a menu: leaving it is a defect, not a signature
 * (II.1.5).
 */
export function seatDurationMs(track: DetentTrack, fromTravel: number, toTravel: number): number {
  const fraction = Math.min(1, Math.abs(toTravel - fromTravel) / track.pitch);
  return Math.round(SEAT_MIN_MS + (SEAT_MAX_MS - SEAT_MIN_MS) * fraction);
}

/**
 * II.1.11's escalation clause — "Pushed adds pull inside the well during the
 * drag itself: displayed angle = travel + (seat - travel) * 0.25, so the hand
 * feels the seat before it commits." The mapping stays continuous, so II.1.6's
 * no-first-contact-jump survives.
 */
export const WELL_PULL = 0.25;

export function pulledTravel(track: DetentTrack, travel: number, seated: number): number {
  const seat = seatTravel(track, seated);
  return travel + (seat - travel) * WELL_PULL;
}

/**
 * II.1.13 — throw is a ratio. Every control declares the gesture distance that
 * covers full travel and holds it constant across the whole range. Dead zones
 * are travel GEOMETRY at the ends only; input has no dead zone, because the
 * first pixel of gesture moves the value.
 */
export const GEAR = {
  /** Full sweep per 200px of vertical drag (II.1.13, II.3.5). */
  knob: 1 / 200,
  /** The track is the throw — 1:1 (II.3.10). */
  fader: 1,
  /** Diameter 8rem rim: one revolution is about 402px of arc (II.1.13). */
  wheel: 1 / 402,
} as const;

/** Apply a gear, with fine mode as a re-gearing and nothing else (II.1.16). */
export function gearedDelta(
  kind: keyof typeof GEAR,
  deltaPx: number,
  fine = false,
  fineGear = FINE_GEAR
): number {
  return deltaPx * GEAR[kind] * (fine ? fineGear : 1);
}
