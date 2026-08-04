// Pure domain/presentation helpers for LIST (PLAN §6.9). No food facts of
// its own — everything here operates on the trip envelope (codecStub.ts) and
// the contract-pinned shopTicks/priceChecks slices, never data/*.json
// directly (this screen is deliberately decoupled from src/data: every field
// a row needs — ingId, label, qty, aisle, price — already lives on the row).
import type { TripEnvelope, TripRow, TripShop } from "./codecStub";
import type { PriceChecks, ShopTicks } from "../../state/types";

export const MARKET_SHOP_CODE = "X";

/** The two aisle-grouped supermarket panes the thumb-bar paddle switches
 * between (PLAN §6.9: "Two-position shop paddle mor|sai"). The market shop
 * (code X, if present) is never one of these two — it renders as a separate
 * flat "ticket" view instead (see marketShop() below). */
export function paddleShops(trip: TripEnvelope): TripShop[] {
  return trip.shops.filter((s) => s.code !== MARKET_SHOP_CODE).slice(0, 2);
}

export function marketShop(trip: TripEnvelope): TripShop | null {
  return trip.shops.find((s) => s.code === MARKET_SHOP_CODE) ?? null;
}

/** Short paddle-face label for a shop, per PLAN §6.9's mock ("mor"/"sai"). */
export function paddleLabel(shop: TripShop): string {
  const byCode: Record<string, string> = { M: "mor", S: "sai" };
  return byCode[shop.code] ?? shop.name.slice(0, 3).toLowerCase();
}

export function allRows(trip: TripEnvelope): TripRow[] {
  return trip.shops.flatMap((s) => s.rows);
}

export interface AisleGroup {
  aisle: string;
  rows: TripRow[];
}

/** Groups a shop's rows by aisle, preserving first-seen aisle order (the
 * trip's own row order is assumed to already walk the store layout — LIST
 * has no independent aisle-ordering data of its own). */
export function groupByAisle(rows: TripRow[]): AisleGroup[] {
  const order: string[] = [];
  const map = new Map<string, TripRow[]>();
  for (const r of rows) {
    if (!map.has(r.aisle)) {
      map.set(r.aisle, []);
      order.push(r.aisle);
    }
    map.get(r.aisle)!.push(r);
  }
  return order.map((aisle) => ({ aisle, rows: map.get(aisle)! }));
}

export function isTicked(ticks: ShopTicks[string] | undefined, ingId: string): boolean {
  return Boolean(ticks?.[ingId]);
}

/** Row order WITHIN one aisle: unticked (and just-ticked-but-not-yet-settled)
 * rows keep their original position; settled-ticked rows sink to the bottom,
 * in their original relative order (PLAN §6.9: "row settles below unticked
 * items within its aisle after a ~1s undo grace"). */
export function orderRowsForDisplay(rows: TripRow[], ticks: ShopTicks[string] | undefined, settled: ReadonlySet<string>): TripRow[] {
  const primary: TripRow[] = [];
  const sunk: TripRow[] = [];
  for (const r of rows) {
    const ticked = isTicked(ticks, r.ingId);
    if (ticked && settled.has(r.ingId)) sunk.push(r);
    else primary.push(r);
  }
  return [...primary, ...sunk];
}

/** 5-segment normalized progress bar (PLAN §6.9 mock: "●●○○○ 3/9" — 3/9 ≈
 * 33%, which rounds to 2 of 5 filled dots, exactly matching the mock). */
export function progressDots(ticked: number, total: number, slots = 5): { filled: number; slots: number } {
  if (total <= 0) return { filled: 0, slots };
  return { filled: Math.round((ticked / total) * slots), slots };
}

export function countTicked(rows: TripRow[], ticks: ShopTicks[string] | undefined): number {
  return rows.reduce((n, r) => n + (isTicked(ticks, r.ingId) ? 1 : 0), 0);
}

/** Effective (current) price for a row: a recorded price-check always wins
 * over the planned/estimated price — that IS what "verify" means (PLAN
 * §6.9's numeric pad writes priceChecks, which then supersedes the estimate
 * for both the odometer and the row's own display). */
export function effectivePrice(row: TripRow, priceChecks: PriceChecks): number {
  return priceChecks[row.ingId]?.price ?? row.price;
}

export function isResolvedEstimate(row: TripRow, priceChecks: PriceChecks): boolean {
  return row.estimate && Boolean(priceChecks[row.ingId]);
}

/** Still shown with the EstimateMark (PLAN: "EstimateMark on estimate
 * rows") — flips off once verified, since verifying REPLACES the estimate
 * with a confirmed shelf price. */
export function isStillEstimate(row: TripRow, priceChecks: PriceChecks): boolean {
  return row.estimate && !priceChecks[row.ingId];
}

/**
 * The single active verify nominee across the WHOLE trip (PLAN §6.9: "One
 * [verify] nominee active at a time"), deterministic: first shop in trip
 * order, first aisle in row order, first unresolved verify-flagged row.
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

/** Locate a row (and its owning shop) anywhere in the trip by ingId — used
 * when the shared app-wide ArbiterSlot nominates a verify-nominee that may
 * belong to whichever shop pane ISN'T currently on screen (index.tsx's
 * handleArbiterActivate switches the pane to it before opening the pad). */
export function findRowAndShop(trip: TripEnvelope, ingId: string): { row: TripRow; shop: TripShop } | null {
  for (const shop of trip.shops) {
    const row = shop.rows.find((r) => r.ingId === ingId);
    if (row) return { row, shop };
  }
  return null;
}

/** Total spend so far, in integer pence (avoids float drift across many
 * ticks): sum of effectivePrice() over every TICKED row in the whole trip,
 * regardless of which shop pane is currently displayed — the odometer is a
 * whole-trip running total (PLAN §6.9's thumb bar shows it beside the
 * two-position paddle, implying it doesn't reset when the paddle flips). */
export function spentSoFarPence(trip: TripEnvelope, ticks: ShopTicks[string] | undefined, priceChecks: PriceChecks): number {
  let pence = 0;
  for (const row of allRows(trip)) {
    if (isTicked(ticks, row.ingId)) pence += Math.round(effectivePrice(row, priceChecks) * 100);
  }
  return pence;
}

export function gotCounts(trip: TripEnvelope, ticks: ShopTicks[string] | undefined): { got: number; total: number } {
  const rows = allRows(trip);
  return { got: countTicked(rows, ticks), total: rows.length };
}

export function allTicked(trip: TripEnvelope, ticks: ShopTicks[string] | undefined): boolean {
  const rows = allRows(trip);
  return rows.length > 0 && rows.every((r) => isTicked(ticks, r.ingId));
}

/** Best-effort day-0/day-7 inference from the envelope's opaque `kind`
 * string, for arbiter.ts's ArbiterContext.tripDay (verify-nominee scoping).
 * Returns undefined (not null) for "arbiterFor's own inference wins"
 * semantics when kind doesn't match either known value. */
export function inferTripDayFromKind(kind: string): 0 | 7 | undefined {
  if (kind === "day0") return 0;
  if (kind === "day7") return 7;
  return undefined;
}

export function kindLabel(kind: string): string {
  if (kind === "day0") return "full shop";
  if (kind === "day7") return "day-7 top-up";
  return kind;
}

/** "£042.35" style split for the odometer's rolling digit drums — 3
 * zero-padded integer digits minimum (PLAN §6.9 mock), more if the total
 * ever exceeds £999.99 (never truncated). */
export function formatPence(pence: number): { poundsDigits: string; penceDigits: string; plain: string } {
  const safe = Math.max(0, Math.round(pence));
  const pounds = Math.floor(safe / 100);
  const pennies = safe % 100;
  const poundsDigits = String(pounds).padStart(3, "0");
  const penceDigits = String(pennies).padStart(2, "0");
  return { poundsDigits, penceDigits, plain: `£${poundsDigits}.${penceDigits}` };
}

export function formatPrice(amount: number): string {
  return `£${amount.toFixed(2)}`;
}
