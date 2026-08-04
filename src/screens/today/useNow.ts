import { useEffect, useState } from "react";

/**
 * TODAY's own ticking clock. SceneProps carries only `{ route }` (src/app/router.ts)
 * — no chassis-level `now` reaches screens — so any screen whose content depends on
 * the current time owns its own clock, mirroring src/app/App.tsx's masthead-clock
 * pattern (60s there). 30s here is plenty of resolution for this screen's own
 * time-sensitive reads (defrost "by 18:00" due-time, tonight's "start by HH:MM",
 * which day pad is "today"); COOK's actual timers are timestamp-math in
 * engine/timers.ts and don't depend on any screen's re-render cadence.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
