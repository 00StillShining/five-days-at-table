/**
 * src/screens/shop/SendTray.tsx — the one cross-screen contract in the product.
 *
 * ---------------------------------------------------------------------------
 * PINNED, AND UNCHANGED
 * ---------------------------------------------------------------------------
 * The envelope shape, `encodeTrip`, the `#/list?t=<payload>` URL, the QR encoder
 * in ./qr.ts, the 288px render size, `plainTextList`, the clipboard path and its
 * visible-textarea fallback are carried over from the shipped build BYTE FOR
 * BYTE IN BEHAVIOUR. LIST has already landed against this and decodes what this
 * produces; the orchestrator pinned the wire format and it is not touched here.
 * What changed is the housing it sits in — a horizon tray instead of a flip
 * card — and nothing else.
 *
 * ---------------------------------------------------------------------------
 * WHY THE TRAY OPENS SIDEWAYS EVEN ON A PHONE
 * ---------------------------------------------------------------------------
 * Section 3: "A tray in this world never opens in the direction of its own
 * trigger unless that trigger already sits on the world's one axis; instead it
 * always opens sideways, along the horizon's own line, because nothing here is
 * permitted a second direction of travel." The foundry's Tray takes an edge, and
 * this passes `inline-end` at every viewport — including the narrow one where
 * the chassis rail has moved to the block end and a bottom sheet would have been
 * the obvious choice. Carried at Panel mass, spring(1.6, 240, 30).
 *
 * ---------------------------------------------------------------------------
 * THE QR IS THE ONE THING FORCED-COLOURS MAY NOT REPAINT
 * ---------------------------------------------------------------------------
 * A QR code is a machine-readable pattern whose contract is a black module on a
 * white quiet zone. shop.css holds its literals with `forced-color-adjust: none`
 * — the single sanctioned exception on this screen, stated rather than smuggled.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Tray } from "../../cd/foundry";
import { encodeTrip, type TripEnvelope } from "../../engine/tripCodec";
import { caution } from "../../cd/sound/cues";
import { encodeQr, qrToSvgPath } from "./qr";
import { CapKey } from "./Instruments";
import { plainTextList } from "./tripHelpers";

const QR_RENDER_PX = 288; // contract: "scannable at >=256px"

export interface SendTrayProps {
  envelope: TripEnvelope | null;
  open: boolean;
  onClose: () => void;
  id: string;
}

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
      // the textarea stays visibly selected either way, so a manual copy is
      // still one keystroke away.
    }
  }
  return false;
}

export function SendTray({ envelope, open, onClose, id }: SendTrayProps) {
  const [status, setStatus] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const statusTimer = useRef<number | null>(null);
  const overflowRef = useRef(false);
  const fieldId = useId();

  const url = useMemo(() => {
    if (!envelope || typeof window === "undefined") return null;
    const encoded = encodeTrip(envelope);
    return `${window.location.origin}${window.location.pathname}#/list?t=${encoded}`;
  }, [envelope]);

  const plainText = useMemo(() => (envelope ? plainTextList(envelope) : ""), [envelope]);
  const qr = useMemo(() => (url ? encodeQr(url) : null), [url]);
  const qrPath = useMemo(() => (qr ? qrToSvgPath(qr) : null), [qr]);

  /*
    THE ONE GENUINE LIMIT ON THIS SCREEN. Section 2 reserves the resistance amber
    "so tightly — soft-limit and hard-limit warnings only — that most operators
    never see it in a working session". A trip too large for a single QR is a
    real hard limit with a real ceiling behind it (2953 bytes at version 40 /
    level L), so it earns the reserved role, its printed word, and the LOWER
    severity cue once per crossing. It never earns the repeating tritone: II.5.8
    reserves that for a fault, and an oversized list is not a fault, it is a
    ceiling, and the link beside it still works.
  */
  const overflow = Boolean(url) && !qr;
  useEffect(() => {
    if (overflow && !overflowRef.current && open) caution();
    overflowRef.current = overflow;
  }, [overflow, open]);

  useEffect(
    () => () => {
      if (statusTimer.current) window.clearTimeout(statusTimer.current);
    },
    []
  );

  function announce(message: string) {
    setStatus(message);
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(""), 6000);
  }

  const empty = !envelope || envelope.shops.length === 0;

  return (
    <Tray
      id={id}
      open={open}
      onClose={onClose}
      edge="inline-end"
      title="send to phone"
      exitLabel="close"
      className="shop-tray"
    >
      <div className="shop-tray-body">
        {empty ? (
          <p className="shop-note">nothing to buy this trip — nothing to send.</p>
        ) : (
          <>
            {qrPath && qr ? (
              <svg
                className="shop-qr"
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
              <p className="shop-note" data-shop-limit="hard" role="status">
                <b className="shop-limit-word">over qr capacity</b> — this trip's list is larger than a
                single code can carry. use the link or the copy-list key below instead.
              </p>
            )}

            <div className="shop-url-row">
              <label htmlFor={`${fieldId}-url`} className="fd5-visually-hidden">
                shopping list link
              </label>
              <input
                id={`${fieldId}-url`}
                className="shop-input cd-focusable"
                type="text"
                readOnly
                value={url ?? ""}
                onFocus={(e) => e.currentTarget.select()}
              />
              <CapKey
                cap="copy link"
                onPress={() => {
                  if (!url) return;
                  void copyText(url, null).then((ok) =>
                    announce(ok ? "link copied" : "couldn't copy — select the link and copy manually")
                  );
                }}
              />
            </div>

            <CapKey
              cap="copy list as text"
              onPress={() => {
                if (!plainText) return;
                void copyText(plainText, textareaRef.current).then((ok) =>
                  announce(ok ? "list copied" : "couldn't copy — select the list below and copy manually")
                );
              }}
            />

            <label htmlFor={`${fieldId}-text`} className="shop-note">
              plain-text list (fallback — select all, copy)
            </label>
            <textarea
              id={`${fieldId}-text`}
              ref={textareaRef}
              className="shop-textarea cd-focusable"
              readOnly
              value={plainText}
              rows={8}
            />

            <p className="shop-status" role="status" aria-live="polite">
              {status}
            </p>
          </>
        )}
      </div>
    </Tray>
  );
}
