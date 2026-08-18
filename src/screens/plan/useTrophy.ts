/**
 * src/screens/plan/useTrophy.ts — Instrument -> Trophy, and the wall it earns.
 *
 * Owner ruling: every screen carries Trophy Mode.
 *
 *   idle to enter ......... 90 000ms
 *   enter ................. 420ms
 *   exit .................. 240ms       on ANY input
 *   both retarget in flight — nothing finishes an obsolete transition
 *   burn-in ............... 2px, 8 positions, 240 000ms per step,
 *                           the whole composition moving AS ONE RIGID FRAME
 *   luminance ............. 1.00 active / 0.55 ambient / 0.20 night,
 *                           4000ms linear between tiers
 *
 * ---------------------------------------------------------------------------
 * THE NIGHT TIER IS DECLARED AND NEVER ENTERED (CORRECTIONARY 6.5)
 * ---------------------------------------------------------------------------
 * screencraft/01 gates Night on an AMBIENT SENSOR confirming the room has gone
 * dark. No such sensor is available to this build — `AmbientLightSensor` ships
 * in no browser this product targets, and `prefers-color-scheme` reports a user
 * preference, not a room. Guessing darkness from the clock would be invented
 * data. So the tier is declared, its token is committed, its rule is in the
 * stylesheet, and NOTHING DRIVES IT. Stated rather than quietly dropped.
 *
 * ---------------------------------------------------------------------------
 * PROMOTION CANDIDATE — reported, not imported (CD-BRIEF zone fence)
 * ---------------------------------------------------------------------------
 * This file is now byte-for-byte equivalent in behaviour to
 * src/screens/today/useTrophy.ts and src/screens/cook/useTrophy.ts. It carries
 * no language tokens and no screen knowledge, so it is a foundry primitive
 * wearing a screen's folder. It is copied rather than imported because a screen
 * importing another screen is the cross-screen coupling the brief forbids, and
 * `src/cd/**` is not this builder's to edit. Reported for promotion to
 * `src/cd/foundry` (or `src/cd/shed`), where one copy would replace three.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export const TROPHY_IDLE_MS = 90_000;
export const TROPHY_ENTER_MS = 420;
export const TROPHY_EXIT_MS = 240;

export const ORBIT_POSITIONS = 8;
export const ORBIT_RADIUS_PX = 2;
export const ORBIT_STEP_MS = 240_000;

export type PowerTier = "active" | "ambient" | "night";

export interface TrophyState {
  trophy: boolean;
  /** 0..7 — the burn-in orbit's current seat. */
  orbit: number;
  power: PowerTier;
  /** Live, readable inside an event handler without waiting for a render. */
  isTrophy: () => boolean;
}

/**
 * "Any input" is deliberately broad and deliberately NOT `pointermove`: a mouse
 * resting on a desk that a lorry drives past still generates moves, and a board
 * that will not settle because the room has vibrations is not a trophy.
 */
const WAKE_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

export function useTrophy(enabled = true): TrophyState {
  const [trophy, setTrophy] = useState(false);
  const [orbit, setOrbit] = useState(0);
  const trophyRef = useRef(false);
  const idleRef = useRef<number | null>(null);

  const arm = useCallback(() => {
    if (idleRef.current != null) window.clearTimeout(idleRef.current);
    idleRef.current = window.setTimeout(() => {
      trophyRef.current = true;
      setTrophy(true);
    }, TROPHY_IDLE_MS);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const wake = () => {
      if (trophyRef.current) {
        trophyRef.current = false;
        setTrophy(false);
      }
      arm();
    };
    for (const type of WAKE_EVENTS) window.addEventListener(type, wake, { passive: true, capture: true });
    arm();
    return () => {
      for (const type of WAKE_EVENTS) window.removeEventListener(type, wake, { capture: true });
      if (idleRef.current != null) window.clearTimeout(idleRef.current);
    };
  }, [arm, enabled]);

  /** II.4.17 — offscreen is asleep: the orbit interval is dropped with the mode. */
  useEffect(() => {
    if (!trophy) return;
    const id = window.setInterval(() => setOrbit((o) => (o + 1) % ORBIT_POSITIONS), ORBIT_STEP_MS);
    return () => window.clearInterval(id);
  }, [trophy]);

  return {
    trophy,
    orbit,
    power: trophy ? "ambient" : "active",
    isTrophy: () => trophyRef.current,
  };
}

/** The orbit seat as a translate, computed once per step, applied to ONE node. */
export function orbitOffset(index: number): { x: number; y: number } {
  const a = (index / ORBIT_POSITIONS) * Math.PI * 2;
  return {
    x: Number((Math.cos(a) * ORBIT_RADIUS_PX).toFixed(3)),
    y: Number((Math.sin(a) * ORBIT_RADIUS_PX).toFixed(3)),
  };
}
