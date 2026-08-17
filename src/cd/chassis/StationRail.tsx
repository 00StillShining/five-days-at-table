/**
 * src/cd/chassis/StationRail.tsx — the rail, and every named delta it carries.
 *
 * ---------------------------------------------------------------------------
 * THE FIVE DECLARED DELTAS FROM 13 BACK CHANNEL
 * ---------------------------------------------------------------------------
 *
 * 1. DIRECT ACCESS, NOT A STEP CYCLE. Section 3's Cycle Ring is "a rotary that
 *    owns no disc": one press seats one station forward, wrapping endlessly.
 *    This rail addresses every station directly. A product where reaching
 *    STORES from TODAY costs three presses is a cage made of latency, and R5
 *    forbids cages. What survives is the ring's READOUT — its points,
 *    straightened into a column, one lit at the seated station.
 *
 * 2. NAVIGATION IS SILENT. Not "quiet" — silent. II.5.16's own list bans a cue
 *    for "navigation of every kind", and section 6 adds this world's extension:
 *    "the Answer Key's own down-stroke never gains a voice, whatever rung the
 *    language climbs to." So the bloom and the haptic answer the hand, and
 *    `cue()` is never called from this file. The sound bus is armed by the
 *    chassis for the SCREENS to use; the rail itself never speaks.
 *
 * 3. ONE EDGE. The rail is emissive against seven mostly-pigment screens. A
 *    dark emissive strip on two or more edges of a light field IS a frame
 *    around the content, which is R5's cage failure stated in this language's
 *    own terms. So the committed 4.5rem footprint claims exactly one edge —
 *    inline-start on desktop, block-end below 48rem — and the masthead, the
 *    settings summons and the live lamp all live inside it. There is no top
 *    bar anywhere in this build.
 *
 * 4. NO PICTOGRAMS ON THE LATTICE. Section 9's first failure mode is "the
 *    talking field". The station keys carry ENGRAVED WORDS in micro-cap
 *    --cd-label-ink, measured 4.99:1 on the spine. The lattice carries a fill
 *    or a sweep and nothing else; there is no code path from a name to a cell.
 *
 * 5. NEITHER COAST PHYSICS. Section 5: "the Cycle Ring never coasts — no drag
 *    axis, no coast to earn; inertia here is not merely unearned, it is
 *    STRUCTURALLY IMPOSSIBLE." Nothing in the chassis glides, flings or
 *    decelerates. This is tier-1, and it is exactly what lets eight languages
 *    sit beside each other without their physics arguing.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE RAIL REPORTS, AND WHAT IT REFUSES TO
 * ---------------------------------------------------------------------------
 * Section 4's Signal List gives every row its own small coded field. The rail
 * does NOT adopt that, and the reason is honesty rather than cost: a per-room
 * field would need STORES' duty maths, SHOP's trip build and LIST's basket
 * inside the chassis, duplicating five screens' selectors in a sixth place
 * where they would drift. Section 9: "a field that lights for no reason is
 * noise." The rail reports the two facts the chassis genuinely owns — the
 * fortnight's position, and a running cook program — and each station carries
 * the one thing the chassis knows about it: whether it is seated, and whether
 * the weekday suggests it.
 */

import { useCallback, useRef, type ReactNode } from "react";
import { Lamp } from "../foundry/Lamp";
import "./chassis.css";
import "../foundry/foundry.css";

/** Section 3's Answer Key: the paired haptic, felt in the same frame as the bloom. */
export const STATION_HAPTIC_MS = 12;

export interface RailStation<Id extends string> {
  id: Id;
  /** The engraved word. Lowercase in the source, upper-cased by the plate. */
  label: string;
  /** 1-9, engraved as nonessential type beside the word. */
  digit: number;
}

export interface StationRailProps<Id extends string> {
  stations: readonly RailStation<Id>[];
  /** The seated station, or null when the route is not a rail room. */
  active: Id | null;
  onNavigate: (id: Id) => void;
  /** The weekday's advisory station. Never reorders or hides anything. */
  suggested: Id | null;
  /**
   * The Cycle Cap — a GlyphField and its exact figure, supplied as a NODE
   * rather than as data on purpose. A running cook program re-reports once a
   * second; passing the reading down as props would re-render the whole rail
   * (five keys, a lamp, a tray summons) sixty times a minute to move one arc.
   * As a node, the 1Hz clock stays inside the leaf that owns it.
   */
  cap: ReactNode;
  /**
   * The engraved date, printed under the cap on TWO lines. Measured: the
   * one-line form "mon 17 aug" is 78px and the committed rail footprint is
   * 72px, so a single line is clipped by construction, not by chance.
   */
  date: { weekday: string; day: string };
  /** A cook program is running. The one reserved saturated hue on the rail. */
  live: boolean;
  onOpenTray: () => void;
  trayOpen: boolean;
  trayId: string;
}

export function StationRail<Id extends string>({
  stations,
  active,
  onNavigate,
  suggested,
  cap,
  date,
  live,
  onOpenTray,
  trayOpen,
  trayId,
}: StationRailProps<Id>) {
  const railRef = useRef<HTMLElement>(null);

  /**
   * Arrow keys walk the column, Home and End reach its ends. The keys are all
   * individually tabbable as well — a five-item nav is not a composite widget,
   * and a roving tabindex here would cost a keyboard user the ability to Tab
   * straight to the station they want.
   */
  const onKeyDown = useCallback((event: React.KeyboardEvent, index: number) => {
    const keys = Array.from(
      railRef.current?.querySelectorAll<HTMLButtonElement>("[data-cd-station]") ?? []
    );
    if (keys.length === 0) return;
    let next: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % keys.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      next = (index - 1 + keys.length) % keys.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = keys.length - 1;
    if (next === null) return;
    event.preventDefault();
    keys[next]?.focus();
  }, []);

  return (
    <nav ref={railRef} className="cd-rail cd-grain" aria-label="rooms">
      {/* ---- THE CYCLE CAP, WHICH IS ALSO THE ANSWER KEY ---------------
          One control that both reports and acts. Section 4 opens the Station
          Tray "from the Answer Key's own position", and the whole language is
          a field that "answers to exactly one control" — so the cap IS that
          control, and the tray it opens promotes this very field to the Close
          Read at 25x25. One object, two homes (section 4, II.4.21).

          It replaced a display-only cap plus a separate `set` key. On a 375px
          block-end rail those two, the lamp and five stations did not fit at
          the 44px Floor; subtracting the one that only acted and the one that
          only reported, by merging them, is the Refined rung's own ledger. */}
      <button
        type="button"
        className="cd-cap cd-focusable"
        aria-expanded={trayOpen}
        aria-controls={trayId}
        onPointerDown={(event) => {
          event.currentTarget.dataset.cdPressed = "true";
          navigator.vibrate?.(STATION_HAPTIC_MS);
        }}
        onPointerUp={(event) => delete event.currentTarget.dataset.cdPressed}
        onPointerCancel={(event) => delete event.currentTarget.dataset.cdPressed}
        onPointerLeave={(event) => delete event.currentTarget.dataset.cdPressed}
        onKeyUp={(event) => delete event.currentTarget.dataset.cdPressed}
        onBlur={(event) => delete event.currentTarget.dataset.cdPressed}
        onClick={onOpenTray}
      >
        <span className="cd-cap-mark" aria-hidden="true">
          fd-5
        </span>
        {cap}
        {/* ---- THE LIVE LAMP ------------------------------------------
            The one reserved saturated hue on the whole rail, and it means
            exactly one thing: a cook program is running. CD-BRIEF ruling 3
            pins it to the same #FF2B1A the COOK screen's own lamp uses, "so
            'a cook program is running' is one claim made once". Section 9's
            rec-dot creep failure is a red pixel with no role; this one has one
            role and no second deployment anywhere in the chassis.

            II.7.7 — colour never travels alone, and here it has two companions
            rather than one: the printed word beside the lens, AND the field
            above it, whose pattern changes shape from a FILL to a SWEEP for
            the whole time the lamp is lit. */}
        <Lamp lit={live} label="cook program" word={{ on: "live", off: "idle" }} />
        <span className="cd-cap-date" aria-hidden="true">
          <span>{date.weekday}</span>
          <span>{date.day}</span>
        </span>
        <span className="cd-visually-hidden">station tray · settings</span>
      </button>

      {/* ---- THE STATION COLUMN ---------------------------------------- */}
      <div className="cd-rail-stations">
        {stations.map((station, index) => {
          const seated = active === station.id;
          return (
            <button
              key={station.id}
              type="button"
              data-cd-station={station.id}
              className="cd-station cd-focusable"
              aria-current={seated ? "page" : undefined}
              data-cd-suggested={suggested === station.id ? "true" : undefined}
              onPointerDown={(event) => {
                // The bloom and the haptic, same frame, no sound. Section 3.
                event.currentTarget.dataset.cdPressed = "true";
                navigator.vibrate?.(STATION_HAPTIC_MS);
              }}
              onPointerUp={(event) => delete event.currentTarget.dataset.cdPressed}
              onPointerCancel={(event) => delete event.currentTarget.dataset.cdPressed}
              onPointerLeave={(event) => delete event.currentTarget.dataset.cdPressed}
              onKeyDown={(event) => {
                onKeyDown(event, index);
                if (event.repeat) return;
                if (event.key === " " || event.key === "Enter") {
                  event.currentTarget.dataset.cdPressed = "true";
                  navigator.vibrate?.(STATION_HAPTIC_MS);
                }
              }}
              onKeyUp={(event) => delete event.currentTarget.dataset.cdPressed}
              onBlur={(event) => delete event.currentTarget.dataset.cdPressed}
              onClick={() => onNavigate(station.id)}
            >
              <span className="cd-station-seat" aria-hidden="true" />
              <span className="cd-station-label">{station.label}</span>
              <span className="cd-station-digit" aria-hidden="true">
                {station.digit}
              </span>
              {suggested === station.id && (
                <span className="cd-visually-hidden">suggested today</span>
              )}
            </button>
          );
        })}
      </div>

    </nav>
  );
}
