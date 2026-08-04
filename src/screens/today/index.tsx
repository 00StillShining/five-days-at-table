// TODAY — the duty deck (PLAN §6.3 / D7). "Answers 'what does the system need
// from me right now.'" Phase 2 wave 1 (docs/PHASE2-CONTRACT.md): this folder is
// self-contained per the ownership rule — no other screen folder imports from it,
// and it imports only components/engine/state/data, never another screen.
//
// KEY FACT (repeated from the selectors.ts module doc because it's easy to get
// wrong here specifically): the executing fortnight is ALWAYS Week A, twice
// (D5). `prefs.week` is a browsing toggle for PLAN/MEAL, not "which week TODAY
// is cooking" — every meals/macros/bands read below is hard-coded to "A",
// independent of the week paddle in the masthead.
import type { SceneProps } from "../../app/router";
import { useStore } from "../../state/store";
import type { DefrostDuty, ExpiringDuty, StartByDuty } from "../../state/selectors";
import { bands, dayMacros, dutyStack, ticksFor, todayInfo } from "../../state/selectors";
import { addCalendarDays, londonDateIso, londonParts } from "../../state/london";
import { arbiterFor, type ScreenId } from "../../engine/arbiter";
import { ArbiterSlot } from "../../components/ArbiterSlot";
import { getMeal, mealsByWeekDay } from "../../data";
import type { InventoryLevel } from "../../state/types";
import type { Slot } from "../../data/types";
import { useNow } from "./useNow";
import { DayPads, type DayPadInfo } from "./DayPads";
import { MacroLadders } from "./MacroLadders";
import "./today.css";

const SLOT_LABEL: Record<Slot, string> = { breakfast: "bfast", lunch: "lunch", dinner: "dinner", snack: "snack" };

/** ISO-weekday offset (Mon=0..Sun=6) used only to find "this calendar week's
 * Monday" for the day-pad row — independent of prefs.cycleStartSaturday, since
 * the pads read real calendar dates (this week's Mon-Fri), not fortnight
 * position. Works whether or not the fortnight is anchored yet. */
const MON_OFFSET: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function formatLondonTime(iso: string): string {
  const { hour, minute } = londonParts(new Date(iso));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function DutyRow({ duty, onDefrostDone }: { duty: DefrostDuty | ExpiringDuty; onDefrostDone: (ingId: string) => void }) {
  if (duty.kind === "defrost") {
    return (
      <li className={`scr-today-row${duty.overdue ? " scr-today-row--danger" : ""}`}>
        <span className="scr-today-row-text">{duty.text}</span>
        <span className="scr-today-row-meta">{duty.overdue ? "overdue" : `by ${formatLondonTime(duty.dueAt)}`}</span>
        <button type="button" className="fd5-control scr-today-row-action" onClick={() => onDefrostDone(duty.ingId)}>
          done
        </button>
      </li>
    );
  }
  return (
    <li className={`scr-today-row${duty.expired ? " scr-today-row--danger" : " scr-today-row--warning"}`}>
      <span className="scr-today-row-text">{duty.text}</span>
      <span className="scr-today-row-meta">{duty.expired ? "" : `${Math.max(0, Math.floor(duty.remainingDays))}d`}</span>
      <a className="fd5-control scr-today-row-action" href="#/stores">
        {"→ stores"}
      </a>
    </li>
  );
}

export default function TodayScene(_props: SceneProps) {
  const { state, dispatch } = useStore();
  const { prefs } = state;
  const now = useNow();

  const info = todayInfo(now, prefs.cycleStartSaturday);
  const todayIso = londonDateIso(now);
  const duties = dutyStack(state, now);
  const stackDuties = duties.filter((d): d is DefrostDuty | ExpiringDuty => d.kind !== "start-by");
  const tonightDuty = duties.find((d): d is StartByDuty => d.kind === "start-by") ?? null;
  const arbiter = arbiterFor("today", state, now);
  const rank1 = arbiter.rank1;

  const mondayIso = addCalendarDays(todayIso, -(MON_OFFSET[info.weekday] ?? 0));
  const dayPads: DayPadInfo[] = [1, 2, 3, 4, 5].map((dayNo) => {
    const dateIso = addCalendarDays(mondayIso, dayNo - 1);
    const slots = mealsByWeekDay("A", dayNo);
    const tick = ticksFor(state, dateIso);
    const done = slots.length > 0 && slots.every((m) => Boolean(tick[m.slot]));
    return { dayNo, done, isToday: info.dayNo === dayNo };
  });

  function handleDefrostDone(ingId: string) {
    const level: InventoryLevel = state.inventory[ingId]?.level ?? 4;
    dispatch({ type: "inventory/set", ingId, level });
  }

  function handleTickToggle(slot: Slot, mealId: string, isOn: boolean) {
    if (isOn) dispatch({ type: "eaten/untick", date: todayIso, slot });
    else dispatch({ type: "eaten/tick", date: todayIso, slot, mealId });
  }

  const arbiterTargetScreen: ScreenId | null = rank1?.target && rank1.target.screen !== "today" ? rank1.target.screen : null;

  const weekday3 = info.weekday.toLowerCase();

  return (
    <section className="scr-today">
      {rank1 && (
        <ArbiterSlot
          text={rank1.text}
          count={arbiter.queued}
          actionLabel={arbiterTargetScreen ? `${arbiterTargetScreen} →` : undefined}
          onActivate={arbiterTargetScreen ? () => { window.location.hash = `#/${arbiterTargetScreen}`; } : undefined}
        />
      )}

      <header className="scr-today-header">
        <p className="scr-today-dateline">
          <span>{weekday3}</span>
          <span aria-hidden="true"> · </span>
          <span>week a</span>
          {typeof info.dayNo === "number" && (
            <>
              <span aria-hidden="true"> · </span>
              <span>day {info.dayNo}</span>
            </>
          )}
        </p>
        {typeof info.dayNo === "number" && <DayPads days={dayPads} />}
      </header>

      {!prefs.cycleStartSaturday && (
        <div className="scr-today-onboard" role="note">
          <p className="scr-today-onboard-title">set your fortnight start</p>
          <p className="scr-today-onboard-body">
            today needs your cycle's start saturday to line up defrost moves and tonight's start-by time. open{" "}
            <span aria-hidden="true">⚙</span> settings, top right, and set "cycle start · saturday" once.
          </p>
        </div>
      )}

      <section className="scr-today-section" aria-labelledby="scr-today-duties-h">
        <h2 id="scr-today-duties-h" className="scr-today-h">
          duty stack
        </h2>
        {stackDuties.length === 0 ? (
          <p className="scr-today-empty">nothing owed · next: sat shop</p>
        ) : (
          <ul className="scr-today-duty-list">
            {stackDuties.map((d) => (
              <DutyRow key={d.id} duty={d} onDefrostDone={handleDefrostDone} />
            ))}
          </ul>
        )}
      </section>

      {tonightDuty && (
        <section className="scr-today-section" aria-labelledby="scr-today-tonight-h">
          <h2 id="scr-today-tonight-h" className="scr-today-h">
            tonight
          </h2>
          <div className="scr-today-tonight">
            <span className="scr-today-tonight-name">{getMeal(tonightDuty.mealId)?.name ?? tonightDuty.mealId}</span>
            <span className="scr-today-tonight-time">start by {tonightDuty.startBy}</span>
            <a className="fd5-control scr-today-tonight-cook" href="#/cook">
              cook →
            </a>
          </div>
        </section>
      )}

      {info.dayNo === "weekend" && (
        <p className="scr-today-weekend-note">
          {info.weekday === "Sat" ? "tomorrow: sunday session" : "next: sat shop"}
        </p>
      )}

      {typeof info.dayNo === "number" && (
        <section className="scr-today-section" aria-labelledby="scr-today-ticks-h">
          <h2 id="scr-today-ticks-h" className="scr-today-h">
            ticks
          </h2>
          <ul className="scr-today-ticks">
            {mealsByWeekDay("A", info.dayNo).map((meal) => {
              const isOn = Boolean(ticksFor(state, todayIso)[meal.slot]);
              return (
                <li key={meal.slot}>
                  <button
                    type="button"
                    className={`fd5-control scr-today-tick${isOn ? " scr-today-tick--on" : ""}`}
                    aria-pressed={isOn}
                    onClick={() => handleTickToggle(meal.slot, meal.id, isOn)}
                  >
                    <span className="scr-today-tick-glyph" aria-hidden="true">
                      {isOn ? "✓" : ""}
                    </span>
                    <span className="scr-today-tick-label">{SLOT_LABEL[meal.slot]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {typeof info.dayNo === "number" && (
        <section className="scr-today-section scr-today-console" aria-labelledby="scr-today-console-h">
          <h2 id="scr-today-console-h" className="scr-today-h">
            console
          </h2>
          <MacroLadders macros={dayMacros("A", info.dayNo, prefs.cover)} bands={bands("A", prefs.cover)} />
        </section>
      )}
    </section>
  );
}
