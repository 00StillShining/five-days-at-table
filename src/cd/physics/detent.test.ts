import { describe, expect, it } from "vitest";
import {
  CAPTURE_FRACTION,
  FINE_GEAR,
  FINE_GEAR_MAX,
  FINE_GEAR_MIN,
  HYSTERESIS_BAND,
  KNOB_PITCH_DEG,
  KNOB_SEATS,
  KNOB_SWEEP_DEG,
  SEAT_DEFAULT_MS,
  SEAT_MAX_MS,
  SEAT_MIN_MS,
  gearedDelta,
  isCaptured,
  nearestSeat,
  pulledTravel,
  quantise,
  seatDurationMs,
  seatTravel,
  type DetentTrack,
} from "./detent";

const knob: DetentTrack = { seats: KNOB_SEATS, pitch: KNOB_PITCH_DEG };

describe("committed detent values", () => {
  it("captures at +/-40% of pitch (II.1.11)", () => {
    expect(CAPTURE_FRACTION).toBe(0.4);
  });

  it("bands hysteresis at 12% of pitch (II.1.12)", () => {
    expect(HYSTERESIS_BAND).toBe(0.12);
  });

  it("seats inside the 80-160ms window, 120ms default (II.1.5, II.1.11)", () => {
    expect(SEAT_MIN_MS).toBe(80);
    expect(SEAT_DEFAULT_MS).toBe(120);
    expect(SEAT_MAX_MS).toBe(160);
  });

  it("lays 13 seats over 270 degrees at 22.5 pitch — twelve intervals (II.3.6)", () => {
    expect(KNOB_SEATS).toBe(13);
    expect(KNOB_PITCH_DEG).toBe(22.5);
    expect((KNOB_SEATS - 1) * KNOB_PITCH_DEG).toBe(KNOB_SWEEP_DEG);
  });

  it("keeps fine mode inside the 10-25% band, 20% default (II.1.16)", () => {
    expect(FINE_GEAR).toBe(0.2);
    expect(FINE_GEAR).toBeGreaterThanOrEqual(FINE_GEAR_MIN);
    expect(FINE_GEAR).toBeLessThanOrEqual(FINE_GEAR_MAX);
  });
});

describe("the capture zone (II.1.11)", () => {
  it("captures inside 40% of pitch either side of a seat", () => {
    const seat = seatTravel(knob, 4); // 90 degrees
    expect(isCaptured(knob, seat + 8.9, 4)).toBe(true); // 8.9 < 9.0
    expect(isCaptured(knob, seat - 8.9, 4)).toBe(true);
  });

  it("does NOT capture past 40% — that travel belongs to the next well", () => {
    const seat = seatTravel(knob, 4);
    expect(isCaptured(knob, seat + 9.5, 4)).toBe(false);
  });

  it("clamps nearestSeat to the track's own ends", () => {
    expect(nearestSeat(knob, -900)).toBe(0);
    expect(nearestSeat(knob, 9000)).toBe(KNOB_SEATS - 1);
  });
});

describe("hysteresis kills chatter (II.1.12)", () => {
  const track: DetentTrack = { seats: 21, pitch: 1 };

  it("commits FORWARD at 56% of the gap, not at 50%", () => {
    expect(quantise(track, 5.5, 5)).toBe(5); // dead on the midpoint — no commit
    expect(quantise(track, 5.55, 5)).toBe(5); // still inside the band
    expect(quantise(track, 5.61, 5)).toBe(6); // past 56% — commits
  });

  it("releases BACKWARD at 44% of the gap", () => {
    expect(quantise(track, 5.5, 6)).toBe(6); // the boundary moved behind us
    expect(quantise(track, 5.45, 6)).toBe(6);
    expect(quantise(track, 5.39, 6)).toBe(5); // past 44% — releases
  });

  it("cannot flicker: a hand resting exactly on a boundary holds its seat", () => {
    let seated = 5;
    for (let i = 0; i < 60; i++) {
      // frame-rate jitter of +/-0.005 detents around the exact midpoint
      const travel = 5.5 + (i % 2 === 0 ? 0.005 : -0.005);
      seated = quantise(track, travel, seated);
    }
    expect(seated).toBe(5); // one seat, sixty frames, zero re-fires
  });

  it("clamps to the track's own ends", () => {
    expect(quantise(track, -50, 0)).toBe(0);
    expect(quantise(track, 500, 20)).toBe(20);
  });
});

describe("the seat's own duration", () => {
  it("never leaves the 80-160ms window, whatever the distance", () => {
    for (const d of [0, 1, 5, 11.25, 22.5, 45, 400]) {
      const ms = seatDurationMs(knob, 0, d);
      expect(ms).toBeGreaterThanOrEqual(SEAT_MIN_MS);
      expect(ms).toBeLessThanOrEqual(SEAT_MAX_MS);
    }
  });

  it("seats a short correction faster than a full-pitch commit", () => {
    expect(seatDurationMs(knob, 0, 2)).toBeLessThan(seatDurationMs(knob, 0, 22.5));
  });
});

describe("well pull keeps the mapping continuous (II.1.11 Pushed, II.1.6)", () => {
  it("pulls a quarter of the way toward the seat and no further", () => {
    // travel 95, seat 4 is at 90: displayed = 95 + (90 - 95) * 0.25 = 93.75
    expect(pulledTravel(knob, 95, 4)).toBeCloseTo(93.75, 6);
  });

  it("never teleports — the pulled value stays a continuous function of travel", () => {
    const a = pulledTravel(knob, 95, 4);
    const b = pulledTravel(knob, 95.001, 4);
    expect(Math.abs(b - a)).toBeLessThan(0.002);
  });
});

describe("throw is a ratio (II.1.13), fine is a gear (II.1.16)", () => {
  it("covers a knob's full sweep in 200px of vertical drag", () => {
    expect(gearedDelta("knob", 200)).toBeCloseTo(1, 10);
  });

  it("runs a fader at 1:1 — the track IS the throw", () => {
    expect(gearedDelta("fader", 37)).toBe(37);
  });

  it("re-gears fine to 20% and changes nothing else", () => {
    expect(gearedDelta("knob", 200, true)).toBeCloseTo(0.2, 10);
    // same path, same ratio, just scaled — the constancy rule of II.1.13
    expect(gearedDelta("knob", 100, true) * 2).toBeCloseTo(gearedDelta("knob", 200, true), 10);
  });

  it("holds gearing CONSTANT across the range — variable gearing is a defect", () => {
    const first = gearedDelta("knob", 10);
    const later = gearedDelta("knob", 10);
    expect(first).toBe(later);
  });
});
