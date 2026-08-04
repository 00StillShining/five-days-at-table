export interface ArbiterSlotProps {
  /** The rank-1 duty's text — verb-first, plain language. */
  text: string;
  /** Count of queued runners-up behind rank 1, if any. */
  count?: number;
  actionLabel?: string;
  onActivate?: () => void;
  busy?: boolean;
  className?: string;
}

/**
 * The attention arbiter's single act-now slot (PLAN §6.0 project signature). This is
 * the ONLY place --sol-accent-fill appears anywhere in the app. role="status" so
 * assistive tech is told when the text changes; the optional action is a real nested
 * <button>, not the whole banner, so the live-region role and button semantics never
 * collide. Reduced-motion-safe: the chevron carries data-motion so any future motion
 * on it collapses to a static glyph under prefers-reduced-motion.
 */
export function ArbiterSlot({ text, count, actionLabel, onActivate, busy, className }: ArbiterSlotProps) {
  return (
    <div
      className={["fd5-arbiter", className].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
      aria-busy={busy || undefined}
    >
      <span className="fd5-arbiter-chevron" aria-hidden="true" data-motion>
        ▸
      </span>
      <span className="fd5-arbiter-text">{text}</span>
      {typeof count === "number" && count > 0 && (
        <span className="fd5-arbiter-badge">{`+${count}`}</span>
      )}
      {onActivate && (
        <button type="button" className="fd5-control fd5-arbiter-action" onClick={onActivate}>
          {actionLabel ?? "act"}
        </button>
      )}
    </div>
  );
}
