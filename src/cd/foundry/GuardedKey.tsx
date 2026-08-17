/**
 * src/cd/foundry/GuardedKey.tsx — II.3.17, the guarded switch.
 *
 * CORRECTIONARY 4 keeps this in full force: "Guarded switch (hold-to-arm with a
 * VISIBLE LINEAR FILL) for anything consequential."
 *
 * screencraft/02 supplies the rest of the grammar: "the guard opens on one act,
 * the destructive control commits on a second, and the guard's own RUN-OUT
 * closes it again after 4000ms of neglect. A danger zone that reads like the
 * rest of the form is a trap wearing a settings label." And: "A destructive
 * button that fires on a single press has skipped the interlock and kept only
 * the hazard stripes."
 *
 * 13 BACK CHANNEL's own Answer Key sets the hold at 350ms (section 3: "the
 * latch (II.3.16: 350ms linear-fill hold to arm) for a long one"), Anchored
 * mass — spring(1.2, 300, 38), 0% overshoot, ALWAYS, because "a committed
 * recording cannot be un-committed by a spring changing its mind."
 *
 * THE FILL IS A REAL CLOCK, NOT AN ANIMATION. It is driven from
 * performance.now() inside a rAF loop, so releasing at 200ms leaves the fill at
 * 57% and it falls back from there. A CSS animation would have completed out of
 * habit after the hand left, which II.4.15 forbids outright: "a new press
 * mid-arm cancels the fill AT ONCE."
 *
 * Two acts, and both are keyboard-complete: hold Enter or Space to arm, press
 * again to commit.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import "./foundry.css";

/** II.3.16 / section 3 — the hold that arms. */
export const ARM_HOLD_MS = 350;

/** screencraft/02 — the guard closes again after this much neglect. */
export const GUARD_RUNOUT_MS = 4000;

export interface GuardedKeyProps {
  /** Fires only on the SECOND act, once armed. */
  onCommit: () => void;
  /** The word before arming. Names the guard, not the consequence. */
  armLabel: string;
  /** The word once armed. Names the CONSEQUENCE, plainly. */
  commitLabel: string;
  /** The exact consequence, printed. A dialog "opens with the consequence". */
  consequence: string;
  disabled?: boolean;
  className?: string;
}

export function GuardedKey({
  onCommit,
  armLabel,
  commitLabel,
  consequence,
  disabled,
  className,
}: GuardedKeyProps) {
  const [armed, setArmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdStart = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const runout = useRef<number | null>(null);
  /**
   * The hold's generation. Every begin bumps it; every in-flight tick carries
   * the generation it was scheduled under and does nothing if that generation
   * is no longer current.
   *
   * cancelAnimationFrame alone is not enough for a switch that arms a
   * consequence: a callback already dispatched for this frame still runs, and
   * a throttled or backgrounded tab can deliver a very late one carrying a
   * `now` far past the threshold. Without the generation, that stale tick
   * would arm the guard AFTER the hand had let go — II.4.15's own rule stated
   * for a latch: "a new press mid-arm cancels the fill AT ONCE", and nothing
   * finishes out of respect for its own past.
   */
  const generation = useRef(0);

  const stopHold = useCallback(() => {
    generation.current += 1;
    holdStart.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setProgress(0);
  }, []);

  const beginHold = useCallback(() => {
    if (disabled || armed) return;
    generation.current += 1;
    const mine = generation.current;
    holdStart.current = performance.now();
    const tick = (now: number) => {
      if (generation.current !== mine || holdStart.current === null) return;
      const p = Math.min(1, (now - holdStart.current) / ARM_HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        holdStart.current = null;
        frame.current = null;
        setProgress(0);
        setArmed(true);
        // II.5.6 — the latch speaks twice, throw then seat 48ms apart, 100ms
        // total, "felt in the vibration rather than announced loudly".
        navigator.vibrate?.([12, 36, 52]);
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [disabled, armed]);

  // The run-out. An armed guard left alone closes itself; a hazard that stays
  // open indefinitely is not a guard, it is a delay.
  useEffect(() => {
    if (!armed) return;
    runout.current = window.setTimeout(() => setArmed(false), GUARD_RUNOUT_MS);
    return () => {
      if (runout.current !== null) window.clearTimeout(runout.current);
    };
  }, [armed]);

  useEffect(() => stopHold, [stopHold]);

  return (
    <div className={["cd-guard-set", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="cd-key cd-guard cd-focusable"
        disabled={disabled}
        aria-describedby={undefined}
        style={{ "--cd-guard-progress": String(progress) } as React.CSSProperties}
        onPointerDown={armed ? undefined : beginHold}
        onPointerUp={armed ? undefined : stopHold}
        onPointerCancel={stopHold}
        onPointerLeave={stopHold}
        onKeyDown={(event) => {
          if (event.repeat) return;
          if (!armed && (event.key === " " || event.key === "Enter")) beginHold();
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") stopHold();
        }}
        onBlur={stopHold}
        onClick={() => {
          if (!armed || disabled) return;
          setArmed(false);
          onCommit();
        }}
      >
        <span className="cd-guard-fill" aria-hidden="true" />
        <span className="cd-key-cap">{armed ? commitLabel : armLabel}</span>
      </button>
      {/* The consequence is stated BEFORE the choice, always — never after,
          and never behind an "are you sure" that asks for a decision before
          it has supplied the fact the decision depends on. */}
      <p className="cd-field-note" role="status">
        {armed ? consequence : `hold to arm · ${ARM_HOLD_MS}ms`}
      </p>
    </div>
  );
}
