/**
 * src/screens/list/useTrophy.ts — Instrument -> Trophy, on the shop screen.
 *
 * Owner ruling: every screen carries Trophy Mode, with these committed numbers:
 *   idle to enter ......... 90 000ms
 *   enter ................. 420ms   (II.4.23's re-composition)
 *   exit .................. 240ms   on ANY input
 *   both retarget in flight — nothing finishes an obsolete transition
 *   burn-in ............... 2px, 8 positions, 240 000ms per step, the whole
 *                           composition moving AS ONE RIGID FRAME
 *   luminance ............. 1.00 active / 0.55 ambient / 0.20 night,
 *                           4000ms linear between tiers
 *
 * IRREDUCIBLE's own Trophy clause is what the mode MEANS here: "Every healthy
 * station simply is not rendered — a blank plate has nothing to report, and this
 * language does not spend a pixel proving a fact already true by absence." A
 * phone left face-up on a shop counter reports what is still owed and nothing
 * else. What never disappears is the exception list: anything past its own
 * window, the freshness of the whole read, and the hero count itself.
 *
 * ---------------------------------------------------------------------------
 * DUPLICATION, DECLARED (CORRECTIONARY 6.5)
 * ---------------------------------------------------------------------------
 * This is the second byte-for-byte copy of these constants in the product; TODAY
 * carries the first (src/screens/today/useTrophy.ts). Screen folders may not
 * import from one another (PHASE2-CONTRACT), and the hook does not live in
 * src/cd/**, which this builder may not write to. So it is copied, and the
 * request to promote it to src/cd/trophy/ is in the build report rather than
 * quietly performed or quietly ignored.
 *
 * THE NIGHT TIER IS DECLARED AND NEVER ENTERED. There is no ambient light
 * sensor available to this build; guessing darkness from the clock would be
 * invented data. The tier is declared, its token is committed, its rule is in
 * the stylesheet, and nothing drives it.
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
  orbit: number;
  power: PowerTier;
  isTrophy: () => boolean;
}

/**
 * "Any input" is deliberately broad and deliberately NOT `pointermove`: a phone
 * lying on a counter in a shop registers movement from the building, and a
 * screen that will not settle because the room has vibrations is not a trophy.
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

  /** II.4.17 — offscreen is asleep: the orbit runs only while the trophy is up. */
  useEffect(() => {
    if (!trophy) return;
    const id = window.setInterval(() => setOrbit((o) => (o + 1) % ORBIT_POSITIONS), ORBIT_STEP_MS);
    return () => window.clearInterval(id);
  }, [trophy]);

  return { trophy, orbit, power: trophy ? "ambient" : "active", isTrophy: () => trophyRef.current };
}

/** The orbit seat as a translate, computed once per step, applied to ONE node. */
export function orbitOffset(index: number): { x: number; y: number } {
  const a = (index / ORBIT_POSITIONS) * Math.PI * 2;
  return {
    x: Number((Math.cos(a) * ORBIT_RADIUS_PX).toFixed(3)),
    y: Number((Math.sin(a) * ORBIT_RADIUS_PX).toFixed(3)),
  };
}
