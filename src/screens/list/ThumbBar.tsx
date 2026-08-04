// Thumb bar (PLAN §6.9): fixed bottom, above the safe area — two-position
// shop paddle mor|sai, the till odometer, got-count, `next ▸`. All targets
// >=56px (--fd-target-list).
//
// LAYOUT NOTE (flagged in the build report as a shared-change request): the
// chassis's own loop rail (src/app/LoopRail.tsx via tokens.css) ALSO fixes
// itself to the viewport bottom under the same <=700px breakpoint, on every
// screen unconditionally (LIST included, even though "list" isn't one of
// the five rail stations — same as MEAL). This bar therefore has to stack
// ABOVE that rail's reserved footprint on mobile; tokens.css documents that
// footprint as "6rem + safe-area" (its own comment on `.fd5-scene`), which
// this file's CSS duplicates rather than reads from a shared token, because
// tokens.css exposes no custom property for it. A `--fd5-rail-footprint`
// variable there would let this (and any future secondary fixed bar) avoid
// the duplication.
import { Paddle } from "../../components/Paddle";
import { Odometer } from "./Odometer";
import type { TripShop } from "../../engine/tripCodec";
import { paddleLabel } from "./model";

export interface ThumbBarProps {
  paddleShops: TripShop[];
  activeShopCode: string | null;
  onToggleShop: () => void;
  pence: number;
  got: number;
  total: number;
  onNext: () => void;
  nextDisabled: boolean;
}

export function ThumbBar({ paddleShops, activeShopCode, onToggleShop, pence, got, total, onNext, nextDisabled }: ThumbBarProps) {
  const [a, b] = paddleShops;

  return (
    <div className="scr-list-thumbbar">
      {a && b && (
        <Paddle
          name="shop"
          checked={activeShopCode === b.code}
          optionA={{ value: a.code, label: paddleLabel(a) }}
          optionB={{ value: b.code, label: paddleLabel(b) }}
          onToggle={onToggleShop}
        />
      )}
      <Odometer pence={pence} got={got} total={total} />
      <button type="button" className="fd5-control scr-list-next" onClick={onNext} disabled={nextDisabled}>
        next <span aria-hidden="true">▸</span>
      </button>
    </div>
  );
}
