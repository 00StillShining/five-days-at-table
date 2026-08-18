/**
 * src/screens/list/index.tsx — LIST, in 20 IRREDUCIBLE.
 *
 * THE QUESTION THIS SCREEN ANSWERS: what do I pick up next, and what will the
 * till say?
 *
 * It is answered by six hero-grade instruments, which is the NORMAL condition
 * here and not a budget breach (CORRECTIONARY 3.1). Each one's job, in one
 * sentence — the exit test CD-BRIEF ruling 4's re-authored Refined rung sets:
 *
 *   HEAD PLATE     which trip, which building, and the one duty competing for
 *                  the hand right now.
 *   TILL           what the till will say, as a filled column plus the exact
 *                  figure at the scale's reserved top step.
 *   SEAT BAR       how much walking is left, one seat per line on the trip.
 *   STATION BAR    which of the trip's shops you are standing in, on hard stops.
 *   REGISTER       the aisle you are in, milled into one plate, one lid open.
 *   THUMB PLATE    the three consequences a thumb can reach: put back, next,
 *                  close.
 *
 * ---------------------------------------------------------------------------
 * THE SCREEN'S ONE STRUCTURAL IDEA
 * ---------------------------------------------------------------------------
 * IRREDUCIBLE's Trophy clause: "EVERY HEALTHY STATION SIMPLY IS NOT RENDERED —
 * a blank plate has nothing to report, and this language does not spend a pixel
 * proving a fact already true by absence." On a shopping list that is: a row you
 * have bought stops being rendered, an aisle you have finished stops being
 * rendered, and a station you have cleared says CLEAR on its seat. The register
 * empties itself as the trolley fills, which is why nothing on this screen
 * scrolls and why the operator never walks past what they already have.
 *
 * The recovery from that is not a hidden state: the BOUGHT lid at the foot of
 * the register holds every bought row, trip-wide, and pressing one there puts it
 * back. Absence is a report, not a deletion.
 *
 * ---------------------------------------------------------------------------
 * THE 1800ms RUN-OUT IS THE UNDO WINDOW
 * ---------------------------------------------------------------------------
 * §5 gives this language the exception II.1.15 reserves for exactly one chapter:
 * "a long progressive taper, arriving over 1800ms on the taper curve ... the
 * truth unfolding on its own declared schedule." A pressed row is bought AT ONCE
 * and stays rendered for that window with its gauge draining; the fixed-position
 * put-back key addresses it for exactly as long as the clock holds it open.
 * Nothing waits for the taper: the model changed on the release.
 *
 * ---------------------------------------------------------------------------
 * THE 16ms ACK IS STRUCTURAL (CD-BRIEF's measured performance law, binding)
 * ---------------------------------------------------------------------------
 * "A React `dispatch` alone does NOT satisfy the Floor's 16ms acknowledgement,
 * because the reducer runs during the NEXT render — the model is still stale
 * when your handler returns." `modelRef` is the model; `commit` applies the
 * frozen reducer to it inline at the input; the till and the seat bar are then
 * REPORTED TO through their own handles, before `dispatch` is called at all.
 *
 * ---------------------------------------------------------------------------
 * ONE CLOCK, AND IT IS NOT HERE
 * ---------------------------------------------------------------------------
 * The perf law's rule 4: "Isolate clocks." The only ticking reading on this
 * screen is the trip's price age, whose class threshold is fourteen days, and
 * its 60s clock lives inside Till.tsx — the one component that prints it. The
 * register is never re-rendered by a clock.
 *
 * ---------------------------------------------------------------------------
 * THE ARBITER MAY NOT CARRY A SHOPPER OUT OF THE SHOP
 * ---------------------------------------------------------------------------
 * `resolveListRank1` is kept verbatim from the previous build, because the fact
 * it guards has not changed: arbiterFor()'s verify nominee is computed from this
 * device's LIVE inventory, not from the envelope this screen has loaded, and an
 * unguarded rank 1 would both disagree with the row's own chip and fall through
 * to a `target: { screen: "shop" }` mid-store.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SceneProps } from "../../app/router";
import { useStore } from "../../state/store";
import { reducer } from "../../state/reducer";
import type { Action, AppState, PriceChecks } from "../../state/types";
import { activeVariant } from "../../data/variant";
import { arbiterFor, type ArbiterDuty } from "../../engine/arbiter";
import type { TripEnvelope, TripRow } from "../../engine/tripCodec";
import { useNow } from "../../state/useNow";
import { useOpenPanel, useOpenSection } from "../../cd/chassis";
import { Enclosure, Escutcheon, Plate, PressKey, Register, type RegisterGroup } from "../../cd/foundry";
import { cue, caution, setVoice } from "../../cd/sound/cues";
import { resolveInitialTripResult, type TripSource } from "./tripIntake";
import {
  RUNOUT_MS,
  activeVerifyIngId,
  aisleGroups,
  allRows,
  boughtRows,
  findRowAndShop,
  isBought,
  kindLabel,
  owedCount,
  stationCodeOf,
  stationsOf,
  tillReading,
} from "./model";
import { HeadPlate } from "./HeadPlate";
import { ItemRow } from "./ItemRow";
import { SeatBar, type SeatBarHandle } from "./SeatBar";
import { StationBar } from "./StationBar";
import { ThumbPlate } from "./ThumbPlate";
import { Till, type TillHandle } from "./Till";
import { VerifyPad } from "./VerifyPad";
import { CloseRead } from "./CloseRead";
import { TrophyRead } from "./TrophyRead";
import { budgetFor, useBayHeight } from "./useRowBudget";
import { useRunOut } from "./useRunOut";
import { orbitOffset, useTrophy } from "./useTrophy";
import "./list.css";

/** The sentinel the register's open lid starts on. Null means DELIBERATELY closed. */
const FIRST_LID = "@first";

/** The BOUGHT lid's own id — it is not an aisle and never collides with one. */
const BOUGHT_ID = "@bought";

function hhmm(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(date);
}

/** See the header note. Kept verbatim in behaviour from the previous build. */
function resolveListRank1(
  rank1: ArbiterDuty | null,
  trip: TripEnvelope | null,
  priceChecks: PriceChecks
): ArbiterDuty | null {
  if (!rank1 || !trip || rank1.kind !== "verify-nominee") return rank1;
  const nominated = findRowAndShop(trip, rank1.id);
  if (nominated && nominated.row.verify) return rank1;
  const ownIngId = activeVerifyIngId(trip, priceChecks);
  if (!ownIngId) return null;
  const own = findRowAndShop(trip, ownIngId);
  if (!own) return null;
  return { kind: "verify-nominee", id: ownIngId, text: `verify price · ${own.row.label}` };
}

const OFF_REASON: Record<TripSource, string> = {
  fragment: "",
  cache: "",
  "decode-failed":
    "the link this screen was opened with did not decode, and no earlier trip is cached on this device. scan the code again from the desk.",
  none: "no trip has reached this device. build one at the desk and send it to this phone.",
};

export default function ListScene({ route }: SceneProps) {
  const { state, dispatch } = useStore();
  const now = useNow(60_000);
  const variant = activeVariant(state);

  /* Resolved exactly once, synchronously, from the fragment or the offline
     cache. There is no loading state on this screen and inventing one would be
     progress theatre: decodeTrip is a pure function over a string. */
  const [resolved] = useState(() => resolveInitialTripResult(route.query));
  const trip = resolved.trip;

  /* The shadow model. Assigned every render so it is never behind the store,
     and advanced INLINE at every input so it is never behind the hand. */
  const modelRef = useRef(state);
  modelRef.current = state;

  const tillRef = useRef<TillHandle>(null);
  const seatRef = useRef<SeatBarHandle>(null);
  const bayRef = useRef<HTMLDivElement>(null);
  const registerRef = useRef<HTMLDivElement>(null);
  const overRef = useRef(false);

  const runOut = useRunOut(RUNOUT_MS);
  const { trophy, orbit } = useTrophy();

  // II.5.9 — one voice per world, claimed on arrival. Scenes unmount on
  // navigation, so each screen sets the voice it speaks in as it mounts.
  useEffect(() => setVoice("irreducible"), []);

  /* The over-run edge is a CROSSING, not a condition. Seeded once on arrival so
     opening an already-over trip does not sound a caution for a threshold that
     was crossed in a previous session. */
  useEffect(() => {
    overRef.current = trip
      ? tillReading(trip, modelRef.current.shopTicks[trip.tripId], modelRef.current.priceChecks).overP > 0
      : false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------- panel state */
  /* CD-BRIEF R6 — scenes unmount on navigation, so none of this may be a
     screen-local useState: an aisle left open survives a walk to COOK and back,
     and a reload genuinely resets it. */
  const [seatedCode, setSeated] = useOpenPanel<string | null>("station", null);
  const [openLid, setOpenLid] = useOpenSection("aisle", FIRST_LID);
  const [verifyId, setVerifyId] = useOpenPanel<string | null>("verify", null);
  const [closeOpen, setCloseOpen] = useOpenPanel<boolean>("close", false);
  const [acked, setAcked] = useOpenPanel<string | null>("ack", null);

  const tripId = trip?.tripId ?? "";
  const ticks = tripId ? state.shopTicks[tripId] : undefined;

  const stations = useMemo(() => (trip ? stationsOf(trip) : []), [trip]);
  const seated = stations.find((s) => s.code === seatedCode) ?? stations[0] ?? null;

  const groups = useMemo(
    () => aisleGroups(seated, ticks, runOut.inFlight),
    [seated, ticks, runOut.inFlight]
  );
  const bought = useMemo(
    () => (trip ? boughtRows(trip, ticks, runOut.inFlight) : []),
    [trip, ticks, runOut.inFlight]
  );

  const reading = useMemo(
    () => (trip ? tillReading(trip, ticks, state.priceChecks) : null),
    [trip, ticks, state.priceChecks]
  );
  const activeVerify = useMemo(
    () => (trip ? activeVerifyIngId(trip, state.priceChecks) : null),
    [trip, state.priceChecks]
  );

  const lidCount = groups.length + (bought.length > 0 ? 1 : 0);
  const openRowCount =
    openLid === BOUGHT_ID
      ? bought.length
      : (groups.find((g) => g.id === (openLid === FIRST_LID ? groups[0]?.id : openLid))?.owed.length ??
        groups[0]?.owed.length ??
        0);
  const budget = budgetFor(useBayHeight(bayRef), lidCount, openRowCount);
  const rowBudget = budget.rows;

  /* The open lid. FIRST_LID is "not yet chosen" and resolves to the first
     group that still owes rows; null is a lid the operator deliberately shut. */
  const effectiveLid =
    openLid === FIRST_LID ? (groups[0]?.id ?? (bought.length > 0 ? BOUGHT_ID : null)) : openLid;

  /* ------------------------------------------------------------ commit paths */

  const commit = useCallback((action: Action) => {
    const next = reducer(modelRef.current, action);
    modelRef.current = next;
    return next;
  }, []);

  const report = useCallback(
    (nextState: AppState) => {
      if (!trip) return;
      const nextReading = tillReading(trip, nextState.shopTicks[trip.tripId], nextState.priceChecks);
      tillRef.current?.report(nextReading);
      seatRef.current?.report(nextReading.got, nextReading.total);
      /* II.5.8 — the over-run crossing is a genuine threshold and gets the
         lower-severity voice ONCE per entry, never a repeating tritone: this
         screen has no stuck-open fault to reserve that for. See the report. */
      const over = nextReading.overP > 0;
      if (over && !overRef.current) caution();
      overRef.current = over;
    },
    [trip]
  );

  /**
   * The whole press, in the order II.1.1 fixes: semantic 0ms, mechanical after.
   * `fromKeyboard` advances focus so a keyboard walk is not stranded when the
   * row it is standing on stops being rendered; a thumb is left where it is.
   */
  const pressRow = useCallback(
    (row: TripRow, fromKeyboard: boolean, el: HTMLButtonElement) => {
      if (!tripId) return;
      if (runOut.isRunning(row.ingId)) return; // Système S, read from a ref

      const wasBought = isBought(modelRef.current.shopTicks[tripId], row.ingId);
      const action: Action = wasBought
        ? { type: "shopTicks/untick", tripId, ingId: row.ingId }
        : { type: "shopTicks/tick", tripId, ingId: row.ingId };

      const next = commit(action); // 1 · semantic, this task
      report(next); // 2 · the instruments, this task
      cue("contact"); // 3 · §6 — the thunk fires ON RELEASE, which is here

      if (fromKeyboard) {
        const rows = Array.from(
          registerRef.current?.querySelectorAll<HTMLButtonElement>(".lst-row") ?? []
        );
        const at = rows.indexOf(el);
        (rows[at + 1] ?? rows[at - 1])?.focus();
      }

      if (!wasBought) runOut.arm(row.ingId); // 4 · the window opens on the buy
      dispatch(action); // 5 · the request to re-render
    },
    [commit, dispatch, report, runOut, tripId]
  );

  const putBack = useCallback(() => {
    const pending = runOut.newest;
    if (!pending || !tripId) return;
    runOut.cancel(pending.ingId);
    const action: Action = { type: "shopTicks/untick", tripId, ingId: pending.ingId };
    const next = commit(action);
    report(next);
    dispatch(action);
  }, [commit, dispatch, report, runOut, tripId]);

  const submitPrice = useCallback(
    (ingId: string, price: number) => {
      const action: Action = { type: "priceChecks/set", ingId, price };
      const next = commit(action);
      report(next);
      dispatch(action);
      setVerifyId(null);
    },
    [commit, dispatch, report, setVerifyId]
  );

  /* --------------------------------------------------------------- movement */

  const focusFirstRow = useCallback(() => {
    requestAnimationFrame(() => {
      registerRef.current?.querySelector<HTMLButtonElement>(".lst-row")?.focus();
    });
  }, []);

  /** The next aisle still owing rows, anywhere in the trip, in trip order. */
  const nextTarget = useMemo(() => {
    if (!trip) return null;
    for (const station of stations) {
      for (const row of station.rows) {
        if (!isBought(ticks, row.ingId)) {
          return { code: station.code, id: `${station.code}:${row.aisle || "unaisled"}`, aisle: row.aisle || "unaisled" };
        }
      }
    }
    return null;
  }, [stations, ticks, trip]);

  const goNext = useCallback(() => {
    if (!nextTarget) return;
    if (nextTarget.code !== seated?.code) setSeated(nextTarget.code);
    setOpenLid(nextTarget.id);
    focusFirstRow();
  }, [focusFirstRow, nextTarget, seated?.code, setOpenLid, setSeated]);

  /* ---------------------------------------------------------------- arbiter */

  const arbiter = useMemo(
    () => arbiterFor("list", state, now, trip ? { tripDay: trip.kind === "full" ? 0 : 7 } : {}),
    [state, now, trip]
  );
  const rank1 = resolveListRank1(arbiter.rank1, trip, state.priceChecks);

  const activateArbiter = useCallback(() => {
    if (!rank1) return;
    if (rank1.kind === "verify-nominee" && trip) {
      const found = findRowAndShop(trip, rank1.id);
      if (found) {
        setSeated(found.shop.code);
        setVerifyId(found.row.ingId);
        return;
      }
    }
    if (rank1.kind === "primary-action" && rank1.target?.screen === "list") {
      goNext();
      return;
    }
    /* Belt-and-braces: LIST must NEVER hand off to #/shop while a trip is
       active. resolveListRank1 already guarantees a verify nominee reaching
       here has a matching row, so this covers any future rank-1 kind. */
    if (rank1.target) {
      if (trip && rank1.target.screen === "shop") return;
      window.location.hash = `#/${rank1.target.screen}`;
    }
  }, [goNext, rank1, setSeated, setVerifyId, trip]);

  /* -------------------------------------------------------- the off states */

  if (!trip) {
    return (
      <section className="lst" data-cd-language="irreducible">
        <div className="lst-frame">
          <Enclosure variant="well" as="section" className="lst-off" role="note">
            <Escutcheon as="h1">no trip</Escutcheon>
            <Plate className="lst-off-face" surface="data">
              <p className="cd-prose">{OFF_REASON[resolved.source]}</p>
            </Plate>
            <PressKey
              className="lst-off-key"
              /* navigation — II.5.16's silence list, no cue */
              onPress={() => {
                window.location.hash = "#/shop";
              }}
              cap="build one at the desk"
            />
          </Enclosure>
        </div>
      </section>
    );
  }

  const priceChecks = state.priceChecks;
  const verifyRow = verifyId ? (findRowAndShop(trip, verifyId)?.row ?? null) : null;
  const owedByStation: Record<string, number> = {};
  for (const station of stations) owedByStation[station.code] = owedCount(station, ticks);
  const totalOwed = allRows(trip).filter((r) => !isBought(ticks, r.ingId)).length;

  const allGroups: RegisterGroup[] = groups.map((group) => ({
    id: group.id,
    label: group.aisle,
    limit: rowBudget,
    items: group.owed.map((row) => () => (
      <ItemRow
        key={row.ingId}
        row={row}
        priceChecks={priceChecks}
        activeVerify={activeVerify}
        bought={isBought(ticks, row.ingId)}
        running={runOut.inFlight.has(row.ingId)}
        runOutMs={RUNOUT_MS}
        onPress={pressRow}
      />
    )),
  }));

  if (bought.length > 0) {
    allGroups.push({
      id: BOUGHT_ID,
      label: "bought",
      limit: rowBudget,
      items: bought.map((row) => () => (
        <ItemRow
          key={row.ingId}
          row={row}
          priceChecks={priceChecks}
          activeVerify={activeVerify}
          bought
          running={false}
          runOutMs={RUNOUT_MS}
          stationWord={stationCodeOf(trip, row.ingId).toLowerCase()}
          onPress={pressRow}
        />
      )),
    });
  }

  /* R7's SECOND clip. The lid column is bounded by the bay just as the row list
     is, and a lid cut in half by `overflow: hidden` is the fade curtain II.6.24
     forbids. The open lid is always kept; the remainder is printed as a figure. */
  const openIndex = allGroups.findIndex((g) => g.id === effectiveLid);
  let registerGroups = allGroups;
  if (allGroups.length > budget.lids) {
    /* The window holds still while the open lid is inside it, and only travels
       when it has to. A lid column that re-anchors on every press is a list
       whose positions cannot be learned, which is the opposite of what a
       hundredth use needs. */
    const start =
      openIndex < budget.lids
        ? 0
        : Math.min(openIndex - budget.lids + 1, allGroups.length - budget.lids);
    registerGroups = allGroups.slice(Math.max(0, start), Math.max(0, start) + budget.lids);
  }
  const hiddenLids = allGroups.length - registerGroups.length;
  const hiddenLidRows = allGroups
    .filter((g) => !registerGroups.includes(g))
    .reduce((n, g) => n + g.items.length, 0);

  const pendingRow = runOut.newest ? findRowAndShop(trip, runOut.newest.ingId)?.row ?? null : null;
  const offset = orbitOffset(orbit);

  return (
    <section
      className="lst"
      data-cd-language="irreducible"
      data-lst-trophy={trophy ? "true" : "false"}
      style={
        {
          // The burn-in orbit moves the WHOLE composition as one rigid frame.
          "--lst-orbit-x": `${offset.x}px`,
          "--lst-orbit-y": `${offset.y}px`,
        } as React.CSSProperties
      }
    >
      <div className="lst-frame">
        <HeadPlate
          kind={kindLabel(trip.kind)}
          variantLabel={variant.isTester ? variant.label : null}
          stationSlot={
            stations.length > 1 ? (
              <StationBar
                stations={stations}
                activeCode={seated?.code ?? ""}
                owed={owedByStation}
                onSeat={(code) => {
                  setSeated(code);
                  setOpenLid(FIRST_LID);
                }}
              />
            ) : null
          }
          arbiterKind={rank1?.kind ?? null}
          text={rank1?.text ?? null}
          queued={arbiter.queued}
          actionLabel={rank1 ? "act →" : null}
          onActivate={rank1 ? activateArbiter : null}
          acknowledged={rank1 != null && acked === rank1.id}
          onAcknowledge={() => setAcked(rank1?.id ?? null)}
        />

        <div className="lst-cluster">
          <Till ref={tillRef} reading={reading!} pricedOn={trip.createdOn} trophy={trophy} />
          <SeatBar ref={seatRef} got={reading!.got} total={reading!.total} trophy={trophy} />
        </div>

        <div className="lst-bay" ref={bayRef} data-lst-hidden={trophy ? "true" : undefined}>
          {/* TROPHY. "Every healthy station simply is not rendered." What
              survives is the exception list, and it stands in the bay the
              register just vacated rather than over the instruments above it. */}
          {trophy && (
            <TrophyRead
              owed={totalOwed}
              station={seated?.seat ?? "—"}
              aisle={groups[0]?.aisle ?? "clear"}
              unpriced={activeVerify ? (findRowAndShop(trip, activeVerify)?.row.label ?? null) : null}
              pricedOn={trip.createdOn}
            />
          )}
          {registerGroups.length === 0 ? (
            <Enclosure variant="well" className="lst-done" role="note">
              <Escutcheon as="p">trolley full</Escutcheon>
              <Plate className="lst-done-face" surface="data">
                <p className="cd-prose">
                  every line on this trip is in the trolley. the close read has the figures to
                  type back in at the desk.
                </p>
              </Plate>
            </Enclosure>
          ) : (
            <div ref={registerRef} className="lst-register-mount">
              <Register
                groups={registerGroups}
                openId={effectiveLid}
                onOpenChange={setOpenLid}
                label="aisles"
                overflowWord="still owed"
                className="lst-register"
              />
              {hiddenLids > 0 && (
                <p className="lst-lid-overflow">
                  <span className="cd-overflow-count cd-data">{hiddenLids}</span>
                  <span className="lst-lid-overflow-word">
                    {hiddenLids === 1 ? "aisle" : "aisles"} not shown · {hiddenLidRows} rows
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        <ThumbPlate
          pendingLabel={pendingRow?.label ?? null}
          pendingKey={runOut.newest ? `${runOut.newest.ingId}:${runOut.newest.startedAt}` : null}
          runOutMs={RUNOUT_MS}
          onPutBack={putBack}
          nextAisle={nextTarget?.aisle ?? null}
          onNext={goNext}
          onClose={() => setCloseOpen(true)}
          closeLabel="close"
        />
      </div>

      <VerifyPad row={verifyRow} onClose={() => setVerifyId(null)} onSubmit={submitPrice} />

      <CloseRead
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        trip={trip}
        priceChecks={priceChecks}
        reading={reading!}
        kind={kindLabel(trip.kind)}
        takenAt={hhmm(now)}
      />
    </section>
  );
}
