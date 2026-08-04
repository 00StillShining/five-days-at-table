// Standby program picker — COOK's empty state (PLAN §6.6 / Sol §5.1: "no
// program picked"). Three groups, in the spec's own order: tonight's meal
// first, then the two Sunday batch sessions, then any meal (grouped list).
import { mealMacros } from "../../state/selectors";
import type { AppState } from "../../state/types";
import type { Meal } from "../../data/types";
import { groupedMealOptions, prepProgramDisplayName, prepSessionOptions, resolveTonightMeal, tonightDuty } from "./programGroups";

const SLOT_LABEL: Record<string, string> = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snack: "snack" };

export interface ProgramPickerProps {
  state: AppState;
  now: Date;
  onLoad: (programId: string) => void;
}

export function ProgramPicker({ state, now, onLoad }: ProgramPickerProps) {
  const duty = tonightDuty(state, now);
  const tonight = resolveTonightMeal(duty);
  const sessions = prepSessionOptions();
  const weekGroups = groupedMealOptions();

  return (
    <div className="scr-cook-picker">
      <header className="scr-cook-picker-head">
        <p className="scr-cook-eyebrow">cook</p>
        <h1 className="scr-cook-picker-title">no program loaded</h1>
        <p className="scr-cook-picker-sub">pick tonight's dinner, a Sunday session, or browse any meal.</p>
      </header>

      {tonight && duty && (
        <section className="scr-cook-picker-section" aria-labelledby="scr-cook-tonight-h">
          <h2 id="scr-cook-tonight-h" className="scr-cook-h">
            tonight
          </h2>
          <button
            type="button"
            className="fd5-control scr-cook-picker-tonight"
            onClick={() => onLoad(tonight.id)}
          >
            <span className="scr-cook-picker-tonight-name">{tonight.name}</span>
            <span className="scr-cook-picker-tonight-meta">start by {duty.startBy}</span>
          </button>
        </section>
      )}

      <section className="scr-cook-picker-section" aria-labelledby="scr-cook-sessions-h">
        <h2 id="scr-cook-sessions-h" className="scr-cook-h">
          sunday sessions
        </h2>
        <ul className="scr-cook-picker-session-list">
          {sessions.map(({ week, programId, session, totalMinutes }) => (
            <li key={programId}>
              <button type="button" className="fd5-control scr-cook-picker-session" onClick={() => onLoad(programId)}>
                <span className="scr-cook-picker-session-text">
                  <span className="scr-cook-picker-session-name">{prepProgramDisplayName(week)}</span>
                  <span className="scr-cook-picker-session-desc">{session.sessionName}</span>
                </span>
                <span className="scr-cook-picker-session-meta">{totalMinutes} min</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="scr-cook-picker-section" aria-labelledby="scr-cook-any-h">
        <h2 id="scr-cook-any-h" className="scr-cook-h">
          any meal
        </h2>
        <div className="scr-cook-picker-groups">
          {weekGroups.map((group) => (
            <details key={group.week} className="scr-cook-picker-week">
              <summary className="fd5-control scr-cook-picker-week-summary">week {group.week.toLowerCase()}</summary>
              <div className="scr-cook-picker-week-body">
                {group.days.map((d) => (
                  <div key={d.day} className="scr-cook-picker-day">
                    <p className="scr-cook-picker-day-label">day {d.day}</p>
                    <ul className="scr-cook-picker-meal-list">
                      {d.meals.map((meal: Meal) => {
                        const m = mealMacros(meal.id, state.prefs.cover, state.prefs.scale);
                        return (
                          <li key={meal.id}>
                            <button
                              type="button"
                              className="fd5-control scr-cook-picker-meal"
                              onClick={() => onLoad(meal.id)}
                            >
                              <span className="scr-cook-picker-meal-slot">{SLOT_LABEL[meal.slot] ?? meal.slot}</span>
                              <span className="scr-cook-picker-meal-name">{meal.name}</span>
                              <span className="scr-cook-picker-meal-meta">{m.kcal} kcal</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
