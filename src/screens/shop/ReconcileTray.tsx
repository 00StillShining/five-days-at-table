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
import type { PriceChecks } from "../../state/types";

export interface ReconcileNominee {
  ingId: string;
  /** The product string, matching the row the shopper saw in the register. */
  name: string;
  /** The sheet's own price for the line, for the delta the save will produce. */
  sheet: number;
}

export interface ReconcileTrayProps {
  open: boolean;
  onClose: () => void;
  id: string;
  nominees: ReconcileNominee[];
  priceChecks: PriceChecks;
  onSave: (ingId: string, price: number) => void;
  /** The one nominee the crown is currently standing on. */
  activeId: string | null;
  tester: boolean;
}

function VerifyRow({
  nominee,
  onSave,
  active,
}: {
  nominee: ReconcileNominee;
  onSave: (ingId: string, price: number) => void;
  active: boolean;
}) {
  const [draft, setDraft] = useState("");
  const fieldId = useId();
  const parsed = Number(draft);
  const valid = Number.isFinite(parsed) && parsed > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    onSave(nominee.ingId, Math.round(parsed * 100) / 100);
    setDraft("");
  }

  return (
    <li className="shop-verify-row" data-shop-active={active ? "true" : undefined}>
      <form className="shop-verify-form" onSubmit={submit}>
        <label htmlFor={fieldId} className="shop-verify-name" title={nominee.name}>
          {nominee.name}
        </label>
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
            placeholder={money(nominee.sheet)}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </span>
        {/* the delta this save WILL produce, printed before it is committed:
            II.6.17's signed column, live, so the consequence is legible in the
            frame the digits land rather than after the fact */}
        <span className="shop-delta" aria-hidden="true">
          {valid ? signedMoney(Math.round((parsed - nominee.sheet) * 100) / 100) : "—"}
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
  nominees,
  priceChecks,
  onSave,
  activeId,
  tester,
}: ReconcileTrayProps) {
  const outstanding = nominees.filter((n) => !priceChecks[n.ingId]);
  const done = nominees.filter((n) => priceChecks[n.ingId]);

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
          {done.length}/{nominees.length}
        </span>
      }
    >
      <div className="shop-tray-body">
        <p className="shop-note">
          back from the shop? read back your phone's summary and type in what you verified. nothing
          syncs automatically — the ticked-off state stays on the phone. a typed price is current for{" "}
          {PRICE_STALE_DAYS} days.
        </p>

        {tester && (
          <p className="shop-note" role="note">
            this variant's basket is a verified receipt: every line already carries a real price, so
            there is nothing to nominate and the ring beside this pad reads true from the start.
          </p>
        )}

        {nominees.length === 0 ? (
          <p className="shop-note">nothing to verify on this trip.</p>
        ) : (
          <>
            {outstanding.length > 0 && (
              <ul className="shop-verify-list">
                {outstanding.map((n) => (
                  <VerifyRow
                    key={n.ingId}
                    nominee={n}
                    onSave={onSave}
                    active={n.ingId === activeId}
                  />
                ))}
              </ul>
            )}
            {done.length > 0 && (
              <ul className="shop-verify-list" aria-label="verified">
                {done.map((n) => {
                  const check = priceChecks[n.ingId];
                  return (
                    <li key={n.ingId} className="shop-verify-row" data-shop-done="true">
                      <span className="shop-verify-name" title={n.name}>
                        {n.name}
                      </span>
                      <span className="shop-price cd-data">
                        £{money(check.price)}
                      </span>
                      <span className="shop-delta" data-shop-sign={check.price > n.sheet ? "up" : check.price < n.sheet ? "down" : undefined}>
                        {signedMoney(Math.round((check.price - n.sheet) * 100) / 100)}
                      </span>
                      <span className="shop-word">checked</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        <CapKey cap="done" onPress={onClose} />
      </div>
    </Tray>
  );
}
