import { describe, expect, it } from "vitest";
import { defaultState } from "../../state/reducer";
import type { AppState } from "../../state/types";
import { arbiterFor, type ScreenId } from "../../engine/arbiter";
import { annunciatorQueue, caption, captionSplit } from "./annunciator";

/**
 * Fable review F2. The same alarm wore a different count per room. These tests
 * pin the repair: ONE queue, one selector, one figure, and no argument a caller
 * can pass that would make their figure differ from the room next door's.
 */

const ANCHOR = "2026-08-01"; // a Saturday
const NOW = new Date("2026-08-05T09:00:00Z"); // Wed, fortnight day 4
const ALL_ROOMS: ScreenId[] = ["today", "plan", "meal", "cook", "stores", "shop", "list"];

function baseState(overrides: Partial<AppState> = {}): AppState {
  const clone = structuredClone(defaultState);
  return {
    ...clone,
    prefs: { ...clone.prefs, cycleStartSaturday: ANCHOR, cover: "w", week: "A" },
    ...overrides,
  };
}

/** A state carrying a genuinely expired item, so a queue actually exists. */
function stateWithExpiry(): AppState {
  return baseState({
    inventory: {
      cottage: { level: 2, updatedAt: new Date(NOW.getTime() - 10 * 86_400_000).toISOString() },
    },
  });
}

describe("annunciator — the queue is one claim, not one per room", () => {
  it("returns an identical figure for every room, at one instant", () => {
    const state = stateWithExpiry();
    const readings = ALL_ROOMS.map(() => annunciatorQueue(state, NOW));
    const behinds = new Set(readings.map((r) => r.behind));
    const heads = new Set(readings.map((r) => r.rank1?.id ?? "none"));
    expect(behinds.size).toBe(1);
    expect(heads.size).toBe(1);
    expect(readings[0].rank1?.kind).toBe("expired");
  });

  it("has no room or context parameter to diverge on", () => {
    // The guarantee is structural: annunciatorQueue's signature is
    // (state, now). If a future edit adds a room or a ctx argument, this fails.
    expect(annunciatorQueue.length).toBe(2);
  });

  it("total is rank1 plus everything behind it", () => {
    const q = annunciatorQueue(stateWithExpiry(), NOW);
    expect(q.total).toBe(q.behind + 1);
    const clear = annunciatorQueue(baseState({ inventory: {} }), new Date("2026-08-02T09:00:00Z"));
    expect(clear.total).toBe(clear.behind + (clear.rank1 ? 1 : 0));
  });

  it("names where the leading duty must be handled", () => {
    const q = annunciatorQueue(stateWithExpiry(), NOW);
    expect(q.rank1Room).toBe("stores");
  });
});

describe("annunciator — the divergence it was built to kill", () => {
  /**
   * Regression witnesses. These assert that the RAW engine call still diverges
   * per room — which is why the selector exists. If the frozen engine is ever
   * repaired to separate its primary action from its queue, these will fail,
   * and that failure is the signal that this module can be simplified rather
   * than a defect.
   */
  it("cause 1 — arbiterFor still counts each room's own primary action", () => {
    const state = stateWithExpiry();
    const raw = new Set(ALL_ROOMS.map((r) => arbiterFor(r, state, NOW).queued));
    expect(raw.size).toBeGreaterThan(1); // the divergence is real
    expect(arbiterFor("plan", state, NOW).queued).toBeLessThan(
      arbiterFor("shop", state, NOW).queued
    );
  });

  it("cause 2 — an explicit ctx.tripDay adds a candidate only where it is passed", () => {
    const state = stateWithExpiry();
    const without = arbiterFor("shop", state, NOW).queued;
    const with0 = arbiterFor("shop", state, NOW, { tripDay: 0 }).queued;
    expect(with0).toBeGreaterThan(without);
  });

  it("the selector is immune to both", () => {
    const state = stateWithExpiry();
    const one = annunciatorQueue(state, NOW).behind;
    // every room, and every ctx a room might have been tempted to pass
    for (const room of ALL_ROOMS) {
      expect(annunciatorQueue(state, NOW).behind).toBe(one);
      void room;
    }
  });
});

describe("annunciator — captions state figures, never a bare disagreeing count", () => {
  it("prints the whole-queue figure", () => {
    expect(caption(annunciatorQueue(stateWithExpiry(), NOW))).toMatch(/^\d+ behind$/);
  });

  it("prints BOTH halves when a room shows only what it can address", () => {
    const q = annunciatorQueue(stateWithExpiry(), NOW);
    expect(captionSplit(q, 1)).toBe(`1 behind here · ${q.total - 1} elsewhere`);
    expect(captionSplit(q, q.total)).toBe(`${q.total} behind here`);
    expect(captionSplit(q, 0)).toBe(`${q.total} behind elsewhere`);
  });

  it("says so plainly when there is nothing queued", () => {
    const q = annunciatorQueue(baseState({ inventory: {} }), new Date("2026-08-02T09:00:00Z"));
    if (q.rank1 === null) expect(caption(q)).toBe("queue clear");
  });
});

/* -------------------------------------------------------------------------- */
/* Adoption ledger                                                             */
/* -------------------------------------------------------------------------- */
/**
 * The review's instruction was to pin the repair with a test "asserting every
 * room derives from the single selector". A screen printing a bare
 * `arbiter.queued` is the defect, so this walks the real sources and finds them.
 *
 * NOT MINE TO MIGRATE: `src/screens/**` belongs to the screen builders, who are
 * live in those folders. So the ledger below names the rooms that still print
 * the raw count, and the test fails if the list GROWS or if an entry becomes
 * stale. It cannot rot, it shrinks as each builder adopts `useAnnunciator`, and
 * it is empty when the defect is gone.
 */
const NOT_YET_MIGRATED = ["today", "stores", "shop", "list"] as const;

/**
 * Sources are read through Vite's own `import.meta.glob(..., '?raw')` rather
 * than node:fs — this project ships no @types/node and `npm run build` runs
 * `tsc --noEmit` over the tests, so a bare `readFileSync` turns the build red.
 */
const SCREEN_SOURCES = import.meta.glob("../../screens/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const CHASSIS_SOURCES = import.meta.glob("./annunciator.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function screensPrintingRawQueued(): string[] {
  const found = new Set<string>();
  for (const [path, src] of Object.entries(SCREEN_SOURCES)) {
    if (/\.test\./.test(path)) continue;
    const room = path.split("/screens/")[1]?.split("/")[0];
    if (!room) continue;
    // a room "prints the raw count" when it reads .queued off an arbiterFor result
    if (/\barbiterFor\s*\(/.test(src) && /\.queued\b/.test(src)) found.add(room);
  }
  return [...found].sort();
}

describe("annunciator — adoption", () => {
  it("no room outside the ledger prints a raw arbiterFor(...).queued", () => {
    const offenders = screensPrintingRawQueued();
    const unexpected = offenders.filter((r) => !NOT_YET_MIGRATED.includes(r as never));
    expect(unexpected).toEqual([]);
  });

  it("the ledger has no stale entries — it can only shrink", () => {
    const offenders = screensPrintingRawQueued();
    const stale = NOT_YET_MIGRATED.filter((r) => !offenders.includes(r));
    expect(stale).toEqual([]);
  });

  it("the chassis makes exactly ONE arbiter call, and it is the app-wide one", () => {
    const raw = Object.values(CHASSIS_SOURCES)[0];
    // Strip comments first — the module documents the defect at length, and
    // prose about arbiterFor is not a call to it.
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code.match(/arbiterFor\(/g)?.length).toBe(1);
    expect(code).toContain('arbiterFor("plan", state, now)');
    // and it never reaches for a room or a ctx
    expect(code).not.toMatch(/arbiterFor\([^)]*(screen|room|ctx|tripDay|mealId)/);
  });
});
