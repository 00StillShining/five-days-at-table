/**
 * src/screens/plan/index.tsx — PLAN, in 17 RESTOMOD.
 *
 * THE QUESTION THIS SCREEN ANSWERS: how is the fortnight tracking against its
 * targets?
 *
 * Six hero-grade instruments answer it, which is the NORMAL condition here and
 * not a budget breach (CORRECTIONARY 3.1 — "a dashboard carries four to six
 * simultaneous hero-grade instruments"). Each one's job in one sentence, which
 * is the exit test CD-BRIEF ruling 4's re-authored Refined rung sets:
 *
 *   CASE ROW        five channels at once — fat, protein, KCAL, carb, fibre —
 *                   each needle against its own printed band, in the language's
 *                   own measured case-diameter split.
 *   RANK-ONE GAUGE  the centre of that row, and the only inset on the panel:
 *                   the energy figure told twice, as an angle and as a numeral.
 *   COMMISSION      which plan is live, which week is being browsed, and which
 *                   week actually executes — plus the fortnight's own shape,
 *                   five bars, one per plated day.
 *   CROWN           pages the row, sets the operator's own mark on the focused
 *                   dial, and — held — re-commissions the scope.
 *   DAY REGISTER    which plated day is open, how it reads against its own day
 *                   band, and the four slots inside it.
 *   SWAP DECK       what else could cook in one slot, ranked by what the
 *                   shelves already cover, with the band damage printed first.
 *
 * ---------------------------------------------------------------------------
 * THE LOAD-BEARING STATE FACT (D5, "a-twice")
 * ---------------------------------------------------------------------------
 * The executing fortnight is ALWAYS Week A, twice. `prefs.week` is a BROWSING
 * toggle, owned by the chassis' settings tray, and this screen renders no
 * second one. PLAN is where conflating the two would be most invisible and most
 * wrong, so the commission plate engraves both claims as separate rows, and the
 * crown's re-commission is REFUSED with a printed reason while Week B is on the
 * board — "B, twice" is not a fact about anything.
 *
 * ---------------------------------------------------------------------------
 * THE 16ms ACK IS STRUCTURAL (CD-BRIEF's measured performance law, binding)
 * ---------------------------------------------------------------------------
 * "A React `dispatch` alone does NOT satisfy the Floor's 16ms acknowledgement,
 * because the reducer runs during the NEXT render — the model is still stale
 * when your handler returns."
 *
 * `modelRef` is the shadow model. Every commit below applies the FROZEN reducer
 * to it inline, recomputes the scope totals off the committed result, and hands
 * them to the linkage — five needles retargeted and five figures rewritten —
 * before `dispatch` is called at all.
 *
 * ---------------------------------------------------------------------------
 * ONE CLOCK (II.4.13, and the perf law's rule 4)
 * ---------------------------------------------------------------------------
 * Every age on this board is day-granular: the eaten class expires at 24h, the
 * stocktake class at 72h. One 60s clock at the scene root feeds both, and each
 * printed age carries its own class threshold beside it so nothing depends on
 * the sampling rate.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SceneProps } from "../../app/router";
import { useOpenPanel, useOpenSection } from "../../cd/chassis";
import { Escutcheon, Plate } from "../../cd/foundry";
import { ageOf } from "../../cd/freshness/classes";
import { caution, cue, setVoice } from "../../cd/sound/cues";
import { activeVariant } from "../../data/variant";
import type { Slot } from "../../data/types";
import { reducer } from "../../state/reducer";
import { overBandMacros } from "../../state/selectors";
import { useStore } from "../../state/store";
import type { Action, AppState } from "../../state/types";
import { useNow } from "../../state/useNow";
import { ChannelRow, type LinkageHandle } from "./ChannelRow";
import { CommissionPlate } from "./CommissionPlate";
import { DayRegister } from "./DayRegister";
import { SwapDeck } from "./SwapDeck";
import { orbitOffset, useTrophy } from "./useTrophy";
import "./plan.css";
import {
  BAND_WORD,
  CHANNELS,
  HERO_INDEX,
  SCOPES,
  SLOT_LABEL,
  bandState,
  candidatesForSlot,
  formatChannel,
  mealLoggedAt,
  readWeek,
  scopeAllowed,
  scopeBands,
  scopeTotals,
  type ChannelKey,
  type ScopeId,
} from "./model";

const ZERO_MARKS: Record<ChannelKey, number> = {
  kcal: 0,
  protein: 0,
  netCarb: 0,
  fat: 0,
  fibre: 0,
};

/** "3:dinner" — the swap deck's target, small enough to live in the panel store. */
function encodeTarget(dayNo: number, slot: Slot): string {
  return `${dayNo}:${slot}`;
}
function decodeTarget(key: string | null): { dayNo: number; slot: Slot } | null {
  if (!key) return null;
  const [d, s] = key.split(":");
  const dayNo = Number(d);
  if (!Number.isFinite(dayNo) || !s) return null;
  return { dayNo, slot: s as Slot };
}

export default function PlanScene(_props: SceneProps) {
  const { state, dispatch } = useStore();
  const { week, cover } = state.prefs;
  const variant = activeVariant(state);
  const now = useNow(60_000);
  const nowMs = now.getTime();

  /* The shadow model. Assigned every render so it is never behind the store,
     and advanced INLINE at every input so it is never behind the hand. */
  const modelRef = useRef<AppState>(state);
  modelRef.current = state;

  const linkageRef = useRef<LinkageHandle>(null);
  const { trophy, orbit, power, isTrophy } = useTrophy();

  /* II.5.9 — one voice per world. Scenes unmount on navigation, so each screen
     claims the voice it speaks in as it arrives. */
  useEffect(() => setVoice("restomod"), []);

  /* ------------------------------------------------------- panel state (R6) */

  const [scopeId, setScopeId] = useOpenPanel<ScopeId>("scope", "week");
  const [crownPulled, setCrownPulled] = useOpenPanel<boolean>("crown", true);
  const [focused, setFocused] = useOpenPanel<number>("dial", HERO_INDEX);
  const [marks, setMarks] = useOpenPanel<Record<ChannelKey, number>>("marks", ZERO_MARKS);
  const [openDay, setOpenDay] = useOpenSection("day", "day-1");
  const [deckKey, setDeckKey] = useOpenPanel<string | null>("deck", null);

  /* The marks' own shadow model. `useOpenPanel`'s setter takes a VALUE, not an
     updater, so two crown detents inside one frame would both spread the same
     render's `marks` and the second would land on a base that never saw the
     first. Same pattern as `modelRef`, and the same reason. */
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const setMark = useCallback(
    (channel: ChannelKey, next: number) => {
      const merged = { ...marksRef.current, [channel]: next };
      marksRef.current = merged;
      setMarks(merged);
    },
    [setMarks]
  );

  /* D5's guard, applied rather than described: a fortnight is Week A twice, so
     the fortnight scope is only a fact while Week A is on the board. */
  const scope = SCOPES[scopeAllowed(scopeId, week) ? scopeId : "week"];

  /* ---------------------------------------------------------------- readings */

  const bands = useMemo(
    () => scopeBands(week, cover, variant, scope.id),
    [week, cover, variant, scope.id]
  );
  const totals = useMemo(
    () => scopeTotals(week, cover, state.swaps, variant, scope.id),
    [week, cover, state.swaps, variant, scope.id]
  );
  const days = useMemo(
    () => readWeek(week, cover, state.swaps, variant, state.eaten),
    [week, cover, state.swaps, variant, state.eaten]
  );

  const mealCount = days.reduce((n, d) => n + d.cookableCount, 0);
  const cutCount = days.reduce((n, d) => n + d.cutCount, 0);
  const swapCount = Object.keys(state.swaps).length;

  /** The newest eaten tick anywhere on the board — the one sampled reading. */
  const newestLog = useMemo(() => {
    let best: string | null = null;
    for (const d of days) {
      for (const s of d.slots) {
        if (s.loggedAt && (best === null || s.loggedAt > best)) best = s.loggedAt;
      }
    }
    return best;
  }, [days]);
  const logAge = ageOf("eaten", newestLog, nowMs);

  /* ------------------------------------------------------------- commit paths */

  /** II.1.1's division of labour, exactly: semantic 0ms, mechanical after. */
  const commit = useCallback((action: Action): AppState => {
    const next = reducer(modelRef.current, action);
    modelRef.current = next;
    return next;
  }, []);

  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    },
    []
  );

  /**
   * Every store-touching path funnels through here so the ack, the report, the
   * band check and the cue can never drift apart between three call sites.
   */
  const apply = useCallback(
    (action: Action, opts: { dayNo?: number; confirmWord?: string }) => {
      const next = commit(action); // 1 · semantic, this task

      // 2 · mechanical — retarget off the COMMITTED model, not the store's
      //     current (still stale) one.
      linkageRef.current?.report(scopeTotals(week, cover, next.swaps, variant, scope.id));

      // 3 · the caution, only for a band crossing THIS ACTION caused, fired
      //     once per state entry (II.5.8's lower severity) — never on load,
      //     never on navigation, and never repeating.
      const beforeDay = opts.dayNo == null ? null : days.find((d) => d.dayNo === opts.dayNo);
      if (beforeDay) {
        const afterDay = readWeek(week, cover, next.swaps, variant, next.eaten).find(
          (d) => d.dayNo === beforeDay.dayNo
        );
        const wasOver = new Set(overBandMacros(beforeDay.macros, beforeDay.band));
        const nowOver = afterDay ? overBandMacros(afterDay.macros, afterDay.band) : [];
        if (nowOver.some((k) => !wasOver.has(k))) {
          // II.5.15 / the owner ruling: Trophy is silent EXCEPT warnings, and the
          // gate enforces that rather than the layout happening to hide the
          // control that would have fired it.
          caution({ mode: isTrophy() ? "trophy" : undefined, trophyAudio: "warnings" });
        }
      }

      if (opts.confirmWord) {
        // II.5.7 — confirm fires only AFTER the consequence is real.
        cue("confirm", { x: 0.72, mode: isTrophy() ? "trophy" : undefined });
        if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
        setFlash(opts.confirmWord);
        flashTimer.current = window.setTimeout(() => setFlash(null), 2700);
      }

      dispatch(action); // 4 · the request to re-render
    },
    [commit, cover, days, dispatch, isTrophy, scope.id, variant, week]
  );

  const target = decodeTarget(deckKey);
  const targetDay = target ? days.find((d) => d.dayNo === target.dayNo) ?? null : null;
  const targetSlot = target && targetDay ? targetDay.slots.find((s) => s.slot === target.slot) ?? null : null;
  const plannedForTarget =
    targetSlot && (targetSlot.displaced ?? targetSlot.meal) ? (targetSlot.displaced ?? targetSlot.meal)! : null;

  const candidates = useMemo(
    () =>
      target
        ? candidatesForSlot(week, target.dayNo, target.slot, cover, state.inventory, state.swaps, variant)
        : [],
    [target, week, cover, state.inventory, state.swaps, variant]
  );

  const go = useCallback((screen: string) => {
    window.location.hash = `#/${screen}`;
  }, []);

  /* --------------------------------------------------------------- the crown */

  const otherScope: ScopeId = scope.id === "week" ? "fortnight" : "week";
  const recommissionAllowed = scopeAllowed(otherScope, week);
  const recommission = recommissionAllowed
    ? {
        word: otherScope === "fortnight" ? "read the fortnight" : "read one week",
        onCommit: () => setScopeId(otherScope),
      }
    : null;
  const refusal = recommissionAllowed
    ? null
    : "the fortnight is week a, twice · nothing executes week b, so it has no fortnight to read";

  const focusedSpec = CHANNELS[focused] ?? CHANNELS[HERO_INDEX];
  const heroSpec = CHANNELS[HERO_INDEX];
  const heroState = bandState(totals[heroSpec.key], bands[heroSpec.key]);

  const offset = orbitOffset(orbit);

  return (
    <section
      className="pln"
      data-cd-language="restomod"
      data-pln-trophy={trophy ? "true" : "false"}
      data-pln-power={power}
      style={
        {
          // The burn-in orbit moves the WHOLE composition as ONE RIGID FRAME.
          "--pln-orbit-x": `${offset.x}px`,
          "--pln-orbit-y": `${offset.y}px`,
        } as React.CSSProperties
      }
    >
      <div className="pln-frame">
        <ChannelRow
          ref={linkageRef}
          values={totals}
          bands={bands}
          markTicks={marks}
          scopeLabel={scope.label}
          crownPulled={crownPulled}
          onCrownPulled={setCrownPulled}
          focused={focused}
          onFocused={setFocused}
          onMarkTicks={setMark}
          recommission={recommission}
          refusal={refusal}
          trophy={trophy}
        />

        <div className="pln-body" data-pln-hidden={trophy ? "true" : undefined}>
          <div className="pln-column">
            <CommissionPlate
              variantLabel={variant.label}
              isTester={variant.isTester}
              mealCount={mealCount}
              cutCount={cutCount}
              browsing={week}
              cover={cover}
              days={days}
            />

            {/* The scope's own printed statement. The gauges report it; this
                says, in words, what "it" is — and prints the identity that
                makes the crown's re-commission leave every needle still. */}
            <Plate className="pln-scope" surface="data">
              <Escutcheon as="h2">reading</Escutcheon>
              <p className="pln-scope-line cd-printed">
                <span className="cd-silkscreen">scope</span> {scope.label}
                <span aria-hidden="true"> · </span>
                <span className="cd-silkscreen">covers</span> {scope.note}
              </p>
              <p className="pln-scope-fresh cd-printed">
                <span className="cd-silkscreen">freshness</span> derived from the plan · never stale
                <span aria-hidden="true"> · </span>
                <span className="cd-silkscreen">last plate logged</span>{" "}
                {newestLog ? logAge.label : "never"}
                {logAge.word && <span className="pln-scope-word cd-silkscreen"> {logAge.word}</span>}
              </p>
              {/* KEYED on the flash itself: II.7.13's confirm is an EVENT, and
                  an element React never remounts plays its event once, at
                  mount, for nothing. */}
              <p key={flash ?? "idle"} className="pln-scope-flash cd-printed" role="status">
                {flash ?? ""}
              </p>
            </Plate>

            {/*
              REFINED-RUNG SUBTRACTION. A "cut in this commission" well used to
              sit here, restating the count. The ledger's question is "does it
              state a value, or let the hand do something?" — and it did
              neither that was not already done: the commission plate prints
              CUT 10 of 20 slots, and every cut row on the board carries the
              commission's own stated reason in full. Removed, and the board
              stopped overflowing its viewport in tester mode by 149px.
            */}
          </div>

          <DayRegister
            days={days}
            openId={openDay}
            onOpenChange={setOpenDay}
            channel={focusedSpec}
            nowMs={nowMs}
            onSwap={(dayNo, slotReading) => setDeckKey(encodeTarget(dayNo, slotReading.slot))}
            onToday={() => go("today")}
            isTester={variant.isTester}
          />
        </div>
      </div>

      {/* TROPHY MODE. What enlarges is the answer; what quiets is the reach.
          The age line is the freshness the class actually declares — macros are
          derived and never stale — beside the one sampled reading the board
          does carry. Never an invented age for a computed figure. */}
      <p className="pln-trophy-age cd-printed" aria-hidden={trophy ? undefined : true}>
        <span className="pln-trophy-word cd-silkscreen" data-pln-word={heroState}>
          {BAND_WORD[heroState]}
        </span>
        <span className="pln-trophy-scope">{scope.label}</span>
        <span className="pln-trophy-fresh">derived · never stale</span>
        <span className="pln-trophy-log">
          last plate logged {newestLog ? logAge.label : "never"}
        </span>
      </p>

      <SwapDeck
        open={target != null}
        onClose={() => setDeckKey(null)}
        dayLabel={targetDay?.abbr ?? ""}
        slot={target?.slot ?? "breakfast"}
        slotLabel={target ? SLOT_LABEL[target.slot] : ""}
        current={targetSlot?.meal ?? null}
        displaced={targetSlot?.displaced ?? null}
        candidates={candidates}
        cover={cover}
        inventory={state.inventory}
        nowMs={nowMs}
        swapCount={swapCount}
        onCommit={(candidateId) => {
          if (!plannedForTarget) return;
          apply(
            { type: "swaps/commit", slotMealId: plannedForTarget.id, replacementMealId: candidateId },
            { dayNo: target?.dayNo, confirmWord: "swap committed" }
          );
          setDeckKey(null);
        }}
        onClear={() => {
          if (!plannedForTarget) return;
          apply({ type: "swaps/clear", slotMealId: plannedForTarget.id }, {
            dayNo: target?.dayNo,
            confirmWord: "swap cleared",
          });
        }}
        onClearAll={() => {
          apply({ type: "swaps/clearAll" }, { confirmWord: "every swap dropped" });
          setDeckKey(null);
        }}
        onStores={() => go("stores")}
      />

      {/* The row's seats, announced once as words rather than as indices. */}
      <p className="fd5-visually-hidden">
        case row, left to right: {CHANNELS.map((c) => c.spoken).join(", ")}. The centre instrument
        is {heroSpec.spoken}, reading {formatChannel(totals[heroSpec.key], heroSpec)}{" "}
        {heroSpec.unit} for {scope.label}.
      </p>
    </section>
  );
}
