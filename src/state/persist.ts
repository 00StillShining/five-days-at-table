// localStorage persistence: one key per slice (`fd5.v1.<slice>`), debounced
// writes (<=500ms), zod-validated hydration, versioned migration shell.
//
// Contract (docs/PHASE2-CONTRACT.md): "localStorage writes debounced <=500 ms;
// schema versioned `fd5.v1.`; ... hydrate-on-boot with zod validation
// (corrupt slice -> fresh default + console warn, never crash)."
import type { ZodType } from "zod";
import type { AppState, SliceKey } from "./types";
import { SLICE_SCHEMAS } from "./schemas";

export const STORAGE_VERSION = "v1";
const KEY_PREFIX = `fd5.${STORAGE_VERSION}.`;

export function storageKey(slice: SliceKey): string {
  return `${KEY_PREFIX}${slice}`;
}

/** Migration shell: each slice's stored JSON carries no explicit version
 * field today (v1 is the only version), but the key itself is versioned
 * (`fd5.v1.<slice>`) so a future `fd5.v2.<slice>` can coexist during
 * migration and this function becomes the place that reshapes v1 -> v2 data
 * before zod validation. No-op today by design (v1 only). */
function migrate(slice: SliceKey, parsed: unknown): unknown {
  void slice;
  return parsed;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

let overrideBackend: StorageLike | null = null;

/**
 * Test-only hook: inject an in-memory storage mock. This repo's vitest run
 * has no DOM (no jsdom dependency — file ownership rules forbid adding one
 * via package.json), so there is no real `localStorage` global to exercise
 * corrupt-data hydration against; state/persist.test.ts injects a small
 * Map-backed StorageLike instead. Pass null to revert to auto-detected
 * `localStorage` (the real browser behaviour).
 */
export function setStorageBackend(mock: StorageLike | null): void {
  overrideBackend = mock;
}

function getBackend(): StorageLike | null {
  if (overrideBackend) return overrideBackend;
  // `typeof localStorage` (unqualified) never throws even when undeclared —
  // unlike `window.localStorage`, which throws ReferenceError in any
  // environment with no `window` global at all (e.g. this repo's default
  // Node vitest environment).
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

function safeGetItem(key: string): string | null {
  const backend = getBackend();
  if (!backend) return null; // storage unavailable (private mode, disabled, non-browser context)
  try {
    return backend.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  const backend = getBackend();
  if (!backend) return;
  try {
    backend.setItem(key, value);
  } catch {
    // quota exceeded or storage disabled — nothing sensible to do beyond not crashing
  }
}

/**
 * Read+validate one slice from localStorage. Returns `defaultValue` (and
 * warns) if the key is missing, unparsable, or fails its zod schema — a
 * corrupt slice never crashes the app and never contaminates the other
 * slices (each slice hydrates independently).
 */
export function hydrateSlice<K extends SliceKey>(slice: K, defaultValue: AppState[K]): AppState[K] {
  const raw = safeGetItem(storageKey(slice));
  if (raw == null) return defaultValue;
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    console.warn(`[fd5.state] corrupt JSON in ${storageKey(slice)}, falling back to default:`, err);
    return defaultValue;
  }
  const migrated = migrate(slice, parsedJson);
  // The lookup's inferred type is a union across all eight slice schemas,
  // which TS won't narrow down to the specific ZodType<AppState[K]> from a
  // generic `K` alone — cast through `unknown`, same as the static-JSON
  // casts in src/data/*.ts (the real guarantee is SLICE_SCHEMAS[slice]
  // always being the schema literally declared for that key, verified by
  // state/persist.test.ts hydrating every slice key).
  const schema = SLICE_SCHEMAS[slice] as unknown as ZodType<AppState[K]>;
  const result = schema.safeParse(migrated);
  if (!result.success) {
    console.warn(`[fd5.state] ${storageKey(slice)} failed validation, falling back to default:`, result.error.issues);
    return defaultValue;
  }
  return result.data;
}

export function hydrateAll(defaults: AppState): AppState {
  return {
    prefs: hydrateSlice("prefs", defaults.prefs),
    inventory: hydrateSlice("inventory", defaults.inventory),
    eaten: hydrateSlice("eaten", defaults.eaten),
    shopTicks: hydrateSlice("shopTicks", defaults.shopTicks),
    leftovers: hydrateSlice("leftovers", defaults.leftovers),
    waste: hydrateSlice("waste", defaults.waste),
    priceChecks: hydrateSlice("priceChecks", defaults.priceChecks),
    timers: hydrateSlice("timers", defaults.timers),
  };
}

const DEBOUNCE_MS = 500;
interface Pending {
  timer: ReturnType<typeof setTimeout>;
  write: () => void;
}
const pending = new Map<string, Pending>();

/** Debounced (<=500ms) write of one slice. Coalesces rapid successive
 * dispatches into a single localStorage write per slice. */
export function persistSlice<K extends SliceKey>(slice: K, value: AppState[K]): void {
  const key = storageKey(slice);
  const existing = pending.get(key);
  if (existing) clearTimeout(existing.timer);
  const write = () => safeSetItem(key, JSON.stringify(value));
  const timer = setTimeout(() => {
    pending.delete(key);
    write();
  }, DEBOUNCE_MS);
  pending.set(key, { timer, write });
}

/** Flush any pending debounced writes immediately (used before export, and
 * in tests) — writes each pending slice's latest value now rather than
 * discarding it. */
export function flushPendingWrites(): void {
  for (const [key, p] of pending) {
    clearTimeout(p.timer);
    p.write();
    pending.delete(key);
  }
}
