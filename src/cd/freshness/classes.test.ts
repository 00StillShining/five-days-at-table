import { describe, expect, it } from "vitest";
import { FRESHNESS, STALE_INK_ALPHA, ageOf, canGoStale, formatAge } from "./classes";
import { eatenAge, priceAge, stocktakeAge, thawAge, timerAge } from "./useAge";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-08-17T20:00:00.000Z");

describe("the five declared thresholds", () => {
  it("commits exactly five classes and no sixth", () => {
    expect(Object.keys(FRESHNESS).sort()).toEqual([
      "eaten",
      "macros",
      "price",
      "stocktake",
      "timer",
    ]);
  });

  it("holds each threshold at its declared value", () => {
    expect(FRESHNESS.stocktake.staleAfterMs).toBe(72 * HOUR);
    expect(FRESHNESS.price.staleAfterMs).toBe(14 * DAY);
    expect(FRESHNESS.eaten.staleAfterMs).toBe(DAY);
    expect(FRESHNESS.timer.staleAfterMs).toBe(2000);
    expect(FRESHNESS.macros.staleAfterMs).toBe(Number.POSITIVE_INFINITY);
  });

  it("gives every class that can go stale a PRINTED WORD (II.7.7)", () => {
    for (const [name, spec] of Object.entries(FRESHNESS)) {
      if (Number.isFinite(spec.staleAfterMs)) {
        expect(spec.word, `${name} has no printed word`).not.toBe("");
      }
    }
  });

  it("makes macros never stale — a derived value has no age of its own", () => {
    expect(canGoStale("macros")).toBe(false);
    const a = ageOf("macros", new Date(NOW - 400 * DAY).toISOString(), NOW);
    expect(a.stale).toBe(false);
    expect(a.word).toBe("");
  });

  it("drops stale ink to 55% (II.3.18, II.3.32)", () => {
    expect(STALE_INK_ALPHA).toBe(0.55);
  });
});

describe("ageing a reading", () => {
  it("is fresh right up to its threshold and stale at it", () => {
    const justUnder = new Date(NOW - (72 * HOUR - 1)).toISOString();
    const exactly = new Date(NOW - 72 * HOUR).toISOString();
    expect(ageOf("stocktake", justUnder, NOW).stale).toBe(false);
    expect(ageOf("stocktake", exactly, NOW).stale).toBe(true);
    expect(ageOf("stocktake", exactly, NOW).word).toBe("UNCOUNTED");
  });

  it("ALWAYS reports the exact figure, fresh or stale (CORRECTIONARY 4)", () => {
    const fresh = ageOf("stocktake", new Date(NOW - 2 * HOUR).toISOString(), NOW);
    expect(fresh.stale).toBe(false);
    expect(fresh.label).toBe("2h"); // the age is shown even when it is fine
    expect(fresh.ms).toBe(2 * HOUR);
  });

  it("says NEVER for a reading that was never taken — not an age of zero", () => {
    for (const missing of [null, undefined, ""]) {
      const a = ageOf("price", missing, NOW);
      expect(a.ms).toBeNull();
      expect(a.word).toBe("NEVER");
      expect(a.stale).toBe(true);
    }
  });

  it("treats an unparsable timestamp as never taken, never as fresh", () => {
    const a = ageOf("price", "not-a-date", NOW);
    expect(a.word).toBe("NEVER");
    expect(a.stale).toBe(true);
  });

  it("never reports a negative age from a clock skew", () => {
    const future = new Date(NOW + 10 * HOUR).toISOString();
    expect(ageOf("stocktake", future, NOW).ms).toBe(0);
  });
});

describe("formatAge never rounds up into a lie", () => {
  it("prints whole units only", () => {
    expect(formatAge(0)).toBe("0s");
    expect(formatAge(59_000)).toBe("59s");
    expect(formatAge(60_000)).toBe("1m");
    expect(formatAge(59 * 60_000)).toBe("59m");
    expect(formatAge(HOUR)).toBe("1h");
    expect(formatAge(47 * HOUR)).toBe("47h"); // NOT "2d" — that day has not happened
    expect(formatAge(48 * HOUR)).toBe("2d");
    expect(formatAge(71 * HOUR)).toBe("2d");
  });
});

describe("reading the frozen state's own timestamps", () => {
  it("ages a stocktake off inventory.updatedAt", () => {
    const entry = { updatedAt: new Date(NOW - 4 * HOUR).toISOString() };
    expect(stocktakeAge(entry, NOW).label).toBe("4h");
    expect(stocktakeAge(entry, NOW).stale).toBe(false);
  });

  it("reports an absent inventory row as NEVER counted", () => {
    expect(stocktakeAge(undefined, NOW).word).toBe("NEVER");
  });

  it("returns NO thaw age for anything still frozen — the false-expired guard", () => {
    // thawedAt absent means "not yet thawed", which is not a stale reading.
    expect(thawAge({ updatedAt: new Date(NOW).toISOString() }, NOW)).toBeNull();
    expect(thawAge({ updatedAt: "x", thawedAt: null }, NOW)).toBeNull();
    expect(thawAge(undefined, NOW)).toBeNull();
  });

  it("ages a thaw once one has actually happened", () => {
    const entry = {
      updatedAt: new Date(NOW - 90 * HOUR).toISOString(),
      thawedAt: new Date(NOW - 6 * HOUR).toISOString(),
    };
    // the row was touched 90h ago and would read stale; the THAW is 6h old
    expect(stocktakeAge(entry, NOW).stale).toBe(true);
    expect(thawAge(entry, NOW)?.label).toBe("6h");
    expect(thawAge(entry, NOW)?.stale).toBe(false);
  });

  it("expires an eaten tick with the day it belongs to", () => {
    expect(eatenAge({ at: new Date(NOW - 5 * HOUR).toISOString() }, NOW).stale).toBe(false);
    const yesterday = eatenAge({ at: new Date(NOW - 25 * HOUR).toISOString() }, NOW);
    expect(yesterday.stale).toBe(true);
    expect(yesterday.word).toBe("YESTERDAY");
  });

  it("ages a price check from its ISO DATE, which can only ever call it stale EARLY", () => {
    // PriceCheck.on has no time component, so it parses as midnight UTC.
    const fresh = priceAge({ price: 2.5, on: "2026-08-10" }, NOW);
    expect(fresh.stale).toBe(false);
    const old = priceAge({ price: 2.5, on: "2026-08-01" }, NOW);
    expect(old.stale).toBe(true);
    expect(old.word).toBe("UNPRICED");
  });

  it("does not age a timer that never started", () => {
    expect(timerAge({ startedAt: null, pausedAt: null }, null, NOW)).toBeNull();
  });

  it("does not call a PAUSED timer stale — pause is a declared state, not a gap", () => {
    expect(timerAge({ startedAt: NOW - 60_000, pausedAt: NOW - 30_000 }, NOW - 30_000, NOW)).toBeNull();
  });

  it("calls a RUNNING timer stale once its clock stops advancing for 2000ms", () => {
    const running = { startedAt: NOW - 60_000, pausedAt: null };
    expect(timerAge(running, NOW - 500, NOW)?.stale).toBe(false);
    const gone = timerAge(running, NOW - 2500, NOW);
    expect(gone?.stale).toBe(true);
    expect(gone?.word).toBe("NO SIGNAL");
  });
});
