/**
 * src/screens/today/Annunciator.tsx — the attention arbiter, as a real one.
 *
 * PLAN 6.0's project signature: exactly one act-now slot per screen, urgency
 * competing in a fixed priority queue, "runners-up render quiet with a queue
 * count and inherit the slot when rank 1 clears". `src/engine/arbiter.ts` is
 * frozen and already computes {rank1, queued}; this is the instrument that
 * reports it.
 *
 * II.3.25, the annunciator, executed as written:
 *   tile with its label ENGRAVED WHILE DARK — "a dark annunciator still
 *   announces what it would say";
 *   condition fires -> 2Hz square flash, 250ms lit / 250ms dark, NO FADE,
 *   until acknowledged;
 *   acknowledged and still true -> burns steady;
 *   condition cleared -> dark.
 *
 * WHICH CONDITIONS LATCH. Only the three the arbiter itself ranks as urgent —
 * expired stock, an overdue defrost move, a timer that has run out. The other
 * three kinds (over-band, verify-nominee, primary-action) are standing facts
 * rather than alarms, and a tile that flashes at the primary action would teach
 * the room to ignore the flash — II.5.8's reasoning about the warning tritone,
 * applied to light.
 *
 * The acknowledgement lives in the chassis panel store (CD-BRIEF R6), keyed by
 * the duty's own id, so acknowledging an alarm and walking to STORES does not
 * bring the flash back on return — and a RELOAD genuinely resets it, which is
 * the second half of that ruling.
 */

import { Enclosure, Escutcheon, Lamp, Plate, PressKey } from "../../cd/foundry";
import type { ArbiterKind } from "../../engine/arbiter";

/** II.3.25 — these latch. Everything else burns steady or stays dark. */
export const LATCHING: ReadonlySet<ArbiterKind> = new Set<ArbiterKind>([
  "expired",
  "defrost-overdue",
  "timer-due",
]);

const KIND_WORD: Record<ArbiterKind, string> = {
  expired: "expired",
  "defrost-overdue": "overdue",
  "timer-due": "timer",
  "over-band": "over band",
  "verify-nominee": "verify",
  "primary-action": "act now",
};

export interface AnnunciatorProps {
  kind: ArbiterKind | null;
  text: string | null;
  /** How many candidates sit behind rank 1. */
  queued: number;
  actionLabel: string | null;
  onActivate: (() => void) | null;
  acknowledged: boolean;
  onAcknowledge: () => void;
}

export function Annunciator({
  kind,
  text,
  queued,
  actionLabel,
  onActivate,
  acknowledged,
  onAcknowledge,
}: AnnunciatorProps) {
  const latching = kind != null && LATCHING.has(kind);
  const state = kind == null ? "dark" : latching && !acknowledged ? "latched" : "steady";

  return (
    <Enclosure
      variant="pod"
      as="section"
      className="tdy-ann"
      data-tdy-ann={state}
      aria-label="attention arbiter"
      role="status"
    >
      <div className="tdy-ann-tile">
        <Lamp
          lit={state !== "dark"}
          word={{ on: kind ? KIND_WORD[kind] : "act now", off: "clear" }}
          label="attention arbiter"
          hue={latching ? "var(--cd-role-danger-zone-dark)" : "var(--cd-role-warning)"}
          showWord={false}
        />
        {/* The label is engraved on the tile in BOTH states — a dark
            annunciator still announces what it would say. */}
        <Escutcheon as="h2" className="tdy-ann-word">
          {kind ? KIND_WORD[kind] : "nothing owed"}
        </Escutcheon>
      </div>

      <Plate className="tdy-ann-face" surface="data">
        <span className="tdy-ann-text">{text ?? "no duty is competing for this slot"}</span>
        {/* "Runners-up render quiet with a queue count." A number, always —
            never a plus-sign or a badge that stops counting past nine. */}
        <span className="tdy-ann-queue cd-printed" aria-label={`${queued} behind`}>
          <span className="cd-value" style={{ "--cd-value-ch": 2 } as React.CSSProperties}>
            {queued}
          </span>
          <span className="cd-unit">behind</span>
        </span>
      </Plate>

      <div className="tdy-ann-keys">
        {state === "latched" && (
          <PressKey className="tdy-ann-ack" onPress={onAcknowledge} sound="contact" cap="ack" aria-label="acknowledge alarm" />
        )}
        {onActivate && actionLabel && (
          <PressKey className="tdy-ann-go" onPress={onActivate} sound="none" cap={actionLabel} />
        )}
      </div>
    </Enclosure>
  );
}
