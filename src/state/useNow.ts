import { useEffect, useState } from "react";

/**
 * Shared ticking clock for screens whose content depends on the current time
 * (defrost due-times, start-by countdowns, day-boundary/weekend detection)
 * but don't have a live program timer of their own — COOK's actual
 * per-second precision comes from engine/timers.ts's `useProgram()` once a
 * program is running; this hook is for everything else.
 *
 * Promoted here (wave-1 integration review) from four byte-identical
 * per-screen copies (src/screens/{today,stores,cook}/useNow.ts, plus
 * src/screens/shop/useNow.ts differing only in its interval default) —
 * those screens each duplicated it because a screen folder may not import
 * from another screen folder (PHASE2-CONTRACT.md), but src/state/** is fair
 * game for all of them, and four screens computing arbiter-relevant
 * freshness independently risked exactly the kind of same-fact,
 * different-answer drift the review is about (see also
 * src/state/london.ts's formatRemainingDays).
 *
 * Default 30s matches TODAY/STORES/COOK's existing default; SHOP used 60s —
 * pass `useNow(60_000)` explicitly for that screen's cadence. Screens adopt
 * this in their own pass (not touched here); each local useNow.ts stays
 * until then.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
