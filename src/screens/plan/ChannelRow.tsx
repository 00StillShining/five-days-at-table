/**
 * src/screens/plan/ChannelRow.tsx — the five-case row, and the crown that pages it.
 *
 * ch.17 section 2, measured rather than invented: "The cluster's own five case
 * diameters run 115mm, 100mm, 100mm, 80mm, 80mm; turned into a column split of
 * a shared row, that ratio prints as 24.2% / 21.1% / 21.1% / 16.8% / 16.8%, and
 * every Hero Screen and every Dense Dashboard in this language honors it."
 *
 * Section 1 fixes the arrangement — "one instrument centered, two flanking it,
 * two more outboard, IN THAT ORDER AND NO OTHER" — and section 4 names the
 * hero: "The center instrument alone takes the tier-3 hero treatment." Placing
 * the measured SET by that arrangement gives the row, left to right:
 *
 *     16.8%  ·  21.1%  ·  24.2%  ·  21.1%  ·  16.8%   = 100.0% exactly
 *      fat      prot      KCAL      carb      fibre
 *
 * ---------------------------------------------------------------------------
 * THE 16ms ACK IS STRUCTURAL (CD-BRIEF's measured performance law)
 * ---------------------------------------------------------------------------
 * "A React `dispatch` alone does NOT satisfy the Floor's 16ms acknowledgement,
 * because the reducer runs during the NEXT render." So `report()` is exposed as
 * an imperative handle: the scene applies the frozen reducer to its own model
 * ref inline at the input, then hands the COMMITTED totals straight to this
 * linkage, which retargets five needles and rewrites five printed figures
 * against the DOM in the same task. `dispatch` follows as nothing more than the
 * request to re-render, and React arrives to find the instruments already
 * telling the truth.
 *
 * ---------------------------------------------------------------------------
 * WHAT BREAKS THE ROW, AND WHY THAT IS NOT A DOWNGRADE (CORRECTIONARY 6.5)
 * ---------------------------------------------------------------------------
 * At 1280px the workspace is 1208px wide and the row is real: 203 / 255 / 292 /
 * 255 / 203px of dial. At 390px it would be 53 / 67 / 77 / 67 / 53px, and
 * II.6.11's floor kills every numeral on it. Below 1100px the row therefore
 * re-lays out — rank one full width, the four others in the flank:outboard
 * ratio pair (21.1 : 16.8, normalised 55.7% / 44.3%) — and below 700px it is
 * one column, rank one first. The RATIO is honoured wherever the row exists as
 * a row; where it cannot be a row, a proportion of a row is not a fact.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import type { Band, Macros } from "../../data/types";
import { Escutcheon } from "../../cd/foundry";
import { Crown } from "./Crown";
import { Gauge } from "./Gauge";
import { createNeedleDrive, type NeedleDrive } from "./needle";
import {
  BAND_WORD,
  CHANNELS,
  HERO_INDEX,
  angleOf,
  bandMiss,
  bandState,
  dialScale,
  formatChannel,
  formatSigned,
  markValue,
  type ChannelKey,
  type DialScale,
} from "./model";

export interface LinkageHandle {
  /** A commit landed: retarget every needle and rewrite every figure NOW. */
  report(values: Macros): void;
}

export interface ChannelRowProps {
  values: Macros;
  bands: Record<ChannelKey, Band>;
  markTicks: Record<ChannelKey, number>;
  scopeLabel: string;
  /** The crown's own state, hoisted so it survives navigation (R6). */
  crownPulled: boolean;
  onCrownPulled: (next: boolean) => void;
  focused: number;
  onFocused: (next: number) => void;
  onMarkTicks: (channel: ChannelKey, next: number) => void;
  recommission: { word: string; onCommit: () => void } | null;
  refusal: string | null;
  trophy: boolean;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export const ChannelRow = forwardRef<LinkageHandle, ChannelRowProps>(function ChannelRow(
  {
    values,
    bands,
    markTicks,
    scopeLabel,
    crownPulled,
    onCrownPulled,
    focused,
    onFocused,
    onMarkTicks,
    recommission,
    refusal,
    trophy,
  },
  handleRef
) {
  const needleEls = useRef<(HTMLSpanElement | null)[]>([null, null, null, null, null]);
  const figureEls = useRef<(HTMLSpanElement | null)[]>([null, null, null, null, null]);
  const wordEls = useRef<(HTMLSpanElement | null)[]>([null, null, null, null, null]);
  const missEls = useRef<(HTMLSpanElement | null)[]>([null, null, null, null, null]);
  const drives = useRef<(NeedleDrive | null)[]>([null, null, null, null, null]);

  /* The rank-one dial runs its scale at every second major; the four
     subordinate dials are physically smaller by the case-diameter ratio and
     print every fourth, which is a scale decision a real instrument makes for
     a smaller face — not type shrunk past II.6.11's floor. */
  const scales: DialScale[] = useMemo(
    () => CHANNELS.map((spec, i) => dialScale(bands[spec.key], spec.wink, i === HERO_INDEX ? 2 : 4)),
    [bands]
  );

  /** One writer per needle, created lazily, torn down with the row. */
  const driveFor = useCallback((i: number): NeedleDrive => {
    let drive = drives.current[i];
    if (!drive) {
      drive = createNeedleDrive((deg) => {
        needleEls.current[i]?.style.setProperty("--pln-needle-angle", `${deg.toFixed(2)}deg`);
      });
      drives.current[i] = drive;
    }
    return drive;
  }, []);

  useEffect(() => {
    const list = drives.current;
    return () => {
      for (const d of list) d?.stop();
    };
  }, []);

  /**
   * The one write path. Called from the reconciliation effect below AND from
   * `report()` inside an input's own task; both produce identical output, which
   * is what makes the effect idempotent rather than a second source of truth.
   */
  const paint = useCallback(
    (next: Macros, animate: boolean) => {
      CHANNELS.forEach((spec, i) => {
        const band = bands[spec.key];
        const scale = scales[i];
        const value = next[spec.key];
        driveFor(i).to(angleOf(value, scale), animate);
        const figure = figureEls.current[i];
        if (figure) figure.textContent = formatChannel(value, spec);
        const state = bandState(value, band);
        const word = wordEls.current[i];
        if (word) {
          word.textContent = BAND_WORD[state];
          word.dataset.plnWord = state;
        }
        const miss = missEls.current[i];
        if (miss) {
          const d = bandMiss(value, band);
          miss.textContent = d === 0 ? "on target" : `${formatSigned(d, spec)}${spec.unit}`;
        }
      });
    },
    [bands, driveFor, scales]
  );

  useEffect(() => {
    paint(values, !prefersReducedMotion());
  }, [paint, values]);

  useImperativeHandle(
    handleRef,
    () => ({
      report(next: Macros) {
        paint(next, !prefersReducedMotion());
      },
    }),
    [paint]
  );

  const focusedSpec = CHANNELS[focused] ?? CHANNELS[HERO_INDEX];

  return (
    <section className="pln-row-set" aria-label="the five macro channels, against their bands">
      <div className="pln-row">
        {CHANNELS.map((spec, i) => (
          <Gauge
            key={spec.key}
            spec={spec}
            scale={scales[i]}
            band={bands[spec.key]}
            value={values[spec.key]}
            mark={markValue(bands[spec.key], scales[i], markTicks[spec.key] ?? 0)}
            hero={i === HERO_INDEX}
            focused={i === focused}
            scopeLabel={scopeLabel}
            needleRef={(el) => {
              needleEls.current[i] = el;
            }}
            figureRef={(el) => {
              figureEls.current[i] = el;
            }}
            wordRef={(el) => {
              wordEls.current[i] = el;
            }}
            missRef={(el) => {
              missEls.current[i] = el;
            }}
          />
        ))}
      </div>

      <div className="pln-crown-mount">
        <Escutcheon as="h2" className="pln-crown-title">
          crown
        </Escutcheon>
        <Crown
          pulled={crownPulled}
          onPulled={onCrownPulled}
          index={focused}
          onIndex={onFocused}
          markTicks={markTicks[focusedSpec.key] ?? 0}
          onMarkTicks={(next) => onMarkTicks(focusedSpec.key, next)}
          channelLabel={focusedSpec.label}
          recommission={recommission}
          refusal={refusal}
          trophy={trophy}
        />
      </div>
    </section>
  );
});
