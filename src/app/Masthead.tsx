export interface MastheadProps {
  now: Date;
  cookRunning: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "Europe/London",
});

/** Brand + date, and a text status region for future "cooking · 12:40". */
export function Masthead({ now, cookRunning }: MastheadProps) {
  return (
    <header className="fd5-masthead">
      <span className="fd5-brand">fd-5</span>
      <span className="fd5-date">{dateFormatter.format(now).toLowerCase()}</span>
      <span className="fd5-status" role="status" aria-live="polite">
        {cookRunning ? "cooking · running" : ""}
      </span>
    </header>
  );
}
