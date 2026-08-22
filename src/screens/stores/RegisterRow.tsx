/**
 * src/screens/stores/RegisterRow.tsx — one row, MILLED INTO the plate.
 *
 * ---------------------------------------------------------------------------
 * THE ROW OWNS NO ENCLOSURE, AND THAT IS THE WHOLE DESIGN
 * ---------------------------------------------------------------------------
 * CLEAR LID section 9 names this language's own structural failure by itself:
 *
 *   "LID INFLATION. Every card on a dashboard earns its own full lid rather
 *    than sharing one hierarchy. Warning sign: the screen reads as a cabinet of
 *    specimen cases with no leading object."
 *
 * A register of sixty-five rows is exactly the shape that invites it. So the
 * row has no background, no shadow stack and no lid of its own: the PLATE
 * underneath carries the material, its two milled channels are the wells, and
 * ONE travelling acrylic pane covers the mechanism. Sixty-five rows, one
 * machined object.
 *
 * (CLEAR LID's own repair for lid inflation is II.2.5's one-hero rule, which
 * CORRECTIONARY 3.1 REVOKES. What survives here is the structural half — one
 * plate, one construction hierarchy — never the rationing half. The screen
 * still carries six hero-grade instruments at full treatment.)
 *
 * ---------------------------------------------------------------------------
 * TWO INSTRUMENTS PER ROW, BOTH STABLE-DATA INSTRUMENTS
 * ---------------------------------------------------------------------------
 * CD-BRIEF ruling 6: "Portholes, rocker arms and spinning elements attach only
 * to values whose change is user-caused or clock-continuous. A daily stock
 * level gets a needle and a printed zone, not a spinning disc."
 *
 *   LEVEL  a pointer travelling a printed five-seat scale at a fixed RATE
 *          (340px/s, floored at 80ms — II.4.8), plus its exact word.
 *   LIFE   an engraved index over a printed life zone, plus its exact figure
 *          in tabular days.
 *
 * Both are silent when the value holds (II.4.16 — stable data, stable
 * instrument), and an unstocked row's pointer sits on a physical stop and does
 * not glow, because a dead needle at zero is more honest than a lit one that
 * means nothing.
 *
 * ---------------------------------------------------------------------------
 * FRESHNESS, PER ROW
 * ---------------------------------------------------------------------------
 * Owner ruling: "stocktake threshold is 72h and each class prints its declared
 * threshold on its own label ... An unrecorded reading is NEVER, never an age
 * of zero." So a row that has never been counted prints `never` in its own age
 * cell, its level word prints `uncounted` rather than `empty`, and its pointer
 * parks on the rest stop. A row counted longer ago than the class's 72h HOLDS
 * its value at 55% ink and prints the class's own word.
 */

import { memo, useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { Ingredient } from "../../data/types";
import type { InventoryEntry, InventoryLevel } from "../../state/types";
import { ageOf, FRESHNESS } from "../../cd/freshness/classes";
import { countdownForIngredient, type CountdownStatus } from "./countdown";
import { registerDisambiguator, registerNameSuffix } from "./registerName";
import { LEVEL_WORD, levelPx, lifePxOf, sweepMs } from "./model";

/** II.7.7 — colour never travels alone; every status prints a glyph too. */
const STATUS_GLYPH: Record<CountdownStatus, string> = {
  expired: "✕ ",
  expiring: "△ ",
  frozen: "❄ ",
  "low-confidence": "",
  ok: "",
  empty: "",
};

/** The stocktake class's own declared threshold, printed on the gauge's label. */
export const STOCKTAKE_THRESHOLD = `${Math.round(FRESHNESS.stocktake.staleAfterMs / 3_600_000)}h`;

export interface RegisterRowProps {
  ing: Ingredient;
  entry: InventoryEntry | undefined;
  /** Position inside the OPEN group — drives the lid's cut, nothing else. */
  index: number;
  armed: boolean;
  /** The coarse clock. Day-granularity countdowns never ride a 1Hz tick. */
  nowMs: number;
  /** Measured once per resize, never per row and never per frame. */
  scalePx: number;
  lifePx: number;
  onArm: (id: string, index: number, eventTs: number) => void;
  /**
   * RELATIVE travel, resolved against the COMMITTED model rather than against
   * this render's own `level`. See the note on `handleKeyDown`.
   */
  onStep: (id: string, step: number | "min" | "max", eventTs: number) => void;
  registerEl: (id: string, el: HTMLButtonElement | null) => void;
  registerPointer: (id: string, el: HTMLSpanElement | null) => void;
}

function RegisterRowBase({
  ing,
  entry,
  index,
  armed,
  nowMs,
  scalePx,
  lifePx,
  onArm,
  onStep,
  registerEl,
  registerPointer,
}: RegisterRowProps) {
  const level: InventoryLevel = (entry?.level ?? 0) as InventoryLevel;
  const countdown = countdownForIngredient(ing, entry, new Date(nowMs));
  const suffix = `${registerNameSuffix(ing)}${registerDisambiguator(ing)}`;
  const age = ageOf("stocktake", entry?.updatedAt, nowMs);
  const counted = entry !== undefined;

  const pointerRef = useRef<HTMLSpanElement | null>(null);
  /*
    AN UNCOUNTED ROW'S NEEDLE PARKS ON A PHYSICAL REST STOP, not on the "empty"
    seat. II.3.18: "off state parks the needle 4 degrees BELOW the minimum tick,
    against a physical rest stop." A needle sitting on the first seat is a
    reading of EMPTY, which is a different claim from "nobody has looked" — and
    printing `never` beside a needle that says `empty` is two channels
    disagreeing about the same row.
  */
  const restStop = 0;
  const shownRef = useRef<number>(counted ? levelPx(level, scalePx) : restStop);
  const targetPx = counted ? levelPx(level, scalePx) : restStop;

  /**
   * The sweep is a compositor transition whose DURATION is derived per move
   * from the slew rate — a rate expressed in CSS, never a fixed tween, and
   * zero script per frame (the measured performance law's rule 6: "the
   * cheapest sweep is a rate-derived CSS transition").
   *
   * The commit path also writes these two properties IMPERATIVELY, in the
   * input's own task, so the needle answers inside the Floor's 16ms rather
   * than waiting for React. When the render lands, this effect writes the
   * identical values, which is a no-op for the transition.
   */
  const lastLevelRef = useRef(level);
  const lastCountedRef = useRef(counted);
  useEffect(() => {
    const el = pointerRef.current;
    if (!el) return;
    // A sweep reports a LEVEL change; a re-measure of the channel is geometry
    // and lands in one frame (model.ts's `sweepMs`, and the defect it names).
    const changed = lastLevelRef.current !== level || lastCountedRef.current !== counted;
    lastLevelRef.current = level;
    lastCountedRef.current = counted;
    el.style.setProperty("--str-pointer-ms", `${sweepMs(shownRef.current, targetPx, changed).toFixed(0)}ms`);
    el.style.setProperty("--str-pointer-x", `${targetPx.toFixed(2)}px`);
    el.dataset.x = String(targetPx);
    shownRef.current = targetPx;
  }, [targetPx, level, counted]);

  /**
   * KEYBOARD IS THE DETENT (II.3.4 — "keys are actuators"): one press seats one
   * well, Home/End are the hard limits, and the ends are stops rather than
   * wraps (II.3.6 — a detented control has physical limits).
   *
   * THE STEP IS SENT AS A DELTA, NOT AS A DESTINATION, and that is the same law
   * the whole screen is built on rather than a style choice. `level` here is
   * THIS RENDER'S level, and the measured performance law's own sentence is
   * "the model is still stale when your handler returns". MEASURED on the live
   * screen: six arrow presses inside one task moved the needle once, because
   * every one of them computed `level + 1` from the same stale render. Sending
   * the delta lets the scene resolve it against the committed model, so two
   * presses inside one frame are two seats — which is what the hand did.
   */
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      onStep(ing.id, 1, e.timeStamp);
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      onStep(ing.id, -1, e.timeStamp);
    } else if (e.key === "Home") {
      e.preventDefault();
      onStep(ing.id, "min", e.timeStamp);
    } else if (e.key === "End") {
      e.preventDefault();
      onStep(ing.id, "max", e.timeStamp);
    }
  }

  const lifeX = countdown.fraction === null ? null : lifePxOf(countdown.fraction, lifePx);
  const levelText = counted ? LEVEL_WORD[level] : "never";

  return (
    <button
      type="button"
      ref={(el) => {
        registerEl(ing.id, el);
      }}
      className="str-row cd-focusable"
      data-level={level}
      data-status={countdown.status}
      data-counted={counted ? "true" : "false"}
      data-stale={age.stale && counted ? "true" : "false"}
      data-armed={armed ? "true" : "false"}
      style={{ ["--str-row-i" as string]: String(index) }}
      onFocus={(e) => onArm(ing.id, index, e.timeStamp)}
      onPointerDown={(e) => onArm(ing.id, index, e.timeStamp)}
      onKeyDown={handleKeyDown}
    >
      {/*
        WCAG 2.5.3, LABEL IN NAME. The accessible name STARTS with exactly the
        words printed on the plate, so a voice-control user saying what they can
        see reaches this control; the spoken elaboration is appended in a
        visually-hidden span rather than replacing the visible text with an
        aria-label that says something else.
      */}
      <span className="str-row__name">
        {ing.name.short}
        <span className="str-row__suffix">{suffix}</span>
      </span>
      <span className="str-vh">
        {`, level ${levelText}, ${
          countdown.status === "empty"
            ? "not stocked"
            : countdown.status === "frozen"
              ? "still frozen"
              : `use-by ${countdown.text}`
        }, counted ${age.ms == null ? "never" : `${age.label} ago`}`}
      </span>

      {/* the mechanism, in the milled channels — under the lid */}
      <span className="str-row__scale" aria-hidden="true">
        <span
          className="str-row__pointer"
          ref={(el) => {
            pointerRef.current = el;
            registerPointer(ing.id, el);
          }}
        />
      </span>

      <span className="str-row__life" aria-hidden="true">
        {lifeX !== null && (
          <span className="str-row__marker" style={{ ["--str-marker-x" as string]: `${lifeX.toFixed(2)}px` }} />
        )}
      </span>

      {/*
        THE PRINTED FIGURES SIT OUTSIDE THE LID, ON THE CHASSIS — exactly as the
        source object prints its markings on the cream steel rather than under
        the hood. It is also a Floor requirement: the spike measured the level
        word at 3.42:1 when it sat inside the channel under the glance pane, and
        6.46:1 on the plate's own face. A tint over type lowers contrast at every
        intensity; there is no tuning that fixes it.
      */}
      {/*
        THE STALE DROP IS AN INK, NOT AN ALPHA — and the row's own
        `data-stale` attribute already carries the condition, so the drop is
        declared once, in stores.css, rather than inlined here.

        MEASURED, and it was a real Floor failure: `opacity: STALE_INK_ALPHA`
        (0.55) on this span composited #4A453C down to #948F86 over the plate's
        own face and printed the held level word at 2.68-2.71:1 at 1280x800 and
        2.10:1 at 390x844. The ground was never the problem — the plate declares
        #EDE8DE and paints #EFEAE1-#F0ECE3 under this column — the ALPHA was.
        See stores.css section 7 for the ink and its measured figures.
      */}
      <span className="str-row__figure" aria-hidden="true">
        {levelText}
      </span>

      <span className="str-row__countdown" aria-hidden="true">
        {STATUS_GLYPH[countdown.status]}
        {countdown.text}
      </span>

      {/* the age, always printed — honesty is not a stale-only courtesy */}
      <span className="str-row__age" aria-hidden="true">
        {age.ms == null ? "never" : age.label}
      </span>
    </button>
  );
}

export const RegisterRow = memo(RegisterRowBase);
