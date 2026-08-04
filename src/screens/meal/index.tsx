import { useCallback, useMemo } from "react";
import type { SceneProps } from "../../app/router";
import { useStore } from "../../state/store";
import { useNow } from "../../state/useNow";
import { arbiterFor, type ArbiterDuty as EngineArbiterDuty } from "../../engine/arbiter";
import { ArbiterSlot } from "../../components/ArbiterSlot";
import { Paddle } from "../../components/Paddle";
import { getMeal } from "../../data";
import { PortionKnob } from "./PortionKnob";
import { CoverColumn } from "./CoverColumn";
import { BatchCard } from "./BatchCard";
import { MethodPreview } from "./MethodPreview";
import "./meal.css";

/** MEAL — drill-in card (PLAN §6.5). Route: #/meal/:id. */
export default function MealScreen({ route }: SceneProps) {
  const id = route.params.id;
  const meal = id ? getMeal(id) : undefined;

  const { state, dispatch } = useStore();
  const now = useNow();

  // Without a resolved meal there's no mealId-scoped primary action ("cook
  // →"), but the app-wide categories (expired/defrost-overdue/timer-due/
  // over-band/verify-nominee) still apply — arbiterFor's ctx.mealId is
  // optional precisely so this still surfaces a real duty on the error
  // branch rather than only ever going idle there.
  const { rank1, queued } = useMemo(
    () => arbiterFor("meal", state, now, meal ? { mealId: meal.id } : {}),
    [state, now, meal]
  );

  const handleArbiterActivate = useCallback(
    (duty: EngineArbiterDuty) => {
      if (duty.target?.screen === "cook" && duty.target.id) {
        dispatch({ type: "timers/load", programId: duty.target.id });
        window.location.hash = "#/cook";
        return;
      }
      if (duty.target?.screen) window.location.hash = `#/${duty.target.screen}`;
    },
    [dispatch]
  );

  // ArbiterSlot's own ArbiterDuty shape (text/actionLabel/onActivate/busy) is
  // the presentational one, distinct from engine/arbiter's ArbiterDuty
  // (kind/id/text/target) — this maps the latter onto the former. Passed via
  // the `rank1` prop (wave-1 integration review convention): ALWAYS render
  // the slot, on every branch below — `null` renders the quiet idle variant
  // rather than the slot disappearing.
  const slotDuty = rank1 ? { text: rank1.text, actionLabel: "go →", onActivate: () => handleArbiterActivate(rank1) } : null;

  if (!meal) {
    return (
      <div className="scr-meal scr-meal--error">
        <ArbiterSlot rank1={slotDuty} count={queued} />
        <p className="scr-meal-error-kicker">meal not found</p>
        <p className="scr-meal-error-id">{id ? `no meal with id "${id}"` : "no meal id in the route"}</p>
        <a className="fd5-control scr-meal-back" href="#/plan">
          {"‹"} back to plan
        </a>
      </div>
    );
  }

  const scale = state.prefs.scale;
  const primaryCover = state.prefs.cover;

  const setScale = (v: number) => dispatch({ type: "prefs/set", patch: { scale: v } });
  const toggleCover = () => dispatch({ type: "prefs/set", patch: { cover: primaryCover === "w" ? "m" : "w" } });

  // Program loading is COOK's job (not MEAL's) — this only sets the meal id
  // COOK should load (via the pinned `timers/load` store action) and routes
  // there; COOK's own screen is responsible for reading `timers.programId`
  // and compiling/running the program (src/engine/programs.ts already
  // resolves a meal id to a Program, so this hand-off is load-bearing today
  // even while COOK is still a placeholder scene).
  const goCook = () => {
    dispatch({ type: "timers/load", programId: meal.id });
    window.location.hash = "#/cook";
  };

  const batchTakeG = meal.method.batchTakeG;

  return (
    <div className="scr-meal">
      <header className="scr-meal-head">
        <p className="scr-meal-kicker">
          week {meal.week} · day {meal.day} · {meal.slot}
          <span className="scr-meal-tag" data-tag={meal.tag}>
            {meal.tag}
          </span>
        </p>
        <h1 className="scr-meal-title">{meal.name}</h1>
        <p className="scr-meal-origin">{meal.origin}</p>
      </header>

      <ArbiterSlot rank1={slotDuty} count={queued} />

      <section className="scr-meal-hero" aria-label="portion size control">
        <PortionKnob scale={scale} onChange={setScale} />
      </section>

      <section className="scr-meal-covers" aria-label="ingredients by cover">
        <div className="scr-meal-cover-toggle">
          <Paddle
            name="cover"
            checked={primaryCover === "m"}
            optionA={{ value: "w", label: "her 70" }}
            optionB={{ value: "m", label: "him 85" }}
            onToggle={toggleCover}
          />
        </div>
        <div className="scr-meal-cover-grid">
          <CoverColumn
            meal={meal}
            cover="w"
            scale={scale}
            inventory={state.inventory}
            primary={primaryCover === "w"}
          />
          <CoverColumn
            meal={meal}
            cover="m"
            scale={scale}
            inventory={state.inventory}
            primary={primaryCover === "m"}
          />
        </div>
      </section>

      {batchTakeG && <BatchCard meal={meal} scale={scale} batchTakeG={batchTakeG} />}

      <MethodPreview meal={meal} onCook={goCook} />
    </div>
  );
}
