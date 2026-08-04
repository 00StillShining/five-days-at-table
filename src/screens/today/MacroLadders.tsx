import type { CSSProperties } from "react";
import type { Band, Macros } from "../../data/types";

export interface MacroLaddersProps {
  macros: Macros;
  /** bands() returns all five macro bands; only the four hero channels are read
   * (PLAN §6.3's console omits fibre — kcal/protein/fat/carb only). */
  bands: Record<"kcal" | "protein" | "fat" | "netCarb", Band>;
}

interface ChannelSpec {
  key: "kcal" | "protein" | "fat" | "netCarb";
  label: string; // silkscreen abbreviation, matches PLAN §6.3's worked example verbatim
  /** css var() reference for the channel's ON/hollow color, or null for kcal
   * (kcal is the day total, not one of the four --fd-ch-* macro channels). */
  channelVar: string | null;
  unitWord: string; // for the aria-label sentence
}

const CHANNELS: ChannelSpec[] = [
  { key: "kcal", label: "kcal", channelVar: null, unitWord: "kcal" },
  { key: "protein", label: "prot", channelVar: "var(--fd-ch-protein)", unitWord: "grams protein" },
  { key: "fat", label: "fat", channelVar: "var(--fd-ch-fat)", unitWord: "grams fat" },
  { key: "netCarb", label: "carb", channelVar: "var(--fd-ch-carb)", unitWord: "grams carb" },
];

const SEGMENTS = 20;

type SegState = "on" | "hollow" | "off";

/**
 * 20-segment fill + band-bracket position math (PLAN §6.3's "LED meter bridge").
 * The ladder's own scale (`scaleMax`) is headroom above the band's max so the
 * current value always has room to render on-scale even mid-overage — it never
 * invents a number, it's purely a display-scale derived from the real band +
 * value already computed by state/selectors.ts (dayMacros/bands). Segments at or
 * past the band-max position that are still lit (value has pushed past the
 * bracket) render "hollow" — an outline instead of a fill, i.e. a SHAPE cue for
 * over-band, not a color-only one; the exact `value/target` text beside the
 * ladder is the second, textual confirmation (Sol gauge rule).
 */
/** kcal -> whole number; protein/fat/netCarb -> at most one decimal, trimmed
 * when it's a whole number (matches dayMacros' own roundMacros precision — see
 * the Ladder-level comment on why this can't just be Math.round for every channel). */
function formatMacroNumber(value: number, isKcal: boolean): string {
  if (isKcal) return String(Math.round(value));
  const oneDp = Math.round(value * 10) / 10;
  return Number.isInteger(oneDp) ? String(oneDp) : oneDp.toFixed(1);
}

function segmentLayout(value: number, band: Band): { states: SegState[]; bandStart: number; bandEnd: number } {
  const [bandMin, bandMax] = band;
  const scaleMax = Math.max(bandMax * 1.3, value, bandMax + 1, 1);
  const filled = Math.min(SEGMENTS, Math.max(0, Math.round((value / scaleMax) * SEGMENTS)));
  const bandStart = Math.min(SEGMENTS, Math.max(0, Math.round((bandMin / scaleMax) * SEGMENTS)));
  const bandEnd = Math.min(SEGMENTS, Math.max(bandStart, Math.round((bandMax / scaleMax) * SEGMENTS)));
  const states: SegState[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    states.push(i >= filled ? "off" : i >= bandEnd ? "hollow" : "on");
  }
  return { states, bandStart, bandEnd };
}

interface LadderStyle extends CSSProperties {
  "--ladder-channel"?: string;
}

function Ladder({ spec, value, band }: { spec: ChannelSpec; value: number; band: Band }) {
  const { states, bandStart, bandEnd } = segmentLayout(value, band);
  // kcal is a whole number already (state/selectors.ts roundMacros); protein/fat/
  // netCarb keep one decimal — rounding those to a bare integer would occasionally
  // hide a real (if small) over-band reading, e.g. 145.4g against a 145g band max
  // would print as the misleadingly-exact "145/145" and silently contradict the
  // arbiter's own "over on protein" text for the same state. Exact value/target
  // text is the Sol gauge rule; it has to actually be exact.
  const displayValue = formatMacroNumber(value, spec.key === "kcal");
  const displayTarget = formatMacroNumber(band[1], spec.key === "kcal");
  const displayMin = formatMacroNumber(band[0], spec.key === "kcal");
  const overBand = value > band[1];
  const ariaLabel = `${spec.label} ${displayValue} of ${displayTarget} ${spec.unitWord} target, band ${displayMin} to ${displayTarget}${overBand ? ", over band" : ""}`;
  const style: LadderStyle = { "--ladder-channel": spec.channelVar ?? "var(--sol-text)" };

  return (
    <div className="scr-today-ladder">
      <span className="scr-today-ladder-label">{spec.label}</span>
      <div className="scr-today-ladder-graphic" role="img" aria-label={ariaLabel} style={style}>
        {states.map((s, i) => (
          <span key={i} className={`scr-today-seg scr-today-seg--${s}`} aria-hidden="true" />
        ))}
        <span
          className="scr-today-ladder-bracket"
          aria-hidden="true"
          style={{ gridColumn: `${bandStart + 1} / ${bandEnd + 2}` }}
        />
      </div>
      <span className="scr-today-ladder-value" aria-hidden="true">
        {displayValue}/{displayTarget}
      </span>
    </div>
  );
}

/** The hero (PLAN §6.3 / §6.10 "meter bridge"): four read-only gauges, never a
 * slider (Sol §4.4 Gauge grammar) — role="img" carries the exact value/range/status
 * sentence to assistive tech, and the same numbers sit in visible text beside every
 * ladder (Sol gauge rule: exact value/target text always present, not just on
 * hover/tap). No animated fill anywhere — reduced-motion has nothing to collapse
 * because there was never a transition to begin with (state changes are instant
 * React re-renders driven by real ticks/inventory writes, not a decorative sweep). */
export function MacroLadders({ macros, bands }: MacroLaddersProps) {
  return (
    <div className="scr-today-ladders">
      {CHANNELS.map((spec) => (
        <Ladder key={spec.key} spec={spec} value={macros[spec.key]} band={bands[spec.key]} />
      ))}
    </div>
  );
}
