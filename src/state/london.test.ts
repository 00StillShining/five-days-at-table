import { describe, expect, it } from "vitest";
import { formatShortDate, formatShortDateFromIso, snapToSaturdayOnOrBefore } from "./london";

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

describe("formatShortDateFromIso — same '04 aug' convention for a plain calendar date", () => {
  it("pads a single-digit day and lowercases the month", () => {
    expect(formatShortDateFromIso("2026-08-04")).toBe("04 aug");
  });

  it("does not pad a two-digit day", () => {
    expect(formatShortDateFromIso("2026-08-14")).toBe("14 aug");
  });

  it("carries no year", () => {
    expect(formatShortDateFromIso("2026-08-04")).not.toMatch(/2026/);
  });

  it("agrees with formatShortDate for the same calendar date (no DST-boundary drift)", () => {
    expect(formatShortDateFromIso("2026-08-01")).toBe(formatShortDate(new Date("2026-08-01T12:00:00Z")));
  });
});

describe("snapToSaturdayOnOrBefore — cycleStartSaturday must always be a genuine Saturday", () => {
  it("leaves an already-Saturday date unchanged (idempotent)", () => {
    expect(snapToSaturdayOnOrBefore("2026-08-01")).toBe("2026-08-01"); // 2026-08-01 is a Saturday
  });

  it("snaps a Wednesday back to the Saturday before it (the owner-walkthrough repro)", () => {
    expect(snapToSaturdayOnOrBefore("2026-08-05")).toBe("2026-08-01"); // Wed -> preceding Sat
  });

  it("snaps a Sunday back just one day, not a full week", () => {
    expect(snapToSaturdayOnOrBefore("2026-08-02")).toBe("2026-08-01");
  });

  it("snaps a Friday back six days, to the start of its own week", () => {
    expect(snapToSaturdayOnOrBefore("2026-08-07")).toBe("2026-08-01");
  });

  it("snaps every weekday of one week to the same preceding Saturday", () => {
    const days = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"];
    for (const day of days) {
      expect(snapToSaturdayOnOrBefore(day)).toBe("2026-08-01");
    }
  });

  it("handles a snap across a month boundary", () => {
    expect(snapToSaturdayOnOrBefore("2026-09-01")).toBe("2026-08-29"); // Tue 1 Sep -> Sat 29 Aug
  });
});
