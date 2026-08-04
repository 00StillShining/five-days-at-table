// PLACEHOLDER — the F2 state-core builder replaces this file's implementation.
// The exported API below is contract-pinned (docs/PHASE2-CONTRACT.md); consumers
// (chassis, screens) code against it and must not care which implementation is live.
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Cover = "w" | "m";
export type Week = "A" | "B";
export interface Prefs {
  cover: Cover;
  week: Week;
  scale: number;
  serveTime: string; // "19:30"
  cycleStartSaturday: string | null; // ISO date
}
export interface AppState {
  prefs: Prefs;
}
export type Action = { type: "prefs/set"; patch: Partial<Prefs> };

const defaultState: AppState = {
  prefs: { cover: "w", week: "A", scale: 1, serveTime: "19:30", cycleStartSaturday: null },
};

const Ctx = createContext<{ state: AppState; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(defaultState);
  const value = useMemo(
    () => ({
      state,
      dispatch: (a: Action) => {
        if (a.type === "prefs/set") setState((s) => ({ ...s, prefs: { ...s.prefs, ...a.patch } }));
      },
    }),
    [state]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}
