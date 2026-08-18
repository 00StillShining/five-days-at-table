/**
 * src/screens/list/HeadPlate.tsx — where you are, and what is owed. One plate.
 *
 * This is the annunciator (II.3.25) and the masthead in one enclosure, because
 * they answer the same question from two sides: the escutcheon says which trip
 * and which building, the tile says what that trip wants from the hand next.
 * Splitting them would have cost a phone 56px of vertical to say "and here is a
 * second box about the same thing".
 *
 * II.3.25, executed as written:
 *   the label is ENGRAVED WHILE DARK — "a dark annunciator still announces what
 *   it would say";
 *   the condition fires -> 2Hz square, 250ms on / 250ms off, no fade, until
 *   acknowledged; acknowledged and still true -> burns steady; cleared -> dark.
 *
 * WITH NO HUE TO FLASH. §2: "Focus, warning, danger, and success spend no hue at
 * all — a chevron, a checkmark, a keyline, weight against the field, never a
 * wash of paint." §9's own repair names the mark by hand: "force the tritone and
 * THE ALERT-INK CHEVRON". So the annunciator's lit state is the chevron at full
 * weight inside an alert-ink keyline, and what flashes is the keyline. Measured:
 * alert ink #1A1A1A on epoxy #9B9C9E = 6.33:1 — every reserved role but live
 * lives at that one figure, spent in weight.
 *
 * REDUCED MOTION. II.3.25 calls its flash timing fixed doctrine and II.4.26
 * calls the translation non-negotiable; the Floor outranks the tile. Under
 * prefers-reduced-motion the latched state BURNS STEADY and keeps its printed
 * word, which is a translation of the alarm and not a deletion of it.
 */

import type { ReactNode } from "react";
import { Enclosure, Escutcheon, Plate, PressKey } from "../../cd/foundry";
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

export interface HeadPlateProps {
  /** "full shop" | "day-7 top-up" — the trip's own kind. */
  kind: string;
  /** The active plan variant's label when it is not the full fortnight. */
  variantLabel: string | null;
  /**
   * The station bar, mounted ON this plate rather than beside it. Which
   * building you are standing in IS part of the plate's own identity line, and
   * a phone has no vertical to spend on a second enclosure saying so.
   */
  stationSlot: ReactNode;
  arbiterKind: ArbiterKind | null;
  text: string | null;
  queued: number;
  actionLabel: string | null;
  onActivate: (() => void) | null;
  acknowledged: boolean;
  onAcknowledge: () => void;
}

export function HeadPlate({
  kind,
  variantLabel,
  stationSlot,
  arbiterKind,
  text,
  queued,
  actionLabel,
  onActivate,
  acknowledged,
  onAcknowledge,
}: HeadPlateProps) {
  const latching = arbiterKind != null && LATCHING.has(arbiterKind);
  const state = arbiterKind == null ? "dark" : latching && !acknowledged ? "latched" : "steady";

  /* The tile's word is the CLASS, engraved permanently; the face carries the
     INSTANCE. src/engine/arbiter.ts is frozen and its own copy repeats the
     class word ("verify price · Chipotles ..."), so the repeat is trimmed here
     rather than printed twice on one plate — two words saying one thing is the
     over-decoration §9 opens with. */
  const word = arbiterKind ? KIND_WORD[arbiterKind] : "nothing owed";
  const detail =
    text && arbiterKind && text.toLowerCase().startsWith(word)
      ? text.slice(word.length).replace(/^[\s·]+/, "")
      : text;

  return (
    <Enclosure variant="hero" as="header" className="lst-head" data-lst-ann={state}>
      <div className="lst-head-id">
        <Escutcheon as="h1" className="lst-head-kind">
          {kind}
        </Escutcheon>
        {variantLabel ? <Escutcheon className="lst-head-variant">{variantLabel}</Escutcheon> : null}
        {stationSlot}
      </div>

      <div className="lst-ann" role="status" aria-label="attention arbiter">
        {/* The chevron is present in BOTH states, engraved into the plate.
            A vanishing indicator is indistinguishable from a missing one. */}
        <span className="lst-ann-chevron" aria-hidden="true" />

        <Plate className="lst-ann-face" surface="data">
          <span className="lst-ann-word">{word}</span>
          <span className="lst-ann-text">{detail ?? "no duty is competing for this slot"}</span>
          {/* Runners-up render quiet with a queue count. A number, always. */}
          <span className="lst-ann-queue cd-printed" aria-label={`${queued} behind`}>
            <span className="cd-value" style={{ "--cd-value-ch": 2 } as React.CSSProperties}>
              {queued}
            </span>
            <span className="cd-unit">behind</span>
          </span>
        </Plate>

        <div className="lst-ann-keys">
          {state === "latched" && (
            <PressKey className="lst-ann-ack" onPress={onAcknowledge} cap="ack" aria-label="acknowledge alarm" />
          )}
          {onActivate && actionLabel && (
            <PressKey className="lst-ann-go" onPress={onActivate} cap={actionLabel} />
          )}
        </div>
      </div>
    </Enclosure>
  );
}
