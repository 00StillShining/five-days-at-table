import { useEffect, useState } from "react";

/**
 * The single `prefers-reduced-motion` read this app should use from JS.
 * tokens.css's global `[data-motion]` rule already handles the CSS-only case
 * (suppressing a CSS transition) with no JS involved; THIS module is
 * specifically for screens whose reduced-motion behaviour is a TIMING
 * change, not just a suppressed transition — e.g. LIST skipping its ~1s
 * tick-settle grace period entirely (PLAN §6.9: reduced-motion makes the
 * reorder instant, no wait) rather than merely disabling an animation on an
 * unchanged delay.
 *
 * Promoted here (final integration review, INT-4) from two independent
 * implementations that had converged on the same MediaQueryList check:
 * LIST's `useReducedMotion` hook (src/screens/list/useReducedMotion.ts,
 * live-updating via a change listener, read on every render) and COOK's
 * Controls.tsx local `prefersReducedMotion()` (a one-shot imperative read,
 * no listener — called from inside an imperative gesture handler, which
 * can't call a hook). Both shapes are exported here so every call site keeps
 * the one that actually fits it:
 *  - `useReducedMotion()` — component render paths that need to re-render on
 *    a live OS-setting change.
 *  - `prefersReducedMotion()` — one-off imperative reads from inside event
 *    handlers or other non-component code.
 * `useReducedMotion` is built on top of `prefersReducedMotion` (same query,
 * not two independent implementations of the media-query string).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
