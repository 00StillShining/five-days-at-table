import type { ReactNode } from "react";

export interface KeyProps {
  label: string;
  active?: boolean;
  onSelect: () => void;
  /** 1-5 hotkey digit shown as nonessential engraving; the actual listener lives in App.tsx. */
  hotkeyDigit?: number;
  disabled?: boolean;
  children?: ReactNode;
}

/**
 * Rail key. Real <button>; active state = key-face depression (inset box-shadow) +
 * aria-current="page" + bold label — never color alone (Sol §5.1 selected state).
 */
export function Key({ label, active, onSelect, hotkeyDigit, disabled, children }: KeyProps) {
  return (
    <button
      type="button"
      className="fd5-control fd5-key"
      aria-current={active ? "page" : undefined}
      onClick={onSelect}
      disabled={disabled}
    >
      <span className="fd5-key-label">{label}</span>
      {hotkeyDigit != null && (
        <span className="fd5-key-hotkey" aria-hidden="true">
          {hotkeyDigit}
        </span>
      )}
      {children}
    </button>
  );
}
