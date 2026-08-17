import { describe, expect, it, vi } from "vitest";
import {
  PAGE_DETENTS,
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  REPEAT_RATE_HZ,
  deltaFor,
  grabDelta,
  intentFor,
  startRepeat,
  type RepeatTimers,
} from "./keys";
import { FINE_GEAR } from "./detent";

describe("a keypress is a detent (II.1.18, II.3.4)", () => {
  it("makes one arrow one detent of the coarse scale", () => {
    expect(intentFor({ key: "ArrowUp" })).toEqual({ kind: "step", detents: 1, fine: false });
    expect(intentFor({ key: "ArrowRight" })).toEqual({ kind: "step", detents: 1, fine: false });
    expect(intentFor({ key: "ArrowDown" })).toEqual({ kind: "step", detents: -1, fine: false });
    expect(intentFor({ key: "ArrowLeft" })).toEqual({ kind: "step", detents: -1, fine: false });
  });

  it("makes Shift+arrow one FINE step at 20% of coarse", () => {
    const i = intentFor({ key: "ArrowUp", shiftKey: true });
    expect(i).toEqual({ kind: "step", detents: 1, fine: true });
    expect(deltaFor(i, 0.05)).toBeCloseTo(0.05 * FINE_GEAR, 10);
  });

  it("makes PageUp/PageDown ten detents, and never fine", () => {
    expect(intentFor({ key: "PageUp", shiftKey: true })).toEqual({
      kind: "step",
      detents: PAGE_DETENTS,
      fine: false,
    });
    expect(intentFor({ key: "PageDown" })).toEqual({
      kind: "step",
      detents: -PAGE_DETENTS,
      fine: false,
    });
  });

  it("makes Home and End the hard limits", () => {
    expect(intentFor({ key: "Home" })).toEqual({ kind: "limit", edge: "min" });
    expect(intentFor({ key: "End" })).toEqual({ kind: "limit", edge: "max" });
  });

  it("makes Escape abandon an ENGAGED drag, and nothing otherwise", () => {
    expect(intentFor({ key: "Escape" }, true)).toEqual({ kind: "abandon" });
    expect(intentFor({ key: "Escape" }, false)).toBeNull();
  });

  it("returns null for keys the control does not actuate", () => {
    // swallowing keys a control does not use is how a keyboard user loses their browser
    for (const key of ["a", "Tab", "Enter", " ", "F5", "/"]) {
      expect(intentFor({ key })).toBeNull();
    }
  });

  it("produces the SAME value a drag would — one semantic core, two actuators", () => {
    const coarse = 1 / 20; // one detent of a 20-seat scale
    const keyed = deltaFor(intentFor({ key: "ArrowUp" }), coarse);
    const dragged = grabDelta({ origin: 0, value: 0 }, 200, 1 / 200 / 20);
    expect(keyed).toBeCloseTo(dragged, 10);
  });
});

describe("the product's own repeat clock (II.1.18)", () => {
  it("commits to 12 events/second after a 380ms hold", () => {
    expect(REPEAT_DELAY_MS).toBe(380);
    expect(REPEAT_RATE_HZ).toBe(12);
    expect(REPEAT_INTERVAL_MS).toBe(83);
  });

  it("fires the first event immediately, then waits 380ms, then repeats at 83ms", () => {
    const scheduled: number[] = [];
    let next: (() => void) | null = null;
    const timers: RepeatTimers = {
      set: (fn, ms) => {
        scheduled.push(ms);
        next = fn;
        return scheduled.length;
      },
      clear: () => {},
    };
    const act = vi.fn();
    startRepeat(act, timers);
    expect(act).toHaveBeenCalledTimes(1); // this frame — acknowledgment has no time to spare
    expect(scheduled).toEqual([REPEAT_DELAY_MS]);

    next!();
    expect(act).toHaveBeenCalledTimes(2);
    expect(scheduled).toEqual([REPEAT_DELAY_MS, REPEAT_INTERVAL_MS]);

    next!();
    expect(act).toHaveBeenCalledTimes(3);
    expect(scheduled).toEqual([REPEAT_DELAY_MS, REPEAT_INTERVAL_MS, REPEAT_INTERVAL_MS]);
  });

  it("cancels cleanly, and cancelling twice is harmless", () => {
    const clear = vi.fn();
    const timers: RepeatTimers = { set: () => 7, clear };
    const h = startRepeat(() => {}, timers);
    h.cancel();
    h.cancel();
    expect(clear).toHaveBeenCalledWith(7);
    expect(clear).toHaveBeenCalledTimes(2);
  });
});

describe("no first-contact jump (II.1.6)", () => {
  it("maps a grab as an OFFSET — a handle gripped off-centre keeps its offset", () => {
    const grab = { origin: 500, value: 0.62 }; // gripped at 62%, pointer at y=500
    // the first pixel of movement changes the value, from the GRAB origin
    expect(grabDelta(grab, 501, 1 / 200)).toBeCloseTo(1 / 200, 10);
    // and 200px of gesture is exactly one full throw, wherever the grab began
    expect(grabDelta(grab, 700, 1 / 200)).toBeCloseTo(1, 10);
  });

  it("never teleports: delta at the grab origin is exactly zero", () => {
    expect(grabDelta({ origin: 500, value: 0.62 }, 500, 1 / 200)).toBe(0);
  });

  it("re-gears fine without changing the mapping's shape", () => {
    const grab = { origin: 0, value: 0 };
    expect(grabDelta(grab, 200, 1 / 200, true)).toBeCloseTo(FINE_GEAR, 10);
  });
});
