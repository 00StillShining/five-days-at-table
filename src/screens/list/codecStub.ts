// ============================================================================
// TEMPORARY STUB — DELETE ME ONCE src/engine/tripCodec.ts EXISTS.
// ============================================================================
// LIST (this screen, PLAN §6.9) and SHOP (built in parallel by a different
// builder) share one PINNED envelope contract for the trip that travels
// desktop -> phone in the URL fragment (D2 / PLAN §6.8-6.9):
//
//   { v, tripId, createdOn, kind,
//     shops: [{ code, name, rows: [{ ingId, label, qty, packG, price,
//                                     estimate, verify, aisle }] }],
//     totals }
//   encodeTrip(envelope) -> string
//   decodeTrip(str)       -> envelope | null
//
// src/engine/tripCodec.ts did not exist yet when this screen was built, so
// this file re-implements that exact contract locally (src/screens/list/**
// is this screen's only allowed ownership — engine/ is out of bounds except
// for READING the real file once it lands). Every consumer in this screen
// imports the TripEnvelope/TripShop/TripRow types and encodeTrip/decodeTrip
// functions from HERE ONLY (see index.tsx's import line) so that swapping
// this file out for `import ... from "../../engine/tripCodec"` is a
// one-line change with nothing else to touch.
//
// ASSUMPTIONS this stub had to make that the real tripCodec.ts must confirm
// (flagged in the build report too):
//   - `qty` is a PRE-FORMATTED display string ("× 4", "1kg"), not a raw
//     number — the mock (PLAN §6.9) shows both counted and weighed forms
//     and LIST has no ingredient-spec data of its own to reformat a number.
//   - `kind` is a free string ("day0"/"day7" guessed from selectors.ts
//     TripDay); LIST treats it as opaque except for display + arbiter tripDay
//     inference (see model.ts `inferTripDayFromKind`).
//   - `totals` is `{ subtotal, byShop }`; LIST recomputes its own running
//     "spent so far" from ticked rows regardless (the odometer is about
//     ticked spend, not the trip's planned subtotal), so totals is read only
//     for the trip-summary screen's "planned total" line.
//   - shop `code` is one of the existing `Shop` codes ("S"|"M"|"X" —
//     src/data/types.ts) but this stub accepts any string defensively.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

export interface TripRow {
  ingId: string;
  label: string;
  /** Pre-formatted display quantity, e.g. "× 4" or "1kg" — see assumptions above. */
  qty: string;
  packG: number;
  price: number; // planned/estimated £ at desk
  estimate: boolean;
  /** This row is a price-verify candidate (SHOP's verifyNominees, carried per-row). */
  verify: boolean;
  aisle: string;
}

export interface TripShop {
  code: string; // "S" | "M" | "X" in practice
  name: string; // "sainsbury's" | "morrisons" | "lewisham market"
  rows: TripRow[];
}

export interface TripTotals {
  subtotal: number;
  byShop: Record<string, number>;
}

export interface TripEnvelope {
  v: number;
  tripId: string;
  createdOn: string; // ISO date
  kind: string; // "day0" | "day7" (opaque otherwise)
  shops: TripShop[];
  totals: TripTotals;
}

function isRow(x: unknown): x is TripRow {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.ingId === "string" &&
    typeof r.label === "string" &&
    typeof r.qty === "string" &&
    typeof r.packG === "number" &&
    typeof r.price === "number" &&
    typeof r.estimate === "boolean" &&
    typeof r.verify === "boolean" &&
    typeof r.aisle === "string"
  );
}

function isShop(x: unknown): x is TripShop {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return typeof s.code === "string" && typeof s.name === "string" && Array.isArray(s.rows) && s.rows.every(isRow);
}

/** Defensive, hand-rolled shape check (no zod here — screens don't carry
 * that dependency per PHASE2-CONTRACT's "Deps allowed" list; zod is a
 * state/-layer tool). Rejects anything that doesn't match the pinned shape
 * rather than trusting a corrupt/foreign fragment. */
export function isTripEnvelope(x: unknown): x is TripEnvelope {
  if (!x || typeof x !== "object") return false;
  const t = x as Record<string, unknown>;
  if (typeof t.v !== "number" || typeof t.tripId !== "string" || typeof t.createdOn !== "string" || typeof t.kind !== "string") {
    return false;
  }
  if (!Array.isArray(t.shops) || !t.shops.every(isShop)) return false;
  if (!t.totals || typeof t.totals !== "object") return false;
  const totals = t.totals as Record<string, unknown>;
  if (typeof totals.subtotal !== "number" || !totals.byShop || typeof totals.byShop !== "object") return false;
  return true;
}

export function encodeTrip(trip: TripEnvelope): string {
  return compressToEncodedURIComponent(JSON.stringify(trip));
}

export function decodeTrip(str: string): TripEnvelope | null {
  try {
    const json = decompressFromEncodedURIComponent(str);
    if (!json) return null;
    const parsed: unknown = JSON.parse(json);
    return isTripEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
