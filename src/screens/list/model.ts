/**
 * src/screens/list/model.ts — LIST's pure arithmetic, in 20 IRREDUCIBLE.
 *
 * No DOM, no timers, no React. Everything here operates on the trip envelope
 * (src/engine/tripCodec.ts, orchestrator-pinned) and the contract-pinned
 * shopTicks / priceChecks slices — never on src/data directly, because every
 * field a row needs already travels on the row.
 *
 * THE SHAPE OF THE SCREEN, AND WHY THE FUNCTIONS BELOW EXIST
 * ---------------------------------------------------------------------------
 * IRREDUCIBLE's Trophy clause is the structural idea the whole screen is built
 * on: "Every healthy station simply is not rendered — a blank plate has nothing
 * to report, and this language does not spend a pixel proving a fact already
 * true by absence." On a shopping list that reads as: A ROW YOU HAVE BOUGHT IS
 * NOT RENDERED. The register empties itself as the trolley fills, which is why
 * `owedRows` and `boughtRows` are the two partitions everything else is
 * derived from, and why nothing here needs a scroll position.
 *
 * The 1800ms run-out (§5, the exception II.1.15 sets aside for this one
 * language) is the undo window. A row that has just been pressed is neither
 * owed nor gone: it is IN FLIGHT, still rendered, its flow gauge draining. See
 * `RunOut` below and useRunOut.ts.
 */

import type { TripEnvelope, TripKind, TripRow, TripShop } from "../../engine/tripCodec";
import type { PriceChecks, ShopTicks } from "../../state/types";
import { formatPackG } from "../../state/format";

/* ------------------------------------------------------------------ */
/* committed constants                                                 */
/* ------------------------------------------------------------------ */

/**
 * §5 — "IRREDUCIBLE instead declares the named alternative: a long progressive
 * taper, arriving over 1800ms on the taper curve."
 *
 * DECLARED DELTA (CORRECTIONARY 6.5). The chapter's window is a 30000ms dwell
 * FOLLOWED BY the 1800ms taper, nominal to a tap's own factory run. Here the
 * dwell is ZERO and the taper is the whole window, because the thing the window
 * holds open is an undo, and a shopper who has to wait thirty seconds for a
 * mistake to become undoable has been given a delay, not a window. The taper's
 * own duration and curve are the chapter's, unchanged; only the dwell in front
 * of it is dropped, and the drop is stated rather than smuggled.
 */
export const RUNOUT_MS = 1800;

/** §5 — `--cd-dl400-ease-taper`, this language's own settle-family curve. */
export const TAPER_EASE = "cubic-bezier(0.22, 0.68, 0.32, 1)";

/** The market stall's shop code in the pinned envelope. */
export const MARKET_SHOP_CODE = "X";

/* ------------------------------------------------------------------ */
/* stations                                                            */
/* ------------------------------------------------------------------ */

/**
 * The station bar's seats. IRREDUCIBLE's regulator dial has "three seats only
 * ... because the real object offers exactly three flow rates, and a dial
 * pretending to finer resolution would be decorating an installer's decision
 * with false precision." A trip offers exactly as many stations as it has
 * shops — two, three, or one — so the bar has exactly that many seats, hard
 * stops at both ends, never a wrap.
 */
export interface Station {
  code: string;
  /** The seat's stamped word. Three letters, the register's own one size. */
  seat: string;
  /** The full name, printed on the open station's own plate. */
  name: string;
  rows: TripRow[];
}

const SEAT_WORD: Record<string, string> = { M: "mor", S: "sai", X: "mkt" };

export function stationsOf(trip: TripEnvelope): Station[] {
  return trip.shops.map((shop: TripShop) => ({
    code: shop.code,
    seat: SEAT_WORD[shop.code] ?? shop.code.slice(0, 3).toLowerCase(),
    name: shop.name,
    rows: shop.rows,
  }));
}

/* ------------------------------------------------------------------ */
/* ticks                                                               */
/* ------------------------------------------------------------------ */

export function isBought(ticks: ShopTicks[string] | undefined, ingId: string): boolean {
  return Boolean(ticks?.[ingId]);
}

export function allRows(trip: TripEnvelope): TripRow[] {
  return trip.shops.flatMap((s) => s.rows);
}

/* ------------------------------------------------------------------ */
/* aisle groups — R7's accordion, one section open at a time           */
/* ------------------------------------------------------------------ */

export interface AisleGroup {
  id: string;
  aisle: string;
  /** Still owed, PLUS anything still inside its own run-out window. */
  owed: TripRow[];
  /** Every row of this aisle, owed or not — the denominator on the lid. */
  all: TripRow[];
}

/**
 * Group one station's rows by aisle, preserving the trip's own row order (the
 * envelope's order already walks the store layout; LIST has no aisle-ordering
 * data of its own and must not invent one).
 *
 * `inFlight` keeps a just-pressed row in its group for the length of its
 * run-out, so the undo window has something to undo.
 */
export function aisleGroups(
  station: Station | null,
  ticks: ShopTicks[string] | undefined,
  inFlight: ReadonlySet<string>
): AisleGroup[] {
  if (!station) return [];
  const order: string[] = [];
  const byAisle = new Map<string, TripRow[]>();
  for (const row of station.rows) {
    const aisle = row.aisle || "unaisled";
    if (!byAisle.has(aisle)) {
      byAisle.set(aisle, []);
      order.push(aisle);
    }
    byAisle.get(aisle)!.push(row);
  }
  const groups: AisleGroup[] = [];
  for (const aisle of order) {
    const all = byAisle.get(aisle)!;
    const owed = all.filter((r) => !isBought(ticks, r.ingId) || inFlight.has(r.ingId));
    // "Every healthy station simply is not rendered." An aisle with nothing
    // left to fetch is not a lid with a zero on it — it is gone.
    if (owed.length === 0) continue;
    groups.push({ id: `${station.code}:${aisle}`, aisle, owed, all });
  }
  return groups;
}

/** Trip-wide, newest tick first — the BOUGHT lid's own rows. */
export function boughtRows(
  trip: TripEnvelope,
  ticks: ShopTicks[string] | undefined,
  inFlight: ReadonlySet<string>
): TripRow[] {
  const rows = allRows(trip).filter((r) => isBought(ticks, r.ingId) && !inFlight.has(r.ingId));
  return rows.sort((a, b) => {
    const at = ticks?.[a.ingId]?.at ?? "";
    const bt = ticks?.[b.ingId]?.at ?? "";
    return at < bt ? 1 : at > bt ? -1 : 0;
  });
}

/** The station a row belongs to, for the BOUGHT lid's own trailing chip. */
export function stationCodeOf(trip: TripEnvelope, ingId: string): string {
  for (const shop of trip.shops) if (shop.rows.some((r) => r.ingId === ingId)) return shop.code;
  return "";
}

/** How many rows this station still owes. A zero here prints CLEAR on its seat. */
export function owedCount(station: Station, ticks: ShopTicks[string] | undefined): number {
  return station.rows.reduce((n, r) => n + (isBought(ticks, r.ingId) ? 0 : 1), 0);
}

/* ------------------------------------------------------------------ */
/* price                                                               */
/* ------------------------------------------------------------------ */

/** A recorded shelf price always beats the planned one — that IS "verify". */
export function effectivePrice(row: TripRow, priceChecks: PriceChecks): number {
  return priceChecks[row.ingId]?.price ?? row.price;
}

export function isStillEstimate(row: TripRow, priceChecks: PriceChecks): boolean {
  return row.estimate && !priceChecks[row.ingId];
}

/**
 * The one active verify nominee across the whole trip, deterministic: first
 * shop in trip order, first row in aisle order, first unresolved flag.
 */
export function activeVerifyIngId(trip: TripEnvelope, priceChecks: PriceChecks): string | null {
  for (const shop of trip.shops) {
    for (const row of shop.rows) {
      if (row.verify && !priceChecks[row.ingId]) return row.ingId;
    }
  }
  return null;
}

export function outstandingVerifyCount(trip: TripEnvelope, priceChecks: PriceChecks): number {
  return allRows(trip).filter((r) => r.verify && !priceChecks[r.ingId]).length;
}

export function findRowAndShop(trip: TripEnvelope, ingId: string): { row: TripRow; shop: TripShop } | null {
  for (const shop of trip.shops) {
    const row = shop.rows.find((r) => r.ingId === ingId);
    if (row) return { row, shop };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* the till                                                            */
/* ------------------------------------------------------------------ */

export interface TillReading {
  /** Spent so far, integer pence — no float drift across forty-four ticks. */
  spentP: number;
  /** What the whole trip is planned to cost, integer pence. */
  plannedP: number;
  /** spentP - plannedP when positive, else 0. The over-run, exactly. */
  overP: number;
  /** 0..1, clamped. The column's fill height — geometry, not colour. */
  fill: number;
  got: number;
  total: number;
}

/**
 * THE PLAN IS THE PLAN, AND IT DOES NOT MOVE.
 *
 * The envelope's own prices, never the in-store checks. The first build read
 * `effectivePrice` here, which meant verifying a higher shelf price quietly
 * raised the plan to meet the spend and the over-run could never fire —
 * measured against the real 44-line trip with every price doubled: spend
 * £340.88, plan £340.88, over £0.00. A budget that follows the till is not a
 * budget; it is the till with a second name (CORRECTIONARY 4 — "no invented
 * data, no fake progress").
 */
export function plannedPence(trip: TripEnvelope): number {
  let p = 0;
  for (const row of allRows(trip)) p += Math.round(row.price * row.qty * 100);
  return p;
}

export function tillReading(
  trip: TripEnvelope,
  ticks: ShopTicks[string] | undefined,
  priceChecks: PriceChecks
): TillReading {
  let spentP = 0;
  let got = 0;
  let total = 0;
  for (const row of allRows(trip)) {
    total += 1;
    if (!isBought(ticks, row.ingId)) continue;
    got += 1;
    spentP += Math.round(effectivePrice(row, priceChecks) * row.qty * 100);
  }
  const plannedP = plannedPence(trip);
  const overP = Math.max(0, spentP - plannedP);
  return {
    spentP,
    plannedP,
    overP,
    fill: plannedP <= 0 ? 0 : Math.min(1, spentP / plannedP),
    got,
    total,
  };
}

/* ------------------------------------------------------------------ */
/* printing                                                            */
/* ------------------------------------------------------------------ */

/**
 * The hero figure. II.6.5 reserves the WIDTH — 7ch, the width of "£999.99" —
 * on the BOX, in list.css, and never by padding the value.
 *
 * The first build of this screen zero-padded the pounds to three digits so the
 * string was always seven characters. Rendered, that printed "£000.00" for a
 * basket with nothing in it: three digits that are not in the number. A drum
 * counter may show a leading zero because a drum physically has one; printed
 * type has no such excuse, and CORRECTIONARY 4's "no invented data" does not
 * make an exception for digits that happen to be zero.
 */
export function formatPence(pence: number): string {
  const safe = Math.max(0, Math.round(pence));
  return `£${Math.floor(safe / 100)}.${String(safe % 100).padStart(2, "0")}`;
}

/** Plain money, for a row's own value block. Never zero-padded. */
export function formatMoney(pence: number): string {
  const safe = Math.max(0, Math.round(pence));
  return `£${(safe / 100).toFixed(2)}`;
}

export function rowPence(row: TripRow, priceChecks: PriceChecks): number {
  return Math.round(effectivePrice(row, priceChecks) * row.qty * 100);
}

/**
 * The secondary slot. Buying one pack is more useful as that pack's size (what
 * you are looking for on the shelf); buying more than one is more useful as a
 * count (how many times you pick one up).
 */
export function formatQty(qty: number, packG: number): string {
  return qty > 1 ? `× ${qty}` : formatPackG(packG);
}

export function kindLabel(kind: TripKind): string {
  return kind === "full" ? "full shop" : "day-7 top-up";
}

/* ------------------------------------------------------------------ */
/* the state chip — an ink-only trailing lamp (§4, List/Browser)        */
/* ------------------------------------------------------------------ */

export type RowState = "plain" | "estimate" | "verify" | "checked";

export function rowState(row: TripRow, priceChecks: PriceChecks, activeVerify: string | null): RowState {
  if (priceChecks[row.ingId]) return "checked";
  if (activeVerify === row.ingId) return "verify";
  if (row.estimate) return "estimate";
  return "plain";
}

export const ROW_STATE_WORD: Record<RowState, string> = {
  plain: "",
  estimate: "est",
  verify: "verify",
  checked: "checked",
};
