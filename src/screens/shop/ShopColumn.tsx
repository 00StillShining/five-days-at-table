// One costed column (PLAN §6.8: "rows with product string, qty×pack, price
// (EstimateMark on estimates), per-shop subtotals"). `market` renders the
// chrome-free 1-bit "market ticket" variant (large type, guide prices, ≈
// marks) instead of the ordinary supermarket column styling.
import { EstimateMark } from "../../components/EstimateMark";
import type { PriceChecks } from "../../state/types";
import { alternativeNote, formatPackG, type EffectiveLine } from "./tripHelpers";

export interface ShopColumnProps {
  displayName: string;
  rows: EffectiveLine[];
  subtotal: number;
  verifyNominees: ReadonlySet<string>;
  priceChecks: PriceChecks;
  market?: boolean;
  /** Fable review FIX round: the tester basket is the source document
   * verbatim — the canonical `alternativeNote` lookup (a full-mode-only
   * concept, keyed off the CANONICAL ingredient's own storage note) has no
   * business appearing inside an otherwise-verbatim authored basket row
   * (e.g. sweetheart cabbage's "— alt: …" note, reviewer cosmetic). Default
   * false/undefined so every pre-existing full-mode call site is unchanged. */
  suppressAlternativeNote?: boolean;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function ShopColumn({ displayName, rows, subtotal, verifyNominees, priceChecks, market, suppressAlternativeNote }: ShopColumnProps) {
  const rootClass = `scr-shop-col${market ? " scr-shop-col--market" : ""}`;
  return (
    <section className={rootClass} aria-labelledby={`scr-shop-col-h-${displayName}`}>
      <h2 id={`scr-shop-col-h-${displayName}`} className="scr-shop-col-h">
        {displayName}
      </h2>
      {rows.length === 0 ? (
        <p className="scr-shop-col-empty">nothing needed here this trip.</p>
      ) : (
        <table className="scr-shop-col-table">
          <caption className="fd5-visually-hidden">
            {displayName} — items to buy, {rows.length} line{rows.length === 1 ? "" : "s"}
          </caption>
          <tbody>
            {rows.map((el) => {
              const alt = suppressAlternativeNote ? null : alternativeNote(el.line.ingId);
              const checked = priceChecks[el.line.ingId];
              const isNominee = verifyNominees.has(el.line.ingId);
              return (
                <tr key={el.line.ingId} className="scr-shop-row">
                  <td className="scr-shop-row-name">
                    {el.line.product}
                    {alt && (
                      <span className="scr-shop-row-alt" title={market ? undefined : alt}>
                        {" — alt: "}
                        {market ? alt : truncate(alt, 42)}
                      </span>
                    )}
                  </td>
                  <td className="scr-shop-row-qty">
                    {el.effectivePacks} × {formatPackG(el.line.packG)}
                  </td>
                  <td className="scr-shop-row-price">
                    £{el.effectiveCost.toFixed(2)}
                    {el.line.estimate && <EstimateMark />}
                    {isNominee && !checked && (
                      <span className="scr-shop-chip" aria-label="price verify nominee">
                        [verify]
                      </span>
                    )}
                    {isNominee && checked && (
                      <span className="scr-shop-verified">{"✓ "}£{checked.price.toFixed(2)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="scr-shop-subtotal-row">
              <td colSpan={2}>subtotal</td>
              <td className="scr-shop-subtotal">£{subtotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}
