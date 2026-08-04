// LIST — till odometer (PLAN §6.9 / D7). Route: #/list, trip arrives via
// "#/list?t=<lz-string>" — router.ts parses the query string and hands it to
// us as `route.query`; see tripIntake.ts's resolveInitialTrip() for the
// decode/cache logic. Phase 2 wave 2 (docs/PHASE2-CONTRACT.md): this folder
// is self-contained — no other screen folder imports from it, and it imports
// only components/engine/state/data, never another screen.
import { useEffect, useMemo, useRef, useState } from "react";
import type { SceneProps } from "../../app/router";
import { useStore } from "../../state/store";
import { useNow } from "../../state/useNow";
import { arbiterFor, type ArbiterDuty } from "../../engine/arbiter";
import { ArbiterSlot } from "../../components/ArbiterSlot";
import type { TripEnvelope, TripRow } from "../../engine/tripCodec";
import type { PriceChecks } from "../../state/types";
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
import { useReducedMotion } from "../../state/useReducedMotion";
import "./list.css";

type PaneMode = "shop" | "market";
type ViewMode = "list" | "summary";

/**
 * Guard the arbiter's rank1 against the loaded trip envelope (final review
 * item 2 — "the one live break in the whole-app loop test"). arbiterFor()'s
 * verify-nominee candidate comes from a LIVE tripBuild() against this
 * device's CURRENT inventory (engine/arbiter.ts), never from the trip
 * envelope this screen actually has loaded — those two can legitimately
 * disagree (e.g. an item was deduped out of the trip at the desk against a
 * different inventory snapshot, but the phone's live inventory still
 * qualifies it for a verify nomination today). Left unguarded, the slot
 * would show a DIFFERENT item than this screen's own [verify] chip
 * (`activeVerifyIngId`, used below for the row-level chip) — self-
 * disagreement on one screen — and its "act ->" would fall through to
 * arbiter.ts's verify-nominee `target: { screen: "shop" }`, sending the
 * shopper to #/shop mid-store.
 *
 * Fix: a verify-nominee rank1 is only trusted as-is when its ingId is
 * actually a verify-flagged row of THIS envelope. Otherwise it's replaced
 * with the envelope's own current nominee — the exact same ingId
 * `activeVerifyIngId` already gives the row-level chip — so the slot and
 * chip can never disagree, and the substituted duty carries no `target` at
 * all (handleArbiterActivate below resolves it via `findRowAndShop`, a row
 * guaranteed to exist in the loaded trip, never via a screen hop). If the
 * envelope has no outstanding nominee of its own to substitute, the
 * candidate is dropped entirely (falls to idle) rather than ever letting a
 * mismatched verify-nominee's `target` carry this screen away from LIST.
 */
function resolveListRank1(rank1: ArbiterDuty | null, trip: TripEnvelope | null, priceChecks: PriceChecks): ArbiterDuty | null {
  if (!rank1 || !trip || rank1.kind !== "verify-nominee") return rank1;

  const nominated = findRowAndShop(trip, rank1.id);
  if (nominated && nominated.row.verify) return rank1; // matches this envelope's own verify rows — trustworthy as-is

  const ownIngId = activeVerifyIngId(trip, priceChecks);
  if (!ownIngId) return null; // nothing of THIS trip's own to substitute — idle, never a stale/foreign nominee
  const own = findRowAndShop(trip, ownIngId);
  if (!own) return null;
  return { kind: "verify-nominee", id: ownIngId, text: `verify price · ${own.row.label}` };
}

export default function ListScene({ route }: SceneProps) {
  const { state, dispatch } = useStore();
  const reducedMotion = useReducedMotion();

  // Resolved exactly once (fragment -> localStorage fallback) — see
  // tripIntake.ts. Trip content is static for the life of this mount; only
  // ticks/priceChecks (global store) change afterward.
  const [trip] = useState<TripEnvelope | null>(() => resolveInitialTrip(route.query));

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
  // resolveListRank1 (above): never trust arbiterFor()'s verify-nominee at
  // face value while a trip is loaded — it's computed from LIVE inventory,
  // not from the trip envelope this screen actually has.
  const rank1 = resolveListRank1(arbiter.rank1, trip, state.priceChecks);

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
    // Belt-and-suspenders (final review item 2, stated explicitly): LIST
    // must NEVER hand off to #/shop while a trip is active. resolveListRank1
    // already guarantees a verify-nominee rank1 reaching this point always
    // has a matching row (so the branch above always returns first) — this
    // guard covers any other future rank1 kind that might carry a "shop"
    // target so that invariant can't quietly regress.
    if (rank1.target) {
      if (trip && rank1.target.screen === "shop") return;
      window.location.hash = `#/${rank1.target.screen}`;
    }
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
