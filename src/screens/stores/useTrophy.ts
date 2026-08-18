/**
 * src/screens/stores/useTrophy.ts — Instrument -> Trophy, on the larder.
 *
 * Owner ruling: every screen carries Trophy Mode, at the same committed
 * numbers screencraft/01 sets and this project pins:
 *
 *   idle to enter ......... 90 000ms
 *   enter ................. 420ms
 *   exit .................. 240ms       on ANY input
 *   both retarget in flight — nothing finishes an obsolete transition
 *   burn-in ............... 2px, 8 positions, 240 000ms per step, the whole
 *                           composition moving AS ONE RIGID FRAME
 *   luminance ............. 1.00 active / 0.55 ambient / 0.20 night,
 *                           4000ms linear between tiers
 *
 * A screen folder may not import from another screen folder
 * (docs/PHASE2-CONTRACT.md), so this is STORES' own copy of the same law
 * TODAY carries. The numbers are the ruling's, not this file's, and any change
 * to them belongs in the ruling.
 *
 * ---------------------------------------------------------------------------
 * THE NIGHT TIER IS DECLARED AND NEVER ENTERED (CORRECTIONARY 6.5)
 * ---------------------------------------------------------------------------
 * screencraft/01 enters Night "once the AMBIENT SENSOR confirms the room has
 * gone dark". No ambient light sensor exists in any browser this product ships
 * to, and inferring darkness from the clock would be invented data. The tier is
 * declared, its token is committed, its rule is in stores.css, and NOTHING
 * DRIVES IT. Stated rather than quietly dropped.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export const TROPHY_IDLE_MS = 90_000;
export const TROPHY_ENTER_MS = 420;
export const TROPHY_EXIT_MS = 240;

/** screencraft/01 — 8 positions, 2px, one step per 240s, as one rigid frame. */
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
 * resting on a worktop that a passing lorry shakes still generates moves, and a
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

  /**
   * The orbit runs ONLY while the trophy is up, because that is the only state
   * this screen can be left in for months. II.4.17 — offscreen is asleep: the
   * interval is dropped with the mode, never left running behind a live screen.
   */
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
