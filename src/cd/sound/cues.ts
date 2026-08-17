/**
 * src/cd/sound/cues.ts — five cues, no sixth.
 *
 * II.5.3 — "Every audible event in the product is one of five named cues. Name
 * the cue before you synthesize; a sound without a row in this table is a sound
 * you cut."
 *
 *   contact  15-40ms   -22 dBFS (0.63)  one per press, never on release
 *   detent   15-50ms   -24 dBFS (0.50)  rate-limited and coalesced (II.5.11)
 *   latch    40-100ms  -21 dBFS (0.71)  two-stage, mirroring the motion
 *   confirm  80-180ms  -20 dBFS (0.79)  only AFTER the consequence lands
 *   warning  100-400ms -18 dBFS         never the sole cue (II.7)
 *
 * II.5.9 — one voice per world. Each of the eight languages re-voices the five
 * inside their bands; none adds a sixth.
 *
 * THE WARNING IS ONE GLOBAL CUE. Every one of the eight chapters specifies the
 * identical dyad — 620Hz and 877Hz, 180ms, peaks 0.63 and 0.35, repeating at 2
 * events/second phase-locked to the annunciator's 2Hz flash. Eight byte-
 * identical copies would be eight places for it to drift, so it is synthesized
 * once, here, and no voicing may override it. II.5.10: "the tritone belongs to
 * the alert and appears nowhere else, ever."
 *
 * II.5.16 — what never sounds: hover, scroll, focus travel, the pulse
 * heartbeat, passive data updates, streaming values, needle sweeps, meter
 * ballistics, entrance choreography, reveals, trays, navigation of every kind,
 * layout, resize, load, connection state. There is no function below that can
 * be called for any of them.
 */

import { gate, setLarynx, type Bus } from "./bus";
import {
  coalesce,
  createCoalescerState,
  duckGain,
  flushMerged,
  panFor,
  type CoalescerState,
  type DuckState,
} from "./coalescer";

export type CueName = "contact" | "detent" | "latch" | "confirm" | "warning";

export type LanguageSlug =
  | "back-channel"
  | "exposed-works"
  | "restomod"
  | "faceted-volume"
  | "reel-logic"
  | "clear-lid"
  | "tangent-horizon"
  | "irreducible";

/** II.5.2 — the loudness ladder, as linear pre-bus peaks. */
export const PEAK: Record<CueName, number> = {
  detent: 0.5, // -24 dBFS — quietest, because most frequent
  contact: 0.63, // -22 dBFS
  latch: 0.71, // -21 dBFS
  confirm: 0.79, // -20 dBFS
  warning: 1.0, // -18 dBFS — the ceiling, and only the warning touches it
};

/** II.5.8 — the reserved interval. 620 * sqrt(2) = 877. Global, never re-voiced. */
export const TRITONE_LOW = 620;
export const TRITONE_HIGH = 877;
export const TRITONE_MS = 180;
export const TRITONE_PEAK_LOW = 0.63;
export const TRITONE_PEAK_HIGH = 0.35;
export const ALERT_PERIOD_S = 0.5; // 2 events/second, phase-locked to the 2Hz flash

/** II.5.8 — caution, the lower severity: one 740Hz tone, 200ms, once per entry. */
export const CAUTION_HZ = 740;
export const CAUTION_MS = 200;

interface NoiseSpec {
  kind: "noise";
  ms: number;
  filter: "lowpass" | "bandpass";
  hz: number;
  q: number;
  /** Optional sine core underneath, for IRREDUCIBLE's heavy thunk. */
  coreHz?: number;
}

interface ToneSpec {
  kind: "tone";
  wave: OscillatorType;
  hz: number;
  attack: number;
  decay: number;
  release: number;
}

interface LatchSpec {
  throwHz: number;
  throwMs: number;
  throwKind: "noise" | "tone";
  seatHz: number;
  /** Release seats a fourth down (II.5.6). */
  releaseSeatHz: number;
}

interface ConfirmSpec {
  rootHz: number;
  answerHz: number;
  attack: number;
  decay: number;
  release: number;
}

export interface Voicing {
  family: "mechanical" | "synth" | "civic";
  /** II.5.2 Pushed — the world's larynx. null leaves the throat flat. */
  larynxHz: number | null;
  /** II.5.4 — null RETIRES the audible contact entirely (BACK CHANNEL). */
  contact: NoiseSpec | ToneSpec | null;
  /** BACK CHANNEL's key answers in bloom and haptic; IRREDUCIBLE fires on release. */
  contactOnRelease: boolean;
  detent: ToneSpec;
  latch: LatchSpec;
  confirm: ConfirmSpec;
}

const BENCH_CONTACT: NoiseSpec = { kind: "noise", ms: 35, filter: "lowpass", hz: 2200, q: 0.7 };
const BENCH_DETENT: ToneSpec = {
  kind: "tone",
  wave: "triangle",
  hz: 1800,
  attack: 0.001,
  decay: 0.017,
  release: 0.004,
};
const BENCH_LATCH: LatchSpec = {
  throwHz: 2000,
  throwMs: 12,
  throwKind: "noise",
  seatHz: 480,
  releaseSeatHz: 360,
};
const BENCH_CONFIRM: ConfirmSpec = {
  rootHz: 660,
  answerHz: 880,
  attack: 0.004,
  decay: 0.05,
  release: 0.016,
};

/**
 * The eight voicings, each taken from its chapter's section 6. Where a chapter
 * declares a delta from the bench it is marked; where it declares nothing, the
 * bench recipe stands unchanged, which is what "revoicing is substitution
 * inside the bands, never expansion of them" (II.5.9) means in practice.
 */
export const VOICES: Record<LanguageSlug, Voicing> = {
  // 13 BACK CHANNEL — synth. "Contact retires its audible half ENTIRELY for the
  // Answer Key; the key answers in its own bloom and haptic, never in sound,
  // and the doctrine holds under every escalation."
  "back-channel": {
    family: "synth",
    larynxHz: null,
    contact: null,
    contactOnRelease: false,
    detent: BENCH_DETENT,
    latch: BENCH_LATCH,
    confirm: BENCH_CONFIRM,
  },

  // 05 EXPOSED WORKS — mechanical, "metal meeting metal at a different mass".
  // Declared deltas: contact centred at 3200Hz with a 34ms decay; the detent
  // "pretty clack" at 2100Hz/20ms; latch throws 900Hz and seats 410Hz; confirm
  // pitched low and heavy at 312 -> 416Hz.
  "exposed-works": {
    family: "mechanical",
    larynxHz: null,
    contact: { kind: "noise", ms: 35, filter: "bandpass", hz: 3200, q: 2 },
    contactOnRelease: false,
    detent: { kind: "tone", wave: "triangle", hz: 2100, attack: 0.002, decay: 0.02, release: 0 },
    latch: { throwHz: 900, throwMs: 18, throwKind: "tone", seatHz: 410, releaseSeatHz: 308 },
    confirm: { rootHz: 312, answerHz: 416, attack: 0.003, decay: 0.12, release: 0.06 },
  },

  // 17 RESTOMOD — mechanical and warm. One shared BiquadFilterNode at 1400Hz
  // Q0.7 is this world's larynx. Detent re-keyed DOWN to 960Hz, "moved clear of
  // the confirm pair's 880Hz top note".
  restomod: {
    family: "mechanical",
    larynxHz: 1400,
    contact: { kind: "noise", ms: 35, filter: "lowpass", hz: 2200, q: 0.7 },
    contactOnRelease: false,
    detent: { kind: "tone", wave: "triangle", hz: 960, attack: 0.001, decay: 0.017, release: 0.004 },
    latch: BENCH_LATCH,
    confirm: BENCH_CONFIRM,
  },

  // 16 FACETED VOLUME — precision-mechanical: "a cut surface argues its
  // exactness with clarity, not grit". Declared deltas: contact 30ms (5ms under
  // the default) through a 3200Hz bandpass; detent a pure SINE at 2100Hz/18ms.
  "faceted-volume": {
    family: "mechanical",
    larynxHz: null,
    contact: { kind: "noise", ms: 30, filter: "bandpass", hz: 3200, q: 4 },
    contactOnRelease: false,
    detent: { kind: "tone", wave: "sine", hz: 2100, attack: 0.001, decay: 0.014, release: 0.003 },
    latch: BENCH_LATCH,
    confirm: BENCH_CONFIRM,
  },

  // 02 REEL LOGIC — mechanical, bench values throughout. Its motor whir is NOT
  // a sixth cue: it is the detent tick coalesced above 8/s (II.5.11), a whir
  // made of ticks too close to hear apart, never a synthesized hum.
  "reel-logic": {
    family: "mechanical",
    larynxHz: null,
    contact: BENCH_CONTACT,
    contactOnRelease: false,
    detent: BENCH_DETENT,
    latch: BENCH_LATCH,
    confirm: BENCH_CONFIRM,
  },

  // 10 CLEAR LID — "wood, felt, and a hinge's own damped travel". Detent
  // retuned DOWN to 640Hz "because felt damps deeper than struck metal"; latch
  // throws 400Hz and seats 320Hz; confirm is a rising WHIR, 330 -> 440Hz.
  // larynxHz is DERIVED: the chapter asks for "the same low-pass register as
  // every other cue so it never brightens into a chime even at its loudest" but
  // names no frequency. 2400Hz is II.5.10's own ceiling for fundamentals — the
  // highest cut that cannot brighten a cue past the band the doctrine allows.
  "clear-lid": {
    family: "mechanical",
    larynxHz: 2400,
    contact: BENCH_CONTACT,
    contactOnRelease: false,
    detent: { kind: "tone", wave: "triangle", hz: 640, attack: 0.003, decay: 0.04, release: 0 },
    latch: { throwHz: 400, throwMs: 18, throwKind: "tone", seatHz: 320, releaseSeatHz: 300 },
    confirm: { rootHz: 330, answerHz: 440, attack: 0.008, decay: 0.13, release: 0.032 },
  },

  // 11 TANGENT HORIZON — "hush and glass ... closer to a change in air pressure
  // than a click". Latch is the flush-check's lock: 540Hz for 40ms, then 450Hz
  // for the remaining 52ms — a MINOR THIRD, deliberately never confirm's fourth
  // and never confirm's own 660Hz. Confirm rises 392 -> 523Hz.
  "tangent-horizon": {
    family: "mechanical",
    larynxHz: null,
    contact: BENCH_CONTACT,
    contactOnRelease: false,
    detent: BENCH_DETENT,
    latch: { throwHz: 540, throwMs: 40, throwKind: "tone", seatHz: 450, releaseSeatHz: 338 },
    confirm: { rootHz: 392, answerHz: 523, attack: 0.003, decay: 0.13, release: 0.02 },
  },

  // 20 IRREDUCIBLE — mechanical, pitched low. Contact FIRES ON RELEASE, not the
  // down-stroke the bench defaults to: "a cue on the press would report before
  // the water moves". A 300Hz sine core — the fundamental floor itself — under
  // 38ms of noise lowpassed at 1400Hz, the corridor's own floor. Detent is
  // unchanged from the bench; confirm is pitched low at 392 -> 523Hz.
  irreducible: {
    family: "mechanical",
    larynxHz: null,
    contact: { kind: "noise", ms: 38, filter: "lowpass", hz: 1400, q: 0.7, coreHz: 300 },
    contactOnRelease: true,
    detent: BENCH_DETENT,
    latch: { throwHz: 700, throwMs: 12, throwKind: "noise", seatHz: 480, releaseSeatHz: 360 },
    confirm: { rootHz: 392, answerHz: 523, attack: 0.004, decay: 0.13, release: 0.02 },
  },
};

/* ------------------------------------------------------------------ */
/* synthesis                                                           */
/* ------------------------------------------------------------------ */

function sink(bus: Bus, pan: number): AudioNode {
  if (pan === 0 || typeof bus.ctx.createStereoPanner !== "function") return bus.master;
  const p = bus.ctx.createStereoPanner();
  p.pan.value = pan;
  p.connect(bus.master);
  return p;
}

function tone(
  bus: Bus,
  at: number,
  spec: { wave: OscillatorType; hz: number; attack: number; decay: number; release: number },
  peak: number,
  out: AudioNode
): void {
  const o = bus.ctx.createOscillator();
  o.type = spec.wave;
  o.frequency.value = spec.hz;
  const g = bus.ctx.createGain();
  const end = at + spec.attack + spec.decay + spec.release;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(Math.max(peak, 0.0002), at + spec.attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(end + 0.01);
}

function noise(bus: Bus, at: number, spec: NoiseSpec, peak: number, out: AudioNode): void {
  const seconds = spec.ms / 1000;
  const len = Math.max(1, Math.ceil(bus.ctx.sampleRate * seconds));
  const buf = bus.ctx.createBuffer(1, len, bus.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = bus.ctx.createBufferSource();
  src.buffer = buf;
  const f = bus.ctx.createBiquadFilter();
  f.type = spec.filter;
  f.frequency.value = spec.hz;
  f.Q.value = spec.q;
  const g = bus.ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(Math.max(peak, 0.0002), at + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  src.connect(f).connect(g).connect(out);
  src.start(at);
  src.stop(at + seconds + 0.005);

  if (spec.coreHz !== undefined) {
    // IRREDUCIBLE's thunk: the sine core rings under the noise rather than
    // snapping with it, which is the whole of that world's flow analog.
    tone(
      bus,
      at,
      { wave: "sine", hz: spec.coreHz, attack: 0.003, decay: seconds * 0.8, release: 0.01 },
      peak,
      out
    );
  }
}

/* ------------------------------------------------------------------ */
/* the public surface                                                  */
/* ------------------------------------------------------------------ */

const coalescers = new Map<string, CoalescerState>();
const ducks = new Map<string, DuckState>();
let current: LanguageSlug = "reel-logic";

/** Point the cue engine at the world currently on screen (II.5.9). */
export function setVoice(slug: LanguageSlug): void {
  current = slug;
  const larynx = VOICES[slug].larynxHz;
  setLarynx(larynx ?? 20000);
}

export function activeVoice(): LanguageSlug {
  return current;
}

export interface CueOptions {
  /** 0-1 across the viewport, for the pan lean of II.5.13. */
  x?: number;
  /** Latch and confirm both have a falling counterpart (II.5.6, II.5.7). */
  release?: boolean;
  /** Trophy Mode gating (II.5.15). */
  mode?: string;
  trophyAudio?: string;
  /** Wall clock for the duck window; injectable for tests. */
  nowMs?: number;
}

/**
 * Fire a cue. Silent, and CHEAP, when the bus does not exist — the product is
 * already whole without it (II.5.1).
 *
 * Cues are scheduled at `ctx.currentTime` inside the same task that committed
 * the state, so the audio clock owns the start time and the 10ms budget of
 * II.5.1 is met by scheduling rather than by luck.
 */
export function cue(name: CueName, opts: CueOptions = {}): void {
  const bus = gate(name, opts.mode, opts.trophyAudio);
  if (!bus) return;

  const voice = VOICES[current];
  const at = bus.ctx.currentTime;
  const nowMs = opts.nowMs ?? (typeof performance !== "undefined" ? performance.now() : Date.now());
  const duck = duckGain(ducks, name, nowMs);
  const out = sink(bus, panFor(name, opts.x ?? 0.5));

  switch (name) {
    case "contact": {
      if (!voice.contact) return; // BACK CHANNEL: the audible half is retired
      const peak = PEAK.contact * duck;
      if (voice.contact.kind === "noise") noise(bus, at, voice.contact, peak, out);
      else tone(bus, at, voice.contact, peak, out);
      return;
    }

    case "detent": {
      // NEVER synthesized directly — always through the 8/s coalescer (II.5.11).
      const key = `detent:${current}`;
      let state = coalescers.get(key);
      if (!state) {
        state = createCoalescerState();
        coalescers.set(key, state);
      }
      const decision = coalesce(state, at);
      if (decision.fire) {
        tone(bus, decision.at, voice.detent, PEAK.detent * decision.gain * duck, out);
        return;
      }
      const waitMs = Math.max(0, (decision.scheduleAt - at) * 1000);
      setTimeout(() => {
        const live = gate("detent", opts.mode, opts.trophyAudio);
        if (!live) return;
        const now = live.ctx.currentTime;
        const gain = flushMerged(state, now);
        tone(live, now, voice.detent, PEAK.detent * gain * duck, sink(live, panFor("detent", opts.x ?? 0.5)));
      }, waitMs);
      return;
    }

    case "latch": {
      // II.5.6 — the latch speaks TWICE: throw, then seat 48ms later. Two events
      // separated in time are the audible proof of a mechanism.
      const spec = voice.latch;
      const peak = PEAK.latch * duck;
      if (spec.throwKind === "noise") {
        noise(
          bus,
          at,
          { kind: "noise", ms: spec.throwMs, filter: "bandpass", hz: spec.throwHz, q: 4 },
          peak,
          out
        );
      } else {
        tone(
          bus,
          at,
          { wave: "triangle", hz: spec.throwHz, attack: 0.002, decay: spec.throwMs / 1000, release: 0 },
          peak,
          out
        );
      }
      const seatHz = opts.release ? spec.releaseSeatHz : spec.seatHz;
      tone(
        bus,
        at + 0.048, // the fixed throw-to-seat gap; 100ms total
        { wave: "triangle", hz: seatHz, attack: 0.002, decay: 0.04, release: 0.01 },
        peak,
        out
      );
      return;
    }

    case "confirm": {
      // II.5.7 — fires ONLY after the consequence is real. Refusal inverts the
      // pair: same lengths, same levels, the answer changes, the voice does not.
      const spec = voice.confirm;
      const peak = PEAK.confirm * duck;
      const first = opts.release ? spec.answerHz : spec.rootHz;
      const second = opts.release ? spec.rootHz : spec.answerHz;
      tone(
        bus,
        at,
        { wave: "sine", hz: first, attack: spec.attack, decay: spec.decay, release: spec.release },
        peak,
        out
      );
      tone(
        bus,
        at + 0.09, // the answer, 90ms later
        { wave: "sine", hz: second, attack: spec.attack, decay: spec.decay, release: spec.release },
        peak,
        out
      );
      return;
    }

    case "warning": {
      // THE ONE GLOBAL CUE. Identical in all eight chapters, so synthesized in
      // exactly one place. Never ducked (II.5.12), never panned (II.5.13).
      alertDyad(bus, at);
      return;
    }
  }
}

function alertDyad(bus: Bus, at: number): void {
  tone(
    bus,
    at,
    { wave: "sine", hz: TRITONE_LOW, attack: 0.002, decay: 0.15, release: 0.028 },
    TRITONE_PEAK_LOW,
    bus.master
  );
  tone(
    bus,
    at,
    { wave: "sine", hz: TRITONE_HIGH, attack: 0.002, decay: 0.15, release: 0.028 },
    TRITONE_PEAK_HIGH,
    bus.master
  );
}

/**
 * II.5.8 — the repeating alert. Bursts are scheduled on the AUDIO clock and the
 * timer only wakes the check; it sets nothing. `stillFiring` is read fresh each
 * burst, so acknowledging silences the sound while the lamp burns steady.
 */
export function warnUntil(stillFiring: () => boolean, opts: CueOptions = {}): () => void {
  let cancelled = false;
  let handle: ReturnType<typeof setTimeout> | null = null;
  const bus = gate("warning", opts.mode, opts.trophyAudio);
  if (!bus) return () => {};
  let nextAt = bus.ctx.currentTime;

  const burst = (): void => {
    if (cancelled || !stillFiring()) return;
    alertDyad(bus, nextAt);
    nextAt += ALERT_PERIOD_S;
    const wakeMs = Math.max(0, (nextAt - bus.ctx.currentTime) * 1000 - 10);
    handle = setTimeout(burst, wakeMs);
  };
  burst();

  return () => {
    cancelled = true;
    if (handle) clearTimeout(handle);
  };
}

/** II.5.8 — caution, the lower severity. Fires ONCE per state entry, never repeats. */
export function caution(opts: CueOptions = {}): void {
  const bus = gate("warning", opts.mode, opts.trophyAudio);
  if (!bus) return;
  tone(
    bus,
    bus.ctx.currentTime,
    { wave: "sine", hz: CAUTION_HZ, attack: 0.004, decay: CAUTION_MS / 1000, release: 0.02 },
    PEAK.confirm,
    bus.master
  );
}

/** Test teardown. */
export function resetCues(): void {
  coalescers.clear();
  ducks.clear();
  current = "reel-logic";
}
