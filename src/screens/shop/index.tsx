// SHOP — the Saturday console (PLAN §6.8 / D7). Desktop-first: three costed
// columns (Morrisons / Sainsbury's / market ticket), a rolling trip strategy
// (full shop vs day-7 top-up), have-list dedupe rows for what's already in
// stock, price-verify nominations, a waste-cost readout, alternatives where
// the data carries one, and the send-to-phone hero (PLAN §6.10).
//
// Phase 2 wave 2 (docs/PHASE2-CONTRACT.md): this folder is self-contained —
// no other screen folder imports from it, and it imports only
// components/engine/state/data, never another screen.
//
// KEY FACT (src/state/selectors.ts module doc, repeated here because it's
// easy to get wrong): tripBuild() always reads Week A's plan — the
// executing fortnight is Week A, twice (D5) — independent of prefs.week
// (PLAN/MEAL's own browsing toggle for Week B).
import { useMemo, useRef, useState } from "react";
import type { SceneProps } from "../../app/router";
import { ArbiterSlot } from "../../components/ArbiterSlot";
import { Paddle } from "../../components/Paddle";
import { arbiterFor } from "../../engine/arbiter";
import { makeTripId, type TripKind } from "../../engine/tripCodec";
import { activeVariant } from "../../data/variant";
import { tripBuild, type TripDay } from "../../state/selectors";
import { londonDateIso } from "../../state/london";
import { useStore } from "../../state/store";
import { HaveList } from "./HaveList";
import { Reconcile } from "./Reconcile";
import { ShopColumn } from "./ShopColumn";
import { SendToPhoneKey } from "./SendToPhoneKey";
import { buildEnvelope, buyLinesForShop, effectiveLines, monthlyWasteTotal, overallTotal, shopSubtotal, SHOP_ORDER } from "./tripHelpers";
import { planShops } from "../../data";
import { useNow } from "../../state/useNow";
import "./shop.css";

export default function ShopScreen(_props: SceneProps) {
  const { state, dispatch } = useStore();
  const now = useNow(60_000); // SHOP's existing cadence (state/useNow.ts default is 30s)
  const variant = activeVariant(state);

  const [tripDay, setTripDay] = useState<TripDay>(0);
  const [forcedIncludeIds, setForcedIncludeIds] = useState<Set<string>>(new Set());
  const [phoneKeyOpen, setPhoneKeyOpen] = useState(false);
  // docs/VARIANT-SPEC.md: "no day-7 toggle in tester mode" — the tester has
  // exactly one trip (the authored basket), not a day-0/day-7 split.
  const effectiveTripDay: TripDay = variant.isTester ? 0 : tripDay;

  const heroContainerRef = useRef<HTMLDivElement | null>(null);
  const verifyInputRefs = useRef(new Map<string, HTMLInputElement>());

  // Trip identity is stable for as long as the shopper is looking at the SAME
  // day-0/day-7 pass — toggling the paddle IS building a different trip, so a
  // fresh id/timestamp is exactly right there. Contract: "deterministic per
  // build call is fine" — this doesn't need to change on every unrelated
  // re-render (e.g. an inventory tick), only when the trip itself changes.
  const tripMeta = useMemo(() => ({ tripId: makeTripId(now), createdOn: now.toISOString() }), [effectiveTripDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const trip = useMemo(
    () => tripBuild(state.inventory, effectiveTripDay, state.swaps, variant),
    [state.inventory, effectiveTripDay, state.swaps, variant]
  );
  const lines = useMemo(() => effectiveLines(trip, forcedIncludeIds), [trip, forcedIncludeIds]);

  const kind: TripKind = effectiveTripDay === 0 ? "full" : "day7";
  // docs/VARIANT-SPEC.md: "single Morrisons column" in tester mode — every
  // tester basket line already carries shop "M" (see selectors.ts's
  // buildTesterTrip), so restricting SHOP_ORDER to just "M" collapses the
  // usual three-column layout down to one without any other code changing.
  const shopOrder = variant.isTester ? (["M"] as const) : SHOP_ORDER;
  const columns = shopOrder.map((code) => ({
    code,
    displayName: planShops[code]?.name ?? code,
    rows: buyLinesForShop(lines, code),
    subtotal: shopSubtotal(lines, code),
  }));
  const total = overallTotal(lines);
  const buyLineCount = columns.reduce((n, c) => n + c.rows.length, 0);
  const estimateCount = columns.reduce((n, c) => n + c.rows.filter((l) => l.line.estimate).length, 0);
  const verifyOutstanding = trip.verifyNominees.filter((id) => !state.priceChecks[id]);
  const verifyNomineeSet = new Set(trip.verifyNominees);

  const envelope = useMemo(() => {
    if (buyLineCount === 0) return null;
    return buildEnvelope(tripMeta.tripId, tripMeta.createdOn, kind, lines, trip.verifyNominees);
  }, [lines, trip.verifyNominees, tripMeta, kind, buyLineCount]);

  const arbiter = arbiterFor("shop", state, now, { tripDay: effectiveTripDay });
  const rank1 = arbiter.rank1;

  function handleIncludeAnyway(ingId: string) {
    setForcedIncludeIds((prev) => {
      const next = new Set(prev);
      next.add(ingId);
      return next;
    });
  }

  function handleVerifyRegister(ingId: string, el: HTMLInputElement | null) {
    if (el) verifyInputRefs.current.set(ingId, el);
    else verifyInputRefs.current.delete(ingId);
  }

  function handleArbiterActivate() {
    const target = rank1?.target;
    if (!target) return;
    if (target.screen !== "shop") {
      window.location.hash = `#/${target.screen}`;
      return;
    }
    if (rank1?.kind === "verify-nominee" && target.id) {
      const el = verifyInputRefs.current.get(target.id);
      el?.scrollIntoView({ block: "center" });
      el?.focus();
      return;
    }
    setPhoneKeyOpen(true);
    heroContainerRef.current?.scrollIntoView({ block: "center" });
  }

  const monthIso = londonDateIso(now).slice(0, 7);
  const wasteTotal = monthlyWasteTotal(state.waste, monthIso);

  return (
    <section className="scr-shop">
      <ArbiterSlot
        rank1={rank1 ? { text: rank1.text, actionLabel: "go", onActivate: handleArbiterActivate } : null}
        count={arbiter.queued}
        idleText="trip built · nothing else needs attention"
      />

      <header className="scr-shop-header">
        <h1 className="scr-shop-title">shop</h1>
        <p className="scr-shop-status">
          {variant.isTester ? "morrisons starter" : kind === "full" ? "full shop" : "day-7 top-up"} · {buyLineCount} line
          {buyLineCount === 1 ? "" : "s"} to buy
          {estimateCount > 0 && ` · ${estimateCount} estimated`}
          {verifyOutstanding.length > 0 && ` · ${verifyOutstanding.length} to verify`}
        </p>
        {/* docs/VARIANT-SPEC.md: "note rendered saying so" — the tester trip
            is an on-ramp first shop, deliberately not deduped against stock. */}
        {variant.isTester && (
          <p className="scr-shop-tester-note" role="note">
            one retailer, {trip.lines.length} lines, verified prices — this is the tester's own first shop, so nothing here
            is skipped against what's already on the shelf.
          </p>
        )}
      </header>

      <div className="scr-shop-console">
        {/* docs/VARIANT-SPEC.md: "no day-7 toggle in tester mode" — the
            tester has exactly one trip, so the paddle simply doesn't render. */}
        {!variant.isTester && (
          <Paddle
            name="trip"
            checked={tripDay === 7}
            optionA={{ value: "0", label: "full shop" }}
            optionB={{ value: "7", label: "day-7 top-up" }}
            onToggle={() => setTripDay((d) => (d === 0 ? 7 : 0))}
          />
        )}
        <SendToPhoneKey envelope={envelope} open={phoneKeyOpen} onOpenChange={setPhoneKeyOpen} containerRef={(el) => (heroContainerRef.current = el)} />
      </div>

      {buyLineCount === 0 ? (
        <div className="scr-shop-empty" role="note">
          <p className="scr-shop-empty-title">stocked up</p>
          <p className="scr-shop-empty-body">
            everything this {kind === "full" ? "full shop" : "day-7 top-up"} trip needs is already covered by what's on the
            shelf — nothing to buy.
          </p>
        </div>
      ) : (
        <div className="scr-shop-columns">
          {columns.map((col) => (
            <ShopColumn
              key={col.code}
              displayName={col.displayName}
              rows={col.rows}
              subtotal={col.subtotal}
              verifyNominees={verifyNomineeSet}
              priceChecks={state.priceChecks}
              market={col.code === "X"}
              // Fable review FIX round: the tester basket renders the source
              // document verbatim — no canonical "— alt: …" note grafted on.
              suppressAlternativeNote={variant.isTester}
            />
          ))}
        </div>
      )}

      <p className="scr-shop-total" aria-label={`overall total £${total.toFixed(2)}`}>
        <span className="scr-shop-total-label">overall</span>
        <span className="scr-shop-total-figure">£{total.toFixed(2)}</span>
      </p>

      {/* docs/VARIANT-SPEC.md: "no have-list dedupe" — the tester trip never
          produces dedupe rows (haveG is always 0 on an authored line), so
          the section is hidden outright rather than rendering an
          always-empty "nothing to skip" list. */}
      {!variant.isTester && <HaveList lines={lines} inventory={state.inventory} onIncludeAnyway={handleIncludeAnyway} />}

      <p className="scr-shop-waste">
        this month · £{wasteTotal.toFixed(2)} binned
      </p>

      <Reconcile
        verifyNominees={trip.verifyNominees}
        lines={lines}
        priceChecks={state.priceChecks}
        onSave={(ingId, price) => dispatch({ type: "priceChecks/set", ingId, price })}
        registerEl={handleVerifyRegister}
      />
    </section>
  );
}
