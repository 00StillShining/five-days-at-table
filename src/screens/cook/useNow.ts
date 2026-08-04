import { useEffect, useState } from "react";

/**
 * COOK's own slow clock — only used by the standby program picker (which
 * meal is "tonight", is a defrost/expiry duty relevant) before any program
 * is loaded. Same 30s-freshness pattern as src/screens/today/useNow.ts and
 * src/screens/stores/useNow.ts; not shared across screen folders (ownership:
 * a screen folder may not import from another — PHASE2-CONTRACT.md), so this
 * is a deliberate small duplication, not a cross-screen import.
 *
 * Once a program is loaded, COOK stops relying on this clock entirely — all
 * timer-accurate rendering (elapsed/remaining, dueNow, track fills) comes
 * from engine/timers.ts's useProgram(), which owns its own 1Hz tick while a
 * program is actually running and needs no help from this hook.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
