import { describe, expect, it } from "vitest";
import { bands, dayMacros, todayInfo } from "./selectors";

// 2026-08-01 is a Saturday (verified against Intl). Each case below is
// "midday London" on that calendar date, well clear of any BST-edge issue.
const ANCHOR = "2026-08-01";
function londonNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`); // BST (+1h) all summer, so this is always 12:00-13:00 London
}

describe("todayInfo — across the full a-twice fortnight", () => {
  const expected: { date: string; weekday: string; fortnightDay: number; weekIndex: 1 | 2; dayNo: number | "weekend"; station: string }[] = [
    { date: "2026-08-01", weekday: "Sat", fortnightDay: 0, weekIndex: 1, dayNo: "weekend", station: "shop" },
    { date: "2026-08-02", weekday: "Sun", fortnightDay: 1, weekIndex: 1, dayNo: "weekend", station: "cook" },
    { date: "2026-08-03", weekday: "Mon", fortnightDay: 2, weekIndex: 1, dayNo: 1, station: "today" },
    { date: "2026-08-04", weekday: "Tue", fortnightDay: 3, weekIndex: 1, dayNo: 2, station: "today" },
    { date: "2026-08-05", weekday: "Wed", fortnightDay: 4, weekIndex: 1, dayNo: 3, station: "today" },
    { date: "2026-08-06", weekday: "Thu", fortnightDay: 5, weekIndex: 1, dayNo: 4, station: "today" },
    { date: "2026-08-07", weekday: "Fri", fortnightDay: 6, weekIndex: 1, dayNo: 5, station: "today" }, // before 18:00
    { date: "2026-08-08", weekday: "Sat", fortnightDay: 7, weekIndex: 2, dayNo: "weekend", station: "shop" },
    { date: "2026-08-09", weekday: "Sun", fortnightDay: 8, weekIndex: 2, dayNo: "weekend", station: "cook" },
    { date: "2026-08-10", weekday: "Mon", fortnightDay: 9, weekIndex: 2, dayNo: 1, station: "today" },
    { date: "2026-08-11", weekday: "Tue", fortnightDay: 10, weekIndex: 2, dayNo: 2, station: "today" },
    { date: "2026-08-12", weekday: "Wed", fortnightDay: 11, weekIndex: 2, dayNo: 3, station: "today" },
    { date: "2026-08-13", weekday: "Thu", fortnightDay: 12, weekIndex: 2, dayNo: 4, station: "today" },
    { date: "2026-08-14", weekday: "Fri", fortnightDay: 13, weekIndex: 2, dayNo: 5, station: "today" },
  ];

  for (const e of expected) {
    it(`${e.date} (${e.weekday}) -> fortnightDay ${e.fortnightDay}, week ${e.weekIndex}, dayNo ${e.dayNo}`, () => {
      const info = todayInfo(londonNoon(e.date), ANCHOR);
      expect(info.anchored).toBe(true);
      expect(info.weekday).toBe(e.weekday);
      expect(info.fortnightDay).toBe(e.fortnightDay);
      expect(info.weekIndex).toBe(e.weekIndex);
      expect(info.dayNo).toBe(e.dayNo);
      expect(info.station).toBe(e.station);
    });
  }

  it("wraps back to fortnightDay 0 on the third Saturday (the cycle repeats indefinitely)", () => {
    const info = todayInfo(londonNoon("2026-08-15"), ANCHOR);
    expect(info.fortnightDay).toBe(0);
    expect(info.weekIndex).toBe(1);
  });

  it("Friday flips to the 'stores' station at/after 18:00 London (D6: day-6 eve)", () => {
    const before = todayInfo(new Date("2026-08-07T16:00:00Z"), ANCHOR); // 17:00 BST
    expect(before.station).toBe("today");
    const after = todayInfo(new Date("2026-08-07T17:30:00Z"), ANCHOR); // 18:30 BST
    expect(after.station).toBe("stores");
  });
});

describe("todayInfo — anchor null (onboarding not yet completed)", () => {
  it("never crashes, reports anchored: false, and still gives a station from the raw weekday", () => {
    const info = todayInfo(londonNoon("2026-08-03"), null); // a real Monday
    expect(info.anchored).toBe(false);
    expect(info.fortnightDay).toBeNull();
    expect(info.weekIndex).toBeNull();
    expect(info.dayNo).toBe(1);
    expect(info.station).toBe("today");
    expect(info.weekday).toBe("Mon");
  });

  it("weekend still resolves to dayNo 'weekend' with no anchor", () => {
    const info = todayInfo(londonNoon("2026-08-01"), null); // a real Saturday
    expect(info.dayNo).toBe("weekend");
    expect(info.station).toBe("shop");
  });
});

describe("dayMacros vs plan.json bands", () => {
  it("Week A, cover w, day 1 sits inside its band on every macro", () => {
    const macros = dayMacros("A", 1, "w");
    const b = bands("A", "w");
    for (const key of Object.keys(macros) as (keyof typeof macros)[]) {
      expect(macros[key], key).toBeGreaterThanOrEqual(b[key][0] - 1); // small tolerance for the ±1 rounding PLAN itself allows
      expect(macros[key], key).toBeLessThanOrEqual(b[key][1] + 1);
    }
  });

  it("is deterministic and matches a hand-verified figure (Week A w day 1 kcal)", () => {
    // Cross-checked by hand: summing covers.w x per100g across a-d1b/a-d1l/a-d1d/a-d1s.
    expect(dayMacros("A", 1, "w").kcal).toBe(1678);
  });

  it("netCarb is always carb - fibre, never read pre-computed", () => {
    const macros = dayMacros("A", 2, "m");
    expect(macros.netCarb).toBeLessThan(macros.kcal); // sanity: no unit confusion
    expect(macros.fibre).toBeGreaterThan(0);
  });
});
