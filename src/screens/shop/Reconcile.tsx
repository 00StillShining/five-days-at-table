// Trip lifecycle's manual-first reconciliation step (PLAN §6.8: "reconcile
// manual-first: a 'read back' note tells the owner to type verify entries
// from the phone's summary — NO sync infrastructure; ticked-state stays on
// the phone (D2)"). This is the desktop-side half: SHOP never reads
// anything back from the phone automatically — the owner reads their own
// phone screen and types the numbers in here.
import { useId, useState, type FormEvent } from "react";
import type { PriceChecks } from "../../state/types";
import type { EffectiveLine } from "./tripHelpers";

export interface ReconcileProps {
  verifyNominees: string[];
  lines: EffectiveLine[];
  priceChecks: PriceChecks;
  onSave: (ingId: string, price: number) => void;
  /** Lets index.tsx deep-link the arbiter's verify-nominee action straight to
   * this row's input (mirrors src/screens/stores/index.tsx's `registerEl`
   * pattern for its own arbiter deep links). */
  registerEl?: (ingId: string, el: HTMLInputElement | null) => void;
}

function VerifyRow({
  ingId,
  name,
  onSave,
  registerEl,
}: {
  ingId: string;
  name: string;
  onSave: (ingId: string, price: number) => void;
  registerEl?: (ingId: string, el: HTMLInputElement | null) => void;
}) {
  const [draft, setDraft] = useState("");
  const fieldId = useId();

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onSave(ingId, Math.round(parsed * 100) / 100);
  }

  return (
    <li className="scr-shop-verify-row">
      <form className="scr-shop-verify-form" onSubmit={submit}>
        <label htmlFor={fieldId} className="scr-shop-verify-label">
          {name}
        </label>
        <span className="scr-shop-verify-prefix" aria-hidden="true">
          £
        </span>
        <input
          id={fieldId}
          ref={(el) => registerEl?.(ingId, el)}
          className="fd5-control scr-shop-verify-input"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="fd5-control scr-shop-verify-save">
          save
        </button>
      </form>
    </li>
  );
}

export function Reconcile({ verifyNominees, lines, priceChecks, onSave, registerEl }: ReconcileProps) {
  // Matches the product string shown in the costed columns above (not the
  // shorter ingredient display name) so the owner can recognize the same row
  // they saw while shopping.
  const nameFor = (ingId: string) => lines.find((l) => l.line.ingId === ingId)?.line.product ?? ingId;
  const outstanding = verifyNominees.filter((id) => !priceChecks[id]);
  const done = verifyNominees.filter((id) => priceChecks[id]);

  return (
    <section className="scr-shop-reconcile" aria-labelledby="scr-shop-reconcile-h">
      <h2 id="scr-shop-reconcile-h" className="scr-shop-h">
        reconcile
      </h2>
      <p className="scr-shop-reconcile-note">
        back from the shop? read back your phone's summary and type in what you verified — nothing syncs automatically; the
        ticked-off state stays on the phone.
      </p>
      {verifyNominees.length === 0 ? (
        <p className="scr-shop-muted">nothing to verify this trip.</p>
      ) : (
        <>
          {outstanding.length > 0 && (
            <ul className="scr-shop-verify-list">
              {outstanding.map((id) => (
                <VerifyRow key={id} ingId={id} name={nameFor(id)} onSave={onSave} registerEl={registerEl} />
              ))}
            </ul>
          )}
          {done.length > 0 && (
            <ul className="scr-shop-verify-done-list">
              {done.map((id) => (
                <li key={id} className="scr-shop-verify-done-row">
                  {"✓ "}
                  {nameFor(id)} · £{priceChecks[id].price.toFixed(2)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
