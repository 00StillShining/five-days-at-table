/**
 * src/cd/physics/keys.ts — the keyboard IS physics.
 *
 * II.1.18 — "A keypress is a detent. One arrow is one detent of the coarse
 * scale, Shift+arrow one fine step at 20% of coarse, PageUp and PageDown ten
 * detents, Home and End the hard limits, Escape the abandonment of an engaged
 * drag — the value returns to what the drag began with. Held keys repeat at 12
 * events/second after a 380ms initial delay, ON THE PRODUCT'S OWN CLOCK,
 * because OS repeat rates vary and physics does not."
 *
 * II.3.4 — "A keypress that skips the mechanical layer still lands on the same
 * semantic core — the value it produces is identical to the dragged one." That
 * is why this module returns an INTENT rather than performing a mutation: the
 * caller feeds the intent into exactly the same commit path a pointer drag
 * uses, and there is no second code path to drift.
 *
 * A value that teleports for the keyboard and travels for the hand is two
 * instruments wearing one faceplate.
 */

import { FINE_GEAR } from "./detent";

/** II.1.18 — the product's own repeat clock. Never the OS's. */
export const REPEAT_DELAY_MS = 380;
export const REPEAT_RATE_HZ = 12;
export const REPEAT_INTERVAL_MS = Math.round(1000 / REPEAT_RATE_HZ); // 83ms

/** II.1.18 — PageUp / PageDown move ten detents. */
export const PAGE_DETENTS = 10;

export type KeyIntent =
  | { kind: "step"; detents: number; fine: boolean }
  | { kind: "limit"; edge: "min" | "max" }
  | { kind: "abandon" }
  | null;

export interface KeyEventLike {
  key: string;
  shiftKey?: boolean;
  repeat?: boolean;
}

/**
 * Translate a key into a detent intent. Returns null for keys this control does
 * not actuate, so the caller knows not to call preventDefault — swallowing keys
 * a control does not use is how a keyboard user loses their browser.
 *
 * `engaged` reports whether a drag is currently in flight; only then does
 * Escape mean anything (II.1.18).
 */
export function intentFor(e: KeyEventLike, engaged = false): KeyIntent {
  const fine = e.shiftKey === true;
  switch (e.key) {
    case "ArrowUp":
    case "ArrowRight":
      return { kind: "step", detents: 1, fine };
    case "ArrowDown":
    case "ArrowLeft":
      return { kind: "step", detents: -1, fine };
    case "PageUp":
      return { kind: "step", detents: PAGE_DETENTS, fine: false };
    case "PageDown":
      return { kind: "step", detents: -PAGE_DETENTS, fine: false };
    case "Home":
      return { kind: "limit", edge: "min" };
    case "End":
      return { kind: "limit", edge: "max" };
    case "Escape":
      return engaged ? { kind: "abandon" } : null;
    default:
      return null;
  }
}

/**
 * The value delta an intent produces, in the control's own unit.
 * Fine is a GEAR, not a zoom (II.1.16): same commit path, same seats, same
 * hysteresis, same mass class — only the gesture-to-value map changes.
 */
export function deltaFor(intent: KeyIntent, coarseStep: number, fineGear = FINE_GEAR): number {
  if (!intent || intent.kind !== "step") return 0;
  return intent.detents * coarseStep * (intent.fine ? fineGear : 1);
}

export interface RepeatClockHandle {
  /** Stop the repeat. Idempotent; safe to call on keyup and on unmount. */
  cancel(): void;
}

export interface RepeatTimers {
  set(fn: () => void, ms: number): number;
  clear(handle: number): void;
}

const defaultTimers: RepeatTimers = {
  set: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clear: (h) => clearTimeout(h as unknown as ReturnType<typeof setTimeout>),
};

/**
 * Fire `act` immediately, then repeat at 12/s after a 380ms hold.
 *
 * The OS repeat clock is refused outright: callers must drop events where
 * `e.repeat === true` (see `intentFor` usage) and let this run the cadence, so
 * a control feels identical on every machine.
 */
export function startRepeat(
  act: () => void,
  timers: RepeatTimers = defaultTimers
): RepeatClockHandle {
  act(); // the first event lands THIS frame — acknowledgment has no time to spare
  let handle = timers.set(function tick() {
    act();
    handle = timers.set(tick, REPEAT_INTERVAL_MS);
  }, REPEAT_DELAY_MS);
  return {
    cancel() {
      timers.clear(handle);
    },
  };
}

/**
 * II.1.6 — no first-contact jump. A grab is an OFFSET, never a teleport: pair
 * the pointer's down position with the value at that instant and map every
 * later move as a delta from that pair. A fader handle gripped off-centre keeps
 * its offset for the whole drag.
 */
export interface Grab {
  /** Pointer position at the instant of the grab. */
  origin: number;
  /** The control's value at that same instant — the offset's other half. */
  value: number;
}

export function grabDelta(grab: Grab, position: number, gear: number, fine = false): number {
  return (position - grab.origin) * gear * (fine ? FINE_GEAR : 1);
}
