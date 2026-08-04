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
import { bands, dayMacros, dutyStack, eatenSoFar, effectiveMealForSlot, formatRemainingDays, ticksFor, todayInfo } from "../../state/selectors";
import { addCalendarDays, formatShortDate, londonDateIso, londonParts } from "../../state/london";
import { useNow } from "../../state/useNow";
import { arbiterFor, type ScreenId } from "../../engine/arbiter";
import { ArbiterSlot, type ArbiterDuty } from "../../components/ArbiterSlot";
import { useOpenSettings } from "../../components/OpenSettings";
import { getMeal, mealsByWeekDay } from "../../data";
import type { Slot } from "../../data/types";
import { DayPads, type DayPadInfo } from "./DayPads";
import { MacroLadders } from "./MacroLadders";
import "./today.css";

const SLOT_LABEL: Record<Slot, string> = { breakfast: "bfast", lunch: "lunch", dinner: "dinner", snack: "snack" };
const SLOT_ORDER: Slot[] = ["breakfast", "lunch", "dinner", "snack"];

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
        {/* wave-1 fix (item 6): formatShortDate (state/london) — an "overdue"
            row that's been sitting since a previous fortnight day said only
            "overdue" with no way to tell since when; now names the day it
            became due. */}
        <span className="scr-today-row-meta">
          {duty.overdue ? `overdue · ${formatShortDate(new Date(duty.dueAt))}` : `by ${formatLondonTime(duty.dueAt)}`}
        </span>
        <button type="button" className="fd5-control scr-today-row-action" onClick={() => onDefrostDone(duty.ingId)}>
          done
        </button>
      </li>
    );
  }
  return (
    <li className={`scr-today-row${duty.expired ? " scr-today-row--danger" : " scr-today-row--warning"}`}>
      <span className="scr-today-row-text">{duty.text}</span>
      {/* wave-1 fix (item 6): shared formatRemainingDays (state/selectors) —
          TODAY was flooring this and STORES was ceiling it, so the same item
          could read "0d" here and "1d" there; also fills what used to be an
          empty meta cell on expired rows ("expired"/"today"/"Nd", never blank). */}
      <span className="scr-today-row-meta">{formatRemainingDays(duty.remainingDays)}</span>
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
  const openSettings = useOpenSettings();

  const info = todayInfo(now, prefs.cycleStartSaturday);
  const todayIso = londonDateIso(now);
  const duties = dutyStack(state, now);
  const stackDuties = duties.filter((d): d is DefrostDuty | ExpiringDuty => d.kind !== "start-by");
  const tonightDuty = duties.find((d): d is StartByDuty => d.kind === "start-by") ?? null;
  const arbiter = arbiterFor("today", state, now);
  const engineRank1 = arbiter.rank1;

  const mondayIso = addCalendarDays(todayIso, -(MON_OFFSET[info.weekday] ?? 0));
  const dayPads: DayPadInfo[] = [1, 2, 3, 4, 5].map((dayNo) => {
    const dateIso = addCalendarDays(mondayIso, dayNo - 1);
    const slots = mealsByWeekDay("A", dayNo); // slot enumeration only (fixed per Week A day) — not meal identity, so swap-independent
    const tick = ticksFor(state, dateIso);
    const done = slots.length > 0 && slots.every((m) => Boolean(tick[m.slot]));
    return { dayNo, done, isToday: info.dayNo === dayNo };
  });

  // wave-1 fix (item 7): the defrost-duty "done" tap now dispatches the
  // dedicated inventory/markThawed action (sets thawedAt, not just updatedAt)
  // so the post-thaw shelf-life countdown anchors to the actual thaw moment
  // instead of any later stocktake touch — see state/types.ts's thawedAt doc.
  function handleDefrostDone(ingId: string) {
    dispatch({ type: "inventory/markThawed", ingId });
  }

  function handleTickToggle(slot: Slot, mealId: string, isOn: boolean) {
    if (isOn) dispatch({ type: "eaten/untick", date: todayIso, slot });
    else dispatch({ type: "eaten/tick", date: todayIso, slot, mealId });
  }

  // wave-1 fix (item 10): ArbiterSlot's preferred API — pass `rank1` straight
  // through (mapped to the component's flatter ArbiterDuty shape) and render
  // the slot unconditionally; the component itself renders the quiet idle
  // variant when rank1 is null, rather than TODAY deciding to hide the slot.
  const arbiterTargetScreen: ScreenId | null =
    engineRank1?.target && engineRank1.target.screen !== "today" ? engineRank1.target.screen : null;
  const arbiterSlotDuty: ArbiterDuty | null = engineRank1
    ? {
        text: engineRank1.text,
        actionLabel: arbiterTargetScreen ? `${arbiterTargetScreen} →` : undefined,
        onActivate: arbiterTargetScreen ? () => { window.location.hash = `#/${arbiterTargetScreen}`; } : undefined,
      }
    : null;

  const weekday3 = info.weekday.toLowerCase();

  return (
    <section className="scr-today">
      <ArbiterSlot rank1={arbiterSlotDuty} count={arbiter.queued} />

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
            today needs your cycle's start saturday to line up defrost moves and tonight's start-by time.
          </p>
          {/* wave-1 fix (item 9): a real "open settings" button (useOpenSettings,
              src/components/OpenSettings) instead of static prose pointing at the
              gear icon — Sol §5.1's empty-state rule: present the next valid
              action, don't just describe where it lives. */}
          <button type="button" className="fd5-control scr-today-onboard-action" onClick={openSettings}>
            open settings
          </button>
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
            {/* tonightDuty.mealId already resolves through effectiveMealForSlot
                inside dutyStack (state/selectors.ts) — a committed dinner swap
                changes this transitively, no extra resolution needed here. */}
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
            {/* wave-1 fix (item 1): resolve each slot through
                effectiveMealForSlot (swaps-aware) rather than the raw planned
                meal — after a swap, ticking dinner must record and read back
                the COOKED meal's id, so PLAN's swapped card shows logged. */}
            {SLOT_ORDER.map((slot) => {
              const meal = effectiveMealForSlot("A", info.dayNo as number, slot, state);
              if (!meal) return null;
              const isOn = Boolean(ticksFor(state, todayIso)[slot]);
              return (
                <li key={slot}>
                  <button
                    type="button"
                    className={`fd5-control scr-today-tick${isOn ? " scr-today-tick--on" : ""}`}
                    aria-pressed={isOn}
                    onClick={() => handleTickToggle(slot, meal.id, isOn)}
                  >
                    <span className="scr-today-tick-glyph" aria-hidden="true">
                      {isOn ? "✓" : ""}
                    </span>
                    <span className="scr-today-tick-label">{SLOT_LABEL[slot]}</span>
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
          {/* wave-1 fix (item 2): ladder value = eaten-so-far (ticked slots
              only), target = today's planned total — swaps-aware dayMacros, so
              a committed swap changes what "planned" means for today. Bands
              stay the week's macro bands (unaffected by swaps or by the hour). */}
          <MacroLadders
            eaten={eatenSoFar("A", info.dayNo, prefs.cover, state, now)}
            planned={dayMacros("A", info.dayNo, prefs.cover, 1, state.swaps)}
            bands={bands("A", prefs.cover)}
          />
        </section>
      )}
    </section>
  );
}
