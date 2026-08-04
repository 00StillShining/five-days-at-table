// The count-in thumbwheel — STORES' hero (PLAN §6.7 / §6.10, D7). A native
// radio group standing in for "five click-detents": browsers already give a
// radio group arrow-key navigation (ArrowUp/Down moves AND commits the
// selection immediately) and Tab/Shift+Tab roving-focus for free, which is
// exactly the contract's "arrow keys adjust the focused row's level" — no
// custom key handling needed for the wheel itself (the register row also
// supports arrow keys directly; see RegisterRow.tsx). Each detent's <label>
// is sized to the house ≥44px target.
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
  /** Visible + aria-live text (PLAN §6.7: "announced as text ... via
   * aria-live and visible label"). Computed by the parent screen rather than
   * derived here from `armedName`/`level` alone — wave-1-fix item 6 requires
   * this to read as a CONFIRMATION of whatever was just set ("greek yoghurt:
   * about half"), which persists through the auto-advance jump to the next
   * row rather than being immediately overwritten by that row's own
   * (usually "empty") level; that little state machine lives in index.tsx
   * alongside the rest of arm/set, this component just renders the string. */
  announceText: string;
}

export function ThumbWheel({ armedName, level, onSet, announceText }: ThumbWheelProps) {
  const disabled = armedName == null || level == null;
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
            <label key={detent} className="fd5-control scr-stores-detent" data-checked={checked || undefined}>
              <input
                type="radio"
                name="scr-stores-wheel-detent"
                value={detent}
                checked={checked}
                disabled={disabled}
                onChange={() => onSet(detent as InventoryLevel)}
              />
              {/* Compact glyph — visible, but aria-hidden (nonessential
                  engraving band, 9-11px per PHASE2-CONTRACT). A <label>'s
                  accessible-name computation EXCLUDES aria-hidden
                  descendants, so this alone left every radio with an EMPTY
                  accessible name (wave-1-fix item 1, a11y major) — the
                  sr-only span below supplies the real one. */}
              <span className="scr-stores-detent-glyph" aria-hidden="true">
                {DETENT_LABELS[detent]}
              </span>
              <span className="fd5-visually-hidden">{DETENT_ANNOUNCE[detent]}</span>
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
