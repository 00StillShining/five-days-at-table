// Leftovers & waste log — "logging dinner offers eaten/leftover/binned
// (≤3 taps)" (PLAN §6.7). Tap budget as built:
//   "ate it all"        -> 1 tap  (the log IS the action — inline, no sheet)
//   "saved a leftover"  -> 2 taps (choose leftover, then a portion preset)
//   "binned some"       -> 2 taps (choose binned, then a portion preset)
// i.e. every path is <= 3 taps even before counting whichever tap first
// scrolled the user to this card.
//
// £ WASTE/LEFTOVER ARITHMETIC ("price from sku pro-rated by grams",
// documented per the F2 standing rule):
//   totalMealG    = sum of every ingredient's grams across BOTH covers (her +
//                   him) in the dinner's `covers` gram tables.
//   totalMealCost = sum, per ingredient, of (gramsInMeal * sku.price / sku.packG)
//                   — i.e. that ingredient's actual per-gram shelf price times
//                   how many grams of it are in tonight's dinner. Ingredients
//                   with no `sku` (a few homemade/freebie items) contribute 0.
//   fraction      = the tapped portion preset (a bit=.25, half=.5, most=.75, all=1)
//   grams         = round(fraction * totalMealG)
//   value (£)     = fraction * totalMealCost
// This is algebraically identical to pro-rating EVERY ingredient's own grams
// by `fraction` and summing each at its own £/g — i.e. genuinely "price from
// sku pro-rated by grams", not a flat per-portion average.
import { useState } from "react";
import type { Meal } from "../../data/types";
import { ingredientsById } from "../../data";
import { EstimateMark } from "../../components/EstimateMark";
import type { Action } from "../../state/store";
import { londonDateIso, addCalendarDays } from "../../state/london";

/** Standard food-safety guidance for a cooked dinner leftover kept in the
 * fridge (no per-dish shelf-life field exists in the data model for cooked
 * meals — only raw ingredients carry `storage.life`) — a documented, clearly-
 * flagged default, same spirit as data/lifeEstimate.ts's own conservative
 * fallbacks for text it can't parse a number from. */
const COOKED_LEFTOVER_FRIDGE_DAYS = 3;

interface Portion {
  key: string;
  label: string;
  fraction: number;
}
const PORTIONS: Portion[] = [
  { key: "bit", label: "a bit", fraction: 0.25 },
  { key: "half", label: "half", fraction: 0.5 },
  { key: "most", label: "most", fraction: 0.75 },
  { key: "all", label: "all of it", fraction: 1 },
];

export function computeMealTotals(meal: Meal): { totalG: number; totalCost: number } {
  let totalG = 0;
  let totalCost = 0;
  for (const cover of ["w", "m"] as const) {
    for (const [ingId, g] of Object.entries(meal.covers[cover])) {
      totalG += g;
      const ing = ingredientsById[ingId];
      if (ing?.sku) totalCost += g * (ing.sku.price / ing.sku.packG);
    }
  }
  return { totalG, totalCost };
}

export interface LogDinnerCardProps {
  dinner: Meal | null;
  now: Date;
  alreadyEaten: boolean;
  dispatch: (a: Action) => void;
}

type Result =
  | { kind: "eaten" }
  | { kind: "leftover"; label: string; g: number; value: number; useBy: string }
  | { kind: "binned"; label: string; g: number; value: number };

export function LogDinnerCard({ dinner, now, alreadyEaten, dispatch }: LogDinnerCardProps) {
  const [choosing, setChoosing] = useState<"leftover" | "binned" | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  if (!dinner) {
    return (
      <section className="scr-stores-section" aria-labelledby="scr-stores-logdinner-h">
        <h2 id="scr-stores-logdinner-h" className="scr-stores-h">
          log dinner
        </h2>
        <p className="scr-stores-muted">no plated dinner today — nothing to log.</p>
      </section>
    );
  }

  const todayIso = londonDateIso(now);

  function handleEaten() {
    dispatch({ type: "eaten/tick", date: todayIso, slot: "dinner", mealId: dinner!.id });
    setResult({ kind: "eaten" });
    setChoosing(null);
  }

  function handlePortion(kind: "leftover" | "binned", fraction: number, label: string) {
    const { totalG, totalCost } = computeMealTotals(dinner!);
    const g = Math.round(fraction * totalG);
    const value = Math.round(fraction * totalCost * 100) / 100;

    if (kind === "leftover") {
      const useBy = addCalendarDays(todayIso, COOKED_LEFTOVER_FRIDGE_DAYS);
      dispatch({
        type: "leftovers/add",
        entry: {
          source: "meal",
          ref: dinner!.id,
          g,
          price: value,
          date: todayIso,
          useBy,
          consumers: [],
          sourceWeek: dinner!.week,
          sourceSession: null,
          note: `leftover from dinner: ${dinner!.name}`,
          consumedAt: null,
        },
      });
      setResult({ kind: "leftover", label, g, value, useBy });
    } else {
      dispatch({
        type: "waste/add",
        entry: { ref: dinner!.id, g, price: value, date: todayIso, note: `binned from dinner: ${dinner!.name}` },
      });
      setResult({ kind: "binned", label, g, value });
    }
    setChoosing(null);
  }

  return (
    <section className="scr-stores-section" aria-labelledby="scr-stores-logdinner-h">
      <h2 id="scr-stores-logdinner-h" className="scr-stores-h">
        log dinner
      </h2>
      <p className="scr-stores-logdinner-name">{dinner.name}</p>

      {!choosing && (
        <div className="scr-stores-logdinner-actions">
          <button type="button" className="fd5-control scr-stores-logdinner-btn" onClick={handleEaten}>
            ate it all
          </button>
          <button type="button" className="fd5-control scr-stores-logdinner-btn" onClick={() => setChoosing("leftover")}>
            saved a leftover
          </button>
          <button type="button" className="fd5-control scr-stores-logdinner-btn" onClick={() => setChoosing("binned")}>
            binned some
          </button>
        </div>
      )}

      {choosing && (
        <div className="scr-stores-logdinner-portions" role="group" aria-label="how much?">
          {PORTIONS.map((p) => (
            <button
              key={p.key}
              type="button"
              className="fd5-control scr-stores-logdinner-btn"
              onClick={() => handlePortion(choosing, p.fraction, p.label)}
            >
              {p.label}
            </button>
          ))}
          <button type="button" className="fd5-control scr-stores-logdinner-cancel" onClick={() => setChoosing(null)}>
            cancel
          </button>
        </div>
      )}

      <p className="scr-stores-logdinner-status" role="status" aria-live="polite">
        {!result && alreadyEaten && "already ticked eaten today"}
        {result?.kind === "eaten" && "logged · eaten"}
        {result?.kind === "leftover" && (
          <>
            saved · {result.label} · {result.g}g · <EstimateMark />£{result.value.toFixed(2)} · use by {result.useBy}
          </>
        )}
        {result?.kind === "binned" && (
          <>
            binned · {result.label} · {result.g}g · <EstimateMark />£{result.value.toFixed(2)} wasted
          </>
        )}
      </p>
    </section>
  );
}
