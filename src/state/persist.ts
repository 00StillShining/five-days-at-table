// localStorage persistence: one key per slice (`fd5.v1.<slice>`), debounced
// writes (<=500ms), zod-validated hydration, versioned migration shell.
//
// Contract (docs/PHASE2-CONTRACT.md): "localStorage writes debounced <=500 ms;
// schema versioned `fd5.v1.`; ... hydrate-on-boot with zod validation
// (corrupt slice -> fresh default + console warn, never crash)."
import type { ZodType } from "zod";
import type { AppState, SliceKey } from "./types";
import { SLICE_SCHEMAS } from "./schemas";
import { snapToSaturdayOnOrBefore } from "./london";

export const STORAGE_VERSION = "v1";
const KEY_PREFIX = `fd5.${STORAGE_VERSION}.`;

/** Every persisted slice key, in AppState's own declared order. The single
 * canonical list — store.tsx's persist/rehydrate effects and
 * state/crossTab.ts's cross-tab decision logic both iterate this one array
 * rather than each keeping their own copy. */
export const SLICE_KEYS: SliceKey[] = ["prefs", "inventory", "eaten", "shopTicks", "leftovers", "waste", "priceChecks", "timers", "swaps"];

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
 * Parse + migrate + zod-validate one slice's raw JSON string. Returns
 * `undefined` (and warns) on unparsable JSON or a schema failure — never
 * throws. The one place this logic lives: both `hydrateSlice` (boot-time
 * read) and StoreProvider's cross-tab `storage`-event handler (a foreign
 * tab's write, mid-session) run every value through this exact same gate,
 * so a corrupt/malicious foreign write can't get in via one path just
 * because it would have been rejected via the other.
 */
export function parseAndValidateSlice<K extends SliceKey>(slice: K, raw: string): AppState[K] | undefined {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    console.warn(`[fd5.state] corrupt JSON in ${storageKey(slice)}, ignoring:`, err);
    return undefined;
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
    console.warn(`[fd5.state] ${storageKey(slice)} failed validation, ignoring:`, result.error.issues);
    return undefined;
  }
  return result.data;
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
  const parsed = parseAndValidateSlice(slice, raw);
  return parsed === undefined ? defaultValue : parsed;
}

/**
 * Self-heal migration (owner-walkthrough defect): a stored
 * `prefs.cycleStartSaturday` that isn't actually a Saturday (possible before
 * SettingsDrawer.tsx started snapping on commit — the owner's own profile
 * had one) silently broke `todayInfo`'s fortnight-day math, degrading TODAY
 * into a weekend-ish state on ordinary weekdays: no day number, wrong duty
 * copy. The stored value is still a syntactically valid ISO date (zod's
 * `PrefsSchema` has no day-of-week constraint — see schemas.ts), just
 * semantically wrong, so this isn't a versioned slice migration; it's a
 * cheap, idempotent correction applied to every hydrate. Snapping the
 * already-validated stored value back onto disk (rather than only fixing
 * the in-memory copy) means the fix "sticks" from the very next boot, even
 * for a profile that never happens to touch `prefs` again. Never crashes —
 * `snapToSaturdayOnOrBefore` is pure calendar-date arithmetic with no
 * failure mode for any well-formed "YYYY-MM-DD" string, and a `null`
 * (never-set) pref is left untouched (still routes to onboarding).
 */
function healCycleStartSaturday(prefs: AppState["prefs"]): AppState["prefs"] {
  if (prefs.cycleStartSaturday == null) return prefs;
  const snapped = snapToSaturdayOnOrBefore(prefs.cycleStartSaturday);
  if (snapped === prefs.cycleStartSaturday) return prefs; // already a genuine Saturday — no-op
  const healed = { ...prefs, cycleStartSaturday: snapped };
  persistSlice("prefs", healed); // write the correction back, not just an in-memory patch
  return healed;
}

export function hydrateAll(defaults: AppState): AppState {
  return {
    prefs: healCycleStartSaturday(hydrateSlice("prefs", defaults.prefs)),
    inventory: hydrateSlice("inventory", defaults.inventory),
    eaten: hydrateSlice("eaten", defaults.eaten),
    shopTicks: hydrateSlice("shopTicks", defaults.shopTicks),
    leftovers: hydrateSlice("leftovers", defaults.leftovers),
    waste: hydrateSlice("waste", defaults.waste),
    priceChecks: hydrateSlice("priceChecks", defaults.priceChecks),
    timers: hydrateSlice("timers", defaults.timers),
    swaps: hydrateSlice("swaps", defaults.swaps),
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

/**
 * True while this tab has a debounced write for `slice` still in flight
 * (scheduled but not yet actually written to localStorage). Used by
 * StoreProvider's cross-tab `storage`-event handler: multi-tab race fix,
 * "if the current tab HAS a pending write for that slice, last-dispatch-
 * wins locally" — a foreign tab's write arriving mid-debounce must not
 * clobber an edit the user just made in THIS tab that hasn't hit disk yet;
 * this tab's own pending write will land shortly after and become the
 * final value regardless of what the foreign write said.
 */
export function hasPendingWrite(slice: SliceKey): boolean {
  return pending.has(storageKey(slice));
}
