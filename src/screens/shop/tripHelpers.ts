// Pure domain/presentation helpers for SHOP (PLAN §6.8). No food facts of
// its own — reads through src/data's typed accessors and
// src/state/selectors.ts's tripBuild(), per PHASE2-CONTRACT.
import { ingredientsById, planShops } from "../../data";
import type { Shop } from "../../data/types";
import { formatPackG } from "../../state/format";
import type { TripBuild, TripLine } from "../../state/selectors";
import type { InventoryLevel } from "../../state/types";
import type { TripEnvelope, TripKind, TripRow, TripShop } from "../../engine/tripCodec";

// Re-exported so ShopColumn.tsx's existing `import { formatPackG } from
// "./tripHelpers"` keeps working unchanged (F2's shared-helper adoption —
// the canonical implementation now lives in src/state/format.ts).
export { formatPackG };

/** Three costed columns, in the order PLAN §6.8 lists them: "Morrisons /
 * Sainsbury's / market ticket". */
export const SHOP_ORDER: Shop[] = ["M", "S", "X"];

export const LEVEL_LABEL: Record<InventoryLevel, string> = { 0: "empty", 1: "¼", 2: "½", 3: "¾", 4: "full" };

export interface EffectiveLine {
  line: TripLine;
  /** Fully covered by current stock and NOT force-included — the have-list
   * "you're at ¾ on rice — skip" row (PLAN §6.8). */
  isDedupe: boolean;
  /** packsToBuy, or 1 if the owner used "include anyway" on a dedupe row. */
  effectivePacks: number;
  effectiveCost: number;
}

/** Resolves tripBuild()'s raw lines against the "include anyway" overrides
 * a shopper can toggle per dedupe row (screen-local state, not persisted —
 * PLAN doesn't ask for it to survive a reload, and re-deriving from
 * inventory on next build is the correct behaviour anyway). */
export function effectiveLines(trip: TripBuild, forcedIncludeIds: ReadonlySet<string>): EffectiveLine[] {
  return trip.lines.map((line) => {
    const forced = forcedIncludeIds.has(line.ingId);
    const isDedupe = line.packsToBuy === 0 && !forced;
    const effectivePacks = forced ? Math.max(1, line.packsToBuy) : line.packsToBuy;
    return { line, isDedupe, effectivePacks, effectiveCost: effectivePacks * line.price };
  });
}

export function linesForShop(lines: EffectiveLine[], shop: Shop): EffectiveLine[] {
  return lines.filter((l) => l.line.shop === shop);
}

export function buyLinesForShop(lines: EffectiveLine[], shop: Shop): EffectiveLine[] {
  return linesForShop(lines, shop).filter((l) => !l.isDedupe);
}

export function shopSubtotal(lines: EffectiveLine[], shop: Shop): number {
  return buyLinesForShop(lines, shop).reduce((sum, l) => sum + l.effectiveCost, 0);
}

export function overallTotal(lines: EffectiveLine[]): number {
  return SHOP_ORDER.reduce((sum, shop) => sum + shopSubtotal(lines, shop), 0);
}

// ---- alternatives (render only if the ingredient's own data carries one) --

const ALT_KEYWORDS = ["substitut", "alternative", "instead of", " or use "];

/** The ingredient's storage note, ONLY when it actually mentions a
 * substitution/alternative (PLAN §6.8: "render only if data exists; do not
 * invent") — most ingredients return null here; this is expected (see the
 * builder's final report for the exact count in the current dataset). */
export function alternativeNote(ingId: string): string | null {
  const note = ingredientsById[ingId]?.storage.note ?? "";
  const lower = note.toLowerCase();
  return ALT_KEYWORDS.some((k) => lower.includes(k)) ? note : null;
}

// ---- waste-cost readout ----------------------------------------------------

export function monthlyWasteTotal(waste: { date: string; price: number | null }[], monthIso: string): number {
  return waste.filter((w) => w.date.startsWith(monthIso) && w.price != null).reduce((sum, w) => sum + (w.price ?? 0), 0);
}

// ---- trip envelope construction (SHOP -> LIST, src/engine/tripCodec.ts) ---

/** Builds the pinned TripEnvelope from this trip's effective lines. Dedupe
 * (skipped) lines never cross to the phone — there's nothing to buy for
 * them. Shops with zero buy-lines are omitted entirely (LIST's own
 * marketShop()/paddleShops() already treat an absent shop as "not this
 * trip", not an error). */
export function buildEnvelope(tripId: string, createdOn: string, kind: TripKind, lines: EffectiveLine[], verifyNominees: readonly string[]): TripEnvelope {
  const verifySet = new Set(verifyNominees);
  const rowsByShop = new Map<Shop, TripRow[]>();
  for (const shop of SHOP_ORDER) rowsByShop.set(shop, []);

  for (const el of buyLines(lines)) {
    const ing = ingredientsById[el.line.ingId];
    const row: TripRow = {
      ingId: el.line.ingId,
      label: ing?.name.short ?? el.line.name,
      qty: el.effectivePacks,
      packG: el.line.packG,
      price: el.line.price,
      estimate: el.line.estimate,
      verify: verifySet.has(el.line.ingId),
      aisle: ing?.aisle ?? "",
    };
    rowsByShop.get(el.line.shop)!.push(row);
  }

  const shops: TripShop[] = SHOP_ORDER.filter((code) => rowsByShop.get(code)!.length > 0).map((code) => ({
    code,
    name: planShops[code]?.name ?? code,
    rows: rowsByShop.get(code)!,
  }));

  const byShop: Record<string, number> = {};
  let overall = 0;
  for (const shop of shops) {
    const subtotal = shop.rows.reduce((s, r) => s + r.qty * r.price, 0);
    byShop[shop.code] = Math.round(subtotal * 100) / 100;
    overall += subtotal;
  }

  return { v: 1, tripId, createdOn, kind, shops, totals: { overall: Math.round(overall * 100) / 100, byShop } };
}

function buyLines(lines: EffectiveLine[]): EffectiveLine[] {
  return lines.filter((l) => !l.isDedupe && l.effectivePacks > 0);
}

/** Plain-text rendition of the trip (PLAN §6.8 D2 fallback: "copies the
 * plain-text list to clipboard with visible-textarea fallback"). */
export function plainTextList(envelope: TripEnvelope): string {
  const lines: string[] = [`FD-5 shopping list — ${envelope.kind === "full" ? "full shop" : "day-7 top-up"}`];
  for (const shop of envelope.shops) {
    lines.push("", shop.name.toUpperCase());
    for (const row of shop.rows) {
      const qtyText = row.qty > 1 ? `× ${row.qty}` : formatPackG(row.packG);
      const priceText = `£${(row.qty * row.price).toFixed(2)}${row.estimate ? " ≈" : ""}`;
      lines.push(`  [ ] ${row.label} ${qtyText} — ${priceText}${row.verify ? " [verify]" : ""}`);
    }
  }
  lines.push("", `total: £${envelope.totals.overall.toFixed(2)}`);
  return lines.join("\n");
}
