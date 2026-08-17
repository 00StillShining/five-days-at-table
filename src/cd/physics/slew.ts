/**
 * src/cd/physics/slew.ts — sweep is a RATE, never a duration.
 *
 * II.4.8 — "A needle or value readout travels at a fixed slew rate, so distance
 * sets time ... floored at 80ms so motion registers. Duration-based sweeps lie
 * twice — small changes crawl and large ones teleport."
 *
 * CD-BRIEF product ruling 1 overrides the doctrine's own figure:
 *
 *   Needle slew = 720 deg/s PROJECT-WIDE (ch.05's declared delta, not the
 *   doctrine's 540 deg/s): full 270 degree arc in 375ms, floored at 80ms.
 *   Rate, never a fixed-duration tween.
 *
 * Every needle in FD-5 shares that one rate regardless of how far it must
 * travel. A 27 degree nudge computes to 37.5ms and is floored to 80ms; the full
 * arc computes to 375ms and is used as computed.
 *
 * II.4.15 — reversal interrupts. `retarget()` re-aims from the CURRENT reported
 * position at the CURRENT velocity: nothing resets, nothing queues, and no
 * obsolete sweep finishes out of respect for its own past.
 */

/** CD-BRIEF ruling 1. Not 540. */
export const SLEW_DEG_PER_S = 720;

/** II.4.8 — the floor, so the smallest correction still registers. */
export const SLEW_FLOOR_MS = 80;

/** II.3.18 — the gauge arc: 270 degrees, from -135 to +135. */
export const ARC_SWEEP_DEG = 270;
export const ARC_START_DEG = -135;
export const ARC_END_DEG = 135;

/** II.3.18 — off parks the needle 4 degrees below the minimum tick, on a stop. */
export const REST_STOP_DEG = ARC_START_DEG - 4;

/** II.4.14 — display smoothing is a 120ms EMA. Threshold checks NEVER read it. */
export const SMOOTHING_MS = 120;

/**
 * Time a sweep of `distanceDeg` takes at the project rate.
 * Distance sets time. Never the reverse.
 */
export function slewDurationMs(distanceDeg: number): number {
  const raw = (Math.abs(distanceDeg) / SLEW_DEG_PER_S) * 1000;
  return Math.max(SLEW_FLOOR_MS, raw);
}

/** Map a value on [min, max] onto the 270 degree arc (II.3.18). */
export function angleFor(value: number, min: number, max: number): number {
  if (max === min) return ARC_START_DEG;
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return ARC_START_DEG + ARC_SWEEP_DEG * t;
}

export interface Slew {
  /** The angle currently reported on screen. */
  shown(): number;
  /** The angle the needle is travelling toward. */
  target(): number;
  /** True once the needle has arrived. */
  arrived(): boolean;
  /**
   * Retarget. II.4.15: the new command re-aims AT ONCE, from wherever the
   * needle actually is. There is no queue and no completion of the old sweep.
   */
  retarget(deg: number): void;
  /** Snap with no travel — the reduced-motion dialect and the seed path. */
  jump(deg: number): void;
  /** Advance by `dtMs` of real time and return the new reported angle. */
  advance(dtMs: number): number;
  /** Remaining travel time at the project rate, in ms. */
  remainingMs(): number;
}

/**
 * A needle's reported angle, moving at the one project rate.
 *
 * The floor is applied as a RATE REDUCTION, not as a minimum duration bolted
 * onto the end: a move short enough to finish inside 80ms is slowed so that it
 * takes exactly 80ms, which is what "floored at 80ms so motion registers"
 * actually asks for. A minimum duration that let the needle arrive early and
 * then sit still would be a fixed-duration tween wearing a rate's name.
 */
export function createSlew(initialDeg = REST_STOP_DEG): Slew {
  let shown = initialDeg;
  let target = initialDeg;
  let rate = SLEW_DEG_PER_S; // deg/s for the CURRENT leg

  function recomputeRate(): void {
    const distance = Math.abs(target - shown);
    if (distance === 0) {
      rate = SLEW_DEG_PER_S;
      return;
    }
    const naturalMs = (distance / SLEW_DEG_PER_S) * 1000;
    rate = naturalMs >= SLEW_FLOOR_MS ? SLEW_DEG_PER_S : distance / (SLEW_FLOOR_MS / 1000);
  }

  return {
    shown: () => shown,
    target: () => target,
    arrived: () => shown === target,
    retarget(deg) {
      target = deg;
      recomputeRate(); // re-aimed from the live position — II.4.15
    },
    jump(deg) {
      shown = deg;
      target = deg;
      rate = SLEW_DEG_PER_S;
    },
    advance(dtMs) {
      const stepDeg = rate * (dtMs / 1000);
      const delta = target - shown;
      shown += Math.max(-stepDeg, Math.min(stepDeg, delta));
      if (Math.abs(target - shown) < 1e-9) shown = target;
      return shown;
    },
    remainingMs() {
      if (shown === target) return 0;
      return (Math.abs(target - shown) / rate) * 1000;
    },
  };
}

/**
 * II.4.14 — "Warnings outrun smoothing." Display smoothing is a sensory
 * courtesy; threshold checks read the RAW value, never the smoothed one, and
 * warning presentation lands within one frame of the crossing. The needle may
 * take 375ms to reach the red zone; the annunciator fires now.
 */
export function smoothed(previous: number, raw: number, dtMs: number): number {
  const a = 1 - Math.exp(-dtMs / SMOOTHING_MS);
  return previous + (raw - previous) * a;
}

/** Returns the RAW crossing, so a caller cannot accidentally test the smoothed one. */
export function crossedThreshold(rawValue: number, threshold: number): boolean {
  return rawValue >= threshold;
}
