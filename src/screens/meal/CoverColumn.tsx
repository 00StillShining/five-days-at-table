import type { Cover, Inventory } from "../../state/store";
import type { Macros, Meal } from "../../data";
import { ingredientsById } from "../../data";
import { EstimateMark } from "../../components/EstimateMark";
import { formatHouseholdHint, scaledMealMacros } from "./mealMath";
import { StockMark } from "./StockMark";

export interface CoverColumnProps {
  meal: Meal;
  cover: Cover;
  scale: number;
  inventory: Inventory;
  /** True when this is the cover the global `prefs.cover` paddle currently
   * points at — the column CSS scoping mobile visibility keys off this
   * (PLAN §6.5: "mobile stacked with cover paddle-toggle, reuse global cover
   * pref for which is primary"). Desktop shows both columns regardless. */
  primary: boolean;
}

const COVER_LABEL: Record<Cover, string> = { w: "her · 70 kg", m: "him · 85 kg" };

const MACRO_COLUMNS: { key: keyof Macros; label: string; unit: string; channel?: string }[] = [
  { key: "kcal", label: "kcal", unit: "" },
  { key: "protein", label: "protein", unit: "g", channel: "protein" },
  { key: "netCarb", label: "net carb", unit: "g", channel: "carb" },
  { key: "fat", label: "fat", unit: "g", channel: "fat" },
  { key: "fibre", label: "fibre", unit: "g", channel: "fibre" },
];

/** One cover's full card: macro strip (recomputed live at the current
 * scale) + per-ingredient grams, household hints, and in-stock marks. */
export function CoverColumn({ meal, cover, scale, inventory, primary }: CoverColumnProps) {
  const macros = scaledMealMacros(meal, cover, scale);
  const entries = Object.entries(meal.covers[cover]);

  return (
    <div className="scr-meal-cover" data-primary={primary || undefined}>
      <div className="scr-meal-cover-head">
        <h2 className="scr-meal-cover-title">{COVER_LABEL[cover]}</h2>
        <span className="scr-meal-cover-scale">at × {scale.toFixed(2)}</span>
      </div>

      <dl className="scr-meal-macro-strip">
        {MACRO_COLUMNS.map(({ key, label, unit, channel }) => (
          <div className="scr-meal-macro" key={key} data-channel={channel}>
            <dt className="scr-meal-macro-label">{label}</dt>
            <dd className="scr-meal-macro-value">
              {macros[key]}
              {unit}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="scr-meal-ing-list">
        {entries.map(([ingId, g]) => {
          const ing = ingredientsById[ingId];
          if (!ing) return null; // defensive; join verified complete
          const grams = Math.round(g * scale);
          const hint = formatHouseholdHint(g * scale, ing);
          const level = inventory[ingId]?.level ?? null;
          return (
            <li key={ingId} className="scr-meal-ing-row">
              <span className="scr-meal-ing-name">{ing.name.display}</span>
              <span className="scr-meal-ing-g">{grams} g</span>
              {hint && (
                <span className="scr-meal-ing-hint">
                  <EstimateMark />
                  {hint}
                </span>
              )}
              <StockMark ing={ing} level={level} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
