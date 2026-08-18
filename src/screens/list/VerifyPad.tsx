/**
 * src/screens/list/VerifyPad.tsx — the shelf price, entered with one thumb.
 *
 * PLAN §6.9: "tapping opens a big numeric pad (large keys >=56px, decimal,
 * backspace, done) to enter the shelf price -> writes priceChecks -> next
 * nominee becomes active."
 *
 * It is a foundry Tray, not a <dialog>: CD-BRIEF's tray ruling keeps the
 * workspace beneath live and touchable, with no scrim and no focus trap, so the
 * register stays readable while a price is typed — which is the point, because
 * the number being typed is standing on the shelf next to the thing the
 * register is naming.
 *
 * EVERY KEY IS A REAL <button>. II.3.4: "a keypress that skips the mechanical
 * layer still lands on the same semantic core." A pad of real buttons is
 * keyboard-complete without a second input to maintain, and PressKey's own
 * down-stroke bloom fires identically for a thumb and for Space.
 *
 * §6 — contact fires ON RELEASE. PressKey voices on the down-stroke, so the
 * cue is left off there and fired here, in the commit's own task.
 */

import { useEffect, useState } from "react";
import { Escutcheon, Plate, PressKey, Tray } from "../../cd/foundry";
import { cue } from "../../cd/sound/cues";
import type { TripRow } from "../../engine/tripCodec";
import { formatMoney } from "./model";

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"] as const;

const KEY_NAME: Record<string, string> = { ".": "decimal point", "⌫": "backspace" };

export interface VerifyPadProps {
  row: TripRow | null;
  onClose: () => void;
  onSubmit: (ingId: string, price: number) => void;
}

export function VerifyPad({ row, onClose, onSubmit }: VerifyPadProps) {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (row) setDraft("");
  }, [row?.ingId]);

  function press(key: string) {
    cue("contact");
    if (key === "⌫") {
      setDraft((d) => d.slice(0, -1));
      return;
    }
    if (key === "." && draft.includes(".")) return;
    const dot = draft.indexOf(".");
    if (dot >= 0 && draft.length - dot > 2) return; // a shelf price, not free text
    if (draft.length >= 7) return;
    setDraft((d) => d + key);
  }

  const parsed = Number(draft);
  const valid = draft.length > 0 && Number.isFinite(parsed) && parsed >= 0;

  return (
    <Tray
      open={row != null}
      onClose={onClose}
      edge="block-end"
      title="verify price"
      exitLabel="cancel"
      className="lst-pad-tray"
      headSlot={row ? <Escutcheon className="lst-pad-item">{row.label}</Escutcheon> : undefined}
    >
      {row && (
        <div className="lst-pad">
          <Plate className="lst-pad-read" surface="data">
            <span className="lst-pad-was">
              planned <span className="cd-data">{formatMoney(Math.round(row.price * 100))}</span>
              {row.estimate ? <span className="lst-chip" data-lst-chip="estimate">est</span> : null}
            </span>
            <span className="lst-pad-draft cd-data" aria-live="polite">
              {draft ? `£${draft}` : "£ —"}
            </span>
          </Plate>

          <div className="lst-pad-keys">
            {PAD_KEYS.map((key) => (
              <PressKey
                key={key}
                className="lst-pad-key"
                onPress={() => press(key)}
                cap={key}
                aria-label={KEY_NAME[key] ?? key}
              />
            ))}
          </div>

          <PressKey
            className="lst-pad-done"
            disabled={!valid}
            onPress={() => {
              cue("confirm"); // II.5.7 — fires only once the write actually lands
              onSubmit(row.ingId, Math.round(parsed * 100) / 100);
            }}
            cap="done"
          />
        </div>
      )}
    </Tray>
  );
}
