export interface MastheadProps {
  now: Date;
  cookRunning: boolean;
  onOpenSettings: () => void;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "Europe/London",
});

/** Brand + date, a text status region for future "cooking · 12:40", and the settings gear. */
export function Masthead({ now, cookRunning, onOpenSettings }: MastheadProps) {
  return (
    <header className="fd5-masthead">
      <span className="fd5-brand">fd-5</span>
      <span className="fd5-date">{dateFormatter.format(now).toLowerCase()}</span>
      <span className="fd5-status" role="status" aria-live="polite">
        {cookRunning ? "cooking · running" : ""}
      </span>
      <button
        type="button"
        className="fd5-control fd5-gear"
        onClick={onOpenSettings}
        aria-label="settings"
      >
        <span aria-hidden="true">{"⚙"}</span>
      </button>
    </header>
  );
}
