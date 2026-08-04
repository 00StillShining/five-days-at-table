// COOK's track lanes (PLAN §6.6): "one lane per track (pan/oven/prep…),
// fills as elapsed, playhead ┃; lane labels engraved caps; exact
// elapsed/total mono text (never motion-only)."
//
// engine/programs.ts's `ProgramTrack.totalMinutes` is an ABSOLUTE minute on
// the program's shared clock (max(clockStart+minutes) across the track's own
// steps — see that module's doc comment), not a duration; and
// engine/timers.ts's `perTrackProgress` (useProgram's derived state) measures
// `doneMin` as elapsed-program-time capped at that absolute end-point — i.e.
// it does not by itself know when a track's OWN active window *starts*. The
// PLAN ascii mock clearly shows lanes sitting empty before their track
// begins and settled after it ends (e.g. "oven ░░░░▓▓▓▓▓▓▓▓░░░░░░"), so this
// component reads each track's own step `clockStart`s directly from the
// compiled Program (not just the derived summary) to find that start point,
// and renders a three-segment bar (before / active-fill / after) on the
// PROGRAM's shared 0..totalMinutes axis.
//
// The playhead is drawn once per row, INSIDE that row's own
// `.scr-cook-lane-track` (not once as a single line spanning the whole
// lanes list) — positioning it against the full list's width would place it
// under the fixed-width label/time columns whenever elapsed time is still
// small (e.g. "6% across" lands inside the ~4.5rem label column, not over
// the bar at all). Every row's track element is the same pixel width (a
// CSS Grid `1fr` column sizes identically across sibling rows), so the same
// left% in each one still lines up as a single vertical line by eye.
import type { ProgramTrack } from "../../engine/programs";
import { formatMinutesAsClock } from "./format";

export interface TrackLanesProps {
  tracks: ProgramTrack[];
  totalProgramMinutes: number;
  elapsedMinutes: number;
}

interface TrackWindow {
  start: number;
  end: number;
}

function trackWindow(track: ProgramTrack): TrackWindow {
  const clocked = track.steps.filter((s) => s.clockStart != null);
  const start = clocked.length ? Math.min(...clocked.map((s) => s.clockStart!)) : 0;
  return { start, end: track.totalMinutes };
}

function pct(value: number, of: number): string {
  if (of <= 0) return "0%";
  return `${Math.max(0, Math.min(100, (value / of) * 100))}%`;
}

export function TrackLanes({ tracks, totalProgramMinutes, elapsedMinutes }: TrackLanesProps) {
  if (tracks.length === 0) return null;
  const playheadPct = pct(elapsedMinutes, totalProgramMinutes);

  return (
    <section className="scr-cook-lanes" aria-labelledby="scr-cook-lanes-h">
      <h2 id="scr-cook-lanes-h" className="fd5-visually-hidden">
        track lanes
      </h2>
      <div className="scr-cook-lanes-body">
        {tracks.map((track) => {
          const { start, end } = trackWindow(track);
          const windowLen = Math.max(0, end - start);
          const withinElapsed = windowLen > 0 ? Math.max(0, Math.min(windowLen, elapsedMinutes - start)) : 0;
          const beforePct = pct(start, totalProgramMinutes);
          const activePct = pct(windowLen, totalProgramMinutes);
          const fillOfActivePct = windowLen > 0 ? pct(withinElapsed, windowLen) : "0%";

          return (
            <div key={track.id} className="scr-cook-lane">
              <span className="scr-cook-lane-label">{track.id}</span>
              <div className="scr-cook-lane-track" role="img" aria-label={`${track.id}: ${formatMinutesAsClock(withinElapsed)} of ${formatMinutesAsClock(windowLen)}`}>
                <span className="scr-cook-lane-before" style={{ width: beforePct }} />
                <span className="scr-cook-lane-active" style={{ width: activePct }}>
                  <span className="scr-cook-lane-fill" style={{ width: fillOfActivePct }} />
                </span>
                <span className="scr-cook-lane-playhead" style={{ left: playheadPct }} aria-hidden="true" />
              </div>
              <span className="scr-cook-lane-time">
                {formatMinutesAsClock(withinElapsed)} / {formatMinutesAsClock(windowLen)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
