// Small formatting helpers, local to COOK (ownership: src/screens/cook/**
// only — no shared format module exists across screens, same "deliberate
// small duplication" precedent as src/screens/meal/index.tsx's clock and
// src/screens/stores/countdown.ts's own text formatting).

/** Minutes (may be fractional, e.g. a 3.5-minute glaze reduction) -> "MM:SS",
 * clamped at zero (a scrub-preview or drift edge case could otherwise hand
 * this a small negative). Not capped at 60 minutes — programs can run past
 * an hour (Week A's 95-minute prep session), so this always renders total
 * minutes, never wrapping into an hours field (kept simple: no COOK program
 * in the dataset runs anywhere near 100 hours, so MM can just grow past 59).
 */
export function formatMinutesAsClock(totalMinutes: number): string {
  const totalSeconds = Math.max(0, Math.round(totalMinutes * 60));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Signed "+MM:SS" / "-MM:SS" for the scrub-preview readout (0 -> "now"). */
export function formatScrubOffset(minutes: number): string {
  if (Math.abs(minutes) < 1 / 120) return "now"; // sub-half-second -> treat as exactly "now"
  const sign = minutes < 0 ? "-" : "+";
  return `${sign}${formatMinutesAsClock(Math.abs(minutes))}`;
}
