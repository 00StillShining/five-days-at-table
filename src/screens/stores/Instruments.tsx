/**
 * src/screens/stores/Instruments.tsx — the instruments that are not the plate.
 *
 * CORRECTIONARY 3.1: four to six simultaneous hero-grade instruments is the
 * NORMAL condition, not a budget breach. With the milled register plate that
 * makes SIX here, each with a job stateable in one sentence — the exit test
 * CD-BRIEF ruling 4's re-authored Refined rung sets:
 *
 *   REGISTER PLATE  the sixty-five levels and lives, read and set.   (RegisterPlate)
 *   THUMBWHEEL      the hand that seats a level.                     (this file)
 *   ANNUNCIATOR     what has expired, what expires within a day, and
 *                   the one act the arbiter ranks first.             (this file)
 *   LARDER GAUGE    how full the house is, how much of the register has
 *                   been counted, and how old that count is.         (this file)
 *   TUNING SCALE    what tonight can be cooked from what is in the
 *                   house.                                           (TuningScale)
 *   DINNER LEDGER   whether tonight's plate was logged, and what it
 *                   left behind.                                     (logDinner)
 *
 * Every one prints its EXACT FIGURE beside its instrument (CORRECTIONARY 5.3 —
 * "a number typeset on a background is not a readout"), and the larder gauge
 * prints its AGE and its class's declared THRESHOLD, because "every live
 * reading shows its exact figure and its age" is non-negotiable.
 */

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Enclosure, Escutcheon, Lamp, Plate, PressKey } from "../../cd/foundry";
import { quantise } from "../../cd/physics/detent";
import { ageOf } from "../../cd/freshness/classes";
import { texture } from "../../cd/material/textures";
import { cue } from "../../cd/sound/cues";
import type { InventoryLevel } from "../../state/types";
import { coveragePx, LEVEL_ANNOUNCE, LEVEL_GLYPH, LEVEL_WORD, WHEEL_TRACK, type Alert } from "./model";
import { STOCKTAKE_THRESHOLD } from "./RegisterRow";

/* ===========================================================================
   THE LAMP SCALE — CLEAR LID section 3's own signature readout
   ---------------------------------------------------------------------------
   "A printed frequency scale ... sits behind a strip of glass lit from one edge
   by the amber lamp ... A pointer travels the scale as a value changes, its
   needle unrolled from an arc into a straight line, the slew-rate law kept
   intact but re-expressed in pixels per second."
   =========================================================================== */

const SCALE_SLEW_PX_S = 340; // CLEAR LID section 3's CLEARLID_POINTER_SLEW
const SCALE_FLOOR_MS = 80; // II.4.8's floor

export interface LampScaleProps {
  /** 0..1. Real; nothing invented. */
  fraction: number;
  /** Nominal pixel width of the printed scale, used only until the element has
   *  been measured. See the note on the measurement effect below. */
  widthPx: number;
  /** Bumped by a real write. The lamp answers ACTIVITY, never a clock. */
  activity: number;
  label: string;
  /** Printed beside the scale. The exact figure the pointer is reading. */
  figure: string;
  /** Ten printed divisions, or five. The level scale and the fill scale are
   *  different quantities and must not borrow each other's calibration. */
  divisions?: 5 | 10;
}

function LampScaleBase({ fraction, widthPx, activity, label, figure, divisions = 10 }: LampScaleProps) {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const lampRef = useRef<HTMLSpanElement | null>(null);
  const pointerRef = useRef<HTMLSpanElement | null>(null);
  const shownRef = useRef(coveragePx(fraction, widthPx));
  const timerRef = useRef<number | null>(null);
  const firstRef = useRef(true);
  const [measured, setMeasured] = useState(widthPx);

  /*
    THE SCALE MEASURES ITSELF, AND IT HAS TO.

    DEFECT FOUND BY RENDERING: the larder gauge's scale is a full-width band, so
    a hard-coded 144px travel put a needle reading 51% at 12% of its own printed
    scale — a gauge lying about its own value, which is the truth pass's first
    failure and not a craft note. The printed divisions are drawn in percentages
    and therefore always fit the element; the travel must be measured off the
    same element or the two describe different scales.
  */
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const read = () => setMeasured(el.getBoundingClientRect().width || widthPx);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [widthPx]);

  const lastFractionRef = useRef(fraction);
  useEffect(() => {
    const el = pointerRef.current;
    if (!el) return;
    // The same 2px inset the printed scale carries, so the needle's zero and
    // the print's zero are the same place at both ends of the travel.
    const to = coveragePx(fraction, measured);
    // A sweep reports a VALUE change; a re-measure is geometry and lands in one
    // frame. See model.ts's `sweepMs` for the defect this exists to prevent.
    const changed = lastFractionRef.current !== fraction;
    lastFractionRef.current = fraction;
    const ms = changed
      ? Math.max(SCALE_FLOOR_MS, (Math.abs(to - shownRef.current) / SCALE_SLEW_PX_S) * 1000)
      : 0;
    el.style.setProperty("--str-scale-ms", `${ms.toFixed(0)}ms`);
    el.style.setProperty("--str-scale-x", `${to.toFixed(2)}px`);
    shownRef.current = to;
  }, [fraction, measured]);

  /*
    II.2.18 — the lume law, which CLEAR LID section 3 makes this scale's own
    Signature escalation: "an event charges it in 120ms; it decays over 6000ms
    to a standing 34% floor; a re-charge resets the clock ... a station left
    untouched dims to a held ember rather than staying lit like a screen that
    never sleeps."
  */
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return; // nothing charges on mount — the lamp answers a hand, not a load
    }
    const el = lampRef.current;
    if (!el) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    el.style.setProperty("--str-lamp-ms", "120ms");
    el.style.setProperty("--str-lamp-charge", "1");
    timerRef.current = window.setTimeout(() => {
      el.style.setProperty("--str-lamp-ms", "6000ms");
      el.style.setProperty("--str-lamp-charge", "0.34");
    }, 120);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [activity]);

  return (
    <span className="str-lampscale" ref={rootRef} data-divisions={divisions} role="img" aria-label={label}>
      <span className="str-lampscale__lamp" ref={lampRef} />
      <span className="str-lampscale__print" />
      <span className="str-lampscale__pointer" ref={pointerRef} />
      <span className="str-lampscale__figure cd-data" aria-hidden="true">
        {figure}
      </span>
    </span>
  );
}

export const LampScale = memo(LampScaleBase);

/* ===========================================================================
   THE ANNUNCIATOR — the arbiter's one act-now line, plus the two alert lamps
   =========================================================================== */

/** How many alert slips the strip prints before II.6.24's confession takes over. */
export const ALERT_LIMIT = 6;

export interface AnnunciatorProps {
  /** The arbiter's rank-1 duty text, or null when nothing is ranked. */
  duty: string | null;
  queued: number;
  actionLabel: string | null;
  onActivate: (() => void) | null;
  expired: number;
  expiring: number;
  /** Every expired then expiring row, NAMED — the act, not just the count. */
  alerts: Alert[];
  /** Open that row's lid, address it, and bring it under the cut. */
  onAddress: (ingId: string) => void;
  trophy: boolean;
}

function AnnunciatorBase({
  duty,
  queued,
  actionLabel,
  onActivate,
  expired,
  expiring,
  alerts,
  onAddress,
  trophy,
}: AnnunciatorProps) {
  /*
    II.4.14 — a warning outruns smoothing: the annunciator reads the RAW count
    and fires in the frame it crosses. There is no smoothing on this path at
    all, and the cue fires ONCE per crossing rather than once per render.
  */
  const firedRef = useRef(false);
  useEffect(() => {
    if (expired > 0 && !firedRef.current) {
      firedRef.current = true;
      // II.5.15 — Trophy Mode returns to silence entirely, "re-admitting only
      // the warning voice at distance". Stated through the bus's own gate
      // rather than left true by accident because no control is reachable up
      // there: the gate is what a reviewer measures, so it has to be told.
      cue("warning", trophy ? { mode: "trophy", trophyAudio: "warnings" } : {});
    } else if (expired === 0) {
      firedRef.current = false;
    }
  }, [expired, trophy]);

  return (
    <Enclosure variant="hero" as="section" className="str-annun" aria-label="larder annunciator">
      <Escutcheon as="h2" className="str-annun__name">
        larder
      </Escutcheon>

      <div className="str-annun__bank">
        <span className="str-annun__cell" data-role="danger" data-on={expired > 0 ? "true" : "false"}>
          <Lamp
            lit={expired > 0}
            word={{ on: "EXPIRED", off: "EXPIRED" }}
            label="expired stock"
            hue="var(--cd-role-danger)"
            showWord={false}
          />
          <span className="str-annun__figure cd-data">{expired}</span>
          <span className="str-annun__label cd-engraved">expired</span>
        </span>

        <span className="str-annun__cell" data-role="warning" data-on={expiring > 0 ? "true" : "false"}>
          <Lamp
            lit={expiring > 0}
            word={{ on: "EXPIRING", off: "EXPIRING" }}
            label="stock expiring within a day"
            hue="var(--cd-role-warning)"
            showWord={false}
          />
          <span className="str-annun__figure cd-data">{expiring}</span>
          <span className="str-annun__label cd-engraved">expiring</span>
        </span>
      </div>

      {/*
        The act-now slot (PLAN section 6.0's project signature): exactly one
        duty leads, the rest are counted. Printed on an ink plate, never raw
        over the plate's grain (CD-BRIEF ruling 5).
      */}
      <Plate className="str-annun__slot" surface="data">
        <span className="str-annun__duty">
          {duty ?? "nothing ranked — the larder is current"}
        </span>
        <span className="str-annun__queue cd-data" aria-label={`${queued} duties behind`}>
          {queued}
          <span className="cd-unit">behind</span>
        </span>
      </Plate>

      {onActivate && actionLabel && !trophy ? (
        <PressKey className="str-annun__act" onPress={onActivate} cap={actionLabel} sound="contact" />
      ) : (
        /* The slot is RESERVED whether or not an act is offered, so the row
           never reflows under a hand reaching for it. */
        <span className="str-annun__act str-annun__act--empty" aria-hidden="true" />
      )}

      {/*
        THE SLIP RAIL. A count says something is wrong; this says WHAT, with its
        exact countdown, and puts one press between the reading and the row that
        produced it. Every slip is a real 44px control that opens that row's own
        lid and addresses it. II.6.24: the clip confesses its remainder.
      */}
      <div className="str-annun__rail" role="group" aria-label="expired and expiring stock">
        {alerts.length === 0 ? (
          <span className="str-annun__clear cd-silkscreen">
            nothing expired, nothing expiring inside a day
          </span>
        ) : (
          <>
            {alerts.slice(0, ALERT_LIMIT).map((a) => (
              <PressKey
                key={a.ingId}
                className="str-annun__slip"
                data-status={a.status}
                onPress={() => onAddress(a.ingId)}
                sound="contact"
                aria-label={`${a.name}, ${a.status}, ${a.text} — address this row`}
              >
                {/*
                  THE HUE LIVES IN A LAMP, NOT IN THE TYPE.
                  MEASURED: a slip sits on this world's grey control plate, whose
                  darkest stop is #A5A59C, and the danger and warning inks read
                  3.63:1 and 3.91:1 there — under the 4.5:1 text floor. Darkening
                  them far enough to pass takes them to L≈0.04, where the hue is
                  gone anyway. So CD-BRIEF repair 2's own remedy applies:
                  role-coloured TEXT renders only on cream faces, and elsewhere
                  the role is carried by an instrument. A lamp is judged against
                  its OWN well (II.2.17, II.3.24), which is the one place in this
                  world colour is legal on a control plate — and the glyph, the
                  word and the expired-first order carry it three more times.
                */}
                <Lamp
                  lit
                  word={{ on: a.status === "expired" ? "EXPIRED" : "EXPIRING", off: "" }}
                  label={a.status === "expired" ? "expired" : "expiring"}
                  hue={a.status === "expired" ? "var(--cd-role-danger)" : "var(--cd-role-warning)"}
                  size="0.625rem"
                  showWord={false}
                />
                <span className="str-annun__slip-glyph" aria-hidden="true">
                  {a.status === "expired" ? "✕" : "△"}
                </span>
                <span className="str-annun__slip-name" aria-hidden="true">
                  {a.name}
                </span>
                <span className="str-annun__slip-fig cd-data" aria-hidden="true">
                  {a.text}
                </span>
              </PressKey>
            ))}
            {alerts.length > ALERT_LIMIT && (
              <span className="str-annun__more cd-overflow-count">
                {alerts.length - ALERT_LIMIT}
                <span className="cd-unit">more</span>
              </span>
            )}
          </>
        )}
      </div>
    </Enclosure>
  );
}

export const Annunciator = memo(AnnunciatorBase);

/* ===========================================================================
   THE LARDER GAUGE — fill, count, age, and the class's own threshold
   ---------------------------------------------------------------------------
   THE PER-SECOND CLOCK LIVES HERE AND NOWHERE ABOVE IT.

   The measured performance law's rule 4: "Isolate clocks. A 1Hz age clock
   mounted above a 65-row list re-renders 65 rows per second forever. Put it
   inside the one component that reads it." This is that component. Everything
   else on the screen rides the scene's 60s clock, because every other reading
   here is day-granular.
   =========================================================================== */

export interface LarderGaugeProps {
  fraction: number;
  counted: number;
  total: number;
  low: number;
  frozen: number;
  lastStocktake: string | null;
  activity: number;
  /** The recovery action, at a FIXED position whether or not it is offered. */
  onCount: () => void;
  trophy: boolean;
}

function LarderGaugeBase({
  fraction,
  counted,
  total,
  low,
  frozen,
  lastStocktake,
  activity,
  onCount,
  trophy,
}: LarderGaugeProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const age = ageOf("stocktake", lastStocktake, now);
  const pct = Math.round(fraction * 100);

  return (
    <Enclosure variant="hero" as="section" className="str-gauge" aria-label="larder gauge">
      <Escutcheon as="h2" className="str-gauge__name">
        stocktake
      </Escutcheon>

      <LampScale
        fraction={fraction}
        widthPx={LARDER_SCALE_PX}
        activity={activity}
        label={`larder ${pct} percent full, mean level across ${counted} counted rows`}
        figure={`${pct}%`}
      />

      <Plate className="str-gauge__face" surface="data">
        {/*
          THE DENOMINATOR IS LOAD-BEARING, so it is never decoration and never
          inherits a dim. `/65` sits INSIDE this span, so the stale alpha this
          element used to carry (`opacity: STALE_INK_ALPHA`) fell on it too and
          printed the register's own size at 2.29:1 — measured on real pixels,
          awake, in the never-counted state. The numerator failed with it: "0"
          at 28px measured 2.96:1 against large text's own 3:1.
          The drop is an INK now (stores.css section 9), and the hierarchy
          between "65" and "/65" is carried by SIZE — 1.75rem against 0.875rem —
          which is where it always belonged.
        */}
        <span className="str-gauge__value cd-data" data-stale={age.stale ? "true" : "false"}>
          {counted}
          <span className="str-gauge__of">/{total}</span>
        </span>
        <span className="str-gauge__meta">
          <span className="str-gauge__age cd-printed">
            counted {age.ms == null ? "never" : `${age.label} ago`}
          </span>
          {/* The class's own declared threshold, printed on its own label. */}
          <span className="str-gauge__threshold cd-silkscreen">stale after {STOCKTAKE_THRESHOLD}</span>
        </span>
        {/* The state word. Printed, never a colour alone (II.7.7). Reserved so
            the plate keeps its height when a reading crosses the threshold. */}
        <span className="str-gauge__word cd-silkscreen" aria-hidden={age.stale ? undefined : true}>
          {age.stale ? age.word : ""}
        </span>
      </Plate>

      <div className="str-gauge__foot">
        <Plate className="str-gauge__fig" surface="data">
          <span className="cd-data">{low}</span>
          <span className="cd-silkscreen">at or below ¼</span>
        </Plate>
        <Plate className="str-gauge__fig" surface="data">
          <span className="cd-data">{frozen}</span>
          <span className="cd-silkscreen">frozen</span>
        </Plate>
        {/* The recovery action, at a FIXED position: the slot exists either
            way, so the control never moves under a hand reaching for it. */}
        <span className="str-gauge__recover">
          {age.stale && !trophy ? (
            <PressKey onPress={onCount} cap="count" sound="contact" />
          ) : (
            <span className="str-gauge__recover--empty" aria-hidden="true" />
          )}
        </span>
      </div>
    </Enclosure>
  );
}

export const LarderGauge = memo(LarderGaugeBase);

/** Committed: 9rem of printed scale at the 16px root the tokens assume. */
export const LARDER_SCALE_PX = 144;
/** Committed: 7rem on a group lid. */
export const LID_SCALE_PX = 112;

/* ===========================================================================
   THE THUMBWHEEL — the fenestrated knob (CLEAR LID section 3)
   ---------------------------------------------------------------------------
   "The speed selector's cap carries a window no wider than the digit it shows —
   sharp only when the knob rests on a detent, blurred whenever the hand is
   mid-turn, so the eye is never asked to overread a number the hand has not
   finished choosing."

   DECLARED DELTA: the chapter re-cuts the Foundry's thirteen seats at 22.5 deg
   (II.3.6) to THREE at 30 deg for its speed selector. The inventory level is
   five-valued, so this is FIVE seats at the chapter's own 30 deg pitch over
   120 deg of sweep. Pitch, hysteresis (12%) and seat time (110ms) unchanged.
   =========================================================================== */

export interface ThumbWheelProps {
  armedName: string | null;
  level: InventoryLevel | null;
  /**
   * `advance` distinguishes an ABSOLUTE detent pick (a named seat chosen
   * outright — auto-advance to the next row, PLAN section 6.7's own
   * "auto-advance to next row on set") from RELATIVE travel (the knob's own
   * drag and its arrow-key equivalent — stay put).
   *
   * Advancing on BOTH reproduces a bug this product has already fixed once:
   * with auto-advance on relative travel a keyboard user is bounced to the next
   * row after the FIRST nudge and can never walk one row through 0..4 at all.
   */
  onSet: (level: InventoryLevel, eventTs: number, advance: boolean) => void;
  announce: string;
  /** The addressed row's own stocktake age, printed on the pod. */
  ageLabel: string;
  trophy: boolean;
}

export function ThumbWheel({ armedName, level, onSet, announce, ageLabel, trophy }: ThumbWheelProps) {
  const knobRef = useRef<HTMLButtonElement | null>(null);
  const gripRef = useRef<HTMLSpanElement | null>(null);
  const windowRef = useRef<HTMLSpanElement | null>(null);
  const dragRef = useRef<{ startSeat: number; unwrapped: number; lastAngle: number; lastTime: number } | null>(null);
  const seatRef = useRef<number>(level ?? 0);

  /*
    MITIGATION 2 (measured performance law, rule 3): ONE cached canvas texture
    per FAMILY, never per instance. 65 requests on one key cost 4.0ms and one
    paint; on 65 keys, 341.0ms and 64 paints — the cache saves 98.8%. This is
    the only canvas tile on the whole screen; everything else is a gradient.
  */
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const knurl = texture({ pattern: "knurl", scale: 96, dpr, strength: 0.9 });

  useEffect(() => {
    seatRef.current = level ?? 0;
    gripRef.current?.style.setProperty("--str-knob-deg", `${(level ?? 0) * WHEEL_TRACK.pitch}deg`);
  }, [level]);

  const pointerAngle = useCallback((e: { clientX: number; clientY: number }): number => {
    const el = knobRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  }, []);

  function commit(next: number, eventTs: number): void {
    if (next === seatRef.current) return;
    seatRef.current = next;
    // II.4.1 — the semantic layer commits in the same frame the command
    // arrives. `onSet` mutates the model; everything below this line is report.
    onSet(next as InventoryLevel, eventTs, false);
    cue("detent", { x: 0.5 });
    gripRef.current?.style.setProperty("--str-knob-deg", `${next * WHEEL_TRACK.pitch}deg`);
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
    // Shortest arc: the delta stays continuous past the atan2 +/-180 deg seam
    // rather than teleporting (CLEAR LID section 3's own unwrap, II.1.6).
    const delta = ((angle - drag.lastAngle + 540) % 360) - 180;
    drag.unwrapped += delta;
    drag.lastAngle = angle;
    drag.lastTime = now;

    // The window blurs off REAL angular velocity and sharpens only at the seat.
    const velocity = Math.abs(delta) / dt;
    windowRef.current?.style.setProperty("--str-window-blur", `${Math.min(3, velocity / 40).toFixed(2)}px`);

    const travel = (drag.startSeat + drag.unwrapped / WHEEL_TRACK.pitch) * WHEEL_TRACK.pitch;
    commit(quantise(WHEEL_TRACK, travel, seatRef.current), e.timeStamp);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current) return;
    knobRef.current?.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    windowRef.current?.style.setProperty("--str-window-blur", "0px");
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
    <Enclosure variant="hero" as="section" className="str-pod" data-str-hidden={trophy ? "true" : undefined}>
      <Escutcheon as="h2" className="str-pod__name">
        count in
      </Escutcheon>

      <button
        type="button"
        ref={knobRef}
        className="str-knob cd-focusable"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={level ?? 0}
        aria-valuetext={LEVEL_ANNOUNCE[level ?? 0]}
        aria-label={armedName ? `level for ${armedName}` : "level — no row addressed"}
        aria-disabled={disabled || undefined}
        data-disabled={disabled ? "true" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <span
          className="str-knob__grip"
          ref={gripRef}
          style={{ ["--str-knurl" as string]: knurl ? `url("${knurl}")` : "none" }}
        />
        <span className="str-knob__light" />
        <span className="str-knob__window cd-data" ref={windowRef} aria-hidden="true">
          {LEVEL_GLYPH[level ?? 0]}
        </span>
      </button>

      {/* The addressed row's own name and age ride the pod's HEAD, beside the
          escutcheon, rather than above the detents: the detent stack is the
          hand's target and every row it does not need is 44px of reach. */}
      <Plate className="str-pod__addressed" surface="data">
        <span className="str-pod__row-name">{armedName ?? "no row addressed"}</span>
        <span className="str-pod__row-age cd-printed">{ageLabel}</span>
      </Plate>

      <div className="str-pod__stack">
        <div
          className="str-detents"
          role="radiogroup"
          aria-label={armedName ? `set level for ${armedName}` : "set level"}
        >
          {[4, 3, 2, 1, 0].map((seat) => (
            <label key={seat} className="str-detent" data-seated={level === seat ? "true" : "false"}>
              <input
                type="radio"
                name="str-detent"
                value={seat}
                checked={level === seat}
                disabled={disabled}
                onChange={(e) => {
                  seatRef.current = seat;
                  // An ABSOLUTE pick: this one advances to the next row.
                  onSet(seat as InventoryLevel, e.timeStamp, true);
                  cue("detent", { x: 0.5 });
                }}
              />
              <span className="str-detent__win" aria-hidden="true" />
              <span className="str-detent__word" aria-hidden="true">
                {LEVEL_WORD[seat]}
              </span>
              <span className="str-vh">{LEVEL_ANNOUNCE[seat]}</span>
            </label>
          ))}
        </div>
      </div>

      <p className="str-vh" role="status" aria-live="polite">
        {announce}
      </p>
    </Enclosure>
  );
}

/* ===========================================================================
   THE BAY CUT — II.6.24's confession, measured rather than asserted
   ---------------------------------------------------------------------------
   "Every clip states its remainder as a NUMBER. No fade curtains." The register
   bay is a fixed-height machined recess and the plate slides inside it, so at
   any moment some of the open group's rows are above the cut and some below.
   Both are printed live, alongside the count under the shut lids.

   THIS COMPONENT ONLY PRINTS. The measuring lives in the scene, inside the same
   layout effect that RESOLVES the scrolling element. A child reading a parent's
   ref works, but it is an effect-ordering bet nothing in the type system keeps
   honest, and the element, its listener, its observer and its pitch are one
   fact — so one place owns all four.

   A NOTE ON HOW THIS WAS VERIFIED, because it nearly produced a false finding.
   The first measurement of this was taken in a BACKGROUNDED tab, where
   `requestAnimationFrame` does not run at all: the confession sat frozen and
   looked like a listener that had never attached. It had attached. Fronted, at
   390px over the fridge group's 21 rows in a 384px bay, it reads 0/16 at the
   top, 15/0 at the foot and 3/13 at 192px — which is the register, counted.
   =========================================================================== */

export interface BayCutProps {
  /** Rows scrolled past the top of the bay. */
  above: number;
  /** Rows still below the cut. */
  below: number;
  /** Rows in every CLOSED group — R7's own "confess the overflow". */
  underLids: number;
  children?: ReactNode;
}

export function BayCut({ above, below, underLids, children }: BayCutProps) {
  return (
    <div className="str-cut">
      <Plate className="str-cut__plate" surface="data">
        <span className="str-cut__fig cd-data">
          {above}
          <span className="cd-unit">above</span>
        </span>
        <span className="str-cut__fig cd-data">
          {below}
          <span className="cd-unit">below the cut</span>
        </span>
        <span className="str-cut__fig cd-data">
          {underLids}
          <span className="cd-unit">under shut lids</span>
        </span>
      </Plate>
      {children}
    </div>
  );
}
