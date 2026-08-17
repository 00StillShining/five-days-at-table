// COOK — tape timeline + reel (PLAN §6.6 / D7), dark, lid-closed. Phase 2
// wave 2 (docs/PHASE2-CONTRACT.md): this folder is self-contained per the
// ownership rule — no other screen folder imports from it, and it imports
// only components/engine/state/data, never another screen.
//
// COOK is the ONLY precision-industrial screen (PLAN §6.0): the scene root
// below carries `data-language="precision-industrial"` (same pattern
// src/app/scenes/CookPlaceholder.tsx already demonstrated) to locally
// override the .fd5 tokens for this subtree only — the persistent chassis
// (masthead/paddles/exit-tab) stays in the playful light base.
//
// COOK never renders the shared <ArbiterSlot> (engine/arbiter.ts's
// primaryActionFor("cook", ...) always returns null, and arbiter.test.ts
// pins that) — "COOK's own reel/done-button is the interaction, not an
// arbiter action." The step-due alarm below is COOK's own local red cue
// instead, kept to exactly one red element (the reel's index dot) per the
// same Sol §5.1 discipline the shared arbiter follows elsewhere.
import { useEffect, useRef, useState } from "react";
import type { SceneProps } from "../../app/router";
import { useStore } from "../../state/store";
import { useProgram } from "../../engine/timers";
import { mealMacros } from "../../state/selectors";
import { getMeal, prepSessionForWeek } from "../../data";
import { TESTER_PROGRAM_SUFFIX } from "../../engine/programs";
import { useNow } from "../../state/useNow";
import { useChime } from "./useChime";
import { ProgramPicker } from "./ProgramPicker";
import { Reel } from "./Reel";
import { TrackLanes } from "./TrackLanes";
import { Controls, type PrimaryAction } from "./Controls";
import { CompletionTally } from "./CompletionTally";
import { formatMinutesAsClock, formatScrubOffset } from "./format";
import { prepProgramDisplayName, prepWeekForProgramId } from "./programGroups";
import "./cook.css";

const SCRUB_BOUND_MIN = 20;

export default function CookScene(_props: SceneProps) {
  const { state } = useStore();
  const now = useNow();
  const chime = useChime();
  const prog = useProgram();

  const [scrubOffset, setScrubOffset] = useState(0);
  const [leftoverBaseline, setLeftoverBaseline] = useState<Set<string> | null>(null);

  // Mirrors `scrubOffset` synchronously (unlike the state variable, which
  // only updates on the next render). Needed because a real keyboard's OS
  // key-repeat (holding ◂/▸, or the ArrowLeft/Right handler firing several
  // times before React commits) calls stepScrub() repeatedly inside the
  // SAME tick — reading the `scrubOffset` closure variable in that window
  // would see the same stale pre-update value on every call and each step
  // would overwrite the last instead of accumulating (verified: 3 rapid
  // ArrowRight presses only reached +01:00 with the closure-only version,
  // not +03:00). The ref is always current regardless of render timing.
  const scrubOffsetRef = useRef(0);

  const wasDueRef = useRef(false);
  useEffect(() => {
    const isDue = prog.state?.dueNow ?? false;
    if (isDue && !wasDueRef.current) chime.play();
    wasDueRef.current = isDue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prog.state?.dueNow, chime.play]);

  function stepScrub(delta: number) {
    const next = Math.max(-SCRUB_BOUND_MIN, Math.min(SCRUB_BOUND_MIN, scrubOffsetRef.current + delta));
    scrubOffsetRef.current = next;
    setScrubOffset(next);
    prog.scrubPreview(next);
  }
  function resetScrub() {
    scrubOffsetRef.current = 0;
    setScrubOffset(0);
    prog.clearScrubPreview();
  }
  function backToPicker() {
    prog.reset();
    resetScrub();
    setLeftoverBaseline(null);
  }

  const program = prog.program;
  const derived = prog.state;

  if (!program || !derived) {
    return (
      <div className="fd5 scr-cook" data-language="precision-industrial">
        <ProgramPicker state={state} now={now} onLoad={(id) => prog.load(id)} />
      </div>
    );
  }

  const lastStepN = program.steps.length ? Math.max(...program.steps.map((s) => s.n)) : null;

  // Prep programs' proper name/description split (coordinator FIX round,
  // item 2) — computed once, shared by both the running Reel's header and
  // the complete-state tally below, so the two can never disagree.
  const prepWeek = program.kind === "prep" ? prepWeekForProgramId(program.id) : null;
  const prepSession = prepWeek ? prepSessionForWeek(prepWeek) : null;
  // docs/VARIANT-SPEC.md: the tester's reduced session keeps its own
  // "starter sunday session" name (ProgramPicker's own naming, mirrored
  // here) rather than the full session's "Week A Sunday session" — even
  // though `prepWeekForProgramId` now resolves a week for both ids (needed
  // for the completion tally below to not dead-end).
  const isReducedPrep = program.kind === "prep" && program.id.endsWith(TESTER_PROGRAM_SUFFIX);
  const heroTitle = prepWeek ? (isReducedPrep ? "starter sunday session" : prepProgramDisplayName(prepWeek)) : program.title;
  const heroSubtitle = prepWeek ? (isReducedPrep ? program.title : prepSession?.sessionName) : undefined;

  function handleDoneStep(stepN: number) {
    const isFinal = stepN === lastStepN;
    if (isFinal && program!.kind === "prep") {
      setLeftoverBaseline(new Set(state.leftovers.map((l) => l.id)));
    }
    prog.doneStep(stepN);
    if (isFinal) {
      if (program!.kind === "meal") prog.completeMeal();
      else prog.completePrepSession();
    }
  }

  // ---- complete: the tally scene (PLAN §6.0's one playful touch) ----------
  if (derived.status === "complete") {
    // Cook-authority (orchestrator ruling, FIX round item 4): finishing the
    // final step never forces confirming every earlier one, but any step
    // that never got its own "done ▸" tap is named here rather than hidden.
    const skippedCount = program.steps.length - derived.doneSteps.length;

    if (program.kind === "meal") {
      const meal = getMeal(program.id);
      if (!meal) return null; // defensive: stale programId, shouldn't occur
      const macros = mealMacros(meal.id, state.prefs.cover, state.prefs.scale);
      return (
        <div className="fd5 scr-cook" data-language="precision-industrial">
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
    if (!prepWeek || !prepSession) return null; // defensive
    const newLeftovers = leftoverBaseline ? state.leftovers.filter((l) => !leftoverBaseline.has(l.id)) : [];
    return (
      <div className="fd5 scr-cook" data-language="precision-industrial">
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

  // ---- standby / running / paused ------------------------------------------
  const status = derived.status; // "idle" | "running" | "paused" here (complete handled above)
  const { stepNow, stepNext, dueNow } = derived;
  const isPreviewing = scrubOffset !== 0;

  // `stepNow` is "the active step with the latest clockStart" (engine/timers.ts's
  // own doc) — deliberately a "what to focus on" pointer, NOT necessarily the
  // step that's actually overdue (e.g. a long-running rice track can still be
  // stepNow while a shorter glaze track, started at the same time, is the one
  // that's really due). The alarm banner makes a factual claim ("X — time's
  // up"), so it must name whichever active step is actually overdue — the one
  // with the earliest deadline, if more than one — never assume that's stepNow.
  const dueStep = dueNow
    ? derived.activeSteps
        .filter((s) => !s.untimed && s.minutes != null && s.clockStart! + s.minutes <= derived.elapsedMin)
        .sort((a, b) => a.clockStart! + a.minutes! - (b.clockStart! + b.minutes!))[0]
    : undefined;

  // Scrub-preview is a look-AHEAD only: `derived` above (and everything it
  // feeds — the reel readout, NOW/next, track lanes, the alarm banner) is
  // deliberately preview-shifted, so scrubbing forward can show what a due
  // alarm will look like before it really happens. But `stepNow`/`dueStep`
  // are ALSO preview-shifted, and `done ▸` must never silently complete a
  // step that hasn't actually arrived yet just because the user was peeking
  // ahead — so the primary action (and +1 min, which extends a real timer)
  // are simply disabled while a preview offset is active, rather than
  // trying to keep two parallel "true vs. previewed" step pointers in sync.
  //
  // Orchestrator ruling (FIX round item 4): when something is overdue,
  // `done ▸` targets the SAME step the alarm banner names (`dueStep`, the
  // earliest-deadline overdue one) — the alarm is COOK's act-now slot, and
  // "done" must clear what it shouts about, not whatever `stepNow` happens
  // to be pointing at for "what to focus on" purposes. When nothing is
  // overdue, `dueStep` is undefined and this falls back to `stepNow` exactly
  // as before.
  const doneTarget = dueStep ?? stepNow;
  const primary: PrimaryAction =
    status === "idle"
      ? { label: "start ▸", onActivate: () => { chime.unlock(); prog.start(); }, disabled: isPreviewing }
      : status === "paused"
        ? { label: "resume ▸", onActivate: () => { chime.unlock(); prog.resume(); }, disabled: isPreviewing }
        : {
            label: "done ▸",
            onActivate: () => doneTarget && handleDoneStep(doneTarget.n),
            disabled: isPreviewing || !doneTarget,
          };

  const nowText =
    status === "idle" ? "ready to start" : stepNow ? stepNow.text : status === "running" ? "waiting for next step" : "";

  const nextText =
    stepNext && stepNext.clockStart != null
      ? `next   ${stepNext.text} — starts in ${formatMinutesAsClock(Math.max(0, stepNext.clockStart - derived.elapsedMin))}`
      : null;

  const wakeLockUnsupported = typeof navigator === "undefined" || !("wakeLock" in navigator);

  return (
    <div className="fd5 scr-cook" data-language="precision-industrial">
      <div className="scr-cook-body">
        {isPreviewing && (
          <p className="scr-cook-preview-banner" role="status">
            previewing {formatScrubOffset(scrubOffset)} · done / +1 min are off until you return to "now"
          </p>
        )}

        <Reel
          title={heroTitle}
          subtitle={heroSubtitle}
          elapsedMin={derived.elapsedMin}
          totalMin={derived.totalMin}
          status={status}
          dueNow={dueNow}
          scrubOffsetMinutes={scrubOffset}
          scrubBoundMinutes={SCRUB_BOUND_MIN}
          onScrubStep={stepScrub}
          onScrubReset={resetScrub}
        />

        {dueNow && (
          <p className="scr-cook-alarm" role="status" aria-live="assertive">
            <span className="scr-cook-alarm-dot" aria-hidden="true" />
            {(dueStep ?? stepNow)?.text ?? "step"} — time's up
          </p>
        )}

        {status === "running" && wakeLockUnsupported && (
          <p className="scr-cook-wakelock-note">screen may sleep here — wake lock isn't supported by this browser.</p>
        )}

        <div className="scr-cook-nownext">
          <p className="scr-cook-now-label">now</p>
          <p className="scr-cook-now-text">{nowText}</p>
          {/* Fable review FIX round: the tester's per-op testerNote (docs/
              VARIANT-SPEC.md, optional — regenerated by the data round) —
              quiet, text-only inline note attached to the current step, no
              color-only meaning (secondary text weight/size is the only
              cue, matching COOK's engraved-caps-adjacent dark lean). */}
          {stepNow?.testerNote && <p className="scr-cook-now-testernote">{stepNow.testerNote}</p>}
          {nextText && <p className="scr-cook-next-text">{nextText}</p>}
        </div>

        <TrackLanes tracks={program.tracks} totalProgramMinutes={program.totalMinutes} elapsedMinutes={derived.elapsedMin} />

        <div className="scr-cook-utility-row">
          <button type="button" className="fd5-control scr-cook-changeprog" onClick={backToPicker}>
            change program
          </button>
          <label className="fd5-control scr-cook-chime-toggle">
            <input
              type="checkbox"
              checked={chime.enabled}
              onChange={(e) => chime.setEnabled(e.target.checked)}
            />
            chime
          </label>
        </div>
      </div>

      <Controls
        primary={primary}
        showPlusOneMinute={status === "running"}
        plusOneMinuteDisabled={isPreviewing}
        onPlusOneMinute={prog.plusOneMinute}
        canPause={status === "running"}
        canResume={status === "paused"}
        onPause={prog.pause}
        onResume={() => {
          chime.unlock();
          prog.resume();
        }}
      />
    </div>
  );
}
