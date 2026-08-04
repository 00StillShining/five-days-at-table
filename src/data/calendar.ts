import raw from "../../data/calendar.json";
import type { CalendarEntry, CalendarVariant } from "./types";

export const calendarAll: CalendarEntry[] = raw as CalendarEntry[];

export function calendarVariant(variant: CalendarVariant): CalendarEntry[] {
  return calendarAll.filter((e) => e.variant === variant).sort((a, b) => a.day - b.day);
}

/** The canonical fortnight per D5 ("Week A, twice"). */
export const CANONICAL_VARIANT: CalendarVariant = "a-twice";

export function canonicalCalendar(): CalendarEntry[] {
  return calendarVariant(CANONICAL_VARIANT);
}

export function calendarEntryForDay(variant: CalendarVariant, day: number): CalendarEntry[] {
  return calendarVariant(variant).filter((e) => e.day === day);
}

/** Fortnight length in days for a-twice (day 0..13 inclusive, verified from data). */
export const FORTNIGHT_DAYS = 14;
