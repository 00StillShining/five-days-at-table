/**
 * src/screens/cook/Instruments.tsx — the evidence column's four instruments.
 *
 * CORRECTIONARY 5.3: "Every value is an instrument ... plus its exact figure.
 * A number typeset on a background is not a readout and is not acceptable as
 * one." Nothing below prints a bare figure: the countdown is drums over a
 * segmented meter, the state is a dot-matrix strip beside a latching
 * annunciator, and the step text sits on an ink plate under an engraved
 * escutcheon.
 *
 * CD-BRIEF ruling 5, the ink-plate law: text never renders raw over anodized
 * grain. Every word below is on a Plate, in a well, or cut into an escutcheon.
 */

import { useCallback, useEffect, useRef } from "react";
import { Enclosure, Escutcheon, Plate, PressKey } from "../../cd/foundry";
import { REPEAT_DELAY_MS, REPEAT_INTERVAL_MS, startRepeat, type RepeatClockHandle } from "../../cd/physics/keys";
import { timerAge, useAgeClock } from "../../cd/freshness/useAge";
import { cue } from "../../cd/sound/cues";
import { DotMatrix, type TransportGlyph } from "./DotMatrix";
import { Drums } from "./Drums";
import { formatScrubOffset } from "./format";
import "./cook.css";

/* ====================================================================== */
/* 1 · THE COUNTDOWN — the screen's one reserved numeral (II.6.20)         */
/* ====================================================================== */

/** II.3.19 — the bar meter, re-oriented. See the note in cook.css. */
const METER_SEGMENTS = 24;
const SEG_INDEX = Array.from({ length: METER_SEGMENTS }, (_, i) => i);

export interface CountdownProps {
  /**
   * What this reading IS. It changes with the fact, never with the styling: a
   * step's own remaining time and the wait until the next step starts are
   * different facts and are never printed under the same word.
   */
  caption: string;
  /** The exact figure, already formatted. "--:--" when there is no reading. */
  value: string;
  /** 0-1 of the reading's own window remaining. null when there is no window. */
  remainingFraction: number | null;
  /** The program is held. NOT stale — a paused timer is paused, and says so. */
  paused: boolean;
  /** The printed state word. Never a colour alone (II.7.7). */
  stateWord: string;
  /** Overdue — the step's clock is past zero. */
  overdue: boolean;
  /** Wall-clock instant the elapsed figure last moved, for the age. */
  lastTickAt: number | null;
  timers: { startedAt: number | null; pausedAt: number | null };
}

/**
 * THE ONE COMPONENT THAT READS THE AGE, and therefore the only one that mounts
 * the age clock (CD-BRIEF measured performance law, rule 4: "Isolate clocks ...
 * put it inside the one component that reads it"). src/cd/freshness/useAge.ts
 * drops its interval while the tab is hidden, so a backgrounded COOK runs no
 * timer at all.
 *
 * TWO DECLARATIONS, and they are not the same declaration:
 *
 *   HELD      the operator paused it. `timerAge` returns null for exactly this
 *             case, on purpose — "a PAUSED timer is not stale; it is paused,
 *             and it says so." The value holds at 55% ink, the word HELD
 *             prints, and the recovery is the collar's own RUN key, which the
 *             foot names rather than duplicating.
 *   NO SIGNAL the clock claims to be running and has not moved for 2000ms
 *             (FRESHNESS.timer). The value HOLDS — never blanked, never dashed
 *             out, never advanced by guesswork — the ink drops to 55%, the word
 *             prints, and the recovery key appears in the slot it always
 *             occupies. Timers are reload-safe (epoch arithmetic in the frozen
 *             engine), so RELOAD genuinely recovers the reading and costs
 *             nothing: it is the honest recovery, not a button that re-renders
 *             and calls that a repair.
 */
export function Countdown({
  caption,
  value,
  remainingFraction,
  paused,
  stateWord,
  overdue,
  lastTickAt,
  timers,
}: CountdownProps) {
  const now = useAgeClock(1000);
  const age = timerAge(timers, lastTickAt, now);
  const noSignal = age?.stale ?? false;
  const held = paused || noSignal;

  const lit =
    remainingFraction === null
      ? 0
      : Math.ceil(Math.max(0, Math.min(1, remainingFraction)) * METER_SEGMENTS);

  const word = noSignal ? age!.word : paused ? "HELD" : stateWord;

  return (
    <Enclosure variant="well" className="ck-count" data-cd-surface="data">
      <div className="ck-count-head">
        <Escutcheon>{caption}</Escutcheon>
        <span className="ck-count-age cd-printed">
          {age ? age.label : paused ? "held" : "not started"}
        </span>
      </div>

      <Drums
        value={value}
        size="var(--cd-size-7)"
        held={held}
        label={caption}
        className="ck-count-drums"
      />

      {/*
        II.3.19 — level as filled travel, in real segments over a zoned track.
        OVERDUE is not "empty": an empty meter beside a running figure reads as
        a broken instrument, and the window is not absent — it is fully spent
        and past. So every segment lights in the danger value, which is the same
        fact the figure above is printing.
      */}
      <span className="ck-meter" data-ck-overdue={overdue ? "true" : undefined} role="img" aria-label={`${caption}: ${value}`}>
        {SEG_INDEX.map((i) => (
          <span
            key={i}
            className="ck-meter-seg"
            data-on={overdue || i < lit ? "true" : undefined}
            data-zone={i < METER_SEGMENTS * 0.15 ? "warn" : undefined}
          />
        ))}
      </span>

      <div className="ck-count-foot">
        <span className="ck-count-word cd-silkscreen" data-ck-overdue={overdue ? "true" : undefined}>
          {word}
        </span>
        {/* The recovery slot. Reserved in BOTH states so the control never moves
            under a hand that is already reaching for it. */}
        <span className="ck-count-recovery">
          {noSignal ? (
            <PressKey
              className="ck-count-reload"
              onPress={() => window.location.reload()}
              cap="reload"
              aria-label="the clock has stopped reporting — reload to recover the reading"
            />
          ) : null}
        </span>
      </div>
    </Enclosure>
  );
}

/* ====================================================================== */
/* 2 · THE ANNUNCIATOR + THE DOT-MATRIX STRIP                             */
/* ====================================================================== */
/*
  II.3.25 — "a labelled lamp tile that latches attention. Label engraved in
  muted ink while dark — a dark annunciator still announces what it would say.
  When its condition fires, the tile flashes at 2Hz — 250ms lit, 250ms dark,
  SQUARE, no fade — until acknowledged."

  The reel is aria-hidden, so this pod is what the screen actually SAYS. It
  carries role="status" for the ordinary transitions and the alarm carries
  role="alert" separately, in index.tsx.
*/

export interface AnnunciatorProps {
  /** The printed state word: RUN / HOLD / DUE / STOP / DONE / READY. */
  word: string;
  glyph: TransportGlyph;
  /** True while the condition is live and unacknowledged. */
  firing: boolean;
  /** What the tile would say if it fired. Engraved whether lit or dark. */
  legend: string;
}

export function Annunciator({ word, glyph, firing, legend }: AnnunciatorProps) {
  return (
    <Enclosure variant="pod" className="ck-state">
      <div className="ck-state-strip">
        <DotMatrix text={word} glyph={glyph} label={`transport state: ${word}`} />
      </div>
      <div className="ck-ann" data-ck-firing={firing ? "true" : undefined} aria-hidden="true">
        <span className="ck-ann-legend">{legend}</span>
      </div>
    </Enclosure>
  );
}

/* ====================================================================== */
/* 3 · THE NOW PLATE — what am I doing right now                          */
/* ====================================================================== */

export interface NowPlateProps {
  /** The engraved naming plate: the track or station this step belongs to. */
  track: string | null;
  text: string;
  /** docs/VARIANT-SPEC.md's per-op note, when the tester variant supplies one. */
  note?: string;
  /** The next step, with the wait until it starts. */
  next: { text: string; startsIn: string } | null;
  /**
   * THE ALARM IS THIS PLATE. It is not a second pod beside it.
   *
   * The first build rendered a separate TIME IS UP enclosure above this one and
   * both printed the SAME step text — two instruments reporting one fact, which
   * the truth pass fails on sight, and 9rem of column height spent saying it
   * twice. The alarm is a STATE OF THE NOW PLATE: the danger keyline lands on
   * the plate that already holds the step, the escutcheon changes word, and the
   * caller remounts it (a changed `key`) so role="alert" announces once.
   */
  due?: boolean;
}

export function NowPlate({ track, text, note, next, due = false }: NowPlateProps) {
  return (
    <Enclosure
      variant="hero"
      grain
      className="ck-now"
      data-ck-due={due ? "true" : undefined}
      role={due ? "alert" : undefined}
    >
      <div className="ck-now-head">
        <Escutcheon>{due ? "time is up" : "now"}</Escutcheon>
        {track && <Escutcheon className="ck-now-track">{track}</Escutcheon>}
      </div>
      <Plate className="ck-now-plate">
        <p className="ck-now-text">{text}</p>
        {note && <p className="ck-now-note">{note}</p>}
      </Plate>
      {next && (
        <Plate className="ck-next-plate">
          <span className="ck-next-label cd-silkscreen">next</span>
          <span className="ck-next-text">{next.text}</span>
          <span className="ck-next-in cd-printed">starts in {next.startsIn}</span>
        </Plate>
      )}
    </Enclosure>
  );
}

/* ====================================================================== */
/* 4 · THE SCRUB ROCKER — the discrete +/-1-minute stepper                */
/* ====================================================================== */
/*
  II.3.14 — "a two-direction momentary plate, spring-centered ... tilting +/-10
  degrees about its long axis. Mass class Light. Each end repeats at 12
  events/second after 380ms while held. Return runs on spring(0.7, 420, 25),
  CSS equivalent 180ms."

  02 REEL LOGIC section 3 licenses it by name: "A rocker lives beside the
  transport row for coarse speed-scrubbed review — a SECONDARY PATH to the same
  scrub the reel already owns, earning its place because a thumb reaching
  sideways is sometimes faster than a whole hand on the disc." On FD-5 it is
  not the secondary path — it is the ONLY one, because the disc is never
  grabbed, and that is what the ruling's "discrete +/-1-minute stepper" is.

  THE MOTOR WHIR LIVES HERE. 02 REEL LOGIC section 6: the whir "is the detent
  tick itself, coalesced above eight events per second (II.5.11) — a whir made
  of ticks too close to hear apart, never a synthesized hum." II.1.18's held-key
  clock repeats at exactly 12 events/second, which is above the coalescer's 8/s
  slot, so holding an end of this rocker produces the whir by arithmetic rather
  than by a second sound being invented for it. One tap is one tick.

  DEPARTURE, declared (CORRECTIONARY 6.5). The casting's painted profile is
  4rem x 2rem — 64 x 32px, which fails the Floor's 44px block axis. The ends are
  built at 4rem x 2.75rem each. The Floor outranks a casting's dimension table,
  and this screen is operated at ~2m with wet hands.
*/

export interface ScrubRockerProps {
  offsetMinutes: number;
  boundMinutes: number;
  onStep: (delta: number) => void;
  onReset: () => void;
}

export function ScrubRocker({ offsetMinutes, boundMinutes, onStep, onReset }: ScrubRockerProps) {
  const repeat = useRef<RepeatClockHandle | null>(null);
  const thrown = useRef<HTMLDivElement>(null);

  const stop = useCallback(() => {
    repeat.current?.cancel();
    repeat.current = null;
    thrown.current?.removeAttribute("data-ck-thrown");
  }, []);

  useEffect(() => stop, [stop]);

  const begin = useCallback(
    (delta: number) => {
      stop();
      thrown.current?.setAttribute("data-ck-thrown", delta > 0 ? "up" : "down");
      repeat.current = startRepeat(() => {
        onStep(delta);
        // II.5.5 through the coalescer of II.5.11 — never the raw tick.
        cue("detent");
      });
    },
    [onStep, stop]
  );

  const atMin = offsetMinutes <= -boundMinutes;
  const atMax = offsetMinutes >= boundMinutes;

  return (
    <Enclosure variant="pod" className="ck-scrub">
      <div className="ck-scrub-head">
        <Escutcheon>preview</Escutcheon>
        <span className="ck-scrub-read cd-printed" role="status">
          {offsetMinutes === 0 ? "now" : formatScrubOffset(offsetMinutes)}
        </span>
      </div>

      <div className="ck-rocker" ref={thrown}>
        <button
          type="button"
          className="ck-rocker-end cd-focusable"
          aria-label={`preview one minute earlier (hold to repeat at ${1000 / REPEAT_INTERVAL_MS | 0} per second after ${REPEAT_DELAY_MS}ms)`}
          disabled={atMin}
          onPointerDown={() => begin(-1)}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onKeyDown={(e) => {
            if (e.repeat) return; // II.1.18 — the OS repeat clock is refused
            if (e.key === " " || e.key === "Enter") begin(-1);
          }}
          onKeyUp={stop}
          onBlur={stop}
        >
          <span className="ck-rocker-glyph" aria-hidden="true" data-ck-dir="down" />
          <span className="ck-rocker-cap cd-engraved">1 min</span>
        </button>

        <span className="ck-rocker-pivot" aria-hidden="true" />

        <button
          type="button"
          className="ck-rocker-end cd-focusable"
          aria-label="preview one minute later (hold to repeat)"
          disabled={atMax}
          onPointerDown={() => begin(1)}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onKeyDown={(e) => {
            if (e.repeat) return;
            if (e.key === " " || e.key === "Enter") begin(1);
          }}
          onKeyUp={stop}
          onBlur={stop}
        >
          <span className="ck-rocker-glyph" aria-hidden="true" data-ck-dir="up" />
          <span className="ck-rocker-cap cd-engraved">1 min</span>
        </button>
      </div>

      {/* The return-to-now key holds a FIXED position: rendered in both states,
          disabled rather than absent, so the hand always finds it where it was. */}
      <PressKey
        className="ck-scrub-now"
        onPress={onReset}
        disabled={offsetMinutes === 0}
        cap="back to now"
        aria-label="return the preview to now"
      />
    </Enclosure>
  );
}
