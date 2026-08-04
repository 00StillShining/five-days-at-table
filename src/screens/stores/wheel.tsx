// The count-in thumbwheel — STORES' hero (PLAN §6.7 / §6.10, D7). A native
// radio group standing in for "five click-detents": browsers already give a
// radio group arrow-key navigation (ArrowUp/Down moves AND commits the
// selection immediately) and Tab/Shift+Tab roving-focus for free, which is
// exactly the contract's "arrow keys adjust the focused row's level" — no
// custom key handling needed for the wheel itself (the register row also
// supports arrow keys directly; see RegisterRow.tsx). Each detent's <label>
// is sized to the house ≥44px target and doubles as both the tap target and
// the accessible name (visible text = accessible name, PHASE2-CONTRACT).
//
// Flat rendering only (PLAN §6.7: "a ridged strip + detent ticks, no metal
// gradients — Phase 3 machines it"): the "ridges" are a flat two-colour
// repeating pattern, not a shine/gradient. No transition is applied anywhere
// on the detents, so reduced-motion has nothing to collapse — the contract's
// "instant detent" is the default, not a special case.
import type { InventoryLevel } from "../../state/store";

export const DETENT_LABELS: [string, string, string, string, string] = ["empty", "¼", "½", "¾", "full"];
export const DETENT_ANNOUNCE: [string, string, string, string, string] = [
  "empty",
  "a quarter",
  "about half",
  "three quarters",
  "full",
];

export interface ThumbWheelProps {
  armedName: string | null;
  level: InventoryLevel | null;
  onSet: (level: InventoryLevel) => void;
}

export function ThumbWheel({ armedName, level, onSet }: ThumbWheelProps) {
  const disabled = armedName == null || level == null;
  // Visible label AND aria-live announcement, deliberately the same element
  // (PLAN §6.7 contract: "level announced as text ... via aria-live and
  // visible label" — nothing requires two separate nodes, and one node means
  // sighted and assistive-tech users always read the identical sentence).
  const announceText = armedName && level != null ? `${armedName}: ${DETENT_ANNOUNCE[level]}` : "tap a row to set its level";
  return (
    <div className="scr-stores-wheel" aria-label="count-in thumbwheel">
      <p className="scr-stores-wheel-caption" aria-hidden="true">
        roll to set ▸
      </p>
      <fieldset className="scr-stores-wheel-strip" disabled={disabled}>
        <legend className="fd5-visually-hidden">{armedName ? `level for ${armedName}` : "level"}</legend>
        {/* top = full, bottom = empty — a fuel-gauge reads bottom-up */}
        {[4, 3, 2, 1, 0].map((detent) => {
          const checked = level === detent;
          return (
            <label
              key={detent}
              className="fd5-control scr-stores-detent"
              data-checked={checked || undefined}
            >
              <input
                type="radio"
                name="scr-stores-wheel-detent"
                value={detent}
                checked={checked}
                disabled={disabled}
                onChange={() => onSet(detent as InventoryLevel)}
              />
              <span className="scr-stores-detent-glyph" aria-hidden="true">
                {DETENT_LABELS[detent]}
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="scr-stores-wheel-announce" role="status" aria-live="polite">
        {announceText}
      </p>
    </div>
  );
}
