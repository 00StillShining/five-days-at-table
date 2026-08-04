import raw from "../../data/prep.json";
import type { PrepSession, Week } from "./types";

export const prepSessions: PrepSession[] = raw as PrepSession[];

export function prepSessionForWeek(week: Week): PrepSession | undefined {
  return prepSessions.find((s) => s.week === week);
}

/** Session id used by engine/programs.ts and Meal.method.batchSource ("prep-a" | "prep-b"). */
export function prepSessionId(session: PrepSession): string {
  return session.week === "A" ? "prep-a" : "prep-b";
}

export function prepSessionById(id: string): PrepSession | undefined {
  return prepSessions.find((s) => prepSessionId(s) === id);
}

/** Parse a prep op's "H:MM" elapsed-clock string into minutes since session start. */
export function parseClock(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
}
