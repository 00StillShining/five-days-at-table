/**
 * src/screens/list/model.test.ts — LIST's arithmetic, against the real trip.
 *
 * Every fixture below is BUILT, not typed: `tripBuild` over the frozen dataset
 * through SHOP's own envelope builder, which is the exact path a real trip takes
 * from the desk to this screen. CD-BRIEF's real-data test — "the 49-line basket,
 * the tester variant, an expired item, an empty state" — is only a test if the
 * data is the data.
 */

import { describe, expect, it } from "vitest";
import { defaultState } from "../../state/reducer";
import { tripBuild } from "../../state/selectors";
import { activeVariant } from "../../data/variant";
import type { AppState, ShopTicks } from "../../state/types";
import { buildEnvelope, effectiveLines } from "../shop/tripHelpers";
import type { TripEnvelope } from "../../engine/tripCodec";
import {
  RUNOUT_MS,
  activeVerifyIngId,
  aisleGroups,
  allRows,
  boughtRows,
  formatMoney,
  formatPence,
  formatQty,
  owedCount,
  rowState,
  stationsOf,
  tillReading,
} from "./model";
import { LID_PX, OVERFLOW_PX, ROW_PX, budgetFor } from "./useRowBudget";

function envelopeFor(planVariant: "full" | "morrisons-tester", day: 0 | 7): TripEnvelope {
  const state = { ...defaultState, prefs: { ...defaultState.prefs, planVariant } } as AppState;
  const variant = activeVariant(state);
  const trip = tripBuild(state.inventory, day, state.swaps, variant);
  const lines = effectiveLines(trip, new Set());
  return buildEnvelope(
    `t-${planVariant}-${day}`,
    "2026-08-18T09:12:00.000Z",
    day === 0 ? "full" : "day7",
    lines,
    trip.verifyNominees
  );
}

const FULL = envelopeFor("full", 0);
const TESTER = envelopeFor("morrisons-tester", 0);
const DAY7 = envelopeFor("full", 7);

function ticksOf(...ingIds: string[]): ShopTicks[string] {
  const out: ShopTicks[string] = {};
  ingIds.forEach((id, i) => {
    out[id] = { at: `2026-08-18T10:0${i}:00.000Z` };
  });
  return out;
}

describe("the real trip, as LIST receives it", () => {
  it("the full day-0 shop is a costed multi-station trip", () => {
    expect(allRows(FULL).length).toBeGreaterThan(30);
    expect(FULL.shops.length).toBe(3);
    expect(FULL.totals.overall).toBeGreaterThan(100);
  });

  it("the tester arrives through the same codec, one station, every price fixed", () => {
    expect(TESTER.shops.length).toBe(1);
    expect(TESTER.shops[0].code).toBe("M");
    expect(allRows(TESTER).every((r) => !r.estimate)).toBe(true);
    expect(activeVerifyIngId(TESTER, {})).toBeNull();
  });

  it("the day-7 top-up is the small trip and still groups", () => {
    expect(allRows(DAY7).length).toBeGreaterThan(0);
    expect(aisleGroups(stationsOf(DAY7)[0], undefined, new Set()).length).toBeGreaterThan(0);
  });
});

describe("stations", () => {
  it("gives one seat per shop, in trip order, never a wrap", () => {
    const stations = stationsOf(FULL);
    expect(stations.map((s) => s.code)).toEqual(FULL.shops.map((s) => s.code));
    expect(stations.map((s) => s.seat)).toEqual(["mor", "sai", "mkt"]);
  });

  it("counts what a station still owes, so a cleared seat can say so", () => {
    const station = stationsOf(FULL)[0];
    const first = station.rows[0].ingId;
    expect(owedCount(station, undefined)).toBe(station.rows.length);
    expect(owedCount(station, ticksOf(first))).toBe(station.rows.length - 1);
  });
});

describe("every healthy station is simply not rendered", () => {
  it("drops a bought row from its aisle once its window has closed", () => {
    const station = stationsOf(FULL)[0];
    const target = station.rows[0];
    const before = aisleGroups(station, undefined, new Set());
    const after = aisleGroups(station, ticksOf(target.ingId), new Set());
    const beforeCount = before.reduce((n, g) => n + g.owed.length, 0);
    const afterCount = after.reduce((n, g) => n + g.owed.length, 0);
    expect(afterCount).toBe(beforeCount - 1);
  });

  it("KEEPS a bought row while its run-out window is still open", () => {
    const station = stationsOf(FULL)[0];
    const target = station.rows[0];
    const inFlight = new Set([target.ingId]);
    const groups = aisleGroups(station, ticksOf(target.ingId), inFlight);
    expect(groups.some((g) => g.owed.some((r) => r.ingId === target.ingId))).toBe(true);
  });

  it("drops an aisle entirely once nothing in it is owed", () => {
    const station = stationsOf(FULL)[0];
    const groups = aisleGroups(station, undefined, new Set());
    const single = groups.find((g) => g.owed.length === 1);
    expect(single).toBeDefined();
    const after = aisleGroups(station, ticksOf(single!.owed[0].ingId), new Set());
    expect(after.some((g) => g.id === single!.id)).toBe(false);
  });

  it("collects bought rows trip-wide, newest first, for the put-back lid", () => {
    const rows = allRows(FULL);
    const ticks = ticksOf(rows[0].ingId, rows[1].ingId, rows[2].ingId);
    const bought = boughtRows(FULL, ticks, new Set());
    expect(bought.map((r) => r.ingId)).toEqual([rows[2].ingId, rows[1].ingId, rows[0].ingId]);
  });
});

describe("the till", () => {
  it("reads zero against a real plan before anything is picked up", () => {
    const reading = tillReading(FULL, undefined, {});
    expect(reading.spentP).toBe(0);
    expect(reading.got).toBe(0);
    expect(reading.total).toBe(allRows(FULL).length);
    expect(reading.plannedP).toBeGreaterThan(0);
    expect(reading.fill).toBe(0);
    expect(reading.overP).toBe(0);
  });

  it("counts packs, not lines: a row of three costs three", () => {
    const multi = allRows(FULL).find((r) => r.qty > 1)!;
    const reading = tillReading(FULL, ticksOf(multi.ingId), {});
    expect(reading.spentP).toBe(Math.round(multi.price * multi.qty * 100));
  });

  it("lets a verified shelf price supersede the planned one, in both directions", () => {
    const row = allRows(FULL)[0];
    const dearer = tillReading(FULL, ticksOf(row.ingId), { [row.ingId]: { price: row.price + 5, on: "2026-08-18" } });
    const cheaper = tillReading(FULL, ticksOf(row.ingId), { [row.ingId]: { price: 0.01, on: "2026-08-18" } });
    expect(dearer.spentP).toBe(Math.round((row.price + 5) * row.qty * 100));
    expect(cheaper.spentP).toBe(row.qty);
  });

  it("reports an over-run exactly, never a rounded one", () => {
    const rows = allRows(FULL);
    const checks = Object.fromEntries(rows.map((r) => [r.ingId, { price: r.price * 2, on: "2026-08-18" }]));
    const all = Object.fromEntries(rows.map((r) => [r.ingId, { at: "2026-08-18T10:00:00.000Z" }]));
    const reading = tillReading(FULL, all, checks);
    expect(reading.overP).toBe(reading.spentP - reading.plannedP);
    expect(reading.overP).toBeGreaterThan(0);
    expect(reading.fill).toBe(1); // clamped: a column cannot be more than full
  });

  it("holds integer pence across every line — no float drift on 44 ticks", () => {
    const all = Object.fromEntries(allRows(FULL).map((r) => [r.ingId, { at: "2026-08-18T10:00:00.000Z" }]));
    const reading = tillReading(FULL, all, {});
    expect(Number.isInteger(reading.spentP)).toBe(true);
    expect(reading.spentP).toBe(reading.plannedP);
  });
});

describe("printing", () => {
  it("never invents a digit that is not in the number", () => {
    expect(formatPence(0)).toBe("£0.00");
    expect(formatPence(85)).toBe("£0.85");
    expect(formatPence(17044)).toBe("£170.44");
    expect(formatPence(100000)).toBe("£1000.00"); // grows, never truncates
  });

  it("prints a line's own money plainly", () => {
    expect(formatMoney(630)).toBe("£6.30");
    expect(formatMoney(0)).toBe("£0.00");
  });

  it("shows one pack as its size and many packs as a count", () => {
    expect(formatQty(1, 1000)).toBe("1kg");
    expect(formatQty(4, 400)).toBe("× 4");
  });
});

describe("the state chip", () => {
  it("ranks checked over verify over estimate", () => {
    const row = { ...allRows(FULL)[0], estimate: true, verify: true };
    expect(rowState(row, {}, row.ingId)).toBe("verify");
    expect(rowState(row, {}, null)).toBe("estimate");
    expect(rowState(row, { [row.ingId]: { price: 1, on: "2026-08-18" } }, row.ingId)).toBe("checked");
  });

  it("nominates exactly one verify row, deterministically, in trip order", () => {
    const first = activeVerifyIngId(FULL, {});
    expect(first).not.toBeNull();
    expect(activeVerifyIngId(FULL, {})).toBe(first);
    const next = activeVerifyIngId(FULL, { [first!]: { price: 1, on: "2026-08-18" } });
    expect(next).not.toBe(first);
  });
});

describe("R7's two clips, solved together", () => {
  it("never lets the lid column and the row list overrun the bay", () => {
    for (const bay of [200, 265, 362, 500, 900]) {
      for (const groups of [1, 3, 5, 6, 10]) {
        for (const openRows of [1, 3, 13]) {
          const b = budgetFor(bay, groups, openRows);
          const confession = b.lids < groups ? OVERFLOW_PX : 0;
          const used = b.lids * LID_PX + b.rows * ROW_PX + OVERFLOW_PX + confession;
          // one row is the floor whatever the viewport, so a very short bay may
          // exceed by that single row and nothing more
          expect(used - (b.rows === 1 ? ROW_PX : 0)).toBeLessThanOrEqual(bay + LID_PX);
          expect(b.lids).toBeGreaterThanOrEqual(1);
          expect(b.rows).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("reserves only what the open lid can use", () => {
    // one row open: the lids get everything left over
    expect(budgetFor(500, 6, 1).lids).toBe(6);
    // thirteen rows open: lids give way so the rows are worth showing
    expect(budgetFor(300, 6, 13).lids).toBeLessThan(6);
  });

  it("shows every lid when they all fit", () => {
    expect(budgetFor(900, 5, 3).lids).toBe(5);
  });
});

describe("the window", () => {
  it("is the chapter's own taper and nothing else", () => {
    expect(RUNOUT_MS).toBe(1800);
  });
});
