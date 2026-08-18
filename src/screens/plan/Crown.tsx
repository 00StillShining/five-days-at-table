/**
 * src/screens/plan/Crown.tsx — ch.17's own input, built to its own two gears.
 *
 * section 3: "Built on II.3.8 — edge-mounted, 0.75rem by 2.25rem in profile,
 * mass class Light, default gearing fine at 48px of vertical drag per step,
 * pulling it out 0.25rem shifts to coarse ... Pushed in, a 48px drag nudges the
 * currently focused gauge's own reference marker by one minor tick. Pulled out,
 * the same drag re-gears to roughly a fifth of that distance per step
 * (II.1.16's 20% default), and now pages focus across the five-dial row itself
 * — one step, one dial, wrapping at the ends."
 *
 * Both gears land on the same commit path. The hysteresis, the capture zone and
 * the seat arithmetic are `src/cd/physics/detent.ts`'s, not a private copy:
 * II.1.12's 12% band, II.1.11's +/-40% capture. A keypress and a drag produce
 * the identical value, which is the whole of II.3.4.
 *
 * ---------------------------------------------------------------------------
 * THE SIGNATURE — held past the stop (section 7)
 * ---------------------------------------------------------------------------
 * "the crown, pulled and held past its own hard stop for 350ms of linear fill —
 * the guarded engage of II.3.16 ... latch-voiced, trades the entire cluster's
 * finish ... while the five-dial row and every present value hold exactly
 * still."
 *
 * FD-5's own version of that trade is the one move only this product would
 * make, and it is a fact rather than a finish: the board RE-COMMISSIONS ITS
 * SCOPE between one plated week and the executing a-twice fortnight. Because
 * the fortnight IS week A run twice (D5), both the reading and the band double
 * together — so every needle holds its exact angle through the change while
 * every printed figure re-casts. "A value redrawn is still the same fact, never
 * new information", made literal.
 *
 * It is refused, with a printed reason, while the board is browsing Week B:
 * B is never executed, so "B, twice" is not a fact about anything.
 *
 * ---------------------------------------------------------------------------
 * THE KEYBOARD IS THE WHOLE CONTROL, NOT A SHORTCUT LIST (II.3.4)
 * ---------------------------------------------------------------------------
 *   Up / Down / Left / Right ... one detent in the current gear
 *   PageUp / PageDown ......... ten detents
 *   Home / End ................ the hard limits
 *   Enter .................... the axial pull — in and out
 *   Space (held) ............. the 350ms guarded re-commission, when pulled
 * Held keys repeat at 12/s after 380ms, on the PRODUCT's clock (II.1.18).
 * Every one of those is printed on the crown's own legend plate, because a
 * gesture nobody can see is a gesture nobody has.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { Escutcheon, Plate } from "../../cd/foundry";
import { quantise, type DetentTrack } from "../../cd/physics/detent";
import { intentFor, REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from "../../cd/physics/keys";
import { cue } from "../../cd/sound/cues";
import { MARK_TICKS_MAX } from "./model";

/** II.3.8's own gearing. Pulled re-gears to II.1.16's 20% default. */
export const CROWN_PX_PER_STEP = 48;
export const CROWN_PULLED_RATIO = 0.2;

/** II.3.16's guarded engage, licensed onto ENGAGE by ch.17 section 7. */
export const HOLD_MS = 350;

/** Below this much travel a pointer press is a CLICK, not a drag. */
const DRAG_SLOP_PX = 4;

const ROW_TRACK: DetentTrack = { seats: 5, pitch: 1 };
const MARK_TRACK: DetentTrack = { seats: MARK_TICKS_MAX * 2 + 1, pitch: 1 };

export interface CrownProps {
  pulled: boolean;
  onPulled: (next: boolean) => void;
  /** 0..4 — which dial in the case row the crown has paged to. */
  index: number;
  onIndex: (next: number) => void;
  /** The focused channel's marker offset, in minor ticks off the band ceiling. */
  markTicks: number;
  onMarkTicks: (next: number) => void;
  channelLabel: string;
  /** The scope the hold would commit to, or null when the hold is refused. */
  recommission: { word: string; onCommit: () => void } | null;
  /** Why the hold is refused. Printed, never silent. */
  refusal: string | null;
  trophy: boolean;
}

export function Crown({
  pulled,
  onPulled,
  index,
  onIndex,
  markTicks,
  onMarkTicks,
  channelLabel,
  recommission,
  refusal,
  trophy,
}: CrownProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const repeatRef = useRef<number | null>(null);
  const holdRef = useRef<{ raf: number; start: number } | null>(null);
  const dragRef = useRef<{ y: number; travel: number; moved: number } | null>(null);
  /* The live model. Read inside handlers so a step never lands on a stale
     value — the same reason the scene keeps a modelRef (the measured perf law). */
  const liveRef = useRef({ pulled, index, markTicks });
  liveRef.current = { pulled, index, markTicks };
  const [holding, setHolding] = useState(false);
  /* Whether the hold actually reached 350ms and committed. A ref, not the
     `holding` state: `setHolding(false)` inside cancelHold is queued, so the
     pointer-up handler that runs in the same task still closes over the OLD
     value. Measured — a click while the crown was pulled never pushed it back
     in, because the stale `holding` made the release look like a hold. */
  const holdFiredRef = useRef(false);

  const step = useCallback(
    (detents: number) => {
      const live = liveRef.current;
      if (live.pulled) {
        // one step, one dial, WRAPPING at the ends (section 3)
        const next = ((index + detents) % 5 + 5) % 5;
        if (next === live.index) return;
        liveRef.current = { ...live, index: next };
        onIndex(next);
      } else {
        const next = Math.min(MARK_TICKS_MAX, Math.max(-MARK_TICKS_MAX, live.markTicks + detents));
        if (next === live.markTicks) return;
        liveRef.current = { ...live, markTicks: next };
        onMarkTicks(next);
      }
      // section 6 — the warm tach tick at 960Hz, ALWAYS through the 8/s
      // coalescer (II.5.11), never the raw tick.
      cue("detent", { x: 0.86, mode: trophy ? "trophy" : undefined });
    },
    [index, onIndex, onMarkTicks, trophy]
  );

  const limit = useCallback(
    (edge: "min" | "max") => {
      const live = liveRef.current;
      if (live.pulled) {
        const next = edge === "min" ? 0 : 4;
        if (next === live.index) return;
        liveRef.current = { ...live, index: next };
        onIndex(next);
      } else {
        const next = edge === "min" ? -MARK_TICKS_MAX : MARK_TICKS_MAX;
        if (next === live.markTicks) return;
        liveRef.current = { ...live, markTicks: next };
        onMarkTicks(next);
      }
      cue("detent", { x: 0.86, mode: trophy ? "trophy" : undefined });
    },
    [onIndex, onMarkTicks, trophy]
  );

  const stopRepeat = useCallback(() => {
    if (repeatRef.current != null) window.clearTimeout(repeatRef.current);
    repeatRef.current = null;
  }, []);

  const cancelHold = useCallback(() => {
    if (holdRef.current) window.cancelAnimationFrame(holdRef.current.raf);
    holdRef.current = null;
    bodyRef.current?.style.setProperty("--cd-hold-pct", "0%");
    setHolding(false);
  }, []);

  const beginHold = useCallback(() => {
    if (!recommission || holdRef.current) return;
    setHolding(true);
    const start = performance.now();
    const frame = (now: number) => {
      if (!holdRef.current) return; // lift cancels
      const pct = Math.min(1, (now - start) / HOLD_MS);
      bodyRef.current?.style.setProperty("--cd-hold-pct", `${(pct * 100).toFixed(1)}%`);
      if (pct < 1) {
        holdRef.current = { raf: window.requestAnimationFrame(frame), start };
        return;
      }
      holdRef.current = null;
      holdFiredRef.current = true;
      setHolding(false);
      bodyRef.current?.style.setProperty("--cd-hold-pct", "0%");
      // II.5.6 — latch, the two-stage throw-then-seat, at the frame the hold
      // completes and the consequence has already landed.
      recommission.onCommit();
      cue("latch", { x: 0.86, mode: trophy ? "trophy" : undefined });
    };
    holdRef.current = { raf: window.requestAnimationFrame(frame), start };
  }, [recommission, trophy]);

  useEffect(
    () => () => {
      stopRepeat();
      if (holdRef.current) window.cancelAnimationFrame(holdRef.current.raf);
    },
    [stopRepeat]
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.repeat) return;
        cancelHold();
        onPulled(!liveRef.current.pulled);
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        if (event.repeat) return;
        if (liveRef.current.pulled) beginHold();
        return;
      }
      if (event.repeat) return; // the OS repeat clock is refused (II.1.18)
      const intent = intentFor(event, false);
      if (!intent) return;
      event.preventDefault();
      /* II.1.17 — new input retargets any motion in flight. A repeat clock is a
         motion in flight, so ANY new command stops it before anything else. */
      stopRepeat();
      const act = () => {
        if (intent.kind === "step") step(intent.detents);
        else if (intent.kind === "limit") limit(intent.edge);
      };
      act();
      if (intent.kind !== "step") return;
      repeatRef.current = window.setTimeout(function tick() {
        act();
        repeatRef.current = window.setTimeout(tick, REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    },
    [beginHold, cancelHold, limit, onPulled, step, stopRepeat]
  );

  const onKeyUp = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      stopRepeat();
      if (event.key === " ") cancelHold();
    },
    [cancelHold, stopRepeat]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      holdFiredRef.current = false;
      dragRef.current = {
        y: event.clientY,
        travel: liveRef.current.pulled ? liveRef.current.index : liveRef.current.markTicks,
        moved: 0,
      };
      if (liveRef.current.pulled) beginHold();
    },
    [beginHold]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const grab = dragRef.current;
      if (!grab) return;
      const dy = grab.y - event.clientY;
      grab.moved = Math.max(grab.moved, Math.abs(dy));
      if (grab.moved > DRAG_SLOP_PX) cancelHold(); // a turn is not a hold
      const live = liveRef.current;
      const perStep = live.pulled ? CROWN_PX_PER_STEP * CROWN_PULLED_RATIO : CROWN_PX_PER_STEP;
      const travel = grab.travel + dy / perStep;
      if (live.pulled) {
        const seated = quantise(ROW_TRACK, travel, live.index);
        if (seated !== live.index) step(seated - live.index);
      } else {
        const seated = quantise(MARK_TRACK, travel + MARK_TICKS_MAX, live.markTicks + MARK_TICKS_MAX);
        const nextTicks = seated - MARK_TICKS_MAX;
        if (nextTicks !== live.markTicks) step(nextTicks - live.markTicks);
      }
    },
    [cancelHold, step]
  );

  const onPointerUp = useCallback(() => {
    const grab = dragRef.current;
    dragRef.current = null;
    const fired = holdFiredRef.current;
    cancelHold();
    // A press that neither travelled nor completed the guarded hold is the
    // AXIAL PULL — exactly what a hand does to a real crown before turning it.
    if (grab && grab.moved <= DRAG_SLOP_PX && !fired) onPulled(!liveRef.current.pulled);
  }, [cancelHold, onPulled]);

  const valueNow = pulled ? index : markTicks;
  const valueText = pulled
    ? `pulled · paging the row · ${channelLabel}`
    : `pushed · ${channelLabel} mark, ${markTicks > 0 ? "+" : ""}${markTicks} ticks off the band ceiling`;

  return (
    <div className="pln-crown-set" data-pln-hidden={trophy ? "true" : undefined}>
      <div
        ref={bodyRef}
        className="pln-crown cd-focusable"
        role="slider"
        tabIndex={trophy ? -1 : 0}
        aria-label="crown"
        aria-valuemin={pulled ? 0 : -MARK_TICKS_MAX}
        aria-valuemax={pulled ? 4 : MARK_TICKS_MAX}
        aria-valuenow={valueNow}
        aria-valuetext={valueText}
        aria-orientation="vertical"
        data-pulled={pulled ? "true" : "false"}
        data-holding={holding ? "true" : "false"}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => {
          stopRepeat();
          cancelHold();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="pln-crown-knurl" aria-hidden="true" />
        <span className="pln-crown-fill" aria-hidden="true" />
      </div>

      {/* The legend. II.6.7's engraved register — permanent naming text cut
          into its own plate, never a tooltip and never a hover reveal. */}
      <Plate className="pln-crown-legend" surface="data">
        <Escutcheon as="p" className="pln-crown-gear">
          {pulled ? "pulled · pages the row" : "pushed · nudges the mark"}
        </Escutcheon>
        <dl className="pln-crown-map cd-printed">
          <div>
            <dt>turn / ↑↓</dt>
            <dd>{pulled ? "one dial" : "one tick of your mark"}</dd>
          </div>
          <div>
            <dt>press / ⏎</dt>
            <dd>{pulled ? "push in" : "pull out"}</dd>
          </div>
          <div>
            <dt>hold / ␣</dt>
            <dd>{recommission ? recommission.word : "—"}</dd>
          </div>
        </dl>
        <p className="pln-crown-mark-note cd-silkscreen">
          your mark is this visit&rsquo;s own line, not a plan figure
        </p>
        {refusal && <p className="pln-crown-refusal cd-silkscreen">{refusal}</p>}
      </Plate>
    </div>
  );
}
