// COOK's completion state (PLAN §6.6/§6.0): "meal program → eaten tick
// dispatch + tally scene (the ONE playful touch: small status scene + text
// summary); prep session → stamp yields into STORES with computed use-by
// dates + text summary of what was stamped." Every state the status scene
// expresses also exists as text (PLAN §6.1: "status scenes ... are
// redundant decoration by contract").
import { getIngredient, ingIdForYield } from "../../data";
import type { LeftoverEntry } from "../../state/types";
import type { Cover, Meal, PrepSession, Week } from "../../data/types";
import type { Macros } from "../../data/types";
import { formatShortDate } from "../../state/london";
import { prepProgramDisplayName } from "./programGroups";

function StatusScene({ ok }: { ok: boolean }) {
  // Flat, no gradients (Phase 2 law). A single settle-in pulse via
  // data-motion — reduced-motion collapses it to the static final frame
  // (tokens.css's global rule), which is exactly the same checkmark, so
  // nothing is lost, only the motion.
  return (
    <svg viewBox="0 0 64 64" className="scr-cook-tally-scene" aria-hidden="true" focusable="false">
      <circle cx={32} cy={32} r={28} className="scr-cook-tally-ring" data-motion />
      {ok && <path d="M20 33 L28 41 L45 22" className="scr-cook-tally-check" data-motion />}
    </svg>
  );
}

export interface MealTallyProps {
  kind: "meal";
  meal: Meal;
  cover: Cover;
  macros: Macros;
  /** Steps that never got their own individual "done ▸" tap before the
   * final step closed the program out — cook-authority means finishing
   * doesn't force going back for them (orchestrator ruling, FIX round item
   * 4), but the tally still names the gap rather than silently hiding it. */
  skippedCount: number;
  onDone: () => void;
}

export interface PrepTallyProps {
  kind: "prep";
  week: Week;
  session: PrepSession;
  newLeftovers: LeftoverEntry[];
  skippedCount: number;
  onDone: () => void;
}

export type CompletionTallyProps = MealTallyProps | PrepTallyProps;

export function CompletionTally(props: CompletionTallyProps) {
  return (
    <div className="scr-cook-tally">
      <StatusScene ok />
      {props.kind === "meal" ? <MealSummary {...props} /> : <PrepSummary {...props} />}
      <button type="button" className="fd5-control scr-cook-tally-done" onClick={props.onDone}>
        cook something else ▸
      </button>
    </div>
  );
}

function SkippedNote({ skippedCount }: { skippedCount: number }) {
  if (skippedCount <= 0) return null;
  return (
    <p className="scr-cook-tally-skipped">
      {skippedCount} step{skippedCount === 1 ? "" : "s"} skipped
    </p>
  );
}

function MealSummary({ meal, macros, skippedCount }: MealTallyProps) {
  return (
    <div className="scr-cook-tally-body">
      <p className="scr-cook-eyebrow">complete</p>
      <h1 className="scr-cook-tally-title">{meal.name}</h1>
      <p className="scr-cook-tally-line">logged · dinner eaten ✓</p>
      <p className="scr-cook-tally-macros">
        {macros.kcal} kcal · {macros.protein}g protein · {macros.netCarb}g carb · {macros.fat}g fat
      </p>
      <SkippedNote skippedCount={skippedCount} />
      <a className="fd5-control scr-cook-tally-link" href="#/today">
        {"→"} today
      </a>
    </div>
  );
}

function PrepSummary({ week, session, newLeftovers, skippedCount }: PrepTallyProps) {
  const stampedIngredients = session.yields
    .map((y) => {
      const ingId = ingIdForYield(week, y.component);
      return ingId ? { component: y.component, ingId, name: getIngredient(ingId)?.name.display ?? ingId } : null;
    })
    .filter((x): x is { component: string; ingId: string; name: string } => x != null);

  const leftoverCount = newLeftovers.length;

  return (
    <div className="scr-cook-tally-body">
      <p className="scr-cook-eyebrow">complete</p>
      <h1 className="scr-cook-tally-title">{prepProgramDisplayName(week)}</h1>
      <p className="scr-cook-tally-subtitle">{session.sessionName}</p>
      <p className="scr-cook-tally-line">
        {stampedIngredients.length} stamped into stores · {leftoverCount} leftover{leftoverCount === 1 ? "" : "s"} logged
      </p>
      <SkippedNote skippedCount={skippedCount} />

      {stampedIngredients.length > 0 && (
        <ul className="scr-cook-tally-list">
          {stampedIngredients.map((s) => (
            <li key={s.ingId}>
              {s.component} {"→"} <strong>{s.name}</strong> · full
            </li>
          ))}
        </ul>
      )}

      {newLeftovers.length > 0 && (
        <ul className="scr-cook-tally-list">
          {newLeftovers.map((l) => (
            <li key={l.id}>
              {l.ref} {"→"} leftovers · use by {formatShortDate(new Date(l.useBy))}
            </li>
          ))}
        </ul>
      )}

      <a className="fd5-control scr-cook-tally-link" href="#/stores">
        {"→"} stores
      </a>
    </div>
  );
}
