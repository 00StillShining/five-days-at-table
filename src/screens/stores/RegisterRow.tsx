// One register row (PLAN §6.7): name + level pips + use-by countdown, ≥44px,
// tap-to-focus. "Focus" here is deliberately the SAME concept as real DOM
// focus (Tab reaches every row in order; clicking a row also focuses it) —
// one state, not two — so a keyboard-only stocktake never needs a separate
// "arm" step distinct from normal tabbing. While a row has focus, ArrowUp/
// ArrowDown adjust ITS level directly (no need to tab into the thumbwheel at
// all); the wheel (wheel.tsx) is the same control's redundant fine-pointer
// path, for mouse/touch users who want to jump straight to a detent.
//
// Wave-1-fix item 3: `onAdjust` (renamed from `onSetLevel`) is deliberately
// the RELATIVE-only path — ArrowUp/Down nudge this row's level by ±1 and
// stay on this row, never auto-advancing. Auto-advance is reserved for the
// wheel's ABSOLUTE detent picks (index.tsx's `handleWheelSet`); before this
// fix, every set (relative or absolute) auto-advanced, which meant a
// keyboard user pressing ArrowUp on an "empty" row got bounced to the NEXT
// row after the very first press — there was no way to arrow-key a row past
// level 1. Multiple ArrowUp/Down presses here now walk 0..4 on the SAME row.
import type { KeyboardEvent } from "react";
import type { Ingredient } from "../../data/types";
import type { InventoryEntry, InventoryLevel } from "../../state/store";
import { countdownForIngredient, type CountdownStatus } from "./countdown";
import { registerDisambiguator, registerNameSuffix } from "./registerName";
import { DETENT_LABELS } from "./wheel";

const PIP_COUNT = 4; // level 0..4 -> 0..4 filled of 4 (a standard 4-bar "signal strength" gauge)

function Pips({ level }: { level: InventoryLevel }) {
  return (
    <span className="scr-stores-pips" aria-hidden="true">
      {Array.from({ length: PIP_COUNT }, (_, i) => (
        <span key={i} className={`scr-stores-pip${i < level ? " scr-stores-pip--on" : ""}`} />
      ))}
    </span>
  );
}

const STATUS_GLYPH: Record<CountdownStatus, string> = {
  expired: "✕",
  expiring: "△",
  "low-confidence": "",
  frozen: "",
  ok: "",
  empty: "",
};

export interface RegisterRowProps {
  ing: Ingredient;
  entry: InventoryEntry | undefined;
  armed: boolean;
  now: Date;
  onArm: (id: string) => void;
  /** Relative-only: ArrowUp/Down nudge by ±1, no auto-advance. See file doc. */
  onAdjust: (id: string, level: InventoryLevel) => void;
  registerEl: (id: string, el: HTMLButtonElement | null) => void;
}

export function RegisterRow({ ing, entry, armed, now, onArm, onAdjust, registerEl }: RegisterRowProps) {
  const level: InventoryLevel = entry?.level ?? 0;
  const countdown = countdownForIngredient(ing, entry, now);
  const nameSuffix = `${registerNameSuffix(ing)}${registerDisambiguator(ing)}`;

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onAdjust(ing.id, Math.min(4, level + 1) as InventoryLevel);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onAdjust(ing.id, Math.max(0, level - 1) as InventoryLevel);
    }
  }

  const accessibleName = `${ing.name.short}${nameSuffix}, level ${DETENT_LABELS[level]}, ${
    countdown.status === "empty" ? "not stocked" : countdown.status === "frozen" ? "still frozen" : `use-by ${countdown.text}`
  }`;

  return (
    <li className="scr-stores-row-item">
      <button
        type="button"
        ref={(el) => registerEl(ing.id, el)}
        className={`fd5-control scr-stores-row${armed ? " scr-stores-row--armed" : ""} scr-stores-row--${countdown.status}`}
        onFocus={() => onArm(ing.id)}
        onClick={() => onArm(ing.id)}
        onKeyDown={handleKeyDown}
        aria-label={accessibleName}
      >
        <span className="scr-stores-row-name" aria-hidden="true">
          {ing.name.short}
          {nameSuffix}
        </span>
        <Pips level={level} />
        <span className="scr-stores-row-countdown" aria-hidden="true">
          {STATUS_GLYPH[countdown.status] && <span className="scr-stores-row-glyph">{STATUS_GLYPH[countdown.status]}</span>}
          {countdown.text}
        </span>
      </button>
    </li>
  );
}
