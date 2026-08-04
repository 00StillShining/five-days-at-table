// State core (F2). The exported API is contract-pinned
// (docs/PHASE2-CONTRACT.md "State core API" — screens/chassis code against
// `useStore()` and must not care about the implementation below).
//
// Persistence model: one localStorage key per slice (`fd5.v1.<slice>`),
// debounced writes, zod-validated hydration — see state/persist.ts. The
// reducer itself (state/reducer.ts) is pure and framework-free so it's
// directly unit-testable; this file only wires it to React + localStorage.
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { AppState, Action, SliceKey } from "./types";
import { reducer, defaultState } from "./reducer";
import { hydrateAll, persistSlice } from "./persist";

export type { AppState, Action, Prefs, Inventory, InventoryEntry, InventoryLevel, Eaten, EatenTick, ShopTicks, ShopTick, LeftoverEntry, WasteEntry, PriceChecks, PriceCheck, TimerSliceState } from "./types";
export type { Cover, Week } from "../data/types";

const SLICE_KEYS: SliceKey[] = ["prefs", "inventory", "eaten", "shopTicks", "leftovers", "waste", "priceChecks", "timers"];

interface StoreContextValue {
  state: AppState;
  dispatch: (a: Action) => void;
}

const Ctx = createContext<StoreContextValue | null>(null);

function init(): AppState {
  if (typeof window === "undefined") return defaultState;
  return hydrateAll(defaultState);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  // Persist each slice independently, debounced, whenever it changes —
  // avoids writing all eight keys on every single dispatch.
  const prevRef = useRef<AppState | undefined>(undefined);
  useEffect(() => {
    const prev = prevRef.current;
    for (const key of SLICE_KEYS) {
      if (prev === undefined || prev[key] !== state[key]) {
        persistSlice(key, state[key]);
      }
    }
    prevRef.current = state;
  }, [state]);

  const value = useMemo<StoreContextValue>(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}
