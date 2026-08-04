// Standby-picker data helpers (PLAN §6.6: "tonight's meal first (from
// dutyStack/effectiveMealForSlot), then the two Sunday sessions, then any
// meal (grouped list)"). Pure functions only — index.tsx wires them to state.
import { getMeal, mealsByWeek, prepSessionForWeek, prepSessionId } from "../../data";
import type { Meal, PrepSession, Week } from "../../data/types";
import { getProgram } from "../../engine/programs";
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

/** The `Week` a prep programId belongs to, or null for a meal id. */
export function prepWeekForProgramId(programId: string): Week | null {
  if (programId === "prep-a") return "A";
  if (programId === "prep-b") return "B";
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
}

/** The two Sunday batch sessions, in a fixed A-then-B order (both always
 * exist in the dataset — prep.json carries exactly one session per week). */
export function prepSessionOptions(): PrepSessionOption[] {
  return (["A", "B"] as Week[])
    .map((week) => {
      const session = prepSessionForWeek(week);
      if (!session) return null;
      const programId = prepSessionId(session);
      const program = getProgram(programId);
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

/** "Any meal" — every approved meal (PHASE2-CONTRACT: "programs compiled
 * from approved meals' tracks"; all 40/40 are approved today, but this
 * stays defensive against a future unapproved draft landing in the data),
 * grouped week -> day -> slot order, for a browsable picker distinct from
 * "tonight" and the two prep sessions above. */
export function groupedMealOptions(): MealWeekGroup[] {
  return (["A", "B"] as Week[]).map((week) => {
    const byDay = new Map<number, Meal[]>();
    for (const meal of mealsByWeek(week)) {
      if (!meal.method.approved) continue;
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
  });
}

export function resolveTonightMeal(duty: StartByDuty | null): Meal | null {
  return duty ? (getMeal(duty.mealId) ?? null) : null;
}
