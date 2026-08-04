// Europe/London date/time helpers built on Intl + epoch math only (no date
// libs, per contract). Two distinct kinds of calculation live here, kept
// deliberately separate because mixing them is a classic timezone bug:
//
//  - "calendar date" arithmetic (the fortnight anchor, `cycleStartSaturday`,
//    is a plain Y-M-D with no time-of-day): adding/diffing days is pure UTC
//    integer-day math, no timezone conversion involved at all.
//  - "wall-clock instant" conversion (turning "18:00 on London calendar date
//    D" into an actual epoch ms, e.g. for a defrost due-time) DOES need the
//    Europe/London offset, which changes across the BST/GMT boundary.

const MS_PER_DAY = 86_400_000;

export interface LondonParts {
  y: number;
  m: number; // 1-12
  d: number;
  weekday: string; // "Mon" .. "Sun"
  hour: number; // 0-23
  minute: number;
}

/** Read the Europe/London calendar date + wall-clock time an instant falls on. */
export function londonParts(date: Date): LondonParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  // Midnight sometimes formats as "24:00" under hour12:false in some engines; normalize.
  const hour = Number(parts.hour) % 24;
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), weekday: parts.weekday, hour, minute: Number(parts.minute) };
}

export function londonDateIso(date: Date): string {
  const { y, m, d } = londonParts(date);
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" -> integer day number (pure calendar-date arithmetic, UTC-anchored). */
export function isoDateToDayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

export function dayNumberToIsoDate(dayNumber: number): string {
  const ms = dayNumber * MS_PER_DAY;
  const dt = new Date(ms);
  return `${String(dt.getUTCFullYear()).padStart(4, "0")}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" + N calendar days -> "YYYY-MM-DD". */
export function addCalendarDays(iso: string, days: number): string {
  return dayNumberToIsoDate(isoDateToDayNumber(iso) + days);
}

/** Integer count of Europe/London calendar days between two instants
 * (`to` minus `from`), using each instant's local calendar date — this is
 * what the fortnight-anchor math (selectors.ts todayInfo) needs, not a raw
 * 24h-bucket difference (which would misbehave across a DST change). */
export function londonCalendarDaysBetween(fromIso: string, to: Date): number {
  return isoDateToDayNumber(londonDateIso(to)) - isoDateToDayNumber(fromIso);
}

/** The Europe/London UTC offset (minutes, e.g. 0 for GMT / 60 for BST) in
 * effect at a given instant, derived via the standard Intl round-trip trick
 * (format the instant in the target zone, reinterpret that wall-clock
 * reading as UTC, diff against the original instant). */
function londonOffsetMinutesAt(utcMs: number): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
  return (asUtc - utcMs) / 60_000;
}

/** Convert a London wall-clock time on a given calendar date ("YYYY-MM-DD",
 * hh, mm) into the actual epoch ms instant it refers to — correct across the
 * BST/GMT boundary. Used for duty due-times ("by 18:00"). */
export function londonWallTimeToEpochMs(isoDate: string, hh: number, mm: number): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const offsetMin = londonOffsetMinutesAt(utcGuess);
  return utcGuess - offsetMin * 60_000;
}
