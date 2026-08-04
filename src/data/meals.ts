import raw from "../../data/meals.json";
import type { Meal, Slot, Week } from "./types";

// `as unknown as Meal[]`: the raw JSON's structural (excess-property /
// per-literal-union-member) typing doesn't collapse cleanly onto the hand
// written interface even though the shapes match at runtime — this is the
// standard escape hatch for static JSON imports, not a real type mismatch
// (data/validation.json + tools/extract's zod schemas are the actual runtime
// guarantee here).
export const mealsList: Meal[] = raw as unknown as Meal[];

export const mealsById: Record<string, Meal> = Object.fromEntries(mealsList.map((m) => [m.id, m]));

export function getMeal(id: string): Meal | undefined {
  return mealsById[id];
}

export function requireMeal(id: string): Meal {
  const m = mealsById[id];
  if (!m) throw new Error(`Unknown meal id: ${id}`);
  return m;
}

/** All four slots for a given week+day, in menu order. */
const SLOT_ORDER: Slot[] = ["breakfast", "lunch", "dinner", "snack"];

export function mealsByWeekDay(week: Week, day: number): Meal[] {
  return mealsList
    .filter((m) => m.week === week && m.day === day)
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
}

export function mealForSlot(week: Week, day: number, slot: Slot): Meal | undefined {
  return mealsList.find((m) => m.week === week && m.day === day && m.slot === slot);
}

export function mealsByWeek(week: Week): Meal[] {
  return mealsList.filter((m) => m.week === week);
}
