import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clampSnapScale, SCALE_DETENTS, SCALE_MAX, SCALE_MIN, SCALE_STEP } from "./mealMath";

export interface PortionKnobProps {
  scale: number;
  onChange: (value: number) => void;
}

const ARC_SWEEP = 270; // degrees; 0deg = straight up, range is -135..+135 (a 90deg gap at the bottom)
const ARC_HALF = ARC_SWEEP / 2;

function angleForValue(v: number): number {
  return ((v - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * ARC_SWEEP - ARC_HALF;
}

function valueForAngle(deg: number): number {
  const clamped = Math.max(-ARC_HALF, Math.min(ARC_HALF, deg));
  return SCALE_MIN + ((clamped + ARC_HALF) / ARC_SWEEP) * (SCALE_MAX - SCALE_MIN);
}

/** Point on the dial at `deg` (0 = up, clockwise-positive — matches the CSS
 * `rotate()` convention) and radius `r`, in the knob's 0..100 viewBox. */
function polar(deg: number, r: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: 50 + r * Math.sin(rad), y: 50 - r * Math.cos(rad) };
}

/**
 * The portion knob — MEAL's hero (PLAN §6.5, carried over from the existing
 * tool). Flat circle + index dot, engraved 0.70-1.30 arc, 13 detents.
 *
 * CONTRACT (binding, PHASE2-CONTRACT.md): role="slider" with
 * aria-valuemin/max/now/text; arrow keys + Home/End; flanking stepper
 * buttons >=44px; a typed value input; the ×1.00 readout lives OUTSIDE the
 * knob in mono. Pointer drag is supported as an extra, never the only path —
 * every one of the four input methods independently sets the same clamped,
 * detent-snapped value via `onChange`.
 *
 * Reduced-motion: the index dot's position is computed directly from `scale`
 * on every render with no CSS transition at all (not merely a transition
 * that gets suppressed under prefers-reduced-motion) — it always repositions
 * instantly, which trivially satisfies the reduced-motion requirement and
 * sidesteps cross-browser quirks with animating SVG transform-origin.
 */
export function PortionKnob({ scale, onChange }: PortionKnobProps) {
  const labelId = useId();
  const typedId = useId();
  const knobRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState(scale.toFixed(2));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(scale.toFixed(2));
  }, [scale, editing]);

  function step(delta: number) {
    onChange(clampSnapScale(scale + delta));
  }

  function commitDraft() {
    const parsed = Number(draft);
    if (!Number.isNaN(parsed)) onChange(clampSnapScale(parsed));
    setEditing(false);
  }

  function onKnobKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        e.preventDefault();
        step(SCALE_STEP);
        break;
      case "ArrowDown":
      case "ArrowLeft":
        e.preventDefault();
        step(-SCALE_STEP);
        break;
      case "PageUp":
        e.preventDefault();
        onChange(clampSnapScale(scale + SCALE_STEP * 5));
        break;
      case "PageDown":
        e.preventDefault();
        onChange(clampSnapScale(scale - SCALE_STEP * 5));
        break;
      case "Home":
        e.preventDefault();
        onChange(SCALE_MIN);
        break;
      case "End":
        e.preventDefault();
        onChange(SCALE_MAX);
        break;
      default:
        break;
    }
  }

  function updateFromPointer(clientX: number, clientY: number) {
    const el = knobRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    // A pointer landing on the exact center (dx=dy=0 — a synthetic/
    // programmatic click is the realistic way this happens, a human pointer
    // is never pixel-exact) has no defined angle: Math.atan2(0, -0) resolves
    // to +/-PI (the arc's far end) rather than "no change", which would jerk
    // the value to a bound. Treat dead-center as a no-op instead.
    if (dx === 0 && dy === 0) return;
    const deg = Math.atan2(dx, -dy) * (180 / Math.PI);
    onChange(clampSnapScale(valueForAngle(deg)));
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;
    updateFromPointer(e.clientX, e.clientY);
  }

  const indexDeg = angleForValue(scale);
  const indexDot = polar(indexDeg, 34);
  const arcStart = polar(-ARC_HALF, 53);
  const arcEnd = polar(ARC_HALF, 53);

  return (
    <div className="mk-portion">
      <p id={labelId} className="mk-portion-label">
        portion size
      </p>
      <div className="mk-portion-row">
        <button
          type="button"
          className="fd5-control mk-step"
          aria-label="decrease portion by 5 percent"
          onClick={() => step(-SCALE_STEP)}
          disabled={scale <= SCALE_MIN}
        >
          −
        </button>

        <div
          ref={knobRef}
          className="mk-knob"
          role="slider"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-valuemin={SCALE_MIN}
          aria-valuemax={SCALE_MAX}
          aria-valuenow={scale}
          aria-valuetext={`× ${scale.toFixed(2)}`}
          onKeyDown={onKnobKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        >
          <svg viewBox="0 0 100 100" className="mk-face" aria-hidden="true" focusable="false">
            <circle cx={50} cy={50} r={44} className="mk-body" />
            {SCALE_DETENTS.map((d) => {
              const deg = angleForValue(d);
              const outer = polar(deg, 47);
              const inner = polar(deg, 39);
              const active = Math.abs(d - scale) < 0.001;
              return (
                <line
                  key={d}
                  x1={outer.x}
                  y1={outer.y}
                  x2={inner.x}
                  y2={inner.y}
                  className="mk-tick"
                  data-active={active || undefined}
                />
              );
            })}
            <text x={arcStart.x} y={arcStart.y} className="mk-arc-label" textAnchor="end">
              0.70
            </text>
            <text x={arcEnd.x} y={arcEnd.y} className="mk-arc-label" textAnchor="start">
              1.30
            </text>
            <circle cx={indexDot.x} cy={indexDot.y} r={3.4} className="mk-index-dot" />
          </svg>
        </div>

        <button
          type="button"
          className="fd5-control mk-step"
          aria-label="increase portion by 5 percent"
          onClick={() => step(SCALE_STEP)}
          disabled={scale >= SCALE_MAX}
        >
          +
        </button>
      </div>

      <div className="mk-portion-readout">
        <span className="mk-readout">× {scale.toFixed(2)}</span>
        <label htmlFor={typedId} className="mk-typed-label">
          type exact ×
        </label>
        <input
          id={typedId}
          type="number"
          inputMode="decimal"
          step={SCALE_STEP}
          min={SCALE_MIN}
          max={SCALE_MAX}
          className="fd5-control mk-typed-input"
          value={draft}
          onFocus={() => setEditing(true)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
              e.currentTarget.blur();
            }
          }}
        />
      </div>
    </div>
  );
}
