import { describe, expect, it } from "vitest";
import { reducer, defaultState } from "../state/reducer";
import type { AppState } from "../state/types";
import { deriveProgramState, virtualElapsedMs } from "./timers";
import type { Program } from "./programs";

const MIN = 60_000;

// A hand-built synthetic program (not read from data/*.json) so the timer
// math tests are precise and independent of any future content edits.
// Track "x": step1 [0,5) -> ends 5; step2 [5,15) -> ends 15; step4 [15,30) -> ends 30.
// Track "y": step3, untimed, at clockStart 15 (no duration).
const program: Program = {
  id: "test-program",
  kind: "meal",
  title: "Test program",
  totalMinutes: 30,
  steps: [
    { n: 1, text: "step 1", minutes: 5, tempC: null, track: "x", station: null, clockStart: 0, untimed: false },
    { n: 2, text: "step 2", minutes: 10, tempC: null, track: "x", station: null, clockStart: 5, untimed: false },
    { n: 3, text: "step 3", minutes: null, tempC: null, track: "y", station: null, clockStart: 15, untimed: true },
    { n: 4, text: "step 4", minutes: 15, tempC: null, track: "x", station: null, clockStart: 15, untimed: false },
  ],
  tracks: [
    { id: "x", totalMinutes: 30, steps: [] },
    { id: "y", totalMinutes: 15, steps: [] },
  ],
};

function load(state: AppState) {
  return reducer(state, { type: "timers/load", programId: program.id });
}

describe("virtualElapsedMs — epoch math, not interval accumulation", () => {
  it("has zero drift across a simulated 30-minute run of 1s ticks", () => {
    const timers = load(defaultState).timers;
    const started = { ...timers, startedAt: 0 };
    for (let s = 0; s <= 1800; s += 1) {
      const nowMs = s * 1000;
      expect(virtualElapsedMs(started, nowMs)).toBe(nowMs); // exact, no drift ever
    }
    // Explicitly: at the 30-minute mark, drift is 0ms (<< the 1s/30min budget).
    expect(virtualElapsedMs(started, 30 * MIN)).toBe(30 * MIN);
  });

  it("never goes negative before start", () => {
    const timers = load(defaultState).timers; // startedAt still null
    expect(virtualElapsedMs(timers, 999_999)).toBe(0);
  });
});

describe("pause / resume", () => {
  it("excludes paused time from elapsed, including a still-open pause", () => {
    let state = load(defaultState);
    state = reducer(state, { type: "timers/start", at: 0 });
    expect(deriveProgramState(program, state.timers, 5 * MIN).elapsedMin).toBe(5);

    state = reducer(state, { type: "timers/pause", at: 5 * MIN });
    expect(deriveProgramState(program, state.timers, 5 * MIN).status).toBe("paused");
    // Still paused 10 minutes of real time later — elapsed must not have moved.
    expect(deriveProgramState(program, state.timers, 15 * MIN).elapsedMin).toBe(5);

    state = reducer(state, { type: "timers/resume", at: 15 * MIN });
    expect(state.timers.accumulatedPauseMs).toBe(10 * MIN);
    // Right at resume: still 5 minutes elapsed.
    expect(deriveProgramState(program, state.timers, 15 * MIN).elapsedMin).toBe(5);
    // 5 real minutes after resume: 5 (before pause) + 5 (after resume) = 10.
    expect(deriveProgramState(program, state.timers, 20 * MIN).elapsedMin).toBe(10);
  });

  it("plusOneMinute delays the virtual clock by 60s from that point on", () => {
    let state = load(defaultState);
    state = reducer(state, { type: "timers/start", at: 0 });
    state = reducer(state, { type: "timers/plusOneMinute" });
    // 10 real minutes in, but 1 minute has been "spent" — virtual elapsed is 9.
    expect(deriveProgramState(program, state.timers, 10 * MIN).elapsedMin).toBe(9);
  });

  it("restores correctly mid-program with no special action (R4: reload/lock survival)", () => {
    // Simulate: program started at real time T, paused once, resumed, then
    // the tab is reloaded — the "restore" is nothing more than re-deriving
    // from the same persisted epoch fields at a later `now`.
    let state = load(defaultState);
    state = reducer(state, { type: "timers/start", at: 0 });
    state = reducer(state, { type: "timers/pause", at: 5 * MIN });
    state = reducer(state, { type: "timers/resume", at: 15 * MIN });
    const persistedTimers = state.timers; // <- this is exactly what fd5.v1.timers holds on disk

    // "Reload" 20 minutes after resume, i.e. 30 real minutes after start.
    const afterReload = deriveProgramState(program, persistedTimers, 30 * MIN);
    // elapsed = 30 real minutes - 10 paused minutes = 20 virtual minutes.
    expect(afterReload.elapsedMin).toBe(20);
    expect(afterReload.status).toBe("running");
  });
});

describe("dueNow / stepNow / doneStep", () => {
  it("is not due before a timed step's clock runs out", () => {
    let state = load(defaultState);
    state = reducer(state, { type: "timers/start", at: 0 });
    const derived = deriveProgramState(program, state.timers, 4 * MIN);
    expect(derived.dueNow).toBe(false);
    expect(derived.stepNow?.n).toBe(1);
  });

  it("goes due when a timed step's clock hits zero, and stays due until acknowledged", () => {
    let state = load(defaultState);
    state = reducer(state, { type: "timers/start", at: 0 });
    const derived = deriveProgramState(program, state.timers, 5 * MIN);
    expect(derived.dueNow).toBe(true); // step 1's 5-minute timer just hit zero
    expect(derived.stepNow?.n).toBe(2); // step 2 also became active at clockStart 5 — most recent wins stepNow
  });

  it("doneStep clears dueNow for that step and removes it from activeSteps", () => {
    let state = load(defaultState);
    state = reducer(state, { type: "timers/start", at: 0 });
    state = reducer(state, { type: "timers/doneStep", step: 1 });
    const derived = deriveProgramState(program, state.timers, 5 * MIN);
    expect(derived.dueNow).toBe(false);
    expect(derived.activeSteps.map((s) => s.n)).toEqual([2]);
  });

  it("marking the last step done completes the program (dueNow forced false)", () => {
    let state = load(defaultState);
    state = reducer(state, { type: "timers/start", at: 0 });
    state = reducer(state, { type: "timers/doneStep", step: 4 }); // last step (n=4)
    const derived = deriveProgramState(program, state.timers, 40 * MIN); // well past total
    expect(derived.status).toBe("complete");
    expect(derived.dueNow).toBe(false);
  });
});

describe("idle state", () => {
  it("is idle when no program is loaded, or the loaded program hasn't started", () => {
    expect(deriveProgramState(program, defaultState.timers, 0).status).toBe("idle");
    const loaded = load(defaultState);
    expect(deriveProgramState(program, loaded.timers, 0).status).toBe("idle");
  });
});
