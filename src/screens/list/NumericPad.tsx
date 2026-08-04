// The verify nominee's big numeric pad (PLAN §6.9): "tapping opens a big
// numeric pad (large keys >=56px, decimal, backspace, done) to enter the
// shelf price -> writes priceChecks {ingId:{price,on}} -> next nominee
// becomes active." Built on the shared <Sheet> (native <dialog>: Esc-close
// + focus trap come from the platform, per Sheet's own doc). Every key is a
// real <button> — natively Tab-reachable and Enter/Space-operable, so no
// extra typed-input alternative is needed the way the portion knob's custom
// ARIA slider needs one (a button pad is already keyboard-complete).
import { useEffect, useState } from "react";
import { Sheet } from "../../components/Sheet";
import type { TripRow } from "./codecStub";
import { formatPrice } from "./model";

export interface NumericPadProps {
  row: TripRow | null;
  onClose: () => void;
  onSubmit: (ingId: string, price: number) => void;
}

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

export function NumericPad({ row, onClose, onSubmit }: NumericPadProps) {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (row) setDraft("");
  }, [row?.ingId]);

  function pressKey(key: string) {
    if (key === "⌫") {
      setDraft((d) => d.slice(0, -1));
      return;
    }
    if (key === "." && draft.includes(".")) return;
    // Cap at 2 decimal places — this is a shelf price, not free text.
    const decIdx = draft.indexOf(".");
    if (decIdx >= 0 && draft.length - decIdx > 2) return;
    if (draft.length >= 7) return; // guard against runaway input
    setDraft((d) => d + key);
  }

  const parsed = Number(draft);
  const valid = draft.length > 0 && Number.isFinite(parsed) && parsed >= 0;

  function submit() {
    if (!row || !valid) return;
    onSubmit(row.ingId, Math.round(parsed * 100) / 100);
  }

  return (
    <Sheet open={row != null} onClose={onClose} title="verify price">
      {row && (
        <div className="scr-list-pad">
          <p className="scr-list-pad-item">{row.label}</p>
          <p className="scr-list-pad-was">
            was {formatPrice(row.price)}
            {row.estimate ? " (estimate)" : ""}
          </p>
          <p className="scr-list-pad-readout" aria-live="polite">
            {draft ? `£${draft}` : "£ —"}
          </p>
          <div className="scr-list-pad-keys">
            {PAD_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className="fd5-control scr-list-pad-key"
                onClick={() => pressKey(key)}
                aria-label={key === "⌫" ? "backspace" : key === "." ? "decimal point" : key}
              >
                {key}
              </button>
            ))}
          </div>
          <button type="button" className="fd5-control scr-list-pad-done" onClick={submit} disabled={!valid}>
            done
          </button>
        </div>
      )}
    </Sheet>
  );
}
