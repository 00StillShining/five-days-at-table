/**
 * src/screens/today/ChannelCluster.tsx — THE SIGNATURE.
 *
 * ch.05 section 7, Signature rung: "the hero gauge's own porthole disc is
 * geared 1:1 to the same rocker arm that clicks the mode knob two panels away,
 * so turning the knob makes the hero gauge's mechanism visibly answer BEFORE
 * the needle finishes its sweep — adjustment and display sharing one linkage
 * rather than pretending to be two systems in agreement."
 *
 * Built exactly that way and nothing else: one commit angle, written once, read
 * independently by the cap, the rocker arm and the hero porthole's geared disc.
 * The porthole seats in 150ms (110ms snap + the rocker's own 40ms beat); the
 * needle takes up to 375ms to cross the arc at the project's 720 deg/s. The
 * mechanism therefore answers first, every time, by arithmetic rather than by
 * an animation ordered to look that way.
 *
 * ---------------------------------------------------------------------------
 * THE TWO GUARD-RAILS ch.05 NAMES, AND WHERE EACH ONE IS SPENT
 * ---------------------------------------------------------------------------
 * 1. THE UNTRANSFORMED CARRIER, here. Cap and rocker are SIBLINGS on a carrier
 *    that carries no transform of its own, each reading --cd-assembly-angle
 *    independently, so a mid-throw reversal cannot compound 22.5 into 45
 *    degrees. src/cd/physics/rotation.ts asserts the carrier in DEV.
 * 2. CUMULATIVE TURN IN `dataset`, in Chronometer.tsx. Nothing here turns past
 *    +/-34 degrees, so nothing here can hit the +/-180 matrix wrap. The
 *    escapement can, and does, which is why the guard-rail lives where the
 *    revolutions are rather than where the doctrine happens to mention it.
 *
 * ---------------------------------------------------------------------------
 * THE 16ms ACK IS STRUCTURAL, NOT HOPEFUL (CD-BRIEF, measured performance law)
 * ---------------------------------------------------------------------------
 * "A React `dispatch` alone does NOT satisfy the Floor's 16ms acknowledgement,
 * because the reducer runs during the NEXT render." So every input handler here
 * writes the commit angle and retargets the needle against the DOM in the same
 * task as the event, and `setChannel` is only the request to re-render. The
 * effect that reconciles afterwards is idempotent and finds nothing to do.
 */

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { Enclosure, Escutcheon, Plate } from "../../cd/foundry";
import { quantise, type DetentTrack } from "../../cd/physics/detent";
import { intentFor, REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from "../../cd/physics/keys";
import { mountAssembly, readWrappedAngleUnsafe } from "../../cd/physics/rotation";
import { slewDurationMs } from "../../cd/physics/slew";
import { cue } from "../../cd/sound/cues";
import { DialLabels, DialTicks, Needle, R, bandPath } from "./dialParts";
import type { Band } from "../../data/types";
import {
  CHANNELS,
  KNOB_PITCH,
  KNOB_SEATS,
  dialAngle,
  dialScaleMax,
  dialZones,
  formatChannel,
  seatAngle,
  type ChannelKey,
} from "./model";

/* ========================================================================== */
/* THE FACE — engraved once per channel, then it holds still                  */
/* ========================================================================== */

interface FaceProps {
  bandStart: number;
  bandEnd: number;
  warnEnd: number;
}

/**
 * Majors every 10% of scale, minors every 2% — II.3.18's own ratio, read off
 * its 0-100 worked example. The numerals are NOT in here: see dialParts.tsx for
 * why they had to leave the viewBox.
 */
const DialFace = memo(function DialFace({ bandStart, bandEnd, warnEnd }: FaceProps) {
  return (
    <svg className="tdy-face" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      {/* the printed zones, UNDER the ticks — a zone, never a lamp (II.7.8) */}
      <g fill="none" strokeWidth={0.06 * R} strokeLinecap="butt">
        <path className="tdy-zone tdy-zone--band" d={bandPath(bandStart, bandEnd)} />
        <path className="tdy-zone tdy-zone--warn" d={bandPath(bandEnd, warnEnd)} />
        <path className="tdy-zone tdy-zone--redline" d={bandPath(warnEnd, 1)} />
      </g>
      <DialTicks minors={50} majorEvery={5} />
    </svg>
  );
});

/* ========================================================================== */
/* THE CLUSTER                                                                */
/* ========================================================================== */

export interface ChannelClusterProps {
  channel: number;
  onChannel: (next: number) => void;
  /** eatenSoFar — the ticked slots only. The reading the needle answers for. */
  eaten: Record<ChannelKey, number>;
  /** dayMacros — today's planned total, swaps- and variant-aware. */
  planned: Record<ChannelKey, number>;
  bands: Record<ChannelKey, Band>;
  /** The age of the newest tick behind the reading. Never invented. */
  age: { label: string; word: string; stale: boolean; ms: number | null };
  /** That tick's own HH:MM. The exact figure, independent of the sample rate. */
  at: string | null;
  /** The declared threshold this class prints on its own label. */
  threshold: string;
  /** True while Trophy Mode holds the screen — controls withdraw, gauges stay. */
  trophy: boolean;
}

const KNOB_TRACK: DetentTrack = { seats: KNOB_SEATS, pitch: KNOB_PITCH };

/**
 * The linkage, exposed as an imperative handle so a SECOND lever — the four
 * ladders on the macro bridge — can throw the same rod rather than growing a
 * private copy of it. II.3.4: "A keypress that skips the mechanical layer still
 * lands on the same semantic core — the value it produces is identical to the
 * dragged one." One linkage, three levers (knob, keyboard, ladder), one commit
 * path, and every one of them lands inside the input's own task.
 */
export interface LinkageHandle {
  /** Seat the knob, and everything geared to it, at `index`. */
  seat(index: number): void;
  /** A tick landed: retarget the needle NOW, off the freshly-committed model. */
  report(eaten: Record<ChannelKey, number>): void;
}

export const ChannelCluster = forwardRef<LinkageHandle, ChannelClusterProps>(function ChannelCluster({
  channel,
  onChannel,
  eaten,
  planned,
  bands,
  age,
  at,
  threshold,
  trophy,
}: ChannelClusterProps, handleRef) {
  const spec = CHANNELS[channel] ?? CHANNELS[0];
  const band = bands[spec.key];
  const scaleMax = dialScaleMax(band);
  const value = eaten[spec.key];
  const target = planned[spec.key];
  const zones = useMemo(() => dialZones(band, scaleMax), [band, scaleMax]);

  const carrierRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<HTMLSpanElement>(null);
  const needleRef = useRef<HTMLSpanElement>(null);
  const appliedRef = useRef<{ angle: number | null; seat: number }>({ angle: null, seat: channel });
  const repeatRef = useRef<number | null>(null);
  const grabRef = useRef<{ y: number; seatAtGrab: number; travel: number } | null>(null);

  /**
   * The needle. Distance sets time at 720 deg/s (CD-BRIEF ruling 1), floored at
   * 80ms AS A RATE REDUCTION rather than as a minimum duration bolted on the
   * end. The current angle is read from the live matrix so a retarget mid-flight
   * costs the distance still to travel, not the distance originally ordered
   * (II.4.15). Safe here and only here: the needle's own range is +/-135, which
   * never crosses the matrix's +/-180 wrap.
   */
  const sweepTo = useCallback((toDeg: number) => {
    const el = needleRef.current;
    if (!el) return;
    const from = appliedRef.current.angle == null ? toDeg : readWrappedAngleUnsafe(el);
    const ms = appliedRef.current.angle == null ? 0 : slewDurationMs(Math.abs(toDeg - from));
    el.style.setProperty("--tdy-sweep-ms", `${ms.toFixed(0)}ms`);
    el.style.setProperty("--tdy-needle-angle", `${toDeg.toFixed(2)}deg`);
    appliedRef.current.angle = toDeg;
  }, []);

  /** One commit angle, written ONCE. Cap, rocker and porthole each read it. */
  const seat = useCallback(
    (next: number, voice: boolean) => {
      const clamped = Math.min(KNOB_SEATS - 1, Math.max(0, next));
      const deg = seatAngle(clamped);
      if (carrierRef.current) mountAssembly(carrierRef.current, deg);
      if (discRef.current) discRef.current.style.setProperty("--tdy-porthole-angle", `${deg}deg`);
      if (clamped !== appliedRef.current.seat) {
        appliedRef.current.seat = clamped;
        // The needle is retargeted IN THIS TASK, off the next channel's own
        // reading, so the semantic commit and the report begin together.
        const nextSpec = CHANNELS[clamped];
        const nextBand = bands[nextSpec.key];
        sweepTo(dialAngle(eaten[nextSpec.key], dialScaleMax(nextBand)));
        // II.5.5 — the pretty clack, at the rocker's seat. Fires ONCE per
        // detent and never on hover, scroll or a needle's travel (II.5.16).
        if (voice) cue("detent", { x: 0.3 });
        onChannel(clamped);
      }
    },
    [bands, eaten, onChannel, sweepTo]
  );

  // Reconciliation. Idempotent by construction: every input path has already
  // written the same values synchronously, so this only does work when the
  // READING changed (a tick landed) rather than when the knob moved.
  useEffect(() => {
    if (carrierRef.current) mountAssembly(carrierRef.current, seatAngle(channel));
    if (discRef.current) discRef.current.style.setProperty("--tdy-porthole-angle", `${seatAngle(channel)}deg`);
    appliedRef.current.seat = channel;
    sweepTo(dialAngle(value, scaleMax));
  }, [channel, value, scaleMax, sweepTo]);

  useImperativeHandle(
    handleRef,
    () => ({
      seat: (index: number) => seat(index, true),
      report: (next: Record<ChannelKey, number>) => {
        const current = CHANNELS[appliedRef.current.seat];
        sweepTo(dialAngle(next[current.key], dialScaleMax(bands[current.key])));
      },
    }),
    [bands, seat, sweepTo]
  );

  const stopRepeat = useCallback(() => {
    if (repeatRef.current != null) window.clearTimeout(repeatRef.current);
    repeatRef.current = null;
  }, []);

  useEffect(() => stopRepeat, [stopRepeat]);

  /**
   * II.1.18 / II.3.4 — a keypress IS a detent, on the PRODUCT's own repeat
   * clock (380ms then 12/s), never the OS's. One arrow is one seat; PageUp and
   * PageDown are ten, which on a four-seat track means the limit; Home and End
   * are the limits outright.
   */
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.repeat) return; // the OS repeat clock is refused (II.1.18)
      const intent = intentFor(event, grabRef.current != null);
      if (!intent) return;
      event.preventDefault();
      /*
        II.1.17 — "New input retargets any motion in flight; nothing finishes an
        obsolete animation." A repeat clock is a motion in flight, so ANY new
        command stops it before anything else happens. Measured defect before
        this line existed: holding an arrow and then pressing Home left the
        arrow's 12/s repeat running, and the knob walked itself off the seat
        Home had just committed to. The stop used to sit under a `kind ===
        "step"` guard, so a limit key never reached it.
      */
      stopRepeat();
      const act = () => {
        const current = appliedRef.current.seat;
        if (intent.kind === "step") seat(current + intent.detents, true);
        else if (intent.kind === "limit") seat(intent.edge === "min" ? 0 : KNOB_SEATS - 1, true);
      };
      act();
      if (intent.kind !== "step") return;
      repeatRef.current = window.setTimeout(function tick() {
        act();
        repeatRef.current = window.setTimeout(tick, REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    },
    [seat, stopRepeat]
  );

  /**
   * II.1.6 — a grab is an OFFSET, never a teleport: the pointer's down position
   * is paired with the seat at that instant and every move is a delta from that
   * pair. II.1.13's gearing: 200px of vertical drag covers the full sweep.
   * II.1.12's hysteresis band keeps a hand resting on a boundary from flapping.
   */
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      grabRef.current = {
        y: event.clientY,
        seatAtGrab: appliedRef.current.seat,
        travel: appliedRef.current.seat * KNOB_PITCH,
      };
    },
    []
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const grab = grabRef.current;
      if (!grab) return;
      const fullSweepPx = 200; // GEAR.knob — full sweep per 200px (II.1.13)
      const deltaDeg = ((grab.y - event.clientY) / fullSweepPx) * (KNOB_PITCH * (KNOB_SEATS - 1));
      grab.travel = grab.seatAtGrab * KNOB_PITCH + deltaDeg;
      const next = quantise(KNOB_TRACK, grab.travel, appliedRef.current.seat);
      if (next !== appliedRef.current.seat) seat(next, true);
    },
    [seat]
  );

  const onPointerUp = useCallback(() => {
    grabRef.current = null;
  }, []);

  const displayValue = formatChannel(value, spec);
  const displayTarget = formatChannel(target, spec);
  const bandLow = formatChannel(band[0], spec);
  const bandHigh = formatChannel(band[1], spec);
  const over = value > band[1];
  const under = value < band[0];
  const stateWord = over ? "OVER BAND" : under ? "UNDER BAND" : "IN BAND";

  const labels = useMemo(() => {
    const out: { at: number; text: string }[] = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      out.push({ at: t, text: formatChannel(scaleMax * t, { ...spec, decimals: 0 }) });
    }
    return out;
  }, [scaleMax, spec]);

  return (
    <Enclosure
      variant="hero"
      as="section"
      grain
      className="tdy-cluster"
      aria-label="eaten so far, hero dial"
      data-tdy-state={over ? "over" : under ? "under" : "in"}
    >
      <header className="tdy-cluster-head">
        <Escutcheon as="h2">
          eaten so far
        </Escutcheon>
        <Escutcheon className="tdy-cluster-channel">{spec.title}</Escutcheon>
      </header>

      <div className="tdy-dial-mount">
        <Enclosure variant="bezel" className="tdy-dial-bezel">
          <div
            className="tdy-dial"
            role="img"
            aria-label={`${spec.title}: ${displayValue} ${spec.spoken} eaten of ${displayTarget} planned, week band ${bandLow} to ${bandHigh}, ${stateWord.toLowerCase()}, full scale ${formatChannel(scaleMax, { ...spec, decimals: 0 })}`}
          >
            <DialFace bandStart={zones.bandStart} bandEnd={zones.bandEnd} warnEnd={zones.warnEnd} />
            <DialLabels labels={labels} />
            <span className="tdy-face-unit cd-silkscreen" aria-hidden="true">
              {spec.unit}
            </span>

            {/* THE PORTHOLE — a 1.25rem aperture cut at the pivot, showing the
                geared disc. One tooth per 22.5 degree detent, so the steps a
                value has taken can be counted off the mechanism itself. */}
            <span className="tdy-porthole" aria-hidden="true">
              <span className="tdy-porthole-disc" ref={discRef} />
              <span className="tdy-porthole-glass" />
            </span>

            <Needle refEl={needleRef} />
          </div>
        </Enclosure>

      </div>

        {/* THE LINKAGE KNOB. Withdrawn in Trophy Mode — "controls withdraw on
            the shared contract; what enlarges is the answer, what quiets is the
            reach" — but never deleted from the DOM, so the tab order survives
            a mode the operator did not ask for. */}
        <div className="tdy-knob-set" data-tdy-hidden={trophy ? "true" : undefined}>
          <div
            className="tdy-knob cd-focusable"
            role="slider"
            tabIndex={trophy ? -1 : 0}
            aria-label="hero dial channel"
            aria-valuemin={0}
            aria-valuemax={KNOB_SEATS - 1}
            aria-valuenow={channel}
            aria-valuetext={spec.title}
            aria-orientation="vertical"
            onKeyDown={onKeyDown}
            onKeyUp={stopRepeat}
            onBlur={stopRepeat}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* THE CARRIER: no transform of its own, ever. Cap and rocker are
                siblings beneath it, each reading --cd-assembly-angle. */}
            <div className="tdy-knob-carrier" ref={carrierRef}>
              <span className="tdy-knob-cap" aria-hidden="true">
                <span className="tdy-knob-index" />
              </span>
              <span className="tdy-knob-rocker" aria-hidden="true" />
            </div>
          </div>
          <ul className="tdy-knob-seats" aria-hidden="true">
            {CHANNELS.map((c, i) => (
              <li key={c.key} className="tdy-knob-seat" data-tdy-seated={i === channel ? "true" : "false"}>
                {c.label}
              </li>
            ))}
          </ul>
        </div>

      {/* CORRECTIONARY 5.3 — the analog form AND the exact figure. II.6.20's
          top step is spent HERE and nowhere else on this screen. */}
      <Plate className="tdy-readout" surface="data">
        <p className="tdy-readout-line">
          <span className="cd-hero-value tdy-readout-value" style={{ "--cd-value-ch": spec.valueCh } as React.CSSProperties}>
            {displayValue}
          </span>
          <span className="cd-unit tdy-readout-unit">{spec.unit}</span>
          <span className="tdy-readout-target cd-printed">
            of {displayTarget} planned
          </span>
        </p>
        <p className="tdy-readout-band cd-printed">
          <span className="tdy-readout-word" data-tdy-word={over ? "over" : under ? "under" : "in"}>
            {stateWord}
          </span>
          <span aria-hidden="true"> · </span>
          <span>
            band {bandLow}–{bandHigh}
          </span>
        </p>
        {/* CORRECTIONARY 4 — the exact figure AND its age. The macros class is
            declared never-stale (a derived value has no age of its own), so
            what prints here is the age of the newest TICK behind the reading,
            with its own class threshold printed beside it. Never an age of zero
            for a reading that was never taken. */}
        <p className="tdy-readout-age cd-printed" data-tdy-stale={age.stale ? "true" : "false"}>
          <span className="cd-silkscreen tdy-age-label">as of</span>
          <span>{at == null ? "no ticks today" : `${at} · ${age.label}`}</span>
          {age.word ? <span className="tdy-age-word cd-silkscreen">{age.word}</span> : null}
          <span className="tdy-age-threshold cd-silkscreen">{threshold}</span>
        </p>
      </Plate>
    </Enclosure>
  );
});
