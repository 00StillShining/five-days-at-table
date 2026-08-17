// docs/VARIANT-SPEC.md: "New pref planVariant... Persisted in fd5.v1.prefs
// (schema-migration-safe: absent -> 'full')." This is the migration-safety
// proof the orchestrator's final report checklist asks for.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultState } from "./reducer";
import { flushPendingWrites, hydrateSlice, setStorageBackend, storageKey, type StorageLike } from "./persist";
import { PrefsSchema } from "./schemas";

class MapStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe("planVariant — migration-safe hydration", () => {
  let storage: MapStorage;

  beforeEach(() => {
    storage = new MapStorage();
    setStorageBackend(storage);
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    setStorageBackend(null);
  });

  it("defaultState carries planVariant: \"full\"", () => {
    expect(defaultState.prefs.planVariant).toBe("full");
  });

  it("a prefs blob persisted before planVariant existed hydrates it to \"full\", not a validation failure", () => {
    const preVariantPrefs = { cover: "w", week: "A", scale: 1, serveTime: "19:30", cycleStartSaturday: null };
    storage.setItem(storageKey("prefs"), JSON.stringify(preVariantPrefs));
    const result = hydrateSlice("prefs", defaultState.prefs);
    expect(result.planVariant).toBe("full");
    // Every other pre-existing field survives untouched — the fix is additive,
    // not a fallback to the whole default object.
    expect(result.cover).toBe("w");
    expect(result.week).toBe("A");
  });

  it("a prefs blob that already carries planVariant: \"morrisons-tester\" round-trips as-is", () => {
    const stored = { cover: "m", week: "B", scale: 1, serveTime: "19:30", cycleStartSaturday: null, planVariant: "morrisons-tester" };
    storage.setItem(storageKey("prefs"), JSON.stringify(stored));
    const result = hydrateSlice("prefs", defaultState.prefs);
    expect(result.planVariant).toBe("morrisons-tester");
  });

  it("an invalid planVariant value fails schema validation (falls back to defaults, never silently coerced)", () => {
    const stored = { cover: "w", week: "A", scale: 1, serveTime: "19:30", cycleStartSaturday: null, planVariant: "bogus" };
    storage.setItem(storageKey("prefs"), JSON.stringify(stored));
    const warnSpy = vi.spyOn(console, "warn");
    const result = hydrateSlice("prefs", defaultState.prefs);
    expect(result).toEqual(defaultState.prefs);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("PrefsSchema.safeParse directly confirms the .default(\"full\") behavior", () => {
    const parsed = PrefsSchema.safeParse({ cover: "w", week: "A", scale: 1, serveTime: "19:30", cycleStartSaturday: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.planVariant).toBe("full");
  });

  it("never leaves a pending debounced write behind (flushPendingWrites is a clean no-op here)", () => {
    flushPendingWrites();
  });
});
