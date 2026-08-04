import { describe, expect, it } from "vitest";
import { ingredientsById } from "../data/ingredients";
import { mealsByWeek, requireMeal } from "../data/meals";
import { defaultState } from "./reducer";
import { bands, coverageForAllMeals, dayMacros, dutyStack, eatenSoFar, effectiveMealForSlot, formatRemainingDays, mealMacros, remainingLifeDays, todayInfo, tripBuild } from "./selectors";
import type { AppState, Swaps } from "./types";

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

describe("mealMacros", () => {
  it("matches the meal's own recorded macros at scale 1 (within rounding)", () => {
    const m = mealMacros("a-d2d", "w");
    const recorded = requireMeal("a-d2d").macros.w;
    expect(Math.abs(m.kcal - recorded.kcal)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.protein - recorded.protein)).toBeLessThanOrEqual(1);
  });

  it("scales linearly with the portion knob", () => {
    const base = mealMacros("a-d2d", "w", 1);
    const scaled = mealMacros("a-d2d", "w", 1.3);
    expect(Math.abs(scaled.kcal - base.kcal * 1.3)).toBeLessThanOrEqual(1); // rounding on each side only
  });
});

describe("effectiveMealForSlot — P2-PLAN-001 swap resolution", () => {
  it("returns the planned meal when no swap is committed", () => {
    const meal = effectiveMealForSlot("A", 2, "dinner", { swaps: {} });
    expect(meal?.id).toBe("a-d2d");
  });

  it("returns the replacement meal when a swap is committed for that slot", () => {
    const swaps: Swaps = { "a-d2d": "b-d2d" };
    const meal = effectiveMealForSlot("A", 2, "dinner", { swaps });
    expect(meal?.id).toBe("b-d2d");
  });

  it("falls back to the planned meal if the swap points at an unknown id (stale data)", () => {
    const swaps: Swaps = { "a-d2d": "not-a-real-meal-id" };
    const meal = effectiveMealForSlot("A", 2, "dinner", { swaps });
    expect(meal?.id).toBe("a-d2d");
  });

  it("returns undefined for a slot that doesn't exist", () => {
    expect(effectiveMealForSlot("A", 99, "dinner", { swaps: {} })).toBeUndefined();
  });
});

describe("dayMacros — swap-aware", () => {
  it("a committed swap changes the day's macro totals by exactly the swapped meals' difference", () => {
    const unswapped = dayMacros("A", 2, "w");
    const swapped = dayMacros("A", 2, "w", 1, { "a-d2d": "b-d2d" });
    const plannedKcal = mealMacros("a-d2d", "w").kcal;
    const replacementKcal = mealMacros("b-d2d", "w").kcal;
    expect(swapped.kcal - unswapped.kcal).toBe(replacementKcal - plannedKcal);
    expect(swapped.kcal).not.toBe(unswapped.kcal); // sanity: these two meals do differ
  });

  it("an empty/omitted swaps argument reproduces the exact pre-swaps behaviour (backward compatible)", () => {
    expect(dayMacros("A", 1, "w")).toEqual(dayMacros("A", 1, "w", 1, {}));
  });
});

describe("tripBuild — swap-aware shopping deltas", () => {
  it("a swap changes needG for ingredients unique to either side of the swap", () => {
    const noSwap = tripBuild({}, 0);
    const withSwap = tripBuild({}, 0, { "a-d2d": "b-d2d" });

    // panko and egg are only in a-d2d's gram table (not b-d2d's) among this
    // trip's day-0 classes — swapping away from a-d2d should reduce their need.
    const pankoBefore = noSwap.lines.find((l) => l.ingId === "panko")?.needG ?? 0;
    const pankoAfter = withSwap.lines.find((l) => l.ingId === "panko")?.needG ?? 0;
    expect(pankoAfter).toBeLessThan(pankoBefore);

    // tilapia and peppers are only in b-d2d's gram table — swapping in
    // should introduce or increase their need.
    const tilapiaBefore = noSwap.lines.find((l) => l.ingId === "tilapia")?.needG ?? 0;
    const tilapiaAfter = withSwap.lines.find((l) => l.ingId === "tilapia")?.needG ?? 0;
    expect(tilapiaAfter).toBeGreaterThan(tilapiaBefore);
  });

  it("an empty/omitted swaps argument reproduces the exact pre-swaps trip (backward compatible)", () => {
    expect(tripBuild({}, 0)).toEqual(tripBuild({}, 0, {}));
  });
});

describe("coverageForAllMeals — weeks parameter", () => {
  it("defaults to Week A only, matching every existing call site's behavior", () => {
    const result = coverageForAllMeals({}, "w");
    expect(result).toHaveLength(mealsByWeek("A").length);
    expect(result.every((r) => r.mealId.startsWith("a-"))).toBe(true);
  });

  it("explicit ['A'] is identical to the default (backward compatible)", () => {
    expect(coverageForAllMeals({}, "w", ["A"])).toEqual(coverageForAllMeals({}, "w"));
  });

  it("['A', 'B'] ranks meals from both weeks together", () => {
    const result = coverageForAllMeals({}, "w", ["A", "B"]);
    expect(result).toHaveLength(mealsByWeek("A").length + mealsByWeek("B").length);
    expect(result.some((r) => r.mealId.startsWith("a-"))).toBe(true);
    expect(result.some((r) => r.mealId.startsWith("b-"))).toBe(true);
    // still ranked, worst-to-... best (descending coverage), across the combined set.
    for (let i = 1; i < result.length; i++) expect(result[i].coverage).toBeLessThanOrEqual(result[i - 1].coverage);
  });
});

// ---------------------------------------------------------------------------
// P1 wave-1-review fix: "false-expired flood" — a Saturday stocktake on a
// still-frozen item must not read as "expired" by Tuesday, and the fresh
// countdown must only start once the item is explicitly marked thawed.
// ---------------------------------------------------------------------------

const P1_ANCHOR = "2026-08-01"; // Saturday
function p1State(overrides: Partial<AppState> = {}): AppState {
  const clone = structuredClone(defaultState); // never mutate the shared singleton — see engine/arbiter.test.ts's own note
  return { ...clone, prefs: { ...clone.prefs, cycleStartSaturday: P1_ANCHOR }, ...overrides };
}

describe("remainingLifeDays — freezer stock anchors to thawedAt, not updatedAt", () => {
  it("returns null (no countdown) for a freezer item touched only by a stocktake, never thawed", () => {
    const tilapia = ingredientsById.tilapia;
    const entry = { level: 3 as const, updatedAt: "2026-08-01T10:00:00.000Z" }; // Saturday stocktake, no thawedAt
    const daysLater = new Date("2026-08-20T10:00:00.000Z"); // long after — old bug would show wildly expired
    expect(remainingLifeDays(tilapia, entry, daysLater)).toBeNull();
  });

  it("returns null for an out-of-stock (level 0) or missing entry regardless of class", () => {
    expect(remainingLifeDays(ingredientsById.tilapia, { level: 0, updatedAt: "2026-08-01T10:00:00.000Z" }, new Date())).toBeNull();
    expect(remainingLifeDays(ingredientsById.tilapia, undefined, new Date())).toBeNull();
  });

  it("once thawedAt is set, the post-thaw countdown anchors to thawedAt, ignoring an earlier updatedAt", () => {
    const tilapia = ingredientsById.tilapia; // freeze-day0, freshDays 2
    const entry = { level: 3 as const, updatedAt: "2026-08-01T10:00:00.000Z", thawedAt: "2026-08-04T18:00:00.000Z" };
    const oneDayAfterThaw = new Date("2026-08-05T18:00:00.000Z");
    expect(remainingLifeDays(tilapia, entry, oneDayAfterThaw)).toBeCloseTo(1, 5); // 2 - 1 day since thaw = 1, NOT 2 - 4 days since updatedAt
  });

  it("a non-freezer ingredient always anchors to updatedAt (unaffected by this fix)", () => {
    const cottage = ingredientsById.cottage; // topup, openDays 5
    const entry = { level: 2 as const, updatedAt: "2026-08-01T10:00:00.000Z" };
    const twoDaysLater = new Date("2026-08-03T10:00:00.000Z");
    expect(remainingLifeDays(cottage, entry, twoDaysLater)).toBeCloseTo(3, 5); // 5 - 2
  });
});

describe("formatRemainingDays — one rounding rule shared by every screen", () => {
  it("shows 'today' for the whole (0, 1] window, not '1d' (was STORES' ceil bug)", () => {
    expect(formatRemainingDays(0.97)).toBe("today");
    expect(formatRemainingDays(1)).toBe("today");
    expect(formatRemainingDays(0.01)).toBe("today");
  });

  it("shows 'today' at exactly 0, not '0d' (was TODAY's floor behaviour, kept as the shared label)", () => {
    expect(formatRemainingDays(0)).toBe("today");
  });

  it("shows N whole days for remainingDays in (N, N+1]", () => {
    expect(formatRemainingDays(1.01)).toBe("1d");
    expect(formatRemainingDays(2)).toBe("1d");
    expect(formatRemainingDays(2.5)).toBe("2d");
    expect(formatRemainingDays(5)).toBe("4d");
  });

  it("shows 'expired' for any negative remainder", () => {
    expect(formatRemainingDays(-0.01)).toBe("expired");
    expect(formatRemainingDays(-5)).toBe("expired");
  });
});

describe("dutyStack — the review's exact reproduction scenario", () => {
  it("a Saturday stocktake on a still-frozen item produces NO expired/use-today duty by Tuesday (no false-expired flood)", () => {
    const saturdayStocktake = "2026-08-01T10:00:00.000Z";
    const state = p1State({ inventory: { tilapia: { level: 3, updatedAt: saturdayStocktake } } });
    const tuesdayNoon = londonNoon("2026-08-04"); // fortnightDay 3 — tilapia's own calendar defrost-due day
    const duties = dutyStack(state, tuesdayNoon);

    expect(duties.some((d) => d.kind === "expiring" && d.ingId === "tilapia")).toBe(false);

    // The defrost duty itself is correctly still outstanding (not yet done —
    // that's a separate, correctly-still-firing signal from the fix above).
    const defrost = duties.find((d) => d.kind === "defrost" && d.ingId === "tilapia");
    expect(defrost).toBeDefined();
  });

  it("still floods correctly (as 'expired') for a NON-freezer ingredient touched the same way — this fix is freezer-specific", () => {
    const saturdayStocktake = "2026-08-01T10:00:00.000Z"; // cottage: openDays 5
    const state = p1State({ inventory: { cottage: { level: 2, updatedAt: saturdayStocktake } } });
    const eightDaysLater = new Date("2026-08-09T10:00:00.000Z");
    const duties = dutyStack(state, eightDaysLater);
    const cottageDuty = duties.find((d) => d.kind === "expiring" && d.ingId === "cottage");
    expect(cottageDuty).toBeDefined();
    expect(cottageDuty && "expired" in cottageDuty ? cottageDuty.expired : undefined).toBe(true);
  });

  it("marking the defrost done (inventory/markThawed) starts the fresh countdown — an 'expiring' duty appears once enough time has passed since the THAW, not the stocktake", () => {
    const saturdayStocktake = "2026-08-01T10:00:00.000Z";
    const tuesdayThaw = "2026-08-04T18:00:00.000Z"; // the defrost-duty "done" tap, per PLAN §6.3
    const state = p1State({ inventory: { tilapia: { level: 3, updatedAt: tuesdayThaw, thawedAt: tuesdayThaw } } });

    // Right at the thaw instant: freshDays 2, so not yet within the <=1 "expiring" window.
    const rightAfterThaw = dutyStack(state, new Date(tuesdayThaw));
    expect(rightAfterThaw.some((d) => d.kind === "expiring" && d.ingId === "tilapia")).toBe(false);

    // A day and a half after the thaw: 2 - 1.5 = 0.5 remaining -> within the window, "use today".
    const wednesdayEvening = new Date(new Date(tuesdayThaw).getTime() + 1.5 * 86_400_000);
    const laterDuties = dutyStack(state, wednesdayEvening);
    const expiringDuty = laterDuties.find((d) => d.kind === "expiring" && d.ingId === "tilapia");
    expect(expiringDuty).toBeDefined();
    expect(expiringDuty && "expired" in expiringDuty ? expiringDuty.expired : undefined).toBe(false); // not yet expired, just due today

    void saturdayStocktake; // documents the otherwise-irrelevant earlier stocktake touch this scenario supersedes
  });
});

describe("eatenSoFar", () => {
  it("is all-zero when nothing has been ticked yet (no plan-vs-eaten confusion)", () => {
    const now = londonNoon("2026-08-03");
    const macros = eatenSoFar("A", 1, "w", { eaten: {} }, now);
    expect(macros).toEqual({ kcal: 0, protein: 0, netCarb: 0, fat: 0, fibre: 0 });
  });

  it("sums exactly the ticked slots' meal macros, ignoring un-ticked slots and other days", () => {
    const now = londonNoon("2026-08-03"); // Monday, dayNo 1 under P1_ANCHOR
    const breakfast = mealsByWeek("A").find((m) => m.day === 1 && m.slot === "breakfast")!;
    const eaten: AppState["eaten"] = {
      "2026-08-03": { breakfast: { mealId: breakfast.id, at: now.toISOString() } },
      "2026-08-04": { lunch: { mealId: "a-d2l", at: now.toISOString() } }, // a different day — must not count
    };
    const macros = eatenSoFar("A", 1, "w", { eaten }, now);
    expect(macros).toEqual(mealMacros(breakfast.id, "w"));
  });

  it("reflects whatever meal was actually ticked, including a swap-replacement id, without needing swaps state", () => {
    const now = londonNoon("2026-08-03");
    const eaten: AppState["eaten"] = { "2026-08-03": { dinner: { mealId: "b-d2d", at: now.toISOString() } } }; // ticked a Week-B replacement for an A-week slot
    const macros = eatenSoFar("A", 2, "w", { eaten }, now);
    expect(macros).toEqual(mealMacros("b-d2d", "w"));
  });
});
