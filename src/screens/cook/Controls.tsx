// COOK's control surface (PLAN §6.6): "`done ▸` = the whole bottom edge
// (>=72px tall) advancing the current step; `+1 min` extends the current
// timer (>=56px); hold-to-pause in the opposite corner (hold ~600ms with
// visible progress + an accessible plain-tap alternative — no hold-only
// meaning; e.g. tap opens a 2-button pause/resume popover). ALL COOK
// controls >=56px (wet hands)."
//
// Design split, since the mock only shows the RUNNING layout: the bottom
// edge always carries the single big "next obvious thing" (start / done /
// resume), so it never has to be half-disabled; pausing itself lives ONLY in
// the corner control (hold, or tap for the 2-button popover) — resuming is
// reachable both ways (the edge's own "resume" AND the corner popover),
// which is deliberate redundancy, not a spec conflict.
import { useEffect, useRef, useState } from "react";

export type PrimaryAction = { label: string; onActivate: () => void; disabled?: boolean };

export interface ControlsProps {
  primary: PrimaryAction;
  showPlusOneMinute: boolean;
  plusOneMinuteDisabled?: boolean;
  onPlusOneMinute: () => void;
  canPause: boolean; // status === "running"
  canResume: boolean; // status === "paused"
  onPause: () => void;
  onResume: () => void;
}

const HOLD_MS = 600;

/** tokens.css's global `[data-motion]` rule only neutralises CSS
 * animations/transitions — it cannot stop a JS-driven per-frame style
 * mutation, which is exactly what the requestAnimationFrame progress fill
 * below is. So reduced-motion is checked here directly: under it, the hold
 * still functionally times out at HOLD_MS (the gesture itself isn't
 * motion), but the visual becomes one instant state swap (0 -> full) rather
 * than a continuously animating fill, per PLAN §6.1's reduced-motion rule. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function HoldToPause({ canPause, canResume, onPause, onResume }: Pick<ControlsProps, "canPause" | "canResume" | "onPause" | "onResume">) {
  const [holdProgress, setHoldProgress] = useState(0);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const canToggle = canPause || canResume;

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
  }, []);

  function toggle() {
    if (canPause) onPause();
    else if (canResume) onResume();
  }

  function endHold() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setHoldProgress(0);
  }

  function startHold() {
    if (!canToggle) return;
    firedRef.current = false;

    if (prefersReducedMotion()) {
      setHoldProgress(1); // one instant state swap, no continuous fill
      timeoutRef.current = setTimeout(() => {
        firedRef.current = true;
        toggle();
        endHold();
      }, HOLD_MS);
      return;
    }

    holdStartRef.current = performance.now();
    const tick = () => {
      const started = holdStartRef.current;
      if (started == null) return;
      const progress = Math.min(1, (performance.now() - started) / HOLD_MS);
      setHoldProgress(progress);
      if (progress >= 1) {
        firedRef.current = true;
        toggle();
        endHold();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function handlePointerUp() {
    endHold();
  }

  function handleClick() {
    if (firedRef.current) {
      // The hold already fired the toggle on this same press — the browser's
      // synthetic click that follows pointerup is not a second, separate
      // request (would otherwise immediately re-toggle back).
      firedRef.current = false;
      return;
    }
    setPopoverOpen((v) => !v);
  }

  // Neither canPause nor canResume while idle/complete (the control is
  // disabled then) — default the inert label/glyph to "pause" rather than
  // "resume" so a screen reader landing on the disabled button before a
  // program has ever started doesn't announce a misleading "resume".
  const actionLabel = canResume ? "resume" : "pause";

  return (
    <div className="scr-cook-holdwrap">
      <button
        type="button"
        className="fd5-control scr-cook-hold"
        disabled={!canToggle}
        aria-label={`${actionLabel} (tap for options, or press and hold)`}
        aria-haspopup="true"
        aria-expanded={popoverOpen}
        onPointerDown={startHold}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
      >
        <span className="scr-cook-hold-progress" style={{ transform: `scaleY(${holdProgress})` }} aria-hidden="true" />
        <span className="scr-cook-hold-glyph" aria-hidden="true">
          {canResume ? "▸" : "❚❚"}
        </span>
      </button>

      {popoverOpen && (
        <div className="scr-cook-hold-popover" role="menu">
          <button
            type="button"
            role="menuitem"
            className="fd5-control scr-cook-hold-popover-btn"
            disabled={!canToggle}
            onClick={() => {
              toggle();
              setPopoverOpen(false);
            }}
          >
            {actionLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            className="fd5-control scr-cook-hold-popover-btn"
            onClick={() => setPopoverOpen(false)}
          >
            cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function Controls({
  primary,
  showPlusOneMinute,
  plusOneMinuteDisabled,
  onPlusOneMinute,
  canPause,
  canResume,
  onPause,
  onResume,
}: ControlsProps) {
  return (
    <>
      <HoldToPause canPause={canPause} canResume={canResume} onPause={onPause} onResume={onResume} />
      <div className="scr-cook-bottombar">
        {showPlusOneMinute && (
          <button
            type="button"
            className="fd5-control scr-cook-plusone"
            onClick={onPlusOneMinute}
            disabled={plusOneMinuteDisabled}
          >
            +1 min
          </button>
        )}
        <button
          type="button"
          className="fd5-control scr-cook-done"
          onClick={primary.onActivate}
          disabled={primary.disabled}
        >
          {primary.label}
        </button>
      </div>
    </>
  );
}
