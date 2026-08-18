/**
 * src/screens/today/Chronometer.tsx — how long is left before tonight has to start.
 *
 * The second porthole gauge. CD-BRIEF: "Portholes scatter — 4-6 heroes, not
 * one. ch.05's 'one porthole per screen' is overruled by CORRECTIONARY 3.1."
 *
 * ---------------------------------------------------------------------------
 * WHY THIS ONE IS ALLOWED A MOVING MECHANISM AND MOST OF FD-5 IS NOT
 * ---------------------------------------------------------------------------
 * CD-BRIEF product ruling 6: "Portholes, rocker arms and spinning elements
 * attach ONLY to values whose change is user-caused or clock-continuous ... A
 * daily stock level gets a needle and a printed zone, not a spinning disc."
 *
 * Minutes-in-hand is the one genuinely clock-continuous reading on TODAY, so
 * this is the one place an escapement is honest. It steps ONE TOOTH PER MINUTE
 * CONSUMED and at no other time: no dinner tonight and the wheel does not move
 * at all, because there is no minute being consumed to show.
 *
 * ---------------------------------------------------------------------------
 * GUARD-RAIL 2 IS SPENT HERE (ch.05 section 3)
 * ---------------------------------------------------------------------------
 * "the porthole's own turn count is held in its dataset, NEVER recovered from
 * getComputedStyle().transform: a computed matrix wraps every revolution back
 * into +/-180 degrees, so reading it back after the disc has turned past 360
 * would lose every full turn already made."
 *
 * This wheel passes 360 degrees every 24 minutes. It is the one element on the
 * screen that can hit that wrap, so it is the one that uses `advanceTurn`, and
 * the needle beside it — whose range is +/-135 and therefore safe — is the one
 * that reads its live angle back off the matrix.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Enclosure, Escutcheon, Lamp, Plate, PressKey } from "../../cd/foundry";
import { advanceTurn, readWrappedAngleUnsafe } from "../../cd/physics/rotation";
import { REST_STOP_DEG, slewDurationMs } from "../../cd/physics/slew";
import { cue } from "../../cd/sound/cues";
import { DialLabels, DialTicks, Needle, R, bandPath, type DialLabel } from "./dialParts";
import {
  CHRONO_FULL_MIN,
  CHRONO_REDLINE_MIN,
  CHRONO_WARN_MIN,
  CHRONO_WORD,
  ESCAPEMENT_TOOTH_DEG,
  chronoAngle,
  chronoState,
  formatMinutes,
} from "./model";

/**
 * The face is a constant: the scale is six hours for every reading, so the
 * engraved ring never moves and the needle is the only thing that does.
 * Hours, not minutes, on the labels — a cook decides in hours and starts in
 * minutes, and a ring labelled 0/60/120/180/240/300/360 is arithmetic homework.
 */
const CHRONO_LABELS: DialLabel[] = [0, 1, 2, 3, 4, 5, 6].map((h) => ({ at: h / 6, text: String(h) }));

const CHRONO_FACE = (
  <svg className="tdy-face" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
    <g fill="none" strokeWidth={0.06 * R} strokeLinecap="butt">
      {/* The redline sits at EMPTY, the way a fuel gauge's does: this dial
          counts down, and the hard limit is the end it is falling toward. */}
      <path className="tdy-zone tdy-zone--redline" d={bandPath(0, CHRONO_REDLINE_MIN / CHRONO_FULL_MIN)} />
      <path
        className="tdy-zone tdy-zone--warn"
        d={bandPath(CHRONO_REDLINE_MIN / CHRONO_FULL_MIN, CHRONO_WARN_MIN / CHRONO_FULL_MIN)}
      />
    </g>
    {/* one tick per 10 minutes, majors every hour */}
    <DialTicks minors={36} majorEvery={6} />
  </svg>
);

export interface ChronometerProps {
  /** The meal actually cooking tonight, swap-resolved. null when there is none. */
  mealName: string | null;
  /** "HH:MM" — the latest the cook can start and still serve on time. */
  startBy: string | null;
  /** Minutes until start-by. Negative once it has passed. null when off. */
  minutesInHand: number | null;
  /** Why the dial is off, when it is. Printed, never left as a blank face. */
  offReason: string;
  /** Fires the drill-in to COOK. */
  onCook: () => void;
  trophy: boolean;
}

export function Chronometer({ mealName, startBy, minutesInHand, offReason, onCook, trophy }: ChronometerProps) {
  const needleRef = useRef<HTMLSpanElement>(null);
  const escapementRef = useRef<HTMLSpanElement>(null);
  const lastMinuteRef = useRef<number | null>(null);
  const appliedRef = useRef<number | null>(null);

  const state = chronoState(minutesInHand);
  const off = minutesInHand == null;
  const whole = minutesInHand == null ? null : Math.trunc(minutesInHand);
  /*
    II.1.14 — "the semantic value clamps at the limit the moment travel reaches
    it; the overflow is display only, and truth never follows the rubber." The
    needle parks on the stop, which is correct. But a needle sitting on 6 beside
    a figure of "19h 06m" invites the needle to be read as the value, so the
    dial SAYS it is off scale rather than leaving the two to disagree quietly.
  */
  const offScale = minutesInHand != null && minutesInHand > CHRONO_FULL_MIN;

  const targetAngle = useMemo(
    () => (minutesInHand == null ? REST_STOP_DEG : chronoAngle(Math.min(CHRONO_FULL_MIN, minutesInHand))),
    [minutesInHand]
  );

  // The needle. Same 720 deg/s rate as every other needle in the product, read
  // back off the live matrix so a retarget costs only the travel that is left.
  useEffect(() => {
    const el = needleRef.current;
    if (!el) return;
    const from = appliedRef.current == null ? targetAngle : readWrappedAngleUnsafe(el);
    const ms = appliedRef.current == null ? 0 : slewDurationMs(Math.abs(targetAngle - from));
    el.style.setProperty("--tdy-sweep-ms", `${ms.toFixed(0)}ms`);
    el.style.setProperty("--tdy-needle-angle", `${targetAngle.toFixed(2)}deg`);
    appliedRef.current = targetAngle;
  }, [targetAngle]);

  /**
   * The escapement. One tooth per minute CONSUMED — nothing else moves it.
   *
   * A tab left open overnight returns with hundreds of minutes consumed. Those
   * minutes were not watched, so they are not performed: past five teeth the
   * wheel is REPOSITIONED with no travel at all. II.4.16 forbids motion with
   * nothing behind it, and a two-second spin catching up on eight hours nobody
   * saw is exactly that — theatre standing in for a fact.
   */
  useEffect(() => {
    const el = escapementRef.current;
    if (!el || whole == null) {
      lastMinuteRef.current = whole;
      return;
    }
    const previous = lastMinuteRef.current;
    lastMinuteRef.current = whole;
    if (previous == null) return; // first mount: seat, never sweep
    const consumed = previous - whole;
    if (consumed === 0) return;
    const teeth = Math.abs(consumed);
    el.style.setProperty("--tdy-escape-ms", teeth > 5 ? "0ms" : "110ms");
    advanceTurn(el, ESCAPEMENT_TOOTH_DEG * consumed, 1);
  }, [whole]);

  const commitCook = useCallback(() => {
    // II.5.7 — confirm fires only once a real consequence has landed. Loading
    // tonight's program and moving to COOK is that consequence.
    cue("confirm", { x: 0.7 });
    onCook();
  }, [onCook]);

  const figure = whole == null ? "—" : formatMinutes(whole);

  return (
    <Enclosure
      variant="hero"
      as="section"
      grain
      className="tdy-chrono"
      aria-label="tonight, start-by chronometer"
      data-tdy-state={state}
    >
      <header className="tdy-cluster-head">
        <Escutcheon as="h2">
          tonight
        </Escutcheon>
        <Lamp
          lit={state === "now" || state === "late"}
          word={{ on: CHRONO_WORD[state], off: off ? "NO COOK" : "IN HAND" }}
          label="start-by"
          hue={state === "late" ? "var(--cd-role-danger-zone-dark)" : "var(--cd-role-warning)"}
        />
      </header>

      <div className="tdy-dial-mount">
        <Enclosure variant="bezel" className="tdy-dial-bezel">
          <div
            className="tdy-dial"
            role="img"
            aria-label={
              off
                ? `start-by clock: off. ${offReason}`
                : `start-by clock: ${figure} until ${startBy}, ${CHRONO_WORD[state].toLowerCase()}, full scale 6 hours${offScale ? ", needle parked at the stop, value is off scale" : ""}`
            }
          >
            {CHRONO_FACE}
            <DialLabels labels={CHRONO_LABELS} />
            <span className="tdy-face-unit cd-silkscreen" aria-hidden="true">
              hours
            </span>

            {/* THE PORTHOLE — the escapement, visible the way a collector reads
                a movement through a caseback. 24 teeth, one consumed a minute. */}
            <span className="tdy-porthole" aria-hidden="true">
              <span className="tdy-porthole-disc tdy-escapement" ref={escapementRef} data-tdy-running={off ? "false" : "true"} />
              <span className="tdy-porthole-glass" />
            </span>

            <Needle refEl={needleRef} parked={off} />
          </div>
        </Enclosure>
      </div>

      <Plate className="tdy-readout tdy-readout--chrono" surface="data">
        <p className="tdy-readout-line">
          <span className="tdy-chrono-figure cd-data" style={{ "--cd-value-ch": 7 } as React.CSSProperties}>
            {figure}
          </span>
          <span className="tdy-readout-word" data-tdy-word={state}>
            {CHRONO_WORD[state]}
          </span>
          {offScale && (
            <span className="tdy-offscale cd-silkscreen">needle at the stop · dial reads to 6h</span>
          )}
        </p>
        {off ? (
          <p className="tdy-readout-band cd-printed">{offReason}</p>
        ) : (
          <p className="tdy-readout-band cd-printed">
            <span className="tdy-chrono-meal">{mealName}</span>
            <span aria-hidden="true"> · </span>
            <span>start by {startBy}</span>
          </p>
        )}
      </Plate>

      {/* ch.05's GATED COMMIT BUTTON: "a rod visible through a milled slot that
          overtravels 1px on press and is pulled back to centre by the Anchored
          spring the instant the hand releases without a full commit." The rod
          is a real child element with a real Anchored return; the cap is the
          foundry's own PressKey, which commits on RELEASE INSIDE BOUNDS, so
          sliding off cancels — consequence deserves an exit (II.3.13). */}
      <div className="tdy-gate" data-tdy-hidden={trophy ? "true" : undefined}>
        <PressKey
          className="tdy-gate-key"
          onPress={commitCook}
          disabled={off}
          sound="contact"
          aria-label={off ? "no cook tonight" : `cook ${mealName}`}
        >
          <span className="tdy-gate-slot" aria-hidden="true">
            <span className="tdy-gate-rod" />
          </span>
          <span className="cd-key-cap">cook →</span>
        </PressKey>
      </div>
    </Enclosure>
  );
}
