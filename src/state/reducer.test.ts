import { describe, expect, it } from "vitest";
import { defaultState, reducer } from "./reducer";

// P2-PLAN-001: PLAN §6.4 swap deck. Keyed by the ORIGINAL (planned) meal id
// -> replacement meal id (see state/types.ts's `Swaps` doc).
describe("reducer — swaps/commit, swaps/clear, swaps/clearAll", () => {
  it("defaults to an empty swaps slice", () => {
    expect(defaultState.swaps).toEqual({});
  });

  it("commit adds/overwrites a single slot's swap", () => {
    let state = reducer(defaultState, { type: "swaps/commit", slotMealId: "a-d2d", replacementMealId: "b-d2d" });
    expect(state.swaps).toEqual({ "a-d2d": "b-d2d" });

    // Recommitting the same slot overwrites, doesn't accumulate.
    state = reducer(state, { type: "swaps/commit", slotMealId: "a-d2d", replacementMealId: "a-d4d" });
    expect(state.swaps).toEqual({ "a-d2d": "a-d4d" });
  });

  it("commit is additive across different slots", () => {
    let state = reducer(defaultState, { type: "swaps/commit", slotMealId: "a-d2d", replacementMealId: "b-d2d" });
    state = reducer(state, { type: "swaps/commit", slotMealId: "a-d3l", replacementMealId: "b-d3l" });
    expect(state.swaps).toEqual({ "a-d2d": "b-d2d", "a-d3l": "b-d3l" });
  });

  it("clear removes exactly one slot's swap, leaving the rest", () => {
    let state = reducer(defaultState, { type: "swaps/commit", slotMealId: "a-d2d", replacementMealId: "b-d2d" });
    state = reducer(state, { type: "swaps/commit", slotMealId: "a-d3l", replacementMealId: "b-d3l" });
    state = reducer(state, { type: "swaps/clear", slotMealId: "a-d2d" });
    expect(state.swaps).toEqual({ "a-d3l": "b-d3l" });
  });

  it("clear on a slot with no swap is a harmless no-op", () => {
    const state = reducer(defaultState, { type: "swaps/clear", slotMealId: "a-d2d" });
    expect(state.swaps).toEqual({});
  });

  it("clearAll wipes every committed swap", () => {
    let state = reducer(defaultState, { type: "swaps/commit", slotMealId: "a-d2d", replacementMealId: "b-d2d" });
    state = reducer(state, { type: "swaps/commit", slotMealId: "a-d3l", replacementMealId: "b-d3l" });
    state = reducer(state, { type: "swaps/clearAll" });
    expect(state.swaps).toEqual({});
  });

  it("never mutates the input state (pure reducer)", () => {
    const before = { ...defaultState.swaps };
    reducer(defaultState, { type: "swaps/commit", slotMealId: "a-d2d", replacementMealId: "b-d2d" });
    expect(defaultState.swaps).toEqual(before);
  });
});

// P1 wave-1-review fix ("false-expired flood"): thawedAt is a separate
// marker from updatedAt, set only by inventory/markThawed — see
// state/types.ts's InventoryEntry doc and selectors.ts's remainingLifeDays.
describe("reducer — inventory/markThawed and thawedAt bookkeeping", () => {
  it("markThawed sets both updatedAt and thawedAt to the same instant", () => {
    const state = reducer(defaultState, { type: "inventory/markThawed", ingId: "chicken", at: "2026-08-04T18:00:00.000Z" });
    expect(state.inventory.chicken).toEqual({ level: 4, updatedAt: "2026-08-04T18:00:00.000Z", thawedAt: "2026-08-04T18:00:00.000Z" });
  });

  it("markThawed preserves an existing level rather than resetting it", () => {
    let state = reducer(defaultState, { type: "inventory/set", ingId: "chicken", level: 2, at: "2026-08-01T09:00:00.000Z" });
    state = reducer(state, { type: "inventory/markThawed", ingId: "chicken", at: "2026-08-04T18:00:00.000Z" });
    expect(state.inventory.chicken.level).toBe(2);
    expect(state.inventory.chicken.thawedAt).toBe("2026-08-04T18:00:00.000Z");
  });

  it("markThawed defaults to full (4) when the ingredient had no prior inventory entry", () => {
    const state = reducer(defaultState, { type: "inventory/markThawed", ingId: "tilapia" });
    expect(state.inventory.tilapia.level).toBe(4);
  });

  it("a plain inventory/set (stocktake) never invents a thawedAt", () => {
    const state = reducer(defaultState, { type: "inventory/set", ingId: "chicken", level: 3, at: "2026-08-01T09:00:00.000Z" });
    expect(state.inventory.chicken.thawedAt).toBeFalsy();
  });

  it("a later inventory/set (re-stocktake) preserves an already-set thawedAt rather than clearing it", () => {
    let state = reducer(defaultState, { type: "inventory/markThawed", ingId: "chicken", at: "2026-08-04T18:00:00.000Z" });
    state = reducer(state, { type: "inventory/set", ingId: "chicken", level: 1, at: "2026-08-06T09:00:00.000Z" }); // just eating it down
    expect(state.inventory.chicken).toEqual({ level: 1, updatedAt: "2026-08-06T09:00:00.000Z", thawedAt: "2026-08-04T18:00:00.000Z" });
  });

  it("inventory/setMany also preserves each entry's existing thawedAt", () => {
    let state = reducer(defaultState, { type: "inventory/markThawed", ingId: "chicken", at: "2026-08-04T18:00:00.000Z" });
    state = reducer(state, { type: "inventory/setMany", entries: [{ ingId: "chicken", level: 2, at: "2026-08-06T09:00:00.000Z" }] });
    expect(state.inventory.chicken.thawedAt).toBe("2026-08-04T18:00:00.000Z");
  });
});
