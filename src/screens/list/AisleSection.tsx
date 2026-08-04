// One aisle's header (name + progress) + its rows (PLAN §6.9: "Aisle headers
// with progress (●●○○○ 3/9 + text)").
import { useRef } from "react";
import type { TripRow } from "../../engine/tripCodec";
import type { PriceChecks, ShopTicks } from "../../state/types";
import { countTicked, orderRowsForDisplay, progressDots } from "./model";
import { Row } from "./Row";
import { useFlip } from "./useFlip";

export interface AisleSectionProps {
  shopLabel: string | null; // shown only on the first aisle section of a freshly-selected shop pane
  aisle: string;
  rows: TripRow[];
  ticks: ShopTicks[string] | undefined;
  settled: ReadonlySet<string>;
  activeVerifyIngId: string | null;
  priceChecks: PriceChecks;
  reducedMotion: boolean;
  onToggleTick: (row: TripRow) => void;
  onOpenVerify: (row: TripRow) => void;
  registerEl: (ingId: string, el: HTMLButtonElement | null) => void;
}

function ProgressDots({ filled, slots }: { filled: number; slots: number }) {
  return (
    <span className="scr-list-dots" aria-hidden="true">
      {Array.from({ length: slots }, (_, i) => (
        <span key={i} className={`scr-list-dot${i < filled ? " scr-list-dot--on" : ""}`} />
      ))}
    </span>
  );
}

export function AisleSection({
  shopLabel,
  aisle,
  rows,
  ticks,
  settled,
  activeVerifyIngId,
  priceChecks,
  reducedMotion,
  onToggleTick,
  onOpenVerify,
  registerEl,
}: AisleSectionProps) {
  const ticked = countTicked(rows, ticks);
  const total = rows.length;
  const dots = progressDots(ticked, total);
  const done = total > 0 && ticked === total;
  const ordered = orderRowsForDisplay(rows, ticks, settled);
  const headingId = `scr-list-aisle-${aisle.replace(/[^a-z0-9]+/gi, "-")}`;

  // Local element map, scoped to this aisle's own FLIP animation — separate
  // from index.tsx's cross-aisle rowRefs (used for "next aisle" scroll/focus
  // targeting), see useFlip.ts's doc.
  const flipEls = useRef(new Map<string, HTMLButtonElement>());
  function registerBoth(ingId: string, el: HTMLButtonElement | null) {
    if (el) flipEls.current.set(ingId, el);
    else flipEls.current.delete(ingId);
    registerEl(ingId, el);
  }
  useFlip(
    ordered.map((r) => r.ingId),
    flipEls.current,
    !reducedMotion
  );

  return (
    <section className="scr-list-aisle" data-done={done || undefined} aria-labelledby={headingId}>
      <h2 id={headingId} className="scr-list-aisle-h">
        {shopLabel && <span className="scr-list-aisle-shop">{shopLabel} · </span>}
        <span className="scr-list-aisle-name">{aisle}</span>
        <ProgressDots filled={dots.filled} slots={dots.slots} />
        <span className="scr-list-aisle-frac">
          {done ? "done" : `${ticked}/${total}`}
        </span>
      </h2>
      <ul className="scr-list-row-list">
        {ordered.map((row) => (
          <Row
            key={row.ingId}
            row={row}
            ticked={Boolean(ticks?.[row.ingId])}
            isActiveVerifyNominee={activeVerifyIngId === row.ingId}
            priceChecks={priceChecks}
            onToggleTick={onToggleTick}
            onOpenVerify={onOpenVerify}
            registerEl={registerBoth}
          />
        ))}
      </ul>
    </section>
  );
}
