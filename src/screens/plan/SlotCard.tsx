// One cell of the fortnight board (PLAN §6.4): meal name, tag chip
// (batch/fresh/swap), logged state, macro one-liner. Drill-in to MEAL is a
// plain route link (#/meal/:id) — no Sheet needed for that per the brief.
import type { Cover, Meal, Slot, Week } from "../../data/types";
import { useStore } from "../../state/store";
import type { Eaten, Swaps } from "../../state/types";
import { effectiveMeal, mealLoggedAt } from "./helpers";
import { mealMacros } from "../../state/selectors";

export interface SlotCardProps {
  week: Week;
  day: number;
  slot: Slot;
  meal: Meal;
  cover: Cover;
  eaten: Eaten;
  swaps: Swaps;
  onOpenSwap: () => void;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "Europe/London" });

export function SlotCard({ week, day, slot, meal, cover, eaten, swaps, onOpenSwap }: SlotCardProps) {
  const { dispatch } = useStore();
  const shown = effectiveMeal(week, day, slot, meal, swaps);
  const isSwapped = shown.id !== meal.id;
  const tag = isSwapped ? "swap" : shown.tag;
  const loggedAt = mealLoggedAt(eaten, shown.id);
  const macros = mealMacros(shown.id, cover);

  return (
    <div className="scr-plan-card" data-tag={tag} data-logged={loggedAt ? "true" : undefined}>
      <p className="scr-plan-card-slot">{slot}</p>
      <a className="scr-plan-card-name" href={`#/meal/${shown.id}`}>
        {shown.name}
      </a>
      <p className="scr-plan-card-macro">
        {Math.round(macros.kcal)} kcal · {macros.protein.toFixed(1)}g protein
      </p>
      <p className="scr-plan-card-meta">
        <span className="scr-plan-chip" data-chip={tag}>
          {tag}
        </span>
        {isSwapped && <span className="scr-plan-card-swapnote">was: {meal.name}</span>}
        {loggedAt && (
          <span className="scr-plan-card-logged">
            <span aria-hidden="true">✓</span> logged {dateFormatter.format(new Date(loggedAt)).toLowerCase()}
          </span>
        )}
      </p>
      <div className="scr-plan-card-actions">
        <button type="button" className="fd5-control scr-plan-swap-btn" onClick={onOpenSwap}>
          swap <span aria-hidden="true">▸</span>
        </button>
        {isSwapped && (
          // Sol guarded-action rule: reversible -> prefer undo over a confirm
          // dialog. A committed swap now survives reload (real `swaps` slice,
          // P2-PLAN-001), so an always-visible one-tap undo replaces needing
          // to re-open the deck and hunt for the original meal again.
          <button
            type="button"
            className="fd5-control scr-plan-card-undo"
            onClick={() => dispatch({ type: "swaps/clear", slotMealId: meal.id })}
          >
            undo swap
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptySlotCard({ slot }: { slot: Slot }) {
  return (
    <div className="scr-plan-card scr-plan-card--empty" data-tag="empty">
      <p className="scr-plan-card-slot">{slot}</p>
      <p className="scr-plan-card-empty-text">— empty —</p>
    </div>
  );
}
