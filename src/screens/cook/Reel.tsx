// COOK's hero — the reel (PLAN §6.6/§6.10: "rotating platter"; TP-7 quote,
// SOL-BRIEF §2: "state belongs to the control — reel motion IS program
// state; stopped-reel-as-alarm"). Spokes rotate via a single CSS animation on
// the wrapping <g data-motion> so tokens.css's global reduced-motion rule
// collapses it to a static frame for free (same pattern as PLAN's needle
// dial and the chassis's own pulsing dot/chevron).
//
// Phase 3 polish (cook.css): the platter/hub fills are now radial gradients
// (the "black platter" — TP-7 quote, D14) referenced from <defs> below, the
// spokes get a duplicated, offset, darker copy underneath for a machined
// shadow, and a separate CSS conic-gradient "sheen" layer (.scr-cook-reel-
// sheen) rotates WITH the platter using the exact same `scr-cook-spin`
// keyframe for a rotational light-play highlight. All of that lives inside
// `.scr-cook-reel-platter` so the paused state can dim it as one unit; the
// index dot and the (paused-only) brake mark sit OUTSIDE that group so they
// stay at full legibility/contrast as state indicators. None of this is new
// STATE — `spinning`/`stopped`/`dueNow`/paused are the same booleans as
// Phase 2, only the paint changes.
//
// The reel's motion is NEVER the only cue for anything: running/paused/due
// are each also named in the text readout beside it, and the step-due alarm
// additionally gets its own text banner (rendered by the caller) — see
// index.tsx's assembly and cook.css's comment block for the "exactly one red
// element" discipline (Sol §5.1 / PLAN §6.0 arbiter motif, quoted here even
// though COOK never renders the shared <ArbiterSlot> itself). The Phase 3
// due-state rim glow (cook.css) is a redundant amplification of that same
// already-present banner, never a standalone cue.
import { useId, type KeyboardEvent } from "react";
import { formatMinutesAsClock, formatScrubOffset } from "./format";

export type ReelStatus = "idle" | "running" | "paused" | "complete";

export interface ReelProps {
  title: string;
  /** Secondary line under the title — prep programs' authored prose
   * ("one session, ninety-five minutes, mostly waiting") lives here now
   * that `title` itself is a proper name ("Week A Sunday session"), not
   * that prose (coordinator FIX round, item 2). Omitted for meal programs. */
  subtitle?: string;
  elapsedMin: number;
  totalMin: number;
  status: ReelStatus;
  dueNow: boolean;
  scrubOffsetMinutes: number;
  scrubBoundMinutes: number;
  onScrubStep: (deltaMinutes: number) => void;
  onScrubReset: () => void;
}

const SPOKE_COUNT = 12;

/** `shadow` renders the darker, offset duplicate drawn underneath the real
 * spokes (Phase 3 polish — "machined spoke shadows"); both copies live
 * inside the same rotating <g> so they turn together as one unit. */
function Spokes({ shadow = false }: { shadow?: boolean }) {
  const spokes = [];
  for (let i = 0; i < SPOKE_COUNT; i++) {
    const angle = (360 / SPOKE_COUNT) * i;
    spokes.push(
      <line
        key={i}
        x1={50}
        y1={50}
        x2={50}
        y2={14}
        className={shadow ? "scr-cook-reel-spoke-shadow" : "scr-cook-reel-spoke"}
        transform={`rotate(${angle} 50 50)`}
      />
    );
  }
  return <>{spokes}</>;
}

export function Reel({
  title,
  subtitle,
  elapsedMin,
  totalMin,
  status,
  dueNow,
  scrubOffsetMinutes,
  scrubBoundMinutes,
  onScrubStep,
  onScrubReset,
}: ReelProps) {
  const labelId = useId();
  const spinning = status === "running" && !dueNow;
  const stopped = !spinning; // idle, paused, complete, OR the due-alarm freeze

  function onScrubKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        onScrubStep(-1);
        break;
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        onScrubStep(1);
        break;
      case "Home":
      case "Escape":
        e.preventDefault();
        onScrubReset();
        break;
      default:
        break;
    }
  }

  return (
    <div className="scr-cook-hero">
      <div
        className={`scr-cook-reel${dueNow ? " scr-cook-reel--due" : ""}${status === "paused" ? " scr-cook-reel--paused" : ""}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 100" className="scr-cook-reel-svg" focusable="false">
          <defs>
            {/* Paint servers only — no behavior. Referenced from cook.css via
                `fill: url(#id) <fallback-color>`; forced-colors overrides
                `fill` outright further down (cook.css), same pattern as the
                knob's dot gradient in meal.css. */}
            <radialGradient id="ck-platter-grad" cx="40%" cy="35%" r="75%">
              <stop offset="0%" stopColor="var(--ck-platter-hi)" />
              <stop offset="58%" stopColor="var(--sol-panel)" />
              <stop offset="100%" stopColor="var(--ck-platter-lo)" />
            </radialGradient>
            <radialGradient id="ck-hub-grad" cx="42%" cy="36%" r="80%">
              <stop offset="0%" stopColor="var(--sol-panel)" />
              <stop offset="45%" stopColor="var(--ck-hub-lo)" />
              <stop offset="100%" stopColor="var(--ck-hub-lo)" />
            </radialGradient>
          </defs>
          {/* Dims as one unit when paused; the index dot + brake mark below
              stay outside so they keep full contrast as state indicators. */}
          <g className="scr-cook-reel-platter">
            <circle cx={50} cy={50} r={47} className="scr-cook-reel-rim" />
            <g className={spinning ? "scr-cook-reel-spin" : undefined} data-motion>
              <g className="scr-cook-reel-spoke-shadow-layer" transform="translate(0.7 0.9)">
                <Spokes shadow />
              </g>
              <Spokes />
            </g>
            <circle cx={50} cy={50} r={16} className="scr-cook-reel-hub" />
          </g>
          <circle cx={50} cy={22} r={3.2} className={`scr-cook-reel-index${dueNow ? " scr-cook-reel-index--due" : ""}`} />
          {/* Visible brake (Phase 3 polish): a caliper mark straddling the
              rim edge, shown only while paused — redundant with the dashed
              rim + the "❚❚" glyph, never the sole cue. */}
          <rect x={93} y={47} width={6} height={6} className="scr-cook-reel-brake" />
        </svg>
        {/* Rotational light-play: a CSS conic sheen that spins WITH the
            platter using the identical `scr-cook-spin` keyframe/duration as
            the spokes above — same animation, richer face. [data-motion]
            lets tokens.css's global reduced-motion rule freeze it for free. */}
        <div
          className={spinning ? "scr-cook-reel-sheen scr-cook-reel-sheen-spin" : "scr-cook-reel-sheen"}
          data-motion
        />
        <span className="scr-cook-reel-glyph">{dueNow ? "!" : status === "paused" ? "❚❚" : stopped && status !== "complete" ? "○" : "●"}</span>
      </div>

      <div className="scr-cook-hero-readout">
        <p id={labelId} className="scr-cook-hero-title">
          {title}
        </p>
        {subtitle && <p className="scr-cook-hero-subtitle">{subtitle}</p>}
        <p className="scr-cook-hero-clock">
          <span className="scr-cook-hero-clock-elapsed">{formatMinutesAsClock(elapsedMin)}</span>
          <span aria-hidden="true"> / </span>
          <span className="scr-cook-hero-clock-total">{formatMinutesAsClock(totalMin)}</span>
        </p>
      </div>

      <div
        className="scr-cook-scrub"
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-roledescription="preview scrub"
        aria-valuemin={-scrubBoundMinutes}
        aria-valuemax={scrubBoundMinutes}
        aria-valuenow={scrubOffsetMinutes}
        aria-valuetext={scrubOffsetMinutes === 0 ? "now, no preview" : `previewing ${formatScrubOffset(scrubOffsetMinutes)}`}
        onKeyDown={onScrubKeyDown}
      >
        <button
          type="button"
          className="fd5-control scr-cook-scrub-step"
          aria-label="preview one minute earlier"
          onClick={() => onScrubStep(-1)}
          disabled={scrubOffsetMinutes <= -scrubBoundMinutes}
        >
          {"◂"}
        </button>
        <span className="scr-cook-scrub-readout">
          {scrubOffsetMinutes === 0 ? "now" : formatScrubOffset(scrubOffsetMinutes)}
        </span>
        <button
          type="button"
          className="fd5-control scr-cook-scrub-step"
          aria-label="preview one minute later"
          onClick={() => onScrubStep(1)}
          disabled={scrubOffsetMinutes >= scrubBoundMinutes}
        >
          {"▸"}
        </button>
        {scrubOffsetMinutes !== 0 && (
          <button type="button" className="fd5-control scr-cook-scrub-reset" onClick={onScrubReset}>
            back to now
          </button>
        )}
      </div>
    </div>
  );
}
