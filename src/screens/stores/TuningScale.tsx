/**
 * src/screens/stores/TuningScale.tsx — cook-from-stock, as a tuning dial.
 *
 * THE SIGNATURE MOVE, and the one only FD-5 would make.
 *
 * CLEAR LID's own signature instrument is the lamp scale: "a printed frequency
 * scale ... behind a strip of glass lit from one edge by the amber lamp ... a
 * pointer travels the scale as a value changes" (section 3). Every other
 * product would render "what can I cook from stock" as a list of five chips
 * with a percentage each. This screen renders it as the radio it is: the meals
 * are printed STATIONS along one scale, the pointer parks on the station you
 * are tuned to, and the lamp behind the scale charges when a hand moves stock
 * and decays to its 34% ember over 6000ms (II.2.18).
 *
 * And it is GEARED TO THE THUMBWHEEL. Set a level on the register and the
 * station marks move, because changing what is in the house genuinely changes
 * what tonight could be — the coverage is recomputed by the frozen selector
 * `coverageForAllMeals`, never smoothed and never invented. One commit, three
 * reports: the knob seats in 110ms, the row's needle sweeps at 340px/s, and the
 * tuning pointer travels at its own rate to wherever the station has moved to.
 * Nothing waits on anything; all three are reports of the same one commit.
 *
 * CD-BRIEF ruling 6 is satisfied by construction: this motion is USER-CAUSED.
 * The scale is dead still while the larder holds still (II.4.16 — "a stable
 * station, a stable speed, produces a stable screen").
 *
 * ---------------------------------------------------------------------------
 * THE VARIANT (docs/VARIANT-SPEC.md, binding)
 * ---------------------------------------------------------------------------
 * "The coverage strip ranks kept meals first in tester mode; others still
 * listed, marked 'not this week'." So the tester's cut meals keep their real
 * coverage figure and their real station mark — they are ranked below the kept
 * ones and print the words, rather than being hidden. Hiding them would be a
 * lie by omission about what the stock can actually cook.
 */

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Enclosure, Escutcheon, Plate } from "../../cd/foundry";
import { coveragePx, type Station } from "./model";

const TUNE_SLEW_PX_S = 340; // CLEAR LID section 3's CLEARLID_POINTER_SLEW
const TUNE_FLOOR_MS = 80; // II.4.8's floor

export interface TuningScaleProps {
  stations: Station[];
  /** How many meals were ranked in total, before the five-station cut. */
  rankedTotal: number;
  /** How many of those are cut in the active variant. Zero in full mode. */
  cutTotal: number;
  /** The station currently tuned to — an id, held above the scene (R6). */
  tunedId: string | null;
  onTune: (mealId: string) => void;
  /** Bumped by a real stocktake write. The lamp answers activity, not a clock. */
  activity: number;
  /** No stocktake at all: the pointer parks on its rest stop and says so. */
  hasStock: boolean;
  trophy: boolean;
}

function TuningScaleBase({
  stations,
  rankedTotal,
  cutTotal,
  tunedId,
  onTune,
  activity,
  hasStock,
  trophy,
}: TuningScaleProps) {
  const scaleRef = useRef<HTMLDivElement | null>(null);
  const lampRef = useRef<HTMLSpanElement | null>(null);
  const pointerRef = useRef<HTMLSpanElement | null>(null);
  const shownRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const firstRef = useRef(true);
  const [widthPx, setWidthPx] = useState(0);

  /* Measured ONCE and again only on resize — never per station, never per
     frame (II.2.22's own budget discipline). */
  useLayoutEffect(() => {
    const el = scaleRef.current;
    if (!el) return;
    const read = () => setWidthPx(el.getBoundingClientRect().width);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tuned = stations.find((s) => s.mealId === tunedId) ?? stations[0] ?? null;

  /* The pointer's travel time is DISTANCE OVER A STATED RATE, never a fixed
     duration; 80ms is only the floor (II.4.8). */
  const lastValueRef = useRef<number | null>(null);
  useEffect(() => {
    const el = pointerRef.current;
    if (!el || widthPx === 0) return;
    const value = tuned && hasStock ? tuned.coverage : null;
    const to = value === null ? 0 : coveragePx(value, widthPx);
    // A sweep reports a coverage change or a station change; a re-measure is
    // geometry and lands in one frame (model.ts's `sweepMs`).
    const changed = lastValueRef.current !== value;
    lastValueRef.current = value;
    const ms = changed
      ? Math.max(TUNE_FLOOR_MS, (Math.abs(to - shownRef.current) / TUNE_SLEW_PX_S) * 1000)
      : 0;
    el.style.setProperty("--str-tune-ms", `${ms.toFixed(0)}ms`);
    el.style.setProperty("--str-tune-x", `${to.toFixed(2)}px`);
    shownRef.current = to;
  }, [tuned, widthPx, hasStock]);

  /* II.2.18 — charge 120ms, decay 6000ms to the 34% floor, re-charge resets. */
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
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
    <Enclosure variant="hero" as="section" className="str-tune" aria-label="cook from stock">
      <Escutcheon as="h2" className="str-tune__name">
        from stock
      </Escutcheon>

      <div className="str-tune__scale" ref={scaleRef}>
        <span className="str-tune__lamp" ref={lampRef} />
        <span className="str-tune__print" />
        {/* the station marks — engraved indices at each meal's REAL coverage */}
        {hasStock &&
          widthPx > 0 &&
          stations.map((s) => (
            <span
              key={s.mealId}
              className="str-tune__station"
              data-tuned={s.mealId === tuned?.mealId ? "true" : "false"}
              style={{ ["--str-station-x" as string]: `${coveragePx(s.coverage, widthPx).toFixed(2)}px` }}
              aria-hidden="true"
            />
          ))}
        <span className="str-tune__pointer" ref={pointerRef} data-parked={hasStock ? "false" : "true"} />
      </div>

      {/*
        The printed calibration — silkscreened on the paper (II.6.8), and each
        numeral sits UNDER ITS OWN TICK rather than being spaced evenly along
        the row. `justify-content: space-between` puts the labels at the row's
        own thirds, not at the scale's quarters; on a calibrated instrument that
        is a printed lie about where 50% is.
      */}
      <div className="str-tune__legend" aria-hidden="true">
        {[0, 25, 50, 75, 100].map((p) => (
          <span key={p} style={{ ["--str-legend-p" as string]: `${p}%` }} data-edge={p === 0 ? "start" : p === 100 ? "end" : undefined}>
            {p === 100 ? "100%" : p}
          </span>
        ))}
      </div>

      <Plate className="str-tune__face" surface="data">
        {!hasStock ? (
          <span className="str-tune__off cd-prose">
            no stocktake yet — nothing can be ranked from an empty register. the pointer is parked on its stop.
          </span>
        ) : tuned ? (
          <>
            <a className="str-tune__meal cd-focusable" href={`#/meal/${tuned.mealId}`}>
              {tuned.name}
            </a>
            <span className="str-tune__figure cd-data">
              {Math.round(tuned.coverage * 100)}
              <span className="cd-unit">% covered</span>
            </span>
            <span className="str-tune__detail cd-printed">
              {tuned.inStock} of {tuned.needed} tracked ingredients in stock
              {tuned.keptThisWeek ? "" : " · not this week"}
            </span>
          </>
        ) : (
          <span className="str-tune__off cd-prose">no meals to rank.</span>
        )}
      </Plate>

      {/* THE STATION BANK. Tuning is a real gesture: pick a station and the
          pointer travels to its own coverage. Each plate is a 44px target and
          prints its own exact figure — never a bar with no number. */}
      {!trophy && hasStock && (
        <div className="str-tune__bank" role="radiogroup" aria-label="stations">
          {stations.map((s) => (
            <label
              key={s.mealId}
              className="str-tune__seat"
              data-tuned={s.mealId === tuned?.mealId ? "true" : "false"}
              data-cut={s.keptThisWeek ? "false" : "true"}
            >
              <input
                type="radio"
                name="str-station"
                value={s.mealId}
                checked={s.mealId === tuned?.mealId}
                onChange={() => onTune(s.mealId)}
              />
              <span className="str-tune__seat-name">{s.name}</span>
              <span className="str-tune__seat-fig cd-data">{Math.round(s.coverage * 100)}%</span>
              {!s.keptThisWeek && <span className="str-tune__seat-cut cd-silkscreen">not this week</span>}
            </label>
          ))}
          {/*
            II.6.24 — the clip states its remainder as a number, and states the
            variant's own share of it. docs/VARIANT-SPEC.md ranks kept meals
            first, which means a tester with ten kept meals never shows a cut
            one inside a five-station bank; without this line the screen would
            silently imply the cut meals do not exist rather than that they rank
            below. The figure is real on both sides of the variant switch.
          */}
          <span className="str-tune__more cd-overflow-count">
            {rankedTotal - stations.length}
            <span className="cd-unit">
              {cutTotal > 0 ? `below · ${cutTotal} not this week` : "ranked below"}
            </span>
          </span>
        </div>
      )}
    </Enclosure>
  );
}

export const TuningScale = memo(TuningScaleBase);
