/**
 * src/screens/list/ItemRow.tsx — the press-return control, at the Signature rung.
 *
 * IRREDUCIBLE §7, Signature: "the escutcheon's printed label is removed, and the
 * button loses its own outline — THE ENTIRE COLUMN CARD BECOMES THE PRESSABLE
 * SURFACE, so the object that presses and the object that reports are the same
 * shape ... the dome is the only surface still catching a highlight; everything
 * else on the card sits flush, so the eye has exactly one place to look before
 * it is pressed."
 *
 * So the row IS the button. There is no tick-box beside a label; the whole
 * 56px plate is the press, the dome is the one raised form on it, and the row's
 * five slots (II.6.12) sit flush around it.
 *
 * §3 — THE PRESS-RETURN BUTTON, and why this is a real <button>:
 *   "commits on release inside its bounds — slide off before release and the
 *    gesture cancels — Standard mass."
 * That is precisely what the platform's own `click` gives a <button> for a
 * thumb, and what Enter/Space give it for a keyboard. Synthesising it from
 * pointer events would have produced a second code path for the keyboard to
 * drift down (II.1.18, II.3.4), so there is one path and the browser owns it.
 *
 * §3's DELTA — Système S — is enforced by the caller (useRunOut.isRunning) and
 * re-stated here as `inert`: a press against a window already running does
 * nothing. In a shop that is a free double-tap guard on a jostled thumb.
 *
 * THE 16ms ACK IS IMPERATIVE, NOT A DISPATCH (CD-BRIEF measured perf law).
 * The dome's committed state and its one-frame enamel core are written straight
 * onto the element inside the input's own task. React re-renders afterwards and
 * finds the attribute already carrying the same truth.
 */

import { memo, useCallback } from "react";
import type { TripRow } from "../../engine/tripCodec";
import type { PriceChecks } from "../../state/types";
import {
  ROW_STATE_WORD,
  formatMoney,
  formatQty,
  rowPence,
  rowState,
  type RowState,
} from "./model";

export interface ItemRowProps {
  row: TripRow;
  priceChecks: PriceChecks;
  /** The trip's single active verify nominee, or null. */
  activeVerify: string | null;
  /** True in the BOUGHT register — pressing puts the row back. */
  bought: boolean;
  /** True while this row's own run-out window is open. The press is inert. */
  running: boolean;
  /** The window's length, printed on the gauge as its declared threshold. */
  runOutMs: number;
  /** A trailing station word, used only by the trip-wide BOUGHT lid. */
  stationWord?: string;
  onPress: (row: TripRow, fromKeyboard: boolean, el: HTMLButtonElement) => void;
}

const SPOKEN: Record<RowState, string> = {
  plain: "",
  estimate: ", price is an estimate",
  verify: ", price wants verifying",
  checked: ", price verified in store",
};

function ItemRowBase({
  row,
  priceChecks,
  activeVerify,
  bought,
  running,
  runOutMs,
  stationWord,
  onPress,
}: ItemRowProps) {
  const state = rowState(row, priceChecks, activeVerify);
  const chip = ROW_STATE_WORD[state];
  const qty = formatQty(row.qty, row.packG);
  const money = formatMoney(rowPence(row, priceChecks));

  /*
   * II.4.3's down-stroke, for the KEYBOARD as well as the thumb. `:active`
   * covers a pointer and Space but not Enter, and the bloom has to be identical
   * for both (II.1.18: "a keypress that skips the mechanical layer still lands
   * on the same semantic core"). This writes one attribute straight onto the
   * element, so a held key costs zero renders.
   */
  const strokeDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.repeat) return; // II.1.18 — the OS repeat clock never machine-guns a commit
    if (event.key !== " " && event.key !== "Enter") return;
    event.currentTarget.dataset.lstPressed = "true";
    navigator.vibrate?.(10);
  }, []);

  const strokeUp = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.currentTarget.dataset.lstPressed = "false";
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const el = event.currentTarget;
      if (running) return; // Système S — inert against its own running window

      /* 1 · THE ACK, this task, before anything else. §3's own worked JS:
             `control.dataset.commit = "true"` then cleared two frames later.
             The enamel core (II.2.12) is the single committed frame and is the
             ONLY licensed appearance of live outside a draining gauge. */
      el.dataset.lstBought = bought ? "false" : "true";
      el.dataset.lstCommit = "true";
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (el.isConnected) el.dataset.lstCommit = "false";
        })
      );

      /* 2 · the semantic commit, and the report after it. `detail === 0` is a
             keyboard-driven activation: only then does focus advance, because
             moving focus under a thumb would yank the page out from under it. */
      onPress(row, event.detail === 0, el);
    },
    [bought, onPress, row, running]
  );

  return (
    <button
        type="button"
        className="lst-row cd-focusable"
        data-lst-bought={bought ? "true" : "false"}
        data-lst-running={running ? "true" : undefined}
        data-lst-state={state}
        aria-pressed={bought || running}
        aria-disabled={running || undefined}
        title={row.label}
        onClick={handleClick}
        onKeyDown={strokeDown}
        onKeyUp={strokeUp}
        onPointerDown={() => navigator.vibrate?.(10)}
        onBlur={(event) => {
          event.currentTarget.dataset.lstPressed = "false";
        }}
      >
        {/* THE MARK — slot 1. The one raised, light-catching form on the plate. */}
        <span className="lst-mark" aria-hidden="true">
          <span className="lst-dome" />
        </span>

        {/* IDENTITY — slot 2. The accessible name STARTS with the printed
            words (WCAG 2.5.3), and the elaboration trails behind them. */}
        <span className="lst-id">
          {row.label}
          <span className="lst-vh">
            {`, ${qty}, ${money}${SPOKEN[state]}${bought ? ", bought" : ""}${
              running ? ", in the put-back window" : ""
            }`}
          </span>
        </span>

        {/* SECONDARY — slot 3, and the ink-only state chip, slot 5. Muted here
            is WEIGHT, not a paler hex: this world's own §2 spends its roles
            "in weight, never in hue", and every role ink measures 2.04:1 on
            epoxy (world.css, the epoxy ceiling). */}
        <span className="lst-sec" aria-hidden="true">
          <span className="lst-qty cd-data">{qty}</span>
          {stationWord ? <span className="lst-chip" data-lst-chip="station">{stationWord}</span> : null}
          {chip ? (
            <span className="lst-chip" data-lst-chip={state}>
              {chip}
            </span>
          ) : null}
        </span>

        {/* VALUE BLOCK — slot 4, with the flow-gauge sliver NESTED INSIDE IT
            rather than claiming a sixth slot the doctrine never grants (§4,
            List/Browser). The sliver exists only while the window runs: §9's
            first failure mode is "any mark on a card not yet pressed". */}
        <span className="lst-value" aria-hidden="true">
          <span className="lst-price cd-data">{money}</span>
          {/* The gauge's BOX is reserved at rest and carries no mark — §9's
              first failure mode is "any mark on a card not yet pressed" — and
              reserving it is also what stops the price stepping left on every
              tick. The fill mounts with the window, so a new window is a new
              element with a fresh taper rather than a rewound old one. */}
          <span
            className="lst-sliver"
            data-lst-running={running ? "true" : "false"}
            style={{ "--lst-runout-ms": `${runOutMs}ms` } as React.CSSProperties}
          >
            {running ? <span className="lst-sliver-fill" /> : null}
          </span>
        </span>
      </button>
  );
}

/**
 * The register is reconciled on every tick, and 97% of a frame is JavaScript
 * (CD-BRIEF's measured perf law). Memoised, one level change costs one row
 * body, not forty-four.
 */
export const ItemRow = memo(ItemRowBase);
