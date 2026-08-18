/**
 * src/screens/plan/Gauge.tsx — the hybrid gauge, one of five in the case row.
 *
 * ch.17 section 3: "a second reading lives at the dial's own center: a small
 * VFD-style inset (II.3.22) ... repeating the identical value as a lining,
 * tabular numeral the instant the sweep begins — the same fact told twice, once
 * as rate and direction, once as the committed figure".
 *
 * ch.17 section 4, Dense Dashboard, the ruling that shapes this whole screen:
 * "only the RANK-ONE card earns the hero gauge's tier-3 treatment and its
 * digital inset; every other card carries a plain analog face with a needle and
 * no inset, because THE INSET IS A SCARCE FACT, NOT A HOUSE DEFAULT."
 *
 * So: five gauges, one inset. The four subordinate dials still print their
 * exact figure — CORRECTIONARY 5.3 does not bend — but they print it on their
 * own PLATE rather than lit in a window on the face. Engraved-on-a-plate and
 * lit-in-a-window are two different claims, and only one of them is scarce.
 * (It was engraved on the face first, per II.6.7. Measured at 390px, a figure
 * and the engraved channel name on a 72px face overlapped outright, so the
 * figure moved to the housing's own plate — where a smaller instrument prints
 * its reading anyway.)
 *
 * ---------------------------------------------------------------------------
 * THE INSET IS NOT LIT IN THE LIVE ROLE, AND THAT IS DELIBERATE
 * ---------------------------------------------------------------------------
 * ch.17 gives the inset a #5EE6A8 phosphor and calls it "this pigment world's
 * one licensed emissive exception (II.7.9)". world.css supersedes that hex:
 * "SUPERSEDED: ... RESTOMOD's OLED #5EE6A8" -> `--cd-role-live` #FF2B1A, which
 * CD-BRIEF ruling 3 pins to exactly one meaning product-wide: "the chassis
 * rec-dot uses the same hex, so 'a cook program is running' is one claim made
 * once."
 *
 * NOTHING ON PLAN IS LIVE. A fortnight total is derived from the plan, not
 * sampled from the world — the freshness table declares the macros class
 * never-stale for that exact reason. Lighting this inset in the live red would
 * claim a cook program is running on a screen where none is: drama that lies,
 * which the honesty rule forbids outright.
 *
 * The resolution keeps the exception and drops only the role: the inset burns
 * in `--cd-oled-white` #E9F6EC, which is ch.17's OWN section-2 registry entry
 * for this window ("the inset's secondary digit stroke"), on `--cd-live-well`
 * #121213 at 16.81:1. White is not a reserved role, so no role is spent and
 * II.7.12's "every other reserved role idles at zero" holds exactly.
 */

import { memo, type Ref } from "react";
import { Enclosure, Escutcheon, Plate } from "../../cd/foundry";
import type { Band } from "../../data/types";
import { DialLabels, DialTicks, MarkHair, Needle, bandPath, R } from "./gaugeParts";
import {
  BAND_WORD,
  MAJOR_EVERY,
  bandMiss,
  bandState,
  formatChannel,
  formatSigned,
  fractionOf,
  isPinned,
  type ChannelSpec,
  type DialScale,
} from "./model";

export interface GaugeProps {
  spec: ChannelSpec;
  scale: DialScale;
  band: Band;
  value: number;
  /** The operator's own reference line, from the crown's fine gear. */
  mark: number;
  /** Rank one: the centre of the row. Tier-3 stack, hot ink, the one inset. */
  hero: boolean;
  /** The crown's pulled gear has paged to this dial. */
  focused: boolean;
  /** What the reading covers — "one plated week" / "the executing fortnight". */
  scopeLabel: string;
  /** Imperative handles so a commit can land inside the input's own task. */
  needleRef: Ref<HTMLSpanElement>;
  figureRef: Ref<HTMLSpanElement>;
  wordRef: Ref<HTMLSpanElement>;
  missRef: Ref<HTMLSpanElement>;
}

/** The printed zones, UNDER the ticks. A zone, never a lamp (II.7.8). */
const Face = memo(function Face({
  scale,
  minors,
}: {
  scale: DialScale;
  minors: number;
}) {
  const z = scale.zones;
  return (
    <svg className="pln-face" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <g fill="none" strokeWidth={0.06 * R} strokeLinecap="butt">
        <path className="pln-zone pln-zone--redline" d={bandPath(0, z.dangerLow)} />
        <path className="pln-zone pln-zone--caution" d={bandPath(z.dangerLow, z.bandStart)} />
        <path className="pln-zone pln-zone--band" d={bandPath(z.bandStart, z.bandEnd)} />
        <path className="pln-zone pln-zone--caution" d={bandPath(z.bandEnd, z.warnHigh)} />
        <path className="pln-zone pln-zone--redline" d={bandPath(z.warnHigh, 1)} />
      </g>
      <DialTicks minors={minors} majorEvery={MAJOR_EVERY} />
    </svg>
  );
});

export const Gauge = memo(function Gauge({
  spec,
  scale,
  band,
  value,
  mark,
  hero,
  focused,
  scopeLabel,
  needleRef,
  figureRef,
  wordRef,
  missRef,
}: GaugeProps) {
  const state = bandState(value, band);
  const miss = bandMiss(value, band);
  const pinned = isPinned(value, scale);
  const figure = formatChannel(value, spec);
  const lowText = formatChannel(band[0], spec);
  const highText = formatChannel(band[1], spec);
  const markText = formatChannel(mark, spec);

  const sentence =
    `${spec.label}, ${scopeLabel}: ${figure} ${spec.spoken}, ` +
    `band ${lowText} to ${highText}, ${BAND_WORD[state].toLowerCase()}` +
    (miss === 0 ? "" : `, ${formatSigned(miss, spec)}${spec.unit} from the band edge`) +
    (pinned ? ", needle pinned at the stop" : "") +
    `. Your mark: ${markText} ${spec.unit}.`;

  return (
    <Enclosure
      variant={hero ? "hero" : "pod"}
      as="article"
      grain
      className="pln-gauge"
      data-pln-rank={hero ? "1" : "2"}
      data-pln-focused={focused ? "true" : "false"}
      data-pln-state={state}
      aria-current={focused ? "true" : undefined}
    >
      <div className="pln-case">
        <Enclosure variant="bezel" className="pln-bezel">
          <div className="pln-dial" role="img" aria-label={sentence}>
            <Face scale={scale} minors={scale.minors} />
            <DialLabels
              labels={scale.labels.map((l, i) => ({
                at: l.at,
                text: formatChannel(l.value, { ...spec, decimals: 0 }),
                wink: Boolean(spec.wink) && i === scale.labels.length - 1,
              }))}
            />
            <div className="pln-mark-hair" aria-hidden="true">
              <svg viewBox="0 0 200 200" focusable="false">
                <MarkHair at={fractionOf(mark, scale)} />
              </svg>
            </div>

            <Escutcheon className="pln-dial-word">{spec.label}</Escutcheon>

            {/* THE ONE INSET ON THE PANEL. II.3.22's window, ch.17's own OLED
                white, printing the identical fact the needle reports. The four
                subordinate dials print their figure on their own plate instead
                — "the inset is a scarce fact, not a house default", and a
                figure crowded onto a 72px face beside its engraved name is not
                a readout, it is two marks fighting for one hole. Measured at
                390px, where they overlapped outright. */}
            {hero && (
              <span className="pln-inset" data-pln-state={state}>
                <span className="pln-inset-figure cd-data" ref={figureRef}>
                  {figure}
                </span>
                <span className="pln-inset-unit cd-unit">{spec.unit}</span>
              </span>
            )}

            <Needle refEl={needleRef} pinned={pinned} />
          </div>
        </Enclosure>
      </div>

      {/* CORRECTIONARY 5.3 — the analog form AND the exact figure, plus the
          band it is judged against and the printed state word II.7.7 requires
          so the reading survives desaturation, an 8px blur and forced-colours. */}
      <Plate className="pln-gauge-plate" surface="data">
        {!hero && (
          <p className="pln-gauge-read">
            <span
              className="pln-gauge-figure cd-data"
              style={{ "--cd-value-ch": spec.valueCh } as React.CSSProperties}
              ref={figureRef}
            >
              {figure}
            </span>
            <span className="cd-unit">{spec.unit}</span>
          </p>
        )}
        <p className="pln-gauge-line">
          <span className="pln-gauge-word cd-silkscreen" data-pln-word={state} ref={wordRef}>
            {BAND_WORD[state]}
          </span>
          <span className="pln-gauge-miss cd-printed" ref={missRef}>
            {miss === 0 ? "on target" : `${formatSigned(miss, spec)}${spec.unit}`}
          </span>
        </p>
        <p className="pln-gauge-band cd-printed">
          <span className="cd-silkscreen pln-gauge-cap">band</span>
          <span>
            {lowText}–{highText}
            <span className="cd-unit">{spec.unit}</span>
          </span>
        </p>
        {/* "your mark", not "mark": the row above it is the PLAN's own band and
            this one is a line the hand set with the crown, unsaved past a
            reload. Set in the same ink, the same register and the same
            alignment, they read as two figures of the same kind. */}
        <p className="pln-gauge-mark cd-printed">
          <span className="cd-silkscreen pln-gauge-cap">your mark</span>
          <span>
            {markText}
            <span className="cd-unit">{spec.unit}</span>
          </span>
        </p>
        {pinned && (
          <p className="pln-gauge-pin cd-silkscreen">
            needle on the stop · the figure above is the reading
          </p>
        )}
      </Plate>
    </Enclosure>
  );
});
