import { describe, it, expect } from "vitest";
import {
  sampleFrame,
  nextStage,
  PERIOD_MAX_MS,
  WINDOW_FRAMES,
  DROP_FACTOR,
} from "./useFrameBudget";

/**
 * These tests exist because the ladder shipped measuring the interval BETWEEN
 * frames as though it were the cost OF one, and nothing caught it. A healthy
 * 60Hz page read as 60/60 frames over budget and the ladder climbed to stage 3
 * on an idle screen in about three seconds. The regression case is the first
 * test below: a steady, perfect display must produce zero dropped frames.
 */

/** Drive a run of intervals through the sampler the way the rAF loop does. */
function run(intervals: number[]): { dropped: number; counted: number; period: number } {
  let period = PERIOD_MAX_MS;
  let dropped = 0;
  let counted = 0;
  for (const interval of intervals) {
    const s = sampleFrame(interval, period);
    period = s.period;
    if (!s.counted) continue;
    counted++;
    if (s.dropped) dropped++;
  }
  return { dropped, counted, period };
}

const steady = (ms: number, n: number): number[] => Array.from({ length: n }, () => ms);

describe("frame budget measurement", () => {
  it("counts ZERO dropped frames on a healthy 60Hz display", () => {
    // The exact bug: 16.67ms > 12ms, so every frame used to count as over budget.
    const { dropped, counted, period } = run(steady(16.67, WINDOW_FRAMES * 3));
    expect(counted).toBe(WINDOW_FRAMES * 3);
    expect(dropped).toBe(0);
    expect(period).toBeCloseTo(16.67, 2);
  });

  it("counts ZERO dropped frames on 120Hz and 90Hz displays", () => {
    expect(run(steady(8.33, WINDOW_FRAMES)).dropped).toBe(0);
    expect(run(steady(11.1, WINDOW_FRAMES)).dropped).toBe(0);
  });

  it("never escalates the ladder on an idle 60Hz page", () => {
    // Three full windows of perfect frames must leave the stage at 0.
    let stage: 0 | 1 | 2 | 3 = 0;
    for (let w = 0; w < 3; w++) {
      const { dropped } = run(steady(16.67, WINDOW_FRAMES));
      stage = nextStage(dropped, WINDOW_FRAMES, stage);
    }
    expect(stage).toBe(0);
  });

  it("catches a genuinely dropped frame", () => {
    // One missed vsync at 60Hz is a ~33ms interval.
    const { dropped } = run([...steady(16.67, 10), 33.4, ...steady(16.67, 10)]);
    expect(dropped).toBe(1);
  });

  it("escalates when the majority of a window drops", () => {
    const janky = [...steady(16.67, 5), ...steady(33.4, WINDOW_FRAMES)];
    const { dropped } = run(janky);
    expect(dropped).toBeGreaterThan(WINDOW_FRAMES / 2);
    expect(nextStage(dropped, WINDOW_FRAMES, 0)).toBe(1);
    expect(nextStage(dropped, WINDOW_FRAMES, 1)).toBe(2);
    expect(nextStage(dropped, WINDOW_FRAMES, 2)).toBe(3);
    expect(nextStage(dropped, WINDOW_FRAMES, 3)).toBe(3); // clamped
  });

  it("discounts a resumption entirely — neither clean nor dropped", () => {
    // A backgrounded tab returns with one enormous frame. Counting it as CLEAN
    // (the old behaviour) let a long stall make a window look healthy.
    const s = sampleFrame(4000, 16.67);
    expect(s.counted).toBe(false);
    expect(s.dropped).toBe(false);
    const { counted } = run([...steady(16.67, 10), 4000, ...steady(16.67, 10)]);
    expect(counted).toBe(20);
  });

  it("does not calibrate the period from an implausibly fast frame", () => {
    // A 0.5ms interval is a scheduling artefact, not a 2000Hz display.
    const { period, dropped } = run([0.5, ...steady(16.67, 30)]);
    expect(period).toBeCloseTo(16.67, 2);
    expect(dropped).toBe(0);
  });

  it("holds the drop threshold at the documented factor", () => {
    expect(DROP_FACTOR).toBe(1.5);
    const period = 16.67;
    expect(sampleFrame(period * 1.4, period).dropped).toBe(false);
    expect(sampleFrame(period * 1.6, period).dropped).toBe(true);
  });
});
