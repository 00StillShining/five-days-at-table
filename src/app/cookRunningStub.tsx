import { createContext, useContext, useMemo, type ReactNode } from "react";
import { getProgram } from "../engine/programs";
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

export function useCookRunning(): boolean {
  return useContext(CookRunningContext);
}
