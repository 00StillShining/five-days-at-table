/**
 * src/screens/list/CloseRead.tsx — the trip, closed, and what to type back in.
 *
 * PLAN §6.9: "closing the shop (all ticked or explicit `close trip`) shows the
 * trip summary + verify read-back." §6.8 says what the read-back is FOR: "a
 * 'read back' screen on the phone summarizing verify entries to type in" at the
 * desk — deliberately manual-first, no sync infrastructure.
 *
 * It is a tray rather than a second view mode. The old build swapped the whole
 * screen out for a summary; that made "close trip" a door rather than a report,
 * and a shopper who pressed it while still holding a trolley had to find the way
 * back. A tray travels its own size with no scrim, so the register stays live
 * behind it and Escape puts it away.
 *
 * screencraft/03's export law, honoured in the foot: "Export composition carries
 * three things no static image can recover on its own: the TIMESTAMP the view
 * was taken at, the SCALE AND UNITS every value is expressed in, and the FILTER
 * STATE that produced the rows on the page."
 */

import { Escutcheon, Plate, Tray } from "../../cd/foundry";
import type { TripEnvelope } from "../../engine/tripCodec";
import type { PriceChecks } from "../../state/types";
import { allRows, formatMoney, formatPence, type TillReading } from "./model";

export interface CloseReadProps {
  open: boolean;
  onClose: () => void;
  trip: TripEnvelope;
  priceChecks: PriceChecks;
  reading: TillReading;
  kind: string;
  /** Printed on the export strip: the exact instant this read was taken. */
  takenAt: string;
}

export function CloseRead({
  open,
  onClose,
  trip,
  priceChecks,
  reading,
  kind,
  takenAt,
}: CloseReadProps) {
  const checked = allRows(trip)
    .filter((r) => priceChecks[r.ingId])
    .map((r) => ({ row: r, check: priceChecks[r.ingId]! }));

  return (
    <Tray
      open={open}
      onClose={onClose}
      edge="block-end"
      title="close read"
      exitLabel="back to list"
      className="lst-close-tray"
      headSlot={<Escutcheon className="lst-close-kind">{kind}</Escutcheon>}
    >
      <Plate className="lst-close-total" surface="data">
        <span className="lst-close-key">spent</span>
        <span className="cd-data lst-close-val">{formatPence(reading.spentP)}</span>
        <span className="lst-close-key">plan</span>
        <span className="cd-data lst-close-val">{formatPence(reading.plannedP)}</span>
        <span className="lst-close-key">lines</span>
        <span className="cd-data lst-close-val">
          {reading.got} / {reading.total}
        </span>
      </Plate>

      <Escutcheon as="h3" className="lst-close-h">
        verify read-back
      </Escutcheon>

      {checked.length === 0 ? (
        <Plate className="lst-close-empty" surface="data">
          <p className="cd-prose">
            nothing to read back — no shelf price was entered on this trip. the desk keeps the
            planned figures.
          </p>
        </Plate>
      ) : (
        <Plate className="lst-close-table-plate" surface="data">
          <table className="lst-close-table">
            <thead>
              <tr>
                <th scope="col">item</th>
                <th scope="col">entered</th>
                <th scope="col">planned</th>
              </tr>
            </thead>
            <tbody>
              {checked.map(({ row, check }) => (
                <tr key={row.ingId}>
                  <th scope="row">{row.label}</th>
                  <td className="cd-data">{formatMoney(Math.round(check.price * 100))}</td>
                  <td className="cd-data">{formatMoney(Math.round(row.price * 100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Plate>
      )}

      {/* screencraft/03 — the three facts a still image cannot recover. */}
      <p className="lst-close-strip cd-printed">
        as of {takenAt} · gbp, per line, packs included · {reading.got} of {reading.total} lines
        bought
      </p>
    </Tray>
  );
}
