// LIST — till odometer (PLAN §6.9 / D7). Route: #/list, trip arrives via
// "#/list?t=<lz-string>" (see tripIntake.ts for why that URL form needs a
// screen-local workaround around a router gap — flagged in the build
// report). Phase 2 wave 2 (docs/PHASE2-CONTRACT.md): this folder is
// self-contained — no other screen folder imports from it, and it imports
// only components/engine/state/data, never another screen.
import { useEffect, useMemo, useRef, useState } from "react";
import type { SceneProps } from "../../app/router";
import { useStore } from "../../state/store";
import { useNow } from "../../state/useNow";
import { arbiterFor } from "../../engine/arbiter";
import { ArbiterSlot } from "../../components/ArbiterSlot";
import type { TripEnvelope, TripRow } from "../../engine/tripCodec";
import { resolveInitialTrip } from "./tripIntake";
import {
  activeVerifyIngId,
  allTicked as tripAllTicked,
  findRowAndShop,
  gotCounts,
  groupByAisle,
  inferTripDayFromKind,
  isTicked,
  kindLabel,
  marketShop as pickMarketShop,
  paddleShops,
  spentSoFarPence,
} from "./model";
import { AisleSection } from "./AisleSection";
import { ThumbBar } from "./ThumbBar";
import { NumericPad } from "./NumericPad";
import { TripSummary } from "./TripSummary";
import { useReducedMotion } from "./useReducedMotion";
import "./list.css";

type PaneMode = "shop" | "market";
type ViewMode = "list" | "summary";

export default function ListScene(_props: SceneProps) {
  const { state, dispatch } = useStore();
  const reducedMotion = useReducedMotion();

  // Resolved exactly once (fragment -> localStorage fallback) — see
  // tripIntake.ts. Trip content is static for the life of this mount; only
  // ticks/priceChecks (global store) change afterward.
  const [trip] = useState<TripEnvelope | null>(() => resolveInitialTrip());

  // Shared clock (src/state/useNow.ts, wave-1 integration review promotion
  // of what used to be four byte-identical per-screen copies) — 60s cadence
  // matches SHOP's own usage of it, the closest sibling screen.
  const now = useNow(60_000);

  const shopsForPaddle = useMemo(() => (trip ? paddleShops(trip) : []), [trip]);
  const marketShopObj = useMemo(() => (trip ? pickMarketShop(trip) : null), [trip]);

  const [activeShopCode, setActiveShopCode] = useState<string | null>(() => shopsForPaddle[0]?.code ?? null);
  const [paneMode, setPaneMode] = useState<PaneMode>(() => (shopsForPaddle.length === 0 && marketShopObj ? "market" : "shop"));
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [verifyRow, setVerifyRow] = useState<TripRow | null>(null);

  // Tick-settle grace (PLAN §6.9: "~1s undo grace... reduced-motion: instant
  // reorder, no animation"): a ticked ingId only sinks below its aisle's
  // unticked rows once it's in this set. Reduced motion adds it immediately
  // (no timer at all, no wait) — see handleToggleTick.
  const [settled, setSettled] = useState<Set<string>>(() => new Set());
  const settleTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const timers = settleTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  function registerRowEl(ingId: string, el: HTMLButtonElement | null) {
    if (el) rowRefs.current.set(ingId, el);
    else rowRefs.current.delete(ingId);
  }

  const activeShop = shopsForPaddle.find((s) => s.code === activeShopCode) ?? shopsForPaddle[0] ?? null;
  const displayedShop = paneMode === "market" ? marketShopObj : activeShop;

  const tripId = trip?.tripId ?? "";
  const ticks = tripId ? state.shopTicks[tripId] : undefined;

  const allDone = trip ? tripAllTicked(trip, ticks) : false;
  // Auto-open the summary the moment every row is ticked (PLAN: "all ticked
  // OR explicit `close trip` button"). Fires only on the false->true
  // transition, not on every render, and never re-fires the OTHER way (a
  // later untick doesn't yank the user back out of a summary they're
  // reading) — see this file's header doc for the "back to list" flow.
  useEffect(() => {
    if (allDone && viewMode === "list") setViewMode("summary");
  }, [allDone]);

  function handleToggleTick(row: TripRow) {
    if (!tripId) return;
    const ticked = isTicked(ticks, row.ingId);
    if (ticked) {
      dispatch({ type: "shopTicks/untick", tripId, ingId: row.ingId });
      const t = settleTimers.current.get(row.ingId);
      if (t) {
        clearTimeout(t);
        settleTimers.current.delete(row.ingId);
      }
      setSettled((prev) => {
        if (!prev.has(row.ingId)) return prev;
        const next = new Set(prev);
        next.delete(row.ingId);
        return next;
      });
      return;
    }
    dispatch({ type: "shopTicks/tick", tripId, ingId: row.ingId });
    if (reducedMotion) {
      setSettled((prev) => (prev.has(row.ingId) ? prev : new Set(prev).add(row.ingId)));
      return;
    }
    const timer = setTimeout(() => {
      setSettled((prev) => new Set(prev).add(row.ingId));
      settleTimers.current.delete(row.ingId);
    }, 1000);
    settleTimers.current.set(row.ingId, timer);
  }

  function openVerifyForRow(row: TripRow, shopCode: string) {
    if (marketShopObj && shopCode === marketShopObj.code) setPaneMode("market");
    else {
      setPaneMode("shop");
      setActiveShopCode(shopCode);
    }
    setVerifyRow(row);
  }

  function handleSubmitVerify(ingId: string, price: number) {
    dispatch({ type: "priceChecks/set", ingId, price });
    setVerifyRow(null);
  }

  function handleNextAisle() {
    const rows = displayedShop?.rows ?? [];
    for (const group of groupByAisle(rows)) {
      const target = group.rows.find((r) => !isTicked(ticks, r.ingId));
      if (target) {
        const el = rowRefs.current.get(target.ingId);
        el?.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
        el?.focus();
        return;
      }
    }
  }

  const tripDay = trip ? inferTripDayFromKind(trip.kind) : undefined;
  const arbiter = arbiterFor("list", state, now, tripDay !== undefined ? { tripDay } : {});
  const rank1 = arbiter.rank1;

  function handleArbiterActivate() {
    if (!rank1) return;
    if (rank1.kind === "verify-nominee" && trip) {
      const found = findRowAndShop(trip, rank1.id);
      if (found) {
        openVerifyForRow(found.row, found.shop.code);
        return;
      }
    }
    if (rank1.kind === "primary-action" && rank1.target?.screen === "list") {
      handleNextAisle();
      return;
    }
    if (rank1.target) window.location.hash = `#/${rank1.target.screen}`;
  }

  // Migrated to the preferred `rank1` API (wave-1 integration review: every
  // screen renders exactly ONE <ArbiterSlot>, ALWAYS — idle state shows a
  // quiet "nothing else needs attention" panel instead of disappearing).
  // Built once and spread into all three of this screen's return branches
  // below so the idle/queue/activate wiring can't drift between them.
  const arbiterSlotProps = {
    rank1: rank1 ? { text: rank1.text, actionLabel: "act →", onActivate: handleArbiterActivate } : null,
    count: arbiter.queued,
    idleText: "nothing else needs attention",
  };

  if (!trip) {
    return (
      <section className="scr-list">
        <ArbiterSlot {...arbiterSlotProps} />
        <div className="scr-list-empty" role="note">
          <p className="scr-list-empty-title">no trip loaded</p>
          <p className="scr-list-empty-body">build one at the desk on SHOP</p>
        </div>
      </section>
    );
  }

  if (viewMode === "summary") {
    return (
      <section className="scr-list">
        <ArbiterSlot {...arbiterSlotProps} />
        <TripSummary trip={trip} ticks={ticks} priceChecks={state.priceChecks} onBack={() => setViewMode("list")} />
      </section>
    );
  }

  const activeVerify = activeVerifyIngId(trip, state.priceChecks);
  const { got, total } = gotCounts(trip, ticks);
  const spent = spentSoFarPence(trip, ticks, state.priceChecks);
  const aisleGroups = displayedShop ? groupByAisle(displayedShop.rows) : [];
  const nextDisabled = !(displayedShop?.rows ?? []).some((r) => !isTicked(ticks, r.ingId));

  return (
    <section className="scr-list">
      <ArbiterSlot {...arbiterSlotProps} />

      <header className="scr-list-header">
        <p className="scr-list-header-kicker">{kindLabel(trip.kind)}</p>
        <div className="scr-list-header-actions">
          {marketShopObj && (
            <button
              type="button"
              className="fd5-control scr-list-market-toggle"
              onClick={() => setPaneMode((m) => (m === "market" ? "shop" : "market"))}
            >
              {paneMode === "market" ? <>{"‹"} shops</> : <>market ticket ▸</>}
            </button>
          )}
          <button type="button" className="fd5-control scr-list-close-trip" onClick={() => setViewMode("summary")}>
            close trip
          </button>
        </div>
      </header>

      <div className="scr-list-body">
        {aisleGroups.length === 0 && (
          <p className="scr-list-empty-body scr-list-empty-body--inline">nothing in this pane.</p>
        )}
        {aisleGroups.map((group, i) => (
          <AisleSection
            key={group.aisle}
            shopLabel={i === 0 && displayedShop ? displayedShop.name : null}
            aisle={group.aisle}
            rows={group.rows}
            ticks={ticks}
            settled={settled}
            activeVerifyIngId={activeVerify}
            priceChecks={state.priceChecks}
            reducedMotion={reducedMotion}
            onToggleTick={handleToggleTick}
            onOpenVerify={(row) => setVerifyRow(row)}
            registerEl={registerRowEl}
          />
        ))}
      </div>

      <ThumbBar
        paddleShops={shopsForPaddle}
        activeShopCode={activeShopCode}
        onToggleShop={() => {
          setPaneMode("shop");
          setActiveShopCode((code) => shopsForPaddle.find((s) => s.code !== code)?.code ?? code);
        }}
        pence={spent}
        got={got}
        total={total}
        onNext={handleNextAisle}
        nextDisabled={nextDisabled}
      />

      <NumericPad row={verifyRow} onClose={() => setVerifyRow(null)} onSubmit={handleSubmitVerify} />
    </section>
  );
}
