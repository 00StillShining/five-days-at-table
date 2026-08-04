// Trip envelope encode/decode — the SHOP -> LIST handoff (PLAN §6.8/§6.9,
// D2: the shopping list travels desktop -> phone entirely in the URL
// fragment, compressed with lz-string; check-off state stays on the phone).
//
// Envelope shape below is PINNED (docs/PHASE2-CONTRACT.md task briefs:
// "pinned by the orchestrator — LIST depends on this exactly") — do not
// rename or retype these fields without an orchestrator ruling; LIST reads
// them by name.
//
// The pin covers the TripEnvelope TYPE that encodeTrip accepts and
// decodeTrip returns — not the wire bytes in between. Internally this file
// serializes a denser array-based form (short keys, rows as tuples) before
// lz-string compression: a real "Week A, twice" day-0 trip (~49 shopping
// lines) serialized as the literal named-field JSON shape compresses to
// ~3.4k characters, which exceeds a QR code's absolute hard limit (2 953
// bytes at version 40 / level L, byte mode — src/screens/shop/qr.ts) with no
// way to raise that ceiling further. The same trip through the compact wire
// form compresses to ~2.2k characters — comfortably inside a single QR, and
// a shorter URL fragment either way. decodeTrip() always rehydrates the
// exact pinned TripEnvelope shape; callers never see the wire format.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { z } from "zod";
import type { Shop } from "../data/types";

export interface TripRow {
  ingId: string;
  label: string;
  /** Packs to buy (not a display string — LIST already receives `packG`
   * alongside this and derives its own "× 4" / "1kg" presentation, per
   * PLAN §6.9; SHOP doesn't invent LIST's row copy on its behalf). */
  qty: number;
  packG: number;
  price: number;
  estimate: boolean;
  /** This row is one of the trip's price-verify nominees (state/selectors.ts
   * tripBuild().verifyNominees), carried per-row so LIST doesn't need the
   * whole trip's nominee list to know which rows to flag. */
  verify: boolean;
  aisle: string;
}

export interface TripShop {
  code: Shop;
  name: string;
  rows: TripRow[];
}

export type TripKind = "full" | "day7";

export interface TripTotals {
  overall: number;
  byShop: Record<string, number>;
}

export interface TripEnvelope {
  v: 1;
  tripId: string;
  createdOn: string; // ISO datetime
  kind: TripKind;
  shops: TripShop[];
  totals: TripTotals;
}

const SHOP_CODES: readonly Shop[] = ["S", "M", "X"];

/** "t" + yyyymmdd + "-" + a short random suffix. Contract: "deterministic
 * per build call is fine" — this only needs to be stable for the life of one
 * built trip (SHOP calls it once per trip build and holds the result in
 * state), not a globally-unique id scheme. */
export function makeTripId(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
  return `t${yyyy}${mm}${dd}-${rand}`;
}

// ---- compact wire format (internal — never exposed to callers) ----------

/** Row tuple: [ingId, label, qty, packG, price, estimate(0|1), verify(0|1), aisle]. */
type WireRow = [string, string, number, number, number, 0 | 1, 0 | 1, string];
/** Shop tuple: [code, name, rows]. */
type WireShop = [string, string, WireRow[]];
interface WireEnvelope {
  v: 1;
  t: string; // tripId
  c: string; // createdOn
  k: "f" | "7"; // kind
  s: WireShop[]; // shops
  o: number; // totals.overall
  b: Record<string, number>; // totals.byShop
}

function toWire(trip: TripEnvelope): WireEnvelope {
  return {
    v: 1,
    t: trip.tripId,
    c: trip.createdOn,
    k: trip.kind === "full" ? "f" : "7",
    s: trip.shops.map(
      (shop): WireShop => [
        shop.code,
        shop.name,
        shop.rows.map((r): WireRow => [r.ingId, r.label, r.qty, r.packG, r.price, r.estimate ? 1 : 0, r.verify ? 1 : 0, r.aisle]),
      ]
    ),
    o: trip.totals.overall,
    b: trip.totals.byShop,
  };
}

// ---- zod validation of the wire shape --------------------------------------
// decodeTrip must never throw (contract) — a tampered fragment, a stray
// character clipped off by a copy-paste, or a foreign QR entirely are all
// realistic inputs from the "phone opens a link" path, not just malice.

const WireRowSchema = z.tuple([
  z.string(),
  z.string(),
  z.number(),
  z.number(),
  z.number(),
  z.union([z.literal(0), z.literal(1)]),
  z.union([z.literal(0), z.literal(1)]),
  z.string(),
]);
const WireShopSchema = z.tuple([z.string(), z.string(), z.array(WireRowSchema)]);
const WireEnvelopeSchema = z.object({
  v: z.literal(1),
  t: z.string(),
  c: z.string(),
  k: z.union([z.literal("f"), z.literal("7")]),
  s: z.array(WireShopSchema),
  o: z.number(),
  b: z.record(z.string(), z.number()),
});

function fromWire(wire: z.infer<typeof WireEnvelopeSchema>): TripEnvelope | null {
  const shops: TripShop[] = [];
  for (const [code, name, rows] of wire.s) {
    if (!SHOP_CODES.includes(code as Shop)) return null; // foreign/corrupt shop code — refuse rather than guess
    shops.push({
      code: code as Shop,
      name,
      rows: rows.map(
        (r): TripRow => ({ ingId: r[0], label: r[1], qty: r[2], packG: r[3], price: r[4], estimate: r[5] === 1, verify: r[6] === 1, aisle: r[7] })
      ),
    });
  }
  return {
    v: 1,
    tripId: wire.t,
    createdOn: wire.c,
    kind: wire.k === "f" ? "full" : "day7",
    shops,
    totals: { overall: wire.o, byShop: wire.b },
  };
}

/** Trip -> compressed, URL-fragment-safe string (lz-string
 * compressToEncodedURIComponent, per contract). Callers build the full link
 * as `${location.origin}${location.pathname}#/list?t=${encodeTrip(trip)}`. */
export function encodeTrip(trip: TripEnvelope): string {
  return compressToEncodedURIComponent(JSON.stringify(toWire(trip)));
}

/** Compressed string -> validated TripEnvelope, or null on ANY failure
 * (corrupt lz-string payload, invalid JSON, schema mismatch, tampering) —
 * never throws, per contract. */
export function decodeTrip(str: string): TripEnvelope | null {
  if (!str) return null;
  let json: string | null;
  try {
    json = decompressFromEncodedURIComponent(str);
  } catch {
    return null;
  }
  if (!json) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  const result = WireEnvelopeSchema.safeParse(parsed);
  if (!result.success) return null;
  return fromWire(result.data);
}
