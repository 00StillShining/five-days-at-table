/**
 * src/cd/sound/bus.ts — one context, one ceiling, one mute.
 *
 * II.5.2 — "Every cue in the product routes through a single master GainNode
 * fixed at 0.126 — a -18 dBFS ceiling for the entire cue mix. Program material
 * the user chose to play never touches this bus ... One bus also means one
 * mute, one ceiling, and one place a reviewer measures."
 *
 * II.5.14 — "No cue plays before the first qualifying gesture. Create the
 * AudioContext INSIDE that gesture's handler — never at load, never behind a
 * resume() plea, never with a speaker-permission interstitial ... Mute is a
 * chassis control, persisted in storage, honored across sessions forever, and
 * it silences the SENSORY LAYER ONLY: every commit, every motion, every warning
 * lamp proceeds identically with the gain at zero."
 *
 * II.5.1 — "Sound reports, never gates." Nothing in this module is awaited by a
 * commit, and no caller may read state back out of it.
 *
 * The gesture-unlock and storage-guard patterns are lifted from
 * src/screens/cook/useChime.ts (which this module does NOT touch): the
 * webkitAudioContext fallback, the try/catch around every localStorage access
 * so a private-mode browser degrades to "off" instead of throwing, and the
 * fd5.v1.<name> key convention that matches src/state/persist.ts.
 */

/** II.5.2 — the one ceiling. 0.126 linear is -18 dBFS. */
export const MASTER_GAIN = 0.126;

/** Matches the fd5.v1.<name> convention used by src/state/persist.ts. */
export const MUTE_STORAGE_KEY = "fd5.v1.cdMuted";

type WebAudioCtor = typeof AudioContext;

function audioCtor(): WebAudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: WebAudioCtor;
    webkitAudioContext?: WebAudioCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function readMute(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false; // private mode / storage disabled — audio simply stays available
  }
}

function writeMute(value: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* quota or disabled — the in-memory toggle for this session still works */
  }
}

export interface Bus {
  ctx: AudioContext;
  master: GainNode;
  /**
   * The world's larynx. II.5.2's Pushed clause: "insert one BiquadFilterNode
   * between bus and destination ... so every cue passes through the same
   * throat." RESTOMOD builds one at 1400Hz; the other worlds leave it flat.
   */
  larynx: BiquadFilterNode;
}

let bus: Bus | null = null;
let muted = readMute();
let booted = false;

/** True once a real gesture has created the context. Read-only probe. */
export function isAwake(): boolean {
  return bus !== null;
}

export function isMuted(): boolean {
  return muted;
}

/**
 * Create the bus. MUST be called from inside a real user-gesture handler.
 * Returns null when audio is unavailable or muted — and a null bus is not an
 * error condition: "A muted instrument is a complete instrument" (II.5).
 */
export function ensureBus(): Bus | null {
  if (bus) return bus;
  if (muted) return null;
  const Ctor = audioCtor();
  if (!Ctor) return null;

  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = MASTER_GAIN; // -18 dBFS, set once, never automated

  // Flat by default: a lowpass at 20000Hz with Q 0.7 is audibly transparent, so
  // a world that never re-voices its larynx pays nothing for the node existing.
  const larynx = ctx.createBiquadFilter();
  larynx.type = "lowpass";
  larynx.frequency.value = 20000;
  larynx.Q.value = 0.7;

  master.connect(larynx).connect(ctx.destination);
  bus = { ctx, master, larynx };
  return bus;
}

/**
 * Re-voice the larynx for the world currently on screen (II.5.9 — one voice per
 * world). RESTOMOD rolls every cue off above 1400Hz; CLEAR LID keeps its whole
 * family soft and low-passed. A world that declares nothing leaves it flat.
 */
export function setLarynx(frequencyHz: number, q = 0.7): void {
  if (!bus) return;
  bus.larynx.frequency.value = frequencyHz;
  bus.larynx.Q.value = q;
}

/**
 * Arm the bus on the first real gesture. Idempotent, `once`, and capturing, so
 * it fires before any handler that might stop propagation.
 *
 * Returns a teardown function; the chassis owns calling it.
 */
export function armOnFirstGesture(target: EventTarget | null = globalThis as EventTarget): () => void {
  if (booted || !target || typeof target.addEventListener !== "function") return () => {};
  booted = true;
  const boot = (): void => {
    ensureBus();
  };
  const opts = { once: true, capture: true } as const;
  target.addEventListener("pointerdown", boot, opts);
  target.addEventListener("keydown", boot, opts);
  return () => {
    target.removeEventListener("pointerdown", boot, opts);
    target.removeEventListener("keydown", boot, opts);
    booted = false;
  };
}

/**
 * The chassis mute. Silences the SENSORY LAYER ONLY — every commit, every
 * motion and every warning LAMP proceeds identically with the gain at zero.
 * Persisted, and honoured across sessions forever.
 */
export function setMuted(next: boolean): void {
  muted = next;
  writeMute(next);
  if (bus) bus.master.gain.value = next ? 0 : MASTER_GAIN;
}

/**
 * The single gate every cue passes through (II.5.15). Returns the bus, or null
 * when the product should stay silent — no air yet, muted, or Trophy Mode with
 * the warning not re-admitted. Callers do not branch on the reason.
 */
export function gate(cueName: string, mode?: string, trophyAudio?: string): Bus | null {
  if (!bus || muted) return null;
  if (mode === "trophy" && !(cueName === "warning" && trophyAudio === "warnings")) return null;
  return bus;
}

/** Test teardown. Drops the context without waiting on close(). */
export function resetBus(): void {
  if (bus) void bus.ctx.close?.().catch(() => {});
  bus = null;
  booted = false;
  muted = readMute();
}
