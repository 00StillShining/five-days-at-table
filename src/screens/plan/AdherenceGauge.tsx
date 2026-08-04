// PLAN's hero (§6.4, §6.10): the week adherence gauge — four needle dials
// (kcal/protein/fat/carb) vs the week's bands, with an always-present exact-
// numbers text table beside them (Sol gauge rule: toggle-free, never the
// visual alone). This is the screen's ONE precision object — every other
// component on PLAN stays flat/silkscreen.
//
// The dial is read-only: no role="slider", no interactivity. All of its
// information exists independently as text in the table (aria-hidden on the
// SVG). Motion: the needle rotates via a CSS `transform`, carries
// `data-motion` so tokens.css's global `[data-motion]` reduced-motion rule
// (prefers-reduced-motion -> transition-duration: 0.01ms) makes it jump
// instantly, with no gauge-specific CSS needed for that behavior.
import type { Band, Cover, Week } from "../../data/types";
import { MACRO_GROUPS, MACRO_LABEL, MACRO_UNIT, describeArc, fmtMacro, gaugeAngle, gaugeDisplayRange, weekBand, weekTotals, type MacroGroup } from "./helpers";
import type { SwapMap } from "./swapStore";

const DAYS_PER_WEEK = 5; // Mon-Fri plated days (PLAN §1) — weekends carry duties, not banded plates.

const MACRO_COLOR_VAR: Record<MacroGroup, string> = {
  kcal: "var(--sol-accent)", // kcal isn't one of the four heritage macro channels — plain ink/accent, not a --fd-ch-* token
  protein: "var(--fd-ch-protein)",
  fat: "var(--fd-ch-fat)",
  netCarb: "var(--fd-ch-carb)",
};

export interface AdherenceGaugeProps {
  week: Week;
  cover: Cover;
  swaps: SwapMap;
}

interface DialProps {
  group: MacroGroup;
  value: number;
  band: Band;
}

function statusText(value: number, band: Band, group: MacroGroup): { word: string; detail: string } {
  if (value < band[0]) return { word: "under", detail: `under by ${fmtMacro(band[0] - value, group)}${MACRO_UNIT[group]}` };
  if (value > band[1]) return { word: "over", detail: `over by ${fmtMacro(value - band[1], group)}${MACRO_UNIT[group]}` };
  return { word: "in-band", detail: "in band" };
}

function Dial({ group, value, band }: DialProps) {
  const [lo, hi] = gaugeDisplayRange(band, value);
  const bandStartAngle = gaugeAngle(band[0], lo, hi);
  const bandEndAngle = gaugeAngle(band[1], lo, hi);
  const needleAngle = gaugeAngle(value, lo, hi);
  const { word } = statusText(value, band, group);
  const cx = 60;
  const cy = 62;
  const trackR = 50;
  const bandR = 50;
  const needleLen = 42;
  const colorVar = MACRO_COLOR_VAR[group];

  return (
    <div className="scr-plan-dial" data-status={word}>
      <svg viewBox="0 0 120 68" aria-hidden="true" className="scr-plan-dial-svg" focusable="false">
        <path d={describeArc(cx, cy, trackR, -90, 90)} className="scr-plan-dial-track" />
        <path d={describeArc(cx, cy, bandR, bandStartAngle, bandEndAngle)} className="scr-plan-dial-band" style={{ stroke: colorVar }} />
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy - needleLen}
          className="scr-plan-dial-needle"
          data-motion
          style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${needleAngle}deg)` }}
        />
        <circle cx={cx} cy={cy} r={3.5} className="scr-plan-dial-pivot" />
      </svg>
      <p className="scr-plan-dial-label">{MACRO_LABEL[group]}</p>
    </div>
  );
}

export function AdherenceGauge({ week, cover, swaps }: AdherenceGaugeProps) {
  const totals = weekTotals(week, cover, swaps, DAYS_PER_WEEK);
  const weekBands = weekBand(week, cover, DAYS_PER_WEEK);

  return (
    <section className="scr-plan-hero" aria-label={`week ${week} adherence`}>
      <h2 className="scr-plan-hero-title">week adherence</h2>
      <div className="scr-plan-hero-body">
        <div className="scr-plan-dials">
          {MACRO_GROUPS.map((group) => (
            <Dial key={group} group={group} value={totals[group]} band={weekBands[group]} />
          ))}
        </div>
        <table className="scr-plan-hero-table">
          <caption className="fd5-visually-hidden">week {week} adherence — exact figures, five plated days</caption>
          <thead>
            <tr>
              <th scope="col">macro</th>
              <th scope="col">actual</th>
              <th scope="col">band</th>
              <th scope="col">status</th>
            </tr>
          </thead>
          <tbody>
            {MACRO_GROUPS.map((group) => {
              const band = weekBands[group];
              const value = totals[group];
              const { detail } = statusText(value, band, group);
              return (
                <tr key={group}>
                  <th scope="row">{MACRO_LABEL[group]}</th>
                  <td className="scr-plan-hero-num">
                    {fmtMacro(value, group)}
                    {MACRO_UNIT[group]}
                  </td>
                  <td className="scr-plan-hero-num">
                    {fmtMacro(band[0], group)}–{fmtMacro(band[1], group)}
                    {MACRO_UNIT[group]}
                  </td>
                  <td>{detail}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
