import { useCookElapsedLabel } from "./cookRunningStub";

export interface MastheadProps {
  now: Date;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "Europe/London",
});

/**
 * Small, isolated leaf: the ONLY thing in the chassis that ticks at 1Hz while
 * a program runs (PLAN §6.2: "cooking · 12:40"). It calls useCookElapsedLabel()
 * directly rather than receiving elapsed time as a prop, so its per-second
 * re-renders stay scoped to this one component — Masthead itself, and
 * everything above it, never re-renders on the tick.
 *
 * The ticking "MM:SS" text is visual only (aria-hidden): with the parent
 * `.fd5-status` region set aria-live="polite", a value that changed every
 * second would make assistive tech announce a new time once a second — a
 * real interruption, not a courtesy. The accessible announcement is a
 * separate, stable "cooking" string that only changes (mount/unmount) on
 * genuine start/stop, which is the only transition worth announcing.
 */
function CookStatusText() {
  const elapsed = useCookElapsedLabel();
  if (elapsed == null) return null;
  return (
    <>
      <span aria-hidden="true">{`cooking · ${elapsed}`}</span>
      <span className="fd5-visually-hidden">cooking</span>
    </>
  );
}

/** Brand + date, and a text status region showing "cooking · MM:SS" while a program runs. */
export function Masthead({ now }: MastheadProps) {
  return (
    <header className="fd5-masthead">
      <span className="fd5-brand">fd-5</span>
      <span className="fd5-date">{dateFormatter.format(now).toLowerCase()}</span>
      <span className="fd5-status" role="status" aria-live="polite">
        <CookStatusText />
      </span>
    </header>
  );
}
