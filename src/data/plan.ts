import raw from "../../data/plan.json";
import type { Band, Cover, Plan, Week, WeekTargets } from "./types";

// See data/meals.ts's comment on `as unknown as` — same static-JSON-vs-tuple
// (Band = [number, number]) typing gap, not a real mismatch.
export const plan: Plan = raw as unknown as Plan;

export function planTargets(week: Week): WeekTargets {
  return plan.targets[week];
}

export function bandsFor(week: Week, cover: Cover): { kcal: Band; protein: Band; netCarb: Band; fat: Band; fibre: Band } {
  return plan.targets[week][cover];
}

export const planDays = plan.days;
export const planThemes = plan.themes;
export const planTrain = plan.train;
export const planShops = plan.shops;
export const planNotes = plan.notes;
export const planEconomics = plan.economics;
