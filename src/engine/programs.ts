// Compile meals' rewritten parallel-track methods and prep sessions' elapsed-
// clock ops into a single timed `Program` shape that engine/timers.ts drives.
//
// HEURISTIC — critical path (documented per the F2 standing rule):
// `clockStart` on a method step is an ABSOLUTE elapsed-minute offset from the
// program's start, SHARED across all tracks (verified: b-d5d's rice track
// step 7 starts at clockStart 23 while step 1 in the same track is still
// "running" from clockStart 0 for 25 minutes — clockStart cannot be
// per-track-cumulative or that would be impossible). So a step's end point is
// simply `clockStart + (minutes ?? 0)`, and the program's total length is the
// max of that across every step, regardless of track — tested against every
// approved meal's steps; matches PLAN's own worked example (b-d5d ends at
// exactly clockStart 25, its `activeMin`).
// (`activeMin` on Meal is a separate hands-on-time metric authored
// independently of the clock timeline — the two disagree on most meals
// because `activeMin` excludes passive simmer/bake/rest time. Don't use it as
// a critical-path check; it isn't one.)
// Fallback: a handful of simple (untracked, unclocked) meals carry no
// `clockStart` at all — for those, steps are assumed sequential and the
// total is just the sum of their `minutes`.
import type { Meal, MethodStep, PrepOp, PrepSession } from "../data/types";
import { getMeal } from "../data/meals";
import { prepSessionById, prepSessionId, parseClock } from "../data/prep";
import type { ActiveVariant } from "../data/variant";

export interface ProgramStep {
  n: number;
  text: string;
  minutes: number | null;
  tempC: number | null;
  track: string; // never null on a compiled ProgramStep — null collapses to "general"
  station: string | null;
  clockStart: number | null;
  untimed: boolean;
  /** Fable review FIX round: only ever set by `compilePrepProgramFiltered`
   * (the tester's reduced Sunday session) — full-mode compiles
   * (`compileMealProgram`/`compilePrepProgram`) never touch this field, so
   * it stays `undefined` there, identical to before this field existed. A
   * short, human, op-specific note ("skip tray B — jerk chickpeas aren't in
   * the starter; the tin is Monday's lunch") COOK renders quietly next to
   * this step, sourced from docs/VARIANT-SPEC.md's per-op `testerNote`. */
  testerNote?: string;
}

export interface ProgramTrack {
  id: string;
  steps: ProgramStep[];
  /** max(clockStart + minutes) across this track's steps; 0 if untimed throughout. */
  totalMinutes: number;
}

export interface Program {
  id: string; // meal id, or prep session id ("prep-a" | "prep-b")
  kind: "meal" | "prep";
  title: string;
  totalMinutes: number;
  steps: ProgramStep[]; // flat, all tracks, in original authored order
  tracks: ProgramTrack[];
}

const GENERAL_TRACK = "general";

/** The critical-path formula documented above — the one function selectors.ts
 * (tonight's start-by) and this module both use, so the two stay consistent. */
export function criticalPathMinutes(steps: Pick<MethodStep, "clockStart" | "minutes">[]): number {
  const clocked = steps.filter((s) => s.clockStart != null);
  if (clocked.length === 0) {
    return steps.reduce((sum, s) => sum + (s.minutes ?? 0), 0);
  }
  return Math.max(...clocked.map((s) => s.clockStart! + (s.minutes ?? 0)));
}

function buildTracks(steps: ProgramStep[]): ProgramTrack[] {
  const byTrack = new Map<string, ProgramStep[]>();
  for (const step of steps) {
    const list = byTrack.get(step.track) ?? [];
    list.push(step);
    byTrack.set(step.track, list);
  }
  const tracks: ProgramTrack[] = [];
  for (const [id, trackSteps] of byTrack) {
    tracks.push({ id, steps: trackSteps, totalMinutes: criticalPathMinutes(trackSteps) });
  }
  return tracks;
}

export function compileMealProgram(meal: Meal): Program {
  const steps: ProgramStep[] = meal.method.steps.map((s) => ({
    n: s.n,
    text: s.text,
    minutes: s.minutes,
    tempC: s.tempC,
    track: s.track ?? GENERAL_TRACK,
    station: s.station,
    clockStart: s.clockStart,
    untimed: s.untimed ?? false,
  }));
  return {
    id: meal.id,
    kind: "meal",
    title: meal.name,
    totalMinutes: criticalPathMinutes(steps),
    steps,
    tracks: buildTracks(steps),
  };
}

/** Prep ops have no explicit `track` field, but each op names a `station`
 * ("Hob 1", "Oven", "Processor" …) that plays the identical role: ops on the
 * same station are sequential, ops on different stations run in parallel —
 * exactly the elapsed-clock structure the Sunday run-orders already use. So
 * `station` becomes the compiled program's track id. */
function compilePrepOp(op: PrepOp, n: number): ProgramStep {
  return {
    n,
    text: op.body ? `${op.title} — ${op.body}` : op.title,
    minutes: op.minutes,
    tempC: op.tempC,
    track: op.station || GENERAL_TRACK,
    station: op.station || null,
    clockStart: parseClock(op.clock),
    untimed: op.untimed ?? false,
  };
}

export function compilePrepProgram(session: PrepSession): Program {
  const steps = session.ops.map((op, i) => compilePrepOp(op, i + 1));
  return {
    id: prepSessionId(session),
    kind: "prep",
    title: session.sessionName,
    totalMinutes: criticalPathMinutes(steps),
    steps,
    tracks: buildTracks(steps),
  };
}

/** Resolve any program id (a meal id like "b-d5d", or a prep session id like
 * "prep-a"/"prep-b") to its compiled Program. Returns null for an unknown id
 * (defensive — e.g. stale persisted `timers.programId` after a data change)
 * rather than throwing, since this sits on the reload/restore path (R4). */
export function getProgram(id: string): Program | null {
  const prep = prepSessionById(id);
  if (prep) return compilePrepProgram(prep);
  const meal = getMeal(id);
  if (meal) return compileMealProgram(meal);
  return null;
}

/** Suffix appended to a base prep session id ("prep-a") to make the tester's
 * reduced program id ("prep-a-tester") — used both by
 * `compilePrepProgramFiltered` (below) and COOK's picker (which offers this
 * id instead of the full session's when the tester variant is active). */
export const TESTER_PROGRAM_SUFFIX = "-tester";

/**
 * docs/VARIANT-SPEC.md's `prep.keptOps`: compiles a Sunday session down to
 * only the ops that feed a kept meal — "the reduced 'starter Sunday
 * session'" COOK shows in tester mode, reusing the exact same program
 * compiler (`compilePrepOp`/`buildTracks`/`criticalPathMinutes`) so its
 * timing math can't drift from the full session's. Steps are renumbered
 * 1..N in filtered order (not the original ops' indices) — `n` only needs to
 * be a stable, sequential identity for THIS compiled program's own
 * doneSteps bookkeeping (engine/timers.ts), not a pointer back into the
 * original session.
 */
export function compilePrepProgramFiltered(
  session: PrepSession,
  keptOps: readonly { opIndex: number; testerNote?: string }[]
): Program {
  const noteByOpIndex = new Map(keptOps.map((k) => [k.opIndex, k.testerNote]));
  const keptIndices = new Set(keptOps.map((k) => k.opIndex));
  const filtered = session.ops.map((op, i) => ({ op, i })).filter(({ i }) => keptIndices.has(i));
  const steps = filtered.map(({ op, i }, n) => {
    const step = compilePrepOp(op, n + 1);
    const testerNote = noteByOpIndex.get(i);
    return testerNote ? { ...step, testerNote } : step;
  });
  return {
    id: `${prepSessionId(session)}${TESTER_PROGRAM_SUFFIX}`,
    kind: "prep",
    title: `${session.sessionName} — starter`,
    totalMinutes: criticalPathMinutes(steps),
    steps,
    tracks: buildTracks(steps),
  };
}

/**
 * Variant-aware program resolver: COOK's `useProgram()` (engine/timers.ts)
 * calls this instead of `getProgram` directly, so a tester-mode-only id
 * (`"prep-a-tester"`) resolves to the filtered program while every other id
 * — including in full mode, where this branch never taps — falls straight
 * through to `getProgram`, byte-identical to before this function existed.
 */
export function getVariantProgram(id: string, variant: ActiveVariant): Program | null {
  if (variant.isTester && variant.prep && id === `${variant.prep.sessionBase}${TESTER_PROGRAM_SUFFIX}`) {
    const session = prepSessionById(variant.prep.sessionBase);
    if (session) return compilePrepProgramFiltered(session, variant.prep.keptOps);
  }
  return getProgram(id);
}
