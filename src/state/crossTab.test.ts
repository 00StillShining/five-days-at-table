import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultState, reducer } from "./reducer";
import { flushPendingWrites, persistSlice, setStorageBackend, storageKey, type StorageLike } from "./persist";
import { resolveForeignWrite, slicesChanged } from "./crossTab";

// Same in-memory StorageLike mock as state/persist.test.ts — this repo has
// no jsdom/real localStorage in its default (Node) vitest environment.
class MapStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const bareprefs = { cover: "w" as const, week: "A" as const, scale: 1, serveTime: "19:30", cycleStartSaturday: null, planVariant: "full" as const };

describe("slicesChanged — the mount-gating fix", () => {
  it("returns nothing when the two snapshots are the same object (the mount-time seed)", () => {
    // This is exactly what store.tsx's prevRef seeding produces on the very
    // first effect run: prevRef.current === state, so slicesChanged must
    // report zero changed slices — this is THE fix for the reproduced
    // "mount re-echoes every slice" bug.
    expect(slicesChanged(defaultState, defaultState)).toEqual([]);
  });

  it("a genuine dispatch reports exactly the one slice it touched", () => {
    const next = reducer(defaultState, { type: "prefs/set", patch: { cover: "m" } });
    expect(next).not.toBe(defaultState);
    expect(slicesChanged(defaultState, next)).toEqual(["prefs"]);
  });

  it("a multi-slice action (prep/completeSession) reports exactly the slices it touched, no others", () => {
    const next = reducer(defaultState, { type: "prep/completeSession", week: "A", at: "2026-08-02T14:00:00.000Z" });
    expect(slicesChanged(defaultState, next).sort()).toEqual(["inventory", "leftovers"]);
  });

  it("a reducer no-op (same object returned) reports nothing", () => {
    const next = reducer(defaultState, { type: "timers/pause" }); // not running -> documented no-op
    expect(next).toBe(defaultState);
    expect(slicesChanged(defaultState, next)).toEqual([]);
  });
});

describe("resolveForeignWrite — cross-tab rehydrate decision core", () => {
  beforeEach(() => setStorageBackend(new MapStorage()));
  afterEach(() => flushPendingWrites()); // never leak a scheduled debounce timer into the next test

  it("applies a genuine, valid foreign write (simulated storage event -> state updated)", () => {
    const foreignPrefs = { ...bareprefs, cover: "m" as const };
    const result = resolveForeignWrite(storageKey("prefs"), JSON.stringify(foreignPrefs));
    expect(result).toEqual({ applied: true, slice: "prefs", value: foreignPrefs });
  });

  it("ignores a key that isn't one of ours", () => {
    expect(resolveForeignWrite("someOtherApp.settings", "{}")).toEqual({ applied: false, reason: "not-our-key" });
  });

  it("ignores a foreign removal (newValue null)", () => {
    expect(resolveForeignWrite(storageKey("prefs"), null)).toEqual({ applied: false, reason: "removal" });
  });

  it("ignores zod-rejected foreign junk without throwing (schema violation)", () => {
    const junk = JSON.stringify({ egg: { level: 99, updatedAt: "x" } }); // level 99 is outside the 0-4 union
    expect(resolveForeignWrite(storageKey("inventory"), junk)).toEqual({ applied: false, reason: "invalid" });
  });

  it("ignores zod-rejected foreign junk without throwing (unparsable JSON)", () => {
    expect(resolveForeignWrite(storageKey("prefs"), "{not valid json")).toEqual({ applied: false, reason: "invalid" });
  });

  it("ignores a foreign write for a slice this tab has its own pending debounced write on (local-dispatch-wins)", () => {
    persistSlice("prefs", bareprefs); // schedules a local debounced write, still in flight
    const foreign = JSON.stringify({ ...bareprefs, cover: "m" });
    expect(resolveForeignWrite(storageKey("prefs"), foreign)).toEqual({ applied: false, reason: "local-pending" });
  });

  it("applies a foreign write once the local pending write has already landed", () => {
    persistSlice("prefs", bareprefs);
    flushPendingWrites(); // simulate the 500ms debounce timer firing
    const foreign = { ...bareprefs, cover: "m" as const };
    expect(resolveForeignWrite(storageKey("prefs"), JSON.stringify(foreign))).toEqual({ applied: true, slice: "prefs", value: foreign });
  });

  it("a pending write on a DIFFERENT slice doesn't block this one", () => {
    persistSlice("inventory", {}); // pending write on a different slice
    const foreign = JSON.stringify(bareprefs);
    expect(resolveForeignWrite(storageKey("prefs"), foreign)).toEqual({ applied: true, slice: "prefs", value: bareprefs });
  });
});
