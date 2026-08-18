/**
 * src/screens/shop/HorizonBand.tsx — the seam, and every control on this screen.
 *
 * Section 4's Hero Screen sets the band's anatomy and it is followed: "The track
 * window runs the band's own full width at its top edge; two flush-check crowns
 * nest at the band's left and right quarter-points; a cluster of five flush keys
 * — the compass grammar of arrows and one diamond — occupies the band's own
 * center third."
 *
 * Section 3 sets what the crowns are FOR: "A coarse selection (which of two
 * states, which preset, which track) sits beside a small edge-mounted control
 * that nudges a value within that selection without ever touching the coarse
 * choice itself — the direct descendant of the pair of speed selectors, each
 * carrying its own small fine-trim knob beside it."
 *
 * There are exactly two such pairs on this screen, and both are real:
 *
 *   TRIP     (full shop | day-7 top-up)  with the AISLE crown beside it.
 *            Turning the crown opens a different aisle of the same trip; it
 *            cannot change which trip you are looking at. Its flush-check reads
 *            TRUE when every line in the open aisle carries a real current price.
 *
 *   STATION  (morrisons | sainsbury's | market) with the RECONCILE crown beside
 *            it. Turning the crown steps through the trip's price-verify
 *            nominees; it cannot change which shop you are standing in. Its
 *            flush-check reads TRUE when every nominee has a typed-back figure.
 *
 * Both rings can genuinely fail their own check, which is what section 9's "Fake
 * locks" requires of anything wearing one. Nothing else on this screen wears a
 * ring: a lid prints a figure instead, because a lid is not a control whose
 * value drifts.
 *
 * THE BAND CARRIES NO TEXT. Everything readable sits inside the band's own
 * recessed track of inset control black — which is where section 2 already puts
 * "the touch controls and the index window" — because strobe white on brushed
 * aluminium measures 1.35:1 and the ink-plate law is a hard fail by rule.
 */

import { forwardRef } from "react";
import { CapKey, Crown, FlushKey, Selector, TrackWindow, type TrackWindowHandle } from "./Instruments";
import type { Position } from "./model";

export interface HorizonBandProps {
  /* the position readout */
  position: Position;
  positionLabel: string;

  /* coarse 1 + fine 1 */
  tripSeats: { value: string; word: string; figure?: string }[];
  tripValue: string;
  onTrip: (next: string) => void;
  aisleLabel: string;
  aisleFigure: string;
  aisleError: number;
  onAisleStep: (direction: 1 | -1) => void;

  /* the cueing cluster */
  onFirst: () => void;
  onPrev: () => void;
  onLift: () => void;
  onNext: () => void;
  onLast: () => void;
  liftDisabled: boolean;

  /* coarse 2 + fine 2 */
  stationSeats: { value: string; word: string; figure?: string }[];
  stationValue: string;
  onStation: (next: string) => void;
  reconcileLabel: string;
  reconcileFigure: string;
  reconcileError: number;
  onReconcileStep: (direction: 1 | -1) => void;
  onReconcileOpen: () => void;

  /* the send summons */
  onSend: () => void;
  sendControls: string;
  sendOpen: boolean;

  /* the Signature's printed channel */
  horizonWord: string;
  /** 0..1 — the uncosted share of the basket, spent as the seam's gap fraction. */
  seamBreak: number;
  trophy: boolean;
}

export const HorizonBand = forwardRef<TrackWindowHandle, HorizonBandProps>(function HorizonBand(
  props,
  ref
) {
  const {
    position,
    positionLabel,
    tripSeats,
    tripValue,
    onTrip,
    aisleLabel,
    aisleFigure,
    aisleError,
    onAisleStep,
    onFirst,
    onPrev,
    onLift,
    onNext,
    onLast,
    liftDisabled,
    stationSeats,
    stationValue,
    onStation,
    reconcileLabel,
    reconcileFigure,
    reconcileError,
    onReconcileStep,
    onReconcileOpen,
    onSend,
    sendControls,
    sendOpen,
    horizonWord,
    seamBreak,
    trophy,
  } = props;

  return (
    <div className="shop-band-mount">
      <div className="shop-band">
        <div className="shop-band-track">
          <div className="shop-position">
            <TrackWindow
              ref={ref}
              ticks={Math.max(1, position.total)}
              label={positionLabel}
              marks={[{ key: "pos", pct: position.pct }]}
            />
            <span className="shop-position-read">
              {position.span > 0 ? (
                <>
                  <span>line</span>
                  <b>{position.first}</b>
                  <span>–</span>
                  <b>{position.first + position.span - 1}</b>
                  <span>of</span>
                  <b>{position.total}</b>
                </>
              ) : (
                <>
                  <span>all lids shut ·</span>
                  <b>{position.total}</b>
                  <span>lines</span>
                </>
              )}
              <span className="shop-horizon-word">{horizonWord}</span>
            </span>
          </div>

          {!trophy && (
            <div className="shop-controls">
              {tripSeats.length > 1 && (
                <Selector seats={tripSeats} value={tripValue} onChange={onTrip} label="trip" />
              )}
              <Crown
                name="aisle fine adjust — arrow keys step through the trip's aisles"
                label={aisleLabel}
                figure={aisleFigure}
                errorDeg={aisleError}
                onStep={onAisleStep}
              />

              <span className="shop-controls-spacer" />

              <div className="shop-cluster" role="group" aria-label="cueing cluster">
                <FlushKey kind="first" name="first aisle of the trip" onPress={onFirst} />
                <FlushKey kind="prev" name="previous aisle" onPress={onPrev} />
                <FlushKey kind="lift" name="lift — shut every lid" onPress={onLift} disabled={liftDisabled} />
                <FlushKey kind="next" name="next aisle" onPress={onNext} />
                <FlushKey kind="last" name="last aisle of the trip" onPress={onLast} />
              </div>

              <span className="shop-controls-spacer" />

              <Crown
                name="reconcile fine adjust — arrow keys step the verify nominees, press to open the pad"
                label={reconcileLabel}
                figure={reconcileFigure}
                errorDeg={reconcileError}
                onStep={onReconcileStep}
                onPress={onReconcileOpen}
              />
              {stationSeats.length > 1 && (
                <Selector
                  seats={stationSeats}
                  value={stationValue}
                  onChange={onStation}
                  label="station"
                />
              )}

              <CapKey cap="send" onPress={onSend} expanded={sendOpen} controls={sendControls} />
            </div>
          )}
        </div>
      </div>

      {/* section 2's three points of shadow contact, never four */}
      <span className="shop-foot" data-shop-foot="a" aria-hidden="true" />
      <span className="shop-foot" data-shop-foot="b" aria-hidden="true" />
      <span className="shop-foot" data-shop-foot="c" aria-hidden="true" />

      {/*
        THE HORIZON ITSELF (section 7's Signature). A rule under the band whose
        gap fraction IS the uncosted share of the basket, redrawn every time that
        error changes and closing into one continuous strobe-white line the frame
        the last line is costed. It is not an animation with nothing behind it:
        the printed word beside the position readout states the same fact, and
        the two crown rings state it again in geometry.
      */}
      <div
        className="shop-seam"
        style={{ "--shop-seam-dash": `${Math.round(seamBreak * 100)}%` } as React.CSSProperties}
        aria-hidden="true"
      />
    </div>
  );
});
