// Standby-picker data helpers (PLAN §6.6: "tonight's meal first (from
// dutyStack/effectiveMealForSlot), then the two Sunday sessions, then any
// meal (grouped list)"). Pure functions only — index.tsx wires them to state.
import { getMeal, mealsByWeek, prepSessionForWeek, prepSessionId } from "../../data";
import type { Meal, PrepSession, Week } from "../../data/types";
import { activeVariant, type ActiveVariant } from "../../data/variant";
import { getVariantProgram, TESTER_PROGRAM_SUFFIX } from "../../engine/programs";
import type { StartByDuty } from "../../state/selectors";
import { dutyStack } from "../../state/selectors";
import type { AppState } from "../../state/types";

const SLOT_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;

/** Tonight's dinner, the same meal (swap-resolved) and the same critical-path
 * "start by" calculation TODAY's duty stack already shows — reusing
 * dutyStack's own start-by duty rather than re-deriving it keeps the two
 * screens' "tonight" from ever disagreeing. null on a weekend (dutyStack
 * only emits a start-by duty Mon-Fri, PLAN §1: "Sat/Sun carry duties, not
 * plated meals") or before the fortnight is anchored. */
export function tonightDuty(state: AppState, now: Date): StartByDuty | null {
  const duties = dutyStack(state, now);
  return duties.find((d): d is StartByDuty => d.kind === "start-by") ?? null;
}

/**
 * `prep.json`'s `sessionName` field is prose ("one session, ninety-five
 * minutes, mostly waiting"), not a title — it reads fine as a secondary
 * description but is wrong as the program's NAME (coordinator FIX round,
 * item 2: the picker/tally were showing that prose where a name belongs).
 * This is the one proper name every prep program display should use.
 */
export function prepProgramDisplayName(week: Week): string {
  return `Week ${week} Sunday session`;
}

/** The `Week` a prep programId belongs to, or null for a meal id. Strips a
 * tester-mode `-tester` suffix first (`"prep-a-tester"` -> `"prep-a"` ->
 * `"A"`) — COOK's index.tsx uses this to decide "is this a prep program" for
 * both the running Reel's title/subtitle split AND the completion tally, and
 * both need to keep working for the tester's reduced session, not just the
 * full ones. */
export function prepWeekForProgramId(programId: string): Week | null {
  const base = programId.endsWith(TESTER_PROGRAM_SUFFIX) ? programId.slice(0, -TESTER_PROGRAM_SUFFIX.length) : programId;
  if (base === "prep-a") return "A";
  if (base === "prep-b") return "B";
  return null;
}

export interface PrepSessionOption {
  week: Week;
  programId: string;
  session: PrepSession;
  /** The COMPILED program's total (engine/programs.ts's `criticalPathMinutes`
   * over every op's clockStart+minutes) — NOT `session.totalMin` (the
   * authored figure, e.g. 95 for week A's session, vs. a compiled 100). The
   * picker and the running reel must show the same one number for the same
   * program (coordinator FIX round, item 2), so this is sourced from the
   * same compiled Program the reel itself reads its total from. Falls back
   * to `session.totalMin` only if compilation somehow fails (defensive). */
  totalMinutes: number;
  /** Set only on the tester's reduced option — a short, picker-appropriate
   * human line ("starter cut of the Sunday session — 10 of 15 ops"), shown
   * in place of the full session's own `sessionName` prose (which would
   * otherwise describe ops that no longer exist in this program).
   * Deliberately NOT `variant.prep.note` (Fable review, FIX round: that
   * field is data-plumbing provenance — "ops whose yield(s) feed no kept
   * meal are dropped... Anomaly: prep-a's op1 body reads '600 g chicken
   * breast' but..." — off-lean for COOK's picker; that prose stays in the
   * data layer only, never rendered here). */
  reducedNote?: string;
}

/**
 * The Sunday batch session(s) — full mode: the two, A-then-B (both always
 * exist in the dataset). Tester mode (docs/VARIANT-SPEC.md: "the reduced
 * 'starter Sunday session'... full sessions hidden in tester mode"): exactly
 * ONE option, the filtered `<sessionBase>-tester` program built from the
 * variant's own `keptOps`. `variant` defaults to full (backward compatible
 * with any pre-existing call site that doesn't pass one).
 */
export function prepSessionOptions(variant: ActiveVariant = activeVariant({ prefs: { planVariant: "full" } })): PrepSessionOption[] {
  if (variant.isTester && variant.prep) {
    const testerProgramId = `${variant.prep.sessionBase}${TESTER_PROGRAM_SUFFIX}`;
    const program = getVariantProgram(testerProgramId, variant);
    const baseSession = prepSessionForWeek(variant.week);
    if (!program || !baseSession) return [];
    const keptCount = variant.prep.keptOps.length;
    const totalCount = baseSession.ops.length;
    return [
      {
        week: variant.week,
        programId: testerProgramId,
        session: baseSession,
        totalMinutes: program.totalMinutes,
        reducedNote: `starter cut of the Sunday session — ${keptCount} of ${totalCount} ops`,
      },
    ];
  }
  return (["A", "B"] as Week[])
    .map((week) => {
      const session = prepSessionForWeek(week);
      if (!session) return null;
      const programId = prepSessionId(session);
      const program = getVariantProgram(programId, variant);
      return { week, programId, session, totalMinutes: program?.totalMinutes ?? session.totalMin };
    })
    .filter((x): x is PrepSessionOption => x != null);
}

export interface MealDayGroup {
  day: number;
  meals: Meal[];
}

export interface MealWeekGroup {
  week: Week;
  days: MealDayGroup[];
}

/**
 * "Any meal" — every approved meal (PHASE2-CONTRACT: "programs compiled
 * from approved meals' tracks"; all 40/40 are approved today, but this
 * stays defensive against a future unapproved draft landing in the data),
 * grouped week -> day -> slot order, for a browsable picker distinct from
 * "tonight" and the two prep sessions above.
 *
 * `variant` (default full, backward compatible): docs/VARIANT-SPEC.md
 * "COOK: picker lists kept meals only... full sessions hidden in tester
 * mode" — tester mode restricts this browsable list to the ten kept meals
 * (Week A only, since the tester has no Week-B browsing pool); a week whose
 * every meal gets filtered out (Week B, entirely) is dropped rather than
 * rendered as an empty group.
 */
export function groupedMealOptions(variant: ActiveVariant = activeVariant({ prefs: { planVariant: "full" } })): MealWeekGroup[] {
  return (["A", "B"] as Week[])
    .map((week) => {
      const byDay = new Map<number, Meal[]>();
      for (const meal of mealsByWeek(week)) {
        if (!meal.method.approved) continue;
        if (variant.isTester && !variant.isKeptMealId(meal.id)) continue;
        const list = byDay.get(meal.day) ?? [];
        list.push(meal);
        byDay.set(meal.day, list);
      }
      const days: MealDayGroup[] = [...byDay.entries()]
        .sort(([a], [b]) => a - b)
        .map(([day, meals]) => ({
          day,
          meals: meals.slice().sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)),
        }));
      return { week, days };
    })
    .filter((group) => group.days.length > 0);
}

export function resolveTonightMeal(duty: StartByDuty | null): Meal | null {
  return duty ? (getMeal(duty.mealId) ?? null) : null;
}
