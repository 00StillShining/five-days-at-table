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

/** II.4.12 — the trigger. */
export const BUDGET_MS = 12;

/** The observation window, in frames. */
export const WINDOW_FRAMES = 60;

/** Two consecutive clean windows step back down. Recovery is not instant, so a
 *  single lucky window cannot flap the ladder. */
export const RECOVERY_WINDOWS = 2;

export type ShedStage = 0 | 1 | 2 | 3;

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

  useEffect(() => {
    if (!enabled) return;
    if (typeof requestAnimationFrame !== "function" || typeof document === "undefined") return;
    if (armed) return;
    armed = true;

    let frames = 0;
    let over = 0;
    let cleanWindows = 0;
    let last = performance.now();
    let handle = 0;

    const setStage = (next: ShedStage): void => {
      if (next === stageRef.current) return;
      stageRef.current = next;
      if (next === 0) document.documentElement.removeAttribute(SHED_ATTRIBUTE);
      else document.documentElement.setAttribute(SHED_ATTRIBUTE, String(next));
      onStage?.(next);
    };

    const tick = (now: number): void => {
      const cost = now - last;
      last = now;
      frames++;
      // A tab that was backgrounded returns with one enormous frame. That is not
      // a budget failure, it is a resumption, so anything past the 50ms
      // accumulator clamp the integrator already uses is discounted here too.
      if (cost > BUDGET_MS && cost < 50) over++;

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
      armed = false;
    };
  }, [enabled, onStage]);
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
