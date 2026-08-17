// Timer engine (docs/PHASE2-CONTRACT.md): timestamp-math only, persists
// through reload/lock (fd5.v1.timers via state/persist.ts), `useProgram()`
// hook. Pure derivation lives in `deriveProgramState` (framework-free, unit
// tested with fake clocks for drift/pause/resume); the hook below only wires
// it to React (1Hz re-render tick + wake-lock best-effort).
import { useEffect, useMemo, useState } from "react";
import { getMeal } from "../data/meals";
import type { Slot } from "../data/types";
import { londonDateIso } from "../state/london";
import { useStore } from "../state/store";
import type { TimerSliceState } from "../state/types";
import { activeVariant } from "../data/variant";
import { getVariantProgram, type Program, type ProgramStep } from "./programs";

// ---------------------------------------------------------------------------
// Pure derivation (no React) — this is what src/engine/timers.test.ts drives
// with fake clocks.
// ---------------------------------------------------------------------------

export type ProgramStatus = "idle" | "running" | "paused" | "complete";

export interface TrackProgress {
  track: string;
  doneMin: number;
  totalMin: number;
  fraction: number; // 0..1
}

export interface ProgramDerivedState {
  status: ProgramStatus;
  elapsedMin: number;
  totalMin: number;
  /** True when a running, not-yet-done timed step's clock has hit zero — the
   * stopped-reel alarm trigger (PLAN §6.6). Cleared by doneStep() or
   * plusOneMinute() on that step, never by the mere passage of time. */
  dueNow: boolean;
  /** The single most-urgent "what to do right now" step: the active step
   * (clockStart <= elapsed, not yet marked done) with the latest clockStart
   * across every track. */
  stepNow: ProgramStep | null;
  /** All steps currently active (clockStart <= elapsed, not done) across
   * every track — for screens that want to show more than just stepNow
   * (e.g. a background badge for a second simmering track). */
  activeSteps: ProgramStep[];
  /** The next step to start, across every track (smallest clockStart > elapsed). */
  stepNext: ProgramStep | null;
  perTrackProgress: TrackProgress[];
  doneSteps: number[];
}

/** Elapsed ms since the program actually started, net of paused time and any
 * "+1 minute" extensions — pure epoch arithmetic (Date.now() diffs), so
 * accuracy only depends on the JS clock, never on setInterval's own drift.
 * That's what keeps drift <1s/30min regardless of tick cadence (contract). */
export function virtualElapsedMs(timers: TimerSliceState, nowMs: number): number {
  if (timers.startedAt == null) return 0;
  let pauseMs = timers.accumulatedPauseMs;
  if (timers.pausedAt != null) pauseMs += Math.max(0, nowMs - timers.pausedAt);
  return Math.max(0, nowMs - timers.startedAt - pauseMs - timers.extraMs);
}

function emptyTrackProgress(program: Program): TrackProgress[] {
  return program.tracks.map((t) => ({ track: t.id, doneMin: 0, totalMin: t.totalMinutes, fraction: 0 }));
}

/**
 * Derive the full renderable state of a program at instant `nowMs`, given
 * its persisted timer slice. `previewOffsetMinutes` is an ephemeral,
 * never-persisted look-ahead for scrub-preview (COOK's drag-to-scrub) — it
 * shifts the computed elapsed time without touching the real timer state.
 */
export function deriveProgramState(program: Program, timers: TimerSliceState, nowMs: number, previewOffsetMinutes = 0): ProgramDerivedState {
  if (timers.programId !== program.id || timers.startedAt == null) {
    return {
      status: "idle",
      elapsedMin: 0,
      totalMin: program.totalMinutes,
      dueNow: false,
      stepNow: null,
      activeSteps: [],
      stepNext: program.steps.filter((s) => s.clockStart != null).sort((a, b) => a.clockStart! - b.clockStart!)[0] ?? null,
      perTrackProgress: emptyTrackProgress(program),
      doneSteps: timers.doneSteps,
    };
  }

  const rawElapsedMin = virtualElapsedMs(timers, nowMs) / 60_000 + previewOffsetMinutes;
  const elapsedMin = Math.max(0, rawElapsedMin);

  const doneSet = new Set(timers.doneSteps);
  const lastStepN = program.steps.length ? Math.max(...program.steps.map((s) => s.n)) : null;
  const complete = lastStepN != null && doneSet.has(lastStepN);

  const clockedSteps = program.steps.filter((s) => s.clockStart != null);
  const activeSteps = clockedSteps
    .filter((s) => s.clockStart! <= elapsedMin && !doneSet.has(s.n))
    .sort((a, b) => b.clockStart! - a.clockStart!); // most-recently-started first = most urgent
  const stepNow = activeSteps[0] ?? null;
  const stepNext = clockedSteps.filter((s) => s.clockStart! > elapsedMin).sort((a, b) => a.clockStart! - b.clockStart!)[0] ?? null;

  const dueNow = !complete && activeSteps.some((s) => !s.untimed && s.minutes != null && s.clockStart! + s.minutes <= elapsedMin);

  const perTrackProgress: TrackProgress[] = program.tracks.map((t) => {
    const doneMin = Math.min(elapsedMin, t.totalMinutes);
    return { track: t.id, doneMin, totalMin: t.totalMinutes, fraction: t.totalMinutes > 0 ? doneMin / t.totalMinutes : 1 };
  });

  return {
    status: complete ? "complete" : timers.pausedAt != null ? "paused" : "running",
    elapsedMin,
    totalMin: program.totalMinutes,
    dueNow,
    stepNow,
    activeSteps,
    stepNext,
    perTrackProgress,
    doneSteps: timers.doneSteps,
  };
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseProgramResult {
  program: Program | null;
  state: ProgramDerivedState | null;
  load: (programId: string) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  plusOneMinute: () => void;
  doneStep: (step: number) => void;
  /** Ephemeral, in-memory-only look-ahead preview (never persisted) — pass
   * an offset in minutes; screens call this while dragging the reel, and
   * clearScrubPreview() on release ("spring-back" is the screen's animation
   * concern, this just stops shifting the computed state). */
  scrubPreview: (offsetMinutes: number) => void;
  clearScrubPreview: () => void;
  reset: () => void;
  /** Completion hooks (contract: "meal program -> eaten tick (shared);
   * prep session -> STORES yield stamps with computed use-by dates"). Exposed
   * as explicit calls the COOK screen makes (e.g. on the final "done ▸" tap)
   * rather than firing automatically on status=="complete", so completion is
   * a deliberate user action, not a side effect of a derived boolean. */
  completeMeal: () => void;
  completePrepSession: () => void;
}

const TICK_MS = 1000;

export function useProgram(): UseProgramResult {
  const { state, dispatch } = useStore();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [previewOffsetMinutes, setPreviewOffsetMinutes] = useState(0);

  // Variant-aware (docs/VARIANT-SPEC.md): resolves the tester's reduced
  // "prep-a-tester" id to its filtered program; every other id (including
  // every id in full mode) resolves identically to the old `getProgram` call.
  const variant = activeVariant(state);
  const program = useMemo(
    () => (state.timers.programId ? getVariantProgram(state.timers.programId, variant) : null),
    [state.timers.programId, variant]
  );

  const isTicking = state.timers.startedAt != null && state.timers.pausedAt == null;
  useEffect(() => {
    if (!isTicking) return;
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [isTicking]);

  // Wake-lock: best-effort, graceful fallback (R4 — iPhone Safari support is
  // inconsistent; timers stay correct regardless since they're epoch-based,
  // not interval-accumulated).
  useEffect(() => {
    if (!isTicking) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let sentinel: { release: () => Promise<void> } | undefined;
    let cancelled = false;
    (navigator as unknown as { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock
      .request("screen")
      .then((s) => {
        if (cancelled) void s.release();
        else sentinel = s;
      })
      .catch(() => {
        /* graceful fallback — no wake lock available; timer correctness is unaffected */
      });
    return () => {
      cancelled = true;
      void sentinel?.release();
    };
  }, [isTicking]);

  const derived = useMemo(
    () => (program ? deriveProgramState(program, state.timers, nowMs, previewOffsetMinutes) : null),
    [program, state.timers, nowMs, previewOffsetMinutes]
  );

  return {
    program,
    state: derived,
    load: (programId: string) => dispatch({ type: "timers/load", programId }),
    start: () => dispatch({ type: "timers/start" }),
    pause: () => dispatch({ type: "timers/pause" }),
    resume: () => dispatch({ type: "timers/resume" }),
    plusOneMinute: () => dispatch({ type: "timers/plusOneMinute" }),
    doneStep: (step: number) => dispatch({ type: "timers/doneStep", step }),
    scrubPreview: (offsetMinutes: number) => setPreviewOffsetMinutes(offsetMinutes),
    clearScrubPreview: () => setPreviewOffsetMinutes(0),
    reset: () => dispatch({ type: "timers/reset" }),
    completeMeal: () => {
      if (!program || program.kind !== "meal") return;
      const meal = getMeal(program.id);
      if (!meal) return;
      const date = londonDateIso(new Date());
      dispatch({ type: "eaten/tick", date, slot: meal.slot as Slot, mealId: meal.id });
    },
    completePrepSession: () => {
      if (!program || program.kind !== "prep") return;
      const week = program.id === "prep-a" ? "A" : "B";
      dispatch({ type: "prep/completeSession", week });
    },
  };
}
