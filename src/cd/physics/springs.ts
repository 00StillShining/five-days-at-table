/**
 * src/cd/physics/springs.ts — the four mass classes.
 *
 * II.1.2 — "Four masses, no fifth. Assign every moving element one of four mass
 * classes — Light, Standard, Weighted, Anchored — and inherit the class's
 * values whole." A control that borrows Light's tempo with Weighted's overshoot
 * belongs to no class and moves like broken machinery.
 *
 * CORRECTIONARY 4 restates the same four springs as binding and adds the one
 * standing amendment: the bible's intensities are FLOORS, never ceilings. That
 * amendment touches shadows and texture, not damping ratios — a spring outside
 * its class band is a defect at any rung (II.1.4).
 *
 * Committed values, with the damping ratio each was verified against:
 *
 *   Light     spring(0.7, 420, 25)   zeta 0.73   180ms   <=4% overshoot, <=1 rebound
 *   Standard  spring(1,   320, 26)   zeta 0.73   240ms   <=4% overshoot, <=1 rebound
 *   Weighted  spring(1.4, 260, 30)   zeta 0.79   300ms   <=2% overshoot, <=1 rebound
 *   Anchored  spring(1.2, 300, 38)   zeta 1.00   320ms    0% overshoot,  0 rebounds
 *   Panel     spring(1.6, 240, 30)             340ms   Weighted at chassis scale,
 *                                                        NOT a fifth class (II.1.2)
 */

import { createSpring, type Spring, type SpringConfig } from "./integrator";

export type MassClass = "light" | "standard" | "weighted" | "anchored" | "panel";

export interface MassClassSpec extends SpringConfig {
  /** The CSS pair's duration, for surfaces where no script runs (II.1.20). */
  cssMs: number;
  /** Overshoot budget as a fraction of travel (II.1.7). */
  overshootBudget: number;
  /** Rebounds permitted. One, at most — a second reads as worn bushings. */
  rebounds: number;
  /** What this class is assigned to (II.1.2). */
  assignedTo: string;
}

export const MASS: Record<MassClass, MassClassSpec> = {
  light: {
    mass: 0.7,
    stiffness: 420,
    damping: 25,
    cssMs: 180,
    overshootBudget: 0.04,
    rebounds: 1,
    assignedTo: "crown, rocker bat, small selector levers",
  },
  standard: {
    mass: 1,
    stiffness: 320,
    damping: 26,
    cssMs: 240,
    overshootBudget: 0.04,
    rebounds: 1,
    assignedTo: "knob, fader, toggle, key release, scrubber",
  },
  weighted: {
    mass: 1.4,
    stiffness: 260,
    damping: 30,
    cssMs: 300,
    overshootBudget: 0.02,
    rebounds: 1,
    assignedTo: "wheel, reel, needle lag, tray contents",
  },
  anchored: {
    mass: 1.2,
    stiffness: 300,
    damping: 38,
    cssMs: 320,
    overshootBudget: 0,
    rebounds: 0,
    assignedTo: "guarded switch, armed transport, locked state, hard limits",
  },
  panel: {
    mass: 1.6,
    stiffness: 240,
    damping: 30,
    cssMs: 340,
    overshootBudget: 0.02,
    rebounds: 1,
    assignedTo: "chassis-scale panels — Weighted at panel scale, not a fifth class",
  },
};

/**
 * II.1.4 — "The governing number is the damping ratio
 * zeta = damping / (2 * sqrt(stiffness * mass))."
 * Hold live controls between 0.70 and 0.80; Anchored at 1.00 or above.
 */
export function dampingRatio(cfg: SpringConfig): number {
  return cfg.damping / (2 * Math.sqrt(cfg.stiffness * cfg.mass));
}

/**
 * Peak overshoot of a second-order step response, as a fraction of travel.
 * Critically damped or above (zeta >= 1) returns exactly 0 — which is what
 * makes Anchored's "0%, always" (II.1.3) a property of the mathematics rather
 * than a promise in a comment.
 */
export function overshoot(cfg: SpringConfig): number {
  const z = dampingRatio(cfg);
  if (z >= 1) return 0;
  return Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z));
}

/**
 * The tuning probe of II.1.4, verbatim in behaviour: print a candidate's
 * damping ratio and overshoot BEFORE committing it. "Tune by probe, not by eye
 * alone — compute zeta and overshoot before committing a spring, and reject any
 * candidate outside its class budget."
 */
export function probe(cfg: SpringConfig): { zeta: string; overshoot: string } {
  return {
    zeta: dampingRatio(cfg).toFixed(2),
    overshoot: (overshoot(cfg) * 100).toFixed(1) + "%",
  };
}

/**
 * The three springs II.1.4 names and BANS, kept in code so a future tuning pass
 * cannot rediscover one by accident.
 */
export const BANNED_SPRINGS: { cfg: SpringConfig; why: string }[] = [
  { cfg: { mass: 1, stiffness: 320, damping: 14 }, why: "zeta 0.39 — rebounds three times; a toy" },
  { cfg: { mass: 1, stiffness: 560, damping: 26 }, why: "zeta 0.55 — fast but rings; nervous" },
  { cfg: { mass: 2.4, stiffness: 180, damping: 44 }, why: "zeta 1.06 — overdamped syrup" },
];

/**
 * "Reads done" — the time a unit step takes to arrive and stay inside a 2% band.
 *
 * Measured on the same semi-implicit Euler integrator the product actually runs
 * (II.1.19), so the figure is the one the screen will show rather than a
 * textbook settling time. II.1.20 is explicit that the two differ: "the pair is
 * the perceived arrival, not the textbook settling time — the eye calls motion
 * done before the mathematics does."
 */
export function settleMs(cfg: SpringConfig, band = 0.02): number {
  const dt = 1 / 120;
  let x = 0;
  let v = 0;
  let lastOutside = 0;
  for (let i = 1; i <= 120 * 5; i++) {
    const a = (-cfg.stiffness * (x - 1) - cfg.damping * v) / cfg.mass;
    v += a * dt;
    x += v * dt;
    if (Math.abs(x - 1) > band) lastOutside = i * dt * 1000;
  }
  return Math.round(lastOutside);
}

/**
 * True when a candidate sits inside a band II.1.4 admits AND arrives inside a
 * window II.1.5 admits.
 *
 * BOTH axes are required. Damping ratio alone lets spring(2.4, 180, 44) through
 * at zeta 1.06 — a spring II.1.4's own table BANS as "overdamped syrup; drag
 * without reward" — because that spring's fault is not its ratio, it is that it
 * takes ~650ms to arrive, far outside the 180-320ms control and 220-420ms panel
 * settle windows the mechanical defaults fix.
 */
export const SETTLE_CEILING_MS = 420; // II.1.5's widest declared window: panel

export function isLegalSpring(cfg: SpringConfig): boolean {
  const z = dampingRatio(cfg);
  const inBand = (z >= 0.7 && z <= 0.8) || z >= 1.0;
  return inBand && settleMs(cfg) <= SETTLE_CEILING_MS;
}

/** Create a spring already carrying its class's committed values. */
export function createMassSpring(cls: MassClass, initial = 0): Spring {
  const { mass, stiffness, damping } = MASS[cls];
  return createSpring({ mass, stiffness, damping }, initial);
}

/** The CSS pair for a class (II.1.20) — duration plus the settle easing. */
export function cssPair(cls: MassClass): string {
  return `${MASS[cls].cssMs}ms var(--cd-ease-settle)`;
}

/**
 * II.1.9 — the release gate. Velocity is measured over the final 80ms of the
 * gesture, never the final frame: "one frame is noise wearing a number."
 * At or above 180px/s the surface coasts (II.1.8); below it, the control
 * settles where it is, in its class time.
 */
export const RELEASE_WINDOW_MS = 80;
export const GLIDE_GATE_PX_S = 180;

export interface TrailSample {
  t: number;
  p: number;
}

export function releaseVelocity(trail: readonly TrailSample[], now: number): number {
  const window = trail.filter((s) => s.t >= now - RELEASE_WINDOW_MS);
  if (window.length < 2) return 0;
  const a = window[0];
  const b = window[window.length - 1];
  const dt = (b.t - a.t) / 1000;
  if (dt <= 0) return 0;
  return (b.p - a.p) / dt;
}

/**
 * II.1.8 — friction is exponential: v(t) = v0 * e^(-t/tau).
 * tau is 90ms for Standard surfaces, 140ms for a Weighted wheel or reel.
 * Motion is finished below 8px/s and the whole coast dies inside II.4.7's
 * 480ms glide budget.
 */
export const FRICTION_TAU_MS = { standard: 90, weighted: 140 } as const;
export const COAST_STOP_PX_S = 8;
export const GLIDE_CAP_MS = 480;

export function frictionVelocity(v0: number, elapsedMs: number, tauMs: number): number {
  return v0 * Math.exp(-elapsedMs / tauMs);
}

/**
 * II.1.14 — hard stops dead, soft limits resist. Past a soft boundary displayed
 * travel compresses 3:1 up to a 24px ceiling; the SEMANTIC value clamps at the
 * limit the moment travel reaches it, and truth never follows the rubber.
 */
export const SOFT_LIMIT_COMPRESSION = 3;
export const SOFT_LIMIT_CEILING_PX = 24;

export function displayedTravel(travelPx: number, maxPx: number): number {
  if (travelPx <= maxPx) return travelPx;
  return maxPx + Math.min((travelPx - maxPx) / SOFT_LIMIT_COMPRESSION, SOFT_LIMIT_CEILING_PX);
}

export type { Spring, SpringConfig };
