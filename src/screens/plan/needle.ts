/**
 * src/screens/plan/needle.ts — the sweep, and the one rebound after it.
 *
 * THE SWEEP is the project's, not the chapter's. CD-BRIEF product ruling 1
 * overrides ch.17 section 6's 540 deg/s: "Needle slew = 720 deg/s PROJECT-WIDE
 * ... full 270 degree arc in 375ms, floored at 80ms. Rate, never a
 * fixed-duration tween." `src/cd/physics/slew.ts` owns that arithmetic and
 * implements the floor as a RATE REDUCTION rather than a minimum duration, so
 * nothing arrives early and then sits still.
 *
 * THE WOBBLE is the chapter's, and it is this language's whole tell:
 * "a controlled overshoot, exactly once, then stillness — the tell of a
 * mechanical gauge that a flat digital face could never produce honestly."
 * Its size is not chosen, it is COMPUTED from the Weighted class's own spring:
 *
 *     zeta      = 30 / (2 * sqrt(260 * 1.4))            = 0.7862
 *     overshoot = exp(-pi * zeta / sqrt(1 - zeta^2))    = 0.01836  (1.84%)
 *
 * which sits inside II.1.7's <=2% budget, and section 9's "wobble inflation"
 * failure mode caps it at exactly one rebound, signed in the sweep's own
 * direction, never backward against it.
 *
 * Interruption: II.4.15. A retarget mid-flight re-aims from wherever the needle
 * actually is, cancels any rebound in progress, and nothing finishes an
 * obsolete animation. A rebound that is no longer true never plays out.
 *
 * REDUCED MOTION. II.4.26 translates rather than deletes, and what a needle
 * MEANS is its position, not its travel. So under `prefers-reduced-motion` the
 * angle lands immediately and the rebound is not played: the reading is
 * identical to the frame, and only the reinforcement channel is spent.
 */

import { createSlew, REST_STOP_DEG, type Slew } from "../../cd/physics/slew";

const ZETA = 30 / (2 * Math.sqrt(260 * 1.4));
export const OVERSHOOT = Math.exp((-Math.PI * ZETA) / Math.sqrt(1 - ZETA * ZETA));

/** The chapter's own authored rebound window — NOT the Weighted CSS pair. */
export const WOBBLE_MS = 140;

export interface NeedleDrive {
  /** Retarget. Interrupts a sweep or a rebound in flight (II.4.15). */
  to(deg: number, animate: boolean): void;
  /** Stop everything and release the frame loop. */
  stop(): void;
}

type Phase = "rest" | "slew" | "wobble";

/**
 * One needle, one loop, and the loop only exists while the needle is moving.
 * PLAN's data is slow — a reading changes when a hand commits a swap, changes
 * the scope, the cover or the variant, and at no other time — so this costs
 * nothing at rest, which is where it spends almost all of its life.
 */
export function createNeedleDrive(write: (deg: number) => void): NeedleDrive {
  const slew: Slew = createSlew(REST_STOP_DEG);
  let phase: Phase = "rest";
  let raf: number | null = null;
  let last = 0;
  let wobbleStart = 0;
  let travel = 0;
  let dir = 1;
  let seeded = false;

  function frame(now: number): void {
    const dt = Math.min(now - last, 50); // clamp a cold resume (II.1.19)
    last = now;
    if (phase === "slew") {
      const shown = slew.advance(dt);
      write(shown);
      if (slew.arrived()) {
        phase = "wobble";
        wobbleStart = now;
      }
    } else if (phase === "wobble") {
      const t = Math.min(1, (now - wobbleStart) / WOBBLE_MS);
      write(slew.target() + Math.sin(t * Math.PI) * travel * OVERSHOOT * dir);
      if (t >= 1) {
        write(slew.target());
        phase = "rest";
      }
    }
    if (phase === "rest") {
      raf = null;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  return {
    to(deg, animate) {
      if (!seeded || !animate) {
        // The seed, and the reduced-motion dialect: land, do not travel.
        seeded = true;
        if (raf != null) cancelAnimationFrame(raf);
        raf = null;
        phase = "rest";
        slew.jump(deg);
        write(deg);
        return;
      }
      const from = slew.shown();
      const distance = Math.abs(deg - from);
      if (distance < 0.01) return;
      dir = Math.sign(deg - from) || 1;
      travel = distance;
      slew.retarget(deg);
      phase = "slew";
      if (raf == null) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
    stop() {
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
      phase = "rest";
    },
  };
}
