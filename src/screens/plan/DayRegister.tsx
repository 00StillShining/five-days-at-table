/**
 * src/screens/plan/DayRegister.tsx — twenty slots without a page-length scroll.
 *
 * CD-BRIEF R7: "No page-length scrolling. Long registers use a GROUPED
 * ACCORDION, ONE SECTION OPEN AT A TIME, with the hidden remainder printed as a
 * number ('confess the overflow'). Only one group renders at full material at a
 * time." Five day lids, four rows under the one that is lifted. The foundry's
 * Register unmounts every closed group outright, which the STORES spike
 * measured as the single largest saving available on this pattern — R7 alone is
 * insufficient, because a drawer at `grid-template-rows: 0fr` is hidden from
 * paint but not from React.
 *
 * Open state is driven from `useOpenSection` in the scene (R6): scenes unmount
 * on navigation, so a `useState` here would forget which day was open the
 * moment the operator visited STORES and came back.
 *
 * ---------------------------------------------------------------------------
 * THE ROW ANATOMY IS II.6.12's, IN ITS OWN ORDER
 * ---------------------------------------------------------------------------
 *   1 a mark ......... the tag, engraved: batch | fresh | swap | cut | empty
 *   2 identity ....... the meal, flexing, and the only link on the row
 *   3 a secondary .... when it was last logged, trailing in muted ink
 *   4 the reading .... kcal and the crown's focused channel, tabular
 *   5 the status ..... logged / not logged, engraved rather than lit
 * ...then the swap key, which is a control and not one of the five slots.
 *
 * ch.17 section 4's List/Browser adds the fence that shapes the finish: "ivory
 * ground, ONE hairline separator — never a zebra fill on a light field, since a
 * wash reads as a stain on ivory."
 *
 * ---------------------------------------------------------------------------
 * NO LAMP ON THIS SCREEN EXCEPT THE ONE INSET
 * ---------------------------------------------------------------------------
 * II.7.9 licenses RESTOMOD exactly one emissive exception, and section 3 spends
 * it on the hybrid gauge's inset. Twenty lit status lamps would spend it twenty
 * more times. So "logged" is carried in pigment, on three channels at once: an
 * engraved mark that is FILLED or HOLLOW (shape), heritage green hot or dim
 * (ink), and the printed word (II.7.7). It survives desaturation and
 * forced-colours with nothing lost.
 *
 * ---------------------------------------------------------------------------
 * THE 44px DEFECT THIS SCREEN INHERITED, AND WHERE IT IS CLEARED
 * ---------------------------------------------------------------------------
 * The shipped board's `.scr-plan-card-name` was a bare inline anchor — measured
 * 199.6 x 24px, failing the Floor on the block axis with no `min-block-size`,
 * no padding and no display change. Its successor is `.pln-slot-name` below: a
 * flex block that declares `min-block-size: var(--cd-target-min)` and a real
 * inline padding, so it clears 44px on BOTH axes at every breakpoint.
 */

import { memo } from "react";
import { Escutcheon, PressKey, Register, type RegisterGroup } from "../../cd/foundry";
import { Stale } from "../../cd/freshness/Stale";
import { ageOf, FRESHNESS } from "../../cd/freshness/classes";
import type { Band } from "../../data/types";
import {
  BAND_WORD,
  bandState,
  fractionOf,
  dialScale,
  formatChannel,
  offSentence,
  type ChannelSpec,
  type DayReading,
  type SlotReading,
} from "./model";

export const EATEN_THRESHOLD = `${Math.round(FRESHNESS.eaten.staleAfterMs / 3_600_000)}h`;

export interface DayRegisterProps {
  days: DayReading[];
  openId: string | null;
  onOpenChange: (next: string | null) => void;
  /** The channel the crown has paged to — the register reports it on every row. */
  channel: ChannelSpec;
  /** Now, on the scene's own 60s clock. Ages are day-granular here. */
  nowMs: number;
  onSwap: (dayNo: number, slot: SlotReading) => void;
  /** The fixed-position recovery for a stale logged mark. */
  onToday: () => void;
  isTester: boolean;
}

function DayLid({
  day,
  channel,
  band,
}: {
  day: DayReading;
  channel: ChannelSpec;
  band: Band;
}) {
  const value = day.macros[channel.key];
  const state = bandState(value, band);
  const scale = dialScale(band);
  const f = fractionOf(value, scale);
  const z = scale.zones;
  return (
    <span className="pln-lid" data-pln-state={state}>
      <span className="pln-lid-theme cd-silkscreen">{day.theme}</span>
      <span className="pln-lid-strip" aria-hidden="true">
        <span
          className="pln-lid-band"
          style={{
            insetInlineStart: `${(z.bandStart * 100).toFixed(1)}%`,
            inlineSize: `${((z.bandEnd - z.bandStart) * 100).toFixed(1)}%`,
          }}
        />
        <span className="pln-lid-needle" style={{ insetInlineStart: `${(f * 100).toFixed(1)}%` }} />
      </span>
      <span className="pln-lid-read cd-data">
        {formatChannel(value, channel)}
        <span className="cd-unit">{channel.unit}</span>
      </span>
      <span className="pln-lid-word cd-silkscreen" data-pln-word={state}>
        {BAND_WORD[state]}
      </span>
      {/* Every channel off band, in EITHER direction, whichever one the crown
          happens to be pointed at. Without it the lid reported kcal UNDER BAND
          on a day the same swap had just put protein OVER, and nothing on the
          board said so. */}
      <span className="pln-lid-off cd-silkscreen" data-pln-any={day.off.length > 0 ? "true" : "false"}>
        {offSentence(day.off)}
      </span>
    </span>
  );
}

const SlotRow = memo(function SlotRow({
  dayNo,
  reading,
  channel,
  nowMs,
  onSwap,
  onToday,
}: {
  dayNo: number;
  reading: SlotReading;
  channel: ChannelSpec;
  nowMs: number;
  onSwap: (dayNo: number, slot: SlotReading) => void;
  onToday: () => void;
}) {
  const logged = reading.loggedAt != null;
  const age = logged ? ageOf("eaten", reading.loggedAt, nowMs) : null;

  return (
    <div className="pln-slot" data-pln-mark={reading.mark}>
      {/* 1 · the mark */}
      <span className="pln-slot-mark cd-silkscreen" data-pln-mark={reading.mark}>
        {reading.mark}
      </span>

      {/* 2 · identity — the row's one link, and the Floor's own target */}
      <span className="pln-slot-id">
        <span className="pln-slot-slot cd-silkscreen">{reading.label}</span>
        {reading.meal ? (
          <a className="pln-slot-name cd-focusable" href={`#/meal/${reading.meal.id}`}>
            {reading.meal.name}
          </a>
        ) : reading.cutReason ? (
          <span className="pln-slot-cut">
            <span className="pln-slot-cut-word cd-silkscreen">cut</span>
            <span className="pln-slot-cut-why cd-prose">{reading.cutReason}</span>
          </span>
        ) : (
          <span className="pln-slot-empty cd-printed">no meal authored for this slot</span>
        )}
        {reading.displaced && reading.meal && (
          <span className="pln-slot-was cd-printed">
            was <span className="pln-slot-was-name">{reading.displaced.name}</span>
          </span>
        )}
      </span>

      {/* 3 + 5 · the secondary field and the status, together, because a stale
          reading holds its value, dims to 55%, prints its word and offers a
          recovery at a FIXED position (II.3.18's own state set). */}
      <span className="pln-slot-log">
        <span className="pln-slot-tick" data-pln-logged={logged ? "true" : "false"} aria-hidden="true" />
        {logged && age ? (
          <Stale
            className="pln-slot-stale"
            age={age}
            label={`${reading.label} logged`}
            action={
              <PressKey className="pln-slot-recover" onPress={onToday} cap="today →" />
            }
          >
            <span className="cd-printed">logged</span>
          </Stale>
        ) : (
          <span className="pln-slot-unlogged cd-printed">
            {reading.meal ? "not logged" : "—"}
          </span>
        )}
      </span>

      {/* 4 · the reading */}
      <span className="pln-slot-read cd-data">
        <span className="pln-slot-kcal">
          {Math.round(reading.macros.kcal)}
          <span className="cd-unit">kcal</span>
        </span>
        {channel.key !== "kcal" && (
          <span className="pln-slot-chan">
            {formatChannel(reading.macros[channel.key], channel)}
            <span className="cd-unit">{channel.unit}</span>
          </span>
        )}
      </span>

      {/* the control. docs/VARIANT-SPEC.md: the swap deck is HIDDEN for cut
          slots — nothing can be swapped into a slot the tester never cooks. */}
      <span className="pln-slot-act">
        {reading.meal ? (
          <PressKey
            className="pln-slot-swap"
            onPress={() => onSwap(dayNo, reading)}
            sound="contact"
            cap="swap"
          >
            <span className="fd5-visually-hidden">
              {" "}
              · day {dayNo} {reading.label}
            </span>
          </PressKey>
        ) : (
          <span className="pln-slot-noswap cd-silkscreen">
            {reading.cutReason ? "no swap" : ""}
          </span>
        )}
      </span>
    </div>
  );
});

export function DayRegister({
  days,
  openId,
  onOpenChange,
  channel,
  nowMs,
  onSwap,
  onToday,
  isTester,
}: DayRegisterProps) {
  const groups: RegisterGroup[] = days.map((day) => ({
    id: `day-${day.dayNo}`,
    label: day.abbr,
    lidSlot: <DayLid day={day} channel={channel} band={day.band[channel.key]} />,
    items: day.slots.map((reading) => () => (
      <SlotRow
        dayNo={day.dayNo}
        reading={reading}
        channel={channel}
        nowMs={nowMs}
        onSwap={onSwap}
        onToday={onToday}
      />
    )),
  }));

  return (
    <section className="pln-register-set" aria-label="the plated days, slot by slot">
      <header className="pln-register-head">
        <Escutcheon as="h2">the board</Escutcheon>
        <p className="pln-register-note cd-printed">
          <span className="cd-silkscreen">reporting</span> {channel.label}
          <span aria-hidden="true"> · </span>
          <span className="cd-silkscreen">logged goes stale after</span> {EATEN_THRESHOLD}
          {isTester && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="cd-silkscreen">cut slots carry their stated reason</span>
            </>
          )}
        </p>
      </header>
      <Register
        className="pln-register"
        groups={groups}
        openId={openId}
        onOpenChange={onOpenChange}
        label="plated days"
        overflowWord="slots"
      />
    </section>
  );
}
