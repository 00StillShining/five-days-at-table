import { describe, expect, it } from "vitest";
import { prepSessionForWeek } from "../data/prep";
import { computePrepCompletion, parseLeadingGrams } from "./prepCompletion";

const AT = "2026-08-02T14:00:00.000Z"; // a Sunday prep-session completion instant

describe("computePrepCompletion — Week A (prep-a, 12 yields)", () => {
  const result = computePrepCompletion("A", {}, AT)!;

  it("stamps single-ingredient yields straight into inventory at full level", () => {
    for (const ingId of ["chicken", "chickpeas", "egg", "brown_rice", "cauliflower", "greek_yog", "suya_spice"]) {
      // chicken/cauliflower are freezer-class (isFreezerStock): thawedAt is
      // also stamped at completion time, since the raw stock has just been
      // cooked/prepped and is now a fridge item, not frozen (P1 fix) — see
      // prepCompletion.ts. Harmless/unused for the non-freezer-class ones.
      expect(result.inventory[ingId], ingId).toEqual({ level: 4, updatedAt: AT, thawedAt: AT });
    }
  });

  it("routes composite yields (2+ significant ingredients) to leftovers, not inventory", () => {
    const refs = result.newLeftovers.map((l) => l.ref);
    expect(refs).toEqual(expect.arrayContaining(["Chipotle beef", "Turkey bolognese", "Efo riro base", "Slaw shred"]));
  });

  it("routes the colliding second brown_rice yield (Jollof) to leftovers, since Plain brown rice already claimed the ingId", () => {
    const jollof = result.newLeftovers.find((l) => l.ref === "Jollof");
    expect(jollof).toBeDefined();
    // brown_rice itself was claimed by "Plain brown rice" (earlier in yields[] order).
    expect(result.inventory.brown_rice).toEqual({ level: 4, updatedAt: AT, thawedAt: AT });
  });

  it("computes a useBy date from the yield's free-text storage life", () => {
    const bolognese = result.newLeftovers.find((l) => l.ref === "Turkey bolognese")!;
    // storage: "Fridge 4 days, or freeze half" -> 4 days after the 2026-08-02 completion date.
    expect(bolognese.useBy).toBe("2026-08-06");
    expect(bolognese.date).toBe("2026-08-02");
  });

  it("carries the yield's consumers and provenance through to the leftover record", () => {
    const bolognese = result.newLeftovers.find((l) => l.ref === "Turkey bolognese")!;
    expect(bolognese.consumers).toContain("a-d4l");
    expect(bolognese.sourceWeek).toBe("A");
    expect(bolognese.sourceSession).toBe("prep-a");
    expect(bolognese.source).toBe("prep");
    expect(bolognese.consumedAt).toBeNull();
  });

  it("produces exactly one leftover entry per un-mapped yield, matching prep-a's own yield count", () => {
    const session = prepSessionForWeek("A")!;
    const mappedCount = Object.keys(result.inventory).length;
    expect(mappedCount + result.newLeftovers.length).toBe(session.yields.length);
  });
});

describe("computePrepCompletion — Week B (prep-b, ops with no ingredients[] data)", () => {
  it("still produces a leftover record (description-only, g: null) for yields with no gram data at all", () => {
    const result = computePrepCompletion("B", {}, AT)!;
    const suya = result.newLeftovers.find((l) => l.ref === "Suya jar");
    expect(suya).toBeDefined();
    expect(suya!.g).toBeNull();
    expect(suya!.useBy > suya!.date).toBe(true); // still a real (if low-confidence) countdown, not immortal
  });
});

describe("computePrepCompletion — merges with existing inventory rather than replacing it wholesale", () => {
  it("leaves untouched ingredients alone", () => {
    const existing = { avocado: { level: 2 as const, updatedAt: "2026-07-30T00:00:00.000Z" } };
    const result = computePrepCompletion("A", existing, AT)!;
    expect(result.inventory.avocado).toEqual(existing.avocado);
    expect(result.inventory.chicken).toEqual({ level: 4, updatedAt: AT });
  });
});

describe("parseLeadingGrams", () => {
  it("reads a plain gram figure", () => expect(parseLeadingGrams("600 g raw")).toBe(600));
  it("converts kg to g", () => expect(parseLeadingGrams("~1.4 kg raw")).toBe(1400));
  it("returns null when there's no numeric quantity", () => expect(parseLeadingGrams("makes plenty")).toBeNull());
});
