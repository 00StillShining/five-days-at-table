/**
 * src/screens/today/TickBank.tsx — the four slot keys, and the day's tally.
 *
 * ch.05 section 3, the GATED COMMIT BUTTON: "a rod visible through a milled
 * slot that overtravels 1px on press and is pulled back to centre by the
 * Anchored spring `spring(1.2, 300, 38)` the instant the hand releases without
 * a full commit — the digital descendant of the gear lever's own positive
 * spring bias toward its centre-line."
 *
 * A tick is the one thing on TODAY the operator's hand actually changes, so it
 * is the one control that earns visible travel: the rod moves, the key seats,
 * the verdigris confirm lands under it, and the hero needle answers in the same
 * task. "A value that changes has a visible part that moved to change it."
 *
 * ---------------------------------------------------------------------------
 * WHY UN-TICKING IS NOT GUARDED
 * ---------------------------------------------------------------------------
 * II.3.16's latch asks for a 350ms hold to release, and screencraft/02 asks for
 * a guard on "anything consequential". A tick is a household log line, its whole
 * state is visible on the key, and correcting a mis-tap is the commonest thing
 * that will ever happen here. Putting a 350ms hold on the correction would tax
 * the honest case to protect nothing — the guarded switch is spent on TODAY's
 * one genuinely irreversible act instead, and this is stated rather than
 * quietly skipped (CORRECTIONARY 6.5).
 */

import { Enclosure, Escutcheon, Plate, PressKey } from "../../cd/foundry";
import type { Slot } from "../../data/types";
import type { Age } from "../../cd/freshness/classes";

export interface SlotCell {
  slot: Slot;
  label: string;
  /** null when this slot is cut in the active plan variant. */
  mealId: string | null;
  mealName: string | null;
  /** The tester's own stated reason. Printed verbatim, never paraphrased. */
  cutReason: string | null;
  ticked: boolean;
  /** "HH:MM" the tick landed. null when it has not. */
  at: string | null;
  age: Age;
}

export interface TickBankProps {
  cells: SlotCell[];
  onToggle: (cell: SlotCell) => void;
  /** The declared threshold this freshness class prints on its own label. */
  threshold: string;
  /**
   * The slot whose commit landed IN THIS SESSION, within the confirm event's
   * own hold + decay. II.7.13 makes success an event; an event replayed on
   * mount for a tick that landed this morning is a false report, so the flash
   * is driven by this and never by the persisted state.
   */
  justCommitted: Slot | null;
  trophy: boolean;
}

export function TickBank({ cells, onToggle, threshold, justCommitted, trophy }: TickBankProps) {
  const cookable = cells.filter((c) => c.mealId != null);
  const ticked = cookable.filter((c) => c.ticked).length;
  const cut = cells.length - cookable.length;

  return (
    <Enclosure variant="hero" as="section" grain className="tdy-bank" aria-label="plate log">
      <header className="tdy-cluster-head">
        <Escutcheon as="h2">
          plate log
        </Escutcheon>
        <Escutcheon className="tdy-bank-threshold">stale after {threshold}</Escutcheon>
      </header>

      {/* The tally is an instrument too: a figure and a printed denominator,
          not a bare number. It is one of Trophy Mode's survivors. */}
      <Plate className="tdy-bank-tally" surface="data">
        <span className="cd-value tdy-tally-figure" style={{ "--cd-value-ch": 1 } as React.CSSProperties}>
          {ticked}
        </span>
        <span className="tdy-tally-of cd-printed">of {cookable.length} logged</span>
        {cut > 0 && <span className="tdy-tally-cut cd-silkscreen">{cut} cut</span>}
      </Plate>

      <ul className="tdy-bank-keys" data-tdy-hidden={trophy ? "true" : undefined}>
        {cells.map((cell) => {
          if (cell.mealId == null) {
            /* A cut slot renders as a BLANKED-OFF station: the seat is still
               milled into the panel, the plate over it is engraved with why,
               and there is no key to press. docs/VARIANT-SPEC.md — "cut slots
               render no tick buttons". */
            return (
              <li key={cell.slot} className="tdy-bank-cell">
                <Enclosure variant="well" className="tdy-blank">
                  <span className="tdy-blank-label cd-engraved">{cell.label}</span>
                  <span className="tdy-blank-word cd-silkscreen">cut</span>
                  {cell.cutReason && <span className="tdy-blank-reason cd-printed">{cell.cutReason}</span>}
                </Enclosure>
              </li>
            );
          }
          return (
            <li key={cell.slot} className="tdy-bank-cell">
              <PressKey
                className="tdy-tick-key"
                onPress={() => onToggle(cell)}
                sound="contact"
                aria-pressed={cell.ticked}
                aria-label={
                  cell.ticked
                    ? `${cell.label}, ${cell.mealName}, logged at ${cell.at}, ${cell.age.label} ago. press to unlog`
                    : `${cell.label}, ${cell.mealName}, not logged. press to log`
                }
                data-tdy-on={cell.ticked ? "true" : "false"}
                data-tdy-fresh={cell.ticked && justCommitted === cell.slot ? "true" : undefined}
              >
                <span className="tdy-tick-slot" aria-hidden="true">
                  <span className="tdy-tick-rod" />
                </span>
                <span className="tdy-tick-label cd-engraved">{cell.label}</span>
                <span className="tdy-tick-state cd-printed" aria-hidden="true">
                  {cell.ticked ? cell.at : "—"}
                </span>
              </PressKey>
              {/* The age, printed beside the reading rather than instead of it,
                  and never zero for a tick that was never taken. */}
              <span className="tdy-tick-age cd-silkscreen" aria-hidden="true" data-tdy-stale={cell.age.stale ? "true" : "false"}>
                {cell.ticked ? (cell.age.word ? `${cell.age.label} · ${cell.age.word}` : cell.age.label) : "unlogged"}
              </span>
            </li>
          );
        })}
      </ul>
    </Enclosure>
  );
}
