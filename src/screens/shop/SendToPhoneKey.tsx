// SHOP's hero (PLAN §6.8/§6.10): the send-to-phone key. ONE convex key
// (flat-rendered in Phase 2 — the convex machining is a polish-phase attach
// point) that flips up a card with a QR code, a compact URL line, and
// copy-to-clipboard for both the URL and a plain-text list, with a visible
// textarea fallback (D2). Contract: key >=56px, keyboard operable, QR card
// closable, copy actions announce success in text.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { TripEnvelope } from "../../engine/tripCodec";
import { encodeTrip } from "../../engine/tripCodec";
import { encodeQr, qrToSvgPath } from "./qr";
import { plainTextList } from "./tripHelpers";

export interface SendToPhoneKeyProps {
  /** null = nothing to buy this trip — the key still opens (so it stays
   * discoverable/keyboard-reachable) but explains there's nothing to send,
   * rather than disabling itself outright. */
  envelope: TripEnvelope | null;
  /** Controlled open state (index.tsx also opens this from the app-wide
   * ArbiterSlot's "send to phone →" action — PLAN §6.0's single act-now
   * slot has to be able to drive every screen's own primary control). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** So index.tsx can scroll the hero into view from the arbiter action. */
  containerRef?: (el: HTMLDivElement | null) => void;
}

const QR_RENDER_PX = 288; // contract: "scannable at >=256px"

async function copyText(text: string, fallbackArea: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the execCommand fallback below
  }
  if (fallbackArea) {
    try {
      fallbackArea.focus();
      fallbackArea.select();
      // execCommand is deprecated but remains the only synchronous copy path
      // available when the async Clipboard API is unavailable/denied — kept
      // deliberately as the D2 fallback, not by oversight.
      const ok = document.execCommand("copy");
      if (ok) return true;
    } catch {
      // fall through to reporting failure — the textarea stays visibly selected
      // either way, so a manual copy is still one keystroke away.
    }
  }
  return false;
}

export function SendToPhoneKey({ envelope, open, onOpenChange, containerRef }: SendToPhoneKeyProps) {
  const [status, setStatus] = useState<string>("");
  const panelId = useId();
  const keyRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const statusTimer = useRef<number | null>(null);

  const url = useMemo(() => {
    if (!envelope || typeof window === "undefined") return null;
    const encoded = encodeTrip(envelope);
    return `${window.location.origin}${window.location.pathname}#/list?t=${encoded}`;
  }, [envelope]);

  const plainText = useMemo(() => (envelope ? plainTextList(envelope) : ""), [envelope]);

  const qr = useMemo(() => (url ? encodeQr(url) : null), [url]);
  const qrPath = useMemo(() => (qr ? qrToSvgPath(qr) : null), [qr]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => () => {
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
  }, []);

  function announce(message: string) {
    setStatus(message);
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(""), 6000);
  }

  function closePanel() {
    onOpenChange(false);
    keyRef.current?.focus();
  }

  async function handleCopyUrl() {
    if (!url) return;
    const ok = await copyText(url, null);
    announce(ok ? "link copied" : "couldn't copy automatically — select the link text and copy manually");
  }

  async function handleCopyList() {
    if (!plainText) return;
    const ok = await copyText(plainText, textareaRef.current);
    announce(ok ? "list copied" : "couldn't copy automatically — select the list below and copy manually");
  }

  const empty = !envelope || envelope.shops.length === 0;

  return (
    <div className="scr-shop-hero" ref={containerRef}>
      <button
        ref={keyRef}
        type="button"
        className={`fd5-control scr-shop-key${open ? " scr-shop-key--open" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
      >
        <span className="scr-shop-key-glyph" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
            <rect x="6" y="2" width="12" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <line x1="10" y1="18.2" x2="14" y2="18.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <span className="scr-shop-key-label">send to phone</span>
      </button>

      {open && (
        <div
          id={panelId}
          className="scr-shop-flipcard"
          role="group"
          aria-label="send this trip to your phone"
          onKeyDown={(e) => {
            if (e.key === "Escape") closePanel();
          }}
        >
          <div className="scr-shop-flipcard-head">
            <p className="scr-shop-flipcard-title">send to phone</p>
            <button ref={closeRef} type="button" className="fd5-control scr-shop-flipcard-close" onClick={closePanel}>
              close ×
            </button>
          </div>

          {empty ? (
            <p className="scr-shop-flipcard-empty">nothing to buy this trip — nothing to send.</p>
          ) : (
            <>
              {qrPath && qr ? (
                <svg
                  className="scr-shop-qr"
                  viewBox={`0 0 ${qr.size} ${qr.size}`}
                  width={QR_RENDER_PX}
                  height={QR_RENDER_PX}
                  role="img"
                  aria-label="QR code — scan with your phone to open this trip's shopping list"
                >
                  <rect x={0} y={0} width={qr.size} height={qr.size} fill="#ffffff" />
                  <path d={qrPath} fill="#000000" />
                </svg>
              ) : (
                <p className="scr-shop-qr-fallback">
                  this trip's list is too large for a single QR code — use the link or the copy-list button below instead.
                </p>
              )}

              <div className="scr-shop-url-row">
                <label htmlFor={`${panelId}-url`} className="fd5-visually-hidden">
                  shopping list link
                </label>
                <input
                  id={`${panelId}-url`}
                  className="fd5-control scr-shop-url-input"
                  type="text"
                  readOnly
                  value={url ?? ""}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button type="button" className="fd5-control scr-shop-copy-btn" onClick={handleCopyUrl}>
                  copy link
                </button>
              </div>

              <button type="button" className="fd5-control scr-shop-copy-list-btn" onClick={handleCopyList}>
                copy list as text
              </button>

              <label htmlFor={`${panelId}-text`} className="scr-shop-textarea-label">
                plain-text list (fallback — select all, copy)
              </label>
              <textarea id={`${panelId}-text`} ref={textareaRef} className="fd5-control scr-shop-textarea" readOnly value={plainText} rows={6} />

              <p className="scr-shop-copy-status" role="status" aria-live="polite">
                {status}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
