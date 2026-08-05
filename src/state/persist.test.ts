import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultState } from "./reducer";
import { flushPendingWrites, hydrateAll, hydrateSlice, setStorageBackend, storageKey, type StorageLike } from "./persist";

// This repo's vitest run has no DOM (no jsdom — file ownership rules forbid
// adding a new dependency via package.json), so there's no real
// `localStorage` to write corrupt data into. A tiny in-memory Map-backed
// StorageLike stands in for it — see persist.ts's `setStorageBackend`.
class MapStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe("hydrateSlice — corrupt localStorage never crashes", () => {
  let storage: MapStorage;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    storage = new MapStorage();
    setStorageBackend(storage);
    vi.restoreAllMocks(); // vi.spyOn on an already-spied method reuses call history otherwise
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("falls back to the default when the key is simply absent", () => {
    const result = hydrateSlice("prefs", defaultState.prefs);
    expect(result).toEqual(defaultState.prefs);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("falls back to the default and warns on unparsable JSON", () => {
    storage.setItem(storageKey("prefs"), "{not valid json");
    const result = hydrateSlice("prefs", defaultState.prefs);
    expect(result).toEqual(defaultState.prefs);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to the default and warns when the JSON is valid but fails the slice's schema", () => {
    storage.setItem(storageKey("inventory"), JSON.stringify({ egg: { level: 99, updatedAt: "not-a-real-timestamp-shape" } }));
    // level 99 is outside the 0-4 union — schema rejects it.
    const result = hydrateSlice("inventory", defaultState.inventory);
    expect(result).toEqual(defaultState.inventory);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("accepts and returns genuinely valid stored data", () => {
    const goodInventory = { egg: { level: 3 as const, updatedAt: "2026-08-01T10:00:00.000Z" } };
    storage.setItem(storageKey("inventory"), JSON.stringify(goodInventory));
    const result = hydrateSlice("inventory", defaultState.inventory);
    expect(result).toEqual(goodInventory);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("a corrupt slice doesn't contaminate the other slices — each hydrates independently", () => {
    storage.setItem(storageKey("inventory"), "{ corrupt");
    const goodPrefs = { ...defaultState.prefs, cover: "m" as const };
    storage.setItem(storageKey("prefs"), JSON.stringify(goodPrefs));

    const state = hydrateAll(defaultState);
    expect(state.inventory).toEqual(defaultState.inventory); // corrupt -> default
    expect(state.prefs).toEqual(goodPrefs); // untouched, hydrates fine
  });
});

describe("hydrateAll — self-heals a non-Saturday cycleStartSaturday (owner-walkthrough fix)", () => {
  let storage: MapStorage;

  beforeEach(() => {
    storage = new MapStorage();
    setStorageBackend(storage);
    vi.restoreAllMocks();
  });

  afterEach(() => flushPendingWrites()); // never leak a scheduled debounce timer into the next test

  it("snaps a stored non-Saturday date onto the preceding Saturday, in-memory", () => {
    const badPrefs = { ...defaultState.prefs, cycleStartSaturday: "2026-08-05" }; // a Wednesday
    storage.setItem(storageKey("prefs"), JSON.stringify(badPrefs));

    const state = hydrateAll(defaultState);
    expect(state.prefs.cycleStartSaturday).toBe("2026-08-01"); // preceding Saturday
  });

  it("writes the healed value back to storage so the fix sticks on the next boot", () => {
    const badPrefs = { ...defaultState.prefs, cycleStartSaturday: "2026-08-05" };
    storage.setItem(storageKey("prefs"), JSON.stringify(badPrefs));

    hydrateAll(defaultState);
    flushPendingWrites();

    const persisted = JSON.parse(storage.getItem(storageKey("prefs"))!);
    expect(persisted.cycleStartSaturday).toBe("2026-08-01");
  });

  it("leaves an already-Saturday stored date untouched, and writes nothing back", () => {
    const goodPrefs = { ...defaultState.prefs, cycleStartSaturday: "2026-08-01" };
    storage.setItem(storageKey("prefs"), JSON.stringify(goodPrefs));
    const setItemSpy = vi.spyOn(storage, "setItem");

    const state = hydrateAll(defaultState);
    expect(state.prefs.cycleStartSaturday).toBe("2026-08-01");
    flushPendingWrites();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it("leaves a null (never-set) cycleStartSaturday alone — still routes to onboarding", () => {
    const state = hydrateAll(defaultState);
    expect(state.prefs.cycleStartSaturday).toBeNull();
  });

  it("never crashes on a well-formed but unusual stored date", () => {
    const badPrefs = { ...defaultState.prefs, cycleStartSaturday: "2026-01-01" }; // a Thursday
    storage.setItem(storageKey("prefs"), JSON.stringify(badPrefs));
    expect(() => hydrateAll(defaultState)).not.toThrow();
  });
});
