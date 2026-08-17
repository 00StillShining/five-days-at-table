/**
 * src/cd/foundry/PressKey.tsx — a control that looks operable and IS operable.
 *
 * II.3.13 — the Foundry button: Standard mass, COMMITS ON RELEASE inside
 * bounds. A press that has left the control's bounds is abandoned, which is
 * what the browser's own `click` semantics already give us for pointers, and
 * what Enter/Space already give us for the keyboard. So this is a real
 * <button>: no div wearing a role, no synthesised activation, no second code
 * path for the keyboard to drift down (II.1.18, II.3.4).
 *
 * II.4.3 — contact answers on two strokes: the down-stroke lands within one
 * rendered frame (20ms, linear, no easing) and the release settles over 80ms
 * on --cd-ease-settle, inside the 60-100ms band. Both live in foundry.css;
 * this component's only job is to own the `data-cd-pressed` flag for POINTER
 * and KEYBOARD alike, so a key pressed with the keyboard blooms exactly as one
 * pressed with a thumb.
 *
 * CORRECTIONARY 5.7 — "If a control could be mistaken for a static icon, it
 * has failed. If it can't be operated by keyboard as well as pointer, it has
 * failed the floor."
 *
 * SOUND IS OPT-IN, AND OFF BY DEFAULT. II.5.16's silence list already bans a
 * cue for navigation of every kind, and 13 BACK CHANNEL retires the audible
 * half of contact outright for its own key ("a control with no mechanical
 * travel has no dry click to make honestly"). A default of "make a noise"
 * would have made every consumer remember to turn it off; the default is
 * silence and a screen opts in from its own chapter's voicing.
 *
 * HAPTIC is fired wherever the platform grants it, on the down-stroke, in the
 * same frame as the bloom — never as a substitute for either. iOS Safari has
 * no navigator.vibrate at all, which is why every call is optional-chained and
 * nothing downstream reads a return value from it.
 */

import { useCallback, useRef, useState, type ReactNode } from "react";
import { cue, type CueName } from "../sound/cues";
import "./foundry.css";

/** II.4.3 / the chapter's Answer Key: the release settle, in ms. */
export const RELEASE_SETTLE_MS = 90;

/** The paired haptic. 10ms on contact, per 13 BACK CHANNEL's own worked key. */
export const HAPTIC_CONTACT_MS = 10;

export interface PressKeyProps {
  onPress: () => void;
  /**
   * Extra key handling, merged with this control's own down/up stroke rather
   * than replacing it — a consumer that needs arrow-key navigation between
   * sibling keys (the Register's headers, the rail's stations) must not have
   * to give up the contact bloom to get it.
   */
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  children?: ReactNode;
  /** The engraved cap word, when the caller wants the standard cap treatment. */
  cap?: string;
  /**
   * An audible cue on the down-stroke. Default: none. Pass "contact" only
   * where the screen's own chapter voices contact — never for navigation
   * (II.5.16), and never in 13 BACK CHANNEL.
   */
  sound?: CueName | "none";
  /** Milliseconds of haptic on the down-stroke. 0 disables it. */
  haptic?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  type?: "button" | "submit";
  [key: `data-${string}`]: unknown;
  [key: `aria-${string}`]: unknown;
  id?: string;
}

export function PressKey({
  onPress,
  onKeyDown,
  children,
  cap,
  sound = "none",
  haptic = HAPTIC_CONTACT_MS,
  disabled,
  className,
  type = "button",
  ...rest
}: PressKeyProps) {
  const [pressed, setPressed] = useState(false);
  const releaseTimer = useRef<number | null>(null);

  const down = useCallback(() => {
    if (disabled) return;
    setPressed(true);
    if (haptic > 0) navigator.vibrate?.(haptic);
    if (sound !== "none") cue(sound);
  }, [disabled, haptic, sound]);

  const up = useCallback(() => {
    setPressed(false);
    if (releaseTimer.current != null) window.clearTimeout(releaseTimer.current);
  }, []);

  return (
    <button
      type={type}
      className={["cd-key", "cd-focusable", className].filter(Boolean).join(" ")}
      data-cd-pressed={pressed ? "true" : undefined}
      disabled={disabled}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        // Enter and Space are this control's own down-stroke. `repeat` is
        // dropped: II.1.18 refuses the OS repeat clock outright, and a held
        // key must not machine-gun a commit.
        if (event.repeat) return;
        if (event.key === " " || event.key === "Enter") down();
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") up();
      }}
      onBlur={up}
      onClick={() => {
        if (disabled) return;
        onPress();
      }}
      {...rest}
    >
      {cap ? <span className="cd-key-cap">{cap}</span> : null}
      {children}
    </button>
  );
}
