// Trip intake + localStorage persistence for LIST (PLAN §6.9: "Trip intake:
// `#/list?t=...` -> decodeTrip -> persist trip to localStorage... offline
// reopen must work without the fragment").
//
// The router gap this module used to work around (src/app/router.ts's
// parseHash() not stripping a query string before segment-matching, which
// made "#/list?t=<payload>" redirect to "#/today" before this screen ever
// mounted) is fixed in the router itself now — parseHash() strips "?..."
// before matching and exposes it as `route.query`. index.tsx passes
// `route.query` straight into resolveInitialTrip() below; no hash-rewriting
// or early/module-scope capture is needed anymore.
//
// CODEC: src/engine/tripCodec.ts (real, orchestrator-pinned contract — this
// screen shipped against a local src/screens/list/codecStub.ts guess before
// tripCodec.ts existed; codecStub.ts is deleted now that it does, see the
// build report's "codec integration status").
import { decodeTrip, encodeTrip, type TripEnvelope } from "../../engine/tripCodec";

/**
 * Pull "t=<payload>" out of a raw route query string. Manual parsing, not
 * URLSearchParams: the lz-string alphabet (engine/tripCodec.ts) includes
 * literal "+" characters, which application/x-www-form-urlencoded parsing
 * (what URLSearchParams implements) would silently rewrite to spaces,
 * corrupting the payload. See router.ts's `Route.query` doc comment.
 */
function extractTripPayload(query: string): string | null {
  const match = /(?:^|&)t=([^&]*)/.exec(query);
  return match && match[1] ? match[1] : null;
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

/**
 * Cache a decoded trip + mark it "last opened" (offline reopen source of
 * truth). Stored as the SAME compressed wire string `encodeTrip` produces
 * for the URL fragment (not `JSON.stringify(trip)`) — re-running it through
 * `decodeTrip` on read reuses the codec's own zod validation instead of
 * this screen maintaining a second, hand-rolled TripEnvelope type guard that
 * could drift from the real one.
 */
export function saveTrip(trip: TripEnvelope): void {
  const backend = getStorage();
  if (!backend) return;
  try {
    backend.setItem(tripStorageKey(trip.tripId), encodeTrip(trip));
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
    return decodeTrip(raw); // null on any corruption/schema mismatch — never throws
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
 * fresh fragment (decode + cache it) from the route's query string (pass
 * `route.query` — router.ts's Route.query, e.g. "t=abc" from "#/list?t=abc"),
 * else fall back to whatever was last cached. `decodeTrip` (not re-exported
 * directly) is threaded through here so this is the single choke point
 * index.tsx needs to call.
 */
export function resolveInitialTrip(query: string): TripEnvelope | null {
  const fragment = extractTripPayload(query);
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
