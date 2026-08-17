/**
 * src/screens/today/DutyDeck.tsx — what the system is owed, as machined slips.
 *
 * CD-BRIEF R7: "No page-length scrolling. Long registers use a GROUPED
 * ACCORDION, one section open at a time, with the hidden remainder printed as a
 * number ('confess the overflow')."
 *
 * The duty stack is short on a good day and long on a bad one — an inventory
 * where a dozen rows cross their shelf life at once is a real state, not a
 * hypothetical — so it is built as the foundry's Register from the start rather
 * than as a list that grows a scrollbar when the week goes wrong. Two lids,
 * DEFROST and SPOILING, each printing its own count whether it is open or shut,
 * so nothing is ever hidden as a FACT, only as rows.
 *
 * This also buys the measured performance law's largest single saving for free:
 * "Unmount closed accordion groups ... a collapsed drawer at grid-template-rows:
 * 0fr is hidden from paint but NOT from React." The Register renders `null` for
 * a closed group, so a shut lid costs nothing to reconcile.
 *
 * ---------------------------------------------------------------------------
 * THE ONE GUARDED ACT ON THIS SCREEN
 * ---------------------------------------------------------------------------
 * "done" on a defrost move dispatches `inventory/markThawed`, which stamps
 * `thawedAt` and STARTS the post-thaw shelf-life countdown. There is no action
 * in the frozen reducer that clears it, so this is the only irreversible thing
 * TODAY can do — and CORRECTIONARY 4 keeps the guarded switch in force for
 * "anything consequential". Hold 350ms against a real clock to arm, press again
 * to commit, and the guard closes itself after 4000ms of neglect.
 */

import { Enclosure, Escutcheon, GuardedKey, Lamp, Plate, PressKey } from "../../cd/foundry";
import { Register, type RegisterGroup } from "../../cd/foundry";
import type { DefrostDuty, ExpiringDuty } from "../../state/selectors";
import { formatRemainingDays } from "../../state/selectors";
import { formatShortDate } from "../../state/london";
import type { Age } from "../../cd/freshness/classes";

/** How many rows one open lid shows before II.6.24's confession takes over. */
export const DECK_LIMIT = 5;

const CONFIDENCE_WORD: Record<string, string> = {
  numeric: "dated",
  parsed: "read off pack",
  low: "estimated",
};

export interface DutyDeckProps {
  defrost: DefrostDuty[];
  spoiling: ExpiringDuty[];
  openId: string | null;
  onOpenChange: (next: string | null) => void;
  onThawed: (ingId: string) => void;
  onStores: (ingId?: string) => void;
  /** Stocktake age per ingredient — the reading behind each defrost slip. */
  ageFor: (ingId: string) => Age;
  formatTime: (iso: string) => string;
  trophy: boolean;
}

export function DutyDeck({
  defrost,
  spoiling,
  openId,
  onOpenChange,
  onThawed,
  onStores,
  ageFor,
  formatTime,
  trophy,
}: DutyDeckProps) {
  const total = defrost.length + spoiling.length;
  const overdue = defrost.some((d) => d.overdue);
  const expired = spoiling.some((d) => d.expired);

  const groups: RegisterGroup[] = [
    {
      id: "defrost",
      label: "defrost",
      lidSlot: (
        <Lamp
          lit={overdue}
          word={{ on: "OVERDUE", off: "ON TIME" }}
          label="defrost moves"
          hue="var(--cd-role-warning)"
        />
      ),
      limit: DECK_LIMIT,
      items: defrost.map((duty) => () => {
        const age = ageFor(duty.ingId);
        return (
          <div className="tdy-slip" data-tdy-urgent={duty.overdue ? "true" : "false"}>
            <Plate className="tdy-slip-face" surface="data">
              <span className="tdy-slip-text">{duty.text}</span>
              <span className="tdy-slip-figure cd-printed">
                {duty.overdue ? `overdue since ${formatShortDate(new Date(duty.dueAt))}` : `by ${formatTime(duty.dueAt)}`}
              </span>
              {/* The age's WORD and its FIGURE are two channels of one fact,
                  and "never" is only ever one of them: an unrecorded reading
                  has no age to print beside the word, so printing both gave
                  "never · NEVER". */}
              <span className="tdy-slip-age cd-silkscreen" data-tdy-stale={age.stale ? "true" : "false"}>
                {duty.g}g
                <span aria-hidden="true"> · </span>
                {age.ms == null
                  ? "shelf never counted"
                  : `shelf counted ${age.label} ago${age.word ? ` · ${age.word}` : ""}`}
              </span>
            </Plate>
            <GuardedKey
              className="tdy-slip-guard"
              onCommit={() => onThawed(duty.ingId)}
              armLabel="done"
              commitLabel="confirm"
              consequence={`starts the fridge countdown for ${duty.text.replace(/^move /, "").replace(/ fz → fr$/, "")}`}
            />
          </div>
        );
      }),
    },
    {
      id: "spoiling",
      label: "spoiling",
      lidSlot: (
        <Lamp
          lit={expired}
          word={{ on: "EXPIRED", off: "IN DATE" }}
          label="shelf life"
          hue="var(--cd-role-danger-zone-dark)"
        />
      ),
      limit: DECK_LIMIT,
      items: spoiling.map((duty) => () => (
        <div className="tdy-slip" data-tdy-urgent={duty.expired ? "true" : "false"}>
          <Plate className="tdy-slip-face" surface="data">
            <span className="tdy-slip-text">{duty.text}</span>
            <span className="tdy-slip-figure cd-printed" data-tdy-word={duty.expired ? "expired" : "use"}>
              {formatRemainingDays(duty.remainingDays)}
            </span>
            <span className="tdy-slip-age cd-silkscreen">
              shelf life {CONFIDENCE_WORD[duty.confidence] ?? duty.confidence}
            </span>
          </Plate>
          <PressKey className="tdy-slip-key" onPress={() => onStores(duty.ingId)} sound="none" cap="stores →" />
        </div>
      )),
    },
  ];

  return (
    <Enclosure
      variant="faceplate"
      as="section"
      className="tdy-deck"
      aria-label="duty deck"
      data-tdy-hidden={trophy ? "true" : undefined}
    >
      <header className="tdy-deck-head">
        <Escutcheon as="h2">
          duty deck
        </Escutcheon>
        <Plate className="tdy-deck-count" surface="data">
          <span className="cd-value" style={{ "--cd-value-ch": 2 } as React.CSSProperties}>
            {total}
          </span>
          <span className="cd-unit">{total === 1 ? "owed" : "owed"}</span>
        </Plate>
      </header>

      {total === 0 ? (
        /* The empty state is a STATE, not an absence: the deck keeps its
           housing, prints what it would hold, and names the next thing that
           will fill it. "A dark status lamp on a healthy screen is not an
           absence of information; it is the information." */
        <Plate className="tdy-deck-empty" surface="data">
          <span className="tdy-deck-empty-word cd-engraved">nothing owed</span>
          <span className="tdy-deck-empty-note cd-printed">
            no defrost moves due and nothing inside its last day of shelf life
          </span>
        </Plate>
      ) : (
        <Register
          className="tdy-deck-register"
          groups={groups}
          openId={openId}
          onOpenChange={onOpenChange}
          label="duty deck"
          overflowWord="more · in stores"
        />
      )}
    </Enclosure>
  );
}
