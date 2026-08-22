/**
 * src/cd/chassis/annunciator.ts — ONE queue, one selector, one figure.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS (Fable review, F2 — the most serious honesty defect found)
 * ---------------------------------------------------------------------------
 * At one instant, on one state, the same alarm headline wore a different count
 * in every room: TODAY "2 behind", STORES "1 behind" while showing both chips,
 * SHOP "3 behind", LIST "3 behind". The product contradicted itself about how
 * many alarms exist.
 *
 * CORRECTIONARY 4 is not negotiable about this: "no invented data ... Drama
 * never lies." A figure that changes depending on which room you are standing
 * in is not a reading of anything.
 *
 * ---------------------------------------------------------------------------
 * THE TWO CAUSES, both reproduced numerically (see annunciator.test.ts)
 * ---------------------------------------------------------------------------
 * `arbiterFor(screen, …)` in the FROZEN engine builds one candidate list and
 * returns `{rank1, queued}` where `queued = candidates.length - 1`. Two things
 * put different candidates in that list per room:
 *
 *  1. THE SCREEN-SPECIFIC PRIMARY ACTION IS COUNTED AS AN ALARM. The engine
 *     appends `primaryActionFor(screen, …)` to the same list the app-wide
 *     duties live in. SHOP's "send to phone" and LIST's "next aisle" always
 *     append one; PLAN and COOK append none; TODAY and STORES append one only
 *     sometimes. Measured on one seeded instant: today 2 · plan 1 · cook 1 ·
 *     stores 2 · shop 2 · list 2.
 *     A room's own next action is not an alarm queued behind an expired
 *     pineapple, and counting it as one is the lie.
 *
 *  2. ROOMS THAT PASS `ctx.tripDay` SEE A CANDIDATE THE OTHERS CANNOT. The
 *     engine falls back to `inferTripDay` when no ctx is given, which returns
 *     null on any day that is not a trip day — so verify-nominee never fires
 *     for TODAY, while SHOP and LIST, which pass an explicit tripDay from the
 *     trip they have loaded, gain one. Measured on the same instant:
 *     today 2 · shop (tripDay 0) 3 · list (tripDay 0) 3 · plan 1.
 *     That is the reviewer's 2 / 3 / 3 / 1, exactly.
 *
 * ---------------------------------------------------------------------------
 * THE FIX, AND WHY IT DUPLICATES NOTHING
 * ---------------------------------------------------------------------------
 * `src/engine/arbiter.ts` is frozen, and re-deriving its priority order here
 * would be a second copy to drift. It does not need one. The engine already
 * exposes exactly the call that yields the app-wide set alone:
 *
 *     arbiterFor("plan", state, now)          // no ctx
 *
 * PLAN is the one room the engine gives no primary action — its own source
 * says so, `case "plan": return null; // contract: PLAN has no primary action`
 * — so asking as PLAN removes cause 1. Passing no ctx makes the engine derive
 * `tripDay` once, from the fortnight, the same way for every caller, which
 * removes cause 2. The result is the alarm queue as the product sees it, from
 * the frozen engine, computed once.
 *
 * SO: THIS SELECTOR TAKES NO ROOM AND NO CTX. Not as a simplification — as the
 * guarantee. There is no argument a caller could pass that would make their
 * figure differ from another room's, because there is no argument.
 *
 * ---------------------------------------------------------------------------
 * WHAT A ROOM MAY AND MAY NOT DO WITH THIS
 * ---------------------------------------------------------------------------
 * MAY: print `behind`, print `caption()`, deep-link `rank1.target`.
 * MAY NOT: add its own primary action into the figure; re-scope the queue to a
 * trip it happens to have loaded; filter the count to "what I can act on here"
 * and still print a bare number. If a room ever does need to show only what it
 * can address, it must print BOTH figures — `captionSplit()` below renders the
 * "1 behind here · 2 elsewhere" form the review asked for — never a bare count
 * that disagrees with the room next door.
 *
 * ---------------------------------------------------------------------------
 * RULING — PLAN'S AND COOK'S MISSING STRIP (review F2's second half)
 * ---------------------------------------------------------------------------
 * The review found PLAN and COOK carrying no strip at all and asked whether
 * that is a ruling or a gap. It is one of each, and the line between them is
 * the difference between the ACT-NOW SLOT and the ALARM QUEUE — two things the
 * product had been treating as one, which is the same conflation that caused
 * the divergence above.
 *
 * COOK — the act-now slot: RULING, and it stands.
 *   Already sanctioned in three places (PLAN section 6.6, arbiter.ts's
 *   `case "cook": return null`, and ArbiterSlot's own header): "COOK's own
 *   reel/done-button is the interaction, not an arbiter action", and its
 *   "done" edge is COOK's single act-now control. COOK renders no act-now slot.
 *   Written down here so it stops being folklore.
 *
 * COOK — the queue figure: GAP.
 *   The exemption above is from the SLOT. It is not an exemption from the
 *   queue, and the frozen engine says so in its own header: the first five
 *   categories "are APP-WIDE — an expired item or a ringing timer must surface
 *   on every screen's slot REGARDLESS OF WHICH SCREEN YOU'RE LOOKING AT."
 *   R5 removed the cage precisely so the operator may leave COOK at any moment;
 *   a room they are free to leave may not withhold the reason to. COOK owes the
 *   figure — quietly, with no act-now control attached to it.
 *
 * PLAN — GAP, with nothing ruling it out.
 *   `primaryActionFor("plan") -> null` is a contract about the PRIMARY ACTION
 *   ("contract: PLAN has no primary action"), not about alarms. Nothing exempts
 *   PLAN from the queue, and PLAN is the one room whose whole job is deciding
 *   what happens next — an expired item is exactly the fact you want before you
 *   plan around it. PLAN owes the figure too.
 *
 * WHY THE CHASSIS DOES NOT JUST RENDER IT ONCE FOR EVERYONE: five rooms already
 * carry their own designed annunciator instrument. A chassis-level strip would
 * make the same claim twice on those five, which is the defect this module
 * exists to remove, wearing different clothes. The chassis owns the QUEUE; each
 * room owns its INSTRUMENT.
 *
 * STATED LIMITATION (CORRECTIONARY 6.5, no silent downgrades): the split can
 * only be computed for RANK 1, because `arbiterFor` returns a count and a
 * single duty, not its candidate list — so the chassis can prove where the
 * leading alarm must be handled, but not where each runner-up must be. A true
 * per-duty split needs the frozen engine to expose its candidate array. Until
 * it does, `captionSplit` is honest about which half it knows.
 */

import { useMemo } from "react";
import { arbiterFor, type ArbiterDuty, type ScreenId } from "../../engine/arbiter";
import { useStore } from "../../state/store";
import type { AppState } from "../../state/types";

export type { ArbiterDuty, ScreenId };

export interface AnnunciatorQueue {
  /** The app-wide duty leading the queue. Identical in every room. */
  rank1: ArbiterDuty | null;
  /**
   * App-wide duties waiting BEHIND rank1. Identical in every room — this is
   * the figure a strip prints, and the whole point of the module.
   */
  behind: number;
  /** rank1 plus everything behind it. `behind + (rank1 ? 1 : 0)`. */
  total: number;
  /** Where the leading duty must be handled, when the engine names a room. */
  rank1Room: ScreenId | null;
}

/**
 * The one queue. No room argument, no context argument — see the header.
 */
export function annunciatorQueue(state: AppState, now: Date): AnnunciatorQueue {
  // "plan" + no ctx is the app-wide alarm set, per the header. This is the
  // ONLY call to arbiterFor that any strip may be built from.
  const result = arbiterFor("plan", state, now);
  const rank1 = result.rank1;
  return {
    rank1,
    behind: result.queued,
    total: result.queued + (rank1 ? 1 : 0),
    rank1Room: rank1?.target?.screen ?? null,
  };
}

/** True when the leading duty is handled in `room`. */
export function addressableIn(queue: AnnunciatorQueue, room: ScreenId): boolean {
  return queue.rank1Room !== null && queue.rank1Room === room;
}

/**
 * The figure, in words, for a room that shows the WHOLE queue. Every room
 * printing this prints the same number at the same instant.
 */
export function caption(queue: AnnunciatorQueue): string {
  if (queue.rank1 === null) return "queue clear";
  if (queue.behind === 0) return "nothing behind";
  return `${queue.behind} behind`;
}

/**
 * The figure for a room that shows only what it can address from there. Prints
 * BOTH halves, so a scoped strip can never read as a claim about the whole
 * product. `hereCount` is the room's own count of what it is actually showing —
 * the room knows that; the chassis does not.
 */
export function captionSplit(queue: AnnunciatorQueue, hereCount: number): string {
  if (queue.total === 0) return "queue clear";
  // `here` is CLAMPED to the queue it is a subset of. A caller passing a count
  // larger than the total would otherwise print "5 behind here" against a queue
  // of 3 — the same disease this module exists to cure, one scope smaller.
  const here = Math.min(Math.max(0, hereCount), queue.total);
  const elsewhere = queue.total - here;
  if (elsewhere === 0) return `${here} behind here`;
  if (here === 0) return `${elsewhere} behind elsewhere`;
  return `${here} behind here · ${elsewhere} elsewhere`;
}

/* -------------------------------------------------------------------------- */
/* The hook every room uses                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The queue, read from the store. This is what a screen calls; it takes only
 * `now` because there is nothing else a room is permitted to vary.
 *
 *     const queue = useAnnunciator(now);
 *     <Strip headline={queue.rank1?.text} behind={queue.behind} />
 *
 * REPLACES, in every room:
 *     const arbiter = arbiterFor("<room>", state, now, …);   // ← the defect
 *     …queued={arbiter.queued}
 *
 * A room that also needs its own primary action keeps calling `arbiterFor` for
 * THAT — the engine is still the right place to ask "what should this screen
 * offer next". What it may no longer do is read a QUEUE COUNT off that call.
 */
export function useAnnunciator(now: Date): AnnunciatorQueue {
  const { state } = useStore();
  return useMemo(() => annunciatorQueue(state, now), [state, now]);
}
