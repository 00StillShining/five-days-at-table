/**
 * src/screens/plan/gaugeParts.tsx — II.3.18's anatomy, re-keyed to RESTOMOD.
 *
 * The foundry fixes the geometry and RESTOMOD recolours it: "keeps every number
 * and re-keys every hue: face ivory, ticks and numerals engraved in heritage
 * green, the caution and redline bands re-keyed to this world's warning and
 * danger roles, the bench needle ink traded for orange" (ch.17 section 3).
 *
 * Every number below is II.3.18's own, for a face of radius R:
 *   arc      270 degrees, 135 -> 405, minimum at 7 o'clock, maximum at 5
 *   majors   12% of R long, 2px wide;  minors 6% of R, 1px
 *   both     end at 98% of R and grow INWARD
 *   labels   upright at 68% of R, never rotated along the arc
 *   zones    an arc band 6% of R wide at 91% of R, UNDER the ticks
 *   needle   tip at 82% of R, counterweight tail at 18%, hub 12% of R
 *
 * ---------------------------------------------------------------------------
 * WHY THE NUMERALS ARE HTML AND THE TICKS ARE SVG
 * ---------------------------------------------------------------------------
 * A <text> inside viewBox="0 0 200 200" is sized in USER UNITS, so its rendered
 * pixel size is font-size x (dial px / 200). At this row's outboard dial that
 * puts a 13px numeral at well under 8px, and II.6.11 is explicit: below
 * 0.6875rem type is TEXTURE, never information. There is no way to pin an svg
 * <text> to a real pixel size inside a scaled viewBox, so the ticks and zone
 * bands stay in SVG where they are pure geometry and SHOULD scale, and every
 * numeral leaves the viewBox as an HTML span placed by the same polar
 * arithmetic at 68% of R. (Measured on TODAY first; the same trap is here.)
 *
 * ---------------------------------------------------------------------------
 * THE NEEDLE READS BY ITS KEYLINE
 * ---------------------------------------------------------------------------
 * `--cd-needle` #E8590C measures 2.89:1 on this world's own ivory face — under
 * the 3:1 graphical floor — so the livery orange never carries the reading
 * alone. `--cd-needle-keyline` #1B1B1B runs the needle's whole length at
 * 13.91:1 on ivory and 4.81:1 against the orange itself, and section 2 already
 * gives the needle a 1px catch-light down its body, "fixed to the room rather
 * than to the needle's angle (II.2.4: texture rotates, light holds)".
 */

import { memo } from "react";

export const ARC_START = 135;
export const ARC_SWEEP = 270;
const CX = 100;
const CY = 100;
export const R = 100;

/** Polar placement on the arc. `f` is 0..1 along the sweep. */
export function polar(f: number, radius: number): [number, number] {
  const a = ((ARC_START + ARC_SWEEP * f) * Math.PI) / 180;
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
}

/** An arc band 6% of R wide at 91% of R, drawn UNDER the ticks (II.3.18). */
export function bandPath(from: number, to: number, radius = 0.91 * R): string {
  if (to <= from) return "";
  const [x0, y0] = polar(from, radius);
  const [x1, y1] = polar(to, radius);
  const large = (to - from) * ARC_SWEEP > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export const DialTicks = memo(function DialTicks({
  minors,
  majorEvery,
}: {
  minors: number;
  majorEvery: number;
}) {
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
  return <g className="pln-ticks">{out}</g>;
});

export interface DialLabel {
  at: number;
  text: string;
  /** THE WINK: the one numeral past the round number the run stops at. */
  wink?: boolean;
}

/** The engraved numerals, in real pixels, at 68% of R, upright (II.3.18). */
export const DialLabels = memo(function DialLabels({ labels }: { labels: DialLabel[] }) {
  return (
    <div className="pln-face-labels" aria-hidden="true">
      {labels.map((l) => {
        const [x, y] = polar(l.at, 0.68 * R);
        return (
          <span
            key={`${l.at}-${l.text}`}
            className="pln-face-label cd-data"
            data-pln-wink={l.wink ? "true" : undefined}
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
 * The needle. Tip 82% of R, counterweight tail 18% opposite, hub 12%.
 * `catch` is the needle's SIBLING, never its child — ch.17 section 3 is
 * explicit about the split, because a highlight parented to the needle would
 * rotate with it and stop being a reflection of a room that never moves.
 */
export const Needle = memo(function Needle({
  refEl,
  pinned,
}: {
  refEl: React.Ref<HTMLSpanElement>;
  pinned?: boolean;
}) {
  return (
    <>
      <span className="pln-needle" ref={refEl} data-pln-pinned={pinned ? "true" : "false"} aria-hidden="true">
        <span className="pln-needle-tip" />
        <span className="pln-needle-tail" />
      </span>
      <span className="pln-needle-catch" aria-hidden="true" />
      <span className="pln-needle-boss" aria-hidden="true" />
    </>
  );
});

/** The operator's own hairline reference mark on the arc (ch.17 section 3). */
export const MarkHair = memo(function MarkHair({ at }: { at: number }) {
  const [x1, y1] = polar(at, 0.99 * R);
  const [x2, y2] = polar(at, 0.72 * R);
  return (
    <line
      className="pln-mark"
      x1={x1.toFixed(2)}
      y1={y1.toFixed(2)}
      x2={x2.toFixed(2)}
      y2={y2.toFixed(2)}
    />
  );
});
