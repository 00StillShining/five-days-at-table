// "waste log ▸" drill-in (PLAN §6.7): recent waste events in the shared
// <Sheet> primitive (max one drill-in level, per PHASE2-CONTRACT). The
// month-to-date total is a light, no-new-state convenience read of data this
// screen already has in hand — SHOP owns the real monthly-figure feature
// (contract: "monthly figure surfaces in SHOP later, just persist it"); this
// is not that, just a helpful readout of what's already been logged.
import { Sheet } from "../../components/Sheet";
import { EstimateMark } from "../../components/EstimateMark";
import { getMeal } from "../../data";
import type { WasteEntry } from "../../state/store";
import { londonDateIso } from "../../state/london";

export interface WasteSheetProps {
  open: boolean;
  onClose: () => void;
  waste: WasteEntry[];
  now: Date;
}

function refName(ref: string): string {
  return getMeal(ref)?.name ?? ref;
}

export function WasteSheet({ open, onClose, waste, now }: WasteSheetProps) {
  const sorted = [...waste].sort((a, b) => (a.date < b.date ? 1 : -1));
  const monthPrefix = londonDateIso(now).slice(0, 7); // "YYYY-MM"
  const monthTotal = sorted
    .filter((w) => w.date.startsWith(monthPrefix) && w.price != null)
    .reduce((sum, w) => sum + (w.price ?? 0), 0);

  return (
    <Sheet open={open} onClose={onClose} title="waste log">
      <p className="scr-stores-waste-month">
        this month · <EstimateMark />£{monthTotal.toFixed(2)}
      </p>
      {sorted.length === 0 ? (
        <p className="scr-stores-muted">nothing binned yet.</p>
      ) : (
        <ul className="scr-stores-waste-list">
          {sorted.map((w) => (
            <li key={w.id} className="scr-stores-waste-item">
              <span className="scr-stores-waste-ref">{refName(w.ref)}</span>
              <span className="scr-stores-waste-meta">
                {w.g != null ? `${w.g}g · ` : ""}
                {w.price != null ? (
                  <>
                    <EstimateMark />£{w.price.toFixed(2)}
                  </>
                ) : (
                  "no value"
                )}{" "}
                · {w.date}
              </span>
              {w.note && <span className="scr-stores-waste-note">{w.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
