/**
 * src/screens/cook — 02 REEL LOGIC.
 *
 * COOK answers: what am I doing right now, and when does it need me?
 *
 * REEL LOGIC owns this screen because THE TIMER IS THE ONE GENUINELY LIVE
 * PROCESS IN THE ENTIRE PRODUCT. Everywhere else FD-5's data is slow and
 * changes once a day, and CD-BRIEF ruling 6 is blunt about what that means:
 * "Portholes, rocker arms and spinning elements attach only to values whose
 * change is user-caused or clock-continuous." A spinning disc would be ornament
 * on any other screen in this product. Here it is the honest instrument, and it
 * is the reason this language was assigned to this room rather than to another.
 *
 * ===========================================================================
 * R5 — THE LID IS GONE
 * ===========================================================================
 * COOK's lid-closed mode is dropped. The rail is present, the operator may
 * leave from anywhere at any time, and there is no guarding of any kind on this
 * screen: no confirm-before-leaving, no hold-to-pause, no "are you sure". The
 * wet-hands mis-tap risk that mode protected against is accepted by owner
 * ruling. The shipped build's 600ms hold-to-pause went with it — a hold IS
 * guarding, and re-introducing it under another name would be the same cage
 * with a smaller door.
 *
 * ===========================================================================
 * THE SANCTIONED EXCEPTION
 * ===========================================================================
 * COOK never renders the shared ArbiterSlot; engine/arbiter.ts's
 * primaryActionFor("cook", ...) returns null and arbiter.test.ts pins it. The
 * stopped reel and its alarm ARE this screen's act-now slot. Two behaviours
 * from the shipped build are preserved exactly: timers are reload-safe
 * (epoch-based, in the frozen engine), and the primary key targets the alarm's
 * EARLIEST-DEADLINE overdue step rather than whatever `stepNow` happens to be
 * pointing at — "done" must clear what the alarm shouts about.
 *
 * ===========================================================================
 * COMMIT SYNCHRONOUSLY AT INPUT (CD-BRIEF measured performance law, rule 1)
 * ===========================================================================
 * "A `dispatch` alone does NOT satisfy the Floor's 16ms acknowledgement,
 * because the reducer runs during the NEXT render — the model is still stale
 * when your handler returns. Keep the model in a ref, apply the frozen reducer
 * to it INLINE at the input event, and let setState be only the request to
 * re-render."
 *
 * `commit()` below is that, and on this screen it is not a formality: pressing
 * HOLD must stop the disc in the frame the finger lands, not on the next React
 * render. So the frozen reducer runs against a ref, the frozen
 * `deriveProgramState` runs against the result, and the disc's own
 * `data-ck-spin` is written straight to the DOM — all before the handler
 * returns. The dispatch that follows is only the request to repaint everything
 * else, and it writes the identical attribute again, idempotently.
 *
 * ===========================================================================
 * CLOCKS
 * ===========================================================================
 * Rule 4: "Isolate clocks." This screen has exactly two, and they can never
 * both be running:
 *   - `useProgram()`'s 1Hz tick, which only exists while a program is actually
 *     running. The forty-meal picker only renders while none is.
 *   - the countdown's own age clock, mounted INSIDE the one component that
 *     reads it (src/cd/freshness/useAge.ts, dropped while the tab is hidden).
 * The lanes are a memo boundary, so a transport press, a preview step or a
 * trophy transition reconciles none of them.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SceneProps } from "../../app/router";
import { useStore } from "../../state/store";
import type { Action } from "../../state/types";
import { reducer } from "../../state/reducer";
import { deriveProgramState, useProgram } from "../../engine/timers";
import { mealMacros } from "../../state/selectors";
import { getMeal, prepSessionForWeek } from "../../data";
import { TESTER_PROGRAM_SUFFIX } from "../../engine/programs";
import type { ProgramStep } from "../../engine/programs";
import { useNow } from "../../state/useNow";
import { Enclosure, Escutcheon, Plate, PressKey } from "../../cd/foundry";
import { ensureBus } from "../../cd/sound/bus";
import { cue, setVoice, warnUntil } from "../../cd/sound/cues";
import { ProgramPicker } from "./ProgramPicker";
import { Reel } from "./Reel";
import { TrackLanes } from "./TrackLanes";
import { Annunciator, Countdown, NowPlate, ScrubRocker } from "./Instruments";
import { CompletionTally } from "./CompletionTally";
import { Trophy, type TrophySurvivor } from "./Trophy";
import { useTrophy } from "./useTrophy";
import { formatMinutesAsClock } from "./format";
import { lampBreathes, lampLit, reelSpins, transportWord } from "./reelState";
import { prepProgramDisplayName, prepWeekForProgramId } from "./programGroups";
import "./cook.css";

/** The preview stepper's own bound, unchanged from the shipped build. */
const SCRUB_BOUND_MIN = 20;

export default function CookScene(_props: SceneProps) {
  const { state, dispatch } = useStore();
  const now = useNow();
  const prog = useProgram();
  const rootRef = useRef<HTMLDivElement>(null);

  const [scrubOffset, setScrubOffset] = useState(0);
  const [leftoverBaseline, setLeftoverBaseline] = useState<Set<string> | null>(null);

  /*
    The shadow model. Mirrors the store synchronously so a handler firing
    several times inside one tick (a held rocker end at 12 events/second, or a
    real keyboard's own repeat) accumulates instead of overwriting: reading the
    `state` closure in that window sees the same stale value on every call.
  */
  const stateRef = useRef(state);
  stateRef.current = state;
  const scrubRef = useRef(0);

  const program = prog.program;
  const derived = prog.state;

  /*
    THE SYNCHRONOUS COMMIT. Semantic truth first, in this frame, against the
    frozen reducer; then the one visible consequence that cannot wait for a
    render; then the request to repaint.
  */
  const commit = useCallback(
    (action: Action) => {
      const next = reducer(stateRef.current, action);
      stateRef.current = next;
      if (program) {
        const d = deriveProgramState(program, next.timers, Date.now());
        const disc = rootRef.current?.querySelector<HTMLElement>(".ck-reel");
        if (disc) disc.dataset.ckSpin = String(reelSpins(d.status, d.dueNow));
      }
      dispatch(action);
    },
    [dispatch, program]
  );

  /*
    II.5.9 — one voice per world. Another room may have pointed the cue engine
    at its own chapter; COOK claims it back on arrival.

    II.5.14's gesture-unlock, lifted verbatim from the useChime this replaces:
    the AudioContext is created inside a real gesture's handler, never at load,
    never behind a resume() plea. The chassis arms the bus globally on the first
    pointerdown/keydown, and every transport press below calls ensureBus() again
    — idempotent, and the reason the alarm has air when `dueNow` flips
    asynchronously minutes later.
  */
  useEffect(() => {
    setVoice("reel-logic");
  }, []);

  const dueNow = derived?.dueNow ?? false;
  const dueRef = useRef(false);
  dueRef.current = dueNow;

  /*
    II.5.8 — the warning. ONE GLOBAL CUE, byte-identical across chapters: 620Hz
    and 877Hz phase-locked to a 2Hz flash, never ducked, never panned, and the
    one cue that survives Trophy Mode. `warnUntil` reads `stillFiring` fresh on
    every burst, so pressing the primary key silences it in the same beat the
    condition clears — the annunciator goes dark and the sound stops with it.
  */
  useEffect(() => {
    if (!dueNow) return;
    // The pair below is the permissive one on purpose: the warning is the ONE
    // cue that survives Trophy Mode, so it is admitted in both modes rather
    // than switched between them.
    const opts = { mode: "trophy", trophyAudio: "warnings" } as const;
    let cancel = warnUntil(() => dueRef.current, opts);
    // II.5.14 — if no gesture has armed the bus yet, the alarm is silent and
    // the product is still whole. The instant a hand does arrive it gets its
    // air, rather than staying mute for the rest of the condition.
    const onGesture = (): void => {
      ensureBus();
      cancel();
      cancel = warnUntil(() => dueRef.current, opts);
    };
    window.addEventListener("pointerdown", onGesture, { once: true, capture: true });
    window.addEventListener("keydown", onGesture, { once: true, capture: true });
    return () => {
      cancel();
      window.removeEventListener("pointerdown", onGesture, { capture: true });
      window.removeEventListener("keydown", onGesture, { capture: true });
    };
  }, [dueNow]);

  const stepScrub = useCallback(
    (delta: number) => {
      const next = Math.max(-SCRUB_BOUND_MIN, Math.min(SCRUB_BOUND_MIN, scrubRef.current + delta));
      if (next === scrubRef.current) return;
      scrubRef.current = next;
      setScrubOffset(next);
      prog.scrubPreview(next);
    },
    [prog]
  );

  const resetScrub = useCallback(() => {
    scrubRef.current = 0;
    setScrubOffset(0);
    prog.clearScrubPreview();
  }, [prog]);

  const backToPicker = useCallback(() => {
    commit({ type: "timers/reset" });
    resetScrub();
    setLeftoverBaseline(null);
  }, [commit, resetScrub]);

  /* The reading's own age: the wall-clock instant the elapsed figure last moved. */
  const lastTickRef = useRef<number | null>(null);
  const elapsedMin = derived?.elapsedMin ?? 0;
  useEffect(() => {
    lastTickRef.current = Date.now();
  }, [elapsedMin]);

  const trophy = useTrophy(Boolean(program));

  /* ------------------------------------------------------------------ */
  /* standby — no program loaded                                         */
  /* ------------------------------------------------------------------ */
  if (!program || !derived) {
    return (
      <div className="ck" data-cd-language="reel-logic" ref={rootRef}>
        <ProgramPicker state={state} now={now} onLoad={(id) => commit({ type: "timers/load", programId: id })} />
      </div>
    );
  }

  const lastStepN = program.steps.length ? Math.max(...program.steps.map((s) => s.n)) : null;
  const prepWeek = program.kind === "prep" ? prepWeekForProgramId(program.id) : null;
  const prepSession = prepWeek ? prepSessionForWeek(prepWeek) : null;
  const isReducedPrep = program.kind === "prep" && program.id.endsWith(TESTER_PROGRAM_SUFFIX);
  const heroTitle = prepWeek
    ? isReducedPrep
      ? "starter sunday session"
      : prepProgramDisplayName(prepWeek)
    : program.title;
  const heroSubtitle = prepWeek ? (isReducedPrep ? program.title : prepSession?.sessionName) : undefined;

  function handleDoneStep(stepN: number) {
    const isFinal = stepN === lastStepN;
    if (isFinal && program!.kind === "prep") {
      setLeftoverBaseline(new Set(stateRef.current.leftovers.map((l) => l.id)));
    }
    commit({ type: "timers/doneStep", step: stepN });
    if (isFinal) {
      if (program!.kind === "meal") prog.completeMeal();
      else prog.completePrepSession();
    }
    // II.5.7 — confirm fires only AFTER the consequence is real. It is: the
    // frozen reducer already ran against the shadow model above.
    cue("confirm");
  }

  /* ------------------------------------------------------------------ */
  /* complete — the tally                                                */
  /* ------------------------------------------------------------------ */
  if (derived.status === "complete") {
    const skippedCount = program.steps.length - derived.doneSteps.length;
    if (program.kind === "meal") {
      const meal = getMeal(program.id);
      if (!meal) return null;
      const macros = mealMacros(meal.id, state.prefs.cover, state.prefs.scale);
      return (
        <div className="ck" data-cd-language="reel-logic" ref={rootRef}>
          <CompletionTally
            kind="meal"
            meal={meal}
            cover={state.prefs.cover}
            macros={macros}
            skippedCount={skippedCount}
            onDone={backToPicker}
          />
        </div>
      );
    }
    if (!prepWeek || !prepSession) return null;
    const newLeftovers = leftoverBaseline
      ? state.leftovers.filter((l) => !leftoverBaseline.has(l.id))
      : [];
    return (
      <div className="ck" data-cd-language="reel-logic" ref={rootRef}>
        <CompletionTally
          kind="prep"
          week={prepWeek}
          session={prepSession}
          newLeftovers={newLeftovers}
          skippedCount={skippedCount}
          onDone={backToPicker}
        />
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* standby / running / paused                                          */
  /* ------------------------------------------------------------------ */
  const status = derived.status; // "idle" | "running" | "paused"
  const { stepNow, stepNext } = derived;
  const previewing = scrubOffset !== 0;

  /*
    `stepNow` is "the active step with the latest clockStart" — a what-to-focus-
    on pointer, NOT necessarily the step that is actually overdue: a long rice
    track can still be stepNow while a shorter glaze track started at the same
    time is the one whose clock hit zero. The alarm makes a factual claim, so it
    names whichever active step is genuinely overdue, earliest deadline first.
  */
  const dueStep: ProgramStep | undefined = dueNow
    ? derived.activeSteps
        .filter((s) => !s.untimed && s.minutes != null && s.clockStart! + s.minutes <= derived.elapsedMin)
        .sort((a, b) => a.clockStart! + a.minutes! - (b.clockStart! + b.minutes!))[0]
    : undefined;

  const doneTarget = dueStep ?? stepNow;
  /*
    THE HONESTY RULE, and it lives in reelState.ts rather than here so it can be
    pinned by a test instead of asserted by a comment. index.tsx holds no second
    copy of it, and neither does the synchronous commit above — that one reads
    the frozen `deriveProgramState` and applies the same predicate inline.
  */
  const spinning = reelSpins(status, dueNow);
  const overrun = derived.elapsedMin > derived.totalMin;

  /* ---- the countdown's own reading -------------------------------- */
  let caption = "standby";
  let value = "--:--";
  let remainingFraction: number | null = null;
  if (dueStep && dueStep.minutes != null) {
    caption = "overdue by";
    value = formatMinutesAsClock(derived.elapsedMin - (dueStep.clockStart! + dueStep.minutes));
    remainingFraction = 0;
  } else if (stepNow && !stepNow.untimed && stepNow.minutes != null && stepNow.clockStart != null) {
    const remaining = stepNow.clockStart + stepNow.minutes - derived.elapsedMin;
    caption = "step remaining";
    value = formatMinutesAsClock(remaining);
    remainingFraction = stepNow.minutes > 0 ? remaining / stepNow.minutes : 0;
  } else if (stepNext && stepNext.clockStart != null && status !== "idle") {
    const activeEnd = derived.activeSteps.reduce(
      (max, s) => Math.max(max, (s.clockStart ?? 0) + (s.minutes ?? 0)),
      0
    );
    const gap = Math.max(0, stepNext.clockStart - activeEnd);
    const wait = Math.max(0, stepNext.clockStart - derived.elapsedMin);
    caption = "next step in";
    value = formatMinutesAsClock(wait);
    remainingFraction = gap > 0 ? wait / gap : null;
  } else if (status === "idle") {
    caption = "ready to start";
  }

  /*
    ONE INSTRUMENT, ONE FACT. Measured on the running deck: with the program
    PAUSED and a step also overdue, the dot-matrix strip printed DUE and the
    lamp printed "due" — so nothing on the screen said the operator had held it,
    and two instruments reported one condition while another went unreported.

    The precedence is now the operator's, not the condition's. PAUSE is a
    command the operator gave and it outranks a condition the clock produced:

      strip + lamp   the TRANSPORT truth — READY / RUN / WAIT / HOLD, which is
                     exactly what the disc beside them is doing and why
      annunciator    the DUE condition, latching and flashing at its own 2Hz
      countdown      the READING's own state — OVERDUE / HELD / NO SIGNAL / RUN
      now plate      the step the alarm is about, wearing the danger keyline

    WAIT is the word for a stopped disc with a live clock: the program is not
    making forward progress because it is waiting for a hand, which is a real
    difference from HOLD and is why it gets its own word rather than borrowing
    one. "A reel that stops without cause is a lie" — the cause is printed.

    The lamp follows the chassis rec-dot exactly (lit only while genuinely
    running), because CD-BRIEF ruling 3 makes "a cook program is running" ONE
    claim made once, in one hex, in two places.
  */
  const stateWord = transportWord(status, dueNow);
  const glyph =
    status === "idle" ? "stop" : status === "paused" ? "pause" : dueNow ? "alert" : "play";
  const lampWord = stateWord.toLowerCase();
  const countWord = dueNow ? "OVERDUE" : status === "paused" ? "HELD" : status === "idle" ? "READY" : "RUN";

  /* ---- the transport, folded into the reel's own collar ------------ */
  const primaryLabel =
    status === "idle" ? "start" : status === "paused" ? "resume" : dueNow ? "done · clear the alarm" : "done";
  const primaryCap = status === "idle" ? "start" : status === "paused" ? "resume" : "done";

  const primary = {
    cap: primaryCap,
    label: primaryLabel,
    disabled: previewing || (status === "running" && !doneTarget),
    onPress: () => {
      ensureBus();
      if (status === "idle") commit({ type: "timers/start" });
      else if (status === "paused") {
        commit({ type: "timers/resume" });
        cue("latch", { release: true });
      } else if (doneTarget) handleDoneStep(doneTarget.n);
    },
  };

  const pauseActive = status === "running";
  const pause = {
    cap: pauseActive ? "hold" : "run",
    label: pauseActive ? "hold the program" : "release the hold",
    disabled: status === "idle",
    onPress: () => {
      ensureBus();
      if (pauseActive) {
        commit({ type: "timers/pause" });
        cue("latch");
      } else {
        commit({ type: "timers/resume" });
        cue("latch", { release: true });
      }
    },
  };

  const extend = {
    cap: "+1 min",
    label: "extend the running timer by one minute",
    disabled: status !== "running" || previewing,
    onPress: () => {
      ensureBus();
      commit({ type: "timers/plusOneMinute" });
    },
  };

  const nowText =
    status === "idle"
      ? "ready to start — press START on the reel's collar."
      : stepNow
        ? stepNow.text
        : status === "running"
          ? "waiting for the next step to come round."
          : "held.";

  const survivors: TrophySurvivor[] = [
    {
      label: "elapsed",
      figure: formatMinutesAsClock(derived.elapsedMin),
      age: `of ${formatMinutesAsClock(derived.totalMin)}`,
      held: status === "paused",
      word: status === "paused" ? "HELD" : undefined,
    },
    { label: caption, figure: value, age: countWord, held: status === "paused" },
    {
      label: "step",
      figure: `${derived.doneSteps.length}-${program.steps.length}`,
      age: `${program.steps.length - derived.doneSteps.length} left`,
    },
    {
      label: "next in",
      figure:
        stepNext && stepNext.clockStart != null
          ? formatMinutesAsClock(Math.max(0, stepNext.clockStart - derived.elapsedMin))
          : "--:--",
      age: stepNext ? "scheduled" : "last step",
    },
  ];

  return (
    <div
      className="ck"
      data-cd-language="reel-logic"
      data-ck-trophy={trophy.trophy ? "true" : "false"}
      ref={rootRef}
    >
      <div className="ck-face">
        <div className="ck-stage">
          <Enclosure variant="pod" className="ck-ident">
            <Escutcheon>{program.kind === "prep" ? "session" : "meal"}</Escutcheon>
            <Plate className="ck-ident-plate">
              <p className="ck-ident-title">{heroTitle}</p>
              {heroSubtitle && <p className="ck-ident-sub">{heroSubtitle}</p>}
            </Plate>
            <PressKey
              className="ck-ident-eject"
              onPress={backToPicker}
              cap="eject"
              aria-label="eject this program and return to standby"
            />
          </Enclosure>

          <Reel
            elapsedMin={derived.elapsedMin}
            totalMin={derived.totalMin}
            spinning={spinning}
            lampLit={lampLit(status)}
            lampBreathing={lampBreathes(status, dueNow)}
            lampWord={lampWord}
            overrun={overrun}
            primary={primary}
            pause={pause}
            extend={extend}
            seedSeconds={derived.elapsedMin * 60}
          />

          <ScrubRocker
            offsetMinutes={scrubOffset}
            boundMinutes={SCRUB_BOUND_MIN}
            onStep={stepScrub}
            onReset={resetScrub}
          />
        </div>

        <div className="ck-evidence">
          {previewing && (
            <Plate className="ck-preview" aria-live="polite">
              previewing {scrubOffset > 0 ? "+" : ""}
              {scrubOffset} min — done and +1 min are off until you return to now
            </Plate>
          )}

          <Countdown
            caption={caption}
            value={value}
            remainingFraction={remainingFraction}
            paused={status === "paused"}
            stateWord={countWord}
            overdue={dueNow}
            lastTickAt={lastTickRef.current}
            timers={state.timers}
          />

          <Annunciator word={stateWord} glyph={glyph} firing={dueNow} legend="step due" />

          {/*
            THE ALARM IS THE NOW PLATE. The `key` flips with the condition so
            React remounts the element and role="alert" announces exactly once
            per firing rather than never (a role added to a live element is not
            an announcement).
          */}
          <NowPlate
            key={dueNow ? "due" : "run"}
            due={dueNow}
            track={(dueStep ?? stepNow)?.station ?? (dueStep ?? stepNow)?.track ?? null}
            text={dueNow ? ((dueStep ?? stepNow)?.text ?? nowText) : nowText}
            note={stepNow?.testerNote}
            next={
              stepNext && stepNext.clockStart != null
                ? {
                    text: stepNext.text,
                    startsIn: formatMinutesAsClock(Math.max(0, stepNext.clockStart - derived.elapsedMin)),
                  }
                : null
            }
          />

          <TrackLanes
            tracks={program.tracks}
            totalProgramMinutes={program.totalMinutes}
            elapsedMinutes={derived.elapsedMin}
          />
        </div>
      </div>

      <Trophy
        open={trophy.trophy}
        orbit={trophy.orbit}
        elapsedMin={derived.elapsedMin}
        totalMin={derived.totalMin}
        spinning={spinning}
        overrun={overrun}
        seedSeconds={derived.elapsedMin * 60}
        survivors={survivors}
        alert={dueNow ? ((dueStep ?? stepNow)?.text ?? "a step") : null}
        lampWord={lampWord}
        lampLit={lampLit(status)}
      />
    </div>
  );
}
