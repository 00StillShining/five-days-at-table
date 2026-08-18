/**
 * src/screens/today/model.test.ts — the arithmetic behind the two hero gauges.
 *
 * This file exists because `model.ts` is pure and load-bearing: it decides where
 * a needle points, where a zone band starts, and whether a segment renders as a
 * fill or as an outline. Every one of those is a claim about a real reading, and
 * a claim nothing checks is a claim waiting to drift.
 *
 * The cases below are the ones that actually bite, not the ones that are easy:
 * the fixed scale, the over-band rounding collision, the a-twice-independent
 * seat geometry, and an age-of-minutes formatter that must never round up into
 * a lie.
 */

import { describe, expect, it } from "vitest";
import {
  CHANNELS,
  CHRONO_FULL_MIN,
  CHRONO_REDLINE_MIN,
  CHRONO_WARN_MIN,
  DIAL_HEADROOM,
  ESCAPEMENT_TOOTH_DEG,
  KNOB_PITCH,
  KNOB_SEATS,
  SEGMENTS,
  bracketColumns,
  chronoAngle,
  chronoState,
  dialAngle,
  dialFraction,
  dialScaleMax,
  dialZones,
  formatChannel,
  formatMinutes,
  seatAngle,
  segmentStates,
} from "./model";
import { ARC_START_DEG, ARC_SWEEP_DEG } from "../../cd/physics/slew";

describe("the knob's seat geometry", () => {
  it("keeps II.3.6's committed 22.5 degree pitch", () => {
    for (let i = 1; i < KNOB_SEATS; i++) {
      expect(seatAngle(i) - seatAngle(i - 1)).toBeCloseTo(KNOB_PITCH, 10);
    }
  });

  it("centres its own sweep, so seat 0 and the last seat straddle vertical", () => {
    expect(seatAngle(0)).toBeCloseTo(-seatAngle(KNOB_SEATS - 1), 10);
  });

  it("has exactly one seat per channel — a detent that seats on nothing is a lie", () => {
    expect(KNOB_SEATS).toBe(CHANNELS.length);
  });
});

describe("the dial's scale", () => {
  it("is fixed by the BAND alone, so the engraved ring never moves under the needle", () => {
    const band: [number, number] = [916, 1449];
    const quiet = dialScaleMax(band);
    // the reading changes; the scale does not
    expect(dialScaleMax(band)).toBe(quiet);
    expect(quiet).toBeCloseTo(1449 * DIAL_HEADROOM, 6);
  });

  it("never returns a zero scale, however empty the band", () => {
    expect(dialScaleMax([0, 0])).toBeGreaterThan(0);
  });

  it("maps the ends of the range onto II.3.18's own arc", () => {
    expect(dialAngle(0, 100)).toBeCloseTo(ARC_START_DEG, 10);
    expect(dialAngle(100, 100)).toBeCloseTo(ARC_START_DEG + ARC_SWEEP_DEG, 10);
  });

  it("clamps past full scale rather than running the needle off the face", () => {
    expect(dialAngle(500, 100)).toBeCloseTo(ARC_START_DEG + ARC_SWEEP_DEG, 10);
    expect(dialAngle(-20, 100)).toBeCloseTo(ARC_START_DEG, 10);
    expect(dialFraction(500, 100)).toBe(1);
    expect(dialFraction(-20, 100)).toBe(0);
  });

  it("prints the warning band BENEATH the redline and never overlapping it", () => {
    const zones = dialZones([916, 1449], dialScaleMax([916, 1449]));
    expect(zones.bandStart).toBeLessThan(zones.bandEnd);
    expect(zones.bandEnd).toBeLessThan(zones.warnEnd);
    expect(zones.warnEnd).toBeLessThan(1); // the redline still has arc to occupy
  });
});

describe("the ladder's segments", () => {
  const band: [number, number] = [916, 1449];
  const scale = dialScaleMax(band);

  it("lights nothing at zero", () => {
    expect(segmentStates(0, band, scale).every((s) => s === "off")).toBe(true);
  });

  it("lights inside the band as fills, never as outlines", () => {
    const states = segmentStates(1000, band, scale);
    expect(states.includes("on")).toBe(true);
    expect(states.includes("hollow")).toBe(false);
  });

  it("shows at least one HOLLOW segment for a real overage, even when rounding collides", () => {
    // 1449.4 against a 1449 ceiling: on a 2173.5 scale both the fill count and
    // the ceiling index round to the same segment, so the loop alone produces
    // no hollow and "just over" would look identical to "exactly at".
    const states = segmentStates(1449.4, band, scale);
    expect(states.filter((s) => s === "hollow").length).toBeGreaterThanOrEqual(1);
  });

  it("does not invent an overage for a reading exactly at the ceiling", () => {
    expect(segmentStates(1449, band, scale).includes("hollow")).toBe(false);
  });

  it("always returns exactly the committed segment count", () => {
    for (const v of [0, 1, 900, 1449, 5000]) {
      expect(segmentStates(v, band, scale)).toHaveLength(SEGMENTS);
    }
  });

  it("floors the band bracket at two grid columns so it never reads as a hairline", () => {
    // kcal's worst case: a band a few units wide against a scale in the thousands
    const narrow: [number, number] = [1448, 1449];
    const b = bracketColumns(narrow, dialScaleMax(narrow));
    expect(b.end - b.start).toBeGreaterThanOrEqual(2);
  });
});

describe("the chronometer", () => {
  it("parks the needle at the minimum once start-by has passed", () => {
    expect(chronoAngle(-42)).toBeCloseTo(ARC_START_DEG, 10);
  });

  it("pins at the stop past full scale instead of wrapping", () => {
    expect(chronoAngle(CHRONO_FULL_MIN * 3)).toBeCloseTo(ARC_START_DEG + ARC_SWEEP_DEG, 10);
  });

  it("names its states off the committed thresholds", () => {
    expect(chronoState(null)).toBe("off");
    expect(chronoState(-1)).toBe("late");
    expect(chronoState(0)).toBe("now");
    expect(chronoState(CHRONO_REDLINE_MIN)).toBe("now");
    expect(chronoState(CHRONO_REDLINE_MIN + 1)).toBe("watch");
    expect(chronoState(CHRONO_WARN_MIN)).toBe("watch");
    expect(chronoState(CHRONO_WARN_MIN + 1)).toBe("in-hand");
  });

  it("turns one escapement tooth per minute, and the wheel closes on 24", () => {
    expect(ESCAPEMENT_TOOTH_DEG * 24).toBe(360);
  });
});

describe("the printed figures", () => {
  it("never rounds a duration up into a claim that has not happened", () => {
    expect(formatMinutes(59)).toBe("59m");
    expect(formatMinutes(60)).toBe("1h 00m");
    expect(formatMinutes(119)).toBe("1h 59m");
    expect(formatMinutes(0)).toBe("0m");
  });

  it("signs a passed deadline rather than hiding it", () => {
    expect(formatMinutes(-42)).toBe("-42m");
    expect(formatMinutes(-290)).toBe("-4h 50m");
  });

  it("keeps kcal whole and the three macro channels at one decimal", () => {
    const kcal = CHANNELS[0];
    const protein = CHANNELS[1];
    expect(formatChannel(426.4, kcal)).toBe("426");
    expect(formatChannel(27.54, protein)).toBe("27.5");
    // a whole number stays whole rather than printing a hollow ".0"
    expect(formatChannel(28, protein)).toBe("28");
  });

  it("gives every channel a reserved width, so an arriving digit never reflows a neighbour", () => {
    for (const c of CHANNELS) expect(c.valueCh).toBeGreaterThanOrEqual(4);
  });

  it("gives only the three macro channels a cream-face ink — kcal carries no hue", () => {
    expect(CHANNELS[0].ink).toBeNull();
    for (const c of CHANNELS.slice(1)) expect(c.ink).toMatch(/^var\(--cd-ch-/);
  });
});
