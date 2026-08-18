/**
 * src/screens/meal/TransportRow.tsx — ch.16's three keys, felt before seen.
 *
 * ch.16 section 3, the Transport Key: built from II.3.13 (commits on release
 * inside bounds, Standard mass), "widened from the Foundry's square default to
 * a 2.25rem by 3.25rem rectangle, THREE ACROSS with a fixed 0.875rem gap sized
 * so the press-shortened shadow of one key never touches its neighbour's rim —
 * the eye confirms separation before the finger does. A 350ms linear-fill hold
 * on the CENTER KEY escalates to the guarded engage of →II.3.16 — Anchored, not
 * the rule's Weighted: a wipe bounces for no one."
 *
 * Three keys, and they are the three things a hand does on this tray:
 *   HER     cut the plate for the 70 kg cover
 *   COOK    hand this plate to the cook engine — the center key
 *   HIM     cut the plate for the 85 kg cover
 *
 * ---------------------------------------------------------------------------
 * THE GUARD IS CONDITIONAL, AND THE CONDITION IS THE CONSEQUENCE
 * ---------------------------------------------------------------------------
 * screencraft/02: "UNDO OUTRANKS CONFIRM wherever reversal is real ... Asking
 * permission for what the product can simply repair is a toll charged to
 * everyone for the rare traveler who would have wanted a refund." Loading a
 * program into an idle cook engine is free to undo — load another one.
 * Loading a program while one is ACTUALLY RUNNING overwrites a live cook, and
 * the clock that was running cannot be handed back.
 *
 * So the center key is a plain press when nothing is cooking, and II.3.17's
 * guarded switch — 350ms hold to arm against a real clock, press again to
 * commit, 4000ms run-out — when a program is live. The condition comes from the
 * app-wide cook-running signal, the same one the chassis rec-dot reads, so "a
 * cook program is running" stays one claim made once (CD-BRIEF ruling 3).
 *
 * ---------------------------------------------------------------------------
 * DECLARED DEPARTURE (CORRECTIONARY 6.5)
 * ---------------------------------------------------------------------------
 * The cap's 2.25rem width is not kept. Two reasons, in order of rank:
 *   1. THE FLOOR. 2.25rem is 36px, and 44px on both axes is non-negotiable.
 *   2. ch.16's Signature rung "removes the printed transport glyphs entirely —
 *      back, pause-play, forward read from shape and position alone". Three
 *      universal transport glyphs can do that; "her", "him" and "cook" cannot,
 *      and a household control that reads from position alone is a household
 *      control nobody can hand to a guest.
 * The HEIGHT (3.25rem), the GAP (0.875rem) and the chamfered cap silhouette are
 * kept exactly; the widths are set by the words they carry, floored at 2.75rem.
 */

import { GuardedKey, PressKey } from "../../cd/foundry";
import type { Cover } from "../../data";
import { COVER_SHORT } from "./model";

export interface TransportRowProps {
  cover: Cover;
  onCover: (next: Cover) => void;
  onCook: () => void;
  /** True while the cook engine is actually running a program. */
  cookRunning: boolean;
  /** The meal's own name, printed as the guard's stated consequence. */
  mealName: string;
  trophy: boolean;
}

export function TransportRow({
  cover,
  onCover,
  onCook,
  cookRunning,
  mealName,
  trophy,
}: TransportRowProps) {
  return (
    <div className="mea-transport" role="group" aria-label="cover and cook">
      <PressKey
        className="mea-key mea-key--cover"
        onPress={() => onCover("w")}
        cap={COVER_SHORT.w}
        sound="contact"
        aria-pressed={cover === "w"}
        data-mea-seated={cover === "w" ? "true" : "false"}
        disabled={trophy}
      />

      {cookRunning ? (
        <GuardedKey
          className="mea-key mea-key--cook mea-key--guarded"
          onCommit={onCook}
          armLabel="cook →"
          commitLabel="overwrite the running cook"
          consequence={`the cook engine is running. committing loads ${mealName} and the clock now running is not handed back.`}
          disabled={trophy}
        />
      ) : (
        <PressKey
          className="mea-key mea-key--cook"
          onPress={onCook}
          cap="cook →"
          sound="contact"
          disabled={trophy}
        />
      )}

      <PressKey
        className="mea-key mea-key--cover"
        onPress={() => onCover("m")}
        cap={COVER_SHORT.m}
        sound="contact"
        aria-pressed={cover === "m"}
        data-mea-seated={cover === "m" ? "true" : "false"}
        disabled={trophy}
      />
    </div>
  );
}
