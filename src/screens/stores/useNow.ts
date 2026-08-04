import { useEffect, useState } from "react";

/**
 * STORES' own ticking clock — SceneProps carries only `{ route }`
 * (src/app/router.ts), so any screen whose content depends on "now" owns its
 * own timer (mirrors src/screens/today/useNow.ts's identical pattern and
 * src/app/App.tsx's masthead clock; screens can't import each other, so this
 * small duplication is the documented, expected shape — see PHASE2-CONTRACT
 * "a screen folder may not import from another screen folder").
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
