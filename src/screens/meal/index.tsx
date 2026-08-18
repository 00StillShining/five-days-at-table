/**
 * src/screens/meal/index.tsx — MEAL, in 16 FACETED VOLUME.
 *
 * THE QUESTION THIS SCREEN ANSWERS: what exactly goes on this plate, at what
 * portion, and can it be cooked right now?
 *
 * Six hero-grade instruments answer it, which is the normal condition here and
 * not a budget breach (CORRECTIONARY 3.1). Each one's job in one sentence,
 * which is the exit test CD-BRIEF ruling 4's re-authored Refined rung sets:
 *
 *   PORTION WHEEL   the one control that sets how much of this plate gets made,
 *                   in thirteen committed seats that never coast.
 *   COVER RING      which cover's plate the tray is currently cut to — a
 *                   categorical fact, and never the portion scale.
 *   STOCK METER     whether the ingredients for this plate, AT THIS PORTION,
 *                   are actually in the house, and how old that count is.
 *   PLATE REGISTER  every ingredient, its method and its batch draw, one lid
 *                   open at a time, with the plate's weight on a drum.
 *   SPEC PLATE      the complete spec sheet: five macros at this portion, the
 *                   position in the fortnight, and the plate's provenance.
 *   TRANSPORT ROW   switch the cover, or hand this plate to the cook engine.
 *   DAY BENCH       the other plates of the same day, live under the tray.
 *
 * ---------------------------------------------------------------------------
 * MEAL IS A TRAY, AND THE FENCE AROUND IT IS LOAD-BEARING
 * ---------------------------------------------------------------------------
 * CD-BRIEF: "MEAL is a tray over the screen that summoned it (PLAN or TODAY),
 * NEVER over COOK, still URL-addressable. Trays travel their own size with no
 * scrim — the workspace beneath stays live and touchable."
 *
 * ch.16 section 8 is why "never over COOK" is a physics rule rather than a
 * routing preference: FACETED VOLUME and REEL LOGIC "both fuse a rotary and its
 * own readout into one control, but one earns coast through traversal and the
 * other refuses coast on principle". `summonerFrom` in model.ts is the only
 * place the summoning screen is resolved, and it admits exactly "plan" and
 * "today"; "cook" resolves to "plan", like any other value that is not one of
 * the two. No FACETED VOLUME rotary is rendered by anything COOK mounts.
 *
 * ---------------------------------------------------------------------------
 * THE 16ms ACK IS STRUCTURAL (CD-BRIEF's measured performance law)
 * ---------------------------------------------------------------------------
 * "A React dispatch alone does NOT satisfy the Floor's 16ms acknowledgement,
 * because the reducer runs during the NEXT render — the model is still stale
 * when your handler returns."
 *
 * `modelRef` is the shadow model, reassigned every render so it is never behind
 * the store and advanced INLINE at every input so it is never behind the hand.
 * `commit` applies the frozen reducer to it in the input's own task; the wheel
 * writes its own angle, its geared disc and its figure in that same task; the
 * stock meter is retargeted off the COMMITTED model through an imperative
 * handle. `dispatch` is only the request to re-render, and the render that
 * follows finds every instrument already telling the truth.
 *
 * ---------------------------------------------------------------------------
 * ONE CLOCK (II.4.13, and the performance law's rule 4)
 * ---------------------------------------------------------------------------
 * Every age on this screen belongs to the stocktake class, whose declared
 * threshold is 72 hours. A 1Hz clock over a twelve-row register would re-render
 * it every second forever for a reading that changes on a three-day scale, so
 * there is ONE 60s clock at the scene root and no second one. Each age prints
 * its own exact HH:MM beside the coarse figure, so the exact value never
 * depends on the sampling rate.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SceneProps } from "../../app/router";
import { useCookRunning } from "../../app/cookRunningStub";
import { useStore } from "../../state/store";
import { reducer } from "../../state/reducer";
import type { Action, AppState } from "../../state/types";
import {
  coverageForMeal,
  cutReasonForSlot,
  dayMacros,
  effectiveMealForSlot,
  mealMacros,
} from "../../state/selectors";
import { londonParts } from "../../state/london";
import { useNow } from "../../state/useNow";
import { activeVariant } from "../../data/variant";
import { getMeal, ingredientsById, mealsByWeekDay } from "../../data";
import type { Cover, Slot } from "../../data/types";
import { ageOf, FRESHNESS, type Age } from "../../cd/freshness/classes";
import { setVoice } from "../../cd/sound/cues";
import { useOpenPanel, useOpenSection } from "../../cd/chassis";
import { Enclosure, Escutcheon, Plate, PressKey, Tray } from "../../cd/foundry";
import { DayBench } from "./DayBench";
import { PlateRegister } from "./PlateRegister";
import { PortionWheel, type WheelHandle } from "./PortionWheel";
import { SpecPlate } from "./SpecPlate";
import { StockMeter, type StockMeterHandle } from "./StockMeter";
import { TransportRow } from "./TransportRow";
import { orbitOffset, useTrophy } from "./useTrophy";
import {
  SLOT_LABEL,
  SLOT_ORDER,
  formatHouseholdHint,
  plateWeight,
  scaleForSeat,
  seatForScale,
  stockAtScale,
  summonerFrom,
  type BenchSeat,
  type PlateRow,
} from "./model";
import "./meal.css";

/** The tray moves to the block-end edge where the rail does (chassis.css). */
const NARROW = "(max-width: 47.99rem)";

function hhmm(iso: string): string {
  const { hour, minute } = londonParts(new Date(iso));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.(NARROW).matches === true
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(NARROW);
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

export default function MealScene({ route }: SceneProps) {
  const { state, dispatch } = useStore();
  const now = useNow(60_000);
  const nowMs = now.getTime();
  const narrow = useNarrow();
  const cookRunning = useCookRunning();
  const { trophy, orbit } = useTrophy();

  /* The shadow model. Assigned every render so it is never behind the store,
     advanced inline at every input so it is never behind the hand. */
  const modelRef = useRef<AppState>(state);
  modelRef.current = state;

  const wheelRef = useRef<WheelHandle>(null);
  const meterRef = useRef<StockMeterHandle>(null);

  // II.5.9 — one family per world. Scenes unmount on navigation, so each screen
  // claims the voice it speaks in as it arrives. This world's is
  // precision-mechanical: a 2100Hz sine tick, a bandpassed steel tap.
  useEffect(() => setVoice("faceted-volume"), []);

  const id = route.params.id;
  const meal = id ? getMeal(id) : undefined;
  const from = summonerFrom(route.query);
  const variant = activeVariant(state);
  const cover = state.prefs.cover;
  const scale = state.prefs.scale;
  const seat = seatForScale(scale);

  /* ------------------------------------------------------- the tray's travel */
  /*
    R6 — "Open panels survive navigation, reset on reload." The tray's own
    openness lives in the chassis store keyed by screen, so picking another
    plate off the bench RETARGETS the open tray rather than replaying its
    entrance (II.3.30), while a genuine reload starts it closed and travels it in.
  */
  const [trayOpen, setTrayOpen] = useOpenPanel<boolean>("detail-tray", false);
  const [lid, setLid] = useOpenSection("register", "plate");

  useEffect(() => {
    if (trayOpen) return;
    const open = () => setTrayOpen(true);
    /*
      The first painted frame of the closed state is what makes the entrance a
      travel rather than a tray that was simply already there — hence the rAF.

      THE TIMEOUT IS NOT A BELT-AND-BRACES; IT IS THE FLOOR. Measured on this
      build: opening `#/meal/a-d1d` in a tab that is not the foreground one
      leaves `document.visibilityState === "hidden"`, requestAnimationFrame
      never fires, and the tray stayed `data-cd-open="false"` indefinitely — a
      deep link opened in a background tab produced a screen with no plate on
      it. II.1.1 is the rule that was broken: "never gate a commit on a spring."
      The openness is semantic and lands within 32ms whether or not anyone is
      looking; the travel is only its report.
    */
    const timer = window.setTimeout(open, 32);
    const frame = requestAnimationFrame(open);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [trayOpen, setTrayOpen]);

  /* --------------------------------------------------------------- readings */

  const cutReason = meal ? variant.cutReason(meal.id) : null;

  const rows: PlateRow[] = useMemo(() => {
    if (!meal) return [];
    return Object.entries(meal.covers[cover]).flatMap(([ingId, g]) => {
      const ing = ingredientsById[ingId];
      if (!ing) return []; // defensive; the join is verified complete
      const entry = state.inventory[ingId];
      return [
        {
          ingId,
          name: ing.name.display,
          grams: Math.round(g * scale),
          hint: formatHouseholdHint(g * scale, ing),
          level: ing.freebie ? null : entry?.level ?? 0,
          freebie: ing.freebie,
          countedAt: entry?.updatedAt ?? null,
        },
      ];
    });
  }, [meal, cover, scale, state.inventory]);

  /* `coverageForMeal` answers at x1.00; `stockAtScale` scales its own output
     rather than re-deriving the formula, so the two can never disagree. */
  const baseCoverage = useMemo(
    () => (meal ? coverageForMeal(state.inventory, meal.id, cover) : null),
    [meal, state.inventory, cover]
  );
  const stock = useMemo(
    () => (baseCoverage ? stockAtScale(baseCoverage, scale) : null),
    [baseCoverage, scale]
  );

  /** The newest stocktake behind the meter's figure. Never invented: when no
   *  ingredient of this plate has ever been counted, the age is "never". */
  const newestCount = useMemo(() => {
    let best: string | null = null;
    for (const row of rows) {
      if (row.freebie || !row.countedAt) continue;
      if (best === null || row.countedAt > best) best = row.countedAt;
    }
    return best;
  }, [rows]);
  const stockAge: Age = ageOf("stocktake", newestCount, nowMs);

  const ageFor = useCallback(
    (ingId: string): Age => ageOf("stocktake", state.inventory[ingId]?.updatedAt ?? null, nowMs),
    [state.inventory, nowMs]
  );

  const macros = useMemo(
    () => (meal ? mealMacros(meal.id, cover, scale) : null),
    [meal, cover, scale]
  );

  const grams = meal ? plateWeight(meal, cover, scale) : 0;

  /** The day's other plates. Real slots, cut slots stated, swaps reported. */
  const seats: BenchSeat[] = useMemo(() => {
    if (!meal) return [];
    const out: BenchSeat[] = [];
    const day = mealsByWeekDay(meal.week, meal.day);
    for (const slot of SLOT_ORDER) {
      const planned = day.find((m) => m.slot === slot);
      if (!planned) continue;
      const reason = cutReasonForSlot(meal.week, meal.day, slot, state);
      if (reason != null) {
        out.push({
          slot,
          label: SLOT_LABEL[slot],
          mealId: null,
          name: null,
          tag: null,
          cutReason: reason,
          swapped: false,
          current: false,
          kcal: null,
          coverage: null,
          grams: null,
        });
        continue;
      }
      const effective = effectiveMealForSlot(meal.week, meal.day, slot, state);
      if (!effective) continue;
      out.push({
        slot,
        label: SLOT_LABEL[slot],
        mealId: effective.id,
        name: effective.name,
        tag: effective.tag,
        cutReason: null,
        swapped: effective.id !== planned.id,
        current: effective.id === meal.id,
        kcal: mealMacros(effective.id, cover, scale).kcal,
        coverage: stockAtScale(coverageForMeal(state.inventory, effective.id, cover), scale)
          .coverage,
        grams: plateWeight(effective, cover, scale),
      });
    }
    return out;
  }, [meal, state, cover, scale]);

  /** The planned meal this one displaced, when a swap put it here. */
  const swappedInto = useMemo(() => {
    if (!meal) return null;
    for (const [plannedId, replacementId] of Object.entries(state.swaps)) {
      if (replacementId === meal.id && plannedId !== meal.id) return plannedId;
    }
    return null;
  }, [meal, state.swaps]);

  /* ------------------------------------------------------------ commit paths */

  /** II.1.1 — semantic 0ms, mechanical after. True before any spring. */
  const commit = useCallback((action: Action): AppState => {
    const next = reducer(modelRef.current, action);
    modelRef.current = next;
    return next;
  }, []);

  const onSeat = useCallback(
    (nextSeat: number) => {
      const nextScale = scaleForSeat(nextSeat);
      const action: Action = { type: "prefs/set", patch: { scale: nextScale } };
      commit(action); // 1 · semantic, this task
      // 2 · mechanical — the meter is retargeted off the COMMITTED scale, not
      //     off the store's current (still stale) one.
      if (baseCoverage) {
        const read = stockAtScale(baseCoverage, nextScale);
        meterRef.current?.report(read.coverage, read.short.length);
      }
      dispatch(action); // 3 · the request to re-render
    },
    [baseCoverage, commit, dispatch]
  );

  const onCover = useCallback(
    (next: Cover) => {
      if (next === modelRef.current.prefs.cover) return;
      const action: Action = { type: "prefs/set", patch: { cover: next } };
      const committed = commit(action);
      if (meal) {
        const read = stockAtScale(
          coverageForMeal(committed.inventory, meal.id, next),
          committed.prefs.scale
        );
        meterRef.current?.report(read.coverage, read.short.length);
      }
      dispatch(action);
    },
    [commit, dispatch, meal]
  );

  const goCook = useCallback(() => {
    if (!meal) return;
    const action: Action = { type: "timers/load", programId: meal.id };
    commit(action);
    dispatch(action);
    window.location.hash = "#/cook";
  }, [commit, dispatch, meal]);

  /* THE FENCE, at its only exit point. `from` can only ever be "plan" or
     "today" (model.ts), so this hash can never address COOK. */
  const goBack = useCallback(() => {
    window.location.hash = `#/${from}`;
  }, [from]);

  const pick = useCallback(
    (mealId: string) => {
      window.location.hash = `#/meal/${mealId}?from=${from}`;
    },
    [from]
  );

  const offset = orbitOffset(orbit);

  /* --------------------------------------------------------------- the error */

  if (!meal) {
    return (
      /* No tray on this branch, so the ground does not reserve a gutter for
         one — a reserved gutter with nothing in it is bare field. */
      <section className="mea" data-cd-language="faceted-volume" data-mea-notray="true">
        <div className="mea-ground">
          <Enclosure variant="well" as="div" className="mea-void" role="note">
            <Escutcheon as="h1">no plate at this address</Escutcheon>
            <Plate className="mea-void-face" surface="data">
              <p className="cd-prose">
                {id
                  ? `the fortnight holds no meal with the id "${id}". nothing has been guessed at in its place.`
                  : "the address carries no meal id, so there is no plate to cut."}
              </p>
            </Plate>
            <PressKey className="mea-void-key" onPress={goBack} cap={`${from} →`} sound="contact" />
          </Enclosure>
        </div>
      </section>
    );
  }

  const threshold = `${Math.round(FRESHNESS.stocktake.staleAfterMs / 3_600_000)}h`;

  return (
    <section
      className="mea"
      data-cd-language="faceted-volume"
      data-mea-trophy={trophy ? "true" : "false"}
      style={
        {
          // The burn-in orbit moves the WHOLE composition as one rigid frame.
          "--mea-orbit-x": `${offset.x}px`,
          "--mea-orbit-y": `${offset.y}px`,
        } as React.CSSProperties
      }
    >
      {/*
        THE GROUND carries the material, the chamfer and the clip — and the tray
        is deliberately OUTSIDE it.

        MEASURED DEFECT, first render: `clip-path` on an element establishes a
        containing block for its fixed-position descendants, so a Tray nested
        inside the chamfered ground stopped being viewport-fixed. It laid out
        against the 899px-tall scene instead of the 987px viewport and its foot
        ran 248px past the fold, clipped by the ground's own corner cut. The
        scope root therefore paints nothing and clips nothing; the ground does
        both, one level in; the tray is its sibling and stays fixed to the
        viewport where II.3.30 needs it.
      */}
      <div className="mea-ground">
        <div className="mea-frame">
          {/* THE WORKSPACE. Live and touchable the whole time the tray is open —
              there is no scrim, and picking a plate here retargets the tray. */}
          <DayBench
            seats={seats}
            week={meal.week}
            day={meal.day}
            dayKcal={dayMacros(meal.week, meal.day, cover, scale, state.swaps, variant).kcal}
            plates={seats.filter((s) => s.mealId != null).length}
            cover={cover}
            from={from}
            onPick={pick}
            trophy={trophy}
          />
        </div>
      </div>

      <Tray
        open={trayOpen}
        onClose={goBack}
        edge={narrow ? "block-end" : "inline-end"}
        title={meal.name}
        exitLabel={`${from} →`}
        className="mea-tray"
        headSlot={
          <Escutcheon className="mea-tray-slot">
            {SLOT_LABEL[meal.slot]} · {meal.tag}
          </Escutcheon>
        }
      >
        {cutReason ? (
          /* A CUT SLOT. There is nothing to swap into it in the tester and
             nothing to cook, so the tray states the reason and offers no
             fabricated plate, no portion wheel and no swap deck. */
          <Enclosure variant="well" as="div" className="mea-void" role="note">
            <Escutcheon as="h3">cut in the tester</Escutcheon>
            <Plate className="mea-void-face" surface="data">
              <p className="cd-prose">{cutReason}</p>
            </Plate>
            <p className="mea-void-note cd-printed">
              <span className="cd-silkscreen">variant</span>
              {variant.label}
            </p>
          </Enclosure>
        ) : (
          <>
            <PortionWheel
              ref={wheelRef}
              seat={seat}
              onSeat={onSeat}
              cover={cover}
              trophy={trophy}
            />

            <StockMeter
              ref={meterRef}
              coverage={stock?.coverage ?? 1}
              shortCount={stock?.short.length ?? 0}
              counted={stock?.counted ?? 0}
              age={stockAge}
              at={newestCount ? hhmm(newestCount) : null}
              threshold={threshold}
              onStores={() => {
                window.location.hash = "#/stores";
              }}
              trophy={trophy}
            />

            <div className="mea-tray-fold" data-mea-hidden={trophy ? "true" : undefined}>
              <TransportRow
                cover={cover}
                onCover={onCover}
                onCook={goCook}
                cookRunning={cookRunning}
                mealName={meal.name}
                trophy={trophy}
              />

              <PlateRegister
                meal={meal}
                cover={cover}
                scale={scale}
                rows={rows}
                grams={grams}
                openId={lid}
                onOpenChange={setLid}
                ageFor={ageFor}
              />

              {macros && (
                <SpecPlate
                  meal={meal}
                  cover={cover}
                  scale={scale}
                  macros={macros}
                  swappedInto={swappedInto}
                  variantLabel={variant.isTester ? variant.label : null}
                />
              )}
            </div>
          </>
        )}
      </Tray>

      {/* The wheel's seats announced once, off-screen, so a screen-reader user
          meets thirteen detents as portions rather than as indices. */}
      <p className="fd5-visually-hidden">
        the portion wheel has thirteen seats, from ×0.70 to ×1.30 in steps of
        0.05. arrow keys move one seat; home and end reach the limits.
      </p>
    </section>
  );
}
