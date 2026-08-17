/**
 * src/cd/chassis/GlyphField.tsx — 13 BACK CHANNEL's readout.
 *
 * Section 3: "everything this world reports draws as one of three coded shapes
 * on the same lattice — a fill, a sweep, or a stepped bar — never as an icon,
 * never as a word ... every live-but-unaddressed cell resting at the palette's
 * own glyph-off value, #8A8A8A, so an IDLE LATTICE STILL READS AS HARDWARE
 * rather than a void."
 *
 * Section 9's first failure mode is "THE TALKING FIELD — the lattice renders an
 * icon or pictogram instead of a fill, sweep, or step." The owner's brief names
 * the same thing for the chassis specifically: no nav pictograms on the
 * lattice. Nothing in this component can draw one: it takes a `GlyphPattern`,
 * and there is no path from a string to a cell.
 *
 * ---------------------------------------------------------------------------
 * DOM CELLS, NOT CANVAS — and the reason is not preference
 * ---------------------------------------------------------------------------
 * The chapter's own worked example paints the lattice on a canvas. This build
 * uses one <i> per cell instead, for four reasons that are all Floor reasons:
 *
 *   1. FORCED COLOURS. A canvas is a bitmap; the OS palette cannot re-key it,
 *      so a high-contrast user gets a dark rectangle. DOM cells re-key.
 *   2. THE DPR BUG CLASS. The foundation's own five-pass critique found a
 *      texture factory that returned null in every real browser because
 *      OffscreenCanvas has no synchronous toDataURL. A lattice of divs has no
 *      such class of failure to find.
 *   3. SQUINT AND STATIC EQUIVALENCE. Cells that are real elements survive an
 *      8px blur test and a desaturation pass identically to the rest of the
 *      screen, rather than as a separately-composited layer.
 *   4. COST. The rail's field is 49 nodes and the tray's is 625, both static
 *      between reports. II.2.22's canvas tier is for "texture unique per
 *      instance or tracking state per frame" — this is neither.
 *
 * ---------------------------------------------------------------------------
 * THE FIGURE IS NOT OPTIONAL
 * ---------------------------------------------------------------------------
 * CORRECTIONARY 4: "every live reading shows its EXACT FIGURE and its age."
 * Section 3, on the Signature rung: "the single reserved figure keeps its place
 * beside the field, because ANALOG WITHOUT THE FIGURE IS DECORATION."
 * `figure` is therefore a required prop. A caller physically cannot render the
 * coarse pattern without the exact number it encodes.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { PITCH_REM, GAP_REM, renderPattern, type GlyphPattern } from "./glyph";
import "./chassis.css";

export interface GlyphFieldProps {
  /** Grid resolution. 7 at rail scale, 25 at Close Read scale. */
  n: number;
  /** Circular mask radius, in cells. See glyph.ts for the committed pairs. */
  radius: number;
  pattern: GlyphPattern;
  /** The EXACT figure the pattern encodes. Compulsory (see above). */
  figure: string;
  /** The unit, trailing at 40% of the value's size (II.6.6). */
  unit?: string;
  /** What the field reports, in words, for assistive tech and for the squint. */
  label: string;
  /**
   * The newest boundary gets one frame at #FFFFFF before settling to lit
   * (section 3's Signature escalation). True only while that frame is fresh.
   */
  freshBoundary?: boolean;
  /**
   * The reading has stopped updating. II.3.18's state set for a display:
   * "stale (no data: needle HOLDS POSITION, ink to 55%, stale lamp lit — the
   * needle never invents motion)". Here the pattern holds exactly as it was and
   * the lit cells decay to the dim floor, which is 13 BACK CHANNEL section 3's
   * own Signature freshness idiom: "freshness reads in the same light the
   * pattern itself is made from, never in a second printed fact."
   * The WORD still prints, because II.7.7 will not let a state travel alone.
   */
  stale?: boolean;
  /** The declared word for this reading's class — e.g. FRESHNESS.timer's. */
  staleWord?: string;
  /** The reading's exact age, printed beside the word. */
  age?: string;
  /** Field edge length. Defaults to n * 0.40rem — the chapter's own pitch. */
  size?: string;
  /** Type step for the printed figure. Default --cd-size-4 (20px). */
  figureSize?: string;
  className?: string;
}

export function GlyphField({
  n,
  radius,
  pattern,
  figure,
  unit,
  label,
  freshBoundary = false,
  stale = false,
  staleWord,
  age,
  size,
  figureSize,
  className,
}: GlyphFieldProps) {
  const cells = useMemo(
    () => renderPattern(n, radius, pattern, freshBoundary),
    [n, radius, pattern, freshBoundary]
  );
  const anyLit = useMemo(() => cells.some((c) => c === "lit" || c === "hot"), [cells]);

  /*
    MASS TRACKS CONSEQUENCE (section 5). "A cell's bloom is Light, the fastest
    spring in the set — a report lagging its own pattern lies about when the
    thing happened. A field re-composing — a fill swapping for a sweep — is
    WEIGHTED: a bigger change earns a bigger settle."

    So the two are different events and get different springs. An ordinary cell
    rise runs Light, spring(0.7,420,25), 180ms. A whole-field re-composition —
    the pattern KIND changing — runs Weighted, spring(1.4,260,30), 300ms, for
    exactly that one transition. The flag clears on its own settle window so
    nothing is left stuck in the heavy dialect.
  */
  const lastKind = useRef(pattern.kind);
  const [recomposing, setRecomposing] = useState(false);
  useEffect(() => {
    if (pattern.kind === lastKind.current) return;
    lastKind.current = pattern.kind;
    setRecomposing(true);
    // 300ms is --cd-settle-weighted's committed value; read from the element so
    // prefers-reduced-motion's own re-timing is honoured rather than bypassed.
    const settle =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--cd-settle-weighted")
      ) || 300;
    const id = window.setTimeout(() => setRecomposing(false), settle);
    return () => window.clearTimeout(id);
  }, [pattern.kind]);

  const style = {
    "--cd-glyph-n": String(n),
    "--cd-glyph-size": size ?? `${(n * PITCH_REM).toFixed(2)}rem`,
    "--cd-glyph-gap-ratio": String(GAP_REM / PITCH_REM),
  } as React.CSSProperties;

  return (
    <span className={["cd-glyphset", className].filter(Boolean).join(" ")}>
      <span
        className="cd-glyphfield"
        style={style}
        data-cd-lit={anyLit ? "true" : "false"}
        data-cd-stale={stale ? "true" : undefined}
        data-cd-recompose={recomposing ? "true" : undefined}
        role="img"
        aria-label={
          stale
            ? `${label}: ${figure}${unit ? " " + unit : ""} — ${staleWord ?? "stale"}, ${age ?? "unknown age"}`
            : `${label}: ${figure}${unit ? " " + unit : ""}`
        }
      >
        {cells.map((state, i) => (
          <i key={i} className="cd-glyphcell" data-cd-cell={state} aria-hidden="true" />
        ))}
      </span>
      {/* THE FIGURE. Printed (II.6.9), tabular lining slashed-zero (II.6.4),
          on the world's own ink plate (CD-BRIEF ruling 5), never raw on the
          smoked-glass field. */}
      <span
        className="cd-glyphfigure cd-plate cd-printed"
        data-cd-surface="data"
        style={figureSize ? ({ fontSize: figureSize } as React.CSSProperties) : undefined}
        aria-hidden="true"
      >
        {figure}
        {unit ? <span className="cd-unit">{unit}</span> : null}
      </span>
      {/* The state word, printed. Never a colour or a dimming alone. */}
      {stale && staleWord ? (
        <span className="cd-glyphstale cd-silkscreen" aria-hidden="true">
          {staleWord}
          {age ? <span className="cd-glyphage cd-printed"> {age}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
