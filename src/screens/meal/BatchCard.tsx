import type { BatchTakeG, Meal } from "../../data";
import { prepSessionById } from "../../data";

export interface BatchCardProps {
  meal: Meal;
  scale: number;
  batchTakeG: BatchTakeG;
}

/**
 * Batch card (PLAN §6.5): "take 490 g of Sunday's 1,010 g batch". batchTakeG
 * is the meal's total draw from Sunday's prep session, already aggregated
 * across every yield this meal consumes (data/prep.json yields[].consumers).
 * Most batch meals draw from exactly one yield, so the PLAN-style sentence
 * applies directly; a few (e.g. a-d1l: chicken + rice + cauliflower + white
 * sauce) draw from several yields at once — there's no single "Sunday's N g
 * batch" figure for those, so they list each contributing component instead
 * rather than fabricating one number. batchTakeG scales with the portion
 * knob (dialing portions up means taking more of Sunday's batch); the
 * per-component qty strings are Phase 1's authored text and stay as-authored.
 */
export function BatchCard({ meal, scale, batchTakeG }: BatchCardProps) {
  const session = meal.method.batchSource ? prepSessionById(meal.method.batchSource) : undefined;
  const yields = session ? session.yields.filter((y) => y.consumers?.includes(meal.id)) : [];

  const w = Math.round(batchTakeG.w * scale);
  const m = Math.round(batchTakeG.m * scale);
  const total = Math.round(batchTakeG.total * scale);

  return (
    <section className="scr-meal-batch" aria-labelledby="scr-meal-batch-heading">
      <h2 id="scr-meal-batch-heading" className="scr-meal-section-title">
        from sunday&rsquo;s batch
      </h2>
      <p className="scr-meal-batch-take">
        take <strong className="scr-meal-batch-total">{total} g</strong> total
        <span className="scr-meal-batch-split"> · her {w} g · him {m} g</span>
      </p>
      {yields.length === 1 && (
        <p className="scr-meal-batch-source">
          of Sunday&rsquo;s {yields[0].component.toLowerCase()} — {yields[0].qty}
        </p>
      )}
      {yields.length > 1 && (
        <ul className="scr-meal-batch-list">
          {yields.map((y) => (
            <li key={y.component}>
              {y.component.toLowerCase()} <span className="scr-meal-batch-qty">{y.qty}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
