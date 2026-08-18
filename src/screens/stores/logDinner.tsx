/**
 * src/screens/stores/logDinner.tsx — THE DINNER LEDGER.
 *
 * PLAN section 6.7: "logging dinner offers eaten/leftover/binned (<=3 taps)".
 * Tap budget as built, unchanged from the screen this replaces:
 *   "ate it all"        -> 1 tap  (the log IS the action — inline, no sheet)
 *   "saved a leftover"  -> 2 taps (choose leftover, then a portion)
 *   "binned some"       -> 2 taps (choose binned, then a portion)
 *
 * ---------------------------------------------------------------------------
 * THE CONSEQUENCE IS PRINTED BEFORE THE CHOICE, NOT AFTER
 * ---------------------------------------------------------------------------
 * `waste/add` has no inverse in the frozen reducer, so binning is the one
 * genuinely irreversible act on this screen, and CORRECTIONARY 4 keeps the
 * guarded switch in force "for anything consequential". It is NOT used here,
 * and that is a declared decision rather than an oversight (CORRECTIONARY 6.5):
 * a hold-to-arm plus a commit press turns the binned path into four acts and
 * breaks PLAN section 6.7's own <=3-tap contract, which still holds. What is
 * kept is the guarded pattern's honest half — screencraft/02's "the dialog
 * opens with the consequence": every portion key prints the EXACT grams and the
 * EXACT pound figure it will write, computed from the real SKU prices, so the
 * decision is made with the fact in hand rather than after it.
 *
 * ---------------------------------------------------------------------------
 * THE PORTION KEYS ARE INSTRUMENTS, NOT LABELS
 * ---------------------------------------------------------------------------
 * CORRECTIONARY 5.3: "Every value is an instrument ... plus its exact figure. A
 * number typeset on a background is not a readout." Each portion key carries a
 * printed fill mark — a zone filled to its own fraction, engraved into the grey
 * control plate — beside the exact grams and the exact price. The mark is
 * static print, not motion: a portion is a stable value and CD-BRIEF ruling 6
 * gives stable data a stable instrument.
 *
 * ---------------------------------------------------------------------------
 * POUND ARITHMETIC ("price from sku pro-rated by grams", the F2 standing rule)
 * ---------------------------------------------------------------------------
 *   totalMealG    = sum of every ingredient's grams across BOTH covers.
 *   totalMealCost = sum, per ingredient, of (gramsInMeal * sku.price / sku.packG).
 *                   Ingredients with no `sku` contribute 0.
 *   fraction      = the chosen portion (a bit=.25, half=.5, most=.75, all=1)
 *   grams         = round(fraction * totalMealG)
 *   value         = fraction * totalMealCost
 * Algebraically identical to pro-rating EVERY ingredient's grams by `fraction`
 * and summing each at its own price per gram — genuinely "price from sku
 * pro-rated by grams", not a flat per-portion average.
 */

import { useState } from "react";
import type { Meal } from "../../data/types";
import { ingredientsById } from "../../data";
import { Enclosure, Escutcheon, Lamp, Plate, PressKey } from "../../cd/foundry";
import { EstimateMark } from "../../components/EstimateMark";
import type { Action } from "../../state/types";
import { londonDateIso, addCalendarDays, formatShortDate } from "../../state/london";
import { cue } from "../../cd/sound/cues";
import { PORTIONS } from "./model";

/** Standard food-safety guidance for a cooked dinner leftover kept in the
 *  fridge. No per-dish shelf-life field exists in the data model for cooked
 *  meals — only raw ingredients carry `storage.life` — so this is a documented,
 *  clearly-flagged default, the same spirit as data/lifeEstimate.ts's own
 *  conservative fallbacks. countdown.ts's LEFTOVER_LIFE_DAYS restates it as the
 *  life channel's denominator so the two cannot drift. */
const COOKED_LEFTOVER_FRIDGE_DAYS = 3;

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

export interface DinnerLedgerProps {
  dinner: Meal | null;
  now: Date;
  alreadyEaten: boolean;
  /** The eaten tick's own time, HH:MM, or null. The age's exact figure. */
  eatenAt: string | null;
  dispatch: (a: Action) => void;
  commit: (a: Action) => void;
  /** The waste drawer this ledger writes into, and how many entries it holds. */
  wasteCount: number;
  onOpenWaste: () => void;
  trophy: boolean;
}

type Result =
  | { kind: "eaten" }
  | { kind: "leftover"; label: string; g: number; value: number; useBy: string }
  | { kind: "binned"; label: string; g: number; value: number };

export function DinnerLedger({
  dinner,
  now,
  alreadyEaten,
  eatenAt,
  dispatch,
  commit,
  wasteCount,
  onOpenWaste,
  trophy,
}: DinnerLedgerProps) {
  const [choosing, setChoosing] = useState<"leftover" | "binned" | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const todayIso = londonDateIso(now);

  /* The drawer this ledger writes into. It lives HERE rather than in a housing
     of its own because the ledger's "binned some" key is the only thing that
     ever fills it — an enclosure whose only job is to hold one key is jobless
     under CD-BRIEF ruling 4's ledger, and it was subtracted at Refined. */
  const drawer = (
    <span className="str-ledger__drawer">
      <PressKey onPress={onOpenWaste} cap="waste log ▸" sound="contact" />
      <Plate className="str-ledger__drawer-fig" surface="data">
        <span className="cd-data">{wasteCount}</span>
        <span className="cd-silkscreen">binned</span>
      </Plate>
    </span>
  );

  if (!dinner) {
    return (
      <Enclosure variant="hero" as="section" className="str-ledger" aria-label="dinner ledger">
        <Escutcheon as="h2" className="str-ledger__name">
          dinner
        </Escutcheon>
        <Plate className="str-ledger__face" surface="data">
          <span className="cd-prose">
            no plated dinner today — the fortnight has nothing on tonight&rsquo;s slot, so there is nothing
            to log.
          </span>
        </Plate>
        {!trophy && drawer}
      </Enclosure>
    );
  }

  const { totalG, totalCost } = computeMealTotals(dinner);

  function fire(action: Action): void {
    // 1 · SEMANTIC COMMIT — synchronous, this task, before any render work.
    commit(action);
    // 2 · the report, scheduled, and allowed to take its time.
    dispatch(action);
  }

  function handleEaten(): void {
    fire({ type: "eaten/tick", date: todayIso, slot: "dinner", mealId: dinner!.id });
    setResult({ kind: "eaten" });
    setChoosing(null);
    // II.5.7 — confirm fires only ONCE THE CONSEQUENCE HAS LANDED, never on
    // the press. The tick is in the model on the line above.
    cue("confirm");
  }

  function handlePortion(kind: "leftover" | "binned", fraction: number, label: string): void {
    const g = Math.round(fraction * totalG);
    const value = Math.round(fraction * totalCost * 100) / 100;

    if (kind === "leftover") {
      const useBy = addCalendarDays(todayIso, COOKED_LEFTOVER_FRIDGE_DAYS);
      fire({
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
      fire({
        type: "waste/add",
        entry: { ref: dinner!.id, g, price: value, date: todayIso, note: `binned from dinner: ${dinner!.name}` },
      });
      setResult({ kind: "binned", label, g, value });
    }
    setChoosing(null);
    cue("confirm");
  }

  return (
    <Enclosure variant="hero" as="section" className="str-ledger" aria-label="dinner ledger">
      <Escutcheon as="h2" className="str-ledger__name">
        dinner
      </Escutcheon>

      <Plate className="str-ledger__face" surface="data">
        <span className="str-ledger__meal">{dinner.name}</span>
        <span className="str-ledger__lamp">
          <Lamp
            lit={alreadyEaten || result !== null}
            word={{ on: "LOGGED", off: "NOT LOGGED" }}
            label="tonight's dinner"
            hue="var(--cd-role-success)"
          />
        </span>
        <span className="str-ledger__meta cd-printed">
          {totalG}g plated · <EstimateMark />£{totalCost.toFixed(2)}
          {alreadyEaten && eatenAt ? ` · ticked ${eatenAt}` : ""}
        </span>
      </Plate>

      {!trophy && !choosing && (
        <div className="str-ledger__keys">
          <PressKey onPress={handleEaten} cap="ate it all" sound="contact" />
          <PressKey onPress={() => setChoosing("leftover")} cap="saved a leftover" sound="contact" />
          <PressKey onPress={() => setChoosing("binned")} cap="binned some" sound="contact" />
          {drawer}
        </div>
      )}

      {!trophy && choosing && (
        <div className="str-ledger__portions" role="group" aria-label={`how much was ${choosing}?`}>
          {PORTIONS.map((p) => {
            const g = Math.round(p.fraction * totalG);
            const value = p.fraction * totalCost;
            return (
              <PressKey
                key={p.key}
                className="str-portion"
                onPress={() => handlePortion(choosing, p.fraction, p.label)}
                sound="contact"
                aria-label={`${p.label}, ${g} grams, ${value.toFixed(2)} pounds`}
                style={{ ["--str-portion-f" as string]: String(p.fraction) }}
              >
                {/* the printed fill mark — the fraction as a zone, engraved */}
                <span className="str-portion__mark" aria-hidden="true" />
                <span className="str-portion__word" aria-hidden="true">
                  {p.label}
                </span>
                <span className="str-portion__fig cd-data" aria-hidden="true">
                  {g}g · £{value.toFixed(2)}
                </span>
              </PressKey>
            );
          })}
          <PressKey className="str-ledger__cancel" onPress={() => setChoosing(null)} cap="cancel" />
        </div>
      )}

      <p className="str-ledger__status cd-printed" role="status" aria-live="polite">
        {!result && alreadyEaten && `already ticked eaten today${eatenAt ? ` at ${eatenAt}` : ""}`}
        {result?.kind === "eaten" && "logged · eaten"}
        {result?.kind === "leftover" && (
          <>
            saved · {result.label} · {result.g}g · <EstimateMark />£{result.value.toFixed(2)} · use by{" "}
            {formatShortDate(new Date(`${result.useBy}T00:00:00Z`))}
          </>
        )}
        {result?.kind === "binned" && (
          <>
            binned · {result.label} · {result.g}g · <EstimateMark />£{result.value.toFixed(2)} wasted
          </>
        )}
      </p>
    </Enclosure>
  );
}
