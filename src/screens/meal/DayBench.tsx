/**
 * src/screens/meal/DayBench.tsx — the workspace the tray sits over, and it is
 * genuinely live.
 *
 * ch.16 section 3, the Jewel Card: "fixed to a near-square 12rem by 12.5rem
 * ratio rather than a wide rectangle, echoing the jewel-case motif; EVERY CORNER
 * CHAMFERED per the geometry rule; a format badge — the ring's own code at
 * reduced diameter — sits FIXED AT THE LOWER-RIGHT CORNER rather than inside the
 * metadata footer, so a shelf of cards prints its format constellation before
 * any text is read."
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AT ALL (CORRECTIONARY 6.5 — declared, not smuggled)
 * ---------------------------------------------------------------------------
 * CD-BRIEF: "MEAL is a tray over the screen that summoned it (PLAN or TODAY)
 * ... Trays travel their own size with NO SCRIM — the workspace beneath stays
 * live and touchable."
 *
 * src/app/App.tsx mounts exactly one scene per route, and this builder owns
 * src/screens/meal/** only — importing PLAN or TODAY to render underneath would
 * break the zone fence and reach into two other builders' folders while they
 * are in them. So the workspace beneath this tray is MEAL'S OWN: the other
 * plates of the same day, as a shelf of jewel cards. It is real data from the
 * frozen store, it is touchable while the tray is open, and pressing a card
 * RETARGETS the tray to that plate — II.3.30's "re-invoking mid-travel retargets
 * without finishing the old motion", made literal.
 *
 * The exit still goes back to the screen that summoned it. What changed is what
 * the tray floats over, and the alternative — an empty gunmetal field — would
 * have made the no-scrim ruling true on paper and vacuous in the room.
 */

import { Enclosure, Escutcheon, Plate } from "../../cd/foundry";
import type { Summoner } from "./model";
import { COVER_LAMPS, mealHref, stockZone, type BenchSeat } from "./model";
import type { Cover } from "../../data";

export interface DayBenchProps {
  seats: BenchSeat[];
  /** Week and day the bench is showing — printed, never inferred. */
  week: string;
  day: number;
  /** The day's own energy at the committed cover and portion, cut slots out. */
  dayKcal: number;
  /** How many plates that figure is the sum of. */
  plates: number;
  cover: Cover;
  from: Summoner;
  onPick: (mealId: string) => void;
  trophy: boolean;
}

export function DayBench({
  seats,
  week,
  day,
  dayKcal,
  plates,
  cover,
  from,
  onPick,
  trophy,
}: DayBenchProps) {
  const badge = COVER_LAMPS.find((l) => l.cover === cover) ?? COVER_LAMPS[0];

  return (
    <Enclosure
      variant="faceplate"
      as="section"
      grain
      className="mea-bench"
      aria-label={`the rest of week ${week.toLowerCase()}, day ${day}`}
      data-mea-hidden={trophy ? "true" : undefined}
    >
      <header className="mea-bench-head">
        <Escutcheon as="h2">
          week {week.toLowerCase()} · day {day}
        </Escutcheon>
        {/*
          The Refined rung's own ledger question — does it state a value, or let
          the hand do something? The caption that used to sit here
          ("the shelf under the tray stays live") did neither: it explained the
          design to the operator instead of telling them anything about the day.
          The day's own total does both jobs a head can do — it names what the
          shelf sums to, and it moves when the wheel moves.
        */}
        <span className="mea-bench-total">
          <span className="cd-silkscreen">day total</span>
          <span className="cd-value mea-bench-kcal" style={{ "--cd-value-ch": 4 } as React.CSSProperties}>
            {dayKcal}
          </span>
          <span className="cd-unit">kcal</span>
          <span className="cd-silkscreen mea-bench-plates">
            {plates} {plates === 1 ? "plate" : "plates"}
          </span>
        </span>
      </header>

      <ul className="mea-bench-shelf">
        {seats.map((seat) => (
          <li key={seat.slot} className="mea-bench-slot">
            {seat.mealId == null ? (
              /*
                A cut slot. There is nothing to swap into it and nothing to
                cook, so the card is a blanked-off station with the tester's own
                stated reason engraved on it — never a fabricated plate, and
                never a card that looks pressable and is not.
              */
              <Enclosure variant="well" className="mea-card mea-card--cut" aria-disabled="true">
                <span className="mea-card-slot cd-silkscreen">{seat.label}</span>
                <Plate className="mea-card-face" surface="data">
                  <span className="mea-card-cut-word">CUT</span>
                  <span className="mea-card-cut-reason">
                    {seat.cutReason ?? "not part of the active plan variant"}
                  </span>
                </Plate>
              </Enclosure>
            ) : (
              <a
                className="mea-card cd-focusable"
                href={mealHref(seat.mealId, from)}
                data-mea-current={seat.current ? "true" : "false"}
                tabIndex={trophy ? -1 : 0}
                style={
                  {
                    "--mea-badge-hue": badge.hue,
                    "--mea-badge-rim": badge.rim,
                  } as React.CSSProperties
                }
                onClick={(event) => {
                  // Left-click with no modifier is a retarget, in this task.
                  // Anything else stays a real link, so a middle-click or a
                  // cmd-click still opens the deep link the URL promises.
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                  event.preventDefault();
                  onPick(seat.mealId!);
                }}
              >
                <span className="mea-card-slot cd-silkscreen">{seat.label}</span>
                <Plate className="mea-card-face" surface="data">
                  <span className="mea-card-name">{seat.name}</span>
                  {/*
                    The shelf is a COMPARISON surface, not a row of links: four
                    plates are only comparable if each states what it costs and
                    whether it can be made. Both figures are this plate's own, at
                    the cover and the portion the wheel is currently committed to,
                    so turning the wheel moves the whole shelf at once.
                  */}
                  <span className="mea-card-read">
                    <span className="mea-card-figure">
                      <span
                        className="mea-card-kcal cd-value"
                        style={{ "--cd-value-ch": 4 } as React.CSSProperties}
                      >
                        {seat.kcal ?? 0}
                      </span>
                      <span className="cd-unit">kcal</span>
                    </span>
                    <span className="mea-card-figure">
                      <span
                        className="mea-card-grams cd-value"
                        style={{ "--cd-value-ch": 4 } as React.CSSProperties}
                      >
                        {seat.grams ?? 0}
                      </span>
                      <span className="cd-unit">g</span>
                    </span>
                  </span>
                  {seat.coverage != null && (
                    <span
                      className="mea-card-meter"
                      data-mea-zone={stockZone(seat.coverage)}
                      style={{ "--mea-fill": String(seat.coverage) } as React.CSSProperties}
                      role="img"
                      aria-label={`${(seat.coverage * 100).toFixed(0)} per cent in the house`}
                    >
                      <span className="mea-card-meter-fill" aria-hidden="true" />
                      <span className="mea-card-meter-figure cd-data" aria-hidden="true">
                        {(seat.coverage * 100).toFixed(0)}%
                      </span>
                    </span>
                  )}
                </Plate>
                <span className="mea-card-foot">
                  <span className="mea-card-tag cd-silkscreen">{seat.tag}</span>
                  {seat.swapped && <span className="mea-card-swap cd-silkscreen">swapped</span>}
                  {seat.current && (
                    <span className="mea-card-here cd-silkscreen">in tray</span>
                  )}
                </span>
                {/*
                  The format badge — the cover ring's own code at reduced
                  diameter, fixed at the lower-right corner. "The one circle
                  inside a chamfered card", and the only true circle on the
                  bench besides the wheel itself.
                */}
                <span className="mea-card-badge" aria-hidden="true" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </Enclosure>
  );
}
