/**
 * src/screens/shop/index.tsx — SHOP, in 11 TANGENT HORIZON.
 *
 * THE QUESTION THIS SCREEN ANSWERS: what does this trip cost, where is the money
 * going, and is the basket reconciled?
 *
 * It is answered by six hero-grade instruments, which is the NORMAL condition
 * here and not a budget breach (CORRECTIONARY 3.1). Each one's job, in one
 * sentence — the exit test CD-BRIEF ruling 4's re-authored Refined rung sets:
 *
 *   PLINTH READOUT  what the whole trip costs, at the scale's reserved top step.
 *   COST TRACK      where that money sits between the retailers, as position on
 *                   a line rather than as an arc or a filled bar.
 *   HORIZON BAND    the seam: the position readout, both coarse selectors, both
 *                   fine crowns, the cueing cluster and the send summons.
 *   THE SEAM        the Signature — a rule whose gaps ARE the uncosted share of
 *                   the basket, closing into one line when nothing is left.
 *   THE REGISTER    the aisle you are checking, milled into one plate, one lid
 *                   open, the remainder confessed as a figure.
 *   RECONCILE PAD   the typed-back prices that close the last rings.
 *
 * ---------------------------------------------------------------------------
 * THE SCREEN'S ONE STRUCTURAL IDEA
 * ---------------------------------------------------------------------------
 * Section 2's geometry law: "nothing in this world may rise above the band's own
 * seam." Every control is at or below the aluminium band; above it there is the
 * rosewood mass and one recessed readout. That single rule decides the whole
 * composition, and it is what makes the Signature possible: when every ring on
 * the screen reads true, the seam under the band closes into one continuous
 * line and the horizon completes itself.
 *
 * ---------------------------------------------------------------------------
 * THE 16ms ACK IS STRUCTURAL (CD-BRIEF's measured performance law, binding)
 * ---------------------------------------------------------------------------
 * "A React `dispatch` alone does NOT satisfy the Floor's 16ms acknowledgement,
 * because the reducer runs during the NEXT render — the model is still stale
 * when your handler returns." `modelRef` is the model; `commit` applies the
 * frozen reducer to it inline at the input; the cost track and the position
 * window are then REPORTED TO through their own handles, before `dispatch` is
 * called at all.
 *
 * ---------------------------------------------------------------------------
 * ONE CLOCK, AND IT IS A COARSE ONE
 * ---------------------------------------------------------------------------
 * The perf law's rule 4: "Isolate clocks ... give day-granularity countdowns a
 * 60s clock, not a 1s one." The only ticking reading here is the price class,
 * whose declared threshold is FOURTEEN DAYS, so the screen runs one 60s clock
 * and nothing finer. A minute cannot change a fourteen-day class, but a session
 * left open across a day boundary can, and a screen that would rather not
 * re-render than tell the truth about that has chosen the wrong thing.
 *
 * ---------------------------------------------------------------------------
 * THE HANDOFF IS THE ONE CROSS-SCREEN CONTRACT IN THE PRODUCT
 * ---------------------------------------------------------------------------
 * `buildEnvelope` -> `encodeTrip` -> `#/list?t=` -> LIST's `decodeTrip`. Pinned
 * by the orchestrator, shipped by LIST, and untouched here: this rebuild changed
 * the housing the QR sits in and not one field of what it carries.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SceneProps } from "../../app/router";
import { useStore } from "../../state/store";
import { reducer } from "../../state/reducer";
import type { Action, AppState } from "../../state/types";
import { activeVariant } from "../../data/variant";
import { arbiterFor } from "../../engine/arbiter";
import { makeTripId, type TripKind } from "../../engine/tripCodec";
import { tripBuild, type TripDay } from "../../state/selectors";
import { londonDateIso } from "../../state/london";
import { useNow } from "../../state/useNow";
import { planShops } from "../../data";
import { useOpenPanel, useOpenSection } from "../../cd/chassis";
import { Enclosure, Escutcheon, PressKey, Register, type RegisterGroup } from "../../cd/foundry";
import { cue, setVoice } from "../../cd/sound/cues";
import { ageOf } from "../../cd/freshness/classes";
import { CostRow } from "./CostRow";
import { HorizonBand } from "./HorizonBand";
import { Plinth } from "./Plinth";
import { ReconcileTray } from "./ReconcileTray";
import { SendTray } from "./SendTray";
import { TrophyRead } from "./TrophyRead";
import type { TrackWindowHandle } from "./Instruments";
import {
  SEAT_WORD,
  aisleGroups,
  census,
  costReading,
  horizonComplete,
  kindLabel,
  lidOrder,
  money,
  omissions,
  positionOf,
  ringError,
  seamBreak,
  sheetVerifiedOn,
  trackIndices,
  uncostedLines,
  type AisleGroup,
} from "./model";
import {
  buildEnvelope,
  buyLinesForShop,
  effectiveLines,
  monthlyWasteTotal,
  SHOP_ORDER,
  type EffectiveLine,
} from "./tripHelpers";
import { budgetFor, useDeckSize } from "./useRowBudget";
import { orbitOffset, useTrophy } from "./useTrophy";
import "./shop.css";

/** The lid the register opens on before the operator has chosen one. */
const FIRST_LID = "@first";

interface Column {
  code: string;
  name: string;
  rows: EffectiveLine[];
  subtotal: number;
  groups: AisleGroup[];
}

export default function ShopScene(_props: SceneProps) {
  const { state, dispatch } = useStore();
  const now = useNow(60_000);
  const nowMs = now.getTime();
  const variant = activeVariant(state);

  /* The shadow model. Assigned every render so it is never behind the store, and
     advanced INLINE at every input so it is never behind the hand. */
  const modelRef = useRef(state);
  modelRef.current = state;

  const costRef = useRef<TrackWindowHandle>(null);
  const posRef = useRef<TrackWindowHandle>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const registerRef = useRef<HTMLDivElement>(null);

  const { trophy, orbit } = useTrophy();

  // II.5.9 — one voice per world, claimed on arrival. Scenes unmount on
  // navigation, so each screen sets the voice it speaks in as it mounts.
  useEffect(() => setVoice("tangent-horizon"), []);

  /* ------------------------------------------------------------ panel state */
  /* CD-BRIEF R6 — scenes unmount on navigation, so none of this may be a
     screen-local useState: an aisle left open survives a walk to COOK and back,
     and a reload genuinely resets it. The trip day is stored here for the same
     reason and by the same rule: it is which tab of one screen is showing, and
     nothing about it is data. */
  const [tripTab, setTripTab] = useOpenPanel<string>("trip", "0");
  const [seatedCode, setSeated] = useOpenPanel<string | null>("station", null);
  const [openLid, setOpenLid] = useOpenSection("aisle", FIRST_LID);
  const [sendOpen, setSendOpen] = useOpenPanel<boolean>("send", false);
  const [reconcileOpen, setReconcileOpen] = useOpenPanel<boolean>("reconcile", false);
  const [activeNominee, setActiveNominee] = useOpenPanel<string | null>("nominee", null);

  /* Screen-local by design: an "include anyway" override is re-derived from
     inventory on the next build, so surviving navigation would be a claim the
     data does not make. */
  const [forcedIncludeIds, setForcedIncludeIds] = useState<ReadonlySet<string>>(new Set());

  /* docs/VARIANT-SPEC.md: "no day-7 toggle in tester mode" — the tester has
     exactly one trip (the authored basket), not a day-0/day-7 split. */
  const tripDay: TripDay = variant.isTester ? 0 : tripTab === "7" ? 7 : 0;
  const kind: TripKind = tripDay === 0 ? "full" : "day7";

  /* ------------------------------------------------------------------- trip */

  const trip = useMemo(
    () => tripBuild(state.inventory, tripDay, state.swaps, variant),
    [state.inventory, tripDay, state.swaps, variant]
  );
  const lines = useMemo(() => effectiveLines(trip, forcedIncludeIds), [trip, forcedIncludeIds]);

  /* Trip identity is stable for as long as the shopper is looking at the same
     pass; switching the paddle IS building a different trip. */
  const tripMeta = useMemo(
    () => ({ tripId: makeTripId(now), createdOn: now.toISOString() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tripDay, variant.id]
  );

  /* docs/VARIANT-SPEC.md: "single Morrisons column" in tester mode. */
  const shopOrder = variant.isTester ? (["M"] as const) : SHOP_ORDER;

  /* THE ONE THING JUDGED PER BASKET RATHER THAN PER SKU. The tester's authored
     receipt carries a single verification date for all 39 lines, and that date
     is the truth about them; the canonical SKU's own verifiedOn describes a
     different product string. Full mode passes null and every line is judged on
     its own SKU. */
  const costCtx = useMemo(
    () => ({
      priceChecks: state.priceChecks,
      now: nowMs,
      basketVerifiedOn: variant.isTester ? (variant.basket?.verifiedOn ?? null) : null,
    }),
    [state.priceChecks, nowMs, variant]
  );

  const columns: Column[] = useMemo(
    () =>
      shopOrder.map((code) => {
        const rows = buyLinesForShop(lines, code);
        const groups = aisleGroups(rows, code, costCtx);
        return {
          code,
          name: planShops[code]?.name ?? code,
          rows,
          subtotal: groups.reduce((s, g) => s + g.subtotal, 0),
          groups,
        };
      }),
    [lines, shopOrder, costCtx]
  );

  const live = columns.filter((c) => c.rows.length > 0);
  const seated = live.find((c) => c.code === seatedCode) ?? live[0] ?? null;
  const groups = seated?.groups ?? [];

  const reading = useMemo(() => census(lines, costCtx), [lines, costCtx]);
  const indices = useMemo(
    () => trackIndices(live.map((c) => ({ code: c.code, displayName: c.name, subtotal: c.subtotal, lines: c.rows.length }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns]
  );
  const horizon = horizonComplete(reading);

  /* The open lid. FIRST_LID is "not yet chosen" and resolves to the seated
     station's first aisle; null is a lid the operator deliberately shut with the
     LIFT diamond. */
  const effectiveLid = openLid === FIRST_LID ? (groups[0]?.id ?? null) : openLid;
  const openGroup = groups.find((g) => g.id === effectiveLid) ?? null;

  const allLids = useMemo(() => lidOrder(live), [live]);
  const position = useMemo(() => positionOf(live, effectiveLid), [live, effectiveLid]);

  /*
    THE PAD'S CONTENTS, AND THE RECOVERY THE FRESHNESS LAYER PROMISES.

    The plinth's stale reading names this pad as its fixed-position recovery
    action. A pad holding only the arbiter's two or three nominees could not fix
    a sheet that went stale across forty-four lines, so it holds every line
    without a current price, the arbiter's own nominees first and flagged.
    "Worth checking first" and "not currently priced" are different claims and
    the pad prints both.
  */
  const padRows = useMemo(
    () => uncostedLines(lines, costCtx, trip.verifyNominees),
    [lines, costCtx, trip.verifyNominees]
  );
  const padDone = useMemo(
    () =>
      lines
        .filter((el) => !el.isDedupe && el.effectivePacks > 0 && state.priceChecks[el.line.ingId])
        .map((el) => ({ el, check: state.priceChecks[el.line.ingId] })),
    [lines, state.priceChecks]
  );

  const openRecovery = useCallback(() => {
    setActiveNominee(padRows[0]?.el.line.ingId ?? null);
    setReconcileOpen(true);
  }, [padRows, setActiveNominee, setReconcileOpen]);

  /* The price sheet's own verification age, READ OFF THE DATA rather than
     asserted: the newest verifiedOn any SKU in this basket carries. Real —
     23 SKUs hold one, and the tester basket holds one for the whole receipt. */
  const pricedOn = useMemo(
    () => sheetVerifiedOn(lines, costCtx.basketVerifiedOn),
    [lines, costCtx.basketVerifiedOn]
  );
  const sheetAge = ageOf("price", pricedOn, nowMs);

  /* -------------------------------------------------------------- the budget */

  const dedupe = lines.filter((l) => l.isDedupe);
  /* docs/VARIANT-SPEC.md: the tester has no dedupe at all, so the have-list lid
     does not exist there rather than rendering an always-empty one. */
  const haveLid = !variant.isTester && dedupe.length > 0;

  const deck = useDeckSize(deckRef);
  /* THE BUDGET COUNTS EVERY LID, not just the aisles. The first build passed
     `groups.length` and then clipped the have-list lid off a deck with 111px to
     spare — a confession printed for room that existed. */
  const lidCount = groups.length + (haveLid ? 1 : 0);
  const budget = budgetFor(deck, lidCount, openGroup?.rows.length ?? 0);

  /* ------------------------------------------------------------ commit paths */

  const commit = useCallback((action: Action): AppState => {
    const next = reducer(modelRef.current, action);
    modelRef.current = next;
    return next;
  }, []);

  /**
   * Report to the instruments from a state the reducer has ALREADY produced —
   * this task, not the next render. The cost track is the reading a price check
   * moves, so it is the one that must not wait for React.
   */
  const report = useCallback(
    (next: AppState) => {
      const nextLines = effectiveLines(
        tripBuild(next.inventory, tripDay, next.swaps, variant),
        forcedIncludeIds
      );
      const nextColumns = shopOrder
        .map((code) => {
          const rows = buyLinesForShop(nextLines, code);
          const g = aisleGroups(rows, code, { ...costCtx, priceChecks: next.priceChecks });
          return { code, displayName: planShops[code]?.name ?? code, subtotal: g.reduce((s, x) => s + x.subtotal, 0), lines: rows.length };
        })
        .filter((c) => c.lines > 0);
      for (const index of trackIndices(nextColumns)) {
        costRef.current?.report(index.code, index.pct);
      }
    },
    [costCtx, forcedIncludeIds, shopOrder, tripDay, variant]
  );

  const savePrice = useCallback(
    (ingId: string, price: number) => {
      const action: Action = { type: "priceChecks/set", ingId, price };
      const next = commit(action); // 1 · semantic, this task
      report(next); // 2 · the instruments, this task
      cue("confirm"); // 3 · II.5.7 — only once a real consequence has landed
      dispatch(action); // 4 · the request to re-render
    },
    [commit, dispatch, report]
  );

  /* ---------------------------------------------------------------- movement */

  /** Report the position window inline, so the index starts travelling at the
      input rather than at the next render. */
  const reportPosition = useCallback(
    (lidId: string | null) => {
      posRef.current?.report("pos", positionOf(live, lidId).pct);
    },
    [live]
  );

  const openLidAt = useCallback(
    (index: number) => {
      const target = allLids[index];
      if (!target) return;
      if (target.code !== seated?.code) setSeated(target.code);
      setOpenLid(target.id);
      reportPosition(target.id);
    },
    [allLids, reportPosition, seated?.code, setOpenLid, setSeated]
  );

  const currentLidIndex = allLids.findIndex((l) => l.id === effectiveLid);

  const stepLid = useCallback(
    (direction: 1 | -1) => {
      if (allLids.length === 0) return;
      const at = currentLidIndex < 0 ? 0 : currentLidIndex;
      openLidAt(Math.min(allLids.length - 1, Math.max(0, at + direction)));
    },
    [allLids.length, currentLidIndex, openLidAt]
  );

  /** The fine crown may NOT touch the coarse choice: it steps aisles WITHIN the
      seated station and stops at that station's hard ends (section 3). */
  const stepAisle = useCallback(
    (direction: 1 | -1) => {
      if (groups.length === 0) return;
      const at = Math.max(0, groups.findIndex((g) => g.id === effectiveLid));
      const next = groups[Math.min(groups.length - 1, Math.max(0, at + direction))];
      if (!next) return;
      setOpenLid(next.id);
      reportPosition(next.id);
    },
    [effectiveLid, groups, reportPosition, setOpenLid]
  );

  const stepNominee = useCallback(
    (direction: 1 | -1) => {
      const list = padRows.map((r) => r.el.line.ingId);
      if (list.length === 0) return;
      const at = Math.max(0, list.indexOf(activeNominee ?? list[0]));
      setActiveNominee(list[Math.min(list.length - 1, Math.max(0, at + direction))]);
    },
    [activeNominee, padRows, setActiveNominee]
  );

  const seat = useCallback(
    (code: string) => {
      setSeated(code);
      const first = live.find((c) => c.code === code)?.groups[0]?.id ?? null;
      setOpenLid(first);
      reportPosition(first);
    },
    [live, reportPosition, setOpenLid, setSeated]
  );

  /* ----------------------------------------------------------------- arbiter */

  const arbiter = arbiterFor("shop", state, now, { tripDay });
  const rank1 = arbiter.rank1;

  const activateArbiter = useCallback(() => {
    if (!rank1) return;
    if (rank1.kind === "verify-nominee") {
      setActiveNominee(rank1.target?.id ?? rank1.id);
      setReconcileOpen(true);
      return;
    }
    if (rank1.kind === "over-band" || rank1.kind === "timer-due") {
      /* not this screen's business — hand off rather than swallow the duty */
      if (rank1.target) window.location.hash = `#/${rank1.target.screen}`;
      return;
    }
    if (rank1.target && rank1.target.screen !== "shop") {
      window.location.hash = `#/${rank1.target.screen}`;
      return;
    }
    setSendOpen(true);
  }, [rank1, setActiveNominee, setReconcileOpen, setSendOpen]);

  /* ---------------------------------------------------------------- envelope */

  const buyCount = live.reduce((n, c) => n + c.rows.length, 0);
  const envelope = useMemo(() => {
    if (buyCount === 0) return null;
    return buildEnvelope(tripMeta.tripId, tripMeta.createdOn, kind, lines, trip.verifyNominees);
  }, [buyCount, kind, lines, trip.verifyNominees, tripMeta]);

  /* ------------------------------------------------------------------ groups */

  const omitted = omissions();
  const wasteTotal = monthlyWasteTotal(state.waste, londonDateIso(now).slice(0, 7));

  const registerGroups: RegisterGroup[] = groups.map((group) => ({
    id: group.id,
    label: group.aisle,
    limit: budget.rows,
    lidSlot: (
      <span className="shop-lid-slot">
        <span>
          <b>{group.costed}</b>/{group.rows.length} costed
        </span>
        <span>
          £<b>{money(group.subtotal)}</b>
        </span>
      </span>
    ),
    items: group.rows.map((el) => () => (
      <CostRow key={el.line.ingId} el={el} reading={costReading(el, costCtx)} />
    )),
  }));

  /* The have-list, as one more lid rather than as a second list below the
     register: it is part of the same trip and R7 gives the screen exactly one
     open section. */
  if (haveLid) {
    registerGroups.push({
      id: "@have",
      label: "already got · skip",
      limit: budget.rows,
      lidSlot: <span className="shop-lid-slot">not costed</span>,
      items: dedupe.map((el) => () => (
        <div key={el.line.ingId} className="shop-row" data-shop-cost="have" data-shop-costed="false">
          <span className="shop-mark" aria-hidden="true" />
          <span className="shop-identity">
            <span className="shop-name" title={el.line.product}>
              {el.line.name}
            </span>
            <span className="shop-qty">on the shelf</span>
          </span>
          <span className="shop-price">—</span>
          <span className="shop-delta">—</span>
          <PressKey
            className="shop-cap-key"
            sound="none"
            cap="buy anyway"
            onPress={() =>
              setForcedIncludeIds((prev) => {
                const next = new Set(prev);
                next.add(el.line.ingId);
                return next;
              })
            }
          />
        </div>
      )),
    });
  }

  /* R7's SECOND clip: the lid column is bounded by the deck just as the row list
     is, and a lid cut in half by `overflow: hidden` is the fade curtain II.6.24
     forbids. The open lid is always kept; the remainder is printed as a figure. */
  const openIndex = registerGroups.findIndex((g) => g.id === effectiveLid);
  let shownGroups = registerGroups;
  if (registerGroups.length > budget.lids) {
    const start =
      openIndex < budget.lids
        ? 0
        : Math.min(openIndex - budget.lids + 1, registerGroups.length - budget.lids);
    shownGroups = registerGroups.slice(Math.max(0, start), Math.max(0, start) + budget.lids);
  }
  const hiddenLids = registerGroups.length - shownGroups.length;
  const hiddenLidRows = registerGroups
    .filter((g) => !shownGroups.includes(g))
    .reduce((n, g) => n + g.items.length, 0);

  const offset = orbitOffset(orbit);
  const horizonWord = horizon ? "horizon · basket reconciled" : `${reading.uncosted} not yet costed`;


  return (
    <section
      className="shop"
      data-cd-language="tangent-horizon"
      data-shop-trophy={trophy ? "true" : "false"}
      data-shop-horizon={horizon ? "true" : "false"}
      style={
        {
          "--shop-orbit-x": `${offset.x}px`,
          "--shop-orbit-y": `${offset.y}px`,
        } as React.CSSProperties
      }
    >
      <div className="shop-frame">
        <Plinth
          ref={costRef}
          total={reading.total}
          kind={kindLabel(tripDay, variant.isTester)}
          census={reading}
          indices={indices}
          age={sheetAge}
          pricedOn={pricedOn}
          wasted={wasteTotal}
          onRecover={openRecovery}
          /* II.6.11 — micro-etch is TEXTURE: it repeats what a functional label
             already states at or above the floor and never carries a fact alone.
             The sheet's date, its age, its threshold and the month's binned
             value moved onto the plate at the label step; what is left here is
             the trip's own id, which the send tray prints at 0.8125rem. */
          etch={`fd-5 · shop · ${tripMeta.tripId}`}
          trophy={trophy}
        />

        <HorizonBand
          ref={posRef}
          position={position}
          positionLabel={
            position.span > 0
              ? `register position — lines ${position.first} to ${position.first + position.span - 1} of ${position.total}`
              : `register position — every lid shut, ${position.total} lines on this trip`
          }
          tripSeats={
            variant.isTester
              ? []
              : [
                  { value: "0", word: "full shop" },
                  { value: "7", word: "day-7" },
                ]
          }
          tripValue={tripTab}
          onTrip={(next) => {
            setTripTab(next);
            setOpenLid(FIRST_LID);
          }}
          aisleLabel={openGroup?.aisle ?? "no aisle open"}
          aisleFigure={
            openGroup ? `${openGroup.costed}/${openGroup.rows.length} costed` : `${groups.length} lids`
          }
          aisleError={openGroup ? openGroup.errorDeg : ringError(0, 0)}
          onAisleStep={stepAisle}
          onFirst={() => openLidAt(0)}
          onPrev={() => stepLid(-1)}
          onLift={() => {
            setOpenLid(null);
            reportPosition(null);
          }}
          onNext={() => stepLid(1)}
          onLast={() => openLidAt(allLids.length - 1)}
          liftDisabled={effectiveLid === null}
          stationSeats={live.map((c) => ({
            value: c.code,
            word: SEAT_WORD[c.code] ?? c.code.toLowerCase(),
            figure: `${c.rows.length}`,
          }))}
          stationValue={seated?.code ?? ""}
          onStation={seat}
          reconcileLabel="reconcile"
          reconcileFigure={`${reading.costed}/${reading.lines} costed`}
          /* The ring reports what the pad can actually change: the whole
             basket's costed state. The arbiter's nominees are a PRIORITY inside
             the pad, not a lock, so they never drive this ring. */
          reconcileError={ringError(reading.costed, reading.lines)}
          onReconcileStep={stepNominee}
          onReconcileOpen={openRecovery}
          onSend={() => setSendOpen(true)}
          sendControls="shop-send-tray"
          sendOpen={sendOpen}
          horizonWord={horizonWord}
          seamBreak={seamBreak(reading)}
          trophy={trophy}
        />

        <div className="shop-deck">
          {!trophy && (
            <div className="shop-duty" data-shop-duty={rank1?.kind ?? "idle"}>
              <span className="shop-duty-text">
                {rank1 ? rank1.text : "trip built · nothing else needs attention"}
              </span>
              <span className="shop-duty-queue">
                {arbiter.queued > 0 ? `${arbiter.queued} behind` : "queue clear"}
              </span>
              {rank1 && (
                <PressKey className="shop-cap-key" sound="none" cap="act" onPress={activateArbiter} />
              )}
            </div>
          )}

          <div className="shop-register-mount">
            {/*
              THE BAY IS WHAT IS MEASURED, not the mount. The mount also holds
              the confession line at the foot, and measuring it made R7's own
              clip believe it had room the register never got: at 390x844 two
              lids ran off the bottom under `overflow: hidden` and said nothing,
              which is the fade curtain II.6.24 forbids, dressed as a budget.
            */}
            <div className="shop-register-bay" ref={deckRef}>
            {trophy ? (
              <TrophyRead
                lines={reading.lines}
                costed={reading.costed}
                priceAge={sheetAge}
                verifiedOn={pricedOn}
                duty={rank1?.text ?? null}
                horizon={horizon}
              />
            ) : buyCount === 0 ? (
              <Enclosure variant="well" className="shop-empty" role="note" surface="data">
                <Escutcheon as="p" className="shop-empty-title">
                  stocked up
                </Escutcheon>
                <p className="shop-note">
                  everything this {kindLabel(tripDay, variant.isTester)} needs is already covered by
                  what is on the shelf. nothing to buy, nothing to send.
                </p>
              </Enclosure>
            ) : (
              <div ref={registerRef}>
                <Register
                  groups={shownGroups}
                  openId={effectiveLid}
                  onOpenChange={(next) => {
                    setOpenLid(next);
                    reportPosition(next);
                  }}
                  label="aisles"
                  overflowWord="still to check"
                  className="shop-register"
                />
              </div>
            )}

            </div>

            {!trophy && (
              <p className="shop-lid-overflow">
                {hiddenLids > 0 && (
                  <span>
                    <b className="cd-overflow-count cd-data">{hiddenLids}</b>{" "}
                    {hiddenLids === 1 ? "aisle" : "aisles"} not shown · {hiddenLidRows} lines ·{" "}
                  </span>
                )}
                <span title={omitted.pantry.join(", ")}>
                  <b className="cd-overflow-count cd-data">{omitted.pantry.length}</b> assumed already
                  in the cupboard · <b className="cd-overflow-count cd-data">{omitted.freebies}</b>{" "}
                  seasonings never costed
                </span>
                {/* docs/VARIANT-SPEC.md: "render a note saying so". Kept to one
                    clause, because on a 390px deck every line this note takes is
                    a line the register does not get. */}
                {variant.isTester && (
                  <span title="the tester trip is the authored Morrisons receipt verbatim: an on-ramp first shop, deliberately not deduped against what is already in stock">
                    on-ramp first shop · nothing skipped against the shelf
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      <ReconcileTray
        id="shop-reconcile-tray"
        open={reconcileOpen}
        onClose={() => setReconcileOpen(false)}
        rows={padRows}
        done={padDone}
        priceChecks={state.priceChecks}
        onSave={savePrice}
        activeId={activeNominee}
        tester={variant.isTester}
      />

      <SendTray
        id="shop-send-tray"
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        envelope={envelope}
      />
    </section>
  );
}
