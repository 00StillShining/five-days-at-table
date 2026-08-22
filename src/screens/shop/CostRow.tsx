/**
 * src/screens/shop/CostRow.tsx — one costed line.
 *
 * II.6.12's five slots in fixed order — mark, identity, value, delta, state —
 * with II.6.15's alignment (numerals right, text left) and II.6.17's rule that
 * "the difference gets its own signed column, sign always printed, never folded
 * into parentheses beside a value".
 *
 * THE MARK IS THE FLUSH-CHECK, IN THIS WORLD'S ONE AXIS. Two hairline dashes,
 * offset while the line is uncosted, closing into one continuous rule the frame
 * it becomes costed. Forty-four of them closing together is the horizon
 * completing itself at register scale (section 7).
 *
 * THE ESTIMATE GRAMMAR IS APP-WIDE AND UNCHANGED: the figure, then the mark.
 * `EstimateMark` is the product's one sanctioned way to say it and is used
 * verbatim rather than re-invented in this world's dialect.
 */

import { memo } from "react";
import { EstimateMark } from "../../components/EstimateMark";
import { formatPackG } from "../../state/format";
import type { CostReading } from "./model";
import { money, signedMoney } from "./model";
import type { EffectiveLine } from "./tripHelpers";

export interface CostRowProps {
  el: EffectiveLine;
  reading: CostReading;
}

export const CostRow = memo(function CostRow({ el, reading }: CostRowProps) {
  const line = el.line;
  const delta = reading.delta;
  const sign = delta == null || delta === 0 ? undefined : delta > 0 ? "up" : "down";

  return (
    <div
      className="shop-row"
      data-shop-cost={reading.cls}
      data-shop-costed={reading.costed ? "true" : "false"}
    >
      <span className="shop-mark" aria-hidden="true" />

      {/* II.6.22 — prose truncates at the tail and carries its full form in
          `title`; the cut is a view decision, never a data decision. */}
      <span className="shop-name" title={line.product}>
        {line.product}
      </span>

      {/* II.6.15 — a uniform column prints its unit ONCE, in the header, and the
          cells carry bare numerals. The lid above this column prints £ on its
          own subtotal; the plinth prints it at the top step. */}
      <span className="shop-price">
        <span>{money(reading.lineTotal)}</span>
        {line.estimate && <EstimateMark className="shop-est" />}
      </span>

      {/*
        `display: contents` at desk width, so qty, delta and the state word are
        DIRECT children of the row grid and hold II.6.12's five slots. Below
        767.84px it becomes a real box and carries all three onto the row's own
        second line — the Comfortable band's second line (II.6.13), not a
        dropped column. Nothing is hidden at any width.
      */}
      <span className="shop-meta">
        <span className="shop-qty">
          {el.effectivePacks}
          {"×"}
          {formatPackG(line.packG)}
        </span>

        {/* An empty column states its absence explicitly — an em-dash in dim
            ink, never a blank cell that reads as a load that never finished. */}
        <span className="shop-delta" data-shop-sign={sign}>
          <span className="fd5-visually-hidden">
            {delta == null ? "no price check, " : "delta against the sheet "}
          </span>
          {delta == null ? "—" : signedMoney(delta)}
        </span>
        <span className="shop-word">{reading.word}</span>
      </span>
    </div>
  );
});
