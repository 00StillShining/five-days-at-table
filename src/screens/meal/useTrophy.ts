/**
 * src/screens/meal/useTrophy.ts — Instrument -> Trophy, on MEAL.
 *
 * Owner ruling, every screen: idle 90s enters over 420ms, any input exits over
 * 240ms, both retargeting in flight; burn-in 2px on an 8-position orbit every
 * 240s, the whole composition moving as ONE RIGID FRAME; luminance 1.00 active
 * / 0.55 ambient / 0.20 night, 4000ms linear between tiers; silent except the
 * warning (II.5.15).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS THREE TIMES IN THE PRODUCT
 * ---------------------------------------------------------------------------
 * TODAY and LIST each carry their own copy, and so does this screen, because
 * CD-BRIEF's zone fence forbids importing across screens: an element that
 * reached into `../today/` would be reading another world's module graph, and
 * the first token that followed it would break the fence for real.
 *
 * The hook itself is language-agnostic — it holds no hex, no duration of its
 * own beyond the owner's four numbers, and no DOM. THIS IS A PROMOTION
 * CANDIDATE for src/cd/foundry, reported rather than performed, because
 * src/cd/** is not this builder's to edit.
 *
 * ---------------------------------------------------------------------------
 * THE NIGHT TIER IS DECLARED AND NEVER ENTERED (CORRECTIONARY 6.5)
 * ---------------------------------------------------------------------------
 * The 0.20 tier wants an ambient light sensor. `AmbientLightSensor` ships in no
 * browser this product targets, and `prefers-color-scheme` reports a user
 * preference rather than a room. Guessing darkness from the clock would be
 * invented data, so the tier has a token and a rule and nothing drives it.
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
  /** Readable inside an event handler without waiting for a render. */
  isTrophy: () => boolean;
}

/**
 * Deliberately NOT `pointermove`: a mouse resting on a desk that a lorry drives
 * past still generates moves, and a screen that will not settle because the
 * room has vibrations is not a trophy.
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
    for (const type of WAKE_EVENTS)
      window.addEventListener(type, wake, { passive: true, capture: true });
    arm();
    return () => {
      for (const type of WAKE_EVENTS) window.removeEventListener(type, wake, { capture: true });
      if (idleRef.current != null) window.clearTimeout(idleRef.current);
    };
  }, [arm, enabled]);

  /* The orbit runs only while the trophy is up — that is the only state this
     screen can be left in for months. II.4.17: offscreen is asleep. */
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
