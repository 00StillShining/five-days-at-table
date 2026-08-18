/**
 * src/screens/stores/LeftoverRow.tsx — a leftover, milled into the same plate.
 *
 * PLAN section 6.7: leftovers appear inside the register's fridge group "with a
 * distinct tag". They are NOT level-tracked — a leftover is one dated batch
 * with a computed use-by, not a fuzzy 0-4 stock level — so this row carries no
 * level pointer and cannot be addressed by the thumbwheel.
 *
 * The distinct tag is MATERIAL, not a coloured pill: the row is inlaid with
 * CLEAR LID's pale elm veneer (#D8BD8E, section 2 — "rails, tray linings,
 * secondary panels, warm trim"), which is the one warm substance in this world
 * and reads as a different thing at a squint without spending a semantic hue.
 * The word "leftover" prints on it as well, so the material is never the only
 * channel (II.7.7).
 *
 * The level channel is not left blank: an absent reading prints its own rest
 * stop, because a blank cell reads as a loading state that never finished
 * (screencraft/03's own honesty law).
 */

import type { LeftoverEntry, Action } from "../../state/types";
import { getMeal } from "../../data";
import { PressKey } from "../../cd/foundry";
import { countdownForUseBy, LEFTOVER_LIFE_DAYS } from "./countdown";
import { lifePxOf } from "./model";

export interface LeftoverRowProps {
  entry: LeftoverEntry;
  index: number;
  now: Date;
  lifePx: number;
  dispatch: (a: Action) => void;
  onConsume: (id: string) => void;
}

function leftoverName(entry: LeftoverEntry): string {
  if (entry.source === "meal") return getMeal(entry.ref)?.name ?? entry.ref;
  return entry.ref; // prep source: `ref` is already the yield component's name
}

export function LeftoverRow({ entry, index, now, lifePx, onConsume }: LeftoverRowProps) {
  const countdown = countdownForUseBy(entry.useBy, now, LEFTOVER_LIFE_DAYS);
  const name = leftoverName(entry);
  const lifeX = countdown.fraction === null ? null : lifePxOf(countdown.fraction, lifePx);

  return (
    <div
      className="str-row str-row--leftover"
      data-status={countdown.status}
      style={{ ["--str-row-i" as string]: String(index) }}
    >
      <span className="str-row__name">
        <span className="str-row__tag">leftover</span>
        {name}
        <span className="str-row__suffix">{entry.g != null ? ` ${entry.g}g` : ""}</span>
      </span>

      {/* the level channel: a rest stop, not a blank */}
      <span className="str-row__scale" aria-hidden="true">
        <span className="str-row__stop" />
      </span>

      <span className="str-row__life" aria-hidden="true">
        {lifeX !== null && (
          <span className="str-row__marker" style={{ ["--str-marker-x" as string]: `${lifeX.toFixed(2)}px` }} />
        )}
      </span>

      <PressKey
        className="str-row__used"
        onPress={() => onConsume(entry.id)}
        cap="used up"
        aria-label={`mark ${name} used up`}
      />

      <span className="str-row__countdown" aria-hidden="true">
        {countdown.status === "expired" ? "✕ " : countdown.status === "expiring" ? "△ " : ""}
        {countdown.text}
      </span>

      <span className="str-row__age" aria-hidden="true">
        {LEFTOVER_LIFE_DAYS}d
      </span>
    </div>
  );
}
