/**
 * src/cd/physics/rotation.ts — the two rotation guard-rails, made unavoidable.
 *
 * Both come from language chapter 05 (EXPOSED WORKS)'s own code fences, and
 * both are bugs that only appear at run time, in a reversal or past a full
 * revolution, on hardware nobody is watching at the moment it happens. So they
 * are implemented once, here, instead of being written as advice.
 *
 * ------------------------------------------------------------------------
 * GUARD-RAIL 1 — the untransformed carrier.
 *
 * ch.05: "cap and rocker mount as SIBLINGS on one untransformed carrier, each
 * reading the same commit angle independently, so the two rotations report the
 * same fact rather than one compounding on top of the other ... a reversal
 * mid-throw never compounds into 45 degrees where 22.5 degrees was committed."
 *
 * The failure this prevents: nest the indicator INSIDE the rotating cap and
 * both transforms multiply. One detent of 22.5 degrees renders as 45. The bug
 * is invisible while you only ever click forward.
 *
 * `mountAssembly` writes ONE custom property on the carrier. The carrier itself
 * must carry no transform of its own — asserted below, in development, because
 * the whole guard-rail is one CSS declaration away from being undone.
 *
 * ------------------------------------------------------------------------
 * GUARD-RAIL 2 — cumulative turn lives in `dataset`.
 *
 * ch.05: "the porthole's own turn count is held in its dataset, NEVER recovered
 * from getComputedStyle().transform: a computed matrix wraps every revolution
 * back into +/-180 degrees, so reading it back after the disc has turned past
 * 360 would lose every full turn already made."
 *
 * The failure this prevents: a geared disc that has made three turns reads back
 * as 40 degrees, and the next increment starts from 40 instead of 1120. The
 * needle, whose own range is +/-135, never crosses the wrap — which is exactly
 * why the bug hides until something geared is added later.
 */

/** The custom property every sibling in an assembly reads. One name, one fact. */
export const ASSEMBLY_ANGLE_PROP = "--cd-assembly-angle";

/** The dataset key holding cumulative, unwrapped turn. */
export const TURN_DATASET_KEY = "cdTurnDeg";

interface CarrierLike {
  style: { setProperty(name: string, value: string): void };
  dataset: Record<string, string | undefined>;
}

/**
 * Write the committed angle onto an assembly carrier.
 *
 * Every sibling — cap, indicator, rocker arm, engraved index — reads
 * `var(--cd-assembly-angle)` in its OWN `transform: rotate(...)`. None of them
 * is an ancestor of another, so none of their rotations can compound.
 *
 * @param carrier the untransformed wrapper. It must have no transform.
 */
export function mountAssembly(carrier: CarrierLike, angleDeg: number): void {
  if (import.meta.env?.DEV) assertUntransformed(carrier);
  carrier.style.setProperty(ASSEMBLY_ANGLE_PROP, `${angleDeg}deg`);
}

/**
 * Development assertion for guard-rail 1. A carrier that has grown a transform
 * has silently converted its siblings into descendants of a rotation, and every
 * angle on the assembly is now wrong by a factor nobody will look for.
 */
export function assertUntransformed(carrier: CarrierLike): void {
  if (typeof getComputedStyle !== "function") return;
  const t = getComputedStyle(carrier as unknown as Element).transform;
  if (t && t !== "none") {
    console.error(
      "[cd/physics] An assembly carrier has a transform (%s). Cap and indicator " +
        "must be SIBLINGS on an UNTRANSFORMED carrier, or a mid-throw reversal " +
        "compounds 22.5deg into 45deg. See languages/05-pagani-utopia.md section 3.",
      t
    );
  }
}

/**
 * Advance a geared element's CUMULATIVE turn and return the new total.
 *
 * The running total lives in `dataset` and is never recovered from a computed
 * matrix. Passing `distanceDeg` (how far the driving element travelled) times
 * `gearRatio` keeps the disc honest: it turns only while the value turns
 * (II.4.16 — stable data, stable instrument).
 */
export function advanceTurn(el: CarrierLike, distanceDeg: number, gearRatio = 1): number {
  const previous = Number(el.dataset[TURN_DATASET_KEY]) || 0;
  const turn = previous + distanceDeg * gearRatio;
  el.dataset[TURN_DATASET_KEY] = String(turn);
  el.style.setProperty("--cd-turn-angle", `${turn}deg`);
  return turn;
}

/** Read the cumulative turn. The ONLY legal way to ask. */
export function readTurn(el: CarrierLike): number {
  return Number(el.dataset[TURN_DATASET_KEY]) || 0;
}

/**
 * The wrap this module exists to avoid, kept as a named function so its danger
 * is documented rather than rediscovered. Correct ONLY for elements whose own
 * range never leaves +/-180 — a gauge needle at +/-135 qualifies; anything
 * geared does not.
 */
export function readWrappedAngleUnsafe(el: Element): number {
  const t = getComputedStyle(el).transform;
  if (!t || t === "none") return 0;
  const m = new DOMMatrixReadOnly(t);
  return Math.atan2(m.b, m.a) * (180 / Math.PI);
}
