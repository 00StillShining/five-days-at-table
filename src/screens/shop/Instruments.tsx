/**
 * src/screens/shop/Instruments.tsx — the four instruments 11 TANGENT HORIZON
 * carries into a working product, built as this screen actually uses them.
 *
 *   TrackWindow   section 3 — a position shown as a point of light travelling a
 *                 fixed slot, never as a filled bar climbing from an origin.
 *   Crown         section 3 — the fine-adjust crown and its flush-check ring.
 *   Selector      section 5 — the 33/45-style speed selector, hard stops.
 *   FlushKey      section 3 — a flat plane that answers in pigment, not travel.
 *
 * ---------------------------------------------------------------------------
 * WHY THE TRACK WINDOW HAS AN IMPERATIVE HANDLE
 * ---------------------------------------------------------------------------
 * CD-BRIEF's measured performance law: "Commit synchronously at input; do not
 * rely on a React dispatch ... Measured: ack commit 0.01-0.9ms while the visible
 * report takes 12-39ms." The index is the reading that has to move in the frame
 * the hand lands, so the scene reports to it through a ref BEFORE React has
 * re-rendered anything. The declarative prop is the same value arriving later
 * and is a no-op when the handle already applied it.
 *
 * ---------------------------------------------------------------------------
 * WHAT NEVER SOUNDS HERE
 * ---------------------------------------------------------------------------
 * Section 6: "a value's position settling, full stop — the track window's index
 * reaching its slot produces NOTHING, exactly as the source hardware's muting
 * relay silences the true thump before a stylus completes its own landing." So
 * the track window has no cue of any kind. A LOCK is a different event: the
 * flush-check crossing from broken to true is a detent completing, and it earns
 * the reserved latch — 540Hz for 40ms, seating to 450Hz, a minor third.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { PressKey } from "../../cd/foundry";
import { cue } from "../../cd/sound/cues";
import { BREAK_MAX_DEG, LOCK_DECAY_MS, isLocked, trackSweepMs } from "./model";

/* ================================================================== */
/* TRACK WINDOW                                                        */
/* ================================================================== */

export interface TrackMark {
  /** Stable across renders. */
  key: string;
  /** 0..100 along the slot. */
  pct: number;
  /** Printed beside the index, at the index's own position. */
  seat?: string;
  figure?: string;
}

export interface TrackWindowHandle {
  /** Move one index NOW, at the chapter's own rate. Called at the input event. */
  report(key: string, pct: number): void;
}

export interface TrackWindowProps {
  /** How many printed calibration ticks the slot carries. Derived, never chosen. */
  ticks: number;
  marks: TrackMark[];
  /** Accessible description of what the slot measures. */
  label: string;
  /** Render the exact-figure legend row beneath, in track order. */
  legend?: boolean;
  /** What zero on this axis means, printed at its own end. */
  legendOrigin?: string;
  className?: string;
}

export const TrackWindow = forwardRef<TrackWindowHandle, TrackWindowProps>(function TrackWindow(
  { ticks, marks, label, legend = false, legendOrigin, className },
  ref
) {
  const slotRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLSpanElement>());
  const applied = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, number>());

  /**
   * Section 3's own arithmetic, unchanged: percent to px once, so travel runs on
   * transform and never on a layout property; duration derived from distance at
   * the fixed rate; arrival IS the lock.
   */
  const apply = useCallback((key: string, pct: number, animate: boolean) => {
    const el = nodes.current.get(key);
    const slot = slotRef.current;
    if (!el || !slot) return;
    const from = applied.current.get(key) ?? 0;
    const width = slot.getBoundingClientRect().width;
    const sweep = animate ? trackSweepMs(from, pct) : 0;

    el.removeAttribute("data-shop-locked"); // travelling: strobe white, never red
    el.style.setProperty("--shop-sweep", `${sweep}ms`);
    el.style.setProperty("--shop-index-x", `${(pct / 100) * width}px`);
    applied.current.set(key, pct);

    const existing = timers.current.get(key);
    if (existing != null) window.clearTimeout(existing);
    const id = window.setTimeout(() => {
      el.setAttribute("data-shop-locked", "true");
      timers.current.delete(key);
    }, sweep);
    timers.current.set(key, id);
  }, []);

  useImperativeHandle(ref, () => ({ report: (key, pct) => apply(key, pct, true) }), [apply]);

  /* Seed without travel: a value that has never been anywhere has not moved. */
  useLayoutEffect(() => {
    for (const mark of marks) {
      if (!applied.current.has(mark.key)) apply(mark.key, mark.pct, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The declarative half. A no-op when the handle already reported this value. */
  useEffect(() => {
    for (const mark of marks) {
      if (applied.current.get(mark.key) !== mark.pct) apply(mark.key, mark.pct, true);
    }
  }, [marks, apply]);

  /* A resize is not a value change: re-seat without travel and without a lock
     report, because nothing has actually moved (II.4.16). */
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const width = slot.getBoundingClientRect().width;
      for (const [key, pct] of applied.current) {
        const el = nodes.current.get(key);
        if (!el) continue;
        el.style.setProperty("--shop-sweep", "0ms");
        el.style.setProperty("--shop-index-x", `${(pct / 100) * width}px`);
      }
    });
    ro.observe(slot);
    return () => ro.disconnect();
  }, []);

  useEffect(
    () => () => {
      for (const id of timers.current.values()) window.clearTimeout(id);
    },
    []
  );

  const tickPct = ticks > 0 ? `${100 / ticks}%` : "8%";

  return (
    <div className={className}>
      <div
        ref={slotRef}
        className="shop-window"
        style={{ "--shop-tick": tickPct } as React.CSSProperties}
        role="img"
        aria-label={label}
      >
        {marks.map((mark) => (
          <span
            key={mark.key}
            ref={(el) => {
              if (el) nodes.current.set(mark.key, el);
              else nodes.current.delete(mark.key);
            }}
            className="shop-index"
            style={{ "--shop-lock-decay": `${LOCK_DECAY_MS}ms` } as React.CSSProperties}
            aria-hidden="true"
          />
        ))}
      </div>
      {legend && (
        <div className="shop-legend" aria-hidden="true">
          <span className="shop-legend-origin">{legendOrigin}</span>
          {marks.map((mark) => (
            <span key={mark.key} className="shop-legend-item">
              <span className="shop-legend-seat">{mark.seat}</span>
              <span className="shop-legend-fig">{mark.figure}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

/* ================================================================== */
/* CROWN + FLUSH-CHECK                                                 */
/* ================================================================== */

export interface CrownProps {
  /** What the coarse choice beside this crown is being trimmed WITHIN. */
  label: string;
  /** The crown's own current value, printed. Honesty: never a ring alone. */
  figure: string;
  /**
   * The LIVE error this ring reports, in degrees. Zero means the value reads
   * true and the ticks snap flush in one Anchored detent seat.
   */
  errorDeg: number;
  /** Step the fine value. Sign is the direction the crown is turned. */
  onStep: (direction: 1 | -1) => void;
  /** Pressing the crown, where the crown has something to open. */
  onPress?: () => void;
  /** Accessible name for the control itself. */
  name: string;
  disabled?: boolean;
}

export function Crown({ label, figure, errorDeg, onStep, onPress, name, disabled }: CrownProps) {
  const locked = isLocked(errorDeg);
  const wasLocked = useRef<boolean | null>(null);

  /*
    Section 6 binds the lock cue to the flush-check crossing from broken to TRUE,
    and to nothing else. Seeded on first read so a screen that ARRIVES already
    true does not sound a lock for an event that happened before it mounted.
  */
  useEffect(() => {
    if (wasLocked.current === null) {
      wasLocked.current = locked;
      return;
    }
    if (locked && !wasLocked.current) cue("latch");
    wasLocked.current = locked;
  }, [locked]);

  return (
    <div className="shop-crown-set">
      <PressKey
        className="shop-crown"
        onPress={() => onPress?.()}
        disabled={disabled}
        aria-label={name}
        sound="none"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onStep(1);
          } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onStep(-1);
          }
        }}
      >
        <span className="shop-crown-cap" aria-hidden="true">
          <span
            className="shop-crown-ticks"
            data-shop-locked={locked ? "true" : undefined}
            style={
              {
                "--shop-tick-offset": `${locked ? 0 : errorDeg}deg`,
                "--shop-lock-decay": `${LOCK_DECAY_MS}ms`,
              } as React.CSSProperties
            }
          />
          <span className="shop-crown-fix" />
        </span>
      </PressKey>
      <span className="shop-crown-read">
        <span className="shop-crown-label">{label}</span>
        <span className="shop-crown-fig">{figure}</span>
      </span>
    </div>
  );
}

/** The largest legal break, exported so a caller can reason in the same units. */
export { BREAK_MAX_DEG };

/* ================================================================== */
/* SELECTOR — a coarse choice on hard stops                            */
/* ================================================================== */

export interface SelectorSeat {
  value: string;
  word: string;
  figure?: string;
}

export interface SelectorProps {
  seats: SelectorSeat[];
  value: string;
  onChange: (next: string) => void;
  label: string;
}

export function Selector({ seats, value, onChange, label }: SelectorProps) {
  return (
    <div className="shop-select" role="group" aria-label={label}>
      {seats.map((seat) => (
        <PressKey
          key={seat.value}
          className="shop-seat"
          aria-pressed={seat.value === value}
          sound="none"
          onPress={() => {
            if (seat.value === value) return;
            /* Section 5: "Detents exist only where a true lock exists — the
               flush-check seat, A SPEED SELECTOR'S COMMIT." Fired at the commit,
               on release, not on the down-stroke. */
            cue("detent");
            onChange(seat.value);
          }}
        >
          <span>{seat.word}</span>
          {seat.figure && <span className="shop-seat-fig">{seat.figure}</span>}
        </PressKey>
      ))}
    </div>
  );
}

/* ================================================================== */
/* FLUSH KEY — the cueing cluster's own grammar                        */
/* ================================================================== */

export type CueGlyph = "first" | "prev" | "lift" | "next" | "last";

/**
 * Section 3 keeps the source panel's five-function SEMANTIC — paired opposed
 * directions plus one lift — and section 9's never-copy bundle forbids
 * reproducing its compass. These are five marks cut into five caps: two chevrons
 * pointing outward (toward the trip's start), one diamond for LIFT, two pointing
 * inward (toward its end). Nothing here is a picture of a turntable.
 */
function Glyph({ kind }: { kind: CueGlyph }) {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg className="shop-key-glyph" width="20" height="20" viewBox="0 0 20 20" focusable="false" aria-hidden="true">
      {kind === "first" && (
        <>
          <path d="M11.5 5.5 L7 10 L11.5 14.5" {...stroke} />
          <path d="M16 5.5 L11.5 10 L16 14.5" {...stroke} />
        </>
      )}
      {kind === "prev" && <path d="M12.5 5.5 L8 10 L12.5 14.5" {...stroke} />}
      {kind === "lift" && <path d="M10 4.5 L15.5 10 L10 15.5 L4.5 10 Z" {...stroke} />}
      {kind === "next" && <path d="M7.5 5.5 L12 10 L7.5 14.5" {...stroke} />}
      {kind === "last" && (
        <>
          <path d="M4 5.5 L8.5 10 L4 14.5" {...stroke} />
          <path d="M8.5 5.5 L13 10 L8.5 14.5" {...stroke} />
        </>
      )}
    </svg>
  );
}

export interface FlushKeyProps {
  kind: CueGlyph;
  name: string;
  onPress: () => void;
  disabled?: boolean;
}

export function FlushKey({ kind, name, onPress, disabled }: FlushKeyProps) {
  return (
    <PressKey
      className="shop-key"
      data-shop-key={kind}
      aria-label={name}
      title={name}
      disabled={disabled}
      /* Section 6 voices CONTACT for this key: filtered noise through a lowpass
         at 2200Hz, "closer to a change in air pressure than a click", firing
         only on the down-stroke. */
      sound="contact"
      onPress={onPress}
    >
      <span className="shop-key-face" aria-hidden="true" />
      <span className="shop-key-mark" aria-hidden="true" />
      <Glyph kind={kind} />
    </PressKey>
  );
}

/** A wider key with an engraved cap word, for the two consequential summonses. */
export function CapKey({
  cap,
  onPress,
  expanded,
  controls,
  children,
}: {
  cap: string;
  onPress: () => void;
  expanded?: boolean;
  controls?: string;
  children?: ReactNode;
}) {
  return (
    <PressKey
      className="shop-cap-key"
      onPress={onPress}
      sound="contact"
      aria-expanded={expanded}
      aria-controls={controls}
    >
      {children}
      <span>{cap}</span>
    </PressKey>
  );
}
