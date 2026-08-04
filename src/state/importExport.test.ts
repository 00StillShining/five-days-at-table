import { describe, expect, it } from "vitest";
import { exportState, importState } from "./importExport";
import { defaultState } from "./reducer";
import type { AppState } from "./types";

function nonTrivialState(): AppState {
  return {
    prefs: { cover: "m", week: "B", scale: 1.1, serveTime: "19:00", cycleStartSaturday: "2026-08-01" },
    inventory: {
      egg: { level: 3, updatedAt: "2026-08-01T09:00:00.000Z" },
      chicken: { level: 1, updatedAt: "2026-08-02T09:00:00.000Z" },
    },
    eaten: { "2026-08-03": { dinner: { mealId: "a-d1d", at: "2026-08-03T19:40:00.000Z" } } },
    shopTicks: { "trip-1": { egg: { at: "2026-08-01T10:00:00.000Z" } } },
    leftovers: [
      {
        id: "lo_1",
        source: "prep",
        ref: "Turkey bolognese",
        g: 1075,
        price: null,
        date: "2026-08-02",
        useBy: "2026-08-06",
        consumers: ["a-d4l"],
        sourceWeek: "A",
        sourceSession: "prep-a",
        note: null,
        consumedAt: null,
      },
    ],
    waste: [{ id: "waste_1", ref: "a-d2d", g: 150, price: 0.9, date: "2026-08-03", note: "binned, went off" }],
    priceChecks: { avocado: { price: 1.15, on: "2026-08-01" } },
    timers: { programId: "prep-a", startedAt: 1_754_000_000_000, pausedAt: null, accumulatedPauseMs: 60_000, extraMs: 0, doneSteps: [1, 2, 3] },
    swaps: { "a-d2d": "b-d2d" },
  };
}

describe("export/import round-trip", () => {
  it("round-trips the default state exactly", () => {
    const json = exportState(defaultState);
    const result = importState(json);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toEqual(defaultState);
  });

  it("round-trips a fully populated, non-trivial state exactly", () => {
    const state = nonTrivialState();
    const json = exportState(state);
    const result = importState(json);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toEqual(state);
  });

  it("the export envelope is versioned and self-describing", () => {
    const json = exportState(defaultState);
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe("fd5.export.v1");
    expect(typeof parsed.exportedAt).toBe("string");
    expect(parsed.state).toBeDefined();
  });
});

describe("import — refuses invalid input, all-or-nothing", () => {
  it("rejects non-JSON", () => {
    const result = importState("not json at all");
    expect(result.ok).toBe(false);
  });

  it("rejects a well-formed envelope with a malformed slice, without applying the good slices", () => {
    const state = nonTrivialState();
    const envelope = { schema: "fd5.export.v1", exportedAt: new Date().toISOString(), state: { ...state, inventory: { egg: { level: 99, updatedAt: "x" } } } };
    const result = importState(JSON.stringify(envelope));
    expect(result.ok).toBe(false); // the whole import is refused, not just the inventory slice
  });

  it("rejects an envelope with an unrecognized schema version", () => {
    const envelope = { schema: "fd5.export.v2", exportedAt: new Date().toISOString(), state: defaultState };
    const result = importState(JSON.stringify(envelope));
    expect(result.ok).toBe(false);
  });

  it("rejects a bare AppState with no envelope wrapper", () => {
    const result = importState(JSON.stringify(defaultState));
    expect(result.ok).toBe(false);
  });
});
