import { describe, expect, it } from "vitest";
import {
  ARC_START_DEG,
  ARC_SWEEP_DEG,
  REST_STOP_DEG,
  SLEW_DEG_PER_S,
  SLEW_FLOOR_MS,
  SMOOTHING_MS,
  angleFor,
  createSlew,
  crossedThreshold,
  slewDurationMs,
  smoothed,
} from "./slew";

describe("the project slew rate (CD-BRIEF ruling 1)", () => {
  it("is 720 deg/s PROJECT-WIDE, not the doctrine's 540", () => {
    expect(SLEW_DEG_PER_S).toBe(720);
  });

  it("sweeps the full 270 degree arc in 375ms", () => {
    expect(slewDurationMs(ARC_SWEEP_DEG)).toBe(375);
  });

  it("floors the smallest correction at 80ms so motion still registers", () => {
    expect(SLEW_FLOOR_MS).toBe(80);
    // 27 degrees computes to 37.5ms and is floored
    expect(slewDurationMs(27)).toBe(80);
    expect(slewDurationMs(0)).toBe(80);
  });

  it("makes DISTANCE set time — the whole point of a rate (II.4.8)", () => {
    const half = slewDurationMs(ARC_SWEEP_DEG / 2);
    const full = slewDurationMs(ARC_SWEEP_DEG);
    expect(full / half).toBeCloseTo(2, 6);
  });
});

describe("the gauge arc (II.3.18)", () => {
  it("runs 270 degrees from -135, minimum at 7 o'clock", () => {
    expect(angleFor(0, 0, 100)).toBe(-135);
    expect(angleFor(100, 0, 100)).toBe(135);
    expect(angleFor(50, 0, 100)).toBe(0);
  });

  it("clamps out-of-range values to the arc rather than running off it", () => {
    expect(angleFor(-40, 0, 100)).toBe(ARC_START_DEG);
    expect(angleFor(400, 0, 100)).toBe(135);
  });

  it("parks OFF at a rest stop 4 degrees below the minimum tick", () => {
    expect(REST_STOP_DEG).toBe(ARC_START_DEG - 4);
  });
});

describe("a needle travelling at the rate", () => {
  it("takes 375ms of real time to cross the full arc, one ms at a time", () => {
    const s = createSlew(-135);
    s.retarget(135);
    let elapsed = 0;
    while (!s.arrived() && elapsed < 2000) {
      s.advance(1);
      elapsed += 1;
    }
    expect(elapsed).toBe(375);
  });

  it("takes exactly 80ms for a move short enough to be floored", () => {
    const s = createSlew(0);
    s.retarget(27); // 37.5ms at the raw rate
    let elapsed = 0;
    while (!s.arrived() && elapsed < 500) {
      s.advance(1);
      elapsed += 1;
    }
    expect(elapsed).toBe(80);
  });

  it("does NOT arrive early and then sit still — the floor is a rate, not a pad", () => {
    const s = createSlew(0);
    s.retarget(27);
    s.advance(40); // half the floored duration
    // a fixed-duration tween with a minimum would already be at 27 here
    expect(s.shown()).toBeGreaterThan(0);
    expect(s.shown()).toBeLessThan(27);
    expect(s.shown()).toBeCloseTo(13.5, 6);
  });

  it("RETARGETS MID-FLIGHT from where the needle actually is (II.4.15)", () => {
    const s = createSlew(-135);
    s.retarget(135);
    s.advance(100);
    const mid = s.shown();
    expect(mid).toBeGreaterThan(-135);
    expect(mid).toBeLessThan(135);

    s.retarget(-135); // the user changed their mind
    expect(s.shown()).toBe(mid); // the obsolete sweep did not finish first
    expect(s.target()).toBe(-135);

    s.advance(1000);
    expect(s.shown()).toBe(-135);
  });

  it("never overshoots its target on a large step", () => {
    const s = createSlew(-135);
    s.retarget(135);
    for (let i = 0; i < 100; i++) s.advance(16);
    expect(s.shown()).toBe(135);
  });

  it("jump() repositions with no travel — the reduced-motion dialect", () => {
    const s = createSlew(-135);
    s.jump(90);
    expect(s.shown()).toBe(90);
    expect(s.arrived()).toBe(true);
  });

  it("reports the remaining travel time honestly", () => {
    const s = createSlew(-135);
    s.retarget(135);
    expect(Math.round(s.remainingMs())).toBe(375);
    s.advance(375);
    expect(s.remainingMs()).toBe(0);
  });
});

describe("warnings outrun smoothing (II.4.14)", () => {
  it("smooths the DISPLAY on a 120ms exponential window", () => {
    expect(SMOOTHING_MS).toBe(120);
    const once = smoothed(0, 1, 120);
    expect(once).toBeCloseTo(1 - Math.E ** -1, 6);
  });

  it("tests the RAW value, never the smoothed one", () => {
    // the crossing happens at the sample; the needle is still at 0.02
    const raw = 0.95;
    const shown = smoothed(0, raw, 4);
    expect(shown).toBeLessThan(0.1);
    expect(crossedThreshold(raw, 0.9)).toBe(true);
    expect(crossedThreshold(shown, 0.9)).toBe(false);
  });
});
