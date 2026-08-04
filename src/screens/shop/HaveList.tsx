// The have-list dedupe rows (PLAN §6.8: "carry-overs from inventory levels
// shown as have-list dedupe rows ('you're at ¾ on rice — skip'), dashed/
// muted with an include-anyway toggle per row"). Kept as one quiet section
// below the three costed columns rather than interleaved into them — the
// columns stay a clean "what to actually buy" list (Beogram calm-horizon
// composition: exceptions, not size inflation, create hierarchy).
import type { Inventory } from "../../state/types";
import { LEVEL_LABEL, type EffectiveLine } from "./tripHelpers";

export interface HaveListProps {
  lines: EffectiveLine[]; // ALL effective lines (dedupe filter happens here)
  inventory: Inventory;
  onIncludeAnyway: (ingId: string) => void;
}

export function HaveList({ lines, inventory, onIncludeAnyway }: HaveListProps) {
  const dedupe = lines.filter((l) => l.isDedupe);

  return (
    <section className="scr-shop-havelist" aria-labelledby="scr-shop-havelist-h">
      <h2 id="scr-shop-havelist-h" className="scr-shop-h">
        already got · skip
      </h2>
      {dedupe.length === 0 ? (
        <p className="scr-shop-muted">nothing to skip — either a stocktake hasn't happened yet, or everything's needed fresh.</p>
      ) : (
        <ul className="scr-shop-have-list">
          {dedupe.map((el) => {
            const level = inventory[el.line.ingId]?.level ?? 0;
            return (
              <li key={el.line.ingId} className="scr-shop-have-row">
                <span className="scr-shop-have-text">
                  you're at {LEVEL_LABEL[level]} on {el.line.name} — skip
                </span>
                <button type="button" className="fd5-control scr-shop-have-toggle" onClick={() => onIncludeAnyway(el.line.ingId)}>
                  include anyway ▸
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
