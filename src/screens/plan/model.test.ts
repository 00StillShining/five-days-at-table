/**
 * src/screens/plan/model.test.ts — PLAN's arithmetic, against the real data.
 *
 * Nothing here is fixtured. Every figure is read through the frozen accessors
 * and the frozen selectors, so a test that passes is a test about the plan the
 * product actually ships.
 *
 * NOT TESTED HERE, deliberately: anything that lives in plan.css. `?raw` CSS
 * imports return an EMPTY STRING under vitest, so a stylesheet assertion passes
 * against nothing — COOK's own test file was vacuous for exactly that reason.
 * The Floor's 44px targets and every measured contrast on this screen are
 * verified by measuring the rendered page instead, and reported as measurements.
 */

import { describe, expect, it } from "vitest";
import { angleOf } from "./model";
import {
  BAND_WORD,
  CHANNELS,
  HERO_INDEX,
  MAJOR_EVERY,
  MINORS,
  PLATED_DAYS,
  RANGE_PAD,
  SCOPES,
  WINK_MINORS,
  bandMiss,
  bandState,
  candidatesForSlot,
  clampMarkTicks,
  dialScale,
  formatChannel,
  formatSigned,
  fractionOf,
  isPinned,
  markValue,
  mealLoggedAt,
  readDay,
  readWeek,
  scopeAllowed,
  scopeBands,
  scopeTotals,
  weekTotals,
  type ChannelKey,
} from "./model";
import { OVERSHOOT, WOBBLE_MS, createNeedleDrive } from "./needle";
import { FULL_VARIANT, activeVariant } from "../../data/variant";
import type { Eaten } from "../../state/types";

const TESTER = activeVariant({ prefs: { planVariant: "morrisons-tester" } as never });
const NO_SWAPS = {};
const NO_EATEN: Eaten = {};

describe("the case row", () => {
  it("carries exactly five channels with the hero at the centre", () => {
    expect(CHANNELS).toHaveLength(5);
    expect(HERO_INDEX).toBe(2);
    expect(CHANNELS[HERO_INDEX].key).toBe("kcal");
  });

  it("spends the over-range wink on exactly one dial", () => {
    expect(CHANNELS.filter((c) => c.wink)).toHaveLength(1);
    expect(CHANNELS.find((c) => c.wink)?.key).toBe("kcal");
  });
});

describe("D5 — the fortnight is week A, twice", () => {
  it("doubles both the reading and the band, so the needle cannot move", () => {
    for (const cover of ["w", "m"] as const) {
      const week = scopeTotals("A", cover, NO_SWAPS, FULL_VARIANT, "week");
      const fortnight = scopeTotals("A", cover, NO_SWAPS, FULL_VARIANT, "fortnight");
      const weekBand = scopeBands("A", cover, FULL_VARIANT, "week");
      const fortnightBand = scopeBands("A", cover, FULL_VARIANT, "fortnight");

      for (const spec of CHANNELS) {
        const k = spec.key;
        expect(fortnight[k]).toBeCloseTo(week[k] * 2, 6);
        expect(fortnightBand[k][0]).toBeCloseTo(weekBand[k][0] * 2, 6);
        expect(fortnightBand[k][1]).toBeCloseTo(weekBand[k][1] * 2, 6);

        // THE SIGNATURE, proven rather than asserted: the same angle, both scopes.
        const a = angleOf(week[k], dialScale(weekBand[k], spec.wink));
        const b = angleOf(fortnight[k], dialScale(fortnightBand[k], spec.wink));
        expect(b).toBeCloseTo(a, 9);
      }
    }
  });

  it("refuses the fortnight scope while week B is on the board", () => {
    expect(scopeAllowed("fortnight", "A")).toBe(true);
    expect(scopeAllowed("fortnight", "B")).toBe(false);
    expect(scopeAllowed("week", "B")).toBe(true);
  });

  it("declares ten plated days for the fortnight and five for the week", () => {
    expect(SCOPES.week.days).toBe(PLATED_DAYS);
    expect(SCOPES.fortnight.days).toBe(PLATED_DAYS * 2);
    expect(SCOPES.fortnight.passes).toBe(2);
  });
});

describe("the printed scale (II.3.18, range chosen by the band)", () => {
  const band: [number, number] = [100, 200];

  it("prints the band edges at 37.5% and 62.5% of the base arc", () => {
    const s = dialScale(band);
    expect(s.zones.bandStart).toBeCloseTo(RANGE_PAD / (2 * RANGE_PAD + 1), 6);
    expect(s.zones.bandStart).toBeCloseTo(0.375, 6);
    expect(s.zones.bandEnd).toBeCloseTo(0.625, 6);
  });

  it("puts the two caution zones symmetrically outside the band", () => {
    const s = dialScale(band);
    expect(s.zones.bandStart - s.zones.dangerLow).toBeCloseTo(s.zones.warnHigh - s.zones.bandEnd, 6);
    expect(s.zones.dangerLow).toBeCloseTo(0.25, 6);
    expect(s.zones.warnHigh).toBeCloseTo(0.75, 6);
  });

  it("does not move when the reading moves", () => {
    const a = dialScale(band);
    const b = dialScale(band);
    expect(a).toEqual(b);
  });

  it("gives the wink dial one extra major of REAL travel and one extra numeral", () => {
    const plain = dialScale(band);
    const wink = dialScale(band, true);
    expect(plain.minors).toBe(MINORS);
    expect(wink.minors).toBe(WINK_MINORS);
    expect(wink.minors - plain.minors).toBe(MAJOR_EVERY);
    expect(wink.hi).toBeGreaterThan(plain.hi);
    expect(wink.labels.length).toBe(plain.labels.length + 1);
    // and the extra numeral is reachable: it sits inside the arc, not past it
    expect(wink.labels[wink.labels.length - 1].at).toBeLessThanOrEqual(1);
  });

  it("clamps a reading off the scale and says so", () => {
    const s = dialScale(band);
    expect(fractionOf(-10_000, s)).toBe(0);
    expect(fractionOf(10_000, s)).toBe(1);
    expect(isPinned(-10_000, s)).toBe(true);
    expect(isPinned(150, s)).toBe(false);
  });

  it("survives a degenerate band without dividing by zero", () => {
    const s = dialScale([50, 50]);
    expect(Number.isFinite(s.lo)).toBe(true);
    expect(Number.isFinite(s.hi)).toBe(true);
    expect(s.hi).toBeGreaterThan(s.lo);
  });
});

describe("band state", () => {
  it("names the three states and their words", () => {
    expect(bandState(5, [10, 20])).toBe("under");
    expect(bandState(15, [10, 20])).toBe("in");
    expect(bandState(25, [10, 20])).toBe("over");
    expect(BAND_WORD.under).toBe("UNDER BAND");
    expect(BAND_WORD.in).toBe("IN BAND");
    expect(BAND_WORD.over).toBe("OVER BAND");
  });

  it("treats both edges as inside, matching the frozen selector's inclusive band", () => {
    expect(bandState(10, [10, 20])).toBe("in");
    expect(bandState(20, [10, 20])).toBe("in");
    expect(bandMiss(10, [10, 20])).toBe(0);
    expect(bandMiss(20, [10, 20])).toBe(0);
  });

  it("signs the miss toward the edge it missed", () => {
    expect(bandMiss(5, [10, 20])).toBe(-5);
    expect(bandMiss(25, [10, 20])).toBe(5);
  });
});

describe("the crown's reference mark", () => {
  it("seats on the band ceiling at zero offset", () => {
    const band: [number, number] = [100, 200];
    expect(markValue(band, dialScale(band), 0)).toBe(200);
  });

  it("walks exactly one minor tick per step", () => {
    const band: [number, number] = [100, 200];
    const s = dialScale(band);
    const perTick = (s.hi - s.lo) / s.minors;
    expect(markValue(band, s, 1) - markValue(band, s, 0)).toBeCloseTo(perTick, 9);
    expect(markValue(band, s, -3) - markValue(band, s, 0)).toBeCloseTo(-3 * perTick, 9);
  });

  it("clamps to its own limits", () => {
    expect(clampMarkTicks(999)).toBe(20);
    expect(clampMarkTicks(-999)).toBe(-20);
    expect(clampMarkTicks(3.4)).toBe(3);
  });
});

describe("the needle's one rebound", () => {
  it("computes the overshoot from the Weighted spring, inside II.1.7's 2% budget", () => {
    expect(OVERSHOOT).toBeGreaterThan(0);
    expect(OVERSHOOT).toBeLessThanOrEqual(0.02);
    expect(OVERSHOOT).toBeCloseTo(0.0184, 3);
  });

  it("uses the chapter's own authored rebound window, not the Weighted CSS pair", () => {
    expect(WOBBLE_MS).toBe(140);
  });
});

describe("the board, against the real fortnight", () => {
  it("reads twenty slots across five plated days in full mode", () => {
    const days = readWeek("A", "w", NO_SWAPS, FULL_VARIANT, NO_EATEN);
    expect(days).toHaveLength(5);
    expect(days.flatMap((d) => d.slots)).toHaveLength(20);
    expect(days.reduce((n, d) => n + d.cookableCount, 0)).toBe(20);
    expect(days.reduce((n, d) => n + d.cutCount, 0)).toBe(0);
  });

  it("finds the authored plan sitting inside every band on every day", () => {
    // This is the board's honest RESTING state and the reason the gauge range
    // is derived from the band rather than from zero: the plan is authored to
    // land in band, so an instrument that cannot resolve the band resolves
    // nothing at all.
    for (const week of ["A", "B"] as const) {
      for (const cover of ["w", "m"] as const) {
        for (const day of readWeek(week, cover, NO_SWAPS, FULL_VARIANT, NO_EATEN)) {
          expect(day.over).toEqual([]);
          for (const spec of CHANNELS) {
            expect(bandState(day.macros[spec.key], day.band[spec.key])).toBe("in");
          }
        }
      }
    }
  });

  it("carries the tester's cut slots with their stated reasons, and no swap into one", () => {
    const days = readWeek("A", "w", NO_SWAPS, TESTER, NO_EATEN);
    const cut = days.flatMap((d) => d.slots).filter((s) => s.cutReason != null);
    expect(cut).toHaveLength(10);
    for (const s of cut) {
      expect(s.mark).toBe("cut");
      expect(s.meal).toBeNull(); // no meal => the deck is never offered
      expect(s.cutReason && s.cutReason.length).toBeGreaterThan(20);
    }
    expect(days.reduce((n, d) => n + d.cookableCount, 0)).toBe(10);
  });

  it("reads the tester's Wednesday as a genuinely empty day, under band on every channel", () => {
    const wed = readDay("A", 3, "w", NO_SWAPS, TESTER, NO_EATEN);
    expect(wed.cutCount).toBe(4);
    expect(wed.cookableCount).toBe(0);
    for (const spec of CHANNELS) {
      expect(wed.macros[spec.key]).toBe(0);
      expect(bandState(0, wed.band[spec.key])).toBe("under");
    }
  });

  it("uses the tester's own targets, not plan.json's, when the tester is live", () => {
    const full = readDay("A", 1, "w", NO_SWAPS, FULL_VARIANT, NO_EATEN);
    const tester = readDay("A", 1, "w", NO_SWAPS, TESTER, NO_EATEN);
    expect(tester.band.kcal).not.toEqual(full.band.kcal);
    expect(tester.band.kcal).toEqual([916, 1449]);
  });
});

describe("swaps", () => {
  const PLANNED = "a-d5l"; // Friday lunch, week A
  const REPLACEMENT = "b-d3l";

  it("shows the replacement, remembers what it displaced, and marks the row", () => {
    const day = readDay("A", 5, "w", { [PLANNED]: REPLACEMENT }, FULL_VARIANT, NO_EATEN);
    const lunch = day.slots.find((s) => s.slot === "lunch");
    expect(lunch?.meal?.id).toBe(REPLACEMENT);
    expect(lunch?.displaced?.id).toBe(PLANNED);
    expect(lunch?.mark).toBe("swap");
  });

  it("recomputes the day's totals through the frozen selector, and it goes over band", () => {
    const before = readDay("A", 5, "w", NO_SWAPS, FULL_VARIANT, NO_EATEN);
    const after = readDay("A", 5, "w", { [PLANNED]: REPLACEMENT }, FULL_VARIANT, NO_EATEN);
    expect(before.over).toEqual([]);
    expect(after.over.length).toBeGreaterThan(0);
    expect(after.over).toContain("kcal");
    expect(after.macros.kcal).toBeGreaterThan(after.band.kcal[1]);
  });

  it("moves the week reading by exactly the meals' own difference", () => {
    const before = weekTotals("A", "w", NO_SWAPS, FULL_VARIANT);
    const after = weekTotals("A", "w", { [PLANNED]: REPLACEMENT }, FULL_VARIANT);
    const dayBefore = readDay("A", 5, "w", NO_SWAPS, FULL_VARIANT, NO_EATEN);
    const dayAfter = readDay("A", 5, "w", { [PLANNED]: REPLACEMENT }, FULL_VARIANT, NO_EATEN);
    expect(after.kcal - before.kcal).toBeCloseTo(dayAfter.macros.kcal - dayBefore.macros.kcal, 6);
  });

  it("ranks candidates by stock coverage and names the ingredients it counted", () => {
    const cands = candidatesForSlot("A", 5, "lunch", "w", {}, NO_SWAPS, FULL_VARIANT);
    expect(cands.length).toBeGreaterThan(0);
    for (let i = 1; i < cands.length; i++) {
      expect(cands[i - 1].coverage).toBeGreaterThanOrEqual(cands[i].coverage);
    }
    for (const c of cands) {
      expect(c.meal.week).toBe("B");
      expect(c.meal.slot).toBe("lunch");
      expect(c.coverageIngredients.length).toBeGreaterThan(0);
    }
  });

  it("prints the band damage a candidate would cause, before it is committed", () => {
    const cands = candidatesForSlot("A", 5, "lunch", "w", {}, NO_SWAPS, FULL_VARIANT);
    const risky = cands.find((c) => c.meal.id === REPLACEMENT);
    expect(risky).toBeDefined();
    expect(risky?.newlyOver).toContain("kcal");
    expect(risky?.delta.kcal).toBeGreaterThan(0);
  });

  it("counts only the damage THIS swap causes, never damage already standing", () => {
    const standing = { "a-d5l": REPLACEMENT };
    const cands = candidatesForSlot("A", 5, "lunch", "w", {}, standing, FULL_VARIANT);
    const same = cands.find((c) => c.meal.id === REPLACEMENT);
    // Swapping in what is already there causes no new overage and no delta.
    expect(same?.newlyOver).toEqual([]);
    expect(same?.delta.kcal).toBe(0);
  });
});

describe("the logged mark", () => {
  it("is addressed by meal id, so it survives the a-twice fortnight's two passes", () => {
    const eaten: Eaten = {
      "2026-08-10": { lunch: { mealId: "a-d1l", at: "2026-08-10T12:30:00.000Z" } },
      "2026-08-17": { lunch: { mealId: "a-d1l", at: "2026-08-17T12:05:00.000Z" } },
    } as unknown as Eaten;
    // The newest of the two passes wins; neither date is needed to ask.
    expect(mealLoggedAt(eaten, "a-d1l")).toBe("2026-08-17T12:05:00.000Z");
    expect(mealLoggedAt(eaten, "a-d1b")).toBeNull();
  });

  it("counts a logged slot on the day that authors it", () => {
    const eaten: Eaten = {
      "2026-08-17": { lunch: { mealId: "a-d1l", at: "2026-08-17T12:05:00.000Z" } },
    } as unknown as Eaten;
    const day = readDay("A", 1, "w", NO_SWAPS, FULL_VARIANT, eaten);
    expect(day.loggedCount).toBe(1);
    expect(day.slots.find((s) => s.slot === "lunch")?.loggedAt).toBe("2026-08-17T12:05:00.000Z");
  });
});

describe("formatting", () => {
  it("prints kcal whole and the macro channels at one decimal", () => {
    const kcal = CHANNELS.find((c) => c.key === "kcal")!;
    const protein = CHANNELS.find((c) => c.key === "protein")!;
    expect(formatChannel(1729.6, kcal)).toBe("1730");
    expect(formatChannel(102.24, protein)).toBe("102.2");
    expect(formatChannel(102, protein)).toBe("102");
  });

  it("signs a miss with a real minus sign and marks zero as neither", () => {
    const protein = CHANNELS.find((c) => c.key === "protein")!;
    expect(formatSigned(2.5, protein)).toBe("+2.5");
    expect(formatSigned(-2.5, protein)).toBe("−2.5");
    expect(formatSigned(0, protein)).toBe("±0");
  });

  it("reserves a width wide enough for the widest real figure in the dataset", () => {
    // II.6.5 — the WORST-CASE MAGNITUDE sets the reserved width, and it is read
    // off the real dataset rather than off a round demo figure. Both weeks,
    // both covers, both scopes: the fortnight totals are the worst case.
    for (const week of ["A", "B"] as const) {
      for (const cover of ["w", "m"] as const) {
        for (const scope of ["week", "fortnight"] as const) {
          const worst = scopeTotals(week, cover, NO_SWAPS, FULL_VARIANT, scope);
          for (const spec of CHANNELS) {
            const k = spec.key as ChannelKey;
            expect(formatChannel(worst[k], spec).length).toBeLessThanOrEqual(spec.valueCh);
          }
        }
      }
    }
  });
});

/* ========================================================================== */
/* THE SWEEP AND ITS ONE REBOUND, DRIVEN ON A FAKE CLOCK                      */
/* ========================================================================== */
/*
  This exists because the trajectory could NOT be sampled in the browser: the
  Browser pane's tab reports `document.visibilityState === "hidden"`, and a
  hidden tab does not advance requestAnimationFrame at all — sampling there
  would have measured a needle that never moved and called it a bug. So the
  drive is run here against an injected clock instead, which is the only way to
  assert the shape rather than the feeling of it.
*/
describe("the needle drive, on an injected clock", () => {
  function run(fromDeg: number, toDeg: number, frameMs = 16.7, maxMs = 2000) {
    const trace: { t: number; deg: number }[] = [];
    let now = 0;
    const queue: ((t: number) => void)[] = [];
    const realRaf = globalThis.requestAnimationFrame;
    const realCancel = globalThis.cancelAnimationFrame;
    const realPerf = globalThis.performance;
    globalThis.requestAnimationFrame = ((cb: (t: number) => void) => {
      queue.push(cb);
      return queue.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
    globalThis.performance = { now: () => now } as Performance;
    try {
      const drive = createNeedleDrive((deg) => trace.push({ t: now, deg }));
      drive.to(fromDeg, false); // the seed lands, it does not travel
      trace.length = 0;
      drive.to(toDeg, true);
      while (queue.length > 0 && now < maxMs) {
        now += frameMs;
        const batch = queue.splice(0, queue.length);
        for (const cb of batch) cb(now);
      }
      return trace;
    } finally {
      globalThis.requestAnimationFrame = realRaf;
      globalThis.cancelAnimationFrame = realCancel;
      globalThis.performance = realPerf;
    }
  }

  it("sweeps the full arc at the project's 720 deg/s, not the chapter's 540", () => {
    const trace = run(-135, 135);
    const arrival = trace.find((p) => Math.abs(p.deg - 135) < 0.001);
    expect(arrival).toBeDefined();
    // 270 degrees at 720 deg/s is 375ms; sampled on 16.7ms frames it lands on
    // the first frame at or past that.
    expect(arrival!.t).toBeGreaterThanOrEqual(375);
    expect(arrival!.t).toBeLessThan(375 + 17);
  });

  it("floors a small move at 80ms by SLOWING it, never by arriving early", () => {
    const trace = run(0, 5); // 5 degrees would be 6.9ms at the raw rate
    const arrival = trace.find((p) => Math.abs(p.deg - 5) < 0.001);
    expect(arrival).toBeDefined();
    expect(arrival!.t).toBeGreaterThanOrEqual(80);
    expect(arrival!.t).toBeLessThan(80 + 17);
  });

  it("rebounds EXACTLY ONCE, past the target, in the sweep's own direction", () => {
    const trace = run(-100, 60);
    const end = trace[trace.length - 1].deg;
    expect(end).toBeCloseTo(60, 6);
    const beyond = trace.filter((p) => p.deg > 60 + 1e-9);
    expect(beyond.length).toBeGreaterThan(0); // it does overshoot
    // exactly one excursion: the samples past the target are contiguous
    const idx = trace.map((p, i) => (p.deg > 60 + 1e-9 ? i : -1)).filter((i) => i >= 0);
    expect(idx[idx.length - 1] - idx[0]).toBe(idx.length - 1);
    // never backward against the sweep
    expect(Math.min(...trace.map((p) => p.deg))).toBeGreaterThanOrEqual(-100 - 1e-9);
    // and inside II.1.7's <=2% budget of the travel
    const peak = Math.max(...trace.map((p) => p.deg));
    expect((peak - 60) / 160).toBeLessThanOrEqual(0.02);
  });

  it("signs the rebound the other way when the sweep runs the other way", () => {
    const trace = run(60, -100);
    expect(Math.min(...trace.map((p) => p.deg))).toBeLessThan(-100);
    expect(Math.max(...trace.map((p) => p.deg))).toBeLessThanOrEqual(60 + 1e-9);
  });

  it("lands with no travel at all when motion is not wanted", () => {
    const trace = run(-135, 135);
    expect(trace.length).toBeGreaterThan(2);
    // the same command with animate=false is a single write
    let writes = 0;
    const realRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: (t: number) => void) => {
      void cb;
      return 1;
    }) as typeof requestAnimationFrame;
    try {
      const drive = createNeedleDrive(() => { writes += 1; });
      drive.to(-135, false);
      drive.to(135, false);
      expect(writes).toBe(2);
    } finally {
      globalThis.requestAnimationFrame = realRaf;
    }
  });
});
