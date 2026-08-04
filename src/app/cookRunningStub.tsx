import { createContext, useContext, type ReactNode } from "react";

/**
 * Placeholder for the cook-engine's "a program is running" signal
 * (docs/PHASE2-CONTRACT.md build step 4). src/engine/timers.ts + programs.ts will
 * drive a real value once built — this context always reports false for now. Wire
 * the real provider around AppShell when the engine lands; no other chassis code
 * (Masthead's status text, LoopRail's pulsing cook key) should need to change.
 */
const CookRunningContext = createContext(false);

export function CookRunningProvider({ children }: { children: ReactNode }) {
  return <CookRunningContext.Provider value={false}>{children}</CookRunningContext.Provider>;
}

export function useCookRunning(): boolean {
  return useContext(CookRunningContext);
}
