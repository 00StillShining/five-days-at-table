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
import { Enclosure, Escutcheon, Lamp, Plate, PressKey, Register, type RegisterGroup } from "../../cd/foundry";
import { ReelFace } from "./Reel";
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
  /*
    GROUPED BY DAY, not by week, and that is R7 doing real work rather than
    being satisfied on paper.

    A week group holds up to twenty meals. MEASURED at 1280x800 with the tester
    variant's TEN: the open group pushed the deck to 879px in a 800px viewport,
    and in full mode it would be twice that — a page-length scroll behind an
    accordion, which is the thing R7 exists to forbid. Clipping the group with
    `limit` would have "confessed" its way out of the measurement while making
    the eleventh meal unreachable, which is a worse answer than scrolling.

    A day holds two to four. One open day group always fits, every meal stays
    reachable, nothing is clipped, and it matches how the operator asks the
    question — they want Tuesday's dinner, not the ninth item of week A.
  */
  const dayGroups = weekGroups.flatMap((group) =>
    group.days.map((day) => ({ week: group.week, day: day.day, meals: day.meals }))
  );
  const [openDay, setOpenDay] = useOpenSection(
    "cook-picker",
    dayGroups.length ? `${dayGroups[0].week}-${dayGroups[0].day}` : null
  );

  const groups: RegisterGroup[] = dayGroups.map((group) => ({
    id: `${group.week}-${group.day}`,
    label: `week ${group.week.toLowerCase()} · day ${group.day}`,
    items: group.meals.map((meal) => () => {
      const macros = mealMacros(meal.id, state.prefs.cover, state.prefs.scale);
      return (
        <PressKey
          className="ck-seat ck-seat--meal"
          onPress={() => onLoad(meal.id)}
          aria-label={`load ${meal.name}, ${SLOT_LABEL[meal.slot] ?? meal.slot}, week ${group.week}, day ${group.day}`}
        >
          <span className="ck-seat-slot cd-silkscreen">{SLOT_LABEL[meal.slot] ?? meal.slot}</span>
          <span className="ck-seat-name">{meal.name}</span>
          <span className="ck-seat-meta cd-printed">
            {macros.kcal}
            <span className="cd-unit">kcal</span>
          </span>
        </PressKey>
      );
    }),
  }));

  return (
    <div className="ck-picker">
      {/*
        THE EMPTY DECK — and it is not a lie about state.

        The Fable review found COOK standby the flattest room in the product and
        the first one a viewer meets. It was: dark panels, white text, no light,
        no object. Nothing on it said "tape deck", so nothing distinguished COOK
        from a settings list.

        The objection to fixing that is 02 REEL LOGIC section 1 — "a REEL LOGIC
        screen at rest reads as a SHUT-DOWN MACHINE, because at rest is exactly
        what it is". Read closely, that clause governs MOTION and EMISSION: its
        own sentence is "No ambient shimmer runs behind the glass to prove the
        product is alive." A still chrome collar shimmers nothing and proves
        nothing. Section 2 is explicit the other way: "the chassis is a FACT OF
        RECORD" — and a fact of record is true whether or not a tape is loaded.
        Pigment does not switch off. CORRECTIONARY 5.6: "If nothing visibly
        catches light, fix that before anything else."

        So the deck's HARDWARE shows at rest and every LIVE CHANNEL reads empty:

          disc      still. `spinning={false}` — no animation runs at all
          arc       all 60 cells at the unlit value; elapsed 0 of 0 lights none
          counter   "--:--", never "00:00". An unloaded deck has no elapsed
                    figure, and printing a zero would invent a reading that was
                    never taken — the same rule that gives an uncounted shelf
                    NEVER rather than an age
          lamp      dark, captioned OFF

        That reports "there is a machine here and there is no tape in it", which
        is exactly true, and it is MORE honest than the panel it replaces: that
        one did not report the deck at all.
      */}
      <Enclosure variant="faceplate" grain className="ck-picker-head">
        <div className="ck-picker-deck" aria-hidden="true">
          <ReelFace
            elapsedMin={0}
            totalMin={0}
            spinning={false}
            overrun={false}
            seedSeconds={0}
            hub={false}
          >
            <div className="ck-hub cd-plate" data-cd-surface="data">
              <span className="ck-picker-hub-blank cd-printed">--:--</span>
              <span className="ck-hub-total cd-printed">no tape</span>
            </div>
            <div className="ck-crown">
              <span className="ck-lamp">
                <Lamp lit={false} word={{ on: "rec", off: "off" }} label="cook program" showWord={false} />
              </span>
              <span className="ck-crown-word cd-engraved">off</span>
            </div>
          </ReelFace>
        </div>
        <div className="ck-picker-headtext">
          <Escutcheon>cook · standby</Escutcheon>
          <Plate className="ck-picker-plate">
            <h1 className="ck-picker-title">no program loaded</h1>
            <p className="ck-picker-sub">
              the deck is stopped. load tonight's dinner, a sunday session, or any meal.
            </p>
          </Plate>
        </div>
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
          openId={openDay}
          onOpenChange={setOpenDay}
          label="every approved meal, grouped by day"
          overflowWord="more"
          className="ck-picker-register"
        />
      </Enclosure>
    </div>
  );
}
