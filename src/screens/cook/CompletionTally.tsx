/**
 * src/screens/cook/CompletionTally.tsx — the deck at the end of the tape.
 *
 * Same facts as the shipped build (the eaten tick, the stamped yields, the
 * logged leftovers, the named skipped steps), rebuilt as a machined tally.
 *
 * WHAT WAS REMOVED, and why it is the Refined rung's own question. The shipped
 * version drew an animated ring-and-check SVG. The ledger asks "does it state a
 * value, or let the hand do something?" — a checkmark that appears because the
 * page it is on is the completion page states nothing the heading beside it
 * does not already state, and it animates on arrival, which is a motion the
 * operator must wait through on the hundredth session. It is gone. The success
 * lamp that replaces it carries a reserved role with its printed word, which is
 * a report; the ring was decoration wearing a report's clothes.
 */

import { Enclosure, Escutcheon, Lamp, Plate, PressKey } from "../../cd/foundry";
import { getIngredient, ingIdForYield } from "../../data";
import type { LeftoverEntry } from "../../state/types";
import type { Cover, Macros, Meal, PrepSession, Week } from "../../data/types";
import { formatShortDate } from "../../state/london";
import { prepProgramDisplayName } from "./programGroups";
import "./cook.css";

export interface MealTallyProps {
  kind: "meal";
  meal: Meal;
  cover: Cover;
  macros: Macros;
  /**
   * Steps that never got their own "done" press before the final step closed
   * the program out. Cook-authority means finishing never forces going back for
   * them, but the tally names the gap rather than hiding it.
   */
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

function Skipped({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <p className="ck-tally-skipped cd-printed">
      {count} step{count === 1 ? "" : "s"} closed without their own press
    </p>
  );
}

export function CompletionTally(props: CompletionTallyProps) {
  return (
    <div className="ck-tally">
      <Enclosure variant="hero" grain className="ck-tally-head">
        <div className="ck-tally-lamp">
          <Lamp
            lit
            word={{ on: "complete", off: "complete" }}
            label="program"
            hue="var(--cd-role-success)"
          />
        </div>
        <Escutcheon>tape ended</Escutcheon>
      </Enclosure>

      {props.kind === "meal" ? <MealSummary {...props} /> : <PrepSummary {...props} />}

      <PressKey className="ck-tally-done" onPress={props.onDone} cap="load another program" />
    </div>
  );
}

function MealSummary({ meal, macros, skippedCount }: MealTallyProps) {
  return (
    <Enclosure variant="hero" grain className="ck-tally-body">
      <Plate className="ck-tally-plate">
        <h1 className="ck-tally-title">{meal.name}</h1>
        <p className="ck-tally-line">logged · dinner eaten</p>
        <p className="ck-tally-macros cd-printed">
          {macros.kcal}<span className="cd-unit">kcal</span>
          {" · "}
          {macros.protein}<span className="cd-unit">g protein</span>
          {" · "}
          {macros.netCarb}<span className="cd-unit">g carb</span>
          {" · "}
          {macros.fat}<span className="cd-unit">g fat</span>
        </p>
        <Skipped count={skippedCount} />
      </Plate>
      <a className="ck-tally-link cd-focusable" href="#/today">
        today
      </a>
    </Enclosure>
  );
}

function PrepSummary({ week, session, newLeftovers, skippedCount }: PrepTallyProps) {
  const stamped = session.yields
    .map((y) => {
      const ingId = ingIdForYield(week, y.component);
      return ingId
        ? { component: y.component, ingId, name: getIngredient(ingId)?.name.display ?? ingId }
        : null;
    })
    .filter((x): x is { component: string; ingId: string; name: string } => x != null);

  return (
    <Enclosure variant="hero" grain className="ck-tally-body">
      <Plate className="ck-tally-plate">
        <h1 className="ck-tally-title">{prepProgramDisplayName(week)}</h1>
        <p className="ck-tally-subtitle">{session.sessionName}</p>
        <p className="ck-tally-line cd-printed">
          {stamped.length}<span className="cd-unit">stamped into stores</span>
          {" · "}
          {newLeftovers.length}<span className="cd-unit">
            leftover{newLeftovers.length === 1 ? "" : "s"} logged
          </span>
        </p>
        <Skipped count={skippedCount} />

        {stamped.length > 0 && (
          <ul className="ck-tally-list">
            {stamped.map((s) => (
              <li key={s.ingId}>
                {s.component} → <strong>{s.name}</strong> · full
              </li>
            ))}
          </ul>
        )}

        {newLeftovers.length > 0 && (
          <ul className="ck-tally-list">
            {newLeftovers.map((l) => (
              <li key={l.id}>
                {l.ref} → leftovers · use by {formatShortDate(new Date(l.useBy))}
              </li>
            ))}
          </ul>
        )}
      </Plate>
      <a className="ck-tally-link cd-focusable" href="#/stores">
        stores
      </a>
    </Enclosure>
  );
}
