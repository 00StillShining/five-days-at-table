/**
 * src/screens/meal/PlateRegister.tsx — the plate itself, and the drum over it.
 *
 * CD-BRIEF R7: "Long registers use a grouped accordion, ONE SECTION OPEN AT A
 * TIME, with the hidden remainder printed as a number. Only one group renders
 * at full material at a time." The foundry's Register does that and, crucially,
 * UNMOUNTS closed groups — the measured performance law's single largest saving
 * ("a collapsed drawer at grid-template-rows: 0fr is hidden from paint but not
 * from React").
 *
 * Three lids, and each is a different question about the same plate:
 *   PLATE    every ingredient at the committed portion, with its own stock mark
 *   METHOD   the approved steps, timed, with their stations
 *   BATCH    what to take out of Sunday's batch — present only when there is one
 *
 * ---------------------------------------------------------------------------
 * THE DRUM (CORRECTIONARY 5.3)
 * ---------------------------------------------------------------------------
 * "Every value is an instrument. A needle over a printed arc, a DRUM COUNTER,
 * segmented digits ... plus its exact figure. A number typeset on a background
 * is not a readout and is not acceptable as one."
 *
 * The plate's total weight is the one figure on this instrument that the hand
 * changes directly, so it earns a mechanism (CD-BRIEF ruling 6: "Portholes,
 * rocker arms and spinning elements attach only to values whose change is
 * user-caused or clock-continuous"). Four wheels, because the widest real plate
 * in the dataset is a-d3d for him at 878g, which is 1141g at the wheel's own
 * upper stop — four digits, reserved (II.6.5), so an arriving digit never
 * resizes its neighbours.
 *
 * The macro figures beside it do NOT get a mechanism: they are derived from the
 * same one gesture and scale by exactly the same factor, so five moving
 * instruments would be one instrument drawn five times. They print. That is the
 * Refined rung's own ledger question — does it state a value, or let the hand do
 * something? — answered honestly in both directions.
 */

import { memo, useMemo } from "react";
import { Enclosure, Escutcheon, Register, type RegisterGroup } from "../../cd/foundry";
import type { Age } from "../../cd/freshness/classes";
import type { Cover, Meal } from "../../data";
import { ingredientsById, prepSessionById } from "../../data";
import {
  COVER_LABEL,
  formatHouseholdHint,
  formatStepDuration,
  type PlateRow,
} from "./model";

const STOCK_GLYPH: Record<number, string> = { 0: "○", 1: "◔", 2: "◑", 3: "◕", 4: "●" };
const STOCK_TEXT: Record<number, string> = {
  0: "out of stock",
  1: "about a quarter",
  2: "about half",
  3: "about three-quarters",
  4: "in stock",
};

/* ========================================================================== */
/* THE DRUM                                                                   */
/* ========================================================================== */

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * One wheel. The strip translates by whole digit heights on the seat's own
 * timing, so the number ARRIVES rather than being replaced — and it moves only
 * when the value moves, which is the whole licence for the mechanism.
 */
const DrumWheel = memo(function DrumWheel({ digit }: { digit: number }) {
  return (
    <span className="mea-drum-wheel" aria-hidden="true">
      <span className="mea-drum-strip" style={{ "--mea-digit": digit } as React.CSSProperties}>
        {DIGITS.map((d) => (
          <span key={d} className="mea-drum-digit">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
});

export function Drum({ value, places = 4 }: { value: number; places?: number }) {
  const text = String(Math.min(value, 10 ** places - 1)).padStart(places, "0");
  return (
    <span className="mea-drum" role="img" aria-label={`${value} grams`}>
      {text.split("").map((c, i) => (
        <DrumWheel key={i} digit={Number(c)} />
      ))}
    </span>
  );
}

/* ========================================================================== */
/* THE REGISTER                                                               */
/* ========================================================================== */

export interface PlateRegisterProps {
  meal: Meal;
  cover: Cover;
  scale: number;
  rows: PlateRow[];
  /** Total plate weight in grams at the committed scale — the drum's figure. */
  grams: number;
  openId: string | null;
  onOpenChange: (next: string | null) => void;
  /** Ages the stock marks; one clock, owned by the scene (II.4.13). */
  ageFor: (ingId: string) => Age;
}

export function PlateRegister({
  meal,
  cover,
  scale,
  rows,
  grams,
  openId,
  onOpenChange,
  ageFor,
}: PlateRegisterProps) {
  const groups = useMemo<RegisterGroup[]>(() => {
    const out: RegisterGroup[] = [
      {
        id: "plate",
        label: "plate",
        items: rows.map((row) => () => <PlateRowView row={row} age={ageFor(row.ingId)} />),
      },
      {
        id: "method",
        label: `method · rev ${meal.method.rev}`,
        items: meal.method.steps.map((step) => () => (
          <div className="mea-step">
            <span className="mea-step-n cd-data" aria-hidden="true">
              {String(step.n).padStart(2, "0")}
            </span>
            <div className="mea-step-body">
              <p className="mea-step-text">{step.text}</p>
              <p className="mea-step-meta">
                {step.station && <span className="mea-tag cd-silkscreen">{step.station}</span>}
                {step.track && <span className="mea-tag cd-silkscreen">{step.track}</span>}
                {step.tempC != null && <span className="mea-tag cd-silkscreen">{step.tempC}°c</span>}
                {step.minutes != null && (
                  <span className="mea-tag cd-silkscreen">{formatStepDuration(step.minutes)}</span>
                )}
                {step.untimed && <span className="mea-tag cd-silkscreen">untimed</span>}
              </p>
            </div>
          </div>
        )),
      },
    ];

    const take = meal.method.batchTakeG;
    if (take) {
      const session = meal.method.batchSource ? prepSessionById(meal.method.batchSource) : undefined;
      const yields = session ? session.yields.filter((y) => y.consumers?.includes(meal.id)) : [];
      out.push({
        id: "batch",
        label: "from sunday's batch",
        items: [
          () => (
            <div className="mea-batch-take">
              <p className="mea-batch-line cd-printed">
                <span className="cd-silkscreen">take</span>
                <span className="cd-value" style={{ "--cd-value-ch": 4 } as React.CSSProperties}>
                  {Math.round(take.total * scale)}
                </span>
                <span className="cd-unit">g</span>
                <span className="mea-batch-split">
                  her {Math.round(take.w * scale)} g · him {Math.round(take.m * scale)} g
                </span>
              </p>
            </div>
          ),
          ...yields.map((y) => () => (
            <div className="mea-batch-yield">
              <span className="mea-batch-component">{y.component.toLowerCase()}</span>
              <span className="mea-batch-qty cd-printed">{y.qty}</span>
            </div>
          )),
        ],
      });
    }
    return out;
  }, [ageFor, meal, rows, scale]);

  return (
    <Enclosure
      variant="hero"
      as="section"
      className="mea-plate"
      aria-label={`the plate for ${COVER_LABEL[cover]}`}
    >
      <header className="mea-plate-head">
        <Escutcheon as="h2">plate</Escutcheon>
        {/* The drum, and its exact figure beside it — the analogue form never
            travels without the number (CORRECTIONARY 5.3). */}
        <span className="mea-plate-weight">
          <Drum value={grams} />
          <span className="cd-unit">g</span>
        </span>
      </header>

      <Register
        groups={groups}
        openId={openId}
        onOpenChange={onOpenChange}
        label="the plate, its method, and its batch draw"
        className="mea-register"
      />
    </Enclosure>
  );
}

/* ========================================================================== */
/* ONE ROW                                                                    */
/* ========================================================================== */

const PlateRowView = memo(function PlateRowView({ row, age }: { row: PlateRow; age: Age }) {
  const glyph = row.freebie ? "·" : STOCK_GLYPH[row.level ?? 0];
  const text = row.freebie ? "pantry staple" : STOCK_TEXT[row.level ?? 0];
  return (
    <div className="mea-row" data-mea-out={!row.freebie && (row.level ?? 0) === 0 ? "true" : undefined}>
      <span className="mea-row-name">{row.name}</span>
      <span className="mea-row-grams cd-value" style={{ "--cd-value-ch": 4 } as React.CSSProperties}>
        {row.grams}
      </span>
      <span className="cd-unit mea-row-unit">g</span>
      {row.hint ? (
        <span className="mea-row-hint">
          {/* The estimate mark: the glyph, a dotted underline, and the words —
              never colour alone, and never a rounded figure passed off as the
              authoritative one, which is the grams column to its left. */}
          <span aria-hidden="true" className="mea-approx">
            ≈
          </span>
          <span className="fd5-visually-hidden"> (estimate) </span>
          {row.hint}
        </span>
      ) : (
        <span className="mea-row-hint" />
      )}
      <span
        className="mea-row-stock"
        data-mea-level={row.freebie ? "pantry" : String(row.level ?? 0)}
        title={row.countedAt ? `counted ${age.label} ago` : "never counted"}
      >
        <span aria-hidden="true" className="mea-row-glyph">
          {glyph}
        </span>
        <span className="mea-row-stock-text cd-silkscreen">{text}</span>
        {/* Honesty: every reading carries its own age. A stock mark with no age
            is a mark pretending the shelf has not changed since it was counted. */}
        {!row.freebie && (
          <span className="mea-row-age cd-silkscreen" data-mea-stale={age.stale ? "true" : "false"}>
            {/* "5h" beside "out of stock" reads as a second quantity; "counted
                5h ago" reads as what it is. A never-counted shelf says so in
                words rather than printing an age it does not have. */}
            {age.ms == null ? "never counted" : `counted ${age.label} ago`}
          </span>
        )}
      </span>
    </div>
  );
});
