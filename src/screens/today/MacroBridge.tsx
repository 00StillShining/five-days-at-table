/**
 * src/screens/today/MacroBridge.tsx — the four subordinate gauges.
 *
 * ch.05 section 4, Hero Screen: "a subordinate strip beneath ... holding four
 * smaller gauges". CORRECTIONARY 3.1 revokes the half of that clause which
 * held them at tier 2 — every one of these gets the full material treatment,
 * because "plain competence as a deliberate design register is abolished".
 *
 * Each ladder is a bar meter (II.3.19) cut into an anthracite well: zone
 * geometry printed on the track, segments lit in the channel's own hue, and a
 * band bracket engraved beneath. Every one prints its exact figure — "a number
 * typeset on a background is NOT a readout", and neither is a bar without one.
 *
 * ---------------------------------------------------------------------------
 * COLOUR, MEASURED (CD-BRIEF repair 2)
 * ---------------------------------------------------------------------------
 * "Channel-coloured text renders ONLY on cream faces. Elsewhere channel
 * identity is position + engraved label + segment fill, never hue alone."
 *
 *   channel ink on the cream face #EDE6D6 ........ 5.17 - 5.39 : 1   (text)
 *   channel lift lit vs the unlit segment #2A2A2C  5.72 - 5.78 : 1   (graphic)
 *   channel lift on anthracite #3A3A3C ........... 4.53 - 4.58 : 1
 * So the WORD is set in the channel's ink on its own cream plate, and the
 * SEGMENTS are the channel's lift inside the well. Nothing coloured is ever set
 * on carbon.
 *
 * kcal carries no hue at all: it is the day's total, not one of the four macro
 * channels, and it reads by position, engraved label and mirror-billet fill.
 */

import { memo } from "react";
import { Enclosure, Escutcheon, PressKey } from "../../cd/foundry";
import type { Band } from "../../data/types";
import {
  CHANNELS,
  SEGMENTS,
  bracketColumns,
  dialScaleMax,
  formatChannel,
  segmentStates,
  type ChannelKey,
  type ChannelSpec,
} from "./model";

interface LadderProps {
  spec: ChannelSpec;
  index: number;
  value: number;
  target: number;
  band: Band;
  selected: boolean;
  onSelect: (index: number) => void;
}

const Ladder = memo(function Ladder({ spec, index, value, target, band, selected, onSelect }: LadderProps) {
  const scaleMax = dialScaleMax(band);
  const states = segmentStates(value, band, scaleMax);
  const bracket = bracketColumns(band, scaleMax);
  const over = value > band[1];
  const displayValue = formatChannel(value, spec);
  const displayTarget = formatChannel(target, spec);

  return (
    <li className="tdy-ladder" data-tdy-seated={selected ? "true" : "false"}>
      {/* THE SECOND LEVER on the one linkage: pressing a ladder throws the same
          rod the knob throws, in the same task, so the rocker swings and the
          hero porthole turns before this key's own release settle is done. */}
      <PressKey
        className="tdy-ladder-key"
        onPress={() => onSelect(index)}
        sound="none"
        aria-pressed={selected}
        aria-label={`show ${spec.title} on the hero dial`}
        style={{ "--tdy-ch": spec.ink ?? "var(--cd-ink)" } as React.CSSProperties}
      >
        <span className="tdy-ladder-label">{spec.label}</span>
      </PressKey>

      <div
        className="tdy-ladder-well"
        role="img"
        aria-label={`${spec.label}: ${displayValue} eaten of ${displayTarget} planned ${spec.spoken}, week band ${formatChannel(band[0], spec)} to ${formatChannel(band[1], spec)}${over ? ", over band" : ""}`}
        style={{ "--tdy-ch-lit": spec.lift } as React.CSSProperties}
      >
        <div className="tdy-ladder-segments" aria-hidden="true">
          {states.map((s, i) => (
            <span key={i} className="tdy-seg" data-tdy-seg={s} />
          ))}
          {/* The band bracket, engraved under the track: where the week says
              this reading ought to land. A printed zone, never a lamp. */}
          <span
            className="tdy-ladder-bracket"
            style={{ gridColumn: `${bracket.start} / ${bracket.end}` }}
          />
        </div>
      </div>

      <p className="tdy-ladder-figure cd-printed" aria-hidden="true">
        <span className="cd-value" style={{ "--cd-value-ch": spec.valueCh } as React.CSSProperties}>
          {displayValue}
        </span>
        <span className="tdy-ladder-slash">/</span>
        <span className="cd-value tdy-ladder-target" style={{ "--cd-value-ch": spec.valueCh } as React.CSSProperties}>
          {displayTarget}
        </span>
        <span className="cd-unit">{spec.unit}</span>
      </p>
    </li>
  );
});

export interface MacroBridgeProps {
  eaten: Record<ChannelKey, number>;
  planned: Record<ChannelKey, number>;
  bands: Record<ChannelKey, Band>;
  channel: number;
  onSelect: (index: number) => void;
}

export function MacroBridge({ eaten, planned, bands, channel, onSelect }: MacroBridgeProps) {
  return (
    <Enclosure variant="faceplate" as="section" className="tdy-bridge" aria-label="meter bridge, four macro channels">
      <header className="tdy-bridge-head">
        <Escutcheon as="h2">
          meter bridge
        </Escutcheon>
        <Escutcheon className="tdy-bridge-note">eaten · planned · week band</Escutcheon>
      </header>
      <ul className="tdy-bridge-rows">
        {CHANNELS.map((spec, i) => (
          <Ladder
            key={spec.key}
            spec={spec}
            index={i}
            value={eaten[spec.key]}
            target={planned[spec.key]}
            band={bands[spec.key]}
            selected={i === channel}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </Enclosure>
  );
}
