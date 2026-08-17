/**
 * src/cd/physics/integrator.ts — ONE loop, many controls.
 *
 * II.1.19: "Run springs on semi-implicit Euler at a fixed 1/120s substep:
 * accumulate real frame time, clamp the accumulator at 50ms so a backgrounded
 * tab returns without an explosion, and snap to rest below 0.001 of travel and
 * 0.01 of velocity — then release the frame loop. A spring that never sleeps is
 * a heater."
 *
 * II.1.19's own escalation clause makes the singular loop mandatory here:
 * "Refined shares one requestAnimationFrame across every live spring on the
 * screen — controls subscribe, the loop is singular, and the whole screen moves
 * on the one clock II.4 demands." That is load-bearing for a 65-row register:
 * one rAF per row would put 65 callbacks on every frame before a single pixel
 * moved.
 *
 * II.4.13 — one clock, one truth: every subscriber is stepped from the same
 * accumulator in the same frame, so two lamps reporting one process stay in
 * phase by construction rather than by luck.
 *
 * The loop is not React-aware and holds no component state. It is a plain
 * module singleton; springs register on first `set()` and de-register when they
 * come to rest or are stopped.
 */

/** Fixed substep: stability before style (II.1.19). 1/120s. */
export const SUBSTEP_S = 1 / 120;

/** Accumulator clamp — a backgrounded tab returns without an explosion. */
export const ACCUMULATOR_CLAMP_S = 0.05;

/** Rest thresholds (II.1.19): below both, snap to truth and release the loop. */
export const REST_POSITION = 0.001;
export const REST_VELOCITY = 0.01;

export interface SpringConfig {
  /** Mass. Raise it and the control leans before it moves (II.1.4). */
  mass: number;
  /** Stiffness. Raise it and everything happens sooner (II.1.4). */
  stiffness: number;
  /** Damping. Raise it and bounce trades for authority (II.1.4). */
  damping: number;
}

export interface Spring {
  /**
   * Retarget. Position and velocity are live state and CARRY, so a reversal
   * mid-flight launches from wherever the spring actually is (II.1.17) —
   * nothing resets, nothing queues, and no animation finishes out of respect
   * for its own past.
   *
   * @param v0 optional inherited launch velocity, the fourth argument of
   *           spring(mass, stiffness, damping, v0) — used when a glide hands
   *           off to a seat.
   */
  set(target: number, v0?: number): void;
  /** Current reported position, in the control's own unit (deg, px or 0-1). */
  read(): number;
  /** Current velocity, in unit/s. */
  velocity(): number;
  /** The target the spring is travelling toward. */
  target(): number;
  /** True while the spring is asleep at its target. */
  isResting(): boolean;
  /**
   * Snap to a value with no motion at all. This is the reduced-motion dialect
   * for a report that carries no meaning in its travel, and the correct way to
   * seed a control's initial position — never `set()` at construction, which
   * would animate from 0 on first paint.
   */
  jump(x: number): void;
  /** Subscribe to per-frame reports. One callback; a second call replaces it. */
  onFrame(fn: (x: number, v: number) => void): void;
  /** Leave the loop immediately, wherever the spring happens to be. */
  stop(): void;
}

interface Live {
  x: number;
  v: number;
  target: number;
  resting: boolean;
  cfg: SpringConfig;
  cb: ((x: number, v: number) => void) | null;
}

const live = new Set<Live>();
let accumulator = 0;
let last = 0;
let frameHandle: number | null = null;

/** Swappable clock, so the loop is testable without a browser. */
export interface Scheduler {
  now(): number;
  request(cb: (t: number) => void): number;
  cancel(handle: number): void;
}

const browserScheduler: Scheduler = {
  now: () =>
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now(),
  request: (cb) =>
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(cb)
      : (setTimeout(() => cb(browserScheduler.now()), 16) as unknown as number),
  cancel: (h) => {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(h);
    else clearTimeout(h as unknown as ReturnType<typeof setTimeout>);
  },
};

let scheduler: Scheduler = browserScheduler;

/** Test seam. Swapping the scheduler stops the loop first, so nothing leaks. */
export function setScheduler(next: Scheduler): void {
  if (frameHandle !== null) {
    scheduler.cancel(frameHandle);
    frameHandle = null;
  }
  scheduler = next;
}

function substep(s: Live, dt: number): void {
  const a = (-s.cfg.stiffness * (s.x - s.target) - s.cfg.damping * s.v) / s.cfg.mass;
  s.v += a * dt; // velocity first...
  s.x += s.v * dt; // ...then position: semi-implicit Euler (II.1.19)
}

/**
 * Advance every live spring by `dtSeconds` of real time and report.
 * Exported so tests can drive the loop deterministically without a frame clock.
 */
export function step(dtSeconds: number): void {
  accumulator += Math.min(dtSeconds, ACCUMULATOR_CLAMP_S);
  let steps = 0;
  while (accumulator >= SUBSTEP_S) {
    for (const s of live) if (!s.resting) substep(s, SUBSTEP_S);
    accumulator -= SUBSTEP_S;
    steps++;
  }
  if (steps === 0) return;

  for (const s of live) {
    if (Math.abs(s.x - s.target) < REST_POSITION && Math.abs(s.v) < REST_VELOCITY) {
      s.x = s.target; // sleep: snap to truth, never to "close enough"
      s.v = 0;
      s.resting = true;
    }
    s.cb?.(s.x, s.v);
    if (s.resting) live.delete(s);
  }
}

function frame(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  step(dt);
  frameHandle = live.size > 0 ? scheduler.request(frame) : null;
}

function wake(): void {
  if (frameHandle !== null) return;
  accumulator = 0;
  last = scheduler.now();
  frameHandle = scheduler.request(frame);
}

/** How many springs the one loop is currently carrying. For tests and probes. */
export function liveCount(): number {
  return live.size;
}

/** Stop the loop and drop every subscriber. Test teardown only. */
export function resetIntegrator(): void {
  if (frameHandle !== null) scheduler.cancel(frameHandle);
  frameHandle = null;
  accumulator = 0;
  live.clear();
}

/**
 * Create a spring on the shared loop. The spring does NOT enter the loop until
 * something actually retargets it — an untouched control costs nothing.
 */
export function createSpring(cfg: SpringConfig, initial = 0): Spring {
  const s: Live = { x: initial, v: 0, target: initial, resting: true, cfg, cb: null };

  return {
    set(target, v0) {
      s.target = target;
      if (v0 !== undefined) s.v = v0; // inherited launch velocity — the glide handoff
      if (Math.abs(s.x - s.target) < REST_POSITION && Math.abs(s.v) < REST_VELOCITY) {
        s.x = s.target;
        s.v = 0;
        return; // already there; do not spin the loop up to prove it
      }
      s.resting = false;
      live.add(s);
      wake();
    },
    read: () => s.x,
    velocity: () => s.v,
    target: () => s.target,
    isResting: () => s.resting,
    jump(x) {
      s.x = x;
      s.v = 0;
      s.target = x;
      s.resting = true;
      live.delete(s);
      s.cb?.(x, 0);
    },
    onFrame(fn) {
      s.cb = fn;
    },
    stop() {
      s.resting = true;
      s.v = 0;
      live.delete(s);
    },
  };
}
