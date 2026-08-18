/**
 * src/screens/meal/PortionWheel.tsx — THE SIGNATURE.
 *
 * ch.16 section 7, Signature rung: "the wheel's own detent range drives [the
 * geometry] directly ... Signature retires the flat conic disc and cuts the
 * wheel's own circumference into individual facet planes via a layered ring
 * geometry, so the one control's edge becomes the palette's chamfer made
 * physical rather than merely adjacent to it."
 *
 * Built exactly that way, with the facet count derived rather than borrowed:
 * SIXTEEN facet planes at a 22.5deg pitch, which is the detent pitch itself, so
 * ONE PLANE PASSES THE FIXED CATCH PER COMMITTED SEAT. The mirror flash is the
 * step, not an animation timed to look like one. 360 / 22.5 = 16; the chapter's
 * own eight-facet conic is the same construction at half the resolution, and
 * this screen has a reason for the other eight that the chapter's wheel did not.
 *
 * ---------------------------------------------------------------------------
 * IT REFUSES COAST, AT EVERY SPEED, WITH NO EXCEPTION
 * ---------------------------------------------------------------------------
 * ch.16 section 5: "a rotary built specifically to refuse the coast a wheel is
 * normally allowed to earn (II.1.10) — no traversal length, however long, ever
 * unlocks a glide, because a coast is a decision the hand never confirmed."
 *
 * There is no release-velocity sampler in this file, no glide, no inertia and
 * no free-scrub state. `onPointerUp` clears the grab and nothing else. Every
 * stop is a seat. That refusal is also THE FENCE: ch.16 section 8 names REEL
 * LOGIC — COOK's language — as a physics curdle with this one, "because the
 * same fast spin would mean two contradictory things depending on which control
 * the hand happened to land on". This wheel therefore renders on MEAL and
 * nowhere else, and MEAL is never a tray over COOK (see model.ts's fence).
 *
 * ---------------------------------------------------------------------------
 * THE TWO ROTATION GUARD-RAILS, AND WHERE EACH IS SPENT
 * ---------------------------------------------------------------------------
 * 1. THE UNTRANSFORMED CARRIER. Facet ring, index and porthole disc are
 *    SIBLINGS on a carrier that carries no transform of its own, each reading
 *    the commit angle independently. Nest one inside another and a mid-throw
 *    reversal compounds 22.5deg into 45deg. src/cd/physics/rotation.ts asserts
 *    the carrier in DEV; the assertion is why the carrier has no transform in
 *    meal.css either.
 * 2. CUMULATIVE TURN IN `dataset`. The porthole disc is geared 2:1 — 45deg of
 *    disc per 22.5deg of wheel, which is exactly one tooth per detent — so its
 *    turn crosses the computed matrix's +/-180deg wrap after four seats and a
 *    full revolution after eight. Recovering that angle from
 *    getComputedStyle().transform would silently lose every revolution already
 *    made, so it lives in `dataset` and is only ever read with `readTurn`.
 *
 * ---------------------------------------------------------------------------
 * KEYBOARD IS PHYSICS, AND FINE IS DECLARED (CORRECTIONARY 6.5)
 * ---------------------------------------------------------------------------
 * II.1.18's map, whole: arrow = one seat, PageUp/PageDown = ten seats (which on
 * a 13-seat track is the limit), Home/End = the hard limits, Escape abandons an
 * engaged drag and restores the value it began with, held keys repeat at 12/s
 * after 380ms on the PRODUCT's clock.
 *
 * FINE (II.1.16) is a gear, and on this control it is spent where a gear can
 * honestly exist. On the POINTER, Shift re-gears the drag to 20% of coarse —
 * 1000px per full sweep instead of 200px — exactly as the clause specifies. On
 * the KEYBOARD it cannot subdivide a seat: this track's coarse step is 0.05,
 * the smallest portion the plan is authored at, and 20% of it is a value no
 * plate can be cooked at. So Shift+arrow moves the same ONE seat and SUPPRESSES
 * THE REPEAT CLOCK — one press, one seat, no 12/s run-on — which is a real,
 * felt fine gear that never invents a value between two wells. Stated here
 * rather than quietly shipped as "Shift does nothing".
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Enclosure, Escutcheon, Plate } from "../../cd/foundry";
import { quantise, type DetentTrack } from "../../cd/physics/detent";
import { intentFor, REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from "../../cd/physics/keys";
import { advanceTurn, mountAssembly, readTurn } from "../../cd/physics/rotation";
import { cue } from "../../cd/sound/cues";
import type { Cover } from "../../data";
import {
  COVER_LAMPS,
  WHEEL_PITCH_DEG,
  WHEEL_SEATS,
  atLimit,
  formatScale,
  ringRims,
  ringTracks,
  scaleForSeat,
  seatAngle,
} from "./model";

/** II.1.13 — the throw, declared and held constant across the whole range. */
const FULL_SWEEP_PX = 200;
/** II.1.16 — fine re-gears the same mapping to 20% of coarse. */
const FINE_GEAR = 0.2;
/** The porthole's gear: one tooth of disc per committed seat. */
const DISC_GEAR_DEG = 45;
/** The number of facet planes cut into the wheel's circumference. */
export const FACET_PLANES = 16;

const TRACK: DetentTrack = { seats: WHEEL_SEATS, pitch: WHEEL_PITCH_DEG };

export interface WheelHandle {
  /** Seat the wheel at `seat`, writing every geared sibling in the same task. */
  seat(index: number): void;
}

export interface PortionWheelProps {
  seat: number;
  onSeat: (next: number) => void;
  /** The cover the ring reports. NEVER the scale — see model.ts. */
  cover: Cover;
  /** Trophy Mode holds the screen: the wheel enlarges, the reach quiets. */
  trophy: boolean;
}

/*
  THE CLOSED STATE SET (II.3.3), and it deliberately has no `disabled` in it:
  rest · focus · engaged · fine · at-limit.

  A continuous control's declared set includes disabled, and this one cannot
  reach it. A tray with no plate to scale — a cut slot, an unknown id — does not
  render a greyed-out wheel; it renders a blanked-off station with the reason
  engraved on it and no wheel at all. A control that can never be disabled and
  ships a disabled state anyway has a state nothing can produce, which II.3.3
  calls a defect in the casting rather than a feature of the screen.
*/

export const PortionWheel = forwardRef<WheelHandle, PortionWheelProps>(function PortionWheel(
  { seat, onSeat, cover, trophy },
  handleRef
) {
  const carrierRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<HTMLSpanElement>(null);
  const figureRef = useRef<HTMLSpanElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  /** The seat the DOM is currently showing. The hysteresis memory, and the
   *  reason a re-render never has to re-derive what the hand already did. */
  const appliedRef = useRef<number>(seat);
  const repeatRef = useRef<number | null>(null);
  const grabRef = useRef<{ y: number; seatAtGrab: number; travel: number } | null>(null);
  const limitHold = useRef<number | null>(null);

  /**
   * ONE COMMIT, WRITTEN ONCE, READ BY EVERY SIBLING.
   *
   * II.1.1's division of labour, exactly: the semantic value is true before any
   * spring, any transition and any re-render. `onSeat` is the request to
   * re-render; nothing on this assembly waits for it.
   */
  const commitSeat = useCallback(
    (next: number, voice: boolean) => {
      const clamped = Math.min(WHEEL_SEATS - 1, Math.max(0, next));
      const previous = appliedRef.current;
      if (clamped === previous) {
        // II.1.14 — a hard limit takes the arriving velocity and returns none:
        // the at-limit state holds 60ms on the stop before further input reads
        // as travel away from it. Nothing bounces, because nothing gave.
        const edge = atLimit(clamped);
        if (edge && sliderRef.current) {
          sliderRef.current.dataset.meaLimit = edge;
          if (limitHold.current != null) window.clearTimeout(limitHold.current);
          limitHold.current = window.setTimeout(() => {
            if (sliderRef.current) delete sliderRef.current.dataset.meaLimit;
          }, 60);
        }
        return;
      }
      appliedRef.current = clamped;

      // 1 · the carrier. Facet ring, index and disc are siblings beneath it.
      if (carrierRef.current) mountAssembly(carrierRef.current, seatAngle(clamped));
      // 2 · the geared disc, by CUMULATIVE distance held in `dataset`.
      if (discRef.current) advanceTurn(discRef.current, (clamped - previous) * DISC_GEAR_DEG);
      // 3 · the figure. The exact value, in the input's own task — the wheel is
      //     a rotary fused with its own readout, so both report together.
      if (figureRef.current) figureRef.current.textContent = formatScale(scaleForSeat(clamped));

      // II.5.5 — this world's own tick: a pure sine at 2100Hz, 18ms, -24dBFS,
      // coalesced above 8/s by the shared coalescer. Never on hover, scroll,
      // navigation or a passive update (II.5.16).
      if (voice) cue("detent", { x: 0.72 });
      onSeat(clamped);
    },
    [onSeat]
  );

  useImperativeHandle(handleRef, () => ({ seat: (index: number) => commitSeat(index, true) }), [
    commitSeat,
  ]);

  /**
   * Reconciliation, and it is idempotent by construction: every input path has
   * already written these values synchronously, so this only does work when the
   * seat changed from OUTSIDE this control — a fresh mount, a route change to
   * another meal, or another tab writing prefs.scale.
   */
  useEffect(() => {
    if (appliedRef.current === seat && carrierRef.current?.style.getPropertyValue("--cd-assembly-angle"))
      return;
    const previous = appliedRef.current;
    appliedRef.current = seat;
    if (carrierRef.current) mountAssembly(carrierRef.current, seatAngle(seat));
    if (discRef.current) {
      // On a cold mount there is no previous turn to advance from, so the
      // absolute seat seeds the dataset. Every later write is a delta.
      const seeded = readTurn(discRef.current) !== 0 || previous !== seat;
      advanceTurn(discRef.current, (seeded ? seat - previous : seat) * DISC_GEAR_DEG);
    }
    if (figureRef.current) figureRef.current.textContent = formatScale(scaleForSeat(seat));
  }, [seat]);

  const stopRepeat = useCallback(() => {
    if (repeatRef.current != null) window.clearTimeout(repeatRef.current);
    repeatRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopRepeat();
      if (limitHold.current != null) window.clearTimeout(limitHold.current);
    },
    [stopRepeat]
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.repeat) return; // II.1.18 — the OS repeat clock is refused
      const intent = intentFor(event, grabRef.current != null);
      if (!intent) return;
      event.preventDefault();
      /* II.1.17 — new input retargets any motion in flight. A repeat clock IS a
         motion in flight, so ANY command stops it first, including a limit key
         that produces no step of its own. */
      stopRepeat();

      if (intent.kind === "abandon") {
        const grab = grabRef.current;
        grabRef.current = null;
        if (grab) commitSeat(grab.seatAtGrab, true);
        return;
      }

      const act = () => {
        const current = appliedRef.current;
        if (intent.kind === "step") commitSeat(current + intent.detents, true);
        else if (intent.kind === "limit") commitSeat(intent.edge === "min" ? 0 : WHEEL_SEATS - 1, true);
      };
      act();
      // Fine suppresses the repeat clock outright (see the file header): one
      // press, one seat, no run-on past the portion the hand was aiming at.
      if (intent.kind !== "step" || intent.fine) return;
      repeatRef.current = window.setTimeout(function tick() {
        act();
        repeatRef.current = window.setTimeout(tick, REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    },
    [commitSeat, stopRepeat]
  );

  /**
   * II.1.6 — a grab is an OFFSET, never a teleport: the pointer's down position
   * is paired with the seat at that instant, and every move is a delta from that
   * pair. Grabbing the wheel mid-turn therefore never moves the value by itself,
   * which is ch.16 section 3's own promise: "grabbing the wheel mid-turn is
   * never a teleport in the first place ... only the next honest step."
   */
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      grabRef.current = {
        y: event.clientY,
        seatAtGrab: appliedRef.current,
        travel: appliedRef.current * WHEEL_PITCH_DEG,
      };
    },
    []
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const grab = grabRef.current;
      if (!grab) return;
      const gear = event.shiftKey ? FINE_GEAR : 1;
      const deltaDeg =
        ((grab.y - event.clientY) / FULL_SWEEP_PX) * (WHEEL_PITCH_DEG * (WHEEL_SEATS - 1)) * gear;
      grab.travel = grab.seatAtGrab * WHEEL_PITCH_DEG + deltaDeg;
      // II.1.12's 12% hysteresis band. A hand resting on a boundary cannot make
      // the value flap at frame rate and re-fire the tick with it.
      const next = quantise(TRACK, grab.travel, appliedRef.current);
      if (next !== appliedRef.current) commitSeat(next, true);
    },
    [commitSeat]
  );

  /** Every stop is a seat. There is no release velocity here, and no glide. */
  const onPointerUp = useCallback(() => {
    grabRef.current = null;
  }, []);

  const scale = scaleForSeat(seat);
  const lit = COVER_LAMPS.find((l) => l.cover === cover) ?? COVER_LAMPS[0];
  const tracks = ringTracks(cover);
  const rims = ringRims();

  return (
    <Enclosure
      variant="hero"
      as="section"
      grain
      className="mea-wheelset"
      aria-label="portion scale"
      data-mea-limit-state={atLimit(seat) ?? undefined}
    >
      <header className="mea-wheelset-head">
        <Escutcheon as="h2">portion</Escutcheon>
        <Escutcheon className="mea-wheelset-range">0.70 — 1.30</Escutcheon>
      </header>

      <div className="mea-wheel-mount">
        {/*
          THE COVER RING — ch.16's format ring, bound to a categorical fact.
          Two arcs of 166deg with 2deg gaps (336deg total), the remaining 24deg
          reserved at the base for the lit lamp's bloom, exactly as the chapter
          reserves it. Painted as one conic-gradient track so the geometry can
          never drift between the lamps, with each lamp's own 1px lens rim laid
          over its arc — four of the five format cores measure under the 3:1
          graphical floor against this world's well, which is why the rim exists.
        */}
        <span
          className="mea-ring"
          role="img"
          aria-label={`plate cut for ${lit.word.toLowerCase()}`}
          style={
            {
              "--mea-ring-dim": tracks.dim,
              "--mea-ring-lit": tracks.lit,
              "--mea-ring-rims": rims,
              "--mea-ring-hue": tracks.hue,
            } as React.CSSProperties
          }
        >
          <span className="mea-ring-track" aria-hidden="true" />
          <span className="mea-ring-flame" aria-hidden="true" />
          <span className="mea-ring-rim" aria-hidden="true" />
        </span>

        <div className="mea-collar">
          <div
            ref={sliderRef}
            className="mea-wheel cd-focusable"
            role="slider"
            tabIndex={trophy ? -1 : 0}
            aria-label="portion scale"
            aria-valuemin={0}
            aria-valuemax={WHEEL_SEATS - 1}
            aria-valuenow={seat}
            aria-valuetext={`× ${formatScale(scale)}`}
            aria-orientation="vertical"
            onKeyDown={onKeyDown}
            onKeyUp={stopRepeat}
            onBlur={stopRepeat}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* THE CARRIER. No transform of its own, ever — the facet ring, the
                index and the porthole disc are siblings beneath it. */}
            <div className="mea-wheel-carrier" ref={carrierRef}>
              {/* layer 1 · the facet ring — turns with every detent */}
              <span className="mea-wheel-facets" aria-hidden="true" />
              {/* the engraved index, cut into the cap, turning with it */}
              <span className="mea-wheel-index" aria-hidden="true" />
            </div>
            {/* layer 2 · the catch — the hard-mirror specular, FIXED to the
                world's own sun (II.2.4: texture rotates, light holds). It is
                deliberately NOT inside the carrier. */}
            <span className="mea-wheel-catch" aria-hidden="true" />

            {/* THE PORTHOLE. One tooth per committed seat, geared 2:1, so the
                steps a portion has taken can be counted off the mechanism
                itself rather than inferred from the figure. */}
            <span className="mea-porthole" aria-hidden="true">
              <span className="mea-porthole-disc" ref={discRef} />
              <span className="mea-porthole-glass" />
            </span>
          </div>
        </div>
      </div>

      {/* II.7.7 — colour never travels alone. The ring's lit lamp prints its own
          word, and the word is what survives desaturation, an 8px blur and
          forced-colours. Without it the ring is one channel, and one channel is
          not a report. */}
      <p className="mea-ring-word cd-printed" data-mea-cover={cover}>
        <span className="cd-silkscreen">cut for</span>
        <span className="mea-ring-word-value">{lit.word}</span>
      </p>

      {/* The printed seat scale. Engraved on the faceplate, not on the wheel:
          "a hand adjusting the control never covers its name" (II.3.28). */}
      <ul className="mea-wheel-seats" aria-hidden="true">
        {[0, 3, 6, 9, 12].map((s) => (
          <li key={s} className="mea-wheel-seat" data-mea-seated={s === seat ? "true" : "false"}>
            {formatScale(scaleForSeat(s))}
          </li>
        ))}
      </ul>

      {/* CORRECTIONARY 5.3 — the analogue form AND the exact figure. II.6.20's
          reserved top step is spent HERE and nowhere else on this screen. */}
      <Plate className="mea-wheel-readout" surface="data">
        <p className="mea-wheel-figure-line">
          <span className="mea-wheel-times" aria-hidden="true">
            ×
          </span>
          <span
            ref={figureRef}
            className="cd-hero-value mea-wheel-figure"
            style={{ "--cd-value-ch": 4 } as React.CSSProperties}
          >
            {formatScale(scale)}
          </span>
        </p>
        <p className="mea-wheel-seat-line cd-printed">
          <span className="cd-silkscreen">seat</span>
          <span>
            {seat + 1} of {WHEEL_SEATS}
          </span>
          <span className="cd-silkscreen mea-wheel-pitch">22.5° pitch</span>
        </p>
      </Plate>
    </Enclosure>
  );
});
