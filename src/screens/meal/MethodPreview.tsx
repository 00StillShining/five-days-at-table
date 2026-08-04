import type { Meal } from "../../data";
import { formatStepDuration } from "./mealMath";

export interface MethodPreviewProps {
  meal: Meal;
  onCook: () => void;
}

/**
 * Method preview (PLAN §6.5): the approved rev-B steps, timed, tracks shown
 * as small station labels. All 40 meals are `approved: true, rev: "B"` in
 * the current dataset (data/meals.json), but `method.approved`/`method.rev`
 * are rendered defensively per the actual data (PLAN §4: "Phase 2 may
 * display only approved methods; unapproved cards show original prose
 * tagged `rev A`") rather than assumed — a future data regen that reverts a
 * card to unreviewed prose surfaces correctly here without a code change.
 *
 * Step gram figures are the meal's originally-authored per-cover text
 * ("75/100 g") and are not renumbered when the portion knob scales — that
 * would require rewriting numbers embedded in prose sentences, which is
 * content-layer work outside a screen builder's remit (and outside this
 * screen's ownership of src/screens/meal/** only). The note below says so
 * plainly rather than silently showing stale-looking numbers.
 */
export function MethodPreview({ meal, onCook }: MethodPreviewProps) {
  const { steps, why, approved, rev } = meal.method;

  return (
    <section className="scr-meal-method" aria-labelledby="scr-meal-method-heading">
      <div className="scr-meal-method-head">
        <h2 id="scr-meal-method-heading" className="scr-meal-section-title">
          method
        </h2>
        <span className="scr-meal-rev">rev {rev}</span>
        {!approved && <span className="scr-meal-unapproved">unapproved · showing original prose</span>}
      </div>

      <p className="scr-meal-method-note">
        steps below show the method&rsquo;s originally-written per-serving grams; the ingredient list above already
        reflects your current portion scale.
      </p>

      <ol className="scr-meal-steps">
        {steps.map((s) => (
          <li key={s.n} className="scr-meal-step">
            <span className="scr-meal-step-n" aria-hidden="true">
              {s.n}
            </span>
            <div className="scr-meal-step-body">
              <p className="scr-meal-step-text">{s.text}</p>
              <p className="scr-meal-step-meta">
                {s.station && <span className="scr-meal-step-tag">{s.station}</span>}
                {s.track && <span className="scr-meal-step-tag">{s.track}</span>}
                {s.tempC != null && <span className="scr-meal-step-tag">{s.tempC}°c</span>}
                {s.minutes != null && <span className="scr-meal-step-tag">{formatStepDuration(s.minutes)}</span>}
                {s.untimed && <span className="scr-meal-step-tag">untimed</span>}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="scr-meal-why">
        <h3 className="scr-meal-why-title">why</h3>
        <p>{why}</p>
      </div>

      <div className="scr-meal-cook-link">
        <button type="button" className="fd5-control" onClick={onCook}>
          cook →
        </button>
      </div>
    </section>
  );
}
