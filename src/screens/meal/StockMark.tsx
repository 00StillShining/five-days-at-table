import type { Ingredient } from "../../data";
import { STOCK_LEVEL_GLYPH, STOCK_LEVEL_TEXT } from "./mealMath";

export interface StockMarkProps {
  ing: Ingredient;
  level: number | null;
}

/**
 * In-stock mark per ingredient (PLAN §6.5): a small success-coded mark +
 * accessible text ("in stock · about half"). The glyph shape itself carries
 * the fraction (○ ◔ ◑ ◕ ●), so level is communicated by shape+text as well as
 * color — never color alone (Sol §4.2). Freebie ingredients (spice-shelf
 * staples never tracked in inventory — src/state/selectors.ts's
 * coverageForMeal excludes them the same way) get a distinct neutral
 * "pantry staple" mark rather than a fabricated stock level.
 */
export function StockMark({ ing, level }: StockMarkProps) {
  if (ing.freebie) {
    return (
      <span className="mk-stock mk-stock--pantry">
        <span aria-hidden="true" className="mk-stock-glyph">
          {"·"}
        </span>
        <span className="mk-stock-text">pantry staple</span>
      </span>
    );
  }

  const lvl = level ?? 0;
  const glyph = STOCK_LEVEL_GLYPH[lvl] ?? STOCK_LEVEL_GLYPH[0];
  const text = STOCK_LEVEL_TEXT[lvl] ?? STOCK_LEVEL_TEXT[0];

  return (
    <span className="mk-stock" data-instock={lvl > 0 || undefined}>
      <span aria-hidden="true" className="mk-stock-glyph">
        {glyph}
      </span>
      <span className="mk-stock-text">{text}</span>
    </span>
  );
}
