import { afterEach, describe, expect, it } from "vitest";
import {
  BANNED_SPRINGS,
  MASS,
  cssPair,
  createMassSpring,
  dampingRatio,
  displayedTravel,
  frictionVelocity,
  isLegalSpring,
  overshoot,
  probe,
  releaseVelocity,
  GLIDE_GATE_PX_S,
  SOFT_LIMIT_CEILING_PX,
} from "./springs";
import { liveCount, resetIntegrator, setScheduler, step } from "./integrator";

/** A scheduler that never fires — the loop is driven by step() in these tests. */
const inert = { now: () => 0, request: () => 1, cancel: () => {} };

afterEach(() => {
  resetIntegrator();
});

describe("the four mass classes (II.1.2)", () => {
  it("commits exactly the four springs the doctrine names, plus panel at chassis scale", () => {
    expect(MASS.light).toMatchObject({ mass: 0.7, stiffness: 420, damping: 25, cssMs: 180 });
    expect(MASS.standard).toMatchObject({ mass: 1, stiffness: 320, damping: 26, cssMs: 240 });
    expect(MASS.weighted).toMatchObject({ mass: 1.4, stiffness: 260, damping: 30, cssMs: 300 });
    expect(MASS.anchored).toMatchObject({ mass: 1.2, stiffness: 300, damping: 38, cssMs: 320 });
    expect(MASS.panel).toMatchObject({ mass: 1.6, stiffness: 240, damping: 30, cssMs: 340 });
  });

  it("has no fifth class — panel is Weighted at chassis scale, not a new mass", () => {
    // II.1.2's exact wording: "Panels ride Weighted at chassis scale". The proof
    // is that panel's damping ratio sits inside the same live band, not that it
    // shares a spring.
    expect(Object.keys(MASS)).toHaveLength(5);
    expect(dampingRatio(MASS.panel)).toBeGreaterThanOrEqual(0.7);
    expect(dampingRatio(MASS.panel)).toBeLessThanOrEqual(0.8);
  });

  it("verifies every zeta against the value II.1.4's own table publishes", () => {
    expect(dampingRatio(MASS.light).toFixed(2)).toBe("0.73");
    expect(dampingRatio(MASS.standard).toFixed(2)).toBe("0.73");
    expect(dampingRatio(MASS.weighted).toFixed(2)).toBe("0.79");
    expect(dampingRatio(MASS.anchored).toFixed(2)).toBe("1.00");
  });

  it("holds live classes inside the 0.70-0.80 band (II.1.4)", () => {
    for (const cls of ["light", "standard", "weighted"] as const) {
      const z = dampingRatio(MASS[cls]);
      expect(z, `${cls} zeta ${z}`).toBeGreaterThanOrEqual(0.7);
      expect(z, `${cls} zeta ${z}`).toBeLessThanOrEqual(0.8);
    }
  });

  it("ANCHORED MEANS ZERO — 0% overshoot, 0 rebounds, always (II.1.3)", () => {
    expect(dampingRatio(MASS.anchored)).toBeGreaterThanOrEqual(1.0);
    expect(overshoot(MASS.anchored)).toBe(0);
    expect(MASS.anchored.overshootBudget).toBe(0);
    expect(MASS.anchored.rebounds).toBe(0);
  });

  it("keeps every live class inside its declared overshoot budget (II.1.7)", () => {
    for (const cls of ["light", "standard", "weighted"] as const) {
      const o = overshoot(MASS[cls]);
      expect(o, `${cls} overshoot ${(o * 100).toFixed(1)}%`).toBeLessThanOrEqual(
        MASS[cls].overshootBudget
      );
    }
  });

  it("reproduces II.1.4's own probe output for the two springs it prints", () => {
    expect(probe({ mass: 1, stiffness: 320, damping: 26 })).toEqual({
      zeta: "0.73",
      overshoot: "3.6%",
    });
    expect(probe({ mass: 1.2, stiffness: 300, damping: 38 })).toEqual({
      zeta: "1.00",
      overshoot: "0.0%",
    });
  });

  it("rejects all three springs II.1.4 bans", () => {
    for (const { cfg, why } of BANNED_SPRINGS) {
      expect(isLegalSpring(cfg), why).toBe(false);
    }
  });

  it("ships the CSS pair for every class (II.1.20)", () => {
    expect(cssPair("standard")).toBe("240ms var(--cd-ease-settle)");
    expect(cssPair("anchored")).toBe("320ms var(--cd-ease-settle)");
  });
});

describe("the one integrator (II.1.19)", () => {
  it("sleeps at rest and releases the loop", () => {
    setScheduler(inert);
    const s = createMassSpring("standard");
    s.set(100);
    expect(liveCount()).toBe(1);
    for (let i = 0; i < 200; i++) step(1 / 60);
    expect(s.isResting()).toBe(true);
    expect(s.read()).toBe(100); // snapped to truth, not to "close enough"
    expect(liveCount()).toBe(0); // a spring that never sleeps is a heater
  });

  it("carries every subscriber on ONE loop, stepped from one accumulator (II.4.13)", () => {
    setScheduler(inert);
    const a = createMassSpring("standard");
    const b = createMassSpring("standard");
    a.set(1);
    b.set(1);
    expect(liveCount()).toBe(2);
    for (let i = 0; i < 20; i++) step(1 / 60);
    // one clock, one truth: identical springs given identical targets in the
    // same frame report identical positions, by construction
    expect(a.read()).toBe(b.read());
  });

  it("does not enter the loop for a target it is already at", () => {
    setScheduler(inert);
    const s = createMassSpring("standard", 42);
    s.set(42);
    expect(liveCount()).toBe(0);
  });

  it("RETARGETS IN FLIGHT, carrying position and velocity (II.1.17)", () => {
    setScheduler(inert);
    const s = createMassSpring("standard");
    s.set(100);
    for (let i = 0; i < 6; i++) step(1 / 60);
    const midX = s.read();
    const midV = s.velocity();
    expect(midX).toBeGreaterThan(0);
    expect(midV).toBeGreaterThan(0);

    s.set(-50); // the reversal
    expect(s.read()).toBe(midX); // nothing reset
    expect(s.velocity()).toBe(midV); // velocity carried
    expect(s.target()).toBe(-50); // the obsolete target is simply gone
  });

  it("accepts an inherited launch velocity — the glide handoff", () => {
    setScheduler(inert);
    const s = createMassSpring("weighted");
    s.set(10, 250);
    expect(s.velocity()).toBe(250);
  });

  it("clamps the accumulator so a backgrounded tab returns without exploding", () => {
    setScheduler(inert);
    const s = createMassSpring("standard");
    s.set(1);
    step(30); // thirty seconds of "missed" time in one call
    expect(Number.isFinite(s.read())).toBe(true);
    expect(Math.abs(s.read())).toBeLessThanOrEqual(2);
  });

  it("ANCHORED never overshoots its target in the integrator either", () => {
    setScheduler(inert);
    const s = createMassSpring("anchored");
    s.set(100);
    let peak = 0;
    for (let i = 0; i < 200; i++) {
      step(1 / 60);
      peak = Math.max(peak, s.read());
    }
    expect(peak).toBeLessThanOrEqual(100);
  });

  it("jump() seeds a position with no motion at all", () => {
    setScheduler(inert);
    const s = createMassSpring("standard");
    s.jump(77);
    expect(s.read()).toBe(77);
    expect(s.velocity()).toBe(0);
    expect(liveCount()).toBe(0);
  });
});

describe("release gate and friction (II.1.8, II.1.9)", () => {
  it("measures velocity over the final 80ms, not the final frame", () => {
    const trail = [
      { t: 0, p: 0 }, // older than the window — must be ignored
      { t: 500, p: 0 },
      { t: 540, p: 10 },
      { t: 580, p: 20 },
    ];
    // 20px over 80ms = 250px/s. Including the t=0 sample would give 34px/s.
    expect(Math.round(releaseVelocity(trail, 580))).toBe(250);
  });

  it("gates coast against settle at 180px/s", () => {
    expect(GLIDE_GATE_PX_S).toBe(180);
  });

  it("decays exponentially, never linearly (II.1.8)", () => {
    const v0 = 1000;
    const a = frictionVelocity(v0, 90, 90); // one tau
    const b = frictionVelocity(v0, 180, 90); // two tau
    expect(a / v0).toBeCloseTo(Math.E ** -1, 5);
    expect(b / a).toBeCloseTo(Math.E ** -1, 5); // the ratio is constant — the tell
  });
});

describe("soft limits resist, hard stops are dead (II.1.14)", () => {
  it("passes travel through 1:1 inside range", () => {
    expect(displayedTravel(150, 200)).toBe(150);
  });

  it("compresses 3:1 past the boundary", () => {
    expect(displayedTravel(230, 200)).toBe(210);
  });

  it("caps the rubber at 24px however hard it is pushed", () => {
    expect(displayedTravel(2000, 200)).toBe(200 + SOFT_LIMIT_CEILING_PX);
  });
});
