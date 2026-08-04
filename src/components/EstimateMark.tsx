export interface EstimateMarkProps {
  className?: string;
}

/** ≈ + dotted underline + sr-only "(estimate)" — the only allowed way to mark an estimate. */
export function EstimateMark({ className }: EstimateMarkProps) {
  return (
    <span className={["fd5-estimate", className].filter(Boolean).join(" ")}>
      {"≈"}
      <span className="fd5-visually-hidden"> (estimate)</span>
    </span>
  );
}
