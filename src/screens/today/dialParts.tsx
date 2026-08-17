/**
 * src/screens/today/dialParts.tsx — the parts both porthole gauges are cut from.
 *
 * ---------------------------------------------------------------------------
 * WHY THE NUMERALS ARE HTML AND THE TICKS ARE SVG
 * ---------------------------------------------------------------------------
 * Found by measuring the rendered page, not by reading the code: a `<text>`
 * inside a `viewBox="0 0 200 200"` svg is sized in USER UNITS, so its rendered
 * pixel size is `font-size x (dial px / 200)`. At the desk dial's 243px that
 * put the tick numerals at 13.4px; at the two-column tablet dial's 152px it put
 * them at 8.4px, and II.6.11 is explicit — "below 0.6875rem type is TEXTURE,
 * never information". A dial whose engraved numerals stop being information at
 * one breakpoint is a dial with no scale on it.
 *
 * There is no way to pin an svg `<text>` to a real pixel size inside a scaled
 * viewBox, so the numerals leave the viewBox: ticks and zone bands stay in SVG,
 * where they are pure geometry and SHOULD scale, and every numeral becomes an
 * HTML span positioned by the same polar arithmetic at 68% of R — II.3.18's own
 * placement, "set upright at 68% of R, never rotated along the arc".
 */

import { memo } from "react";

/** II.3.18 — the arc: 270 degrees, minimum at 7 o'clock, maximum at 5 o'clock. */
export const ARC_START_SVG = 135;
export const ARC_SWEEP_SVG = 270;
const CX = 100;
const CY = 100;
export const R = 100;

export function polar(fraction: number, radius: number): [number, number] {
  const a = ((ARC_START_SVG + ARC_SWEEP_SVG * fraction) * Math.PI) / 180;
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
}

/** An arc band 6% of R wide at 91% of R, drawn UNDER the ticks (II.3.18). */
export function bandPath(from: number, to: number, radius = 0.91 * R): string {
  if (to <= from) return "";
  const [x0, y0] = polar(from, radius);
  const [x1, y1] = polar(to, radius);
  const large = (to - from) * ARC_SWEEP_SVG > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export interface TickSpec {
  /** How many intervals the minor ticks divide the arc into. */
  minors: number;
  /** Every nth minor is a major. */
  majorEvery: number;
}

/**
 * II.3.18's tick geometry, generalised off its 0-100 worked example: majors 12%
 * of R long at 2px, minors 6% at 1px, both ending at 98% of R and growing
 * inward.
 */
export const DialTicks = memo(function DialTicks({ minors, majorEvery }: TickSpec) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i <= minors; i++) {
    const t = i / minors;
    const major = i % majorEvery === 0;
    const r1 = 0.98 * R;
    const r2 = r1 - R * (major ? 0.12 : 0.06);
    const [x1, y1] = polar(t, r1);
    const [x2, y2] = polar(t, r2);
    out.push(
      <line
        key={i}
        x1={x1.toFixed(2)}
        y1={y1.toFixed(2)}
        x2={x2.toFixed(2)}
        y2={y2.toFixed(2)}
        strokeWidth={major ? 2 : 1}
      />
    );
  }
  return <g className="tdy-ticks">{out}</g>;
});

export interface DialLabel {
  /** 0..1 along the arc. */
  at: number;
  text: string;
}

/** The engraved numerals, in real pixels, at 68% of R, upright. */
export const DialLabels = memo(function DialLabels({ labels }: { labels: DialLabel[] }) {
  return (
    <div className="tdy-face-labels" aria-hidden="true">
      {labels.map((l) => {
        const [x, y] = polar(l.at, 0.68 * R);
        return (
          <span
            key={`${l.at}-${l.text}`}
            className="tdy-face-label cd-data"
            style={{ left: `${(x / 2).toFixed(2)}%`, top: `${(y / 2).toFixed(2)}%` }}
          >
            {l.text}
          </span>
        );
      })}
    </div>
  );
});

/**
 * The needle. Tip at 82% of R, counterweight tail at 18% on the opposite side,
 * hub at 12% — II.3.18's anatomy, with the hub cut as an ANNULUS so the
 * porthole at the pivot stays visible through it.
 */
export const Needle = memo(function Needle({
  refEl,
  parked,
}: {
  refEl: React.Ref<HTMLSpanElement>;
  parked?: boolean;
}) {
  return (
    <span className="tdy-needle" ref={refEl} data-tdy-parked={parked ? "true" : "false"} aria-hidden="true">
      <span className="tdy-needle-tip" />
      <span className="tdy-needle-tail" />
      <span className="tdy-needle-boss" />
    </span>
  );
});
