export interface DayPadInfo {
  dayNo: number; // 1..5
  done: boolean; // every planned slot for this calendar date has a household tick
  isToday: boolean;
}

export interface DayPadsProps {
  days: DayPadInfo[];
}

const WEEKDAY_NAME: Record<number, string> = {
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
};

/**
 * Header day-pad row (PLAN §6.3): five fixed pads for this calendar week's Mon-Fri,
 * a filled dot for an all-logged day and a focus-family ring for "today" — position
 * (which pad) plus a second visual cue (dot fill vs. outline; ring vs. no ring) carry
 * the state, never color alone, and both are restated in an sr-only sentence per pad.
 * Purely informational (not specified as a nav control anywhere in §6.3), so plain
 * non-interactive list items rather than invented buttons.
 */
export function DayPads({ days }: DayPadsProps) {
  return (
    <ul className="scr-today-pads" aria-label="this week, monday to friday">
      {days.map((d) => (
        <li
          key={d.dayNo}
          className={["scr-today-pad", d.isToday && "scr-today-pad--today", d.done && "scr-today-pad--done"]
            .filter(Boolean)
            .join(" ")}
          aria-current={d.isToday ? "date" : undefined}
        >
          <span className="scr-today-pad-num" aria-hidden="true">
            {d.dayNo}
          </span>
          <span className="scr-today-pad-dot" aria-hidden="true" />
          <span className="fd5-visually-hidden">
            day {d.dayNo}, {WEEKDAY_NAME[d.dayNo]}
            {d.isToday ? ", today" : ""}
            {d.done ? ", all logged" : ", not fully logged"}
          </span>
        </li>
      ))}
    </ul>
  );
}
