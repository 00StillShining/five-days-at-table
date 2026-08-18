/**
 * src/screens/list/TrophyRead.tsx — the wall the screen earns after 90s idle.
 *
 * §4's Trophy Mode, applied literally: "EVERY HEALTHY STATION SIMPLY IS NOT
 * RENDERED — a blank plate has nothing to report, and this language does not
 * spend a pixel proving a fact already true by absence ... What never
 * disappears: any station past its factory window, printed as an exact duration
 * rather than an icon, in ALERT INK; the freshness of the whole read,
 * timestamped; and the hero count itself, never rounded."
 *
 * Four survivors, which sits inside the owner's 3-5:
 *   still owed  the hero count, exact, never rounded
 *   station     which building the trolley is standing in
 *   aisle       which lid is open
 *   unpriced    the one row past its own window, in alert ink — the exception
 *               that never disappears
 * plus the read's own freshness, printed at 1.21875rem beside them.
 *
 * PRIVACY BY DECLARED CLASS (owner ruling). "Basket totals and per-line prices
 * are MASKED with a milled blank plate — a kitchen screen facing a window must
 * not publish the household's grocery spend." So no money appears on this
 * panel at all, and the Till's own figure goes behind its mask rather than off
 * the screen: the instrument still says what it is and says that it is not
 * saying it.
 *
 * ITS OWN CLOCK (perf law, rule 4). The age printed here is the only ticking
 * reading in Trophy Mode, so its 60s clock is mounted inside this component and
 * nothing above it re-renders for the tick.
 */

import { Enclosure, Escutcheon } from "../../cd/foundry";
import { ageOf } from "../../cd/freshness/classes";
import { useAgeClock } from "../../cd/freshness/useAge";

export interface TrophyReadProps {
  owed: number;
  station: string;
  aisle: string;
  /** The one row still past its own window, or null when there is none. */
  unpriced: string | null;
  /** ISO datetime the trip's prices were fixed. */
  pricedOn: string;
}

export function TrophyRead({ owed, station, aisle, unpriced, pricedOn }: TrophyReadProps) {
  const now = useAgeClock(60_000);
  const age = ageOf("price", pricedOn, now);

  return (
    <Enclosure variant="hero" className="lst-trophy" aria-hidden="true">
      <p className="lst-trophy-line">
        <span className="lst-trophy-fig cd-data">{owed}</span>
        <Escutcheon className="lst-trophy-key">still owed</Escutcheon>
      </p>
      <p className="lst-trophy-line">
        <span className="lst-trophy-fig">{station}</span>
        <Escutcheon className="lst-trophy-key">station</Escutcheon>
      </p>
      <p className="lst-trophy-line">
        <span className="lst-trophy-fig">{aisle}</span>
        <Escutcheon className="lst-trophy-key">aisle</Escutcheon>
      </p>
      {unpriced ? (
        <p className="lst-trophy-line" data-lst-role="warning">
          <span className="lst-trophy-fig">{unpriced}</span>
          <Escutcheon className="lst-trophy-key">unpriced</Escutcheon>
        </p>
      ) : null}
      <p className="lst-trophy-age">
        <span className="cd-data">{age.label}</span>
        <Escutcheon className="lst-trophy-key">since priced{age.stale ? ` · ${age.word}` : ""}</Escutcheon>
      </p>
    </Enclosure>
  );
}
