import { useEffect, useState } from "react";

/**
 * JS-level `prefers-reduced-motion` read (not just the CSS-only kill rule in
 * tokens.css) — LIST needs this in JS because the ~1s tick-settle grace
 * period is a TIMING behaviour, not just a CSS transition: PLAN §6.9 says
 * reduced-motion makes the reorder "instant" (no wait, no animation), which
 * this screen implements by skipping the setTimeout entirely rather than
 * merely disabling a CSS transition on an unchanged delay. Screen-local by
 * necessity (a screen folder may not import from another screen folder,
 * PHASE2-CONTRACT) — same small-duplication shape as useNow.ts across
 * STORES/TODAY.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
