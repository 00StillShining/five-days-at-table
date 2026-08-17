// VARIANT RUNTIME builder's own scope: COOK's reduced "starter Sunday
// session" (docs/VARIANT-SPEC.md prep.keptOps) — compilePrepProgramFiltered
// and the variant-aware getVariantProgram resolver. programs.test.ts (F2's
// own suite) already pins compilePrepProgram's full-mode behavior.
import { describe, expect, it } from "vitest";
import { activeVariant, FULL_VARIANT } from "../data/variant";
import { VARIANT_MORRISONS_AVAILABLE, variantMorrisonsData } from "../data/variantMorrisons";
import { prepSessionForWeek } from "../data/prep";
import { compilePrepProgram, compilePrepProgramFiltered, getProgram, getVariantProgram, TESTER_PROGRAM_SUFFIX } from "./programs";

describe("getVariantProgram — full-mode identity", () => {
  it("with FULL_VARIANT, resolves every id identically to plain getProgram", () => {
    for (const id of ["prep-a", "prep-b", "a-d1b", "b-d5d"]) {
      expect(getVariantProgram(id, FULL_VARIANT)).toEqual(getProgram(id));
    }
  });

  it("an id ending in the tester suffix that ISN'T the variant's own sessionBase falls through to plain getProgram (-> null, unknown id)", () => {
    expect(getVariantProgram("prep-a-tester", FULL_VARIANT)).toBeNull();
  });
});

describe("compilePrepProgramFiltered", () => {
  const session = prepSessionForWeek("A")!;
  const full = compilePrepProgram(session);

  it("keeps only the requested op indices, renumbered 1..N in filtered order", () => {
    const filtered = compilePrepProgramFiltered(session, [{ opIndex: 0 }, { opIndex: 2 }, { opIndex: 4 }]);
    expect(filtered.steps).toHaveLength(3);
    expect(filtered.steps.map((s) => s.n)).toEqual([1, 2, 3]);
    // Same op bodies as the full compile's own ops at those indices (by text) —
    // confirms this reuses compilePrepOp rather than reinventing the mapping.
    expect(filtered.steps[0].text).toContain(session.ops[0].title);
    expect(filtered.steps[1].text).toContain(session.ops[2].title);
    expect(filtered.steps[2].text).toContain(session.ops[4].title);
  });

  it("id carries the tester suffix; kind/title distinguish it from the full session", () => {
    const filtered = compilePrepProgramFiltered(session, [{ opIndex: 0 }]);
    expect(filtered.id).toBe(`prep-a${TESTER_PROGRAM_SUFFIX}`);
    expect(filtered.kind).toBe("prep");
    expect(filtered.title).not.toBe(full.title);
  });

  it("an empty kept-op list compiles to a valid zero-step program, not a crash", () => {
    const filtered = compilePrepProgramFiltered(session, []);
    expect(filtered.steps).toHaveLength(0);
    expect(filtered.totalMinutes).toBe(0);
  });

  it("totalMinutes is never larger than the full session's own total (a subset can't take longer)", () => {
    const filtered = compilePrepProgramFiltered(
      session,
      [0, 1, 2, 3, 4, 5].map((opIndex) => ({ opIndex }))
    );
    expect(filtered.totalMinutes).toBeLessThanOrEqual(full.totalMinutes);
  });

  // Fable review FIX round: per-op `testerNote` (docs/VARIANT-SPEC.md,
  // optional — coordinate with the data round regenerating this field).
  it("attaches testerNote to the matching step only, leaving other steps untouched", () => {
    const filtered = compilePrepProgramFiltered(session, [
      { opIndex: 0, testerNote: "skip tray B — jerk chickpeas aren't in the starter; the tin is Monday's lunch." },
      { opIndex: 2 },
    ]);
    expect(filtered.steps[0].testerNote).toBe("skip tray B — jerk chickpeas aren't in the starter; the tin is Monday's lunch.");
    expect(filtered.steps[1].testerNote).toBeUndefined();
  });

  it("full-mode compiles never set testerNote (stays undefined, identical to before this field existed)", () => {
    expect(full.steps.every((s) => s.testerNote === undefined)).toBe(true);
  });
});

describe.runIf(VARIANT_MORRISONS_AVAILABLE)("getVariantProgram — real tester data", () => {
  it("resolves \"<sessionBase>-tester\" to the filtered program built from the data's own keptOps", () => {
    const variant = activeVariant({ prefs: { planVariant: "morrisons-tester" } });
    const data = variantMorrisonsData!;
    const id = `${data.prep.sessionBase}${TESTER_PROGRAM_SUFFIX}`;
    const program = getVariantProgram(id, variant);
    expect(program).not.toBeNull();
    expect(program!.steps).toHaveLength(data.prep.keptOps.length);
  });

  it("every other id still resolves exactly like full mode under the tester", () => {
    const variant = activeVariant({ prefs: { planVariant: "morrisons-tester" } });
    expect(getVariantProgram("a-d1b", variant)).toEqual(getProgram("a-d1b"));
  });
});
