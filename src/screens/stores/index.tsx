/**
 * src/screens/stores/index.tsx — STORES, in 10 CLEAR LID.
 *
 * THE QUESTION THIS SCREEN ANSWERS: what have we actually got, how long does it
 * last, and how do I say so?
 *
 * ---------------------------------------------------------------------------
 * THE OBJECT
 * ---------------------------------------------------------------------------
 * A specimen case for a larder. Cream painted steel, a pale elm hinge spine,
 * grey control plates, and one milled register plate with sixty-five rows
 * ENGRAVED INTO IT under a single acrylic pane — not sixty-five little cases.
 * CLEAR LID names that failure by itself (section 9, LID INFLATION: "every card
 * on a dashboard earns its own full lid ... the screen reads as a cabinet of
 * specimen cases with no leading object"), and this is a screen structurally
 * designed to invite it. One plate. One lid. One hierarchy of construction.
 *
 * SIX HERO-GRADE INSTRUMENTS, which is the NORMAL condition here and not a
 * budget breach (CORRECTIONARY 3.1). Each one's job in one sentence — the exit
 * test CD-BRIEF ruling 4's re-authored Refined rung sets:
 *
 *   REGISTER PLATE   the sixty-five levels and lives, read and set.
 *   THUMBWHEEL       the hand that seats a level.
 *   ANNUNCIATOR      what has expired, what expires within a day, and the one
 *                    act the arbiter ranks first.
 *   LARDER GAUGE     how full the house is, how much of the register has been
 *                    counted, and how old that count is.
 *   TUNING SCALE     what tonight can be cooked from what is in the house.
 *   DINNER LEDGER    whether tonight's plate was logged, and what it left.
 *
 * ---------------------------------------------------------------------------
 * THE 16ms ACK IS STRUCTURAL (CD-BRIEF's measured performance law, binding)
 * ---------------------------------------------------------------------------
 * "A React `dispatch` alone does NOT satisfy the Floor's 16ms acknowledgement,
 * because the reducer runs during the NEXT render — the model is still stale
 * when your handler returns. Keep the model in a ref, apply the frozen reducer
 * inline at the input event, and let setState be only the request to re-render.
 * Measured: ack commit 0.01-0.9ms while the visible report takes 12-39ms."
 *
 * `modelRef` is that ref. `commitLevel` applies the FROZEN reducer to it in the
 * input's own task, then writes the addressed row's needle position directly to
 * its own element, and only then dispatches. The value is true, and the
 * instrument has answered, before React has rendered anything.
 *
 * ---------------------------------------------------------------------------
 * R7 — NO PAGE-LENGTH SCROLLING, AND THE OVERFLOW IS CONFESSED
 * ---------------------------------------------------------------------------
 * The register is the foundry's `Register`: four lids, exactly one open, driven
 * through `useOpenSection` so the open lid survives navigation (R6) — a scene
 * unmounts on every route change, so `useState` would lose it. A closed group
 * renders `null`, which buys the measured law's largest single saving for free
 * (767 -> 335 nodes, input->paint 39.0 -> 17.6ms): "R7 alone is insufficient —
 * a collapsed drawer at grid-template-rows: 0fr is hidden from paint but NOT
 * from React."
 *
 * DECLARED DEPARTURE (CORRECTIONARY 6.5). One open group can still be twenty-two
 * rows, which is 968px — taller than the 800px the desk viewport has for it. So
 * the bay is a fixed-height machined recess and the PLATE SLIDES INSIDE IT, and
 * the clip states its remainder as a number in three parts, live: rows above the
 * cut, rows below it, and rows under the shut lids (II.6.24 — "every clip states
 * its remainder as a number. No fade curtains"). The page itself does not grow a
 * scroll of its own at desk width; the register does, inside its own bay, the way
 * a card index slides in its drawer.
 *
 * ---------------------------------------------------------------------------
 * ONE COARSE CLOCK, ONE ISOLATED FAST ONE (measured law, rule 4)
 * ---------------------------------------------------------------------------
 * "A 1Hz age clock mounted above a 65-row list re-renders 65 rows per second
 * forever ... give day-granularity countdowns a 60s clock, not a 1s one." Every
 * reading in the register is day-granular, so the scene runs at 60s. The one
 * per-second age on the screen — the larder gauge's — owns its own interval
 * INSIDE the component that prints it, and nothing above it ticks.
 *
 * ---------------------------------------------------------------------------
 * THE BRIDGE IS GONE
 * ---------------------------------------------------------------------------
 * This screen no longer depends on `.fd5[data-language="playful"]`, the legacy
 * bridge selector in src/cd/tokens/world.css. Its root carries
 * `data-cd-language="clear-lid"` and reads the CLEAR LID scope directly; no
 * element here reads a `--sol-*` token or wears `.fd5-control`. The bridge
 * itself must stay in world.css until the remaining legacy screens land.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SceneProps } from "../../app/router";
import type { ScreenId } from "../../engine/arbiter";
import { useStore } from "../../state/store";
import { reducer } from "../../state/reducer";
import type { Action, AppState, InventoryLevel } from "../../state/types";
import { arbiterFor } from "../../engine/arbiter";
import { activeVariant } from "../../data/variant";
import { coverageForAllMeals, effectiveMealForSlot, todayInfo } from "../../state/selectors";
import { londonDateIso, londonParts } from "../../state/london";
import { useNow } from "../../state/useNow";
import { requireMeal } from "../../data";
import { ageOf } from "../../cd/freshness/classes";
import { setVoice } from "../../cd/sound/cues";
import { useOpenPanel, useOpenSection } from "../../cd/chassis";
import { Enclosure, Register, type RegisterGroup } from "../../cd/foundry";
import { LOCATION_GROUP_LABEL, LOCATION_GROUP_ORDER, REGISTER_FLAT, REGISTER_GROUPS, type LocationGroup } from "./location";
import { countdownForIngredient } from "./countdown";
import { registerDisambiguator } from "./registerName";
import { RegisterRow } from "./RegisterRow";
import { LeftoverRow } from "./LeftoverRow";
import { Annunciator, BayCut, LampScale, LarderGauge, LID_SCALE_PX, ThumbWheel } from "./Instruments";
import { TuningScale } from "./TuningScale";
import { DinnerLedger } from "./logDinner";
import { WasteTray } from "./WasteTray";
import { censusOf, fillOf, latestStocktake, levelPx, LEVEL_ANNOUNCE, slewMs, type Station } from "./model";
import { orbitOffset, useTrophy } from "./useTrophy";
import "./stores.css";

/** How many stations the tuning scale ranks. PLAN section 6.7's own five. */
const STATION_COUNT = 5;

/** Committed nominal cell widths, asserted at runtime by the plate's own
 *  measurement below, which overrides them if the root font size differs. */
const SCALE_PX_NOMINAL = 112; // 7rem
const LIFE_PX_NOMINAL = 64; // 4rem

function hhmm(iso: string): string {
  const { hour, minute } = londonParts(new Date(iso));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

interface Armed {
  id: string;
  index: number;
  group: LocationGroup;
}

export default function StoresScene(_props: SceneProps) {
  const { state, dispatch } = useStore();

  /* The coarse clock. Every countdown here is day-granular. */
  const now = useNow(60_000);
  const nowMs = now.getTime();

  /* THE SHADOW MODEL. Assigned every render so it is never behind the store,
     and advanced INLINE at every input so it is never behind the hand. */
  const modelRef = useRef<AppState>(state);
  modelRef.current = state;

  const [armed, setArmed] = useState<Armed | null>(null);
  const [announce, setAnnounce] = useState("tap a row to address it");
  /** Bumped by a REAL write. The lamps answer activity, never a clock. */
  const [activity, setActivity] = useState(0);

  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const pointerRefs = useRef(new Map<string, HTMLSpanElement>());
  const bayRef = useRef<HTMLDivElement | null>(null);
  /** Consumed by the very next `onArm` after an auto-advance moves focus. */
  const suppressArmAnnounceRef = useRef(false);

  const trophyState = useTrophy();
  const { trophy, orbit, power } = trophyState;

  /* II.5.9 — one voice per world, claimed on arrival. Scenes unmount on
     navigation, so each screen sets the voice it speaks in as it mounts. */
  useEffect(() => setVoice("clear-lid"), []);

  /* ------------------------------------------------------------ panel state */
  /* R6 — these outlive a navigation and die on a reload. */
  const [openId, setOpenId] = useOpenSection("register", "fridge");
  const [tunedId, setTunedId] = useOpenPanel<string | null>("station", null);
  const [wasteOpen, setWasteOpen] = useOpenPanel<boolean>("waste", false);

  const openGroup = (LOCATION_GROUP_ORDER as string[]).includes(openId ?? "")
    ? (openId as LocationGroup)
    : null;

  /* --------------------------------------------------------------- readings */

  const { prefs, inventory } = state;
  const variant = activeVariant(state);
  const info = todayInfo(now, prefs.cycleStartSaturday);
  const todayIso = londonDateIso(now);
  const dinner =
    typeof info.dayNo === "number" ? (effectiveMealForSlot("A", info.dayNo, "dinner", state) ?? null) : null;
  const dinnerTick = state.eaten[todayIso]?.dinner ?? null;

  const countdownFor = useCallback(
    (ing: Parameters<typeof countdownForIngredient>[0], entry: Parameters<typeof countdownForIngredient>[1]) =>
      countdownForIngredient(ing, entry, new Date(nowMs)),
    [nowMs]
  );

  const census = useMemo(() => censusOf(inventory, countdownFor), [inventory, countdownFor]);
  const larder = useMemo(() => fillOf(REGISTER_FLAT, inventory), [inventory]);
  const lastStocktake = useMemo(() => latestStocktake(REGISTER_FLAT, inventory), [inventory]);
  const hasStock = larder.counted > 0;

  const arbiter = useMemo(() => arbiterFor("stores", state, now), [state, now]);
  const rank1 = arbiter.rank1;

  const activeLeftovers = useMemo(
    () => state.leftovers.filter((l) => l.consumedAt == null),
    [state.leftovers]
  );

  /*
    docs/VARIANT-SPEC.md, binding: "coverage strip ranks kept meals first in
    tester mode (others still listed, marked 'not this week')." A stable
    partition — the kept meals keep their coverage-descending order among
    themselves, and so do the rest; only the group boundary is new.
  */
  const ranking = useMemo(() => {
    if (!hasStock) return { stations: [] as Station[], total: 0, cut: 0 };
    const all = coverageForAllMeals(inventory, prefs.cover, ["A", "B"]);
    const ranked = variant.isTester
      ? [...all].sort((a, b) => Number(variant.isKeptMealId(b.mealId)) - Number(variant.isKeptMealId(a.mealId)))
      : all;
    const stations: Station[] = ranked.slice(0, STATION_COUNT).map((c) => ({
      mealId: c.mealId,
      name: requireMeal(c.mealId).name,
      coverage: c.coverage,
      inStock: c.byIngredient.filter((i) => i.ratio >= 1).length,
      needed: c.byIngredient.length,
      keptThisWeek: variant.isKeptMealId(c.mealId),
    }));
    return {
      stations,
      total: ranked.length,
      cut: ranked.filter((c) => !variant.isKeptMealId(c.mealId)).length,
    };
  }, [hasStock, inventory, prefs.cover, variant]);
  const stations = ranking.stations;

  /* --------------------------------------------------- the plate's geometry */
  /*
    The channels are measured ONCE, and again only on resize — never per row and
    never per frame (II.2.22's own budget discipline). They are read off the
    first rendered row's own cells, so the printed scale and the pointer that
    travels it can never disagree about how wide the scale is.
  */
  const [scalePx, setScalePx] = useState(SCALE_PX_NOMINAL);
  const [lifePx, setLifePx] = useState(LIFE_PX_NOMINAL);
  /* A leftover row carries a different template at phone width, so its life
     channel is a different width. Measuring the ingredient row's and using it
     for both would put every leftover's index at the wrong fraction of its own
     scale — a miscalibrated instrument, not a layout nicety. */
  const [leftoverLifePx, setLeftoverLifePx] = useState(LIFE_PX_NOMINAL);
  /*
    II.6.24's confession, measured HERE — in the same effect that resolves the
    scrolling element — rather than in the component that prints it.

    THE DEFECT THIS FIXES, found by rendering at 390px: the pitch was computed
    as 2.75rem from the root font size, but a phone-width row is 4rem — the
    narrow plate is two engraved lines, not one — so the bay printed "22 below
    the cut" for a group holding 21 rows in total. A confession that over-states
    is not a confession. The pitch is now read off a real row on every
    measurement, so it is right at both widths and at any zoom.

    Verified fronted (a backgrounded tab runs no rAF and freezes this, which is
    a measuring artefact and not a defect): at 390px over 21 rows in a 384px
    bay it reads 0/16 at the top, 15/0 at the foot, 3/13 at 192px.
  */
  const [cut, setCut] = useState({ above: 0, below: 0 });
  const cutRef = useRef({ above: -1, below: -1 });

  useLayoutEffect(() => {
    const bay = bayRef.current;
    if (!bay) return;
    const scroller = bay.querySelector<HTMLElement>(".cd-register-group[data-cd-open='true'] > div");
    if (!scroller) return;
    let frame: number | null = null;

    const read = (): void => {
      const s = scroller.querySelector<HTMLElement>(".str-row:not(.str-row--leftover) .str-row__scale");
      const l = scroller.querySelector<HTMLElement>(".str-row:not(.str-row--leftover) .str-row__life");
      const lo = scroller.querySelector<HTMLElement>(".str-row--leftover .str-row__life");
      if (s) setScalePx(s.getBoundingClientRect().width || SCALE_PX_NOMINAL);
      if (l) setLifePx(l.getBoundingClientRect().width || LIFE_PX_NOMINAL);
      setLeftoverLifePx(lo ? lo.getBoundingClientRect().width || LIFE_PX_NOMINAL : LIFE_PX_NOMINAL);
    };

    /* Only ever calls setState when an INTEGER changes: a scroll that moves the
       plate four pixels without changing either figure costs one comparison and
       no render at all (the measured law's own rule — budget renders). */
    const measure = (): void => {
      frame = null;
      const row = scroller.querySelector<HTMLElement>(".str-row");
      const pitch = (row && row.getBoundingClientRect().height) || 44;
      const above = Math.floor(scroller.scrollTop / pitch + 0.001);
      const hiddenBelow = Math.max(0, scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop);
      const below = Math.ceil(hiddenBelow / pitch - 0.001);
      if (above === cutRef.current.above && below === cutRef.current.below) return;
      cutRef.current = { above, below };
      setCut({ above, below });
    };

    const schedule = (): void => {
      if (frame === null) frame = requestAnimationFrame(measure);
    };

    read();
    measure();
    scroller.addEventListener("scroll", schedule, { passive: true });
    const ro = new ResizeObserver(() => {
      read();
      schedule();
    });
    ro.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", schedule);
      ro.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [openId]);

  /* ----------------------------------------------------------- commit paths */

  /**
   * II.1.1 — the division of labour, exactly: semantic 0ms, mechanical after.
   * The value is true before any spring, any transition and any re-render.
   */
  const commit = useCallback((action: Action): AppState => {
    const next = reducer(modelRef.current, action);
    modelRef.current = next;
    return next;
  }, []);

  const commitLevel = useCallback(
    (id: string, level: InventoryLevel, _eventTs: number, advance: boolean) => {
      const action: Action = { type: "inventory/set", ingId: id, level };
      // 1 · SEMANTIC COMMIT — synchronous, this task, before any render work.
      commit(action);

      // 2 · MECHANICAL REPORT, also this task: the addressed row's needle is
      //     retargeted off the COMMITTED level rather than off the store's
      //     still-stale one, so the instrument has answered inside the Floor's
      //     16ms. React's own render writes the identical values afterwards,
      //     which is a no-op for a transition already running to that target.
      const pointer = pointerRefs.current.get(id);
      if (pointer) {
        const from = Number(pointer.dataset.x ?? "0");
        const to = levelPx(level, scalePx);
        pointer.style.setProperty("--str-pointer-ms", `${slewMs(from, to).toFixed(0)}ms`);
        pointer.style.setProperty("--str-pointer-x", `${to.toFixed(2)}px`);
        pointer.dataset.x = String(to);
      }

      // 3 · the request to re-render, and the store's own write.
      dispatch(action);
      setActivity((n) => n + 1);
      const ing = REGISTER_FLAT.find((i) => i.id === id);
      if (ing) setAnnounce(`${ing.name.short}: ${LEVEL_ANNOUNCE[level]}`);

      if (!advance) return;
      // PLAN section 6.7's own "auto-advance to next row on set", and ONLY for
      // an absolute detent pick — see ThumbWheel's own note on why relative
      // travel must not advance.
      const idx = REGISTER_FLAT.findIndex((i) => i.id === id);
      const next = REGISTER_FLAT[idx + 1];
      if (!next) return;
      const el = rowRefs.current.get(next.id);
      if (!el) return;
      suppressArmAnnounceRef.current = true;
      el.focus();
    },
    [commit, dispatch, scalePx]
  );

  /**
   * RELATIVE travel, resolved against the COMMITTED model. The row sends a
   * delta rather than a destination precisely so this can read `modelRef` —
   * the render's own `level` is one frame behind by construction, and two
   * presses inside one frame would otherwise both compute the same seat and
   * one of them would be silently dropped. Measured before the repair: six
   * arrow presses in one task, one seat of travel.
   */
  const handleRowStep = useCallback(
    (id: string, step: number | "min" | "max", eventTs: number) => {
      const current = modelRef.current.inventory[id]?.level ?? 0;
      const next =
        step === "min" ? 0 : step === "max" ? 4 : Math.min(4, Math.max(0, current + step));
      commitLevel(id, next as InventoryLevel, eventTs, false);
    },
    [commitLevel]
  );

  const handleArm = useCallback((id: string, index: number, _eventTs: number) => {
    setArmed((prev) => (prev?.id === id ? prev : { id, index, group: groupOf(id) }));
    if (suppressArmAnnounceRef.current) suppressArmAnnounceRef.current = false;
  }, []);

  const handleWheelSet = useCallback(
    (level: InventoryLevel, eventTs: number, advance: boolean) => {
      if (!armed) return;
      commitLevel(armed.id, level, eventTs, advance);
    },
    [armed, commitLevel]
  );

  const consumeLeftover = useCallback(
    (id: string) => {
      const action: Action = { type: "leftovers/consume", id };
      commit(action);
      dispatch(action);
      setActivity((n) => n + 1);
    },
    [commit, dispatch]
  );

  const registerEl = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  const registerPointer = useCallback((id: string, el: HTMLSpanElement | null) => {
    if (el) pointerRefs.current.set(id, el);
    else pointerRefs.current.delete(id);
  }, []);

  /** Open the group a row lives in, address it, and bring it under the cut. */
  const reveal = useCallback(
    (ingId: string) => {
      const group = groupOf(ingId);
      setOpenId(group);
      // The row may not exist yet if its lid was shut; the focus lands on the
      // frame after the open group has mounted.
      requestAnimationFrame(() => {
        const el = rowRefs.current.get(ingId);
        el?.scrollIntoView({ block: "center" });
        el?.focus();
      });
    },
    [setOpenId]
  );

  const go = useCallback((screen: ScreenId) => {
    window.location.hash = `#/${screen}`;
  }, []);

  const handleArbiter = useCallback(() => {
    const target = rank1?.target;
    if (!target) return;
    if (target.screen === "stores") {
      if (target.id) reveal(target.id);
      else {
        const first = REGISTER_GROUPS[openGroup ?? "fridge"][0];
        if (first) reveal(first.id);
      }
      return;
    }
    go(target.screen);
  }, [rank1, reveal, go, openGroup]);

  const startStocktake = useCallback(() => {
    const first = REGISTER_GROUPS[openGroup ?? "fridge"][0] ?? REGISTER_FLAT[0];
    if (first) reveal(first.id);
  }, [openGroup, reveal]);

  /* ------------------------------------------------------------ the register */

  const rowsOfOpenGroup = openGroup ? REGISTER_GROUPS[openGroup] : [];
  const leftoversHere = openGroup === "fridge" ? activeLeftovers : [];
  const openRowCount = rowsOfOpenGroup.length + leftoversHere.length;
  const underLids = REGISTER_FLAT.length - rowsOfOpenGroup.length;

  const groups: RegisterGroup[] = LOCATION_GROUP_ORDER.map((group) => {
    const rows = REGISTER_GROUPS[group];
    const fill = fillOf(rows, inventory);
    const leftovers = group === "fridge" ? activeLeftovers : [];
    return {
      id: group,
      label: LOCATION_GROUP_LABEL[group],
      lidSlot: (
        <LampScale
          fraction={fill.fraction}
          widthPx={LID_SCALE_PX}
          activity={activity}
          divisions={5}
          label={`${LOCATION_GROUP_LABEL[group]}: ${Math.round(fill.fraction * 100)} percent full across ${fill.counted} counted rows, ${fill.stocked} of ${rows.length} stocked`}
          figure={`${Math.round(fill.fraction * 100)}%`}
        />
      ),
      items: [
        ...rows.map((ing, i) => () => (
          <RegisterRow
            ing={ing}
            entry={inventory[ing.id]}
            index={i}
            armed={armed?.id === ing.id}
            nowMs={nowMs}
            scalePx={scalePx}
            lifePx={lifePx}
            onArm={handleArm}
            onStep={handleRowStep}
            registerEl={registerEl}
            registerPointer={registerPointer}
          />
        )),
        ...leftovers.map((lo, i) => () => (
          <LeftoverRow
            entry={lo}
            index={rows.length + i}
            now={now}
            lifePx={leftoverLifePx}
            dispatch={dispatch}
            onConsume={consumeLeftover}
          />
        )),
      ],
    };
  });

  /* ------------------------------------------------------------ the readings */

  const armedIng = armed ? (REGISTER_FLAT.find((i) => i.id === armed.id) ?? null) : null;
  const armedEntry = armedIng ? inventory[armedIng.id] : undefined;
  const armedLevel: InventoryLevel | null = armedIng ? ((armedEntry?.level ?? 0) as InventoryLevel) : null;
  const armedAge = ageOf("stocktake", armedEntry?.updatedAt, nowMs);
  const armedName = armedIng ? `${armedIng.name.short}${registerDisambiguator(armedIng)}` : null;
  /** The index INSIDE the open group — the lid's cut reads this and nothing else. */
  const armedIndexHere =
    armed && openGroup ? rowsOfOpenGroup.findIndex((r) => r.id === armed.id) : -1;

  const offset = orbitOffset(orbit);

  return (
    <section
      className="str"
      data-cd-language="clear-lid"
      data-str-trophy={trophy ? "true" : "false"}
      data-str-power={power}
      data-str-armed={armedIndexHere >= 0 ? "true" : "false"}
      style={
        {
          // The burn-in orbit moves the WHOLE composition as one rigid frame.
          "--str-orbit-x": `${offset.x}px`,
          "--str-orbit-y": `${offset.y}px`,
          // The lid's cut, in row units. Two panes, never sixty-five.
          "--str-armed-i": String(Math.max(0, armedIndexHere)),
          "--str-rows": String(openRowCount),
        } as React.CSSProperties
      }
    >
      <div className="str-frame">
        <div className="str-masthead">
          <Annunciator
            duty={rank1?.text ?? null}
            queued={arbiter.queued}
            actionLabel={
              rank1?.target ? (rank1.target.screen === "stores" ? "address →" : `${rank1.target.screen} →`) : null
            }
            onActivate={rank1?.target ? handleArbiter : null}
            expired={census.expired}
            expiring={census.expiring}
            alerts={census.alerts}
            onAddress={reveal}
            trophy={trophy}
          />

          <LarderGauge
            fraction={larder.fraction}
            counted={larder.counted}
            total={larder.total}
            low={census.low}
            frozen={census.frozen}
            lastStocktake={lastStocktake}
            activity={activity}
            onCount={startStocktake}
            trophy={trophy}
          />
        </div>

        <div className="str-body">
          <Enclosure
            variant="hero"
            as="section"
            className="str-bay"
            aria-label="the register"
            data-str-hidden={trophy ? "true" : undefined}
          >
            <div className="str-bay__spine" aria-hidden="true" />
            <div className="str-bay__inner" ref={bayRef}>
              {/* THE HOOD. Keyed by the open lid so it genuinely remounts and
                  the hinge genuinely replays: in this world one specimen case
                  closing IS the next one opening (CLEAR LID section 6). */}
              <div className="str-bay__hood" key={openId ?? "shut"} aria-hidden="true" />
              <Register
                className="str-register"
                groups={groups}
                openId={openId}
                onOpenChange={setOpenId}
                label="stock register, grouped by location"
                overflowWord="more"
              />
            </div>
            <BayCut above={cut.above} below={cut.below} underLids={underLids} />
          </Enclosure>

          <div className="str-column">
            <ThumbWheel
              armedName={armedName}
              level={armedLevel}
              onSet={handleWheelSet}
              announce={announce}
              ageLabel={armedIng ? (armedAge.ms == null ? "never counted" : `counted ${armedAge.label} ago`) : "—"}
              trophy={trophy}
            />

            <TuningScale
              stations={stations}
              rankedTotal={ranking.total}
              cutTotal={ranking.cut}
              tunedId={tunedId}
              onTune={setTunedId}
              activity={activity}
              hasStock={hasStock}
              trophy={trophy}
            />
          </div>
        </div>

        <div className="str-footer">
          <DinnerLedger
            dinner={dinner}
            now={now}
            alreadyEaten={Boolean(dinnerTick)}
            eatenAt={dinnerTick ? hhmm(dinnerTick.at) : null}
            dispatch={dispatch}
            commit={commit}
            wasteCount={state.waste.length}
            onOpenWaste={() => setWasteOpen(true)}
            trophy={trophy}
          />
        </div>
      </div>

      <WasteTray open={wasteOpen} onClose={() => setWasteOpen(false)} waste={state.waste} now={now} />
    </section>
  );
}

/** Which group a register id belongs to. Computed from the frozen data. */
function groupOf(id: string): LocationGroup {
  for (const g of LOCATION_GROUP_ORDER) {
    if (REGISTER_GROUPS[g].some((i) => i.id === id)) return g;
  }
  return "cupboard";
}
