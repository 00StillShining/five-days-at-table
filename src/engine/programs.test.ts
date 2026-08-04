import { describe, expect, it } from "vitest";
import { requireMeal } from "../data/meals";
import { prepSessionForWeek } from "../data/prep";
import { compileMealProgram, compilePrepProgram, criticalPathMinutes, getProgram } from "./programs";

describe("compileMealProgram — b-d5d (salmon teriyaki, 4 tracks)", () => {
  const meal = requireMeal("b-d5d");
  const program = compileMealProgram(meal);

  it("groups steps into the four authored tracks (rice, glaze, salmon, veg) plus a 'general' bucket for step 8's null track", () => {
    const trackIds = program.tracks.map((t) => t.id).sort();
    expect(trackIds).toEqual(["general", "glaze", "rice", "salmon", "veg"].sort());
  });

  it("computes a critical path of 25 minutes, matching the meal's own activeMin", () => {
    // Verified by hand against the source data: rice track ends at
    // clockStart 23 + 2min = 25; salmon track's last step ends at
    // clockStart 24 + 1min = 25; both are the program's true bottleneck.
    expect(program.totalMinutes).toBe(25);
    expect(meal.activeMin).toBe(25); // this meal happens to have near-zero passive/active gap
  });

  it("keeps every step (including the untimed, track-less step 8) in the flat step list", () => {
    expect(program.steps).toHaveLength(meal.method.steps.length);
    const step8 = program.steps.find((s) => s.n === 8)!;
    expect(step8.untimed).toBe(true);
    expect(step8.track).toBe("general"); // null track collapses to the synthetic bucket
  });

  it("each track's own totalMinutes is its steps' own max(clockStart+minutes)", () => {
    const rice = program.tracks.find((t) => t.id === "rice")!;
    // step1: clockStart 0 + 25min = 25; step7: clockStart 23 + 2min = 25
    expect(rice.totalMinutes).toBe(25);
    // glaze is a single-step track: step2, clockStart 0 + 3.5min.
    const glaze = program.tracks.find((t) => t.id === "glaze")!;
    expect(glaze.totalMinutes).toBe(3.5);
    // salmon carries the other end of the timeline: step6, clockStart 24 + 1min = 25.
    const salmon = program.tracks.find((t) => t.id === "salmon")!;
    expect(salmon.totalMinutes).toBe(25);
  });
});

describe("criticalPathMinutes", () => {
  it("falls back to summed minutes when no step carries a clockStart", () => {
    const steps = [
      { clockStart: null, minutes: 3 },
      { clockStart: null, minutes: 4.5 },
      { clockStart: null, minutes: null },
    ];
    expect(criticalPathMinutes(steps)).toBe(7.5);
  });

  it("ignores untimed steps' zero duration when they're not the latest clockStart", () => {
    const steps = [
      { clockStart: 0, minutes: 10 },
      { clockStart: 5, minutes: null }, // untimed, mid-program
    ];
    expect(criticalPathMinutes(steps)).toBe(10);
  });
});

describe("compilePrepProgram — prep-a (Week A Sunday session, 15 ops)", () => {
  const session = prepSessionForWeek("A")!;
  const program = compilePrepProgram(session);

  it("compiles all 15 ops as steps", () => {
    expect(session.ops).toHaveLength(15);
    expect(program.steps).toHaveLength(15);
  });

  it("parses each op's H:MM clock into elapsed minutes", () => {
    // First op starts at 0:00, last op ("Portion and label") at 1:35 = 95 minutes.
    expect(program.steps[0].clockStart).toBe(0);
    expect(program.steps[program.steps.length - 1].clockStart).toBe(95);
  });

  it("groups ops by station into parallel tracks (Hob 1/2/3/4, Oven, Processor, …)", () => {
    const trackIds = new Set(program.tracks.map((t) => t.id));
    expect(trackIds.has("Hob 1")).toBe(true);
    expect(trackIds.has("Hob 2")).toBe(true);
    expect(trackIds.has("Hob 3")).toBe(true);
    expect(trackIds.has("Oven")).toBe(true);
  });

  it("id follows the prep-a/prep-b convention meals' batchSource points at", () => {
    expect(program.id).toBe("prep-a");
    const meal = requireMeal("a-d1l");
    expect(meal.method.batchSource).toBe(program.id);
  });
});

describe("getProgram", () => {
  it("resolves a meal id", () => {
    expect(getProgram("b-d5d")?.kind).toBe("meal");
  });
  it("resolves a prep session id", () => {
    expect(getProgram("prep-b")?.kind).toBe("prep");
  });
  it("returns null for an unknown id rather than throwing (stale persisted timers.programId)", () => {
    expect(getProgram("not-a-real-id")).toBeNull();
  });
});
