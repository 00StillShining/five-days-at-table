export interface PaddleOption {
  value: string;
  label: string;
}

export interface PaddleProps {
  /** Accessible subject of the switch, e.g. "week" or "cover". */
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
  const current = checked ? optionB : optionA;
  const other = checked ? optionA : optionB;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${name}: ${current.label}. activate to switch to ${other.label}`}
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
