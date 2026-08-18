/**
 * src/screens/meal/model.test.ts — MEAL's arithmetic, and the fence.
 *
 * Two of these suites exist because a rule that is only written down is a rule
 * that gets broken by the next builder:
 *
 *  1. THE FENCE. "MEAL is a tray over PLAN or TODAY, NEVER over COOK" is a
 *     physics ruling (ch.16 §8's named curdle with REEL LOGIC), and the
 *     summoning screen arrives as untrusted text in a URL hash. The tests below
 *     drive "cook" at it in every casing and encoding they can.
 *  2. KEYBOARD == DRAG. II.3.4: "A keypress that skips the mechanical layer
 *     still lands on the same semantic core — the value it produces is
 *     IDENTICAL to the dragged one." The test walks a real pointer drag through
 *     the same `quantise` the component uses and asserts the seat sequence
 *     matches the keyed one exactly.
 */

import { describe, expect, it } from "vitest";
import { quantise } from "../../cd/physics/detent";
import { intentFor } from "../../cd/physics/keys";
import { mealsList, ingredientsById } from "../../data";
import { coverageForMeal } from "../../state/selectors";
import type { Inventory } from "../../state/types";
import {
  COVER_LAMPS,
  RING_ARC_DEG,
  RING_GAP_DEG,
  RING_RESERVE_DEG,
  SCALE_DETENTS,
  SCALE_MAX,
  SCALE_MIN,
  SCALE_STEP,
  WHEEL_PITCH_DEG,
  WHEEL_SEATS,
  atLimit,
  formatHouseholdHint,
  formatScale,
  formatStepDuration,
  mealHref,
  plateWeight,
  ringGeometry,
  ringRims,
  ringTracks,
  scaleForSeat,
  seatAngle,
  seatForScale,
  stockAtScale,
  stockZone,
  summonerFrom,
} from "./model";

/* ========================================================================== */
describe("the fence — MEAL never opens over COOK", () => {
  it("admits exactly the two screens the ruling names", () => {
    expect(summonerFrom("from=plan")).toBe("plan");
    expect(summonerFrom("from=today")).toBe("today");
  });

  it("refuses cook, in every form a hash can carry it", () => {
    for (const q of [
      "from=cook",
      "from=COOK",
      "from=Cook",
      "from=%63ook",
      "from=cook&t=abc",
      "t=abc&from=cook",
      "from=cook#/cook",
      "from=/cook",
      "from=cook ",
    ]) {
      expect(summonerFrom(q)).toBe("plan");
    }
  });

  it("refuses every other screen id and every malformed query", () => {
    for (const q of [
      "",
      "from=",
      "from=stores",
      "from=shop",
      "from=list",
      "from=meal",
      "t=eJyrVkrLz1eyUlAqSS0uUbJSKs7PBQBJmQaB",
      "fromage=plan",
      "xfrom=cook",
      "from",
    ]) {
      expect(summonerFrom(q)).toBe("plan");
    }
  });

  it("only ever matches its own key, never a suffix of another", () => {
    // "xfrom=today" must not be read as from=today
    expect(summonerFrom("xfrom=today")).toBe("plan");
    expect(summonerFrom("a=1&from=today")).toBe("today");
  });

  it("never builds a href that addresses cook", () => {
    for (const q of ["from=cook", "from=plan", "from=today", ""]) {
      const href = mealHref("a-d1d", summonerFrom(q));
      expect(href).toMatch(/^#\/meal\/a-d1d\?from=(plan|today)$/);
      expect(href).not.toContain("cook");
    }
  });
});

/* ========================================================================== */
describe("the wheel — 13 seats, clamped dead at both ends", () => {
  it("carries the contract range exactly", () => {
    expect(SCALE_DETENTS).toHaveLength(WHEEL_SEATS);
    expect(SCALE_DETENTS[0]).toBe(SCALE_MIN);
    expect(SCALE_DETENTS[WHEEL_SEATS - 1]).toBe(SCALE_MAX);
    for (let i = 1; i < SCALE_DETENTS.length; i++) {
      expect(SCALE_DETENTS[i] - SCALE_DETENTS[i - 1]).toBeCloseTo(SCALE_STEP, 10);
    }
  });

  it("round-trips every seat through its scale and back", () => {
    for (let seat = 0; seat < WHEEL_SEATS; seat++) {
      expect(seatForScale(scaleForSeat(seat))).toBe(seat);
    }
  });

  it("clamps dead outside the range rather than wrapping or extrapolating", () => {
    expect(scaleForSeat(-5)).toBe(SCALE_MIN);
    expect(scaleForSeat(99)).toBe(SCALE_MAX);
    expect(seatForScale(0.1)).toBe(0);
    expect(seatForScale(9)).toBe(WHEEL_SEATS - 1);
  });

  it("seats a float-damaged value rather than leaving it between wells", () => {
    // the shape a persisted scale can take after arithmetic elsewhere
    expect(seatForScale(0.7500000000001)).toBe(1);
    expect(seatForScale(1.0499999999)).toBe(7);
    expect(seatForScale(0.73)).toBe(1);
  });

  it("spans the 270deg sweep at the committed 22.5deg pitch", () => {
    expect(seatAngle(0)).toBe(-135);
    expect(seatAngle(WHEEL_SEATS - 1)).toBe(135);
    expect(seatAngle(1) - seatAngle(0)).toBe(WHEEL_PITCH_DEG);
    expect(seatAngle(WHEEL_SEATS - 1) - seatAngle(0)).toBe(270);
  });

  it("reports the hard stops and nothing between them", () => {
    expect(atLimit(0)).toBe("min");
    expect(atLimit(WHEEL_SEATS - 1)).toBe("max");
    for (let seat = 1; seat < WHEEL_SEATS - 1; seat++) expect(atLimit(seat)).toBeNull();
  });

  it("prints two decimals always — a portion is never 'x1.2'", () => {
    expect(formatScale(1.2)).toBe("1.20");
    expect(formatScale(0.7)).toBe("0.70");
    expect(formatScale(1)).toBe("1.00");
  });
});

/* ========================================================================== */
describe("keyboard and drag land on the identical value (II.3.4)", () => {
  const track = { seats: WHEEL_SEATS, pitch: WHEEL_PITCH_DEG };

  /** The component's own pointer map: 200px of vertical drag per full sweep. */
  function dragTo(seatAtGrab: number, deltaPx: number, seated: number): number {
    const travel =
      seatAtGrab * WHEEL_PITCH_DEG +
      (deltaPx / 200) * (WHEEL_PITCH_DEG * (WHEEL_SEATS - 1));
    return quantise(track, travel, seated);
  }

  /** The component's own key map. */
  function keyTo(seated: number, key: string, shiftKey = false): number {
    const intent = intentFor({ key, shiftKey });
    if (!intent) return seated;
    if (intent.kind === "step") return Math.min(WHEEL_SEATS - 1, Math.max(0, seated + intent.detents));
    if (intent.kind === "limit") return intent.edge === "min" ? 0 : WHEEL_SEATS - 1;
    return seated;
  }

  it("one arrow and one detent of drag produce the same seat, at every seat", () => {
    for (let seat = 0; seat < WHEEL_SEATS; seat++) {
      // one full pitch of travel = 200 / 12 px per seat
      const onePitchPx = 200 / (WHEEL_SEATS - 1);
      expect(dragTo(seat, onePitchPx, seat)).toBe(keyTo(seat, "ArrowUp"));
      expect(dragTo(seat, -onePitchPx, seat)).toBe(keyTo(seat, "ArrowDown"));
    }
  });

  it("Home and End reach the same limits a full-throw drag does", () => {
    expect(keyTo(6, "Home")).toBe(0);
    expect(keyTo(6, "End")).toBe(WHEEL_SEATS - 1);
    expect(dragTo(6, -400, 6)).toBe(0);
    expect(dragTo(6, 400, 6)).toBe(WHEEL_SEATS - 1);
  });

  it("PageUp and PageDown are ten detents, which on this track is the limit", () => {
    expect(keyTo(6, "PageUp")).toBe(WHEEL_SEATS - 1);
    expect(keyTo(6, "PageDown")).toBe(0);
  });

  it("fine keeps the same seats — it never invents a value between two wells", () => {
    // Shift is a gear on the pointer and a repeat suppressor on the keyboard;
    // in both cases the VALUE it can produce is a member of SCALE_DETENTS.
    for (let seat = 0; seat < WHEEL_SEATS; seat++) {
      const next = keyTo(seat, "ArrowUp", true);
      expect(SCALE_DETENTS).toContain(scaleForSeat(next));
    }
  });

  it("hysteresis stops a hand resting on a boundary from flapping", () => {
    // exactly on the midpoint between seat 6 and 7, the seated value holds
    const midpoint = 6.5 * WHEEL_PITCH_DEG;
    expect(quantise(track, midpoint, 6)).toBe(6);
    expect(quantise(track, midpoint, 7)).toBe(7);
  });
});

/* ========================================================================== */
describe("the cover ring — geometry, and one lamp lit", () => {
  it("accounts for exactly 360 degrees, with 24 reserved at the base", () => {
    const geo = ringGeometry();
    expect(geo.total).toBe(360);
    expect(RING_ARC_DEG * 2 + RING_GAP_DEG * 2 + RING_RESERVE_DEG).toBe(360);
    // the reserve is centred on the base — 180deg sits inside it
    expect(geo.reserveStart).toBeLessThan(180);
    expect(geo.reserveEnd).toBeGreaterThan(180);
    expect(geo.reserveEnd - geo.reserveStart).toBe(RING_RESERVE_DEG);
  });

  it("has one arc per real cover and no invented ones", () => {
    expect(COVER_LAMPS).toHaveLength(2);
    expect(COVER_LAMPS.map((l) => l.cover).sort()).toEqual(["m", "w"]);
    for (const lamp of COVER_LAMPS) {
      expect(lamp.sweepDeg).toBe(RING_ARC_DEG);
      expect(lamp.word).not.toBe("");
    }
  });

  it("lights exactly the active cover and holds the other at its dim print", () => {
    for (const cover of ["w", "m"] as const) {
      const { dim, lit, hue } = ringTracks(cover);
      const active = COVER_LAMPS.find((l) => l.cover === cover)!;
      const other = COVER_LAMPS.find((l) => l.cover !== cover)!;
      expect(hue).toBe(active.hue);
      expect(lit).toContain(active.hue);
      expect(lit).not.toContain(other.hue);
      // the dim track carries BOTH dim prints and NEITHER lit hue
      expect(dim).toContain(active.dim);
      expect(dim).toContain(other.dim);
      expect(dim).not.toContain(active.hue);
    }
  });

  it("prints both lens rims in both states — unlit is still a lamp", () => {
    const rims = ringRims();
    for (const lamp of COVER_LAMPS) expect(rims).toContain(lamp.rim);
  });

  it("never reports the portion scale — the ring's tracks do not move with it", () => {
    // ch.16 §9's named failure. The ring is a pure function of the cover, so
    // there is no argument through which a scale could reach it.
    expect(ringTracks("w")).toEqual(ringTracks("w"));
    expect(ringTracks.length).toBe(1);
  });
});

/* ========================================================================== */
describe("the stock meter — coverage moves with the portion", () => {
  const empty: Inventory = {};

  function full(mealId: string): Inventory {
    const meal = mealsList.find((m) => m.id === mealId)!;
    const inv: Inventory = {};
    for (const ingId of Object.keys(meal.covers.w))
      inv[ingId] = { level: 4, updatedAt: "2026-08-18T09:00:00.000Z" };
    return inv;
  }

  it("reads zero on an empty house and does not divide by zero on an empty plate", () => {
    const base = coverageForMeal(empty, "a-d1d", "w");
    expect(stockAtScale(base, 1).coverage).toBe(0);
    expect(stockAtScale({ mealId: "x", coverage: 1, byIngredient: [] }, 1.3).coverage).toBe(1);
  });

  it("falls as the portion rises, once anything is short", () => {
    const inv = full("a-d1d");
    // knock one ingredient down to a quarter so the plate can be short
    const first = Object.keys(inv)[0];
    inv[first] = { level: 1, updatedAt: "2026-08-18T09:00:00.000Z" };
    const base = coverageForMeal(inv, "a-d1d", "w");
    const low = stockAtScale(base, 0.7).coverage;
    const high = stockAtScale(base, 1.3).coverage;
    expect(high).toBeLessThanOrEqual(low);
  });

  it("caps each ingredient at its own need, so a surplus cannot mask a shortage", () => {
    const base = {
      mealId: "x",
      coverage: 0,
      byIngredient: [
        { ingId: "a", needG: 100, haveG: 10_000, ratio: 100 },
        { ingId: "b", needG: 100, haveG: 0, ratio: 0 },
      ],
    };
    expect(stockAtScale(base, 1).coverage).toBeCloseTo(0.5, 10);
  });

  it("counts the short ingredients at the portion actually committed", () => {
    const base = {
      mealId: "x",
      coverage: 0,
      byIngredient: [{ ingId: "a", needG: 100, haveG: 110, ratio: 1.1 }],
    };
    expect(stockAtScale(base, 1).short).toHaveLength(0);
    expect(stockAtScale(base, 1.3).short).toHaveLength(1);
  });

  it("keys its zones off the committed thresholds", () => {
    expect(stockZone(0)).toBe("short");
    expect(stockZone(0.59)).toBe("short");
    expect(stockZone(0.6)).toBe("partial");
    expect(stockZone(0.99)).toBe("partial");
    expect(stockZone(1)).toBe("covered");
  });
});

/* ========================================================================== */
describe("the plate — real data, at every legal portion", () => {
  it("fits four drum wheels for every meal, cover and seat in the dataset", () => {
    let widest = 0;
    for (const meal of mealsList) {
      for (const cover of ["w", "m"] as const) {
        for (let seat = 0; seat < WHEEL_SEATS; seat++) {
          const g = plateWeight(meal, cover, scaleForSeat(seat));
          expect(Number.isFinite(g)).toBe(true);
          expect(g).toBeGreaterThan(0);
          widest = Math.max(widest, g);
        }
      }
    }
    // the drum is cast with four wheels; this is the proof it never overflows
    expect(widest).toBeLessThan(10_000);
  });

  it("rounds the total once, not per ingredient", () => {
    const meal = mealsList.find((m) => m.id === "a-d1d")!;
    const exact = Object.values(meal.covers.w).reduce((a, b) => a + b * 1.15, 0);
    expect(plateWeight(meal, "w", 1.15)).toBe(Math.round(exact));
  });

  it("scales monotonically with the wheel", () => {
    const meal = mealsList.find((m) => m.id === "a-d1d")!;
    let last = 0;
    for (let seat = 0; seat < WHEEL_SEATS; seat++) {
      const g = plateWeight(meal, "w", scaleForSeat(seat));
      expect(g).toBeGreaterThanOrEqual(last);
      last = g;
    }
  });

  it("household hints stay approximations and never claim a unit they lack", () => {
    const withUnit = Object.values(ingredientsById).find((i) => i.spec.householdUnitG);
    expect(withUnit).toBeDefined();
    const unit = withUnit!.spec.householdUnitG!;
    expect(formatHouseholdHint(unit, withUnit!)).toContain(withUnit!.spec.unitSingular);
    expect(formatHouseholdHint(unit * 0.5, withUnit!)).toContain("½");
    expect(formatHouseholdHint(0, withUnit!)).toBeNull();

    const withoutUnit = Object.values(ingredientsById).find((i) => !i.spec.householdUnitG);
    if (withoutUnit) expect(formatHouseholdHint(100, withoutUnit)).toBeNull();
  });

  it("prints step durations in whole units and never rounds up into a lie", () => {
    expect(formatStepDuration(0.5)).toBe("30s");
    expect(formatStepDuration(1)).toBe("1m");
    expect(formatStepDuration(1.5)).toBe("1m 30s");
    expect(formatStepDuration(12)).toBe("12m");
  });
});
