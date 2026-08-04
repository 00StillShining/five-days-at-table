export interface ArbiterDuty {
  /** The rank-1 duty's text — verb-first, plain language. */
  text: string;
  actionLabel?: string;
  onActivate?: () => void;
  busy?: boolean;
}

export interface ArbiterSlotProps {
  /**
   * PREFERRED API: pass the screen's `arbiterFor(...).rank1` straight through
   * (`ArbiterDuty | null`).
   *
   * CONVENTION (wave-1 integration review): every screen renders exactly ONE
   * <ArbiterSlot>, ALWAYS — never behind a `{rank1 && ...}` conditional. When
   * rank1 is null this renders the quiet idle variant ("board's clear" by default,
   * plain panel, no --sol-accent-fill) instead of disappearing. accent-fill is
   * reserved for the moment a real act-now item occupies the slot — never for idle.
   */
  rank1?: ArbiterDuty | null;
  /** Runners-up behind rank1 — rendered as a quiet queue count. Ignored while idle. */
  count?: number;
  /** Idle-state copy, e.g. "board's clear". */
  idleText?: string;
  className?: string;

  // --- Legacy flat props (pre wave-1-fix screens: today/stores/list/meal/plan/shop
  // currently call with these directly, several behind a `{rank1 && ...}` guard).
  // Kept so those call sites keep compiling and rendering unchanged; superseded by
  // `rank1` once each screen migrates in its own fix round. New code: use `rank1`.
  text?: string;
  actionLabel?: string;
  onActivate?: () => void;
  busy?: boolean;
}

const DEFAULT_IDLE_TEXT = "board's clear";

/**
 * The attention arbiter's single act-now slot (PLAN §6.0 project signature). Across
 * the shared chassis and every playful-technical screen, this is the ONLY place
 * --sol-accent-fill appears — and only when a real duty occupies it; the idle variant
 * is a plain quiet panel (see convention above).
 *
 * SANCTIONED EXCEPTION: COOK (dark, precision-industrial) never renders this
 * component at all — the stopped reel is COOK's own act-now signal — so its "done ▸"
 * bottom edge (PLAN §6.6: `.scr-cook-done` / `.scr-cook-tally-done` in cook.css)
 * legitimately uses accent-fill too, as COOK's own single act-now control. That is
 * not a violation of this rule; do not "fix" it.
 *
 * role="status" so assistive tech is told when the text changes; the optional action
 * is a real nested <button>, not the whole banner, so the live-region role and button
 * semantics never collide. Reduced-motion-safe: the chevron carries data-motion so
 * any future motion on it collapses to a static glyph under prefers-reduced-motion.
 */
export function ArbiterSlot(props: ArbiterSlotProps) {
  const { rank1, count, idleText, className } = props;

  // `rank1` (even explicitly `null`) always wins once a caller opts into the new
  // API; legacy callers who never pass it fall back to the flat props they already
  // send, which are always non-idle today (see file header — known wave-1 gap,
  // fixed when those screens migrate to `rank1`).
  const duty: ArbiterDuty | null =
    rank1 !== undefined
      ? rank1
      : props.text !== undefined
        ? { text: props.text, actionLabel: props.actionLabel, onActivate: props.onActivate, busy: props.busy }
        : null;

  const isIdle = duty === null;

  return (
    <div
      className={["fd5-arbiter", isIdle && "fd5-arbiter--idle", className].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
      aria-busy={(duty?.busy) || undefined}
    >
      {!isIdle && (
        <span className="fd5-arbiter-chevron" aria-hidden="true" data-motion>
          ▸
        </span>
      )}
      <span className="fd5-arbiter-text">{isIdle ? (idleText ?? DEFAULT_IDLE_TEXT) : duty.text}</span>
      {!isIdle && typeof count === "number" && count > 0 && (
        <span className="fd5-arbiter-badge">{`+${count}`}</span>
      )}
      {!isIdle && duty.onActivate && (
        <button type="button" className="fd5-control fd5-arbiter-action" onClick={duty.onActivate}>
          {duty.actionLabel ?? "act"}
        </button>
      )}
    </div>
  );
}
