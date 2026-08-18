/**
 * src/screens/stores/WasteTray.tsx — the waste ledger, as a drawer.
 *
 * PLAN section 6.7: "waste log ▸" is one drill-in level, and it is a LOG — a
 * list of past facts, not a working surface. It is built on the foundry Tray
 * rather than on the legacy modal `<dialog>` Sheet for the owner's ruling:
 *
 *   "Trays travel their own size with NO SCRIM — the workspace beneath stays
 *    live and touchable, with an explicit exit back to the screen it belongs
 *    to, and the rail always available to leave entirely."
 *
 * So the register underneath stays operable while the log is up, Escape closes,
 * focus returns to the key that opened it, and nothing is trapped. The tray is
 * held off the rail's own footprint at both breakpoints (see stores.css), so
 * the exit from the whole room is never covered by a drawer belonging to one
 * screen inside it.
 *
 * CLEAR LID gives the drawer its lining: the tray interior is pale elm veneer
 * (section 2 — "rails, TRAY LININGS, secondary panels"), which is the one place
 * this language spends its warm substance, and the entries are printed on cream
 * ink plates inside it.
 *
 * The month total is a light, no-new-state read of data this screen already
 * holds. SHOP owns the real monthly-figure feature; this is a readout of what
 * has been logged, and it prints the EstimateMark because a pro-rated price is
 * an estimate and says so.
 */

import { Tray, Plate, Escutcheon } from "../../cd/foundry";
import { EstimateMark } from "../../components/EstimateMark";
import { getMeal } from "../../data";
import type { WasteEntry } from "../../state/types";
import { formatShortDate, londonDateIso } from "../../state/london";

/** `w.date` is a plain calendar-date ISO string (no time-of-day), read as UTC
 *  midnight before formatting — consistent with state/london.ts's own pure UTC
 *  integer-day maths. London is never behind UTC, so UTC midnight always falls
 *  on the correct London calendar day. */
function isoDateToDisplayDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export interface WasteTrayProps {
  open: boolean;
  onClose: () => void;
  waste: WasteEntry[];
  now: Date;
}

function refName(ref: string): string {
  return getMeal(ref)?.name ?? ref;
}

export function WasteTray({ open, onClose, waste, now }: WasteTrayProps) {
  const sorted = [...waste].sort((a, b) => (a.date < b.date ? 1 : -1));
  const monthPrefix = londonDateIso(now).slice(0, 7); // "YYYY-MM"
  const thisMonth = sorted.filter((w) => w.date.startsWith(monthPrefix));
  const monthTotal = thisMonth.reduce((sum, w) => sum + (w.price ?? 0), 0);
  const monthGrams = thisMonth.reduce((sum, w) => sum + (w.g ?? 0), 0);

  return (
    <Tray
      open={open}
      onClose={onClose}
      title="waste log"
      exitLabel="shut the drawer"
      edge="inline-end"
      className="str-waste"
      headSlot={
        <span className="str-waste__head cd-data">
          {sorted.length}
          <span className="cd-unit">entries</span>
        </span>
      }
    >
      <Plate className="str-waste__total" surface="data">
        <Escutcheon as="span">this month</Escutcheon>
        <span className="str-waste__figure cd-data">
          <EstimateMark />£{monthTotal.toFixed(2)}
        </span>
        <span className="str-waste__sub cd-printed">
          {thisMonth.length} {thisMonth.length === 1 ? "entry" : "entries"} · {monthGrams}g
        </span>
      </Plate>

      {sorted.length === 0 ? (
        <Plate className="str-waste__empty" surface="data">
          <span className="cd-prose">
            nothing binned yet. this drawer fills from the dinner ledger&rsquo;s &ldquo;binned some&rdquo;
            key — it is a record, not a target.
          </span>
        </Plate>
      ) : (
        <ul className="str-waste__list">
          {sorted.map((w) => (
            <li key={w.id}>
              <Plate className="str-waste__item" surface="data">
                <span className="str-waste__ref">{refName(w.ref)}</span>
                <span className="str-waste__meta cd-printed">
                  {w.g != null ? `${w.g}g · ` : ""}
                  {w.price != null ? (
                    <>
                      <EstimateMark />£{w.price.toFixed(2)}
                    </>
                  ) : (
                    "no value"
                  )}{" "}
                  · {formatShortDate(isoDateToDisplayDate(w.date))}
                </span>
                {w.note && <span className="str-waste__note cd-silkscreen">{w.note}</span>}
              </Plate>
            </li>
          ))}
        </ul>
      )}
    </Tray>
  );
}
