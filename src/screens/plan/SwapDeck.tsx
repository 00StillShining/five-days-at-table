/**
 * src/screens/plan/SwapDeck.tsx — the tray that changes what a slot cooks.
 *
 * Owner ruling: "Trays travel their own size with NO SCRIM — the workspace
 * beneath stays live and touchable." The foundry's Tray is that ruling built:
 * not a <dialog>, no focus trap, an explicit exit that is an object rather than
 * a convention, and Escape closes.
 *
 * ---------------------------------------------------------------------------
 * THE RANKING IS ONLY AS FRESH AS THE STOCKTAKE UNDER IT
 * ---------------------------------------------------------------------------
 * Candidates are ranked by `coverageForMeal` — the frozen selector every other
 * screen uses for "cook from stock" — and that number is computed from
 * `inventory[ingId].level`, whose age is `updatedAt`. The freshness table
 * declares the stocktake class at 72h with the printed word UNCOUNTED: "A
 * household counts its shelves on a rhythm, not continuously."
 *
 * So the deck ages its OWN ranking, against the OLDEST count among the
 * ingredients each candidate actually needs — a ranking is only as fresh as its
 * stalest input, and taking the newest would flatter it. Stale holds the
 * ranking on screen at 55% ink, prints UNCOUNTED, and offers the recovery at a
 * fixed position: STORES, where the count is taken. Nothing is hidden and
 * nothing is re-sorted behind the operator's back.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS GUARDED AND WHAT IS NOT
 * ---------------------------------------------------------------------------
 * CORRECTIONARY 4 puts a guarded switch on "anything consequential". A single
 * swap is consequential but individually REVERSIBLE — an undo sits beside it
 * for as long as it is committed — so it commits on a press and confirms after
 * the consequence lands (II.5.7: confirm fires only AFTER). Dropping EVERY swap
 * on the board is neither individually reversible nor recoverable from the
 * screen, so that one is the guarded engage: hold 350ms against a real clock
 * with a visible linear fill, press again to commit, and the guard runs out
 * after 4000ms of neglect.
 */

import { memo } from "react";
import { Escutcheon, GuardedKey, Plate, PressKey, Tray } from "../../cd/foundry";
import { Stale } from "../../cd/freshness/Stale";
import { ageOf, FRESHNESS, type Age } from "../../cd/freshness/classes";
import type { Cover, Meal, Slot } from "../../data/types";
import type { Inventory } from "../../state/types";
import { CHANNELS, formatChannel, formatSigned, type SwapCandidate } from "./model";

export const STOCKTAKE_THRESHOLD = `${Math.round(FRESHNESS.stocktake.staleAfterMs / 3_600_000)}h`;

export interface SwapDeckProps {
  open: boolean;
  onClose: () => void;
  dayLabel: string;
  slot: Slot;
  slotLabel: string;
  /** The meal the slot currently cooks — the swap replacement, when one holds. */
  current: Meal | null;
  /** The meal the plan authored, when a swap has displaced it. */
  displaced: Meal | null;
  candidates: SwapCandidate[];
  cover: Cover;
  inventory: Inventory;
  nowMs: number;
  swapCount: number;
  onCommit: (candidateId: string) => void;
  onClear: () => void;
  onClearAll: () => void;
  onStores: () => void;
}

/** A ranking is only as fresh as its stalest input (see the module note). */
function rankingAge(candidate: SwapCandidate, inventory: Inventory, nowMs: number): Age {
  let oldest: string | null = null;
  let missing = false;
  for (const ing of candidate.coverageIngredients) {
    const at = inventory[ing]?.updatedAt;
    if (!at) {
      missing = true;
      continue;
    }
    if (oldest === null || at < oldest) oldest = at;
  }
  return ageOf("stocktake", missing ? null : oldest, nowMs);
}

const Row = memo(function Row({
  candidate,
  inventory,
  nowMs,
  onCommit,
  onStores,
  slotLabel,
  dayLabel,
}: {
  candidate: SwapCandidate;
  inventory: Inventory;
  nowMs: number;
  onCommit: (id: string) => void;
  onStores: () => void;
  slotLabel: string;
  dayLabel: string;
}) {
  const age = rankingAge(candidate, inventory, nowMs);
  const pct = Math.round(candidate.coverage * 100);
  return (
    <div className="pln-cand" data-pln-risk={candidate.newlyOver.length > 0 ? "true" : "false"}>
      <span className="pln-cand-id">
        <span className="pln-cand-name">{candidate.meal.name}</span>
        <span className="pln-cand-origin cd-printed">{candidate.meal.origin}</span>
      </span>

      <span className="pln-cand-cov">
        <Stale
          age={age}
          label={`${candidate.meal.name} stock coverage`}
          action={<PressKey className="pln-cand-recover" onPress={onStores} cap="stores →" />}
        >
          <span className="cd-data pln-cand-pct">
            {pct}
            <span className="cd-unit">%</span>
          </span>
        </Stale>
        <span className="pln-cand-covword cd-silkscreen">from stock</span>
      </span>

      <span className="pln-cand-delta cd-data">
        {CHANNELS.map((spec) => {
          const d = candidate.delta[spec.key];
          return (
            <span key={spec.key} className="pln-cand-d" data-pln-sign={d > 0 ? "up" : d < 0 ? "down" : "flat"}>
              <span className="cd-silkscreen pln-cand-dlabel">{spec.label}</span>
              {formatSigned(d, spec)}
            </span>
          );
        })}
      </span>

      {candidate.newlyOver.length > 0 && (
        <p className="pln-cand-warn cd-printed">
          <span className="cd-silkscreen">pushes over band</span>{" "}
          {candidate.newlyOver.map((k) => CHANNELS.find((c) => c.key === k)?.label ?? k).join(", ")}
        </p>
      )}

      <span className="pln-cand-act">
        <PressKey
          className="pln-cand-commit"
          onPress={() => onCommit(candidate.meal.id)}
          sound="contact"
          cap="cook this"
        >
          <span className="fd5-visually-hidden">
            {" "}
            · {candidate.meal.name} into {dayLabel} {slotLabel}
          </span>
        </PressKey>
      </span>
    </div>
  );
});

export function SwapDeck({
  open,
  onClose,
  dayLabel,
  slotLabel,
  current,
  displaced,
  candidates,
  cover,
  inventory,
  nowMs,
  swapCount,
  onCommit,
  onClear,
  onClearAll,
  onStores,
}: SwapDeckProps) {
  return (
    <Tray
      open={open}
      onClose={onClose}
      title={`swap · ${dayLabel} ${slotLabel}`}
      exitLabel="back to the board"
      edge="inline-end"
      className="pln-deck"
      headSlot={
        <span className="pln-deck-count cd-data">
          {candidates.length}
          <span className="cd-unit">candidates</span>
        </span>
      }
    >
      <Plate className="pln-deck-now" surface="data">
        <Escutcheon as="h3">currently cooking</Escutcheon>
        <p className="pln-deck-now-name">{current ? current.name : "—"}</p>
        {displaced && (
          <p className="pln-deck-now-was cd-printed">
            the plan authored <span className="pln-deck-was-name">{displaced.name}</span>
          </p>
        )}
        <p className="pln-deck-now-note cd-printed">
          <span className="cd-silkscreen">ranked by stock coverage</span> ·{" "}
          <span className="cd-silkscreen">counted for</span> {cover === "w" ? "her 70kg" : "him 85kg"} ·{" "}
          <span className="cd-silkscreen">a count goes stale after</span> {STOCKTAKE_THRESHOLD}
        </p>
        {displaced && (
          <PressKey className="pln-deck-undo" onPress={onClear} sound="contact" cap="undo this swap" />
        )}
      </Plate>

      <div className="pln-deck-rows">
        {candidates.length === 0 ? (
          <Plate className="pln-deck-empty" surface="data">
            <p className="cd-prose">
              no candidate exists for this slot: the swap pool is the other week&rsquo;s meals of the
              same slot type, and that week authors none.
            </p>
          </Plate>
        ) : (
          candidates.map((c) => (
            <Row
              key={c.meal.id}
              candidate={c}
              inventory={inventory}
              nowMs={nowMs}
              onCommit={onCommit}
              onStores={onStores}
              slotLabel={slotLabel}
              dayLabel={dayLabel}
            />
          ))
        )}
      </div>

      {swapCount > 0 && (
        <Plate className="pln-deck-foot" surface="data">
          <p className="pln-deck-foot-count cd-printed">
            <span className="cd-data">{swapCount}</span>{" "}
            <span className="cd-silkscreen">{swapCount === 1 ? "swap holds" : "swaps hold"} on the board</span>
          </p>
          <GuardedKey
            className="pln-deck-clearall"
            onCommit={onClearAll}
            armLabel="hold to arm"
            commitLabel="drop every swap"
            consequence={`every one of the ${swapCount} committed ${
              swapCount === 1 ? "swap" : "swaps"
            } is cleared and the board returns to the authored plan. There is no undo for this one.`}
          />
        </Plate>
      )}
    </Tray>
  );
}
