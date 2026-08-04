// SESSION-ONLY shim — see data/raw/decision-request.plan.json.
//
// AppState (src/state/types.ts) has no `swaps` slice, and there is no
// extension point a screen can hook into without editing src/state/**
// (forbidden by this screen's ownership rules). Until a real slice lands
// there (decision-request filed), swap commits live in this plain
// module-level singleton instead of the store: an ES module is only
// instantiated once per page load, so this survives navigating away from
// and back to PLAN (unlike component state, which would reset on unmount),
// but it is NOT persisted to localStorage and NOT visible to any other
// screen — SHOP cannot read it later to compute shopping deltas, which is
// what PHASE2-CONTRACT actually requires of a committed swap. Replace this
// whole file wholesale once the real slice exists: swap `useSwaps()` for
// `useStore().state.swaps` and `commitSwap()` for a `swaps/set` dispatch —
// both call sites live only in src/screens/plan/index.tsx and SwapDeck.tsx.
import { useSyncExternalStore } from "react";
import type { Slot, Week } from "../../data/types";

/** "<week>:<day>:<slot>" -> replacement mealId. */
export type SwapMap = Record<string, string>;

export function swapKeyOf(week: Week, day: number, slot: Slot): string {
  return `${week}:${day}:${slot}`;
}

let swaps: SwapMap = {};
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function getSnapshot(): SwapMap {
  return swaps;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function commitSwap(key: string, candidateMealId: string): void {
  swaps = { ...swaps, [key]: candidateMealId };
  emit();
}

export function clearSwap(key: string): void {
  if (!(key in swaps)) return;
  const next = { ...swaps };
  delete next[key];
  swaps = next;
  emit();
}

/** Live-subscribed read of the current swap map (re-renders on every commit/clear). */
export function useSwaps(): SwapMap {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
