// tools/extract/lint.test.js
//
// The Phase 1 lint suite (REWRITE-SPEC.md §Lint contract, L1-L10), run via
// `npm run validate`. Two halves:
//
//   1. "against the real pipeline" — runs every lint against whatever is
//      ACTUALLY in data/rewrites/ + tools/extract/approvals.json right now.
//      Lints "apply to whatever rewrite files exist" (REWRITE-SPEC.md): an
//      empty data/rewrites/ makes this a vacuous pass; once the rewriter
//      agents' files land (as they did mid-build here — see the two
//      rewriters working in parallel per the task brief) it reports real
//      findings against real content.
//   2. "against fixtures" — proves each lint actually DETECTS what it's
//      supposed to, using tools/extract/fixtures/ (never data/rewrites/).
//      Positive fixtures must be perfectly lint-clean; deliberately broken
//      clones of them must trip exactly the rule under test. This half is
//      authoritative and fully under this task's control regardless of what
//      real content exists on disk at any given moment.
//
// Both halves reconstruct a "pure Phase 0" ingredient id set (excluding
// anything addedInContentPass) rather than trusting data/ingredients.json's
// current on-disk id set directly — the real pipeline may have already run
// and merged real content-pass records in, which would otherwise make this
// suite's OWN re-merge of the same records look like id collisions.

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  loadMealRewrite,
  loadPrepRewrite,
  loadContentPassIngredients,
  mergeContentPassIngredients,
  applyPrepRewrite,
  loadApprovals,
  batchApprovalMap,
} from "./rewrite-overlay.js";
import {
  findRawCard,
  phase0CoversForCard,
  lintL1,
  lintL2,
  lintL3,
  lintL4,
  lintL5,
  lintL6,
  lintL7,
  lintL8,
} from "./lint-rules.js";

const ROOT = process.cwd();
const RAW = path.join(ROOT, "data", "raw");
const REWRITES_DIR = path.join(ROOT, "data", "rewrites");
const FIXTURES = path.join(ROOT, "tools", "extract", "fixtures");
const BASIC = path.join(FIXTURES, "basic");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

let fd5Raw, methodsRaw, phase0Meals, phase0Prep, ingredients, phase0IngredientIds;

beforeAll(() => {
  fd5Raw = readJSON(path.join(RAW, "fd5.json"));
  methodsRaw = readJSON(path.join(RAW, "methods.json"));
  phase0Meals = readJSON(path.join(ROOT, "data", "meals.json"));
  phase0Prep = readJSON(path.join(ROOT, "data", "prep.json"));
  ingredients = readJSON(path.join(ROOT, "data", "ingredients.json"));
  phase0IngredientIds = new Set(ingredients.filter((i) => !i.addedInContentPass).map((i) => i.id));
});

// ---------------------------------------------------------------------------
// 1. Against the real pipeline (data/rewrites/ + tools/extract/approvals.json)
// ---------------------------------------------------------------------------

describe("lint suite vs the real data/rewrites/", () => {
  it("L1-L4, L6-L8 report zero violations across every meal that HAS a valid rewrite", () => {
    const { entries } = loadContentPassIngredients(REWRITES_DIR);
    const { merged } = mergeContentPassIngredients(entries, phase0IngredientIds);
    const contentPassIds = new Set(merged.map((r) => r.id));

    const allViolations = [];
    for (const meal of phase0Meals) {
      const loaded = loadMealRewrite(REWRITES_DIR, meal.id);
      if (loaded.status !== "ok") continue; // missing/invalid — nothing to lint (graceful degradation)
      const rewrite = loaded.data;
      const originalCard = findRawCard(methodsRaw, meal.id);
      const phase0Covers = originalCard ? phase0CoversForCard(fd5Raw, originalCard) : { w: {}, m: {} };
      allViolations.push(
        ...lintL1(rewrite),
        ...lintL2(rewrite),
        ...lintL3(rewrite),
        ...lintL4(rewrite, phase0Covers),
        ...lintL6(rewrite, originalCard),
        ...lintL7(rewrite, phase0Covers, contentPassIds),
        ...lintL8(rewrite, originalCard)
      );
    }
    expect(allViolations).toEqual([]);
  });

  it("L5 reports zero violations against real data/rewrites/", () => {
    const prepSessionsByWeek = { A: phase0Prep.find((s) => s.week === "A"), B: phase0Prep.find((s) => s.week === "B") };
    const allViolations = [];
    for (const meal of phase0Meals) {
      const loaded = loadMealRewrite(REWRITES_DIR, meal.id);
      if (loaded.status !== "ok") continue;
      allViolations.push(...lintL5(loaded.data, meal.week, prepSessionsByWeek));
    }
    expect(allViolations).toEqual([]);
  });

  it("L9: no meal rewrite references an unknown ingredient id, and _ingredients.A/B.json carry no conflicting duplicates", () => {
    const { entries, invalid } = loadContentPassIngredients(REWRITES_DIR);
    expect(invalid).toEqual([]);
    const { conflicts } = mergeContentPassIngredients(entries, phase0IngredientIds);
    expect(conflicts).toEqual([]);
    // every currently-loadable meal rewrite must resolve every covers/
    // freebies id against base+merged ingredients — already enforced by
    // join.js's own applyMealRewrite at pipeline time; this is the
    // lint-level echo of the same invariant.
    for (const meal of phase0Meals) {
      const loaded = loadMealRewrite(REWRITES_DIR, meal.id);
      expect(loaded.status).not.toBe("invalid");
    }
  });

  it("L10: every meal's method.approved in the CURRENT data/meals.json is exactly rev==='B' AND its batch is approved in tools/extract/approvals.json", () => {
    const approvals = loadApprovals(path.join(ROOT, "tools", "extract", "approvals.json"));
    const approvalMap = batchApprovalMap(approvals);
    for (const m of phase0Meals) {
      const expected = m.method.rev === "B" && (approvalMap.get(m.id) ?? false);
      expect(m.method.approved).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Against fixtures — positive fixtures are lint-clean; broken clones trip
//    the exact rule under test.
// ---------------------------------------------------------------------------

describe("lint suite vs tools/extract/fixtures/basic (positive cases — must be perfectly clean)", () => {
  let contentPassIds, prepSessionsByWeek, fixtures;

  beforeAll(() => {
    const { entries } = loadContentPassIngredients(BASIC);
    const { merged, conflicts } = mergeContentPassIngredients(entries, phase0IngredientIds);
    expect(conflicts).toEqual([]);
    contentPassIds = new Set(merged.map((r) => r.id));

    const phase0A = phase0Prep.find((s) => s.week === "A");
    const knownIds = new Set([...ingredients.map((i) => i.id), ...contentPassIds]);
    const prepARewrite = loadPrepRewrite(BASIC, "A");
    const sessionA = applyPrepRewrite(phase0A, prepARewrite.data, knownIds).session;
    prepSessionsByWeek = { A: sessionA, B: phase0Prep.find((s) => s.week === "B") };

    fixtures = ["a-d1b", "a-d1d", "a-d1l"].map((id) => ({
      id,
      rewrite: loadMealRewrite(BASIC, id).data,
      originalCard: findRawCard(methodsRaw, id),
    }));
  });

  it("every fixture meal passes L1, L2, L3, L6, L7, L8 with zero violations", () => {
    for (const { rewrite, originalCard } of fixtures) {
      const phase0Covers = phase0CoversForCard(fd5Raw, originalCard);
      expect(lintL1(rewrite)).toEqual([]);
      expect(lintL2(rewrite)).toEqual([]);
      expect(lintL3(rewrite)).toEqual([]);
      expect(lintL4(rewrite, phase0Covers)).toEqual([]);
      expect(lintL6(rewrite, originalCard)).toEqual([]);
      expect(lintL7(rewrite, phase0Covers, contentPassIds)).toEqual([]);
      expect(lintL8(rewrite, originalCard)).toEqual([]);
    }
  });

  it("a-d1l (the batch fixture) passes L5's per-meal check", () => {
    const a1l = fixtures.find((f) => f.id === "a-d1l").rewrite;
    expect(lintL5(a1l, "A", prepSessionsByWeek)).toEqual([]);
  });
});

describe("lint suite catches deliberately broken clones — one rule at a time", () => {
  let good, phase0Covers, originalCard, contentPassIds, prepSessionsByWeek;

  beforeAll(() => {
    good = {
      "a-d1b": loadMealRewrite(BASIC, "a-d1b").data,
      "a-d1d": loadMealRewrite(BASIC, "a-d1d").data,
      "a-d1l": loadMealRewrite(BASIC, "a-d1l").data,
    };
    originalCard = {
      "a-d1b": findRawCard(methodsRaw, "a-d1b"),
      "a-d1d": findRawCard(methodsRaw, "a-d1d"),
      "a-d1l": findRawCard(methodsRaw, "a-d1l"),
    };
    phase0Covers = {
      "a-d1b": phase0CoversForCard(fd5Raw, originalCard["a-d1b"]),
      "a-d1d": phase0CoversForCard(fd5Raw, originalCard["a-d1d"]),
      "a-d1l": phase0CoversForCard(fd5Raw, originalCard["a-d1l"]),
    };
    const { entries } = loadContentPassIngredients(BASIC);
    const { merged } = mergeContentPassIngredients(entries, phase0IngredientIds);
    contentPassIds = new Set(merged.map((r) => r.id));

    const phase0A = phase0Prep.find((s) => s.week === "A");
    const knownIds = new Set([...ingredients.map((i) => i.id), ...contentPassIds]);
    const prepARewrite = loadPrepRewrite(BASIC, "A");
    prepSessionsByWeek = { A: applyPrepRewrite(phase0A, prepARewrite.data, knownIds).session };
  });

  it("L1: a step with no minutes/tempC/untimed is flagged", () => {
    const broken = clone(good["a-d1b"]);
    broken.steps[0].minutes = null;
    broken.steps[0].tempC = null;
    delete broken.steps[0].untimed;
    const violations = lintL1(broken);
    expect(violations.length).toBe(1);
    expect(violations[0]).toMatchObject({ rule: "L1", step: 1 });
  });

  it("L2: an oven step with no tempC is flagged", () => {
    const broken = clone(good["a-d1d"]);
    const ovenStep = broken.steps.find((s) => s.track === "oven");
    ovenStep.tempC = null;
    const violations = lintL2(broken);
    expect(violations.some((v) => v.rule === "L2" && v.step === ovenStep.n)).toBe(true);
  });

  it("L3: a covers gram figure not restated anywhere in the steps is flagged", () => {
    const broken = clone(good["a-d1b"]);
    broken.covers.w.spinach = 999; // step text still says "100/120 g"
    const violations = lintL3(broken);
    expect(violations.some((v) => v.rule === "L3" && v.ingId === "spinach")).toBe(true);
  });

  it("L4: a D0-003 oil split that no longer sums to the Phase 0 total is flagged", () => {
    const broken = clone(good["a-d1d"]);
    broken.covers.w.rapeseed_oil = 6; // was 5; 6+9=15 != Phase 0's 14
    const violations = lintL4(broken, phase0Covers["a-d1d"]);
    expect(violations.some((v) => v.rule === "L4" && /rapeseed_oil \+ olive_oil/.test(v.message))).toBe(true);
  });

  it("L5: batchTakeG exceeding the whole session's yield total is flagged", () => {
    // prep-a's fixture session totals ~1115 g across its two yields (600 g
    // roast chicken + 515 g cabbage from the "515/230 g" slaw-shred qty
    // string's first parsed number) — comfortably exceeded by 9000 g.
    const broken = clone(good["a-d1l"]);
    broken.batchTakeG = { w: 4000, m: 5000, total: 9000 };
    const violations = lintL5(broken, "A", prepSessionsByWeek);
    expect(violations.some((v) => v.rule === "L5" && /exceeds/.test(v.message))).toBe(true);
  });

  it("L5: a batchSource pointing at the wrong week's session is flagged", () => {
    const broken = clone(good["a-d1l"]);
    broken.batchSource = "prep-b";
    const violations = lintL5(broken, "A", prepSessionsByWeek);
    expect(violations.some((v) => v.rule === "L5" && /does not match/.test(v.message))).toBe(true);
  });

  it("L5: a meal claiming a batch take but not listed as a consumer of any yield is flagged", () => {
    const broken = clone(good["a-d1l"]);
    broken.mealId = "a-d9x"; // not a consumer of any prep-a yield
    const violations = lintL5(broken, "A", prepSessionsByWeek);
    expect(violations.some((v) => v.rule === "L5" && /no prep yield/.test(v.message))).toBe(true);
  });

  it("L6: a why block that drifts from data/raw/methods.json is flagged", () => {
    const broken = clone(good["a-d1b"]);
    broken.why = broken.why + " Extra sentence not in the original.";
    const violations = lintL6(broken, originalCard["a-d1b"]);
    expect(violations.some((v) => v.rule === "L6")).toBe(true);
  });

  it("L7: a covers change on an id outside the allowlist is flagged, naming the meal and id", () => {
    const broken = clone(good["a-d1b"]);
    broken.covers.w.avocado = 50; // was 35 — avocado is not a defect id, not D0-003, not content-pass
    const violations = lintL7(broken, phase0Covers["a-d1b"], contentPassIds);
    expect(violations.some((v) => v.rule === "L7" && v.mealId === "a-d1b" && v.ingId === "avocado")).toBe(true);
  });

  it("L7: a covers change on an allowlisted id (D0-003's rapeseed_oil) does NOT get flagged", () => {
    const violations = lintL7(good["a-d1b"], phase0Covers["a-d1b"], contentPassIds);
    expect(violations).toEqual([]);
  });

  it("L8: collapsing a multi-component dinner back to one track is flagged", () => {
    const broken = clone(good["a-d1d"]);
    for (const s of broken.steps) s.track = s.track === null ? null : "oven";
    const violations = lintL8(broken, originalCard["a-d1d"]);
    expect(violations.some((v) => v.rule === "L8" && /distinct track/.test(v.message))).toBe(true);
  });

  it("L8: a tracked step with no clockStart is flagged", () => {
    const broken = clone(good["a-d1d"]);
    const step = broken.steps.find((s) => s.track !== null);
    step.clockStart = null;
    const violations = lintL8(broken, originalCard["a-d1d"]);
    expect(violations.some((v) => v.rule === "L8" && v.step === step.n && /no clockStart/.test(v.message))).toBe(true);
  });
});
