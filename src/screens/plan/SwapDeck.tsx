// PLAN §6.4 swap deck: for a selected slot, Week-B (and cook-from-stock)
// candidates ranked by stock coverage %, each showing band impact before
// committing. Plain ◂ ▸ steppers only — no scrubber, no drag. Built on the
// shared <Sheet> (native <dialog>, Esc-to-close + focus trap for free); this
// counts as PLAN's one permitted drill-in level (rail -> scene -> Sheet).
import { useEffect, useState } from "react";
import { EstimateMark } from "../../components/EstimateMark";
import { Sheet } from "../../components/Sheet";
import type { Cover, Slot, Week } from "../../data/types";
import type { Inventory } from "../../state/types";
import { candidatesForSlot, effectiveMeal, fmtSigned, mealForSlot, newlyOverBand, swapDelta, MACRO_LABEL } from "./helpers";
import type { SwapMap } from "./swapStore";

export interface SwapDeckProps {
  open: boolean;
  onClose: () => void;
  week: Week;
  day: number;
  dayLabel: string;
  slot: Slot;
  cover: Cover;
  inventory: Inventory;
  swaps: SwapMap;
  onCommit: (candidateMealId: string) => void;
}

export function SwapDeck({ open, onClose, week, day, dayLabel, slot, cover, inventory, swaps, onCommit }: SwapDeckProps) {
  const original = mealForSlot(week, day, slot);
  const [index, setIndex] = useState(0);

  const candidates = original ? candidatesForSlot(week, slot, cover, inventory) : [];

  // Reset the stepper position whenever a *different* slot is opened —
  // <SwapDeck> stays mounted across open/close (see index.tsx: this lets the
  // Sheet's own close() run and restore focus properly instead of the
  // dialog being yanked out of the DOM mid-close), so this can't rely on a
  // remount to reset state.
  useEffect(() => {
    setIndex(0);
  }, [week, day, slot]);

  if (!original) {
    // Defensive only — every (week, day, slot) in the current dataset
    // resolves to a real meal (verified during build). Kept so a future
    // data gap degrades to an explicit message rather than a crash.
    return (
      <Sheet open={open} onClose={onClose} title="swap">
        <p>no meal is planned in this slot.</p>
      </Sheet>
    );
  }

  const current = effectiveMeal(week, day, slot, original, swaps);
  const candidate = candidates[index];

  return (
    <Sheet open={open} onClose={onClose} title={`swap · ${dayLabel.slice(0, 3).toLowerCase()} ${slot}`}>
      <p className="scr-plan-swapdeck-current">
        currently: <strong>{current.name}</strong> · {Math.round(current.macros[cover].kcal)} kcal
      </p>
      {candidates.length === 0 || !candidate ? (
        <p>no {slot} candidates found in the other week.</p>
      ) : (
        <>
          <div className="scr-plan-swapdeck-stepper">
            <button
              type="button"
              className="fd5-control"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              aria-label="previous candidate"
            >
              <span aria-hidden="true">◂</span>
            </button>
            <div className="scr-plan-swapdeck-candidate" aria-live="polite">
              <p className="scr-plan-swapdeck-candidate-name">{candidate.meal.name}</p>
              <p className="scr-plan-swapdeck-candidate-coverage">
                <EstimateMark /> {Math.round(candidate.coverage * 100)}% in stock
              </p>
              <CandidateDelta week={week} day={day} cover={cover} swaps={swaps} current={current} candidate={candidate.meal} />
              <p className="scr-plan-swapdeck-position">
                {index + 1} of {candidates.length}
              </p>
            </div>
            <button
              type="button"
              className="fd5-control"
              onClick={() => setIndex((i) => Math.min(candidates.length - 1, i + 1))}
              disabled={index === candidates.length - 1}
              aria-label="next candidate"
            >
              <span aria-hidden="true">▸</span>
            </button>
          </div>
          <div className="scr-plan-swapdeck-actions">
            <button type="button" className="fd5-control scr-plan-swapdeck-commit" onClick={() => onCommit(candidate.meal.id)}>
              commit swap
            </button>
            <button type="button" className="fd5-control" onClick={onClose}>
              cancel
            </button>
          </div>
          <p className="fd5-note scr-plan-swapdeck-note">
            note: swaps apply for this browsing session only — they are not saved between visits yet.
          </p>
        </>
      )}
    </Sheet>
  );
}

interface CandidateDeltaProps {
  week: Week;
  day: number;
  cover: Cover;
  swaps: SwapMap;
  current: ReturnType<typeof effectiveMeal>;
  candidate: ReturnType<typeof effectiveMeal>;
}

function CandidateDelta({ week, day, cover, swaps, current, candidate }: CandidateDeltaProps) {
  const delta = swapDelta(current, candidate, cover);
  const over = newlyOverBand(week, day, cover, swaps, current, candidate);
  return (
    <p className="scr-plan-swapdeck-delta">
      Δkcal {fmtSigned(delta.kcal, "kcal")} · Δprotein {fmtSigned(delta.protein, "protein")}
      {over.length > 0 && (
        <strong className="scr-plan-swapdeck-warn"> — would push {over.map((k) => MACRO_LABEL[k]).join(", ")} over band</strong>
      )}
    </p>
  );
}
