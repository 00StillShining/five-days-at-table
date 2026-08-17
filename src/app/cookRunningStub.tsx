import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getProgram } from "../engine/programs";
import { virtualElapsedMs } from "../engine/timers";
import { useStore } from "../state/store";

/**
 * The cook-engine's "a program is running" signal (docs/PHASE2-CONTRACT.md
 * build step 4 / COOK wave-2 ownership note: this file is the designated
 * swap point, so the rail's pulsing cook key + masthead status region react
 * to the real engine without any other chassis file changing).
 *
 * Deliberately NOT `useProgram()` (src/engine/timers.ts) here, even though
 * that hook already computes this — `useProgram()` also runs a 1Hz tick and
 * requests a wake lock whenever a program is actively running, both scoped
 * to "make the CURRENT screen's own timer display accurate". This context
 * is mounted for the WHOLE app (every screen, always), so it re-renders on
 * every dispatch anywhere (any useStore() consumer does); running its own
 * duplicate tick/wake-lock here as well would be pure overhead with no
 * benefit, since "is a program running" (unlike "how many seconds are
 * left") doesn't actually depend on wall-clock ticking at all — it's
 * derived purely from `state.timers` (start/pause) and `doneSteps` vs. the
 * compiled program's own step count, exactly like
 * engine/timers.ts#deriveProgramState's own `status` field, just inlined
 * here without the per-second `nowMs` dependency that field doesn't need.
 */
const CookRunningContext = createContext(false);

function isCookRunning(programId: string | null, startedAt: number | null, pausedAt: number | null, doneSteps: number[]): boolean {
  if (programId == null || startedAt == null || pausedAt != null) return false;
  const program = getProgram(programId);
  if (!program) return false; // stale/unknown programId (defensive — see engine/programs.ts#getProgram)
  const lastStepN = program.steps.length ? Math.max(...program.steps.map((s) => s.n)) : null;
  const complete = lastStepN != null && doneSteps.includes(lastStepN);
  return !complete;
}

export function CookRunningProvider({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const { programId, startedAt, pausedAt, doneSteps } = state.timers;
  const running = useMemo(
    () => isCookRunning(programId, startedAt, pausedAt, doneSteps),
    [programId, startedAt, pausedAt, doneSteps]
  );
  return <CookRunningContext.Provider value={running}>{children}</CookRunningContext.Provider>;
}

/**
 * Plain boolean, changes only on genuine start/pause/complete transitions
 * (see the doc comment above `isCookRunning`). Consumed app-wide (App.tsx,
 * LoopRail's pulsing cook key) — deliberately NEVER carries a per-second
 * value, so those consumers don't re-render every tick. For the masthead's
 * ticking "cooking · MM:SS" text, use `useCookElapsedLabel()` below instead,
 * from a small isolated component — see its doc comment for why.
 */
export function useCookRunning(): boolean {
  return useContext(CookRunningContext);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** "MM:SS" elapsed since the running program actually started (pause-aware, via
 * engine/timers.ts's own `virtualElapsedMs` — same math the COOK screen's own
 * clock uses, so the masthead never disagrees with it). */
function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${pad2(seconds)}`;
}

/**
 * The masthead's "cooking · MM:SS" text (PLAN §6.2), ~1Hz while a program
 * runs, `null` otherwise. Deliberately NOT folded into CookRunningContext's
 * boolean above: that value is read by the whole chassis and must only
 * change on genuine start/pause/complete transitions. This hook keeps its
 * own 1Hz interval, so call it ONLY from a small leaf component (the
 * masthead's status text) — React scopes the resulting re-renders to that
 * leaf, not the chassis around it, exactly like COOK's own useProgram() tick
 * is scoped to COOK's own scene rather than re-rendering the whole app.
 */
export function useCookElapsedLabel(): string | null {
  return useCookProgress()?.label ?? null;
}

export interface CookProgress {
  /** "MM:SS" elapsed, pause-aware. The EXACT figure, never a rounded one. */
  label: string;
  /**
   * Elapsed / the program's own totalMinutes, clamped to 0-1. Real progress
   * against a real declared total — never a synthetic curve. When a program
   * runs past its own total the fraction sits at 1 and the label keeps
   * counting, because the clock is the truth and the arc has simply closed.
   */
  fraction: number;
  /** The program's declared length in whole minutes, for the printed figure. */
  totalMin: number;
  /**
   * Epoch ms at which this reading was computed. CORRECTIONARY 4: "every live
   * reading shows its exact figure AND ITS AGE." Without this the chassis
   * cannot tell a running arc from a frozen one, and a frozen arc that keeps
   * its confident face is exactly the "silently going wrong" the honesty rule
   * forbids. src/cd/freshness/classes.ts already declares the threshold for
   * this class of reading: FRESHNESS.timer, 2000ms, the word NO SIGNAL.
   */
  takenAt: number;
}

/**
 * The chassis's own live reading: elapsed, and elapsed as a fraction of the
 * program's declared total. `null` when nothing is running — the chassis then
 * has nothing to report and says nothing, which is the whole point of a
 * language whose field "never asks for attention and never withholds a fact".
 *
 * Same isolation rule as the label it replaced: this hook owns a 1Hz interval,
 * so it is called ONLY from a small leaf (the rail's Cycle Cap). React scopes
 * the per-second re-render to that leaf; the chassis around it never ticks.
 */
export function useCookProgress(): CookProgress | null {
  const { state } = useStore();
  const { programId, startedAt, pausedAt, doneSteps } = state.timers;
  const running = useMemo(
    () => isCookRunning(programId, startedAt, pausedAt, doneSteps),
    [programId, startedAt, pausedAt, doneSteps]
  );

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNowMs(Date.now()); // resync immediately on start, don't wait a full second
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  if (!running) return null;
  const elapsedMs = virtualElapsedMs(state.timers, nowMs);
  const program = programId != null ? getProgram(programId) : null;
  const totalMin = program?.totalMinutes ?? 0;
  const totalMs = totalMin * 60_000;
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, elapsedMs / totalMs)) : 0;
  return { label: formatElapsed(elapsedMs), fraction, totalMin, takenAt: nowMs };
}
