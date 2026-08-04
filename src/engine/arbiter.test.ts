import { describe, expect, it } from "vitest";
import { defaultState } from "../state/reducer";
import type { AppState } from "../state/types";
import { arbiterFor } from "./arbiter";

// Fixed fortnight anchor: 2026-08-01 is a Saturday (verified). "now" below
// is Wednesday 2026-08-05, 10:00 London (BST) — fortnightDay 4, dayNo 3,
// before the 18:00 defrost due-time. Week A / cover "w" / day 3 has zero
// band violations in the real dataset (checked by hand against
// data/meals.json + data/plan.json), so over-band never spuriously fires in
// these tests unless a test deliberately wants it to.
const ANCHOR = "2026-08-01";
const WEDNESDAY_MORNING = new Date("2026-08-05T09:00:00Z");

function baseState(overrides: Partial<AppState> = {}): AppState {
  // structuredClone, not a shallow {...defaultState}: `defaultState` is a
  // shared module-level singleton, and a shallow spread leaves nested slices
  // (inventory, eaten, …) as the SAME object reference — a test later doing
  // `state.inventory["x"] = …` would silently mutate the shared default and
  // leak into every other test in the run. Each call here must be fully
  // independent.
  const clone = structuredClone(defaultState);
  return {
    ...clone,
    prefs: { ...clone.prefs, cycleStartSaturday: ANCHOR, cover: "w", week: "A" },
    ...overrides,
  };
}

describe("arbiterFor — single-category presence", () => {
  it("expired inventory item ranks 1", () => {
    const state = baseState({
      inventory: { cottage: { level: 2, updatedAt: new Date(WEDNESDAY_MORNING.getTime() - 10 * 86_400_000).toISOString() } },
    });
    const result = arbiterFor("today", state, WEDNESDAY_MORNING);
    expect(result.rank1?.kind).toBe("expired");
  });

  it("overdue defrost ranks 1 when nothing has expired", () => {
    // day3's tilapia defrost is scheduled for 2026-08-04 (fortnight day 3);
    // "now" is fortnight day 4, so it's overdue and not yet actioned.
    const state = baseState();
    const result = arbiterFor("today", state, WEDNESDAY_MORNING);
    expect(result.rank1?.kind).toBe("defrost-overdue");
  });

  it("verify-nominee surfaces when explicitly scoped to a trip via ctx", () => {
    // Unanchored (no cycleStartSaturday) so no defrost/over-band candidate
    // can spuriously outrank it — isolates verify-nominee against just the
    // "shop" screen's own primary action, which it must still outrank.
    const state = baseState({ prefs: { ...defaultState.prefs, cycleStartSaturday: null, cover: "w", week: "A" } });
    const result = arbiterFor("shop", state, WEDNESDAY_MORNING, { tripDay: 0 });
    expect(result.rank1?.kind).toBe("verify-nominee");
  });

  it("returns null with zero queued when nothing at all applies", () => {
    const state = baseState({ prefs: { ...defaultState.prefs, cycleStartSaturday: null, cover: "w", week: "A" } });
    const result = arbiterFor("plan", state, WEDNESDAY_MORNING); // PLAN's own primary action is always null too
    expect(result).toEqual({ rank1: null, queued: 0 });
  });
});

describe("arbiterFor — priority ordering", () => {
  it("expired beats defrost-overdue, timer-due, verify-nominee, and primary-action all at once", () => {
    const program = "prep-a"; // any real meal program; started long enough ago that it's overdue
    const state = baseState({
      inventory: { cottage: { level: 2, updatedAt: new Date(WEDNESDAY_MORNING.getTime() - 10 * 86_400_000).toISOString() } },
      timers: {
        programId: program,
        startedAt: WEDNESDAY_MORNING.getTime() - 60 * 60_000, // started an hour ago — every timed step is overdue
        pausedAt: null,
        accumulatedPauseMs: 0,
        extraMs: 0,
        doneSteps: [],
      },
    });
    const result = arbiterFor("shop", state, WEDNESDAY_MORNING, { tripDay: 0 });
    expect(result.rank1?.kind).toBe("expired");
    // Runners-up present: defrost-overdue, timer-due, verify-nominee, primary-action (send-to-phone).
    expect(result.queued).toBe(4);
  });

  it("defrost-overdue beats timer-due and lower categories when nothing has expired", () => {
    const state = baseState({
      timers: {
        programId: "prep-a",
        startedAt: WEDNESDAY_MORNING.getTime() - 60 * 60_000,
        pausedAt: null,
        accumulatedPauseMs: 0,
        extraMs: 0,
        doneSteps: [],
      },
    });
    const result = arbiterFor("shop", state, WEDNESDAY_MORNING, { tripDay: 0 });
    expect(result.rank1?.kind).toBe("defrost-overdue");
    expect(result.queued).toBe(3); // timer-due, verify-nominee, primary-action
  });

  it("primary-action is the fallback when no urgent candidate exists", () => {
    const state = baseState({ prefs: { ...defaultState.prefs, cycleStartSaturday: null, cover: "w", week: "A" } });
    const result = arbiterFor("shop", state, WEDNESDAY_MORNING);
    expect(result).toEqual({ rank1: { kind: "primary-action", id: "send-to-phone", text: "send to phone →", target: { screen: "shop" } }, queued: 0 });
  });
});

describe("arbiterFor — tie-breaks within a category", () => {
  it("picks the most-expired item first, and counts the other as queued", () => {
    const thirtyDaysAgo = new Date(WEDNESDAY_MORNING.getTime() - 30 * 86_400_000).toISOString();
    const state = baseState({
      inventory: {
        cottage: { level: 2, updatedAt: new Date(WEDNESDAY_MORNING.getTime() - 8 * 86_400_000).toISOString() }, // remaining ~ 5-8 = -3
        // chicken is freeze-day0 (freezer stock) — P1 fix: its post-thaw
        // countdown only starts from `thawedAt`, never from a bare
        // `updatedAt` stocktake touch (that's the false-expired-flood bug
        // this fixed). So this fixture must explicitly mark it thawed 30
        // days ago to genuinely be the more-expired item under the new
        // semantics — a chicken with no thawedAt wouldn't be "expired" at
        // all (still frozen, no countdown applies).
        chicken: { level: 1, updatedAt: thirtyDaysAgo, thawedAt: thirtyDaysAgo }, // freshDays 2, remaining ~ 2-30 = -28 (far more expired)
      },
    });
    const result = arbiterFor("today", state, WEDNESDAY_MORNING);
    expect(result.rank1?.kind).toBe("expired");
    expect(result.rank1?.id).toBe("chicken"); // the more-expired item wins
    expect(result.queued).toBeGreaterThanOrEqual(1); // cottage (and the overdue defrost) queued behind it
  });
});

describe("arbiterFor — per-screen primary-action table", () => {
  const cleanState = () => baseState({ prefs: { ...defaultState.prefs, cycleStartSaturday: null, cover: "w", week: "A" } });

  it("today: tonight's cook (the dutyStack start-by duty)", () => {
    // Needs an anchor to resolve "today's dinner" — reuse the Wednesday setup but with nothing urgent queued ahead of it.
    const state = baseState();
    // Silence defrost-overdue by pretending it's already actioned.
    state.inventory["tilapia"] = { level: 2, updatedAt: new Date("2026-08-04T12:00:00Z").toISOString() };
    const result = arbiterFor("today", state, WEDNESDAY_MORNING);
    expect(result.rank1?.kind).toBe("primary-action");
    expect(result.rank1?.text).toMatch(/cook/);
  });

  it("plan: always null", () => {
    expect(arbiterFor("plan", cleanState(), WEDNESDAY_MORNING).rank1).toBeNull();
  });

  it("cook: always null (the reel/done-button is the interaction, not an arbiter action)", () => {
    expect(arbiterFor("cook", cleanState(), WEDNESDAY_MORNING).rank1).toBeNull();
  });

  it("meal: cook, only when a mealId is given via ctx", () => {
    expect(arbiterFor("meal", cleanState(), WEDNESDAY_MORNING).rank1).toBeNull();
    const result = arbiterFor("meal", cleanState(), WEDNESDAY_MORNING, { mealId: "a-d1l" });
    expect(result.rank1).toEqual({ kind: "primary-action", id: "a-d1l", text: "cook →", target: { screen: "cook", id: "a-d1l" } });
  });

  it("shop: send-to-phone", () => {
    const result = arbiterFor("shop", cleanState(), WEDNESDAY_MORNING);
    expect(result.rank1?.id).toBe("send-to-phone");
  });

  it("list: next aisle", () => {
    const result = arbiterFor("list", cleanState(), WEDNESDAY_MORNING);
    expect(result.rank1?.id).toBe("next-aisle");
  });

  it("stores: stocktake nudge when stale (or never stocktaken)", () => {
    const result = arbiterFor("stores", cleanState(), WEDNESDAY_MORNING);
    expect(result.rank1?.id).toBe("stocktake");
  });

  it("stores: no nudge when the register was touched recently", () => {
    const state = cleanState();
    state.inventory["egg"] = { level: 3, updatedAt: WEDNESDAY_MORNING.toISOString() };
    const result = arbiterFor("stores", state, WEDNESDAY_MORNING);
    expect(result.rank1).toBeNull();
  });
});

// Wave-1 integration review: over-band was comparing the FULL PLANNED day
// against the band (which sits by design right at the edge — see
// data/meals.json's a-d1b/a-d1l/a-d1d/a-d1s, whose combined cover-w protein
// is 118.1g against a 118g band max), so it fired on nearly every relevant
// day regardless of the time of day or what had actually been eaten. Fixed
// to read eatenSoFar (ticked slots only) — see state/selectors.ts.
describe("arbiterFor — over-band uses eaten-so-far, not the full planned day", () => {
  // Monday under ANCHOR ("2026-08-01" Saturday) -> fortnightDay 2, dayNo 1.
  // No calendar defrost entries exist before fortnightDay 3, so a clean
  // (empty inventory, no timers) Monday state has no expired/defrost-overdue/
  // timer-due candidates ahead of over-band — isolates the category cleanly.
  const MONDAY = new Date("2026-08-03T08:00:00Z"); // 09:00 London (BST)

  function mondayState(eaten: AppState["eaten"] = {}): AppState {
    return { ...structuredClone(defaultState), prefs: { ...defaultState.prefs, cycleStartSaturday: ANCHOR, cover: "w", week: "A" }, eaten };
  }

  it("a planned-but-entirely-uneaten day never fires over-band at 9am, even though the full plan would be over-band once eaten", () => {
    const result = arbiterFor("today", mondayState(), MONDAY);
    // With nothing ticked, the only remaining candidate is TODAY's own
    // primary action (tonight's start-by) — over-band must be absent, not
    // just out-ranked, since nothing outranks it here.
    expect(result.rank1?.kind).not.toBe("over-band");
    expect(result.rank1?.kind).toBe("primary-action");
  });

  it("ticking part of the day (under the band) still does not fire over-band", () => {
    const eaten: AppState["eaten"] = {
      "2026-08-03": {
        breakfast: { mealId: "a-d1b", at: MONDAY.toISOString() },
        lunch: { mealId: "a-d1l", at: MONDAY.toISOString() },
        dinner: { mealId: "a-d1d", at: MONDAY.toISOString() },
        // snack intentionally left un-ticked — protein without it is ~102g, well under the 118g band max.
      },
    };
    const result = arbiterFor("today", mondayState(eaten), MONDAY);
    expect(result.rank1?.kind).not.toBe("over-band");
  });

  it("ticking the full day (matching the known over-band plan total) fires over-band", () => {
    const eaten: AppState["eaten"] = {
      "2026-08-03": {
        breakfast: { mealId: "a-d1b", at: MONDAY.toISOString() },
        lunch: { mealId: "a-d1l", at: MONDAY.toISOString() },
        dinner: { mealId: "a-d1d", at: MONDAY.toISOString() },
        snack: { mealId: "a-d1s", at: MONDAY.toISOString() },
      },
    };
    const result = arbiterFor("today", mondayState(eaten), MONDAY);
    expect(result.rank1?.kind).toBe("over-band");
    expect(result.rank1?.text).toMatch(/protein/);
  });
});
