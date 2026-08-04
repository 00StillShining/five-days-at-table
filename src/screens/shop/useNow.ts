import { useEffect, useState } from "react";

/**
 * SHOP's own ticking clock — SceneProps carries only `{ route }`
 * (src/app/router.ts), so any screen whose content depends on "now" owns its
 * own timer (mirrors src/screens/today/useNow.ts and
 * src/screens/stores/useNow.ts's identical pattern; screens can't import
 * each other, per PHASE2-CONTRACT "a screen folder may not import from
 * another screen folder").
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
