// COOK's audible-chime OPTION (PLAN §6.6: "an audible chime option ... off by
// default, toggle persisted"). Synthesized via WebAudio (SOL-BRIEF §1: "COOK's
// chime is synthesized, no audio assets to license") — no <audio> element, no
// binary asset, nothing for the build's asset budget to carry.
//
// Persistence: this is a COOK-local UI preference, not part of the
// contract-pinned AppState schema (docs/PHASE2-CONTRACT.md's "State core API"
// enumerates prefs/inventory/eaten/... exhaustively, and state/types.ts,
// state/schemas.ts, state/persist.ts are outside this task's ownership) — so
// it does NOT go through useStore()/dispatch. It reads/writes its own
// localStorage key directly, following the same `fd5.v1.<name>` naming
// convention as the real state slices (state/persist.ts's `storageKey`) so it
// sits recognisably alongside them without touching the slice machinery.
import { useCallback, useEffect, useRef, useState } from "react";

const CHIME_STORAGE_KEY = "fd5.v1.cookChimeEnabled";

function readStoredPreference(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(CHIME_STORAGE_KEY) === "1";
  } catch {
    return false; // private-mode / disabled storage — chime just stays off by default
  }
}

function writeStoredPreference(value: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CHIME_STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* quota/disabled — the in-memory toggle for this session still works */
  }
}

type WebAudioCtor = typeof AudioContext;

function getAudioCtor(): WebAudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: WebAudioCtor; webkitAudioContext?: WebAudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export interface UseChimeResult {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  /** Best-effort "unlock" the audio context on a real user gesture (iOS
   * Safari only allows audio to start from one) — call this from the
   * start/resume button handlers, before the chime is ever needed on its
   * own (dueNow flips asynchronously, not from a gesture). Safe to call
   * repeatedly; a no-op once the context is already running. */
  unlock: () => void;
  /** Play a short two-note synth chime. No-op if disabled or unsupported. */
  play: () => void;
}

/** Three short sine beeps (rising then falling), each with a fast attack/
 * decay envelope so it reads as a distinct "alarm" cadence rather than one
 * flat tone — entirely synthesized, no assets. */
function synthesizeChime(ctx: AudioContext): void {
  const notes: { freq: number; start: number; dur: number }[] = [
    { freq: 880, start: 0, dur: 0.14 },
    { freq: 880, start: 0.18, dur: 0.14 },
    { freq: 1175, start: 0.36, dur: 0.22 },
  ];
  const now = ctx.currentTime;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = note.freq;
    const t0 = now + note.start;
    const t1 = t0 + note.dur;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.35, t0 + 0.015); // fast attack
    gain.gain.exponentialRampToValueAtTime(0.0001, t1); // decay to (near) silence
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

export function useChime(): UseChimeResult {
  const [enabled, setEnabledState] = useState<boolean>(() => readStoredPreference());
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Release the audio context on unmount (navigating away from COOK) —
    // nothing should keep making sound once the lid-closed screen is left.
    return () => {
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  const getOrCreateCtx = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor = getAudioCtor();
    if (!Ctor) return null; // WebAudio unsupported — chime silently unavailable
    const ctx = new Ctor();
    ctxRef.current = ctx;
    return ctx;
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    writeStoredPreference(v);
  }, []);

  const unlock = useCallback(() => {
    const ctx = getOrCreateCtx();
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
  }, [getOrCreateCtx]);

  const play = useCallback(() => {
    if (!enabled) return;
    const ctx = getOrCreateCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      // Not unlocked by a prior gesture yet (e.g. dueNow fired before the
      // user ever pressed start on THIS visit — reload-mid-program case).
      // resume() outside a gesture can be refused by the browser; that's a
      // graceful no-op (the banner + text cue still stand on their own —
      // motion/audio is never the only cue, PLAN §6.6).
      void ctx.resume().then(() => synthesizeChime(ctx)).catch(() => {});
      return;
    }
    synthesizeChime(ctx);
  }, [enabled, getOrCreateCtx]);

  return { enabled, setEnabled, unlock, play };
}
