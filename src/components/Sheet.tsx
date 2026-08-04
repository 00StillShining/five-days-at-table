import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
}

/**
 * Drill-in container built on the native <dialog> element — Esc-to-close and focus
 * trapping come for free from the platform. Max one level: do not mount a Sheet
 * inside another Sheet's children (Depth: rail -> scene -> max one drill-in).
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className="fd5-sheet"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="fd5-sheet-head">
        <h2 id={titleId} className="fd5-sheet-title">
          {title}
        </h2>
        <button type="button" className="fd5-control fd5-sheet-close" onClick={onClose}>
          {"‹"} back
        </button>
      </div>
      <div className="fd5-sheet-body">{children}</div>
    </dialog>
  );
}
