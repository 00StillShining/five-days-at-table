/**
 * src/screens/cook/useTrophy.ts — the wall face's own clock.
 *
 * Owner ruling, every screen: idle 90s enters Trophy Mode over 420ms; ANY input
 * exits it over 240ms; both retarget in flight. Burn-in is 2px on an
 * 8-position orbit stepped every 240s, applied as ONE RIGID FRAME — the whole
 * face moves together, because a per-element jitter would be eight independent
 * motions with nothing behind any of them.
 *
 * RETARGETING IN FLIGHT is why the enter/exit is a CSS TRANSITION and not a
 * keyframe animation: a transition interrupted mid-flight re-aims from the
 * current computed value natively (II.4.15, II.1.17 — "nothing resets, nothing
 * queues, and no animation finishes out of respect for its own past"). A
 * keyframe animation restarted at 30% of its 420ms enter would snap to 0 and
 * replay. cook.css carries the pair; this hook owns only the decision.
 *
 * II.4.17 — offscreen is asleep: a hidden tab neither counts down toward the
 * wall face nor steps the burn-in orbit.
 *
 * THE TROPHY IS NEVER THE ONLY ROUTE TO AN ACTION. It carries none: every input
 * that could reach a control exits first, in 240ms, and lands the operator back
 * on the instrument face with the control where they left it.
 */

import { useEffect, useRef, useState } from "react";

/** Owner ruling. */
export const IDLE_MS = 90_000;
export const ENTER_MS = 420;
export const EXIT_MS = 240;

/** Burn-in: 2px, eight positions, one step every 240s. */
export const BURN_IN_PX = 2;
export const BURN_IN_POSITIONS = 8;
export const BURN_IN_STEP_MS = 240_000;

/** The events that count as a hand arriving. Scroll and hover are inputs too. */
const WAKE_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "touchstart",
  "focusin",
] as const;

export interface TrophyState {
  trophy: boolean;
  /** 0..7 — the burn-in orbit position, stepped every 240s while at the wall. */
  orbit: number;
}

export function useTrophy(enabled = true): TrophyState {
  const [trophy, setTrophy] = useState(false);
  const [orbit, setOrbit] = useState(0);
  const idleTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const clear = (): void => {
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      idleTimer.current = null;
    };
    const arm = (): void => {
      clear();
      if (document.visibilityState === "hidden") return; // II.4.17
      idleTimer.current = window.setTimeout(() => setTrophy(true), IDLE_MS);
    };
    const wake = (): void => {
      setTrophy((was) => (was ? false : was));
      arm();
    };

    for (const type of WAKE_EVENTS) {
      window.addEventListener(type, wake, { passive: true, capture: true });
    }
    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") clear();
      else arm();
    };
    document.addEventListener("visibilitychange", onVisibility);
    arm();

    return () => {
      clear();
      for (const type of WAKE_EVENTS) {
        window.removeEventListener(type, wake, { capture: true });
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  // The orbit only steps while the face is actually at the wall, and only while
  // the tab is visible: a burn-in guard for pixels nobody is looking at is a
  // timer with nothing behind it.
  useEffect(() => {
    if (!trophy || typeof window === "undefined") return;
    const id = window.setInterval(
      () => setOrbit((k) => (k + 1) % BURN_IN_POSITIONS),
      BURN_IN_STEP_MS
    );
    return () => window.clearInterval(id);
  }, [trophy]);

  return { trophy, orbit };
}

/** The rigid offset for an orbit position, in CSS px. */
export function orbitOffset(k: number): { x: number; y: number } {
  const a = (k / BURN_IN_POSITIONS) * Math.PI * 2;
  return {
    x: Math.round(Math.cos(a) * BURN_IN_PX * 100) / 100,
    y: Math.round(Math.sin(a) * BURN_IN_PX * 100) / 100,
  };
}
