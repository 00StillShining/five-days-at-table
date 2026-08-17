/**
 * src/cd/foundry/Tray.tsx — II.3.30, and the ruling that goes with it.
 *
 * CD-BRIEF, owner ruling: "Drill-in and detail open as TRAYS THAT TRAVEL THEIR
 * OWN SIZE WITH NO SCRIM — the workspace beneath stays live and touchable, with
 * an explicit exit back to the screen it belongs to, and the rail always
 * available to leave entirely."
 *
 * Three consequences, all of them structural rather than stylistic:
 *
 *  1. THIS IS NOT A <dialog>. `showModal()` makes everything outside the dialog
 *     inert and paints the ::backdrop — a scrim by another name, and a dead
 *     workspace. The legacy `src/components/Sheet.tsx` is a modal <dialog> and
 *     stays exactly as it is for the screens that still use it; new work uses
 *     this instead.
 *  2. NO FOCUS TRAP. A trap is the keyboard's version of a scrim. Tab leaves
 *     the tray and reaches the workspace and the rail, which is the point.
 *     Escape closes, and focus returns to whatever opened it.
 *  3. THE EXIT IS AN OBJECT, not a convention. A tray always renders its own
 *     close key; there is no "click outside to dismiss" gesture, because there
 *     is no scrim to click and because a dismissal a hand can trigger by
 *     accident is not an exit.
 *
 * Travel: --cd-tray-open 280ms in, --cd-tray-close 220ms out (II.4.23), on
 * --cd-ease-settle, at Panel mass — spring(1.6, 240, 30), Weighted at chassis
 * scale, NOT a fifth class (II.1.2). Under prefers-reduced-motion the travel
 * survives at linear timing rather than being deleted: which edge a tray
 * belongs to is semantic, and II.4.26 translates, never deletes.
 */

import { useEffect, useId, useRef, type ReactNode } from "react";
import { PressKey } from "./PressKey";
import "./foundry.css";

export type TrayEdge = "inline-start" | "inline-end" | "block-end";

export interface TrayProps {
  open: boolean;
  onClose: () => void;
  /** Names the tray. Rendered as its heading AND as its accessible name. */
  title: string;
  /**
   * The exit's own word. "The screen it belongs to", named — not a bare glyph.
   * Default "close".
   */
  exitLabel?: string;
  /** Which edge the tray is a drawer out of. Default: inline-end. */
  edge?: TrayEdge;
  /** Rendered in the head, beside the title — a lamp, an age, a figure. */
  headSlot?: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
}

export function Tray({
  open,
  onClose,
  title,
  exitLabel = "close",
  edge = "inline-end",
  headSlot,
  children,
  className,
  id,
}: TrayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const invoker = useRef<Element | null>(null);
  const headingId = useId();

  // Focus moves IN on open and RETURNS on close. Not a trap — a courtesy that
  // the keyboard is owed and that a scrim would otherwise have provided.
  useEffect(() => {
    if (!open) return;
    invoker.current = document.activeElement;
    // The first frame after `visibility` flips is the earliest a child can
    // take focus; requestAnimationFrame is that frame.
    const handle = requestAnimationFrame(() => {
      const first = ref.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    });
    return () => {
      cancelAnimationFrame(handle);
      const back = invoker.current;
      if (back instanceof HTMLElement && document.contains(back)) back.focus();
    };
  }, [open]);

  // Escape closes from anywhere, including from the live workspace beneath —
  // the tray is open, so Escape means "shut the tray", wherever the hand is.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <div
      ref={ref}
      id={id}
      className={["cd-tray", className].filter(Boolean).join(" ")}
      data-cd-open={open ? "true" : "false"}
      data-cd-edge={edge}
      role="region"
      aria-labelledby={headingId}
    >
      <div className="cd-tray-head">
        <h2 id={headingId} className="cd-tray-title cd-engraved">
          {title}
        </h2>
        {headSlot}
        <PressKey onPress={onClose} cap={exitLabel} className="cd-tray-exit" />
      </div>
      <div className="cd-tray-body">{children}</div>
    </div>
  );
}
