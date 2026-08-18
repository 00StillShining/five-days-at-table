/**
 * src/screens/list/ThumbPlate.tsx — the three consequences, under the thumb.
 *
 * FIXED POSITION IS THE WHOLE POINT. This screen is operated one-handed in a
 * shop, and the row a hand just pressed is about to stop being rendered. An
 * undo that chases a disappearing row down a list is not an undo. So the
 * put-back lives here, in the same place, always, and what changes is only
 * whether it is armed and which item it names.
 *
 * ONE KEY PER CONSEQUENCE, never one key wearing three meanings. A key whose
 * action changes under a thumb already in flight is a mis-tap waiting to be
 * blamed on the hand that touched it, which is the exact failure IRREDUCIBLE
 * exists to refuse (§1: "cannot be blamed on the hand that touched it").
 *
 * §3, SYSTÈME S, AND WHY PUT-BACK IS ITS OWN CONTROL. "A press against a window
 * already running does nothing." The row's own press therefore cannot undo the
 * row: a second tap is inert, which in a shop is a free double-tap guard on a
 * jostled thumb. Putting an item back is a different act from picking it up, so
 * it gets a different control — and screencraft/02's reach law agrees: the
 * frequent gesture is on the plate, the rarer one is beside it.
 *
 * THE GAUGE IS THE WINDOW, DRAWN. §3's flow gauge, at 1.25rem wide, in the live
 * well: it fills whole the instant the release lands and then tapers to zero
 * over 1800ms on --lst-ease-taper. It is the only place on this screen where a
 * hue appears at all, because it is the only thing here that is genuinely
 * RUNNING (§2: "live is the one role that keeps its hue, because a process
 * either truly runs or it does not").
 */

import { Enclosure, PressKey } from "../../cd/foundry";
import { cue } from "../../cd/sound/cues";

export interface ThumbPlateProps {
  /** The item the open window belongs to, or null when nothing is running. */
  pendingLabel: string | null;
  /** Restarts the gauge's taper: a new window is a new element, not a rewind. */
  pendingKey: string | null;
  runOutMs: number;
  onPutBack: () => void;
  /** The next aisle still owing rows, for the key's own cap word. */
  nextAisle: string | null;
  onNext: () => void;
  onClose: () => void;
  closeLabel: string;
}

export function ThumbPlate({
  pendingLabel,
  pendingKey,
  runOutMs,
  onPutBack,
  nextAisle,
  onNext,
  onClose,
  closeLabel,
}: ThumbPlateProps) {
  return (
    <Enclosure variant="faceplate" as="footer" className="lst-thumb" grain>
      <PressKey
        className="lst-putback cd-focusable"
        disabled={pendingLabel == null}
        onPress={() => {
          // §6 — contact fires ON RELEASE, never the down-stroke: "a cue on the
          // press would report before Système S lets the water move." PressKey
          // voices on the DOWN stroke, so it is left silent and the release is
          // voiced here, inside the commit's own task.
          cue("contact");
          onPutBack();
        }}
        aria-label={pendingLabel ? `put back ${pendingLabel}` : "put back — nothing in the window"}
      >
        {/* THE FLOW GAUGE. Keyed on the window so a second press opens a new
            element with a fresh taper rather than rewinding an old one. */}
        <span
          key={pendingKey ?? "idle"}
          className="lst-runout"
          data-lst-running={pendingLabel ? "true" : "false"}
          style={{ "--lst-runout-ms": `${runOutMs}ms` } as React.CSSProperties}
          aria-hidden="true"
        >
          <span className="lst-runout-fill" />
        </span>
        <span className="lst-key-stack" aria-hidden="true">
          <span className="lst-key-cap">put back</span>
          <span className="lst-key-sub">
            {pendingLabel ?? `${(runOutMs / 1000).toFixed(1)}s window`}
          </span>
        </span>
      </PressKey>

      <PressKey
        className="lst-next"
        disabled={nextAisle == null}
        /* II.5.16's silence list bans a cue for navigation of every kind, and
           this key only moves the eye and the focus ring. Silent. */
        onPress={onNext}
        aria-label={nextAisle ? `next — ${nextAisle}` : "next — nothing left to fetch"}
      >
        <span className="lst-key-stack" aria-hidden="true">
          <span className="lst-key-cap">next</span>
          <span className="lst-key-sub">{nextAisle ?? "clear"}</span>
        </span>
      </PressKey>

      <PressKey
        className="lst-close"
        /* structure disclosing — a tray opening is on II.5.16's silence list */
        onPress={onClose}
        aria-label="close read — the trip, summed, with the verify read-back"
      >
        <span className="lst-key-stack" aria-hidden="true">
          <span className="lst-key-cap">{closeLabel}</span>
          <span className="lst-key-sub">read-back</span>
        </span>
      </PressKey>
    </Enclosure>
  );
}
