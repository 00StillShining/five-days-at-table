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
  /** 3-letter lowercase day abbreviation ("mon".."fri") — index.tsx already
   * computes this for the day heading; passed through so this card's
   * controls can disambiguate themselves (wave-1 review fix: 20 identical
   * "swap" buttons on one page all had the same bare accessible name). */
  dayLabel: string;
  slot: Slot;
  meal: Meal;
  cover: Cover;
  eaten: Eaten;
  swaps: Swaps;
  onOpenSwap: () => void;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "Europe/London" });

export function SlotCard({ week, day, dayLabel, slot, meal, cover, eaten, swaps, onOpenSwap }: SlotCardProps) {
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
          {/* sr-only disambiguation: 20 of these render on one page, all with
              visible text "swap ▸" — the accessible name needs the slot's
              own coordinates (wave-1 review fix). */}
          <span className="fd5-visually-hidden"> · {dayLabel} {slot}</span>
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
            <span className="fd5-visually-hidden"> · {dayLabel} {slot}</span>
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

/**
 * docs/VARIANT-SPEC.md: a slot the tester cuts renders this quiet "cut ·
 * reason" cell instead of the normal SlotCard — flat-functional (no new hero
 * treatment), non-color second cue (the dashed border + "cut" text label,
 * not a color alone), and deliberately carries no swap affordance — there's
 * nothing to swap into a slot the tester doesn't cook.
 */
export function CutSlotCard({ slot, reason }: { slot: Slot; reason: string }) {
  return (
    <div className="scr-plan-card scr-plan-card--cut" data-tag="cut">
      <p className="scr-plan-card-slot">{slot}</p>
      <p className="scr-plan-card-cut-text">
        cut <span aria-hidden="true">·</span> {reason}
      </p>
    </div>
  );
}
