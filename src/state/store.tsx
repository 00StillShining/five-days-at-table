// State core (F2). The exported API is contract-pinned
// (docs/PHASE2-CONTRACT.md "State core API" — screens/chassis code against
// `useStore()` and must not care about the implementation below).
//
// Persistence model: one localStorage key per slice (`fd5.v1.<slice>`),
// debounced writes, zod-validated hydration — see state/persist.ts. The
// reducer itself (state/reducer.ts) is pure and framework-free so it's
// directly unit-testable; this file only wires it to React + localStorage.
// Same split for the multi-tab race fix below: the actual decision logic
// lives in state/crossTab.ts (pure, unit-tested directly — this repo has no
// jsdom/RTL to render StoreProvider itself against); this file is just the
// `useEffect`/`window.addEventListener` wiring around it.
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { AppState, Action, SliceKey } from "./types";
import { reducer, defaultState } from "./reducer";
import { hydrateAll, persistSlice, SLICE_KEYS } from "./persist";
import { resolveForeignWrite, slicesChanged } from "./crossTab";

export type { AppState, Action, Prefs, Inventory, InventoryEntry, InventoryLevel, Eaten, EatenTick, ShopTicks, ShopTick, LeftoverEntry, WasteEntry, PriceChecks, PriceCheck, TimerSliceState, Swaps } from "./types";
export type { Cover, Week } from "../data/types";

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

  // Multi-tab race fix (owner ruling, pre-Phase-3): a corrupt-localStorage
  // reviewer reproduced a ~369ms clobber — opening a second tab within the
  // first tab's 500ms debounce window caused the SECOND tab's mount to
  // re-echo every slice of its own freshly-hydrated (and by then already
  // slightly stale) state back over the FIRST tab's genuine, in-flight edit.
  // Root cause: `prevRef` started as `undefined`, so the very first effect
  // run always treated every slice as "changed" and persisted all eight —
  // even though nothing had actually been dispatched yet, just hydrated.
  //
  // Fix (part 1, mount gating): seed `prevRef` with the hydrated `state`
  // itself (not `undefined`) — `useRef`'s initializer argument is only used
  // on the very first render, so this captures exactly the post-hydration
  // state before any dispatch. The first effect run then diffs `prev[key]`
  // against `state[key]` for the SAME object reference on every key ->
  // zero writes on mount. Only a genuine dispatch (which the reducer always
  // answers with a new object for the slice(s) it touched, via `{...state,
  // changedSlice: ...}`) makes `prev[key] !== state[key]` true for the
  // specific slice(s) that actually changed — so mounting a tab can never
  // again silently rewrite slices it didn't touch.
  const prevRef = useRef<AppState>(state);
  // See the cross-tab effect below: when a foreign tab's write is merged in
  // via `slice/replace`, that slice must not be persisted straight back out
  // (it's already exactly what's on disk — echoing it is wasted work and,
  // with two tabs open, would keep bouncing a `storage` event back and
  // forth). One-shot per slice, consumed the next time the persist effect runs.
  const skipNextPersistRef = useRef<Set<SliceKey>>(new Set());

  useEffect(() => {
    for (const key of slicesChanged(prevRef.current, state)) {
      if (skipNextPersistRef.current.delete(key)) continue; // just applied FROM storage — already on disk
      persistSlice(key, state[key]);
    }
    prevRef.current = state;
  }, [state]);

  // Fix (part 2, cross-tab rehydrate): listen for OTHER tabs' writes to any
  // fd5.v1.* key (the native `storage` event never fires in the tab that
  // made the write, only in every OTHER same-origin tab/window) and merge
  // that slice into this tab's live state — re-validated with the exact
  // same zod schema boot-time hydration uses (parseAndValidateSlice),
  // so corrupt/malformed foreign data is dropped with a console.warn,
  // never applied.
  //
  // Conflict rule (documented, deliberately simple over clever): if THIS
  // tab has its own debounced write for that slice still pending
  // (hasPendingWrite), the foreign value is ignored — this tab's own
  // pending write will land on disk moments later and become the final
  // value regardless, so applying the foreign value first would just be
  // immediately overwritten anyway, and skipping it avoids a visible
  // flicker/undo of an edit the user just made in THIS tab. If there's no
  // local pending write for that slice, the foreign write is trusted and
  // applied — last WRITE wins across tabs, which is the same rule that was
  // already implicitly in effect at the localStorage layer; this just keeps
  // the in-memory state consistent with it instead of silently drifting
  // until the next reload.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onStorage(event: StorageEvent) {
      if (event.storageArea !== window.localStorage) return; // ignore sessionStorage/foreign-area events
      const decision = resolveForeignWrite(event.key, event.newValue);
      if (!decision.applied) return; // not ours / a removal / this tab's own pending write wins / zod-rejected
      skipNextPersistRef.current.add(decision.slice);
      dispatch({ type: "slice/replace", slice: decision.slice, value: decision.value });
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<StoreContextValue>(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}
