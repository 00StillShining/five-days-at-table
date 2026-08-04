// Pure decision logic for the multi-tab localStorage race fix (owner ruling,
// pre-Phase-3). Kept separate from store.tsx (JSX/React, `window`-dependent
// effect wiring) so this repo — which has no jsdom/RTL dependency — can
// still directly unit-test the actual decisions being made, the same
// "pure core + thin React wrapper" split as state/reducer.ts vs store.tsx
// and engine/timers.ts's deriveProgramState vs its useProgram() hook.
//
// See store.tsx's own inline doc for the full narrative (the reproduced
// bug, why prevRef needed reseeding, the pending-write conflict rule).
import type { AppState, SliceKey } from "./types";
import { SLICE_KEYS, hasPendingWrite, parseAndValidateSlice, storageKey } from "./persist";

/**
 * Which slices actually changed between two AppState snapshots — reference
 * equality per slice, which is exactly what matters here: the reducer
 * always returns a new object for a slice it touched and preserves the
 * existing object reference for slices it didn't (`{...state, x: ...}`).
 * Mount-gating fix: seeding `prevRef` with the hydrated state itself (in
 * store.tsx) means the very first call here compares `state` against
 * itself — every slice reference-equal, nothing "changed", nothing gets
 * persisted just because the app booted.
 */
export function slicesChanged(prev: AppState, next: AppState): SliceKey[] {
  return SLICE_KEYS.filter((key) => prev[key] !== next[key]);
}

export type ForeignWriteResult =
  | { applied: true; slice: SliceKey; value: AppState[SliceKey] }
  | { applied: false; reason: "not-our-key" | "removal" | "local-pending" | "invalid" };

/**
 * The decision core of the cross-tab `storage`-event handler: given the
 * event's raw `key`/`newValue`, decide whether (and what) to merge into
 * live state. Never touches `window`/`StorageEvent` itself (that's
 * store.tsx's job — event.storageArea in particular needs a live `window`
 * to compare against and so isn't reproducible here); takes the two fields
 * that actually drive the decision as plain values instead.
 *
 * Order of checks mirrors store.tsx's documented conflict rule:
 * 1. Not one of our `fd5.v1.*` slice keys (or `newValue` is null — a
 *    foreign removal/clear, out of scope) -> ignore.
 * 2. This tab has its own debounced write for that slice still in flight
 *    (`hasPendingWrite`) -> ignore; the local pending write wins (documented
 *    "last-dispatch-wins locally" choice) and will land on disk moments
 *    later regardless of what the foreign write said.
 * 3. zod-rejects the foreign value (`parseAndValidateSlice`) -> ignore;
 *    already warned to the console by that function.
 * 4. Otherwise -> apply; this is a genuine foreign write for a slice this
 *    tab isn't mid-edit on, so it wins (the same last-WRITE-wins rule that
 *    was already the de facto behaviour at the localStorage layer — this
 *    just keeps in-memory state from silently drifting out of sync with it).
 */
export function resolveForeignWrite(key: string | null, newValue: string | null): ForeignWriteResult {
  if (newValue == null) return { applied: false, reason: "removal" };
  const slice = SLICE_KEYS.find((k) => storageKey(k) === key);
  if (!slice) return { applied: false, reason: "not-our-key" };
  if (hasPendingWrite(slice)) return { applied: false, reason: "local-pending" };
  const value = parseAndValidateSlice(slice, newValue);
  if (value === undefined) return { applied: false, reason: "invalid" };
  return { applied: true, slice, value };
}
