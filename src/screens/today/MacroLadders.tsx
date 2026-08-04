import type { CSSProperties } from "react";
import type { Band, Macros } from "../../data/types";

export interface MacroLaddersProps {
  /** eatenSoFar(...) — sum of the day's TICKED slots only (wave-1 fix: the
   * ladder used to show the full planned day regardless of what had actually
   * been eaten, which agreed with neither the clock nor the arbiter). */
  eaten: Macros;
  /** dayMacros(..., swaps) — the day's PLANNED total, swaps-aware. This is
   * the ladder's "target" text now, not the band's max (a day's plan sits at
   * a specific point, not at the edge of the whole week's band). */
  planned: Macros;
  /** bands() returns all five macro bands; only the four hero channels are read
   * (PLAN §6.3's console omits fibre — kcal/protein/fat/carb only). Still drives
   * the band bracket and the over-band/hollow-segment state — "over" means
   * over the WEEK's band, not over today's particular planned total. */
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
/** item-4 fix: a band bracket narrower than this (in grid columns) reads as a
 * stray hairline rather than a deliberate span marker — force at least this
 * many columns of visual width regardless of how narrow the band is relative
 * to the ladder's scale (kcal's band is the worst case: ~80 kcal wide against
 * a >2000 kcal scale rounds to a single column without this floor). */
const MIN_BRACKET_SPAN = 1; // bandEnd - bandStart, in segment indices (-> 2 grid columns wide)

type SegState = "on" | "hollow" | "off";

/** kcal -> whole number; protein/fat/netCarb -> at most one decimal, trimmed
 * when it's a whole number (matches dayMacros'/eatenSoFar's own roundMacros
 * precision — see the Ladder-level comment on why this can't just be
 * Math.round for every channel). */
function formatMacroNumber(value: number, isKcal: boolean): string {
  if (isKcal) return String(Math.round(value));
  const oneDp = Math.round(value * 10) / 10;
  return Number.isInteger(oneDp) ? String(oneDp) : oneDp.toFixed(1);
}

/**
 * 20-segment fill + band-bracket position math (PLAN §6.3's "LED meter bridge").
 * `value` (eaten so far) drives the fill; `band` (the week's macro band) drives
 * the bracket AND the over-band/hollow state; `target` (today's planned total)
 * only ever widens the scale so a big planned day doesn't make eaten progress
 * look artificially close to full — it never determines fill or hollow on its
 * own. Segments at or past the band-max position that are still lit render
 * "hollow" — an outline instead of a fill, i.e. a SHAPE cue for over-band, not
 * a color-only one; the exact `value/target` text beside the ladder is the
 * second, textual confirmation (Sol gauge rule).
 */
function segmentLayout(value: number, target: number, band: Band): { states: SegState[]; bandStart: number; bandEnd: number } {
  const [bandMin, bandMax] = band;
  const scaleMax = Math.max(bandMax * 1.3, target * 1.1, value, bandMax + 1, 1);
  const filled = Math.min(SEGMENTS, Math.max(0, Math.round((value / scaleMax) * SEGMENTS)));
  const bandStartRaw = Math.min(SEGMENTS, Math.max(0, Math.round((bandMin / scaleMax) * SEGMENTS)));
  let bandEnd = Math.min(SEGMENTS, Math.max(bandStartRaw, Math.round((bandMax / scaleMax) * SEGMENTS)));
  let bandStart = bandStartRaw;
  if (bandEnd - bandStart < MIN_BRACKET_SPAN) {
    // Widen outward when there's room past bandEnd; otherwise pull bandStart
    // back instead (keeps the bracket from overrunning the 20-segment strip).
    if (bandEnd < SEGMENTS) bandEnd = bandStart + MIN_BRACKET_SPAN;
    else bandStart = Math.max(0, bandEnd - MIN_BRACKET_SPAN);
  }

  const states: SegState[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    states.push(i >= filled ? "off" : i >= bandEnd ? "hollow" : "on");
  }
  // item-3 fix: a REAL overage (value > bandMax) must always show at least one
  // hollow segment, even when rounding put `filled` and `bandEnd` on the same
  // index (e.g. 145.4 eaten against a 145 band max — both round to segment 15
  // on a wide scale, so the loop above never produces a hollow segment even
  // though the arbiter is independently reporting "over on protein" in text).
  // Without this, a genuine over-band state and a right-at-the-edge state are
  // visually identical, which is exactly the ambiguity the shape cue exists
  // to prevent.
  if (value > bandMax && filled > 0) {
    states[filled - 1] = "hollow";
  }
  return { states, bandStart, bandEnd };
}

interface LadderStyle extends CSSProperties {
  "--ladder-channel"?: string;
}

function Ladder({ spec, value, target, band }: { spec: ChannelSpec; value: number; target: number; band: Band }) {
  const { states, bandStart, bandEnd } = segmentLayout(value, target, band);
  const isKcal = spec.key === "kcal";
  // kcal is a whole number already (state/selectors.ts roundMacros); protein/fat/
  // netCarb keep one decimal — rounding those to a bare integer would occasionally
  // hide a real (if small) over-band reading, e.g. 145.4g against a 145g band max
  // would print as the misleadingly-exact "145/145" and silently contradict the
  // arbiter's own "over on protein" text for the same state. Exact value/target
  // text is the Sol gauge rule; it has to actually be exact.
  const displayValue = formatMacroNumber(value, isKcal);
  const displayTarget = formatMacroNumber(target, isKcal);
  const displayBandMin = formatMacroNumber(band[0], isKcal);
  const displayBandMax = formatMacroNumber(band[1], isKcal);
  const overBand = value > band[1];
  const ariaLabel = `${spec.label} ${displayValue} eaten of ${displayTarget} planned ${spec.unitWord}, week band ${displayBandMin} to ${displayBandMax}${overBand ? ", over band" : ""}`;
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
export function MacroLadders({ eaten, planned, bands }: MacroLaddersProps) {
  return (
    <div className="scr-today-ladders">
      {CHANNELS.map((spec) => (
        <Ladder key={spec.key} spec={spec} value={eaten[spec.key]} target={planned[spec.key]} band={bands[spec.key]} />
      ))}
    </div>
  );
}
