/**
 * src/screens/today/Masthead.tsx — where in the fortnight this is, as an object.
 *
 * ch.05 section 2 keeps "one small subordinate readout ... kept deliberately
 * plain and small". CD-BRIEF OVERRULES that clause by name: "promote it to
 * instrument grade or remove it." It states three real values a cook acts on —
 * which weekday, which pass of the a-twice cycle, and which of this week's five
 * plated days are fully logged — so it is promoted rather than removed.
 *
 * The result is a milled index strip: five seats cut into satin billet, the
 * current day held under a mirror-polished index, each seat's dot filled when
 * every one of that day's slots carries a household tick. Position, fill and an
 * engraved numeral — three channels, so it survives a squint, a desaturation
 * and forced-colours (II.7.7).
 *
 * The dot's own legend was SUBTRACTED at the Refined rung: it stated neither a
 * value nor an action, one use teaches the convention, and the per-seat
 * screen-reader sentence carries it in full for anyone the shape does not
 * reach. Every survivor here stays at full material strength.
 *
 * THE LOAD-BEARING STATE FACT, restated where it is easiest to get wrong:
 * the executing fortnight is ALWAYS WEEK A, twice (D5). `prefs.week` is a
 * BROWSING toggle for PLAN and MEAL. Nothing on this screen reads it.
 */

import { Enclosure, Plate } from "../../cd/foundry";

export interface DaySeat {
  dayNo: number;
  weekday: string;
  done: boolean;
  isToday: boolean;
}

export interface MastheadProps {
  weekday: string;
  /** 1..5, or "weekend" — the day inside Week A this calendar day plays. */
  dayNo: number | "weekend";
  /** Which pass through Week A. null until the fortnight is anchored. */
  pass: 1 | 2 | null;
  /** 0..13, or null when unanchored. */
  fortnightDay: number | null;
  seats: DaySeat[];
  /** The tester's own label, when a variant other than the full plan is live. */
  variantLabel: string | null;
}

export function Masthead({ weekday, dayNo, pass, fortnightDay, seats, variantLabel }: MastheadProps) {
  return (
    <Enclosure variant="pod" as="header" className="tdy-masthead" aria-label="fortnight position">
      <Plate className="tdy-dateline" surface="data">
        <span className="tdy-dateline-day cd-engraved">{weekday}</span>
        <span className="tdy-dateline-sep" aria-hidden="true" />
        <span className="tdy-dateline-figure cd-printed">
          week a
          <span aria-hidden="true"> · </span>
          {typeof dayNo === "number" ? `day ${dayNo}` : "weekend"}
        </span>
        <span className="tdy-dateline-pass cd-silkscreen">
          {fortnightDay == null ? "not anchored" : `pass ${pass} · fortnight day ${fortnightDay + 1}/14`}
        </span>
        {variantLabel && <span className="tdy-dateline-variant cd-silkscreen">{variantLabel}</span>}
      </Plate>

      <ol className="tdy-index" aria-label="this week, monday to friday">
        {seats.map((seat) => (
          <li
            key={seat.dayNo}
            className="tdy-index-seat"
            data-tdy-today={seat.isToday ? "true" : "false"}
            data-tdy-done={seat.done ? "true" : "false"}
            aria-current={seat.isToday ? "date" : undefined}
          >
            <span className="tdy-index-num cd-engraved" aria-hidden="true">
              {seat.dayNo}
            </span>
            <span className="tdy-index-dot" aria-hidden="true" />
            <span className="fd5-visually-hidden">
              day {seat.dayNo}, {seat.weekday}
              {seat.isToday ? ", today" : ""}
              {seat.done ? ", all logged" : ", not fully logged"}
            </span>
          </li>
        ))}
      </ol>
    </Enclosure>
  );
}
