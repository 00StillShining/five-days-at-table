/**
 * src/cd/shed/useFrameBudget.ts — II.4.12's ladder as real code.
 *
 * II.4.12 — "Motion priority is fixed: input feedback, then state reporting,
 * then navigation, then ambient. When the frame budget tightens, shed from the
 * bottom and NEVER from the top."
 *
 *   stage 1  frame cost > 12ms over 60 frames        pulse pauses
 *   stage 2  stage 1 insufficient over next 60       stagger -> 0ms, groups merge
 *   stage 3  stage 2 insufficient                    peer / drill-in / tray -> 100ms fades
 *   never    —                                       contact, sweep, detent, warning
 *
 * "An instrument that stops acknowledging your hand to keep its garnish moving
 * has inverted its own purpose."
 *
 * The hook measures, decides, and writes ONE attribute — `data-cd-shed` on the
 * document element. tokens/motion.css is what the stage actually costs. Nothing
 * re-renders on a stage change: React state is deliberately not used for the
 * stage, because a shed decision exists precisely because the main thread is
 * already busy, and re-rendering the tree to report that would be the joke
 * telling itself.
 */

import { useEffect, useRef } from "react";

/**
 * II.4.12 — the trigger.
 *
 * ORCHESTRATOR REPAIR (STORES spike, measured). This constant used to be compared
 * against `now - last`, which is the interval BETWEEN frames, not the cost OF one.
 * A perfectly healthy 60Hz display delivers frames 16.67ms apart, so every frame
 * read as over budget, `over` reached 60/60 every window, and the ladder climbed
 * to stage 3 on an idle page in about three seconds — permanently degrading motion
 * on every device, forever. Measured on an idle page: mean interval 16.67ms,
 * 179/179 frames counted over budget, stage 1 at 1158.9ms, stage 2 at 2157.4ms,
 * stage 3 at 3158.0ms.
 *
 * A frame's real cost is not observable from rAF timestamps alone. What IS
 * observable, on every browser including the iPhone Safari this product targets,
 * is a DROPPED frame: an interval longer than the display's own refresh period.
 * So the budget is now expressed as a multiple of the measured period rather than
 * a fixed millisecond count, which also makes it correct on 90Hz and 120Hz
 * ProMotion displays instead of firing constantly on them.
 *
 * Retained as an export because it is part of the landed API, and it still names
 * the doctrine's own figure: 12ms is the budget a 60Hz frame has to do its work in.
 */
export const BUDGET_MS = 12;

/** A frame is dropped when it runs longer than the refresh period by this factor. */
export const DROP_FACTOR = 1.5;

/** Sane bounds for a measured refresh period — 165Hz to 50Hz. */
export const PERIOD_MIN_MS = 6;
export const PERIOD_MAX_MS = 20;

/** The observation window, in frames. */
export const WINDOW_FRAMES = 60;

/** Two consecutive clean windows step back down. Recovery is not instant, so a
 *  single lucky window cannot flap the ladder. */
export const RECOVERY_WINDOWS = 2;

export type ShedStage = 0 | 1 | 2 | 3;

export interface FrameSample {
  /** The refresh period after this sample, calibrated from the fastest frame seen. */
  period: number;
  /** False for a resumption after a backgrounded tab — counts as neither clean nor dropped. */
  counted: boolean;
  /** True when this frame ran long enough to have dropped one. */
  dropped: boolean;
}

/**
 * Classify one frame from its interval. Pure, so the measurement can be tested
 * without a display — which is the seam that was missing when the ladder shipped
 * measuring intervals as if they were costs.
 */
export function sampleFrame(interval: number, period: number): FrameSample {
  if (interval >= 50) return { period, counted: false, dropped: false };
  const next = interval >= PERIOD_MIN_MS && interval < period ? interval : period;
  return { period: next, counted: true, dropped: interval > next * DROP_FACTOR };
}

export const SHED_ATTRIBUTE = "data-cd-shed";

/** Motions that are NEVER shed, at any stage. Exported so a reviewer can grep it. */
export const NEVER_SHED = ["contact", "detent", "sweep", "warning"] as const;

export interface FrameBudgetOptions {
  /** Called whenever the stage changes. For instrumentation only. */
  onStage?: (stage: ShedStage) => void;
  /** Set false to leave the ladder parked at 0 (tests, or a deliberate probe). */
  enabled?: boolean;
}

/**
 * Watch the frame budget and shed from the bottom.
 *
 * Mount ONCE, at the chassis. A second instance would double-count nothing
 * (each has its own window) but would fight over the attribute, so the hook
 * refuses to arm twice.
 */
let armed = false;

export function useFrameBudget(options: FrameBudgetOptions = {}): void {
  const { onStage, enabled = true } = options;
  const stageRef = useRef<ShedStage>(0);

  // ORCHESTRATOR REPAIR (STORES spike). `onStage` was in the dependency array, so
  // any caller passing an inline callback — the obvious way to call this — tore the
  // effect down and re-armed it on every render. Cleanup removes the attribute,
  // but `stageRef` is a ref and survives teardown, so `setStage` then early-returned
  // on the unchanged value and never restored it. Measured: internal stage 3,
  // `data-cd-shed` null. The ladder was pinned at its worst stage while applying
  // nothing. The callback lives in a ref so the effect's identity cannot depend on it.
  const onStageRef = useRef(onStage);
  onStageRef.current = onStage;

  useEffect(() => {
    if (!enabled) return;
    if (typeof requestAnimationFrame !== "function" || typeof document === "undefined") return;
    if (armed) return;
    armed = true;

    let frames = 0;
    let over = 0;
    let cleanWindows = 0;
    let last = performance.now();
    let period = PERIOD_MAX_MS; // calibrated downward from what the display delivers
    let handle = 0;

    const setStage = (next: ShedStage): void => {
      if (next === stageRef.current) return;
      stageRef.current = next;
      if (next === 0) document.documentElement.removeAttribute(SHED_ATTRIBUTE);
      else document.documentElement.setAttribute(SHED_ATTRIBUTE, String(next));
      onStageRef.current?.(next);
    };

    const tick = (now: number): void => {
      const interval = now - last;
      last = now;

      // A tab that was backgrounded returns with one enormous frame. That is a
      // resumption, not a budget failure, so it is discounted ENTIRELY — it counts
      // as neither a dropped frame nor a clean one. (It previously counted as a
      // clean frame, which let a long stall make a window look healthy.)
      // Calibrate the display's refresh period from the fastest frame observed,
      // so the same code is correct at 60Hz, 90Hz and 120Hz.
      const sample = sampleFrame(interval, period);
      period = sample.period;
      if (!sample.counted) {
        handle = requestAnimationFrame(tick);
        return;
      }

      frames++;
      if (sample.dropped) over++;

      if (frames >= WINDOW_FRAMES) {
        const strained = over > WINDOW_FRAMES / 2;
        if (strained) {
          cleanWindows = 0;
          setStage(Math.min(3, stageRef.current + 1) as ShedStage);
        } else {
          cleanWindows++;
          if (cleanWindows >= RECOVERY_WINDOWS && stageRef.current > 0) {
            cleanWindows = 0;
            setStage((stageRef.current - 1) as ShedStage);
          }
        }
        frames = 0;
        over = 0;
      }
      handle = requestAnimationFrame(tick);
    };

    handle = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(handle);
      document.documentElement.removeAttribute(SHED_ATTRIBUTE);
      stageRef.current = 0;
      armed = false;
    };
  }, [enabled]);
}

/**
 * The decision, extracted from the clock so it can be tested without frames.
 *
 * @param overBudgetFrames how many of the window's frames cost more than 12ms
 * @param stage            the stage currently in force
 */
export function nextStage(
  overBudgetFrames: number,
  windowFrames: number,
  stage: ShedStage
): ShedStage {
  const strained = overBudgetFrames > windowFrames / 2;
  if (strained) return Math.min(3, stage + 1) as ShedStage;
  return stage;
}

/** The current stage, for anything that needs to branch in JS rather than CSS. */
export function currentStage(): ShedStage {
  if (typeof document === "undefined") return 0;
  const raw = document.documentElement.getAttribute(SHED_ATTRIBUTE);
  const n = Number(raw);
  return n === 1 || n === 2 || n === 3 ? n : 0;
}

/** Test seam: forget that the hook has been armed. */
export function resetFrameBudget(): void {
  armed = false;
  if (typeof document !== "undefined") document.documentElement.removeAttribute(SHED_ATTRIBUTE);
}
