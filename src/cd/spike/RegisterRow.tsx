/**
 * src/cd/spike/RegisterRow.tsx — one row, milled into the plate.
 *
 * The row owns NO enclosure. It has no background, no shadow stack and no lid
 * of its own: the plate underneath it carries the material, the two milled
 * channels carry the wells, and the single travelling acrylic strip carries
 * selection. That is the whole mitigation, expressed as an absence.
 *
 * Two instruments per row, both stable-data instruments (CD-BRIEF ruling 6 —
 * "portholes, rocker arms and spinning elements attach only to values whose
 * change is user-caused or clock-continuous ... A daily stock level gets a
 * needle and a printed zone, not a spinning disc"):
 *
 *   LEVEL  a pointer travelling a printed five-seat scale, at a fixed slew rate
 *          (CLEAR LID section 3's lamp-scale pointer, unrolled to a straight
 *          line: 340px/s, floored at 80ms — II.4.8, "sweep is rate, not
 *          duration"), plus its exact word.
 *   LIFE   an engraved index over a printed life zone, plus its exact figure in
 *          tabular days.
 *
 * MOTION MODE is switchable so mitigation 4 ("one integrator, not one rAF per
 * row") is a measurement rather than an assertion:
 *   css         — the sweep as a compositor-only CSS transition, duration
 *                 written per move from the slew rate. Zero script per frame.
 *   integrator  — src/cd/physics/integrator.ts, ONE shared rAF, Weighted mass
 *                 (CLEAR LID section 5: --cd-clearlid-spring-platter, the scale
 *                 pointer's own class). Writes style directly; no re-render.
 *   raf         — the naive translation: one requestAnimationFrame loop PER ROW.
 */

import { memo, useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { Ingredient } from "../../data/types";
import type { InventoryEntry, InventoryLevel } from "../../state/types";
import { createMassSpring, type Spring } from "../physics/springs";
import { LEVEL_WORD, countdownFor, disambiguator, nameSuffix, type Countdown } from "./model";

/** CLEAR LID section 3: CLEARLID_POINTER_SLEW = 340 px/s of scale traversed. */
export const POINTER_SLEW_PX_S = 340;
/** II.4.8 — the floor, so the smallest correction still registers. */
export const SLEW_FLOOR_MS = 80;

export type MotionMode = "css" | "integrator" | "raf";

export function slewMs(fromPx: number, toPx: number): number {
  return Math.max(SLEW_FLOOR_MS, (Math.abs(toPx - fromPx) / POINTER_SLEW_PX_S) * 1000);
}

/** Seat centre for a level on a five-seat scale of `widthPx`. */
export function levelPx(level: number, widthPx: number): number {
  return ((level + 0.5) / 5) * widthPx;
}

const STATUS_GLYPH: Record<Countdown["status"], string> = {
  expired: "✕ ",
  expiring: "△ ",
  "low-confidence": "",
  frozen: "❄ ",
  ok: "",
  empty: "",
};

export interface RegisterRowProps {
  ing: Ingredient;
  entry: InventoryEntry | undefined;
  index: number;
  /** Coarse clock — day-granularity countdowns must not ride a per-second tick. */
  nowMs: number;
  scalePx: number;
  lifePx: number;
  mode: MotionMode;
  /** Only supplied in the DEFEATED mitigation (per-row armed state). */
  armed?: boolean;
  onArm: (id: string, index: number, eventTs: number) => void;
  onAdjust: (id: string, level: InventoryLevel, eventTs: number) => void;
  registerEl: (id: string, el: HTMLButtonElement | null) => void;
}

/** Instrumentation: how many row BODIES actually executed. If `memo` is doing
 *  its job, a single level change costs one, not sixty-five. */
export const rowRenderCount = { n: 0 };

function RegisterRowBase({
  ing,
  entry,
  index,
  nowMs,
  scalePx,
  lifePx,
  mode,
  armed,
  onArm,
  onAdjust,
  registerEl,
}: RegisterRowProps) {
  rowRenderCount.n++;
  const level: InventoryLevel = entry?.level ?? 0;
  const countdown = countdownFor(ing, entry, new Date(nowMs));
  const suffix = `${nameSuffix(ing)}${disambiguator(ing)}`;

  const pointerRef = useRef<HTMLSpanElement | null>(null);
  const shownRef = useRef<number>(levelPx(level, scalePx));
  const springRef = useRef<Spring | null>(null);
  const rafRef = useRef<number | null>(null);

  const targetPx = levelPx(level, scalePx);

  useEffect(() => {
    const el = pointerRef.current;
    if (!el) return;
    const from = shownRef.current;

    if (mode === "css") {
      // The report is a compositor transition whose DURATION is derived from
      // the slew rate — a rate expressed in CSS, not a fixed tween.
      el.style.setProperty("--spk-pointer-ms", `${slewMs(from, targetPx).toFixed(0)}ms`);
      el.style.setProperty("--spk-pointer-x", `${targetPx.toFixed(2)}px`);
      shownRef.current = targetPx;
      return;
    }

    // Both script modes drive transform directly, so the CSS transition must be
    // out of the way — two motion systems on one property is a lie in waiting.
    el.style.setProperty("--spk-pointer-ms", "0ms");

    if (mode === "integrator") {
      if (!springRef.current) {
        springRef.current = createMassSpring("weighted", from);
        springRef.current.onFrame((x) => {
          shownRef.current = x;
          el.style.setProperty("--spk-pointer-x", `${x.toFixed(2)}px`);
        });
      }
      springRef.current.set(targetPx);
      return;
    }

    // mode === "raf": the naive translation, one loop per row.
    let last = performance.now();
    const step = (now: number): void => {
      const dt = (now - last) / 1000;
      last = now;
      const max = POINTER_SLEW_PX_S * dt;
      const delta = targetPx - shownRef.current;
      shownRef.current += Math.max(-max, Math.min(max, delta));
      el.style.setProperty("--spk-pointer-x", `${shownRef.current.toFixed(2)}px`);
      if (Math.abs(targetPx - shownRef.current) > 0.05) rafRef.current = requestAnimationFrame(step);
      else rafRef.current = null;
    };
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [targetPx, mode]);

  useEffect(
    () => () => {
      springRef.current?.stop();
      springRef.current = null;
    },
    []
  );

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    // Keyboard IS the detent: each press seats one well, and the ends are hard
    // stops rather than wraps (II.3.6 — a detented control has physical limits).
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      onAdjust(ing.id, Math.min(4, level + 1) as InventoryLevel, e.timeStamp);
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      onAdjust(ing.id, Math.max(0, level - 1) as InventoryLevel, e.timeStamp);
    } else if (e.key === "Home") {
      e.preventDefault();
      onAdjust(ing.id, 0, e.timeStamp);
    } else if (e.key === "End") {
      e.preventDefault();
      onAdjust(ing.id, 4, e.timeStamp);
    }
  }

  const lifeX = countdown.fraction === null ? null : countdown.fraction * lifePx;

  return (
    <li>
      <button
        type="button"
        ref={(el) => registerEl(ing.id, el)}
        className="spk-row cd-focusable"
        data-level={level}
        data-status={countdown.status}
        data-armed={armed || undefined}
        onFocus={(e) => onArm(ing.id, index, e.timeStamp)}
        onPointerDown={(e) => onArm(ing.id, index, e.timeStamp)}
        onKeyDown={handleKeyDown}
      >
        {/*
          WCAG 2.5.3, Label in Name. The first build put the whole reading in an
          `aria-label` and hid every visible span, which axe flags as
          label-content-name-mismatch: a voice-control user saying the words they
          can SEE ("Apples") would not reach a control whose name is a different
          string. The repair is to build the name from the visible text first and
          append the spoken elaboration in a visually-hidden span, so the
          accessible name STARTS with exactly what is printed on the plate.
        */}
        <span className="spk-row__name">
          {ing.name.short}
          <span className="spk-row__suffix">{suffix}</span>
        </span>
        <span className="spk-vh">
          {`, level ${LEVEL_WORD[level]}, ${
            countdown.status === "empty"
              ? "not stocked"
              : countdown.status === "frozen"
                ? "still frozen"
                : `use-by ${countdown.text}`
          }`}
        </span>

        {/* the mechanism: under the lid, in the milled channels */}
        <span className="spk-row__scale" aria-hidden="true">
          <span className="spk-row__pointer" ref={pointerRef} />
        </span>

        <span className="spk-row__life" aria-hidden="true">
          {lifeX !== null && (
            <span className="spk-row__marker" style={{ ["--spk-marker-x" as string]: `${lifeX.toFixed(2)}px` }} />
          )}
        </span>

        {/*
          The printed figures live OUTSIDE the lid, on the chassis, exactly as the
          source object prints its markings on the cream steel rather than under
          the hood. This is also a Floor requirement, measured: with the level
          word printed inside the channel it sat under the glance pane at 3.42:1.
          On the plate's own face it reads 6.46:1 and the pane never touches type.
        */}
        <span className="spk-row__figure" aria-hidden="true">
          {LEVEL_WORD[level]}
        </span>

        <span className="spk-row__countdown" aria-hidden="true">
          {STATUS_GLYPH[countdown.status]}
          {countdown.text}
        </span>
      </button>
    </li>
  );
}

export const RegisterRow = memo(RegisterRowBase);
