export interface PaddleOption {
  value: string;
  label: string;
}

export interface PaddleProps {
  /**
   * Accessible subject of the switch, e.g. "week" or "cover". Stays constant across
   * toggles — atlas §4.4's switch rule requires "an unchanging label and programmatic
   * checked state". The current VALUE (a/b, her/him) is announced separately by the
   * caller via a shared live region, since plain on/off doesn't convey it.
   */
  name: string;
  /** false = optionA is active, true = optionB is active. */
  checked: boolean;
  optionA: PaddleOption;
  optionB: PaddleOption;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * Two-position paddle switch (PLAN §6.2). Real role="switch" + programmatic
 * aria-checked; both option labels stay visibly on screen always, and the active one
 * is marked by BOTH position (the sliding highlight) and label weight/underline —
 * never by color alone.
 */
export function Paddle({ name, checked, optionA, optionB, onToggle, disabled }: PaddleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={name}
      className="fd5-control fd5-paddle"
      data-pos={checked ? "b" : "a"}
      onClick={onToggle}
      disabled={disabled}
    >
      <span className="fd5-paddle-name" aria-hidden="true">
        {name}
      </span>
      <span className="fd5-paddle-track" aria-hidden="true">
        <span className="fd5-paddle-opt" data-active={!checked || undefined}>
          {optionA.label}
        </span>
        <span className="fd5-paddle-opt" data-active={checked || undefined}>
          {optionB.label}
        </span>
      </span>
    </button>
  );
}
