/**
 * src/screens/shop/ReconcileTray.tsx — the trip's manual-first reconciliation.
 *
 * PLAN §6.8, unchanged in substance: "reconcile manual-first: a 'read back' note
 * tells the owner to type verify entries from the phone's summary — NO sync
 * infrastructure; ticked-state stays on the phone (D2)." SHOP never reads
 * anything back from a phone automatically. The owner reads their own screen and
 * types the numbers in here.
 *
 * WHAT THE FLUSH-CHECK ON THE RECONCILE CROWN IS ACTUALLY REPORTING. Every price
 * typed in here moves one line from "not yet" to "true", and when the last
 * nominee lands the crown's ring snaps flush and the horizon closes. That chain
 * is the reason this tray exists as an instrument rather than as a form: the
 * consequence of typing a number is visible on the band, not just in the field.
 *
 * SOUND: II.5.7 — confirm fires "only once a real consequence has landed", which
 * is after the reducer has committed the price, not when the key is pressed.
 */

import { useId, useState, type FormEvent } from "react";
import { Tray } from "../../cd/foundry";
import { CapKey } from "./Instruments";
import { PRICE_STALE_DAYS, money, signedMoney } from "./model";
import type { PadRow } from "./model";
import type { PriceChecks } from "../../state/types";
import type { EffectiveLine } from "./tripHelpers";

export type ReconcileRow = PadRow;

export interface ReconcileTrayProps {
  open: boolean;
  onClose: () => void;
  id: string;
  /**
   * EVERY line this pad can fix — not only the arbiter's two or three nominees.
   * The plinth's stale reading names this pad as its recovery action, and a
   * recovery that opens a panel which cannot reach the value that went stale is
   * a control that lies about being able to recover.
   */
  rows: ReconcileRow[];
  /** Lines already carrying a typed-back figure, so the pad shows its own work. */
  done: { el: EffectiveLine; check: { price: number; on: string } }[];
  priceChecks: PriceChecks;
  onSave: (ingId: string, price: number) => void;
  /** The one line the reconcile crown is currently standing on. */
  activeId: string | null;
  tester: boolean;
}

function VerifyRow({
  row,
  onSave,
  active,
}: {
  row: ReconcileRow;
  onSave: (ingId: string, price: number) => void;
  active: boolean;
}) {
  const [draft, setDraft] = useState("");
  const fieldId = useId();
  const parsed = Number(draft);
  const valid = Number.isFinite(parsed) && parsed > 0;
  const sheet = row.el.line.price;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    onSave(row.el.line.ingId, Math.round(parsed * 100) / 100);
    setDraft("");
  }

  return (
    <li
      className="shop-verify-row"
      data-shop-active={active ? "true" : undefined}
      data-shop-cost={row.reading.cls}
    >
      <form className="shop-verify-form" onSubmit={submit}>
        <label htmlFor={fieldId} className="shop-verify-name" title={row.el.line.product}>
          {row.el.line.product}
        </label>
        <span className="shop-word">{row.nominated ? "NOMINATED" : row.reading.word}</span>
        <span className="shop-verify-field">
          <span className="shop-verify-prefix" aria-hidden="true">
            £
          </span>
          <input
            id={fieldId}
            className="shop-input cd-focusable"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder={money(sheet)}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </span>
        {/* the delta this save WILL produce, printed before it is committed:
            II.6.17's signed column, live, so the consequence is legible in the
            frame the digits land rather than after the fact */}
        <span className="shop-delta" aria-hidden="true">
          {valid ? signedMoney(Math.round((parsed - sheet) * 100) / 100) : "—"}
        </span>
        <button type="submit" className="shop-cap-key cd-key cd-focusable" disabled={!valid}>
          <span>save</span>
        </button>
      </form>
    </li>
  );
}

export function ReconcileTray({
  open,
  onClose,
  id,
  rows,
  done,
  onSave,
  activeId,
  tester,
}: ReconcileTrayProps) {
  return (
    <Tray
      id={id}
      open={open}
      onClose={onClose}
      edge="inline-end"
      title="reconcile"
      exitLabel="close"
      className="shop-tray"
      headSlot={
        <span className="shop-crown-fig cd-data">
          {done.length}/{done.length + rows.length}
        </span>
      }
    >
      <div className="shop-tray-body">
        <p className="shop-note">
          back from the shop? read back your phone's summary and type in what you verified. nothing
          syncs automatically — the ticked-off state stays on the phone. a typed price is current for{" "}
          {PRICE_STALE_DAYS} days, and every line that gets one closes its own mark.
        </p>

        {tester && (
          <p className="shop-note" role="note">
            this variant's basket is a verified receipt: every line already carries a real price, so
            there is nothing to nominate and the ring beside this pad reads true from the start.
          </p>
        )}

        {rows.length === 0 ? (
          <p className="shop-note">
            every line on this trip carries a current price. nothing to reconcile.
          </p>
        ) : (
          <>
            {/* II.6.24 — the count is the confession, and it is a measurement. */}
            <p className="shop-note">
              <b className="cd-overflow-count cd-data">{rows.length}</b> line
              {rows.length === 1 ? "" : "s"} without a current price
            </p>
            <ul className="shop-verify-list">
              {rows.map((row) => (
                <VerifyRow
                  key={row.el.line.ingId}
                  row={row}
                  onSave={onSave}
                  active={row.el.line.ingId === activeId}
                />
              ))}
            </ul>
          </>
        )}

        {done.length > 0 && (
          <ul className="shop-verify-list" aria-label="checked">
            {done.map(({ el, check }) => {
              const delta = Math.round((check.price - el.line.price) * 100) / 100;
              return (
                <li key={el.line.ingId} className="shop-verify-row" data-shop-done="true">
                  <span className="shop-verify-name" title={el.line.product}>
                    {el.line.product}
                  </span>
                  <span className="shop-price cd-data">£{money(check.price)}</span>
                  <span
                    className="shop-delta"
                    data-shop-sign={delta > 0 ? "up" : delta < 0 ? "down" : undefined}
                  >
                    {signedMoney(delta)}
                  </span>
                  <span className="shop-word">checked {check.on}</span>
                </li>
              );
            })}
          </ul>
        )}

        <CapKey cap="done" onPress={onClose} />
      </div>
    </Tray>
  );
}
