import { describe, expect, it } from "vitest";
import { formatShortDate } from "./london";

describe("formatShortDate — shared '04 aug' short-date convention", () => {
  it("pads a single-digit day and lowercases the month", () => {
    expect(formatShortDate(new Date("2026-08-04T12:00:00Z"))).toBe("04 aug");
  });

  it("does not pad a two-digit day", () => {
    expect(formatShortDate(new Date("2026-08-14T12:00:00Z"))).toBe("14 aug");
  });

  it("carries no year", () => {
    expect(formatShortDate(new Date("2026-08-04T12:00:00Z"))).not.toMatch(/2026/);
  });

  it("uses the Europe/London calendar date, not the UTC one, near a day boundary", () => {
    // 2026-08-04T23:30:00Z is already 2026-08-05 00:30 BST (+1h) in London.
    expect(formatShortDate(new Date("2026-08-04T23:30:00Z"))).toBe("05 aug");
  });

  it("covers every month abbreviation correctly", () => {
    const expected = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    for (let m = 1; m <= 12; m++) {
      const date = new Date(Date.UTC(2026, m - 1, 15, 12, 0, 0));
      expect(formatShortDate(date)).toBe(`15 ${expected[m - 1]}`);
    }
  });
});
