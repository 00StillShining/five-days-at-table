// Trip intake + localStorage persistence for LIST (PLAN §6.9: "Trip intake:
// `#/list?t=...` -> decodeTrip -> persist trip to localStorage... offline
// reopen must work without the fragment").
//
// ROUTER GAP (flagged in the build report as a shared-change request):
// src/app/router.ts's `parseHash()` splits the hash on "/" only and never
// strips a query string. A raw "#/list?t=<payload>" hash is therefore parsed
// as the single unknown screen id "list?t=<payload>", which fails the
// `KNOWN_SCREENS.includes(...)` check and makes `useHashRoute()`'s own effect
// silently rewrite the URL to "#/today" BEFORE this screen ever mounts —
// permanently dropping the trip payload. src/app/router.ts is chassis
// (owned by F1, out of LIST's `src/screens/list/**` ownership), so this
// module works around it entirely from inside LIST's own files instead of
// touching the shared router:
//
//   scenes.tsx statically imports every screen module (including this one,
//   transitively via ./index.tsx) BEFORE main.tsx ever calls
//   createRoot(...).render(...) — i.e. before React exists, before any
//   component has mounted, and therefore before the router's own
//   useHashRoute effect has had a chance to run. This module's top-level
//   (module-scope) code therefore runs first and can normalize
//   "#/list?t=<payload>" down to the router-safe "#/list" — stashing the
//   payload on the way — before the router ever sees the problematic form.
//
// A `hashchange` listener registered here (also ahead of the router's own
// subscription, for the same reason) repeats the same normalization for the
// rarer case of the hash changing to a "?t=" form while the app is already
// running in the same tab.
import { decodeTrip, isTripEnvelope, type TripEnvelope } from "./codecStub";

const FRAGMENT_RE = /^#\/list\?t=(.+)$/;

let capturedFragmentPayload: string | null = null;

function normalizeListHash(): void {
  if (typeof window === "undefined") return;
  const raw = window.location.hash;
  const match = FRAGMENT_RE.exec(raw);
  if (!match) return;
  capturedFragmentPayload = match[1];
  // Rewrite BEFORE the router's effect runs (see module doc) so
  // useHashRoute() resolves "list" cleanly instead of redirecting to today.
  window.location.hash = "#/list";
}

if (typeof window !== "undefined") {
  normalizeListHash();
  window.addEventListener("hashchange", normalizeListHash);
}

/**
 * Consume (and clear) the trip payload captured from the initial
 * "#/list?t=…" hash, if any. Returns null on every subsequent call (or if no
 * fragment was ever present) so a later re-render never re-decodes stale
 * state — callers should call this exactly once, from a lazy useState
 * initializer.
 */
export function takeInitialTripFragment(): string | null {
  const v = capturedFragmentPayload;
  capturedFragmentPayload = null;
  return v;
}

// ---------------------------------------------------------------------------
// localStorage persistence — screen-local keys, distinct from the
// contract-pinned `fd5.v1.<slice>` AppState keys (state/persist.ts): the trip
// PAYLOAD itself (shops/rows/prices) isn't part of AppState (PLAN §5 only
// lists shopTicks/priceChecks as runtime state — the trip's content is
// SHOP's data, merely cached here so LIST survives an offline reopen).
// ---------------------------------------------------------------------------

const TRIP_KEY_PREFIX = "fd5.v1.trip.";
const LAST_TRIP_KEY = "fd5.v1.lastTrip";

export function tripStorageKey(tripId: string): string {
  return `${TRIP_KEY_PREFIX}${tripId}`;
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null; // private-mode / disabled storage
  }
}

/** Cache a decoded trip + mark it "last opened" (offline reopen source of truth). */
export function saveTrip(trip: TripEnvelope): void {
  const backend = getStorage();
  if (!backend) return;
  try {
    backend.setItem(tripStorageKey(trip.tripId), JSON.stringify(trip));
    backend.setItem(LAST_TRIP_KEY, trip.tripId);
  } catch {
    // quota exceeded / storage disabled — never crash the shopping trip over this
  }
}

export function loadTrip(tripId: string): TripEnvelope | null {
  const backend = getStorage();
  if (!backend) return null;
  try {
    const raw = backend.getItem(tripStorageKey(tripId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isTripEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** The trip to reopen when LIST loads with no "?t=" fragment at all (a plain
 * "#/list" reload/bookmark, PLAN §6.9's offline requirement). */
export function loadLastTrip(): TripEnvelope | null {
  const backend = getStorage();
  if (!backend) return null;
  try {
    const tripId = backend.getItem(LAST_TRIP_KEY);
    return tripId ? loadTrip(tripId) : null;
  } catch {
    return null;
  }
}

/**
 * Resolve "the trip to show right now", exactly once at mount: prefer a
 * fresh fragment (decode + cache it), else fall back to whatever was last
 * cached. `decodeTrip` (not re-exported directly) is threaded through here so
 * this is the single choke point index.tsx needs to call.
 */
export function resolveInitialTrip(): TripEnvelope | null {
  const fragment = takeInitialTripFragment();
  if (fragment) {
    const decoded = decodeTrip(fragment);
    if (decoded) {
      saveTrip(decoded);
      return decoded;
    }
    // Corrupt/foreign fragment: fall through to whatever was cached rather
    // than showing "no trip" when a perfectly good previous trip exists.
  }
  return loadLastTrip();
}
