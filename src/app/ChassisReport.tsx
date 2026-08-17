/**
 * src/app/ChassisReport.tsx — the two facts the chassis actually owns.
 *
 * HONESTY IS THE WHOLE DESIGN HERE (CORRECTIONARY 4, non-negotiable): "every
 * live reading shows its exact figure and its age; a value that stops updating
 * declares itself stale instead of silently going wrong; NO INVENTED DATA, no
 * fake progress, no motion with nothing behind it. Drama never lies."
 *
 * 13 BACK CHANNEL says the same thing from the other side (section 9): "A field
 * that lights for no reason is noise; a field that stays dark through a real one
 * is a lie."
 *
 * So the chassis reports exactly two things, and refuses to invent a third:
 *
 *  1. THE FORTNIGHT'S POSITION, as a FILL. `todayInfo()` returns fortnightDay
 *     0..13 from the anchored cycle-start Saturday. Clock-continuous, which is
 *     what CD-BRIEF ruling 6 requires before a value may drive a moving
 *     instrument at all: "portholes, rocker arms and spinning elements attach
 *     only to values whose change is USER-CAUSED OR CLOCK-CONTINUOUS."
 *  2. A RUNNING COOK PROGRAM, as a SWEEP. Genuinely per-second, elapsed against
 *     the program's own declared totalMinutes. Section 3: "a sweep answers
 *     elapsed time by advancing one lit arc AT A FIXED RATE, never a fixed
 *     duration" — the arc's rate here is the clock's, which is the only rate a
 *     stopwatch is allowed to have.
 *
 * THE THIRD CASE IS ABSENCE, AND IT IS RENDERED. With no cycle-start Saturday
 * set, the fortnight has no position. The field then rests at its ghost print
 * (#8A8A8A, every live cell, no lit cell anywhere), the figure prints as an
 * em-dash rather than a zero, and the label says so. A zero would be a lie
 * about day one; a blank would be a shrug.
 *
 * PRECEDENCE. A running program outranks the fortnight, because it is the only
 * reading on the chassis that changes faster than once a day and the only one
 * that can go wrong while the operator is looking away. This is section 3's own
 * "a whole field re-composing to a new pattern" — Weighted mass, spring(1.4,
 * 260, 30), --cd-settle-weighted 300ms, "a bigger change earns a bigger settle".
 */

import { GlyphField } from "../cd/chassis/GlyphField";
import {
  CANONICAL_N,
  CANONICAL_RADIUS,
  RAIL_N,
  RAIL_RADIUS,
  type GlyphPattern,
} from "../cd/chassis/glyph";
import { useStore } from "../state/store";
import { todayInfo } from "../state/selectors";
import { useAge } from "../cd/freshness/useAge";
import type { Age } from "../cd/freshness/classes";
import { useCookProgress } from "./cookRunningStub";

/** The a-twice cycle's own length, in days. */
export const FORTNIGHT_DAYS = 14;

export interface ChassisReport {
  pattern: GlyphPattern;
  figure: string;
  unit?: string;
  label: string;
  /**
   * The reading's own age, for the per-second class only. `null` for the
   * fortnight, which is derived from the calendar rather than sampled from the
   * world — src/cd/freshness/classes.ts's FRESHNESS.macros makes the same
   * point: "A derived value has no age of its own, and giving it one would be
   * invented data."
   */
  age: Age | null;
}

/**
 * Owns a 1Hz interval ONLY while a program runs (see `useCookProgress`), so at
 * rest this hook installs no timer at all. Call it from a leaf.
 */
export function useChassisReport(now: Date): ChassisReport {
  const { state } = useStore();
  const cook = useCookProgress();
  // Hooks run unconditionally; `takenAt` is null when nothing is running, and
  // ageOf() answers "never" for a reading that was never taken rather than
  // claiming an age for it.
  const timerAge = useAge("timer", cook?.takenAt ?? null);

  if (cook) {
    return {
      pattern: { kind: "sweep", fraction: cook.fraction },
      figure: cook.label,
      label: `cook program elapsed of ${cook.totalMin} minutes`,
      // II.3.18: no data for 2000ms and the display holds position, ink down,
      // stale word lit. The arc NEVER invents motion to cover the gap.
      age: timerAge,
    };
  }

  const info = todayInfo(now, state.prefs.cycleStartSaturday);
  if (!info.anchored || info.fortnightDay == null) {
    return {
      pattern: { kind: "rest" },
      // An em-dash, in the data voice: divergent-or-absent, never a zero
      // standing in for a day that has not been anchored.
      figure: "—",
      label: "fortnight position: not anchored, set a cycle-start saturday",
      age: null,
    };
  }

  const day = info.fortnightDay + 1; // 1..14, the way a human counts days
  return {
    pattern: { kind: "fill", fraction: day / FORTNIGHT_DAYS },
    figure: `${day}/${FORTNIGHT_DAYS}`,
    label: `fortnight position: day ${day} of ${FORTNIGHT_DAYS}`,
    age: null,
  };
}

/** The rail's own head field, 7x7 / 37 live (75.51% of its square). */
export function CycleCap({ now }: { now: Date }) {
  const report = useChassisReport(now);
  return (
    <GlyphField
      n={RAIL_N}
      radius={RAIL_RADIUS}
      size="3rem"
      pattern={report.pattern}
      figure={report.figure}
      unit={report.unit}
      label={report.label}
      stale={report.age?.stale ?? false}
      staleWord={report.age?.word}
      age={report.age?.label}
    />
  );
}

/**
 * The Close Read — the SAME reading at 25x25 / 489 live (78.24%, the chapter's
 * canonical crop). One object with two homes, never a second derivation.
 */
export function CloseRead({ now }: { now: Date }) {
  const report = useChassisReport(now);
  return (
    <GlyphField
      n={CANONICAL_N}
      radius={CANONICAL_RADIUS}
      size="clamp(9rem, 42vmin, 16rem)"
      figureSize="var(--cd-size-6)"
      pattern={report.pattern}
      figure={report.figure}
      unit={report.unit}
      label={report.label}
      stale={report.age?.stale ?? false}
      staleWord={report.age?.word}
      age={report.age?.label}
    />
  );
}
