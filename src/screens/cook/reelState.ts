/**
 * src/screens/cook/reelState.ts — the reel's own honesty rule, as arithmetic.
 *
 * 02 REEL LOGIC section 1: "Nothing turns without meaning, and nothing
 * meaningful stands still." Section 9's first two failure modes are the two
 * ways to break it:
 *
 *   the ornamental reel  the disc spins with no value bound to it
 *   ambient theft        the disc keeps turning after the process it reports
 *                        has gone flat
 *
 * Both are run-time failures on a screen nobody is watching at the moment they
 * happen, which is exactly the kind of claim that should be a test rather than
 * a comment. So the predicate lives here, pure, and index.tsx has no second
 * copy of it.
 */

export type CookStatus = "idle" | "running" | "paused" | "complete";

/**
 * Does the disc turn?
 *
 * ONLY while the program is making forward progress on its own clock. Paused,
 * finished, or waiting for a hand with a step's timer at zero, it holds — and
 * every one of those causes is printed beside it (HOLD / DONE / WAIT), because
 * "a reel that stops without cause is a lie".
 */
export function reelSpins(status: CookStatus, dueNow: boolean): boolean {
  return status === "running" && !dueNow;
}

/**
 * The transport word the strip, the lamp and the disc all report.
 *
 * PRECEDENCE IS THE OPERATOR'S. A pause is a command the operator gave; DUE is
 * a condition the clock produced. When both are true the word is HOLD, and the
 * DUE condition is carried by the annunciator and the countdown instead — one
 * instrument, one fact.
 */
export function transportWord(status: CookStatus, dueNow: boolean): string {
  if (status === "idle") return "READY";
  if (status === "complete") return "DONE";
  if (status === "paused") return "HOLD";
  return dueNow ? "WAIT" : "RUN";
}

/**
 * Is the record lamp lit?
 *
 * CD-BRIEF ruling 3 makes "a cook program is running" ONE claim made once: the
 * chassis rec-dot and this lamp share the hex AND the condition, so the lamp
 * follows src/app/cookRunningStub.ts's own `isCookRunning` exactly — started,
 * not paused, not complete.
 */
export function lampLit(status: CookStatus): boolean {
  return status === "running";
}

/**
 * Does the lamp breathe? II.4.11 — "the pulse stops the instant the process
 * stops. A lamp that keeps breathing after the tape stops is a defect of the
 * first order." Armed-but-waiting holds it lit and STEADY.
 */
export function lampBreathes(status: CookStatus, dueNow: boolean): boolean {
  return reelSpins(status, dueNow);
}

/**
 * Does the AUDIBLE alarm fire?
 *
 * The picture and the sound do NOT share this answer, and that is deliberate.
 * The whole deck is preview-shifted while the operator scrubs, so the alarm's
 * visual state is a legitimate look-ahead — the preview plate is on screen
 * saying how far ahead they are peeking. A tritone carries no such caption, so
 * it is gated on the unshifted condition: a cue reports a consequence that is
 * real (II.5.7's rule for confirm, applied to the one cue that outranks it).
 *
 * MEASURED before this existed: 1.6s of held scrub forward fired 65 bursts at
 * a step that was not due.
 */
export function alarmSounds(dueNow: boolean, previewOffsetMinutes: number): boolean {
  return dueNow && previewOffsetMinutes === 0;
}
