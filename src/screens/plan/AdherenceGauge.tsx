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
import type { CSSProperties } from "react";
import type { Band, Cover, Week } from "../../data/types";
import type { Swaps } from "../../state/types";
import { FULL_VARIANT, MACRO_GROUPS, MACRO_LABEL, MACRO_UNIT, describeArc, fmtMacro, gaugeAngle, gaugeDisplayRange, polarToCartesian, weekBand, weekTotals, type ActiveVariant, type MacroGroup } from "./helpers";

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
  swaps: Swaps;
  variant?: ActiveVariant;
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

// Printed-scale ticks (PHASE 3 polish, item 2): five static marks across the
// dial's fixed -90..90 sweep. Deliberately NOT data-driven (a real
// instrument's printed scale doesn't move when the reading changes) — same
// five angles on every dial regardless of macro/band, which is what makes
// them read as "printed" rather than as another data layer.
const SCALE_TICK_ANGLES = [-90, -45, 0, 45, 90];

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
  const tailLen = 9; // counterweight tail, opposite the needle tip past the pivot
  const wellR = trackR + 7;
  const colorVar = MACRO_COLOR_VAR[group];
  const ticks = SCALE_TICK_ANGLES.map((angle) => ({
    angle,
    inner: polarToCartesian(cx, cy, trackR + 1, angle),
    outer: polarToCartesian(cx, cy, trackR + 6, angle),
  }));

  return (
    <div className="scr-plan-dial" data-status={word}>
      <svg viewBox="0 0 120 68" aria-hidden="true" className="scr-plan-dial-svg" focusable="false">
        {/* Recessed dial well (item 2): a filled plate + rim behind the
            track/ticks/needle — Sol §1B "depth follows structure". Flat
            fill (an existing token, not a gradient) keeps this restrained;
            the dial stays the board's one precision object (PLAN §6.0),
            not a showpiece. */}
        <path d={`${describeArc(cx, cy, wellR, -90, 90)} L ${cx} ${cy} Z`} className="scr-plan-dial-well" />
        <path d={describeArc(cx, cy, wellR, -90, 90)} className="scr-plan-dial-well-rim" />
        {ticks.map((t) => (
          <line key={t.angle} x1={t.inner.x} y1={t.inner.y} x2={t.outer.x} y2={t.outer.y} className="scr-plan-dial-tick" />
        ))}
        <path d={describeArc(cx, cy, trackR, -90, 90)} className="scr-plan-dial-track" />
        {/* Wave-1 review fix: the macro channel color is set via a CSS custom
            property, not an inline `stroke`, so plan.css's
            `@media (forced-colors: active)` rule (stroke: CanvasText) can
            still win — an inline `style.stroke` would have out-specificity'd
            that stylesheet rule regardless of media-query matching. */}
        <path
          d={describeArc(cx, cy, bandR, bandStartAngle, bandEndAngle)}
          className="scr-plan-dial-band"
          style={{ "--scr-plan-dial-color": colorVar } as CSSProperties}
        />
        {/* Needle gains a short counterweight tail (item 2): the same line
            extended slightly past the pivot on the opposite side, rather
            than starting exactly at center — still one element, same
            rotation, no new interactive surface. */}
        <line
          x1={cx}
          y1={cy + tailLen}
          x2={cx}
          y2={cy - needleLen}
          className="scr-plan-dial-needle"
          data-motion
          style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${needleAngle}deg)` }}
        />
        <circle cx={cx} cy={cy} r={3.5} className="scr-plan-dial-pivot" />
        {/* Center pivot cap: a tiny machined highlight dot on the pivot. */}
        <circle cx={cx - 0.6} cy={cy - 0.6} r={1.1} className="scr-plan-dial-pivot-cap" />
      </svg>
      <p className="scr-plan-dial-label">{MACRO_LABEL[group]}</p>
    </div>
  );
}

export function AdherenceGauge({ week, cover, swaps, variant = FULL_VARIANT }: AdherenceGaugeProps) {
  const totals = weekTotals(week, cover, swaps, DAYS_PER_WEEK, variant);
  const weekBands = weekBand(week, cover, DAYS_PER_WEEK, variant);

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
