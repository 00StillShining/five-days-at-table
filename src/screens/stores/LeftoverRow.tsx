// A leftover shown inside the register's fridge group, "with a distinct tag"
// (PLAN §6.7). Not level-tracked (leftovers don't have a fuzzy 0-4 stock
// level — they're a single dated batch with a computed use-by), so this is a
// plain informational row, not a RegisterRow: no wheel arming, no pips.
import type { LeftoverEntry, Action } from "../../state/store";
import { getMeal } from "../../data";
import { countdownForUseBy } from "./countdown";

export interface LeftoverRowProps {
  entry: LeftoverEntry;
  now: Date;
  dispatch: (a: Action) => void;
}

function leftoverName(entry: LeftoverEntry): string {
  if (entry.source === "meal") return getMeal(entry.ref)?.name ?? entry.ref;
  return entry.ref; // prep source: `ref` is already the yield's component name
}

export function LeftoverRow({ entry, now, dispatch }: LeftoverRowProps) {
  const countdown = countdownForUseBy(entry.useBy, now);
  return (
    <li className={`scr-stores-row-item scr-stores-leftover scr-stores-row--${countdown.status}`}>
      <span className="scr-stores-leftover-tag">leftover</span>
      <span className="scr-stores-row-name">
        {leftoverName(entry)}
        {entry.g != null ? ` · ${entry.g}g` : ""}
      </span>
      <span className="scr-stores-row-countdown">{countdown.text}</span>
      <button
        type="button"
        className="fd5-control scr-stores-leftover-used"
        onClick={() => dispatch({ type: "leftovers/consume", id: entry.id })}
      >
        used up
      </button>
    </li>
  );
}
