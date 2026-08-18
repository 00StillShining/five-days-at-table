/**
 * src/screens/shop/model.test.ts — SHOP's arithmetic, against the real dataset.
 *
 * Every figure asserted below was MEASURED off the shipped data on 2026-08-18,
 * not chosen: the full day-0 trip is 44 lines at £170.44 against an uncounted
 * shelf, the day-7 top-up is 7 lines at £11.03, and the morrisons-tester basket
 * is 39 lines at £69.83. CD-BRIEF: "Real data is the design input, not the edge
 * case."
 *
 * The tests that matter most here are the ones about what "costed" MEANS, because
 * the flush-check, the seam and the whole Signature are downstream of that one
 * predicate. A screen whose ring lies is a screen whose Signature is decoration.
 */

import { describe, expect, it } from "vitest";
import { tripBuild } from "../../state/selectors";
import { activeVariant, FULL_VARIANT } from "../../data/variant";
import { ingredientsById } from "../../data";
import type { PriceChecks } from "../../state/types";
import { effectiveLines, buyLinesForShop, SHOP_ORDER } from "./tripHelpers";
import {
  BREAK_MAX_DEG,
  FIGURE_SPACE,
  TRACK_SLEW_FLOOR_MS,
  aisleGroups,
  census,
  costReading,
  horizonComplete,
  isLocked,
  kindLabel,
  lidOrder,
  money,
  omissions,
  positionOf,
  ringError,
  uncostedLines,
  seamBreak,
  sheetVerifiedOn,
  signedMoney,
  trackIndices,
  trackSweepMs,
  type CostContext,
} from "./model";

/** 2026-08-18, the day this build was measured. */
const NOW = Date.parse("2026-08-18T09:00:00Z");
const NO_CHECKS: PriceChecks = {};
const CTX: CostContext = { priceChecks: NO_CHECKS, now: NOW, basketVerifiedOn: null };

function fullTrip(checks: PriceChecks = NO_CHECKS) {
  const trip = tripBuild({}, 0, {}, FULL_VARIANT);
  return { trip, lines: effectiveLines(trip, new Set()), ctx: { ...CTX, priceChecks: checks } };
}

const TESTER = activeVariant({ prefs: { planVariant: "morrisons-tester" } });

describe("the real trip, measured", () => {
  it("the full day-0 shop is 44 lines at £170.44 across three retailers", () => {
    const { lines, ctx } = fullTrip();
    const c = census(lines, ctx);
    expect(c.lines).toBe(44);
    expect(money(c.total)).toBe("170.44");
    const counts = SHOP_ORDER.map((s) => buyLinesForShop(lines, s).length);
    expect(counts).toEqual([28, 15, 1]);
  });

  it("the day-7 top-up is 7 lines at £11.03", () => {
    const trip = tripBuild({}, 7, {}, FULL_VARIANT);
    const lines = effectiveLines(trip, new Set());
    const c = census(lines, CTX);
    expect(c.lines).toBe(7);
    expect(money(c.total)).toBe("11.03");
  });

  it("the tester basket is 39 lines at £69.83, one retailer, nothing to verify", () => {
    const trip = tripBuild({}, 0, {}, TESTER);
    const lines = effectiveLines(trip, new Set());
    const ctx: CostContext = { ...CTX, basketVerifiedOn: TESTER.basket!.verifiedOn };
    const c = census(lines, ctx);
    expect(c.lines).toBe(39);
    expect(money(c.total)).toBe("69.83");
    expect(trip.verifyNominees).toEqual([]);
    expect(buyLinesForShop(lines, "M").length).toBe(39);
    expect(buyLinesForShop(lines, "S").length).toBe(0);
  });
});

describe("what costed means", () => {
  it("a SKU verified inside the 14-day threshold reads true", () => {
    const { lines, ctx } = fullTrip();
    const verified = lines.find((l) => ingredientsById[l.line.ingId]?.sku?.verifiedOn && !l.line.estimate)!;
    const r = costReading(verified, ctx);
    expect(r.cls).toBe("verified");
    expect(r.costed).toBe(true);
    expect(r.word).toBe("VERIFIED");
  });

  it("a SKU that was never verified reads NEVER, not an age of zero", () => {
    const { lines, ctx } = fullTrip();
    const never = lines.find(
      (l) => !ingredientsById[l.line.ingId]?.sku?.verifiedOn && !l.line.estimate
    )!;
    const r = costReading(never, ctx);
    expect(r.cls).toBe("unverified");
    expect(r.costed).toBe(false);
    expect(r.age.ms).toBeNull();
    expect(r.age.label).toBe("never");
  });

  it("an estimate is never costed, whatever its age", () => {
    const { lines, ctx } = fullTrip();
    const est = lines.filter((l) => l.line.estimate);
    expect(est.length).toBe(9);
    for (const el of est) {
      const r = costReading(el, ctx);
      expect(r.cls).toBe("estimate");
      expect(r.costed).toBe(false);
    }
  });

  it("the SAME price goes stale one day past the declared 14-day threshold", () => {
    const { lines } = fullTrip();
    const verified = lines.find((l) => ingredientsById[l.line.ingId]?.sku?.verifiedOn && !l.line.estimate)!;
    const on = ingredientsById[verified.line.ingId]!.sku!.verifiedOn!;
    const day13 = Date.parse(on) + 13 * 86_400_000;
    const day15 = Date.parse(on) + 15 * 86_400_000;
    expect(costReading(verified, { ...CTX, now: day13 }).cls).toBe("verified");
    const stale = costReading(verified, { ...CTX, now: day15 });
    expect(stale.cls).toBe("stale");
    expect(stale.costed).toBe(false);
    expect(stale.word).toBe("UNPRICED");
    /* II.3.18 — the VALUE HOLDS. A stale reading still prints its figure. */
    expect(stale.lineTotal).toBeGreaterThan(0);
  });

  it("a typed-back check outranks the sheet, prints its signed delta, and costs true", () => {
    const { lines } = fullTrip();
    const target = lines.find((l) => l.line.estimate)!;
    const checks: PriceChecks = {
      [target.line.ingId]: { price: target.line.price + 0.4, on: "2026-08-18" },
    };
    const r = costReading(target, { ...CTX, priceChecks: checks });
    expect(r.cls).toBe("checked");
    expect(r.costed).toBe(true);
    expect(r.delta).toBeCloseTo(0.4, 2);
    expect(r.unitPrice).toBeCloseTo(target.line.price + 0.4, 2);
  });

  it("the tester's basket date rules its lines, not the canonical SKU's", () => {
    const trip = tripBuild({}, 0, {}, TESTER);
    const lines = effectiveLines(trip, new Set());
    const bare = census(lines, CTX);
    const receipt = census(lines, { ...CTX, basketVerifiedOn: TESTER.basket!.verifiedOn });
    /* Judged on the canonical SKUs the receipt would read part-unpriced, which
       is a fact about a different product string. Judged on its own date every
       line is verified — which is what VARIANT-SPEC states it is. */
    expect(bare.uncosted).toBeGreaterThan(0);
    expect(receipt.costed).toBe(39);
    expect(receipt.uncosted).toBe(0);
    expect(receipt.estimates).toBe(0);
  });
});

describe("the flush-check reports a live error", () => {
  it("zero uncosted is zero error and reads locked", () => {
    expect(ringError(12, 12)).toBe(0);
    expect(isLocked(ringError(12, 12))).toBe(true);
  });

  it("every line uncosted spends the whole legal break", () => {
    expect(ringError(0, 12)).toBe(BREAK_MAX_DEG);
    expect(isLocked(ringError(0, 12))).toBe(false);
  });

  it("the error is graded by the share still uncosted", () => {
    expect(ringError(6, 12)).toBeCloseTo(BREAK_MAX_DEG / 2, 6);
    expect(ringError(11, 12)).toBeCloseTo(BREAK_MAX_DEG / 12, 6);
  });

  it("an empty set is NOT TRUE — there is nothing to be true about", () => {
    expect(isLocked(ringError(0, 0))).toBe(false);
  });
});

describe("the recovery the freshness layer promises is a real one", () => {
  it("the pad holds EVERY line without a current price, not just the nominees", () => {
    const { trip, lines, ctx } = fullTrip();
    const rows = uncostedLines(lines, ctx, trip.verifyNominees);
    const c = census(lines, ctx);
    expect(rows.length).toBe(c.uncosted);
    expect(rows.length).toBe(24);
    /* The arbiter nominates three. A pad holding only those could not fix a
       sheet that went stale across the other twenty-one. */
    expect(trip.verifyNominees.length).toBe(3);
    expect(rows.length).toBeGreaterThan(trip.verifyNominees.length);
  });

  it("nominees are offered first, and the trip's own order survives inside each half", () => {
    const { trip, lines, ctx } = fullTrip();
    const rows = uncostedLines(lines, ctx, trip.verifyNominees);
    const nominated = rows.filter((r) => r.nominated);
    expect(nominated.length).toBe(3);
    expect(rows.slice(0, 3).every((r) => r.nominated)).toBe(true);
    const rest = rows.slice(3).map((r) => r.el.line.ingId);
    const inTripOrder = lines
      .filter((el) => !el.isDedupe && el.effectivePacks > 0)
      .map((el) => el.line.ingId)
      .filter((id) => rest.includes(id));
    expect(rest).toEqual(inTripOrder);
  });

  it("a costed line never appears in the pad, and typing a price removes it", () => {
    const { trip, lines, ctx } = fullTrip();
    const first = uncostedLines(lines, ctx, trip.verifyNominees)[0];
    const checks: PriceChecks = {
      [first.el.line.ingId]: { price: 1.23, on: "2026-08-18" },
    };
    const after = uncostedLines(lines, { ...ctx, priceChecks: checks }, trip.verifyNominees);
    expect(after.map((r) => r.el.line.ingId)).not.toContain(first.el.line.ingId);
    expect(after.length).toBe(23);
  });

  it("on the tester's verified receipt the pad is empty and the ring reads true", () => {
    const trip = tripBuild({}, 0, {}, TESTER);
    const lines = effectiveLines(trip, new Set());
    const ctx: CostContext = { ...CTX, basketVerifiedOn: TESTER.basket!.verifiedOn };
    expect(uncostedLines(lines, ctx, trip.verifyNominees)).toEqual([]);
    const c = census(lines, ctx);
    expect(isLocked(ringError(c.costed, c.lines))).toBe(true);
  });
});

describe("the Signature fires on a real condition and un-fires on drift", () => {
  it("the full trip does NOT close its horizon out of the box", () => {
    const { lines, ctx } = fullTrip();
    const c = census(lines, ctx);
    expect(c.costed).toBe(20);
    expect(c.uncosted).toBe(24);
    expect(horizonComplete(c)).toBe(false);
    expect(seamBreak(c)).toBeCloseTo(24 / 44, 6);
  });

  it("checking every uncosted line closes it", () => {
    const { lines } = fullTrip();
    const checks: PriceChecks = {};
    for (const el of lines) {
      if (!costReading(el, CTX).costed) {
        checks[el.line.ingId] = { price: el.line.price, on: "2026-08-18" };
      }
    }
    const c = census(lines, { ...CTX, priceChecks: checks });
    expect(c.uncosted).toBe(0);
    expect(horizonComplete(c)).toBe(true);
    expect(seamBreak(c)).toBe(0);
  });

  it("one line drifting past the threshold re-opens it", () => {
    const { lines } = fullTrip();
    const checks: PriceChecks = {};
    for (const el of lines) {
      if (!costReading(el, CTX).costed) checks[el.line.ingId] = { price: el.line.price, on: "2026-08-04" };
    }
    /* Fifteen days after those checks, the ones that were typed have expired. */
    const later = Date.parse("2026-08-19T09:00:00Z") + 15 * 86_400_000;
    const c = census(lines, { ...CTX, priceChecks: checks, now: later });
    expect(c.uncosted).toBeGreaterThan(0);
    expect(horizonComplete(c)).toBe(false);
  });

  it("an EMPTY basket is absence, not agreement", () => {
    const c = census([], CTX);
    expect(c.lines).toBe(0);
    expect(horizonComplete(c)).toBe(false);
    expect(seamBreak(c)).toBe(1);
  });
});

describe("the cost track reports position, never area", () => {
  it("indices are cumulative and the last one lands exactly on the total", () => {
    const { lines, ctx } = fullTrip();
    const cols = SHOP_ORDER.map((code) => {
      const rows = buyLinesForShop(lines, code);
      const groups = aisleGroups(rows, code, ctx);
      return {
        code,
        displayName: code,
        subtotal: groups.reduce((s, g) => s + g.subtotal, 0),
        lines: rows.length,
      };
    });
    const marks = trackIndices(cols);
    expect(marks.map((m) => m.seat)).toEqual(["mor", "sai", "mkt"]);
    expect(marks[marks.length - 1].pct).toBeCloseTo(100, 6);
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i].pct).toBeGreaterThan(marks[i - 1].pct);
    }
    expect(money(marks.reduce((s, m) => s + m.subtotal, 0))).toBe("170.44");
  });

  it("an all-zero trip does not divide by zero", () => {
    expect(trackIndices([{ code: "M", displayName: "m", subtotal: 0, lines: 0 }])[0].pct).toBe(0);
  });

  it("sweep duration is DERIVED from distance and floored, never chosen", () => {
    expect(trackSweepMs(0, 0)).toBe(TRACK_SLEW_FLOOR_MS);
    expect(trackSweepMs(0, 10)).toBe(TRACK_SLEW_FLOOR_MS); // 45ms raw, floored
    expect(trackSweepMs(0, 100)).toBeCloseTo((100 / 220) * 1000, 6);
    /* A long travel takes proportionally longer than a short one — it never
       races to match it (II.4.8). */
    expect(trackSweepMs(0, 100)).toBeGreaterThan(trackSweepMs(0, 50));
  });
});

describe("the register, and R7's confession", () => {
  it("groups the seated station by aisle in the trip's own order", () => {
    const { lines, ctx } = fullTrip();
    const groups = aisleGroups(buyLinesForShop(lines, "M"), "M", ctx);
    expect(groups.map((g) => [g.aisle, g.rows.length])).toEqual([
      ["Dairy & chilled", 1],
      ["Cupboard", 13],
      ["Protein counter", 1],
      ["Produce", 12],
      ["Freezer", 1],
    ]);
    expect(groups.reduce((n, g) => n + g.rows.length, 0)).toBe(28);
  });

  it("a group's subtotal is the sum of the figures its rows actually print", () => {
    const { lines, ctx } = fullTrip();
    for (const group of aisleGroups(buyLinesForShop(lines, "M"), "M", ctx)) {
      const sum = group.rows.reduce((s, el) => s + costReading(el, ctx).lineTotal, 0);
      expect(money(group.subtotal)).toBe(money(sum));
    }
  });

  it("the position readout locates the open lid inside the whole trip", () => {
    const { lines, ctx } = fullTrip();
    const cols = SHOP_ORDER.map((code) => ({
      code,
      groups: aisleGroups(buyLinesForShop(lines, code), code, ctx),
    })).filter((c) => c.groups.length > 0);

    const all = positionOf(cols, null);
    expect(all.total).toBe(44);
    expect(all.span).toBe(0);

    const first = positionOf(cols, cols[0].groups[0].id);
    expect(first.first).toBe(1);
    expect(first.pct).toBe(0);

    const second = positionOf(cols, cols[0].groups[1].id);
    expect(second.first).toBe(2);
    expect(second.span).toBe(13);
    expect(second.pct).toBeCloseTo((1 / 44) * 100, 6);
  });

  it("the cueing cluster's lid order walks every station in trip order", () => {
    const { lines, ctx } = fullTrip();
    const cols = SHOP_ORDER.map((code) => ({
      code,
      groups: aisleGroups(buyLinesForShop(lines, code), code, ctx),
    })).filter((c) => c.groups.length > 0);
    const order = lidOrder(cols);
    expect(order.length).toBe(cols.reduce((n, c) => n + c.groups.length, 0));
    expect(order[0].code).toBe("M");
    expect(order[order.length - 1].code).toBe("X");
  });
});

describe("honesty", () => {
  it("the omission confession is measured from the dataset, never typed", () => {
    const o = omissions();
    expect(o.pantry.length).toBe(6);
    expect(o.freebies).toBe(32);
    expect(o.pantry).toContain("Chia seeds");
  });

  it("the price sheet's date is read off the basket, not asserted", () => {
    const { lines } = fullTrip();
    expect(sheetVerifiedOn(lines)).toBe("2026-08-11");
    expect(sheetVerifiedOn(lines, "2026-01-01")).toBe("2026-01-01");
    expect(sheetVerifiedOn([])).toBeNull();
  });

  it("the sign is always printed and the blank slot holds a figure space", () => {
    expect(signedMoney(1.5)).toBe("+1.50");
    expect(signedMoney(-1.5)).toBe("-1.50");
    expect(signedMoney(0)).toBe(`${FIGURE_SPACE}0.00`);
    expect(FIGURE_SPACE).toBe("\u2007"); // the figure space, not a word space
    /* II.6.5 — signed and unsigned readings hold one grid. */
    expect(signedMoney(0).length).toBe(signedMoney(1.5).length);
  });

  it("money always prints two decimals so the column never reflows", () => {
    expect(money(7)).toBe("7.00");
    expect(money(170.4)).toBe("170.40");
  });

  it("names the trip it is actually showing", () => {
    expect(kindLabel(0, false)).toBe("full shop");
    expect(kindLabel(7, false)).toBe("day-7 top-up");
    expect(kindLabel(0, true)).toBe("morrisons starter");
  });
});
