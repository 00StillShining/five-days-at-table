// One shopping row (PLAN §6.9): the FULL row is the >=56px tick target.
// Structured as an <li> containing a sibling tick-<button> + an optional
// verify-<button> — never a button nested inside a button (invalid HTML;
// browsers silently mis-handle nested interactive controls and it breaks
// screen-reader button semantics) — both real, independently focusable,
// keyboard-operable buttons.
import { EstimateMark } from "../../components/EstimateMark";
import type { TripRow } from "./codecStub";
import { effectivePrice, formatPrice, isStillEstimate } from "./model";
import type { PriceChecks } from "../../state/types";

export interface RowProps {
  row: TripRow;
  ticked: boolean;
  isActiveVerifyNominee: boolean;
  priceChecks: PriceChecks;
  onToggleTick: (row: TripRow) => void;
  onOpenVerify: (row: TripRow) => void;
  registerEl: (ingId: string, el: HTMLButtonElement | null) => void;
}

export function Row({ row, ticked, isActiveVerifyNominee, priceChecks, onToggleTick, onOpenVerify, registerEl }: RowProps) {
  const price = effectivePrice(row, priceChecks);
  const stillEstimate = isStillEstimate(row, priceChecks);
  const verified = row.estimate && Boolean(priceChecks[row.ingId]);

  const accessibleName = `${row.label}, ${row.qty}, ${formatPrice(price)}${stillEstimate ? " (estimate)" : ""}${
    ticked ? ", ticked" : ""
  }`;

  return (
    <li className="scr-list-row-item" data-ticked={ticked || undefined}>
      <button
        type="button"
        ref={(el) => registerEl(row.ingId, el)}
        className="fd5-control scr-list-row"
        aria-pressed={ticked}
        aria-label={accessibleName}
        onClick={() => onToggleTick(row)}
        data-motion
      >
        <span className="scr-list-row-glyph" aria-hidden="true">
          {ticked ? "▣" : "▢"}
        </span>
        <span className="scr-list-row-main" aria-hidden="true">
          <span className="scr-list-row-label">{row.label}</span>
          <span className="scr-list-row-qty">{row.qty}</span>
        </span>
        <span className="scr-list-row-price" aria-hidden="true">
          {formatPrice(price)}
          {stillEstimate && <EstimateMark />}
          {ticked && (
            <span className="scr-list-row-check" aria-hidden="true">
              {"✓"}
            </span>
          )}
        </span>
      </button>
      {isActiveVerifyNominee && !verified && (
        <button type="button" className="fd5-control scr-list-verify-chip" onClick={() => onOpenVerify(row)}>
          verify
        </button>
      )}
    </li>
  );
}
