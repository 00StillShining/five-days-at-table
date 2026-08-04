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
