/**
 * src/screens/today/index.tsx — TODAY, in 05 EXPOSED WORKS.
 *
 * THE QUESTION THIS SCREEN ANSWERS: what do I do now?
 *
 * Six hero-grade instruments answer it, which is the NORMAL condition here and
 * not a budget breach (CORRECTIONARY 3.1 — "a dashboard carries four to six
 * simultaneous hero-grade instruments ... think a supercar's full cluster, where
 * every dial is deep-drawn"). Each one's job, in one sentence, which is the exit
 * test CD-BRIEF ruling 4's re-authored Refined rung sets:
 *
 *   ANNUNCIATOR    which single duty has won the act-now slot, and how many are
 *                  queued behind it.
 *   MASTHEAD       where in the a-twice fortnight this day sits, and which of
 *                  this week's five plated days are fully logged.
 *   CHANNEL DIAL   how much of the selected macro has actually been eaten,
 *                  against the week's band — the porthole geared to the knob.
 *   CHRONOMETER    how many minutes are left before tonight has to start, with
 *                  the escapement consuming one tooth a minute.
 *   PLATE LOG      which of today's slots have been eaten, and the hand that
 *                  says so.
 *   METER BRIDGE   all four channels at once, so the dial's one reading is
 *                  never the only reading.
 *   DUTY DECK      what the system is owed: defrost moves and spoiling stock.
 *
 * ---------------------------------------------------------------------------
 * THE LOAD-BEARING STATE FACT (D5, "a-twice")
 * ---------------------------------------------------------------------------
 * The executing fortnight is ALWAYS Week A, twice. `prefs.week` is a BROWSING
 * toggle for PLAN and MEAL. Nothing on this screen reads it, and every meals /
 * macros / bands call below is hard-coded to "A". Getting this wrong makes the
 * screen lie about what to cook.
 *
 * ---------------------------------------------------------------------------
 * THE 16ms ACK IS STRUCTURAL (CD-BRIEF, measured performance law, binding)
 * ---------------------------------------------------------------------------
 * "A React `dispatch` alone does NOT satisfy the Floor's 16ms acknowledgement,
 * because the reducer runs during the NEXT render — the model is still stale
 * when your handler returns. Keep the model in a ref, apply the frozen reducer
 * inline at the input event, and let setState be only the request to re-render."
 *
 * `modelRef` is that ref. `toggleSlot` applies `reducer` to it in the input's
 * own task, recomputes the reading off the COMMITTED model, and hands it to the
 * linkage before `dispatch` is even called. React catches up afterwards and
 * finds the instruments already telling the truth.
 *
 * ---------------------------------------------------------------------------
 * ONE CLOCK (II.4.13, and the perf law's rule 4)
 * ---------------------------------------------------------------------------
 * "Isolate clocks. A 1Hz clock above a list re-renders the whole list every
 * second forever ... give day-granularity countdowns a 60s clock, not a 1s one."
 * Every reading on this screen is day- or minute-granular — the shortest
 * declared freshness threshold in play is the eaten class's 24h — so ONE 60s
 * clock at the scene root feeds the fortnight position, the duty stack, the
 * arbiter, the chronometer and every printed age. There is no second clock, and
 * each tick prints its own exact HH:MM beside its coarse age so the exact figure
 * never depends on the sampling rate.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SceneProps } from "../../app/router";
import { useStore } from "../../state/store";
import { reducer } from "../../state/reducer";
import type { Action, AppState } from "../../state/types";
import type { DefrostDuty, ExpiringDuty, StartByDuty } from "../../state/selectors";
import {
  bands,
  cutReasonForSlot,
  dayMacros,
  dutyStack,
  eatenSoFar,
  effectiveMealForSlot,
  ticksFor,
  todayInfo,
} from "../../state/selectors";
import { activeVariant } from "../../data/variant";
import { addCalendarDays, londonDateIso, londonParts } from "../../state/london";
import { useNow } from "../../state/useNow";
import { arbiterFor, type ScreenId } from "../../engine/arbiter";
import { useOpenPanel, useOpenSection } from "../../cd/chassis";
import { useOpenSettings } from "../../components/OpenSettings";
import { mealsByWeekDay } from "../../data";
import type { Slot } from "../../data/types";
import { ageOf, FRESHNESS, type Age } from "../../cd/freshness/classes";
import { setVoice } from "../../cd/sound/cues";
import { Enclosure, Escutcheon, Plate, PressKey } from "../../cd/foundry";
import { Annunciator } from "./Annunciator";
import { ChannelCluster, type LinkageHandle } from "./ChannelCluster";
import { Chronometer } from "./Chronometer";
import { DutyDeck } from "./DutyDeck";
import { MacroBridge } from "./MacroBridge";
import { Masthead, type DaySeat } from "./Masthead";
import { TickBank, type SlotCell } from "./TickBank";
import { orbitOffset, useTrophy } from "./useTrophy";
import { CHANNELS, ZERO_MACROS } from "./model";
import "./today.css";

const SLOT_LABEL: Record<Slot, string> = {
  breakfast: "bfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
};
const SLOT_ORDER: Slot[] = ["breakfast", "lunch", "dinner", "snack"];

/** ISO-weekday offset used only to find this CALENDAR week's Monday for the
 * masthead's index strip — independent of the fortnight anchor, because the
 * seats print real dates rather than fortnight positions. */
const MON_OFFSET: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const WEEKDAY_NAME: Record<number, string> = {
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
};

function hhmm(iso: string): string {
  const { hour, minute } = londonParts(new Date(iso));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export default function TodayScene(_props: SceneProps) {
  const { state, dispatch } = useStore();
  const { prefs } = state;
  const now = useNow(60_000);
  const nowMs = now.getTime();
  const openSettings = useOpenSettings();

  /* The shadow model. Assigned every render so it is never behind the store,
     and advanced INLINE at every input so it is never behind the hand. */
  const modelRef = useRef<AppState>(state);
  modelRef.current = state;

  const linkageRef = useRef<LinkageHandle>(null);

  /* II.7.13's confirm is an EVENT. It fires for a commit made in this session
     and never for one read back off the store, so arriving on TODAY with
     breakfast already ticked does not replay this morning's confirm. */
  const [justCommitted, setJustCommitted] = useState<Slot | null>(null);
  const freshTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (freshTimer.current != null) window.clearTimeout(freshTimer.current);
  }, []);
  const trophyState = useTrophy();
  const { trophy, orbit, power } = trophyState;

  // II.5.9 — one family, and this screen's is "metal meeting metal at a
  // different mass". Set on mount: scenes unmount on navigation, so each screen
  // claims the voice it speaks in as it arrives.
  useEffect(() => setVoice("exposed-works"), []);

  const info = todayInfo(now, prefs.cycleStartSaturday);
  const todayIso = londonDateIso(now);
  const variant = activeVariant(state);
  const dayNo = typeof info.dayNo === "number" ? info.dayNo : null;

  const duties = useMemo(() => dutyStack(state, now), [state, now]);
  const defrost = duties.filter((d): d is DefrostDuty => d.kind === "defrost");
  const spoiling = duties.filter((d): d is ExpiringDuty => d.kind === "expiring");
  const startBy = duties.find((d): d is StartByDuty => d.kind === "start-by") ?? null;

  const arbiter = useMemo(() => arbiterFor("today", state, now), [state, now]);

  /* ---------------------------------------------------------------- readings */

  const eaten = dayNo == null ? ZERO_MACROS : eatenSoFar("A", dayNo, prefs.cover, state, now);
  const planned = dayNo == null ? ZERO_MACROS : dayMacros("A", dayNo, prefs.cover, 1, state.swaps, variant);
  const macroBands = bands("A", prefs.cover, variant);

  const ticks = ticksFor(state, todayIso);
  /** The newest tick behind the dial's reading. The macros class is declared
   *  never-stale (a derived value has no age of its own), so what the dial
   *  prints is the age of the READING THAT FED IT — and "never" when none has. */
  const newestTickAt = useMemo(() => {
    let best: string | null = null;
    for (const slot of SLOT_ORDER) {
      const t = ticks[slot];
      if (t && (best === null || t.at > best)) best = t.at;
    }
    return best;
  }, [ticks]);
  const dialAge: Age = ageOf("eaten", newestTickAt, nowMs);
  /* The EXACT figure behind the age. The screen samples on a 60s clock, so an
     age alone would read "0s" for up to a minute after a real commit; the
     timestamp does not depend on the sampling rate and cannot drift with it. */
  const dialAt = newestTickAt ? hhmm(newestTickAt) : null;

  const slotCells: SlotCell[] = useMemo(() => {
    if (dayNo == null) return [];
    const cells: SlotCell[] = [];
    for (const slot of SLOT_ORDER) {
      const authored = mealsByWeekDay("A", dayNo).find((m) => m.slot === slot);
      if (!authored) continue;
      const cutReason = cutReasonForSlot("A", dayNo, slot, state);
      if (cutReason != null) {
        cells.push({
          slot,
          label: SLOT_LABEL[slot],
          mealId: null,
          mealName: null,
          cutReason,
          ticked: false,
          at: null,
          age: ageOf("eaten", null, nowMs),
        });
        continue;
      }
      const meal = effectiveMealForSlot("A", dayNo, slot, state);
      if (!meal) continue;
      const tick = ticks[slot];
      cells.push({
        slot,
        label: SLOT_LABEL[slot],
        mealId: meal.id,
        mealName: meal.name,
        cutReason: null,
        ticked: Boolean(tick),
        at: tick ? hhmm(tick.at) : null,
        age: ageOf("eaten", tick?.at ?? null, nowMs),
      });
    }
    return cells;
  }, [dayNo, state, ticks, nowMs]);

  const seats: DaySeat[] = useMemo(() => {
    const mondayIso = addCalendarDays(todayIso, -(MON_OFFSET[info.weekday] ?? 0));
    return [1, 2, 3, 4, 5].map((n) => {
      const dateIso = addCalendarDays(mondayIso, n - 1);
      const slots = mealsByWeekDay("A", n);
      const tickRow = ticksFor(state, dateIso);
      return {
        dayNo: n,
        weekday: WEEKDAY_NAME[n],
        done: slots.length > 0 && slots.every((m) => Boolean(tickRow[m.slot])),
        isToday: info.dayNo === n,
      };
    });
  }, [todayIso, info.weekday, info.dayNo, state]);

  /* --------------------------------------------------------- panel state (R6) */

  const [channel, setChannel] = useOpenPanel<number>("channel", 0);
  const deckDefault = defrost.length > 0 ? "defrost" : spoiling.length > 0 ? "spoiling" : null;
  const [deckOpen, setDeckOpen] = useOpenSection("deck", deckDefault);
  const [acked, setAcked] = useOpenPanel<string | null>("ack", null);

  /* ------------------------------------------------------------- commit paths */

  /**
   * II.1.1 — the division of labour, exactly: semantic 0ms, mechanical after.
   * The value is true before any spring, any transition and any re-render.
   */
  const commit = useCallback(
    (action: Action) => {
      const next = reducer(modelRef.current, action);
      modelRef.current = next;
      return next;
    },
    []
  );

  const toggleSlot = useCallback(
    (cell: SlotCell) => {
      if (cell.mealId == null) return;
      const action: Action = cell.ticked
        ? { type: "eaten/untick", date: todayIso, slot: cell.slot }
        : { type: "eaten/tick", date: todayIso, slot: cell.slot, mealId: cell.mealId };
      const next = commit(action); // 1 · semantic, this task
      if (freshTimer.current != null) window.clearTimeout(freshTimer.current);
      if (cell.ticked) {
        setJustCommitted(null); // an UN-tick removes a fact; it confirms nothing
      } else {
        setJustCommitted(cell.slot);
        freshTimer.current = window.setTimeout(() => setJustCommitted(null), 2700);
      }
      if (dayNo != null) {
        // 2 · mechanical — the needle is retargeted off the COMMITTED model,
        //     not off the store's current (still stale) one.
        linkageRef.current?.report(eatenSoFar("A", dayNo, prefs.cover, next, now));
      }
      dispatch(action); // 3 · the request to re-render
    },
    [commit, dayNo, dispatch, now, prefs.cover, todayIso]
  );

  const markThawed = useCallback(
    (ingId: string) => {
      const action: Action = { type: "inventory/markThawed", ingId };
      commit(action);
      dispatch(action);
    },
    [commit, dispatch]
  );

  const go = useCallback((screen: ScreenId) => {
    window.location.hash = `#/${screen}`;
  }, []);

  const stocktakeAgeFor = useCallback(
    (ingId: string): Age => ageOf("stocktake", state.inventory[ingId]?.updatedAt ?? null, nowMs),
    [state.inventory, nowMs]
  );

  /* ------------------------------------------------------------- the arbiter */

  const rank1 = arbiter.rank1;
  const targetScreen: ScreenId | null =
    rank1?.target && rank1.target.screen !== "today" ? rank1.target.screen : null;

  /* --------------------------------------------------------------- off states */

  const allCut =
    variant.isTester &&
    dayNo != null &&
    slotCells.length > 0 &&
    slotCells.every((c) => c.mealId == null);
  const cutReasonForDay = slotCells.find((c) => c.cutReason)?.cutReason ?? null;

  const minutesInHand =
    startBy == null ? null : (new Date(startBy.startByAt).getTime() - nowMs) / 60_000;

  const chronoOff =
    startBy == null
      ? info.dayNo === "weekend"
        ? info.weekday === "Sat"
          ? "saturday is the shop, not a plated day — tomorrow is the sunday session"
          : "sunday is the prep session — the next plated day is monday"
        : allCut
          ? (cutReasonForDay ?? "this day is cut in the active plan variant")
          : !prefs.cycleStartSaturday
            ? "the fortnight has no start saturday yet, so no start-by time can be computed"
            : "no dinner is scheduled for today"
      : "";

  const offset = orbitOffset(orbit);

  return (
    <section
      className="tdy"
      data-cd-language="exposed-works"
      data-tdy-trophy={trophy ? "true" : "false"}
      data-tdy-power={power}
      style={
        {
          // The burn-in orbit moves the WHOLE composition as one rigid frame —
          // "a hero that drifts against its evidence column has turned a burn-in
          // guard into a layout bug."
          "--tdy-orbit-x": `${offset.x}px`,
          "--tdy-orbit-y": `${offset.y}px`,
        } as React.CSSProperties
      }
    >
      <div className="tdy-frame">
        <Annunciator
          kind={rank1?.kind ?? null}
          text={rank1?.text ?? null}
          queued={arbiter.queued}
          actionLabel={targetScreen ? `${targetScreen} →` : null}
          onActivate={targetScreen ? () => go(targetScreen) : null}
          acknowledged={rank1 != null && acked === rank1.id}
          onAcknowledge={() => setAcked(rank1?.id ?? null)}
        />

        <Masthead
          weekday={info.weekday.toLowerCase()}
          dayNo={info.dayNo}
          pass={info.weekIndex}
          fortnightDay={info.fortnightDay}
          seats={seats}
          variantLabel={variant.isTester ? variant.label : null}
        />

        {!prefs.cycleStartSaturday && (
          /* FIRST RUN. Not a banner: a blanked-off station with the reason
             engraved on it and the one control that fills it. */
          <Enclosure variant="well" as="aside" className="tdy-onboard" role="note">
            <Escutcheon as="h2">fortnight not anchored</Escutcheon>
            <Plate className="tdy-onboard-face" surface="data">
              <p className="cd-prose">
                the defrost calendar and tonight&rsquo;s start-by time are both measured from the
                saturday your cycle starts. until that date is set, this screen can show what is on
                the plate but not what the week is owed.
              </p>
            </Plate>
            <PressKey className="tdy-onboard-key" onPress={openSettings} sound="contact" cap="set start saturday" />
          </Enclosure>
        )}

        {allCut && (
          <Enclosure variant="well" as="aside" className="tdy-offstate" role="note">
            <Escutcheon as="h2">off in the tester</Escutcheon>
            <Plate className="tdy-offstate-face" surface="data">
              <p className="cd-prose">{cutReasonForDay ?? "every slot on this day is cut in the active plan variant."}</p>
            </Plate>
          </Enclosure>
        )}

        {/*
          TWO ROWS, ranked by consequence rather than by category.
          Row 1 leads with the chronometer: "minutes before tonight has to
          start" is the value that changes what the operator does next, which
          is screencraft/01's own test for what earns the front of a frame.
          Row 2 carries the deck's lids and the bridge, both of which are
          evidence for the same one question.
        */}
        <div className="tdy-cluster-row">
          <Chronometer
            mealName={startBy ? startBy.text.split(" · ")[0] : null}
            startBy={startBy?.startBy ?? null}
            minutesInHand={minutesInHand}
            offReason={chronoOff}
            onCook={() => go("cook")}
            trophy={trophy}
          />

          <ChannelCluster
            ref={linkageRef}
            channel={channel}
            onChannel={setChannel}
            eaten={eaten}
            planned={planned}
            bands={macroBands}
            age={dialAge}
            at={dialAt}
            threshold="24h"
            trophy={trophy}
          />

          <TickBank
            cells={slotCells}
            onToggle={toggleSlot}
            threshold={`${Math.round(FRESHNESS.eaten.staleAfterMs / 3_600_000)}h`}
            justCommitted={justCommitted}
            trophy={trophy}
          />
        </div>

        <div className="tdy-evidence-row" data-tdy-hidden={trophy ? "true" : undefined}>
          <DutyDeck
            defrost={defrost}
            spoiling={spoiling}
            openId={deckOpen}
            onOpenChange={setDeckOpen}
            onThawed={markThawed}
            onStores={() => go("stores")}
            ageFor={stocktakeAgeFor}
            formatTime={hhmm}
            trophy={trophy}
          />

          <MacroBridge
            eaten={eaten}
            planned={planned}
            bands={macroBands}
            channel={channel}
            onSelect={(i) => linkageRef.current?.seat(i)}
          />
        </div>
      </div>

      {/* The channel names are announced once, off-screen, so a screen-reader
          user meets the knob's four seats as words rather than as indices. */}
      <p className="fd5-visually-hidden">
        hero dial channels, in seat order: {CHANNELS.map((c) => c.title).join(", ")}.
      </p>
    </section>
  );
}
