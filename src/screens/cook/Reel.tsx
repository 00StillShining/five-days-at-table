/**
 * src/screens/cook/Reel.tsx — the reel, and the transport folded into it.
 *
 * ===========================================================================
 * THE RULING THIS COMPONENT EXISTS TO OBEY
 * ===========================================================================
 * "The reel is aria-hidden process readout plus a discrete +/-1-minute
 * stepper. IT IS NEVER GRABBED." That is load-bearing beyond this screen: it
 * is the single reason the FACETED VOLUME x REEL LOGIC curdle — "both fuse a
 * rotary and its own readout into one control, but one earns coast through
 * traversal and the other refuses coast on principle" — does not exist in this
 * product. Make this disc grabbable and the collision the whole language
 * assignment was checked against arrives with it.
 *
 * So: no pointerdown on the disc, no drag, no coast, no `grabReel`, no
 * `--cd-reel-angle` written from a pointer. The disc reports; the hand works
 * the collar around it.
 *
 * ===========================================================================
 * THE SIGNATURE, AND THE TENSION IN IT, RESOLVED HONESTLY
 * ===========================================================================
 * 02 REEL LOGIC section 7's Signature rung: "the three transport keys are
 * removed from the screen entirely, and every function they carried folds into
 * the reel's own gesture grammar ... The tape-counter arc prints around the
 * disc's own bezel rather than beside it."
 *
 * Its gesture grammar is a grab: tap at centre, radial flick, sustained hold.
 * Every one of those is forbidden here. The Signature cannot be built as the
 * chapter draws it, and pretending otherwise would break the constraint the
 * language assignment depends on. So it is built as the chapter MEANS it:
 *
 *   what is removed .... the separate transport key ROW. There is no key row
 *                        anywhere on this screen.
 *   what replaces it ... the reel's own COLLAR. The three transport keys are
 *                        seated in the machined ring that is part of the reel
 *                        assembly, at 9, 6 and 3 o'clock, with the record lamp
 *                        on the crown at 12. One object carries the input, the
 *                        readout and the transport, which is exactly what the
 *                        essence promised — reached by pressing the assembly's
 *                        own rim rather than by turning its disc.
 *   what the arc does .. II.3.18's committed gauge arc: 270 degrees from -135
 *                        to +135, minimum at 7 o'clock, maximum at 5 o'clock,
 *                        90-degree dead zone at the bottom. 60 dot-matrix cells
 *                        at 4.5 degrees print the count; the dead zone is where
 *                        the primary key sits. The separate counter strip below
 *                        the disc is gone, per the Signature.
 *
 * ===========================================================================
 * WHAT THE DISC ACTUALLY REPORTS (II.3.9, and section 9's failure modes)
 * ===========================================================================
 * "A reel that turns for effect is a decoration; a reel that stops without
 * cause is a lie."
 *
 *   rate ....... 0.1 rev/s — one revolution per 10 seconds of program time,
 *                constant, because a cook program runs at 1x real time and any
 *                other rate would be "faster for drama, slower for calm".
 *   stillness .. the disc holds the instant the process it reports stops
 *                needing time: paused, complete, or a step's own clock at zero
 *                and waiting for a hand. Every one of those causes is PRINTED
 *                beside it, so the stop is never unexplained.
 *   phase ...... seeded ONCE at mount from the real elapsed figure, then
 *                carried by animation-play-state alone. Pausing freezes the
 *                disc where it stands and resuming continues from there, which
 *                is what the elapsed clock itself does. The phase is not
 *                claimed as a readout — the hub drum and the arc are — so the
 *                divergence a due-freeze introduces reports nothing false.
 *
 * Zero script per frame: CD-BRIEF's measured performance law, rule 6 — "the
 * cheapest sweep is neither [one integrator nor per-row rAF]: a rate-derived
 * CSS transition, zero script per frame."
 */

import { memo, useEffect, useRef } from "react";
import { Enclosure, Lamp, PressKey } from "../../cd/foundry";
import { Drums } from "./Drums";
import { formatMinutesAsClock } from "./format";
import "./cook.css";

/** One revolution per 10 seconds of program time. 0.1 rev/s, 36 deg/s. */
export const REEL_PERIOD_S = 10;

/** II.3.18's arc, printed in cells: 270 degrees, 60 cells, 4.5 degrees apart. */
const ARC_CELLS = 60;
const ARC_SWEEP_DEG = 270;
const ARC_START_DEG = -135;
const CELL_INDEX = Array.from({ length: ARC_CELLS }, (_, i) => i);
/** Majors at 0 / 25 / 50 / 75 / 100 per cent of the arc. */
const MAJORS = [0, 0.25, 0.5, 0.75, 1];

export interface TransportKey {
  label: string;
  cap: string;
  onPress: () => void;
  disabled?: boolean;
}

export interface ReelProps {
  elapsedMin: number;
  totalMin: number;
  /** True only while the process this disc reports is actually advancing. */
  spinning: boolean;
  /** The lamp: lit whenever a program is loaded and not finished. */
  lampLit: boolean;
  /** II.4.11 — the lamp breathes ONLY for a process actually running. */
  lampBreathing: boolean;
  lampWord: string;
  /** Elapsed has run past the program's own declared total. */
  overrun: boolean;
  primary: TransportKey;
  pause: TransportKey;
  extend: TransportKey;
  /** Seeds the disc's phase at mount. Program seconds. */
  seedSeconds: number;
}

/**
 * The 60 printed cells and the five majors never change with the clock — only
 * their data-on flags do — so the ring is its own memo boundary keyed on the
 * lit count. At 1Hz on a 100-minute program the count changes once every 100
 * seconds; between those the ring does not reconcile at all.
 */
const Arc = memo(function Arc({ lit, over }: { lit: number; over: boolean }) {
  return (
    <span className="ck-arc" aria-hidden="true">
      {CELL_INDEX.map((i) => (
        <span
          key={i}
          className="ck-arc-cell"
          style={{ "--ck-a": `${ARC_START_DEG + (ARC_SWEEP_DEG * i) / (ARC_CELLS - 1)}deg` } as React.CSSProperties}
          data-on={i < lit ? "true" : undefined}
          data-over={over && i < lit ? "true" : undefined}
        />
      ))}
      {MAJORS.map((m) => (
        <span
          key={`m${m}`}
          className="ck-arc-major"
          style={{ "--ck-a": `${ARC_START_DEG + ARC_SWEEP_DEG * m}deg` } as React.CSSProperties}
        />
      ))}
    </span>
  );
});

export interface ReelFaceProps {
  elapsedMin: number;
  totalMin: number;
  spinning: boolean;
  overrun: boolean;
  seedSeconds: number;
  /** The hub's counter window. Off only where the caller prints the figure. */
  hub?: boolean;
  children?: React.ReactNode;
}

/**
 * Arc + collar + disc + hub — the part Trophy Mode also renders, at 2x, as the
 * one surviving moving element on the wall face (02 REEL LOGIC section 4:
 * "the reel is the one surviving moving part at any distance ... the disc's
 * continued turn is the single proof, readable across a room, that the session
 * is still truthfully live").
 */
export function ReelFace({
  elapsedMin,
  totalMin,
  spinning,
  overrun,
  seedSeconds,
  hub = true,
  children,
}: ReelFaceProps) {
  const gripRef = useRef<HTMLSpanElement>(null);
  const seeded = useRef(false);

  // The phase, written ONCE. A negative animation-delay starts a linear
  // animation partway through its own timeline, so the disc arrives already
  // turned by however much program time has really elapsed — a reload does not
  // hand the operator a reel that claims the program just started.
  useEffect(() => {
    if (seeded.current || !gripRef.current) return;
    seeded.current = true;
    const phase = ((seedSeconds % REEL_PERIOD_S) + REEL_PERIOD_S) % REEL_PERIOD_S;
    gripRef.current.style.animationDelay = `${-phase}s`;
  }, [seedSeconds]);

  const fraction = totalMin > 0 ? Math.min(1, Math.max(0, elapsedMin / totalMin)) : 0;
  const lit = Math.round(fraction * ARC_CELLS);

  return (
    <div className="ck-reel" data-ck-spin={spinning ? "true" : "false"}>
      <Arc lit={lit} over={overrun} />

      {/* the machined ring the keys are seated in — II.2.8 hard mirror */}
      <span className="ck-collar" aria-hidden="true" />

      {/*
        THE DISC. `.ck-grip` turns; `.ck-light` is its SIBLING and never turns,
        so paint order alone keeps the sun fixed to the room while the machined
        part rotates under it (II.2.4, and the chapter's own fence).
      */}
      <span className="ck-disc" aria-hidden="true">
        <span className="ck-grip" ref={gripRef} />
        <span className="ck-light" />
      </span>

      {/*
        The counter window, bolted across the disc's centre. The ink-plate law
        (CD-BRIEF ruling 5): the figure sits on a plate, never raw on the
        anodized field or on the turning grain.
      */}
      {hub && (
        <div className="ck-hub cd-plate" data-cd-surface="data">
          <Drums
            value={formatMinutesAsClock(elapsedMin)}
            size="var(--cd-size-5)"
            label="elapsed"
            className="ck-hub-drums"
          />
          <span className="ck-hub-total cd-printed">of {formatMinutesAsClock(totalMin)}</span>
        </div>
      )}

      {children}
    </div>
  );
}

export function Reel({
  elapsedMin,
  totalMin,
  spinning,
  lampLit,
  lampBreathing,
  lampWord,
  overrun,
  primary,
  pause,
  extend,
  seedSeconds,
}: ReelProps) {
  return (
    <Enclosure variant="faceplate" grain className="ck-reel-mount">
      <ReelFace
        elapsedMin={elapsedMin}
        totalMin={totalMin}
        spinning={spinning}
        overrun={overrun}
        seedSeconds={seedSeconds}
      >
        {/* the crown escutcheon at 12 o'clock — the one licensed emissive */}
        <div className="ck-crown">
          <span className={lampBreathing ? "ck-lamp cd-pulse" : "ck-lamp"}>
            <Lamp
              lit={lampLit}
              word={{ on: lampWord, off: lampWord }}
              label="cook program"
              showWord={false}
            />
          </span>
          <span className="ck-crown-word cd-engraved">{lampWord}</span>
        </div>

        {/*
          II.5.4 / 02 REEL LOGIC section 6 — "Contact is the dry click on the
          TRANSPORT KEYS: 35ms of filtered noise, lowpass 2200Hz, -22dBFS."
          Fired by PressKey on the DOWN-STROKE, never on release, and silent
          until the bus has been armed by a real gesture (II.5.14).
        */}
        <PressKey
          className="ck-key ck-key--pause"
          onPress={pause.onPress}
          disabled={pause.disabled}
          sound="contact"
          aria-label={pause.label}
          cap={pause.cap}
        />
        <PressKey
          className="ck-key ck-key--extend"
          onPress={extend.onPress}
          disabled={extend.disabled}
          sound="contact"
          aria-label={extend.label}
          cap={extend.cap}
        />
        <PressKey
          className="ck-key ck-key--primary"
          onPress={primary.onPress}
          disabled={primary.disabled}
          sound="contact"
          aria-label={primary.label}
          cap={primary.cap}
        />
      </ReelFace>
    </Enclosure>
  );
}
