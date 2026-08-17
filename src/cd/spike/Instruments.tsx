/**
 * src/cd/spike/Instruments.tsx — the four hero instruments that are not the plate.
 *
 * CORRECTIONARY 3.1: four to six simultaneous hero-grade instruments is the
 * NORMAL condition, not a budget breach. With the milled plate itself that
 * makes five here, each with a job stateable in one sentence (CD-BRIEF ruling 4's
 * re-authored Refined rung):
 *
 *   PLATE        the sixty-five levels, read and set.
 *   LAMP SCALE   how full this location is, as one travelling pointer.
 *   THUMBWHEEL   the hand that sets a level.
 *   ANNUNCIATOR  what has expired, and what is about to.
 *   COUNT PLATE  how much of this location has actually been counted, and when.
 *
 * Every one of them prints its exact figure beside its instrument (CORRECTIONARY
 * 5.3), and the count plate prints its AGE and declares itself stale, because
 * "every live reading shows its exact figure and its age" is non-negotiable.
 */

import { memo, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { quantise, type DetentTrack } from "../physics/detent";
import { ageOf } from "../freshness/classes";
import { cue } from "../sound/cues";
import { LEVEL_ANNOUNCE, LEVEL_GLYPH, LEVEL_WORD } from "./model";
import { tex } from "./textureProbe";
import type { InventoryLevel } from "../../state/types";

/* ===========================================================================
   THE LAMP SCALE — CLEAR LID section 3
   =========================================================================== */

const SCALE_SLEW_PX_S = 340;

export interface LampScaleProps {
  /** 0..1, the mean level over COUNTED rows. Real; nothing invented. */
  fraction: number;
  counted: number;
  stocked: number;
  total: number;
  /** Bumped by a real stocktake write. The lamp answers activity, never a clock. */
  activity: number;
  widthPx: number;
}

function LampScaleBase({ fraction, counted, stocked, total, activity, widthPx }: LampScaleProps) {
  const lampRef = useRef<HTMLSpanElement | null>(null);
  const pointerRef = useRef<HTMLSpanElement | null>(null);
  const shownRef = useRef(fraction * widthPx);
  const timerRef = useRef<number | null>(null);
  const firstRef = useRef(true);

  useEffect(() => {
    const el = pointerRef.current;
    if (!el) return;
    const to = fraction * widthPx;
    const ms = Math.max(80, (Math.abs(to - shownRef.current) / SCALE_SLEW_PX_S) * 1000);
    el.style.setProperty("--spk-scale-ms", `${ms.toFixed(0)}ms`);
    el.style.setProperty("--spk-scale-x", `${to.toFixed(2)}px`);
    shownRef.current = to;
  }, [fraction, widthPx]);

  // II.2.18 — lume: an event charges it in 120ms; it decays over 6000ms to a
  // standing 34% floor; a re-charge resets the clock. "A station left untouched
  // dims to a held ember rather than staying lit like a screen that never sleeps."
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return; // silence until the user's first real gesture — nothing charges on mount
    }
    const el = lampRef.current;
    if (!el) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    el.style.setProperty("--spk-lamp-ms", "120ms");
    el.style.setProperty("--spk-lamp-charge", "1");
    timerRef.current = window.setTimeout(() => {
      el.style.setProperty("--spk-lamp-ms", "6000ms");
      el.style.setProperty("--spk-lamp-charge", "0.34");
    }, 120);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [activity]);

  return (
    /* TRUTH: the printed figure is the SAME quantity the pointer reads — the
       mean level over counted rows. The first build printed `stocked/total`
       beside a pointer showing mean fill: two different numbers wearing one
       instrument, which is the exact defect II.4.13 ("one clock, one truth")
       exists to forbid. The stocked and counted figures still print, in the
       lid's own count text, where they are their own readings. */
    <span
      className="spk-lampscale"
      role="img"
      aria-label={`${Math.round(fraction * 100)} percent full, ${stocked} of ${total} rows stocked, ${counted} counted`}
    >
      <span className="spk-lampscale__lamp" ref={lampRef} />
      <span className="spk-lampscale__print" />
      <span className="spk-lampscale__pointer" ref={pointerRef} />
      <span className="spk-lampscale__figure" aria-hidden="true">
        {Math.round(fraction * 100)}%
      </span>
    </span>
  );
}

export const LampScale = memo(LampScaleBase);

/* ===========================================================================
   THE THUMBWHEEL — the fenestrated knob, CLEAR LID section 3
   =========================================================================== */

/** Declared delta: FIVE seats at the chapter's own 30 degree pitch (its speed
 *  knob adapts the Foundry's thirteen to three; the inventory level is
 *  five-valued). Hysteresis 12% and the 110ms seat are the chapter's, unchanged. */
export const WHEEL_TRACK: DetentTrack = { seats: 5, pitch: 30, band: 0.12 };
export const WHEEL_SEAT_MS = 110;

export interface ThumbWheelProps {
  armedName: string | null;
  level: InventoryLevel | null;
  /**
   * `advance` distinguishes an ABSOLUTE detent pick (a named seat chosen
   * outright — auto-advance to the next row, which is PLAN section 6.7's own
   * "auto-advance to next row on set") from RELATIVE travel (the knob's own
   * drag, and its arrow-key equivalent — stay put).
   *
   * The first build advanced on both, which silently reproduced a bug this
   * product has already fixed once: with auto-advance on relative travel, a
   * keyboard user gets bounced to the next row after the FIRST nudge and can
   * never walk a row through 0..4 at all. Measured on the real register: knob
   * focused on Apples at level 3, one ArrowDown, and focus was on Carrots.
   */
  onSet: (level: InventoryLevel, eventTs: number, advance: boolean) => void;
  announce: string;
}

export function ThumbWheel({ armedName, level, onSet, announce }: ThumbWheelProps) {
  const knobRef = useRef<HTMLButtonElement | null>(null);
  const gripRef = useRef<HTMLDivElement | null>(null);
  const windowRef = useRef<HTMLSpanElement | null>(null);
  const dragRef = useRef<{ startSeat: number; unwrapped: number; lastAngle: number; lastTime: number } | null>(null);
  const seatRef = useRef<number>(level ?? 0);

  // MITIGATION 2 — one cached canvas texture per FAMILY. The knurl tile is
  // painted once for the whole product and keyed {pattern, scale, dpr,
  // strength}; a second knob at the same size is a cache hit, never a paint.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const knurl = tex({ pattern: "knurl", scale: 88, dpr });

  useEffect(() => {
    seatRef.current = level ?? 0;
    gripRef.current?.style.setProperty("--spk-knob-deg", `${(level ?? 0) * WHEEL_TRACK.pitch}deg`);
  }, [level]);

  function pointerAngle(e: { clientX: number; clientY: number }): number {
    const el = knobRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  }

  function commit(next: number, eventTs: number): void {
    if (next === seatRef.current) return;
    seatRef.current = next;
    // II.4.1 — the semantic layer commits in the same frame the command
    // arrives. onSet mutates the model; everything after this line is report.
    // Relative travel: no advance.
    onSet(next as InventoryLevel, eventTs, false);
    cue("detent", { x: 0.5 });
    gripRef.current?.style.setProperty("--spk-knob-deg", `${next * WHEEL_TRACK.pitch}deg`);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (level === null) return;
    knobRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = {
      startSeat: seatRef.current,
      unwrapped: 0,
      lastAngle: pointerAngle(e),
      lastTime: performance.now(),
    };
    cue("contact", { x: 0.5 });
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || level === null) return;
    const angle = pointerAngle(e);
    const now = performance.now();
    const dt = Math.max(1, now - drag.lastTime) / 1000;
    // Shortest arc: the delta stays continuous past the atan2 seam rather than
    // teleporting (CLEAR LID section 3's own unwrap).
    const delta = ((angle - drag.lastAngle + 540) % 360) - 180;
    drag.unwrapped += delta;
    drag.lastAngle = angle;
    drag.lastTime = now;

    // The window blurs off real angular velocity and sharpens only at the seat.
    const velocity = Math.abs(delta) / dt;
    windowRef.current?.style.setProperty("--spk-window-blur", `${Math.min(3, velocity / 40).toFixed(2)}px`);

    const travel = (drag.startSeat + drag.unwrapped / WHEEL_TRACK.pitch) * WHEEL_TRACK.pitch;
    commit(quantise(WHEEL_TRACK, travel, seatRef.current), e.timeStamp);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current) return;
    knobRef.current?.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    windowRef.current?.style.setProperty("--spk-window-blur", "0px");
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (level === null) return;
    // KEYBOARD IS THE DETENT: one press, one seat, hard stops at the ends.
    let next: number | null = null;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") next = Math.min(4, seatRef.current + 1);
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") next = Math.max(0, seatRef.current - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 4;
    if (next === null) return;
    e.preventDefault();
    commit(next, e.timeStamp);
  }

  const disabled = armedName === null || level === null;

  return (
    <div className="spk-pod">
      <button
        type="button"
        ref={knobRef}
        className="spk-knob cd-focusable"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={level ?? 0}
        aria-valuetext={LEVEL_ANNOUNCE[level ?? 0]}
        aria-label={armedName ? `level for ${armedName}` : "level — no row addressed"}
        aria-disabled={disabled || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        style={{ opacity: disabled ? 0.55 : 1 }}
      >
        <div className="spk-knob__grip" ref={gripRef} style={{ ["--spk-knurl" as string]: knurl ? `url("${knurl}")` : "none" }} />
        <div className="spk-knob__light" />
        <span className="spk-knob__window" ref={windowRef} aria-hidden="true">
          {LEVEL_GLYPH[level ?? 0]}
        </span>
      </button>

      <div>
        <div className="spk-detents" role="radiogroup" aria-label={armedName ? `set level for ${armedName}` : "set level"}>
          {[4, 3, 2, 1, 0].map((seat) => (
            <label key={seat} className="spk-detent" data-seated={level === seat}>
              <input
                type="radio"
                name="spk-detent"
                value={seat}
                checked={level === seat}
                disabled={disabled}
                onChange={(e) => {
                  seatRef.current = seat;
                  // Absolute pick: this one advances.
                  onSet(seat as InventoryLevel, e.timeStamp, true);
                  cue("detent", { x: 0.5 });
                }}
              />
              <span className="spk-detent__win" aria-hidden="true" />
              <span aria-hidden="true">{LEVEL_WORD[seat]}</span>
              <span className="spk-vh">{LEVEL_ANNOUNCE[seat]}</span>
            </label>
          ))}
        </div>
        <p className="spk-vh" role="status" aria-live="polite">
          {announce}
        </p>
      </div>
    </div>
  );
}

/* ===========================================================================
   THE ANNUNCIATOR — expiry, as lamps in wells plus printed figures
   =========================================================================== */

export interface AnnunciatorProps {
  expired: number;
  expiring: number;
  frozen: number;
}

function AnnunciatorBase({ expired, expiring, frozen }: AnnunciatorProps) {
  // II.4.14 — warnings outrun smoothing: the annunciator reads the RAW count and
  // fires in the frame it crosses. There is no smoothing on this path at all.
  const firedRef = useRef(false);
  useEffect(() => {
    if (expired > 0 && !firedRef.current) {
      firedRef.current = true;
      cue("warning");
    } else if (expired === 0) {
      firedRef.current = false;
    }
  }, [expired]);

  return (
    <div className="spk-annun" role="group" aria-label="expiry annunciator">
      <span className="spk-annun__cell">
        <span className="spk-lamp" data-on={expired > 0} data-role="danger" aria-hidden="true" />
        <span>
          <span className="spk-annun__figure">{expired}</span>{" "}
          <span className="spk-annun__label">expired</span>
        </span>
      </span>
      <span className="spk-annun__cell">
        <span className="spk-lamp" data-on={expiring > 0} data-role="warning" aria-hidden="true" />
        <span>
          <span className="spk-annun__figure">{expiring}</span>{" "}
          <span className="spk-annun__label">expiring</span>
        </span>
      </span>
      <span className="spk-annun__cell">
        <span className="spk-lamp" data-on={false} data-role="frozen" aria-hidden="true" />
        <span>
          <span className="spk-annun__figure">{frozen}</span>{" "}
          <span className="spk-annun__label">frozen</span>
        </span>
      </span>
    </div>
  );
}

export const Annunciator = memo(AnnunciatorBase);

/* ===========================================================================
   THE COUNT PLATE — the exact figure AND its age, and it goes stale honestly
   =========================================================================== */

export interface CountPlateProps {
  counted: number;
  total: number;
  lastStocktake: string | null;
}

/**
 * The per-second clock lives HERE and nowhere above it.
 *
 * This is a structural finding the spike is built to make: an age that prints
 * seconds needs a 1Hz tick, and a 1Hz tick mounted above a sixty-five-row list
 * re-renders sixty-five rows every second forever. Isolating the clock inside
 * the one component that reads it costs one tiny re-render per second instead.
 */
function CountPlateBase({ counted, total, lastStocktake }: CountPlateProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const age = ageOf("stocktake", lastStocktake, now);

  return (
    <div className="spk-countplate" data-stale={age.stale}>
      <span className="spk-countplate__value">
        {counted}/{total}
      </span>
      <span className="spk-countplate__age">
        counted · {age.label} ago
        {age.word ? " " : ""}
        {age.word ? <span className="spk-countplate__stale">{age.word}</span> : null}
      </span>
    </div>
  );
}

export const CountPlate = memo(CountPlateBase);
