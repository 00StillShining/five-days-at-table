export interface CycleCursorProps {
  station: string;
}

/**
 * The small --sol-focus dot marking the weekday-suggested station under the loop
 * rail (PLAN §6.2 / D6). Advisory only — LoopRail places one of these under a key,
 * it never reorders or hides the keys themselves. The accessible label always states
 * the suggestion as text, independent of the dot's presence.
 */
export function CycleCursor({ station }: CycleCursorProps) {
  return (
    <span className="fd5-cycle-cursor-wrap">
      <span className="fd5-cycle-cursor" aria-hidden="true" />
      <span className="fd5-visually-hidden">{`suggested now: ${station}`}</span>
    </span>
  );
}
