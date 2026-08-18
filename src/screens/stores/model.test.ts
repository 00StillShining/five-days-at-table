/**
 * src/screens/stores/model.test.ts — the arithmetic behind every instrument.
 *
 * This file exists because `model.ts` decides where a needle points, what a
 * scale's zero is, and what the larder gauge's denominator means. Every one of
 * those is a claim about a real reading, and a claim nothing checks is a claim
 * waiting to drift.
 *
 * The cases below are the ones that actually bite on this screen, not the ones
 * that are easy to write:
 *   - a needle that must never sit ON the wall of the well it travels in
 *   - a fill that must not average in rows nobody has counted
 *   - a sweep that must not run when only the geometry changed
 *   - a life fraction that must be NULL rather than 0 when the question does
 *     not apply, because 0 is a claim and null is an absence
 *   - the five-seat wheel's own hysteresis, at the boundary where it matters
 */

import { describe, expect, it } from "vitest";
import { quantise } from "../../cd/physics/detent";
import { ingredientsById } from "../../data/ingredients";
import type { Ingredient } from "../../data/types";
import type { Inventory } from "../../state/types";
import { countdownForIngredient, countdownForUseBy, LEFTOVER_LIFE_DAYS } from "./countdown";
import { REGISTER_FLAT, REGISTER_GROUPS, LOCATION_GROUP_ORDER } from "./location";
import {
  censusOf,
  coveragePx,
  fillOf,
  latestStocktake,
  levelPx,
  lifePxOf,
  LEVEL_ANNOUNCE,
  LEVEL_GLYPH,
  LEVEL_WORD,
  POINTER_SLEW_PX_S,
  SLEW_FLOOR_MS,
  slewMs,
  sweepMs,
  WHEEL_SWEEP_DEG,
  WHEEL_TRACK,
} from "./model";

const ISO = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

describe("the register itself", () => {
  it("is the sixty-five non-freebie rows, and every one lands in exactly one group", () => {
    expect(REGISTER_FLAT.length).toBe(65);
    const grouped = LOCATION_GROUP_ORDER.flatMap((g) => REGISTER_GROUPS[g]);
    expect(grouped.length).toBe(REGISTER_FLAT.length);
    expect(new Set(grouped.map((i) => i.id)).size).toBe(65);
  });
});

describe("the level scale's seat geometry", () => {
  it("puts every seat at the centre of its printed division, never on a wall", () => {
    const w = 100;
    expect(levelPx(0, w)).toBeCloseTo(10, 6);
    expect(levelPx(4, w)).toBeCloseTo(90, 6);
    // the needle at zero is 10% in, not flush: a needle against the wall reads
    // as a broken instrument rather than as a zero
    expect(levelPx(0, w)).toBeGreaterThan(0);
    expect(levelPx(4, w)).toBeLessThan(w);
  });

  it("spaces the five seats evenly, one division apart", () => {
    const w = 100;
    const gaps = [1, 2, 3, 4].map((i) => levelPx(i, w) - levelPx(i - 1, w));
    for (const g of gaps) expect(g).toBeCloseTo(20, 6);
  });
});

describe("the continuous scales' 2px inset", () => {
  it("keeps a full reading inside the well rather than straddling its wall", () => {
    expect(coveragePx(0, 100)).toBe(2);
    expect(coveragePx(1, 100)).toBe(98);
    expect(lifePxOf(1, 64)).toBe(62);
  });

  it("clamps out-of-range input rather than travelling past the stop", () => {
    expect(coveragePx(-0.5, 100)).toBe(2);
    expect(coveragePx(1.5, 100)).toBe(98);
  });

  it("never returns a negative x on a channel narrower than the inset", () => {
    expect(coveragePx(0.5, 2)).toBeGreaterThanOrEqual(2);
  });
});

describe("sweep is a rate, and only a value change earns one", () => {
  it("derives the duration from the committed 340px/s, floored at 80ms", () => {
    expect(slewMs(0, 340)).toBeCloseTo(1000, 6);
    expect(slewMs(0, POINTER_SLEW_PX_S / 2)).toBeCloseTo(500, 6);
    expect(slewMs(0, 1)).toBe(SLEW_FLOOR_MS); // the floor, so the smallest move registers
    expect(slewMs(0, 0)).toBe(SLEW_FLOOR_MS);
  });

  it("relocates in ONE FRAME when only the geometry moved", () => {
    // the defect this exists to prevent: a first measurement swept the larder
    // gauge's needle 315px over 930ms with the reading unchanged
    expect(sweepMs(0, 315, false)).toBe(0);
    expect(sweepMs(0, 315, true)).toBeGreaterThan(SLEW_FLOOR_MS);
  });
});

describe("the fenestrated knob's own track", () => {
  it("is five seats at the chapter's 30 degree pitch over 120 degrees", () => {
    expect(WHEEL_TRACK.seats).toBe(5);
    expect(WHEEL_TRACK.pitch).toBe(30);
    expect(WHEEL_SWEEP_DEG).toBe(120);
  });

  it("holds the chapter's 12% hysteresis band", () => {
    expect(WHEEL_TRACK.band).toBeCloseTo(0.12, 6);
  });

  it("does not chatter at a seat boundary: forward commits at 56%, return at 44%", () => {
    // travel in degrees; seated at 1 (= 30deg)
    const justUnderCommit = 30 + 30 * 0.55;
    const justOverCommit = 30 + 30 * 0.57;
    expect(quantise(WHEEL_TRACK, justUnderCommit, 1)).toBe(1);
    expect(quantise(WHEEL_TRACK, justOverCommit, 1)).toBe(2);
    // coming back down from seat 2, the boundary has moved behind you
    expect(quantise(WHEEL_TRACK, justOverCommit, 2)).toBe(2);
    expect(quantise(WHEEL_TRACK, 30 + 30 * 0.43, 2)).toBe(1);
  });

  it("stops dead at both ends rather than wrapping", () => {
    expect(quantise(WHEEL_TRACK, -500, 0)).toBe(0);
    expect(quantise(WHEEL_TRACK, 5000, 4)).toBe(4);
  });

  it("keeps one word, one glyph and one spoken form per seat, in step", () => {
    expect(LEVEL_WORD).toHaveLength(5);
    expect(LEVEL_GLYPH).toHaveLength(5);
    expect(LEVEL_ANNOUNCE).toHaveLength(5);
    // the window carries a FIGURE because it is "no wider than the digit it
    // shows"; the plate carries the WORD. They are not the same string.
    expect(LEVEL_GLYPH[0]).not.toBe(LEVEL_WORD[0]);
  });
});

describe("the larder's fill", () => {
  const rows: Ingredient[] = REGISTER_FLAT.slice(0, 4);

  it("averages over COUNTED rows only — an uncounted row is absent, not zero", () => {
    const inv: Inventory = {
      [rows[0]!.id]: { level: 4, updatedAt: ISO(0) },
      [rows[1]!.id]: { level: 4, updatedAt: ISO(0) },
    };
    const fill = fillOf(rows, inv);
    // two full rows out of two COUNTED is 100%, not 50% of four
    expect(fill.fraction).toBeCloseTo(1, 6);
    expect(fill.counted).toBe(2);
    expect(fill.total).toBe(4);
  });

  it("reports zero fill, not NaN, when nothing has been counted at all", () => {
    const fill = fillOf(rows, {});
    expect(fill.fraction).toBe(0);
    expect(fill.counted).toBe(0);
    expect(Number.isNaN(fill.fraction)).toBe(false);
  });

  it("counts `low` as at-or-below a quarter, and `stocked` as above empty", () => {
    const inv: Inventory = {
      [rows[0]!.id]: { level: 0, updatedAt: ISO(0) },
      [rows[1]!.id]: { level: 1, updatedAt: ISO(0) },
      [rows[2]!.id]: { level: 2, updatedAt: ISO(0) },
    };
    const fill = fillOf(rows, inv);
    expect(fill.low).toBe(2); // levels 0 and 1
    expect(fill.stocked).toBe(2); // levels 1 and 2
  });

  it("finds the newest stocktake across a set, and null when there is none", () => {
    const older = ISO(10 * 3600_000);
    const newer = ISO(1 * 3600_000);
    const inv: Inventory = {
      [rows[0]!.id]: { level: 1, updatedAt: older },
      [rows[1]!.id]: { level: 1, updatedAt: newer },
    };
    expect(latestStocktake(rows, inv)).toBe(newer);
    expect(latestStocktake(rows, {})).toBeNull();
  });
});

describe("the countdown's life fraction", () => {
  const now = new Date();

  it("is NULL, never 0, for a row that was never stocked", () => {
    const ing = REGISTER_FLAT[0]!;
    const c = countdownForIngredient(ing, undefined, now);
    expect(c.status).toBe("empty");
    expect(c.fraction).toBeNull(); // an absence, not a claim of "no life left"
  });

  it("is NULL for stock still in the freezer, which has no countdown yet", () => {
    const frozen = REGISTER_FLAT.find((i) => {
      const c = countdownForIngredient(i, { level: 3, updatedAt: ISO(0) }, now);
      return c.status === "frozen";
    });
    expect(frozen).toBeDefined();
    const c = countdownForIngredient(frozen!, { level: 3, updatedAt: ISO(0) }, now);
    expect(c.fraction).toBeNull();
  });

  it("reads ~1 on a freshly counted fresh row and drops as the life is spent", () => {
    const fresh = REGISTER_FLAT.find((i) => {
      const c = countdownForIngredient(i, { level: 3, updatedAt: ISO(0) }, now);
      return c.status === "ok" && c.fraction !== null;
    });
    expect(fresh).toBeDefined();
    const full = countdownForIngredient(fresh!, { level: 3, updatedAt: ISO(0) }, now);
    const spent = countdownForIngredient(fresh!, { level: 3, updatedAt: ISO(2 * 86_400_000) }, now);
    expect(full.fraction!).toBeGreaterThan(spent.fraction!);
    expect(full.fraction!).toBeLessThanOrEqual(1);
    expect(spent.fraction!).toBeGreaterThanOrEqual(0);
  });

  it("measures a leftover against the window logDinner actually stamped on it", () => {
    const useBy = new Date(Date.now() + LEFTOVER_LIFE_DAYS * 86_400_000).toISOString().slice(0, 10);
    const c = countdownForUseBy(useBy, now);
    expect(c.fraction).not.toBeNull();
    expect(c.fraction!).toBeGreaterThan(0.9);
    expect(c.fraction!).toBeLessThanOrEqual(1);
  });
});

describe("the census the annunciator and the gauge share", () => {
  const now = new Date();
  const countdownFor = (ing: Ingredient, entry: Inventory[string] | undefined) =>
    countdownForIngredient(ing, entry, now);

  it("counts every uncounted row as absent rather than as an empty one", () => {
    const c = censusOf({}, countdownFor);
    expect(c.uncounted).toBe(65);
    expect(c.low).toBe(0); // nothing is LOW, because nothing has been read
    expect(c.alerts).toEqual([]);
  });

  it("names every alert, expired before expiring, so the strip and the arbiter agree", () => {
    // the shortest-lived fresh row, stamped one whole life ago plus a day
    const target = REGISTER_FLAT.find((i) => {
      const c = countdownForIngredient(i, { level: 2, updatedAt: ISO(400 * 86_400_000) }, now);
      return c.status === "expired";
    });
    expect(target).toBeDefined();
    const inv: Inventory = { [target!.id]: { level: 2, updatedAt: ISO(400 * 86_400_000) } };
    const c = censusOf(inv, countdownFor);
    expect(c.expired).toBeGreaterThanOrEqual(1);
    expect(c.alerts[0]!.status).toBe("expired");
    expect(c.alerts[0]!.name).toBe(ingredientsById[target!.id]!.name.short);
    // every expired alert sorts ahead of every expiring one
    const firstExpiring = c.alerts.findIndex((a) => a.status === "expiring");
    const lastExpired = c.alerts.map((a) => a.status).lastIndexOf("expired");
    if (firstExpiring >= 0) expect(lastExpired).toBeLessThan(firstExpiring);
  });

  it("agrees with fillOf about how many rows are low", () => {
    const rows = REGISTER_FLAT.slice(0, 6);
    const inv: Inventory = {};
    rows.forEach((r, i) => {
      inv[r.id] = { level: (i % 5) as 0 | 1 | 2 | 3 | 4, updatedAt: ISO(0) };
    });
    expect(censusOf(inv, countdownFor).low).toBe(fillOf(REGISTER_FLAT, inv).low);
  });
});
