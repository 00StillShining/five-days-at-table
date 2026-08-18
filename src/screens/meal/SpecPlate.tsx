/**
 * src/screens/meal/SpecPlate.tsx — II.3.31's inspector, and ch.16's Detail stage.
 *
 * ch.16 section 4, Detail: "an inspector (→II.3.31) on the narrow side holding
 * THE COMPLETE SPEC SHEET — codec, sample rate, bit depth, DAC path, file size
 * — content swapping within ONE FRAME on selection."
 *
 * FD-5's spec sheet is the plate's: five macros at the committed portion, the
 * active minutes it costs, where the dish comes from, where it sits in the
 * fortnight, and whether its method has been approved. Every figure is derived
 * from the plan rather than sampled from the world, so the macros class is
 * declared never-stale (cd/freshness/classes.ts) and none of them carries an
 * age — inventing one would be exactly the invented data the honesty rule bans.
 *
 * ---------------------------------------------------------------------------
 * THE UNIT-PAIR (ch.16 section 2, applying II.6.6 to two co-dependent numbers)
 * ---------------------------------------------------------------------------
 * "This world pairs bit-depth and sample-rate into ONE PRINTED UNIT-PAIR —
 * 24BIT/192KHZ — rather than as two separate values ... dim ink at 40% of the
 * value's size."
 *
 * The plate's own co-dependent pair is the portion and the cover: neither figure
 * means anything without the other, because 612 g is a different plate depending
 * on whose it is. So it prints as one unit-pair — ×1.15/85KG — in the data voice
 * at the same 40% dim ink.
 *
 * ---------------------------------------------------------------------------
 * THE VIOLET, SPENT ONCE (CORRECTIONARY 6.5 — declared, not quietly dropped)
 * ---------------------------------------------------------------------------
 * ch.16 reserves its signature hue to one fact and one fact only. Here that fact
 * is PROVENANCE: this plate is drawn from Sunday's batch rather than cooked from
 * raw, which is the rarest and most consequential categorical thing about it —
 * it means Sunday already happened, or has to.
 *
 * What is NOT carried over is the ring's 0.5Hz pulse. ch.16 grants pulse to
 * exactly one condition, "a DSD stream, once locked ... the sole idle motion
 * this language permits, BECAUSE A DSD LOCK IS THE ONE TRUTHFULLY ALIVE PROCESS
 * on a FACETED VOLUME screen". Nothing on MEAL is a live process: a batch draw
 * is a fact about the dataset and it does not change while anyone watches. A
 * breathing lamp over it would be CD-BRIEF ruling 6's ornament exactly —
 * "motion with nothing behind it". The lamp lights, holds, and stays still.
 */

import { Enclosure, Escutcheon, Lamp, Plate } from "../../cd/foundry";
import type { Cover, Macros, Meal } from "../../data";
import { COVER_LABEL, SPEC_CHANNELS, SLOT_LABEL, formatMacro, formatScale } from "./model";

export interface SpecPlateProps {
  meal: Meal;
  cover: Cover;
  scale: number;
  macros: Macros;
  /** True when a swap has put this meal into a slot it was not planned for. */
  swappedInto: string | null;
  /** The plan variant's own label, printed when the tester lens is active. */
  variantLabel: string | null;
}

export function SpecPlate({ meal, cover, scale, macros, swappedInto, variantLabel }: SpecPlateProps) {
  const batch = meal.method.batchTakeG != null;
  const coverKg = cover === "w" ? "70KG" : "85KG";

  return (
    <Enclosure variant="hero" as="section" grain className="mea-spec" aria-label="plate spec sheet">
      <header className="mea-spec-head">
        <Escutcheon as="h2">spec</Escutcheon>
        {/* the unit-pair: two co-dependent numbers as ONE value (II.6.6) */}
        <span className="mea-spec-pair cd-data">
          ×{formatScale(scale)}
          <span className="mea-spec-pair-unit">/{coverKg}</span>
        </span>
      </header>

      {/*
        Five printed figures, not five gauges. CD-BRIEF ruling 6: "a static macro
        figure ... gets a printed readout, not a mechanism." All five scale by
        the identical factor as the wheel, so five needles would be one needle
        drawn five times — the Refined ledger deletes four of them and keeps the
        figures, which is what a spec sheet is for.
      */}
      <Plate className="mea-spec-macros" surface="data" as="dl">
        {SPEC_CHANNELS.map((spec) => (
          <div className="mea-spec-macro" key={spec.key}>
            <dt className="mea-spec-label cd-silkscreen">{spec.label}</dt>
            <dd className="mea-spec-value">
              <span
                className="cd-value"
                style={{ "--cd-value-ch": spec.ch } as React.CSSProperties}
              >
                {formatMacro(macros[spec.key], spec)}
              </span>
              <span className="cd-unit">{spec.unit}</span>
            </dd>
          </div>
        ))}
      </Plate>

      <Plate className="mea-spec-sheet" surface="data" as="dl">
        <div className="mea-spec-line">
          <dt className="cd-silkscreen">cut for</dt>
          <dd className="cd-printed">{COVER_LABEL[cover]}</dd>
        </div>
        <div className="mea-spec-line">
          <dt className="cd-silkscreen">position</dt>
          <dd className="cd-printed">
            week {meal.week.toLowerCase()} · day {meal.day} · {SLOT_LABEL[meal.slot]}
          </dd>
        </div>
        <div className="mea-spec-line">
          <dt className="cd-silkscreen">origin</dt>
          <dd className="cd-printed mea-spec-origin">{meal.origin}</dd>
        </div>
        <div className="mea-spec-line">
          <dt className="cd-silkscreen">active</dt>
          <dd className="cd-printed">
            <span className="cd-value" style={{ "--cd-value-ch": 2 } as React.CSSProperties}>
              {meal.activeMin}
            </span>
            <span className="cd-unit">min</span>
          </dd>
        </div>
        <div className="mea-spec-line">
          <dt className="cd-silkscreen">method</dt>
          <dd className="cd-printed">
            rev {meal.method.rev}
            {meal.method.approved ? "" : " · unapproved, showing original prose"}
          </dd>
        </div>
        {swappedInto && (
          <div className="mea-spec-line" data-mea-note="swap">
            <dt className="cd-silkscreen">swapped</dt>
            <dd className="cd-printed">into the slot planned as {swappedInto}</dd>
          </div>
        )}
        {variantLabel && (
          <div className="mea-spec-line" data-mea-note="variant">
            <dt className="cd-silkscreen">variant</dt>
            <dd className="cd-printed">{variantLabel}</dd>
          </div>
        )}
      </Plate>

      {/* PROVENANCE — the one place this world's signature hue is spent, and it
          reports a categorical fact about the object, never a mood. */}
      <div className="mea-provenance">
        <Lamp
          lit={batch}
          hue="var(--cd-fmt-dsd)"
          word={{ on: "BATCH", off: "FRESH" }}
          label="provenance"
        />
        <p className="mea-provenance-note cd-printed">
          {batch
            ? "drawn from sunday's batch — the prep session has to have happened"
            : "cooked from raw on the day — nothing is drawn from a batch"}
        </p>
      </div>
    </Enclosure>
  );
}
