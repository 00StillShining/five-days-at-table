// Close-trip summary + verify read-back (PLAN §6.9 / §6.8): "closing the
// shop (all ticked or explicit `close trip`) shows the trip summary + verify
// read-back" — SHOP's own doc (§6.8) spells out what that read-back is for:
// "a 'read back' screen on the phone summarizing verify entries to type in"
// at the desk (item, entered price, old price) — deliberately manual-first,
// no sync infrastructure.
import type { TripEnvelope } from "./codecStub";
import type { PriceChecks, ShopTicks } from "../../state/types";
import { allRows, formatPrice, gotCounts, kindLabel, spentSoFarPence } from "./model";

export interface TripSummaryProps {
  trip: TripEnvelope;
  ticks: ShopTicks[string] | undefined;
  priceChecks: PriceChecks;
  onBack: () => void;
}

export function TripSummary({ trip, ticks, priceChecks, onBack }: TripSummaryProps) {
  const rows = allRows(trip);
  const { got, total } = gotCounts(trip, ticks);
  const spent = spentSoFarPence(trip, ticks, priceChecks);
  const verifyEntries = rows
    .filter((r) => priceChecks[r.ingId])
    .map((r) => ({ row: r, check: priceChecks[r.ingId] }));

  return (
    <div className="scr-list-summary">
      <p className="scr-list-summary-kicker">trip closed</p>
      <h1 className="scr-list-summary-title">{kindLabel(trip.kind)}</h1>
      <p className="scr-list-summary-total">
        {formatPrice(spent / 100)} spent · {got} of {total} items
      </p>

      <h2 className="scr-list-summary-h">verify read-back</h2>
      {verifyEntries.length === 0 ? (
        <p className="scr-list-summary-muted">nothing to read back — no prices were re-verified this trip.</p>
      ) : (
        <>
          <p className="scr-list-summary-muted">type these back in at the desk:</p>
          <table className="scr-list-summary-table">
            <thead>
              <tr>
                <th scope="col">item</th>
                <th scope="col">entered</th>
                <th scope="col">was</th>
              </tr>
            </thead>
            <tbody>
              {verifyEntries.map(({ row, check }) => (
                <tr key={row.ingId}>
                  <th scope="row">{row.label}</th>
                  <td>{formatPrice(check!.price)}</td>
                  <td>{formatPrice(row.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <button type="button" className="fd5-control scr-list-summary-back" onClick={onBack}>
        {"‹"} back to list
      </button>
    </div>
  );
}
