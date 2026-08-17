/**
 * src/screens/cook/TrackLanes.tsx — one lane per track, as real segmented travel.
 *
 * 02 REEL LOGIC section 3: this world "reports level as SEGMENTED TRAVEL
 * everywhere else too", so a lane is II.3.19's bar meter laid on its side, not
 * a progress bar. Segmentation is a repeating-linear-gradient over the track
 * (the casting's own construction) rather than one element per segment: the
 * zone geometry never moves, so it never needs a node per step.
 *
 * WHAT EACH LANE ACTUALLY MEANS. `ProgramTrack.totalMinutes` is an ABSOLUTE
 * minute on the program's shared clock — max(clockStart + minutes) across that
 * track's steps — not a duration. A lane therefore has a real WINDOW on the
 * program's axis: it is inert before its first step's clockStart, fills through
 * its own window, and is settled after it. That is what the three zones are.
 *
 * The playhead is drawn once per row inside that row's own track element. Every
 * row's track is the same pixel width (a grid 1fr column sizes identically
 * across siblings), so the same left% reads as one vertical line down the deck.
 *
 * PERFORMANCE. This component is the screen's only repeating structure and it
 * re-renders on the 1Hz program clock, so it is a memo boundary: React skips it
 * entirely on any render where elapsed has not moved (a transport press, a
 * preview step, a trophy transition).
 */

import { memo } from "react";
import { Enclosure, Escutcheon } from "../../cd/foundry";
import type { ProgramTrack } from "../../engine/programs";
import { formatMinutesAsClock } from "./format";
import "./cook.css";

/*
  CD-BRIEF R7 — "No page-length scrolling ... with the hidden remainder printed
  as a number ('confess the overflow')."

  MEASURED, at 1280x800 on the real 8-lane Sunday session: the evidence column
  stood 1005px inside a 768px deck and the last two lanes sat below the fold.
  A deck the operator has to scroll to read is a deck that cannot be read at two
  metres, which is the whole point of this screen.

  So the lanes are RANKED and CAPPED. The ranking is the task's own order — a
  lane the program is inside right now, then the ones it has not reached, then
  the ones it is finished with — so nothing urgent is ever the thing that got
  cut. The remainder prints as a figure with its state named, never as a fade.
*/
const LANE_LIMIT = 5;

export interface TrackLanesProps {
  tracks: ProgramTrack[];
  totalProgramMinutes: number;
  elapsedMinutes: number;
}

function windowOf(track: ProgramTrack): { start: number; end: number } {
  const clocked = track.steps.filter((s) => s.clockStart != null);
  const start = clocked.length ? Math.min(...clocked.map((s) => s.clockStart!)) : 0;
  return { start, end: track.totalMinutes };
}

function pct(value: number, of: number): string {
  if (of <= 0) return "0%";
  return `${Math.max(0, Math.min(100, (value / of) * 100))}%`;
}

export const TrackLanes = memo(function TrackLanes({
  tracks,
  totalProgramMinutes,
  elapsedMinutes,
}: TrackLanesProps) {
  if (tracks.length === 0) return null;
  const playhead = pct(elapsedMinutes, totalProgramMinutes);

  const ranked = tracks
    .map((track) => {
      const { start, end } = windowOf(track);
      const live = elapsedMinutes >= start && elapsedMinutes < end;
      const settled = elapsedMinutes >= end;
      return { track, start, end, live, settled, rank: live ? 0 : settled ? 2 : 1 };
    })
    .sort((a, b) => a.rank - b.rank || a.start - b.start);

  const shown = ranked.slice(0, LANE_LIMIT);
  const hidden = ranked.slice(LANE_LIMIT);
  const hiddenSettled = hidden.filter((l) => l.settled).length;

  return (
    <Enclosure variant="hero" grain className="ck-lanes" as="section" aria-label="track lanes">
      <div className="ck-lanes-head">
        <Escutcheon>tracks</Escutcheon>
        <span className="ck-lanes-count cd-printed">
          {ranked.filter((l) => l.live).length}
          <span className="cd-unit">live of {tracks.length}</span>
        </span>
      </div>

      <div className="ck-lanes-body">
        {shown.map(({ track, start, end, live }) => {
          const span = Math.max(0, end - start);
          const done = span > 0 ? Math.max(0, Math.min(span, elapsedMinutes - start)) : 0;
          return (
            <div key={track.id} className="ck-lane" data-ck-live={live ? "true" : undefined}>
              <Escutcheon className="ck-lane-label">{track.id}</Escutcheon>
              <div
                className="ck-lane-track"
                role="img"
                aria-label={`${track.id}: ${formatMinutesAsClock(done)} of ${formatMinutesAsClock(span)}`}
              >
                <span
                  className="ck-lane-window"
                  style={{
                    left: pct(start, totalProgramMinutes),
                    width: pct(span, totalProgramMinutes),
                  }}
                >
                  <span className="ck-lane-fill" style={{ width: span > 0 ? pct(done, span) : "0%" }} />
                </span>
                <span className="ck-lane-playhead" style={{ left: playhead }} aria-hidden="true" />
              </div>
              <span className="ck-lane-time cd-printed">
                {formatMinutesAsClock(done)}
                <span className="ck-lane-of"> / {formatMinutesAsClock(span)}</span>
              </span>
            </div>
          );
        })}

        {/* II.6.24 — the clip states its remainder as a NUMBER, and names what
            kind of lane it is holding back. No fade curtains. */}
        {hidden.length > 0 && (
          <p className="ck-lanes-overflow cd-overflow-count">
            {hidden.length}
            <span className="cd-unit">
              more {hidden.length === 1 ? "lane" : "lanes"}
              {hiddenSettled > 0 ? ` · ${hiddenSettled} already settled` : ""}
            </span>
          </p>
        )}
      </div>
    </Enclosure>
  );
});
