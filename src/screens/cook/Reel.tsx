// COOK's hero — the reel (PLAN §6.6/§6.10: "rotating platter"; TP-7 quote,
// SOL-BRIEF §2: "state belongs to the control — reel motion IS program
// state; stopped-reel-as-alarm"). Flat SVG only (no gradients/metal — Phase 2
// law; Phase 3 machines it), spokes rotate via a single CSS animation on the
// wrapping <g data-motion> so tokens.css's global reduced-motion rule
// collapses it to a static frame for free (same pattern as PLAN's needle
// dial and the chassis's own pulsing dot/chevron).
//
// The reel's motion is NEVER the only cue for anything: running/paused/due
// are each also named in the text readout beside it, and the step-due alarm
// additionally gets its own text banner (rendered by the caller) — see
// index.tsx's assembly and cook.css's comment block for the "exactly one red
// element" discipline (Sol §5.1 / PLAN §6.0 arbiter motif, quoted here even
// though COOK never renders the shared <ArbiterSlot> itself).
import { useId, type KeyboardEvent } from "react";
import { formatMinutesAsClock, formatScrubOffset } from "./format";

export type ReelStatus = "idle" | "running" | "paused" | "complete";

export interface ReelProps {
  title: string;
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

function Spokes() {
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
        className="scr-cook-reel-spoke"
        transform={`rotate(${angle} 50 50)`}
      />
    );
  }
  return <>{spokes}</>;
}

export function Reel({
  title,
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
          <circle cx={50} cy={50} r={47} className="scr-cook-reel-rim" />
          <g className={spinning ? "scr-cook-reel-spin" : undefined} data-motion>
            <Spokes />
          </g>
          <circle cx={50} cy={50} r={16} className="scr-cook-reel-hub" />
          <circle cx={50} cy={22} r={3.2} className={`scr-cook-reel-index${dueNow ? " scr-cook-reel-index--due" : ""}`} />
        </svg>
        <span className="scr-cook-reel-glyph">{dueNow ? "!" : status === "paused" ? "❚❚" : stopped && status !== "complete" ? "○" : "●"}</span>
      </div>

      <div className="scr-cook-hero-readout">
        <p id={labelId} className="scr-cook-hero-title">
          {title}
        </p>
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
