import { useCallback, useEffect, useMemo, useState } from "react";
import type { SceneProps } from "../../app/router";
import { useStore } from "../../state/store";
import { arbiterFor, type ArbiterDuty } from "../../engine/arbiter";
import { ArbiterSlot } from "../../components/ArbiterSlot";
import { Paddle } from "../../components/Paddle";
import { getMeal } from "../../data";
import type { Meal } from "../../data";
import { PortionKnob } from "./PortionKnob";
import { CoverColumn } from "./CoverColumn";
import { BatchCard } from "./BatchCard";
import { MethodPreview } from "./MethodPreview";
import "./meal.css";

/** MEAL — drill-in card (PLAN §6.5). Route: #/meal/:id. */
export default function MealScreen({ route }: SceneProps) {
  const id = route.params.id;
  const meal = id ? getMeal(id) : undefined;

  if (!meal) {
    return <UnknownMealCard id={id} />;
  }
  return <MealCard meal={meal} />;
}

function UnknownMealCard({ id }: { id?: string }) {
  return (
    <div className="scr-meal scr-meal--error">
      <p className="scr-meal-error-kicker">meal not found</p>
      <p className="scr-meal-error-id">{id ? `no meal with id "${id}"` : "no meal id in the route"}</p>
      <a className="fd5-control scr-meal-back" href="#/plan">
        {"‹"} back to plan
      </a>
    </div>
  );
}

function MealCard({ meal }: { meal: Meal }) {
  const { state, dispatch } = useStore();

  // Same 60s freshness pattern as App.tsx's masthead clock — the arbiter's
  // app-wide categories (expired/defrost-overdue/timer-due) must stay live
  // on every screen, not just TODAY (PHASE2-CONTRACT: "runners-up render
  // quiet... rank1 clears"). No shared hook exists to reuse across screen
  // folders (ownership: src/screens/meal/** only), so this is a deliberate,
  // small duplication rather than a cross-screen import.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const scale = state.prefs.scale;
  const primaryCover = state.prefs.cover;

  const setScale = useCallback(
    (v: number) => dispatch({ type: "prefs/set", patch: { scale: v } }),
    [dispatch]
  );

  const toggleCover = useCallback(
    () => dispatch({ type: "prefs/set", patch: { cover: primaryCover === "w" ? "m" : "w" } }),
    [dispatch, primaryCover]
  );

  // Program loading is COOK's job (not MEAL's) — this only sets the meal id
  // COOK should load (via the pinned `timers/load` store action) and routes
  // there; COOK's own screen is responsible for reading `timers.programId`
  // and compiling/running the program (src/engine/programs.ts already
  // resolves a meal id to a Program, so this hand-off is load-bearing today
  // even while COOK is still a placeholder scene).
  const goCook = useCallback(() => {
    dispatch({ type: "timers/load", programId: meal.id });
    window.location.hash = "#/cook";
  }, [dispatch, meal.id]);

  const { rank1, queued } = useMemo(
    () => arbiterFor("meal", state, now, { mealId: meal.id }),
    [state, now, meal.id]
  );

  const handleArbiterActivate = useCallback(
    (duty: ArbiterDuty) => {
      if (duty.target?.screen === "cook" && duty.target.id) {
        dispatch({ type: "timers/load", programId: duty.target.id });
        window.location.hash = "#/cook";
        return;
      }
      if (duty.target?.screen) window.location.hash = `#/${duty.target.screen}`;
    },
    [dispatch]
  );

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

      {rank1 && (
        <ArbiterSlot
          text={rank1.text}
          count={queued}
          actionLabel="go →"
          onActivate={() => handleArbiterActivate(rank1)}
        />
      )}

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
