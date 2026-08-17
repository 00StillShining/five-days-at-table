/**
 * src/screens/cook/ProgramPicker.tsx — the standby deck.
 *
 * The same three groups in the same order as the shipped build (tonight's meal,
 * the Sunday session(s), any meal), rebuilt as machined seats rather than as a
 * list of buttons, and with the browsable pool moved onto the foundry Register.
 *
 * CD-BRIEF R7 — "No page-length scrolling. Long registers use a GROUPED
 * ACCORDION, one section open at a time, with the hidden remainder printed as a
 * number." Forty meals is the longest list on this screen and it was previously
 * a stack of <details> that could all be open at once.
 *
 * CD-BRIEF R6 — the open group lives in the chassis-level panel store, not in
 * this component's state, because App.tsx unmounts the scene on navigation. A
 * cook who opens WEEK A, checks STORES for a tin, and comes back finds WEEK A
 * still open. That matters more on COOK than anywhere, because leaving mid-cook
 * is now not only possible but expected (R5).
 *
 * NO CLOCK RUNS HERE, and that is what keeps the measured performance law's
 * clock hazard off this screen entirely: the picker only renders when no
 * program is loaded, and `useProgram`'s 1Hz interval only exists while one is
 * running. The long list and the per-second clock are mutually exclusive.
 */

import { useOpenSection } from "../../cd/chassis";
import { Enclosure, Escutcheon, Plate, PressKey, Register, type RegisterGroup } from "../../cd/foundry";
import { mealMacros } from "../../state/selectors";
import type { AppState } from "../../state/types";
import { activeVariant } from "../../data/variant";
import { TESTER_PROGRAM_SUFFIX } from "../../engine/programs";
import {
  groupedMealOptions,
  prepProgramDisplayName,
  prepSessionOptions,
  resolveTonightMeal,
  tonightDuty,
} from "./programGroups";
import "./cook.css";

const SLOT_LABEL: Record<string, string> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
};

export interface ProgramPickerProps {
  state: AppState;
  now: Date;
  onLoad: (programId: string) => void;
}

export function ProgramPicker({ state, now, onLoad }: ProgramPickerProps) {
  const variant = activeVariant(state);
  const duty = tonightDuty(state, now);
  const tonight = resolveTonightMeal(duty);
  const sessions = prepSessionOptions(variant);
  const weekGroups = groupedMealOptions(variant);
  const [openWeek, setOpenWeek] = useOpenSection("cook-picker");

  const groups: RegisterGroup[] = weekGroups.map((group) => ({
    id: group.week,
    label: `week ${group.week.toLowerCase()}`,
    items: group.days.flatMap((day) =>
      day.meals.map((meal) => () => {
        const macros = mealMacros(meal.id, state.prefs.cover, state.prefs.scale);
        return (
          <PressKey
            className="ck-seat ck-seat--meal"
            onPress={() => onLoad(meal.id)}
            aria-label={`load ${meal.name}, ${SLOT_LABEL[meal.slot] ?? meal.slot}, day ${day.day}`}
          >
            <span className="ck-seat-slot cd-silkscreen">
              d{day.day} · {SLOT_LABEL[meal.slot] ?? meal.slot}
            </span>
            <span className="ck-seat-name">{meal.name}</span>
            <span className="ck-seat-meta cd-printed">
              {macros.kcal}
              <span className="cd-unit">kcal</span>
            </span>
          </PressKey>
        );
      })
    ),
  }));

  return (
    <div className="ck-picker">
      <Enclosure variant="faceplate" grain className="ck-picker-head">
        <Escutcheon>cook · standby</Escutcheon>
        <Plate className="ck-picker-plate">
          <h1 className="ck-picker-title">no program loaded</h1>
          <p className="ck-picker-sub">
            the deck is stopped. load tonight's dinner, a sunday session, or any meal.
          </p>
        </Plate>
      </Enclosure>

      {tonight && duty && (
        <Enclosure variant="hero" grain className="ck-picker-tonight" as="section">
          <Escutcheon>tonight</Escutcheon>
          <PressKey
            className="ck-seat ck-seat--tonight"
            onPress={() => onLoad(tonight.id)}
            aria-label={`load ${tonight.name}, start by ${duty.startBy}`}
          >
            <span className="ck-seat-name ck-seat-name--big">{tonight.name}</span>
            <span className="ck-seat-meta cd-printed">start by {duty.startBy}</span>
          </PressKey>
        </Enclosure>
      )}

      <Enclosure variant="hero" grain className="ck-picker-sessions" as="section">
        <Escutcheon>sunday sessions</Escutcheon>
        <div className="ck-picker-session-row">
          {sessions.map(({ week, programId, session, totalMinutes, reducedNote }) => {
            const reduced = programId.endsWith(TESTER_PROGRAM_SUFFIX);
            return (
              <PressKey
                key={programId}
                className="ck-seat ck-seat--session"
                onPress={() => onLoad(programId)}
                aria-label={`load ${reduced ? "starter sunday session" : prepProgramDisplayName(week)}, ${totalMinutes} minutes`}
              >
                <span className="ck-seat-name">
                  {reduced ? "starter sunday session" : prepProgramDisplayName(week)}
                </span>
                <span className="ck-seat-desc">{reducedNote ?? session.sessionName}</span>
                <span className="ck-seat-meta cd-printed">
                  {totalMinutes}
                  <span className="cd-unit">min</span>
                </span>
              </PressKey>
            );
          })}
        </div>
      </Enclosure>

      <Enclosure variant="hero" grain className="ck-picker-any" as="section">
        <Escutcheon>any meal</Escutcheon>
        <Register
          groups={groups}
          openId={openWeek}
          onOpenChange={setOpenWeek}
          label="every approved meal, grouped by week"
          overflowWord="more"
          className="ck-picker-register"
        />
      </Enclosure>
    </div>
  );
}
