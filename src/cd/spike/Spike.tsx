/**
 * src/cd/spike/Spike.tsx — the STORES accordion group at full material, over
 * the real sixty-five-row register, wired to a bench that can defeat each
 * mitigation one at a time.
 *
 * THE SEMANTIC COMMIT IS SYNCHRONOUS, AND THAT IS THE POINT.
 * II.4.1: "The semantic layer commits in the same frame the command arrives;
 * every animation that follows is a report of a change that has already
 * happened ... Never gate a state mutation on an animation callback." A React
 * `dispatch` does NOT satisfy that on its own: the reducer runs during the next
 * render, so the model is still stale when the handler returns. So the model
 * lives in a ref, the reducer is applied to it INLINE at input, and `setState`
 * is only the request to re-render — the report. The Floor's 16ms is measured
 * against the ref write, which is the moment the truth actually changed.
 *
 * R7 (CD-BRIEF structure rulings): "Long registers use a grouped accordion, one
 * section open at a time, with the hidden remainder printed as a number
 * ('confess the overflow'). Only one group renders at full material at a time."
 * Both halves are here — the accordion, and the printed remainder.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { reducer, defaultState } from "../../state/reducer";
import type { AppState, InventoryLevel } from "../../state/types";
import type { Ingredient } from "../../data/types";
import { useFrameBudget, currentStage, type ShedStage } from "../shed/useFrameBudget";
import { armOnFirstGesture } from "../sound/bus";
import { setVoice } from "../sound/cues";
import {
  GROUP_LABEL,
  GROUP_ORDER,
  LEVEL_ANNOUNCE,
  REGISTER_COUNT,
  REGISTER_FLAT,
  REGISTER_GROUPS,
  countdownFor,
  groupFill,
  latestStocktake,
  seedEntries,
  type LocationGroup,
} from "./model";
import { RegisterRow, rowRenderCount, type MotionMode } from "./RegisterRow";
import { Annunciator, CountPlate, LampScale, ThumbWheel } from "./Instruments";
import {
  ackStats,
  census,
  measureContrast,
  measureTargets,
  recordCommit,
  recordRender,
  renderStats,
  resetAcks,
  resetRender,
  startFrames,
  stopFrames,
} from "./probe";
import { resetLedger, tex, textureLedger } from "./textureProbe";
import "./spike.css";

/** The bench's switches. Every one of them defeats a named mitigation. */
export interface Flags {
  /** M1a — 65 enclosures with their own four-layer stacks. */
  enclosure: boolean;
  /** M1b — a backdrop-filter acrylic lid per row (the expensive half). */
  rowAcrylic: boolean;
  /** M1c — a composited grain layer per row instead of one on the plate. */
  rowGrain: boolean;
  /** M1d — selection as 65 re-rendering rows instead of one travelling strip. */
  perRowArmed: boolean;
  /** M3 — content-visibility: auto on closed groups. */
  contentVisibility: boolean;
  /** M6 — R7 defeated: every group open, all 65 rows at full material. */
  allOpen: boolean;
  /**
   * M7 — the mitigation the brief did not name, and the one that turned out to
   * matter. R7 hides closed groups but React still RENDERS them: a collapsed
   * drawer is `grid-template-rows: 0fr`, not an unmounted subtree, so one level
   * change reconciles all sixty-five rows even though only nineteen are visible.
   * With this on, a closed group renders no plate at all.
   */
  unmountClosed: boolean;
  /** M4 — how the pointer sweep is driven. */
  mode: MotionMode;
}

const DEFAULT_FLAGS: Flags = {
  enclosure: false,
  rowAcrylic: false,
  rowGrain: false,
  perRowArmed: false,
  contentVisibility: true,
  allOpen: false,
  unmountClosed: false,
  mode: "css",
};

/** Day-granularity countdowns must not ride a per-second tick. */
const COARSE_CLOCK_MS = 60_000;

interface ArmedState {
  id: string;
  index: number;
  group: LocationGroup;
}

export function Spike() {
  // ---- the model: a ref for truth, state for the report --------------------
  const modelRef = useRef<AppState>(defaultState);
  const [model, setModel] = useState<AppState>(defaultState);
  const [flags, setFlags] = useState<Flags>(DEFAULT_FLAGS);
  const [open, setOpen] = useState<LocationGroup>("fridge");
  const [armed, setArmed] = useState<ArmedState | null>(null);
  const [activity, setActivity] = useState(0);
  const [announce, setAnnounce] = useState("tap a row to address it");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [stage, setStage] = useState<ShedStage>(0);
  const stageLogRef = useRef<{ stage: ShedStage; at: number }[]>([]);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const commitAtRef = useRef(0);

  // Semantic commit -> React has finished mutating the DOM. useLayoutEffect
  // runs synchronously after the mutation phase and before paint, so this is
  // exactly the reconcile + DOM cost the register imposes per level change.
  useLayoutEffect(() => {
    if (commitAtRef.current === 0) return;
    recordRender(performance.now() - commitAtRef.current);
    commitAtRef.current = 0;
  });

  // II.4.12's ladder, mounted once. Nothing re-renders on a stage change by
  // design; the setState here is instrumentation for the bench readout only.
  useFrameBudget({
    onStage: (s) => {
      stageLogRef.current.push({ stage: s, at: +performance.now().toFixed(1) });
      setStage(s);
    },
  });

  useEffect(() => {
    setVoice("clear-lid");
    // II.5: total silence until the user's first real gesture.
    return armOnFirstGesture();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), COARSE_CLOCK_MS);
    return () => window.clearInterval(id);
  }, []);

  // Seed the register with a real stocktake through the REAL reducer — real
  // actions, real timestamps, one genuinely expired row and one genuinely
  // expiring one, and ~9 rows left uncounted so the empty state renders too.
  useEffect(() => {
    const seeded = reducer(defaultState, { type: "inventory/setMany", entries: seedEntries(new Date()) });
    modelRef.current = seeded;
    setModel(seeded);
  }, []);

  // ---- the two input paths -------------------------------------------------

  const commitLevel = useCallback((id: string, level: InventoryLevel, eventTs: number) => {
    // 1 · SEMANTIC COMMIT — synchronous, this frame, before any render work.
    modelRef.current = reducer(modelRef.current, { type: "inventory/set", ingId: id, level });
    recordCommit("level", eventTs);
    commitAtRef.current = performance.now();
    // 2 · MECHANICAL/SENSORY REPORT — scheduled, and allowed to take its time.
    setModel(modelRef.current);
    setActivity((n) => n + 1);
    const ing = REGISTER_FLAT.find((i) => i.id === id);
    if (ing) setAnnounce(`${ing.name.short}: ${LEVEL_ANNOUNCE[level]}`);
  }, []);

  const handleArm = useCallback((id: string, index: number, eventTs: number) => {
    recordCommit("arm", eventTs);
    setArmed((prev) => (prev?.id === id ? prev : { id, index, group: groupOfIndexId(id) }));
  }, []);

  const handleWheelSet = useCallback(
    (level: InventoryLevel, eventTs: number, advance: boolean) => {
      if (!armed) return;
      commitLevel(armed.id, level, eventTs);
      if (!advance) return;
      // PLAN's own auto-advance: an absolute detent pick moves to the next row.
      const idx = REGISTER_FLAT.findIndex((i) => i.id === armed.id);
      const next = REGISTER_FLAT[idx + 1];
      if (next && groupOfIndexId(next.id) === armed.group) {
        const el = rowRefs.current.get(next.id);
        el?.focus();
      }
    },
    [armed, commitLevel]
  );

  const registerEl = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  // ---- derived readings, all real ------------------------------------------

  const counts = useMemo(() => {
    let expired = 0;
    let expiring = 0;
    let frozen = 0;
    const at = new Date(nowMs);
    for (const ing of REGISTER_FLAT) {
      const s = countdownFor(ing, model.inventory[ing.id], at).status;
      if (s === "expired") expired++;
      else if (s === "expiring") expiring++;
      else if (s === "frozen") frozen++;
    }
    return { expired, expiring, frozen };
  }, [model.inventory, nowMs]);

  const hiddenCount = flags.allOpen ? 0 : REGISTER_COUNT - REGISTER_GROUPS[open].length;

  const armedLevel: InventoryLevel | null = armed ? ((model.inventory[armed.id]?.level ?? 0) as InventoryLevel) : null;
  const armedName = armed ? (REGISTER_FLAT.find((i) => i.id === armed.id)?.name.short ?? null) : null;

  // ---- the bench API, driven from the trace harness ------------------------
  useEffect(() => {
    const api = {
      flags: () => flags,
      setFlag: (k: keyof Flags, v: boolean | MotionMode) => setFlags((f) => ({ ...f, [k]: v }) as Flags),
      setFlags: (patch: Partial<Flags>) => setFlags((f) => ({ ...f, ...patch })),
      openGroup: (g: LocationGroup) => setOpen(g),
      startFrames,
      stopFrames,
      ackStats,
      resetAcks,
      renderStats,
      resetRender,
      rowRenders: () => rowRenderCount.n,
      resetRowRenders: () => {
        rowRenderCount.n = 0;
      },
      census: () => census(),
      textureLedger,
      resetLedger,
      measureContrast,
      measureTargets,
      shedStage: () => currentStage(),
      shedLog: () => stageLogRef.current.slice(),
      rowCount: () => rowRefs.current.size,
      registerCount: REGISTER_COUNT,
      /** Drive a stocktake without a pointer: N absolute detent picks. */
      stocktake: (n: number) => {
        const rows = REGISTER_GROUPS[open];
        for (let i = 0; i < n; i++) {
          const ing = rows[i % rows.length]!;
          const lvl = ((i * 3 + 1) % 5) as InventoryLevel;
          commitLevel(ing.id, lvl, performance.now());
        }
      },
      /**
       * MITIGATION 2, measured directly. CLEAR LID's materials are almost all
       * gradient-expressible, so the register itself needs exactly ONE canvas
       * tile (the wheel's knurl). This probe prices the mistake anyway: `n`
       * requests on one key versus `n` requests on `n` keys.
       */
      textureBench: (n: number) => {
        const dpr = window.devicePixelRatio || 1;
        resetLedger();
        const t0 = performance.now();
        for (let i = 0; i < n; i++) tex({ pattern: "radial-brushed", scale: 40, dpr });
        const shared = performance.now() - t0;
        const sharedLedger = textureLedger();
        resetLedger();
        const t1 = performance.now();
        for (let i = 0; i < n; i++) tex({ pattern: "radial-brushed", scale: 40 + i, dpr });
        const perRow = performance.now() - t1;
        const perRowLedger = textureLedger();
        return {
          n,
          sharedMs: +shared.toFixed(2),
          sharedLedger,
          perRowMs: +perRow.toFixed(2),
          perRowLedger,
        };
      },
      armRow: (i: number) => {
        const ing = REGISTER_GROUPS[open][i % REGISTER_GROUPS[open].length]!;
        rowRefs.current.get(ing.id)?.focus();
      },
    };
    (window as unknown as Record<string, unknown>).__spike = api;
  }, [flags, open, commitLevel]);

  return (
    // A landmark, not a div: Lighthouse's landmark-one-main fired on the first
    // build, and a register is the page's main content by any reading.
    <main
      className="spk"
      data-cd-language="clear-lid"
      data-enclosure={flags.enclosure ? "on" : "off"}
      data-rowacrylic={flags.rowAcrylic ? "on" : "off"}
      data-rowgrain={flags.rowGrain ? "on" : "off"}
      data-perrowarmed={flags.perRowArmed ? "on" : "off"}
      data-cv={flags.contentVisibility ? "on" : "off"}
      data-allopen={flags.allOpen ? "on" : "off"}
    >
      <Bench flags={flags} setFlags={setFlags} stage={stage} hidden={hiddenCount} />

      <div className="spk-masthead">
        <Annunciator expired={counts.expired} expiring={counts.expiring} frozen={counts.frozen} />
        <CountPlate
          counted={Object.keys(model.inventory).length}
          total={REGISTER_COUNT}
          lastStocktake={latestStocktake(REGISTER_FLAT, model.inventory)}
        />
      </div>

      <div className="spk-bay">
        <div className="spk-rail" aria-hidden="true" />
        <div>
          {GROUP_ORDER.map((group) => {
            const rows = REGISTER_GROUPS[group];
            const isOpen = flags.allOpen || group === open;
            const fill = groupFill(rows, model.inventory);
            return (
              <section className="spk-group" key={group} data-open={isOpen}>
                <h2 style={{ margin: 0 }}>
                  <button
                    type="button"
                    className="spk-lid cd-focusable"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(group)}
                  >
                    <span className="spk-lid__label">{GROUP_LABEL[group]}</span>
                    <LampScale
                      fraction={fill.fraction}
                      counted={fill.counted}
                      stocked={fill.stocked}
                      total={rows.length}
                      activity={activity}
                      widthPx={LAMP_SCALE_PX}
                    />
                    <span className="spk-lid__count">
                      {rows.length} rows · {fill.counted} counted
                    </span>
                  </button>
                </h2>
                {/* The drawer stays in the DOM and collapses on grid-template-rows
                    (II.4.9's own reveal recipe), so `content-visibility: auto` has
                    something to skip. `inert` keeps a clipped row out of the tab
                    order — a focusable control the hand cannot see is a Floor
                    failure, not a perf trade. */}
                <div className="spk-drawer" inert={!isOpen}>
                  {isOpen || !flags.unmountClosed ? (
                    <Plate
                      rows={rows}
                      model={model}
                      nowMs={nowMs}
                      mode={flags.mode}
                      perRowArmed={flags.perRowArmed}
                      armed={armed}
                      onArm={handleArm}
                      onAdjust={commitLevel}
                      registerEl={registerEl}
                    />
                  ) : (
                    <div />
                  )}
                </div>
                <div className="spk-lidplate" aria-hidden="true" />
              </section>
            );
          })}
        </div>
      </div>

      <div className="spk-footer">
        <ThumbWheel armedName={armedName} level={armedLevel} onSet={handleWheelSet} announce={announce} />
        {/* R7's second half: "confess the overflow" — the hidden remainder is
            printed as a number, not silently dropped. */}
        <div className="spk-countplate">
          <span className="spk-countplate__value">{hiddenCount}</span>
          <span className="spk-countplate__age">rows under closed lids</span>
        </div>
      </div>
    </main>
  );
}

/** 7.5rem of scale at the 16px root the tokens assume. Asserted at runtime by
 *  the plate's own measurement below, which overrides it if the root differs. */
const SCALE_PX_NOMINAL = 120;
const LIFE_PX_NOMINAL = 72;
const LAMP_SCALE_PX = 128;

function groupOfIndexId(id: string): LocationGroup {
  for (const g of GROUP_ORDER) if (REGISTER_GROUPS[g].some((i) => i.id === id)) return g;
  return "cupboard";
}

interface PlateProps {
  rows: Ingredient[];
  model: AppState;
  nowMs: number;
  mode: MotionMode;
  perRowArmed: boolean;
  armed: ArmedState | null;
  onArm: (id: string, index: number, eventTs: number) => void;
  onAdjust: (id: string, level: InventoryLevel, eventTs: number) => void;
  registerEl: (id: string, el: HTMLButtonElement | null) => void;
}

function Plate({ rows, model, nowMs, mode, perRowArmed, armed, onArm, onAdjust, registerEl }: PlateProps) {
  const levelChannelRef = useRef<HTMLSpanElement | null>(null);
  const lifeChannelRef = useRef<HTMLSpanElement | null>(null);
  const [scalePx, setScalePx] = useState(SCALE_PX_NOMINAL);
  const [lifePx, setLifePx] = useState(LIFE_PX_NOMINAL);

  // The channels are the only things measured, once, and again only on resize —
  // never per row and never per frame (II.2.22's own budget discipline).
  useEffect(() => {
    const l = levelChannelRef.current;
    const f = lifeChannelRef.current;
    if (!l || !f) return;
    const ro = new ResizeObserver(() => {
      setScalePx(l.getBoundingClientRect().width || SCALE_PX_NOMINAL);
      setLifePx(f.getBoundingClientRect().width || LIFE_PX_NOMINAL);
    });
    ro.observe(l);
    ro.observe(f);
    return () => ro.disconnect();
  }, []);

  const armedIndexHere = armed ? rows.findIndex((r) => r.id === armed.id) : -1;

  const cut = {
    ["--spk-strip-i" as string]: String(Math.max(0, armedIndexHere)),
    ["--spk-strip-on" as string]: armedIndexHere >= 0 ? "1" : "0",
  };

  return (
    <div className="spk-plate" data-armed={armedIndexHere >= 0 && !perRowArmed} style={cut}>
      {/* two milled channels — two wells, sixty-five rows of printed scale */}
      <span className="spk-channel spk-channel--level" ref={levelChannelRef} aria-hidden="true" />
      <span className="spk-channel spk-channel--life" ref={lifeChannelRef} aria-hidden="true" />

      {/* the lid, cut open at the addressed row: TWO panes, never sixty-five */}
      {!perRowArmed && (
        <>
          <span className="spk-pane spk-pane--above" aria-hidden="true" />
          <span className="spk-pane spk-pane--below" aria-hidden="true" />
          <span className="spk-strip" aria-hidden="true" />
        </>
      )}

      <ul className="spk-rows">
        {rows.map((ing, i) => (
          <RegisterRow
            key={ing.id}
            ing={ing}
            entry={model.inventory[ing.id]}
            index={i}
            nowMs={nowMs}
            scalePx={scalePx}
            lifePx={lifePx}
            mode={mode}
            armed={perRowArmed ? armed?.id === ing.id : undefined}
            onArm={onArm}
            onAdjust={onAdjust}
            registerEl={registerEl}
          />
        ))}
      </ul>
    </div>
  );
}

/* ===========================================================================
   the bench — scaffolding, deliberately undressed
   =========================================================================== */

function Bench({
  flags,
  setFlags,
  stage,
  hidden,
}: {
  flags: Flags;
  setFlags: (f: (prev: Flags) => Flags) => void;
  stage: ShedStage;
  hidden: number;
}) {
  const toggles: { key: keyof Flags; label: string }[] = [
    { key: "enclosure", label: "M1a 65 enclosures" },
    { key: "rowAcrylic", label: "M1b per-row acrylic" },
    { key: "rowGrain", label: "M1c per-row grain" },
    { key: "perRowArmed", label: "M1d per-row armed" },
    { key: "contentVisibility", label: "M3 content-visibility" },
    { key: "allOpen", label: "M6 all groups open" },
    { key: "unmountClosed", label: "M7 unmount closed" },
  ];
  return (
    <div className="spk-bench">
      <strong>SPIKE</strong>
      {toggles.map((t) => (
        <button
          key={t.key}
          type="button"
          data-on={Boolean(flags[t.key])}
          onClick={() => setFlags((f) => ({ ...f, [t.key]: !f[t.key] }) as Flags)}
        >
          {t.label}
        </button>
      ))}
      <label>
        M4 motion{" "}
        <select value={flags.mode} onChange={(e) => setFlags((f) => ({ ...f, mode: e.target.value as MotionMode }))}>
          <option value="css">css sweep</option>
          <option value="integrator">one integrator</option>
          <option value="raf">one rAF per row</option>
        </select>
      </label>
      <span>
        shed stage {stage} · {hidden} rows hidden
      </span>
    </div>
  );
}
