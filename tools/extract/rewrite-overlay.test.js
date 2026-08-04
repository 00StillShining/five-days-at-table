// tools/extract/rewrite-overlay.test.js
//
// Unit tests for the Phase 1 overlay mechanism (rewrite-overlay.js), using
// fixture files under tools/extract/fixtures/ ONLY — never data/rewrites/,
// which the real pipeline (join.js) is the sole reader of. These tests prove
// the merge mechanics (schema validation, referential checks, macro
// recompute, freebie flow, content-pass ingredient merge/conflict detection,
// approvals) work correctly even though the current repo has zero real
// rewrite files.
//
// Reads data/ingredients.json / data/meals.json / data/prep.json as
// read-only Phase 0 ground truth (same convention as validate.test.js) —
// run `npm run extract` first.

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  loadOwnerRulings,
  applyOwnerRulings,
  loadContentPassIngredients,
  mergeContentPassIngredients,
  loadMealRewrite,
  applyMealRewrite,
  loadPrepRewrite,
  applyPrepRewrite,
  loadApprovals,
  batchApprovalMap,
} from "./rewrite-overlay.js";

const ROOT = process.cwd();
const FIXTURES = path.join(ROOT, "tools", "extract", "fixtures");
const BASIC = path.join(FIXTURES, "basic");
const CONFLICT = path.join(FIXTURES, "conflict");
const INVALID = path.join(FIXTURES, "invalid");
const EMPTY = path.join(FIXTURES, "empty");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

let baseIngredients, baseIngredientsById, phase0Meals, mealById, phase0Prep, phase0IngredientIds;

beforeAll(() => {
  baseIngredients = readJSON(path.join(ROOT, "data", "ingredients.json"));
  baseIngredientsById = new Map(baseIngredients.map((i) => [i.id, i]));
  phase0Meals = readJSON(path.join(ROOT, "data", "meals.json"));
  mealById = new Map(phase0Meals.map((m) => [m.id, m]));
  phase0Prep = readJSON(path.join(ROOT, "data", "prep.json"));
  // The real data/rewrites/ pipeline may already have run (its _ingredients.*
  // merges land on disk in data/ingredients.json) by the time these tests
  // run — reconstruct the true Phase 0 id set (base register + addedInExtraction,
  // NOT addedInContentPass) so these tests' own collision/merge checks stay
  // correct regardless of what a prior real `npm run extract` already merged.
  phase0IngredientIds = new Set(baseIngredients.filter((i) => !i.addedInContentPass).map((i) => i.id));
});

// ---------------------------------------------------------------------------
// owner-rulings.json
// ---------------------------------------------------------------------------

describe("loadOwnerRulings / applyOwnerRulings", () => {
  it("loads and validates a well-formed owner-rulings.json fixture, stripping the _comment key", () => {
    const rulings = loadOwnerRulings(path.join(BASIC, "owner-rulings.json"));
    expect(rulings.resolvedBy).toBe("owner-checkpoint-2026-08-04");
    expect(rulings.rulings["D0-003"].status).toBe("resolved");
  });

  it("returns null when the file does not exist (degrades gracefully)", () => {
    expect(loadOwnerRulings(path.join(EMPTY, "owner-rulings.json"))).toBeNull();
  });

  it("applies an explicit ruling and stamps resolvedBy, confirms every other resolved-by-default entry, leaves open entries untouched, never mutates the input", () => {
    const decisions = [
      { id: "D0-003", topic: "t", detail: "d".repeat(25), options: [], recommendation: "r", status: "open", resolvedTo: null },
      { id: "D0-777", topic: "t", detail: "d".repeat(25), options: [], recommendation: "r", status: "resolved-by-default", resolvedTo: "x" },
      { id: "D0-778", topic: "t", detail: "d".repeat(25), options: [], recommendation: "r", status: "open", resolvedTo: null },
    ];
    const rulings = loadOwnerRulings(path.join(BASIC, "owner-rulings.json"));
    const { decisions: merged, appliedRulingIds, confirmedDefaultIds, unknownRulingIds } = applyOwnerRulings(decisions, rulings);

    expect(appliedRulingIds).toEqual(["D0-003"]);
    expect(confirmedDefaultIds).toEqual(["D0-777"]);
    expect(unknownRulingIds).toEqual([]);

    const d3 = merged.find((d) => d.id === "D0-003");
    expect(d3.status).toBe("resolved");
    expect(d3.resolvedTo).toBe("Test resolution text for D0-003.");
    expect(d3.resolvedBy).toBe("owner-checkpoint-2026-08-04");

    const d777 = merged.find((d) => d.id === "D0-777");
    expect(d777.resolvedBy).toBe("owner-checkpoint-2026-08-04");
    expect(d777.resolvedTo).toBe("x"); // content unchanged, only stamped

    const d778 = merged.find((d) => d.id === "D0-778");
    expect(d778.resolvedBy).toBeUndefined(); // still genuinely open, untouched

    expect(decisions[0].status).toBe("open"); // input array never mutated
  });

  it("flags a ruling id with no matching decisions-queue entry (unknownRulingIds)", () => {
    const rulings = loadOwnerRulings(path.join(BASIC, "owner-rulings.json")); // names D0-003
    const decisions = [{ id: "D0-999", topic: "t", detail: "d".repeat(25), options: [], recommendation: "r", status: "open", resolvedTo: null }];
    const { unknownRulingIds } = applyOwnerRulings(decisions, rulings);
    expect(unknownRulingIds).toEqual(["D0-003"]);
  });

  it("the REAL tools/extract/owner-rulings.json matches its own confirmedCount against the current data/decisions-queue.json", () => {
    const rulings = loadOwnerRulings(path.join(ROOT, "tools", "extract", "owner-rulings.json"));
    const decisions = readJSON(path.join(ROOT, "data", "decisions-queue.json"));
    // Compare against a FRESH decisions array whose status/resolvedTo mirror
    // the un-stamped Phase 0 shape (i.e. before this same file's own merge
    // was applied) is unnecessary here — decisions-queue.json's status field
    // already reflects the merge, so "resolved-by-default" entries not named
    // in rulings are exactly the confirmed defaults.
    const rulingIds = new Set(Object.keys(rulings.rulings));
    const confirmedDefaults = decisions.filter((d) => d.status === "resolved-by-default" && !rulingIds.has(d.id));
    expect(confirmedDefaults.length).toBe(rulings.confirmedDefaults.confirmedCount);
  });
});

// ---------------------------------------------------------------------------
// data/rewrites/_ingredients.A.json, _ingredients.B.json
// ---------------------------------------------------------------------------

describe("loadContentPassIngredients / mergeContentPassIngredients", () => {
  it("loads both weeks' files and validates every record", () => {
    const { entries, invalid } = loadContentPassIngredients(BASIC);
    expect(invalid).toEqual([]);
    const ids = entries.map((e) => e.record.id).sort();
    expect(ids).toEqual(["black_pepper", "oregano_dried", "oregano_dried", "salt", "suya_spice_blend"].sort());
  });

  it("tolerates an identical duplicate id across A/B, merging to one record flagged addedInContentPass with both sources", () => {
    const { entries } = loadContentPassIngredients(BASIC);
    const { merged, conflicts, collisions } = mergeContentPassIngredients(entries, new Set());
    expect(conflicts).toEqual([]);
    expect(collisions).toEqual([]);
    const oregano = merged.find((r) => r.id === "oregano_dried");
    expect(oregano.addedInContentPass).toBe(true);
    expect(oregano.contentPassSources.sort()).toEqual(["A", "B"]);
    expect(merged.filter((r) => r.id === "oregano_dried").length).toBe(1);
    expect(merged.length).toBe(4); // salt, black_pepper, oregano_dried (x1), suya_spice_blend
  });

  it("detects a CONFLICTING duplicate id (same id, different content) across A/B, excludes it from merged, names both sources", () => {
    const { entries, invalid } = loadContentPassIngredients(CONFLICT);
    expect(invalid).toEqual([]);
    const { merged, conflicts } = mergeContentPassIngredients(entries, new Set());
    expect(conflicts).toEqual([{ id: "honey", sources: ["A", "B"] }]);
    expect(merged.find((r) => r.id === "honey")).toBeUndefined();
  });

  it("flags (and skips) a content-pass id that collides with an existing Phase 0 ingredient id", () => {
    const { entries } = loadContentPassIngredients(BASIC);
    const existingIds = new Set(["salt"]); // pretend "salt" already exists in Phase 0
    const { merged, collisions } = mergeContentPassIngredients(entries, existingIds);
    expect(collisions.some((c) => c.id === "salt")).toBe(true);
    expect(merged.find((r) => r.id === "salt")).toBeUndefined();
  });

  it("returns empty entries/invalid when neither _ingredients file exists", () => {
    const { entries, invalid } = loadContentPassIngredients(EMPTY);
    expect(entries).toEqual([]);
    expect(invalid).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// data/rewrites/<mealId>.json
// ---------------------------------------------------------------------------

describe("loadMealRewrite / applyMealRewrite", () => {
  it("returns status 'missing' for a meal with no rewrite file", () => {
    expect(loadMealRewrite(BASIC, "a-d2b").status).toBe("missing");
  });

  it("loads and validates a-d1b's rewrite", () => {
    const loaded = loadMealRewrite(BASIC, "a-d1b");
    expect(loaded.status).toBe("ok");
    expect(loaded.data.rev).toBe("B");
  });

  it("rejects a schema-invalid rewrite file (missing required 'why'), naming the field", () => {
    const loaded = loadMealRewrite(INVALID, "a-d1b");
    expect(loaded.status).toBe("invalid");
    expect(loaded.message).toMatch(/why/);
  });

  it("rejects a rewrite whose mealId field does not match its filename", () => {
    const loaded = loadMealRewrite(INVALID, "b-d1b");
    expect(loaded.status).toBe("invalid");
    expect(loaded.message).toMatch(/mealId/);
  });

  it("applies a-d1b's rewrite: covers pass through, macros recompute to the exact known Phase 0 values (rapeseed_oil is nutritionally identical to olive_oil in this dataset), rev becomes B, freebies surface, approved starts false", () => {
    const meal = mealById.get("a-d1b");
    const loaded = loadMealRewrite(BASIC, "a-d1b");
    // a-d1b's freebies (salt, black_pepper) are content-pass ids — merge them
    // in first, exactly as join.js does before applying any meal rewrite.
    const { entries } = loadContentPassIngredients(BASIC);
    const { merged, conflicts } = mergeContentPassIngredients(entries, phase0IngredientIds);
    expect(conflicts).toEqual([]);
    const ingredientsById = new Map([...baseIngredients, ...merged].map((i) => [i.id, i]));
    const result = applyMealRewrite(meal, loaded.data, ingredientsById);
    expect(result.status).toBe("ok");
    expect(result.meal.method.rev).toBe("B");
    expect(result.meal.covers.w.rapeseed_oil).toBe(5);
    expect(result.meal.macros.w).toEqual({ kcal: 426, protein: 27, netCarb: 14, fat: 26, fibre: 15.4 });
    expect(result.meal.macros.m).toEqual({ kcal: 502, protein: 31, netCarb: 16, fat: 32, fibre: 17.9 });
    expect(result.freebies).toEqual(["salt", "black_pepper"]);
    expect(result.meal.method.approved).toBe(false); // approvals.json pass sets this afterwards
  });

  it("skips (status 'invalid') a rewrite that references an unknown ingredient id, naming the id", () => {
    const meal = mealById.get("a-d2b");
    const loaded = loadMealRewrite(INVALID, "a-d2b");
    expect(loaded.status).toBe("ok"); // schema-valid
    const result = applyMealRewrite(meal, loaded.data, baseIngredientsById);
    expect(result.status).toBe("invalid");
    expect(result.message).toMatch(/totally_unknown_ingredient_id/);
  });

  it("applies a-d1d's rewrite: the D0-003 oil split sums exactly to the Phase 0 table total, and a content-pass ingredient (oregano_dried) can enter covers once merged", () => {
    const meal = mealById.get("a-d1d");
    const loaded = loadMealRewrite(BASIC, "a-d1d");
    expect(loaded.status).toBe("ok");

    // Build the post-content-pass ingredient index, exactly as join.js does.
    const { entries } = loadContentPassIngredients(BASIC);
    const { merged, conflicts } = mergeContentPassIngredients(entries, phase0IngredientIds);
    expect(conflicts).toEqual([]);
    const ingredientsById = new Map([...baseIngredients, ...merged].map((i) => [i.id, i]));

    const result = applyMealRewrite(meal, loaded.data, ingredientsById);
    expect(result.status).toBe("ok");

    // rapeseed_oil + olive_oil sums back to the Phase 0 14/17 g oil total —
    // no new grams introduced beyond the ruled D0-003 split (rule 9).
    expect(result.meal.covers.w.rapeseed_oil + result.meal.covers.w.olive_oil).toBe(14);
    expect(result.meal.covers.m.rapeseed_oil + result.meal.covers.m.olive_oil).toBe(17);
    expect(result.meal.covers.w.oregano_dried).toBe(1);

    // Independent reference recompute (the documented formula, applied
    // locally here rather than by calling recomputeMacros itself) — this
    // still catches wiring bugs: wrong grams, wrong id resolution, or a
    // stale ingredient index missing the content-pass merge.
    function expectedMacros(coverGrams) {
      let kcal = 0,
        protein = 0,
        fibre = 0,
        carb = 0,
        fat = 0;
      for (const [id, g] of Object.entries(coverGrams)) {
        const f = ingredientsById.get(id).per100g;
        kcal += (f.kcal * g) / 100;
        protein += (f.protein * g) / 100;
        fibre += (f.fibre * g) / 100;
        carb += (f.carb * g) / 100;
        fat += (f.fat * g) / 100;
      }
      return {
        kcal: Math.round(kcal),
        protein: Math.round(protein),
        netCarb: Math.round(carb - fibre),
        fat: Math.round(fat),
        fibre: Math.round(fibre * 10) / 10,
      };
    }
    expect(result.meal.macros.w).toEqual(expectedMacros(loaded.data.covers.w));
    expect(result.meal.macros.m).toEqual(expectedMacros(loaded.data.covers.m));
  });
});

// ---------------------------------------------------------------------------
// data/rewrites/prep-a.json, prep-b.json
// ---------------------------------------------------------------------------

describe("loadPrepRewrite / applyPrepRewrite", () => {
  it("returns 'missing' when no prep rewrite file exists", () => {
    expect(loadPrepRewrite(EMPTY, "A").status).toBe("missing");
  });

  it("loads and applies prep-a.json's rewrite: ops/yields replaced, rev becomes B, D0-014's 515 g cabbage figure and D0-020's headroom note land", () => {
    const loaded = loadPrepRewrite(BASIC, "A");
    expect(loaded.status).toBe("ok");
    const session = phase0Prep.find((s) => s.week === "A");
    const knownIds = new Set(baseIngredients.map((i) => i.id));
    const result = applyPrepRewrite(session, loaded.data, knownIds);
    expect(result.status).toBe("ok");
    expect(result.session.rev).toBe("B");
    const slaw = result.session.ops.find((o) => o.title.startsWith("Shred for two slaws"));
    expect(slaw.ingredients).toEqual([
      { ingId: "red_cabbage", g: 515 },
      { ingId: "carrot", g: 230 },
    ]);
    const chickenYield = result.session.yields.find((y) => y.component === "Roast chicken");
    expect(chickenYield.note).toMatch(/25 g headroom/);
  });

  it("rejects a prep rewrite whose week field doesn't match the filename", () => {
    const loaded = loadPrepRewrite(INVALID, "A"); // fixtures/invalid/prep-a.json has week:"B"
    expect(loaded.status).toBe("invalid");
    expect(loaded.message).toMatch(/week/);
  });

  it("rejects (status invalid) a schema-valid prep rewrite that references an unknown ingredient id", () => {
    const loaded = loadPrepRewrite(INVALID, "B"); // fixtures/invalid/prep-b.json
    expect(loaded.status).toBe("ok");
    const session = { week: "B", sessionName: "x", totalMin: 0, ops: [], yields: [], midweek: [], rev: "A", approved: false };
    const result = applyPrepRewrite(session, loaded.data, new Set(baseIngredients.map((i) => i.id)));
    expect(result.status).toBe("invalid");
    expect(result.message).toMatch(/totally_unknown_ingredient_id/);
  });
});

// ---------------------------------------------------------------------------
// tools/extract/approvals.json
// ---------------------------------------------------------------------------

describe("loadApprovals / batchApprovalMap", () => {
  it("loads the fixture approvals.json and maps a1's meals+session to approved:true, other batches to false", () => {
    const approvals = loadApprovals(path.join(BASIC, "approvals.json"));
    const map = batchApprovalMap(approvals);
    expect(map.get("a-d1b")).toBe(true);
    expect(map.get("a-d1d")).toBe(true);
    expect(map.get("prep-a")).toBe(true);
    expect(map.get("a-d4b")).toBe(false);
    expect(map.get("b-d1b")).toBe(false);
  });

  it("returns null / an empty map when approvals.json does not exist", () => {
    const approvals = loadApprovals(path.join(EMPTY, "approvals.json"));
    expect(approvals).toBeNull();
    expect(batchApprovalMap(approvals).size).toBe(0);
  });

  it("throws a clear, file-naming error for a malformed approvals.json (missing batch keys)", () => {
    const tmp = path.join(FIXTURES, "_tmp-bad-approvals.json");
    fs.writeFileSync(tmp, JSON.stringify({ a1: { approved: false, mealIds: [], sessionIds: [] } }));
    try {
      expect(() => loadApprovals(tmp)).toThrow(/failed validation/);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it("the REAL tools/extract/approvals.json validates and covers all 40 meals + both prep sessions with zero overlap", () => {
    const approvals = loadApprovals(path.join(ROOT, "tools", "extract", "approvals.json"));
    expect(approvals).toBeTruthy();
    const allMealIds = Object.values(approvals).flatMap((b) => b.mealIds);
    expect(allMealIds.length).toBe(40);
    expect(new Set(allMealIds).size).toBe(40); // no meal in two batches
    expect(new Set(allMealIds)).toEqual(new Set(phase0Meals.map((m) => m.id)));
    const allSessionIds = Object.values(approvals).flatMap((b) => b.sessionIds);
    expect(allSessionIds.sort()).toEqual(["prep-a", "prep-b"]);
  });
});

// ---------------------------------------------------------------------------
// End-to-end overlay integration — mirrors join.js's Phase 1 block exactly,
// against the fixture set, without touching data/rewrites/ or data/*.json.
// ---------------------------------------------------------------------------

describe("end-to-end overlay integration (fixtures only)", () => {
  it("produces rev B + approved true for a1-batch meals with valid rewrites, flows freebies to ingredients.json, and leaves every other meal exactly Phase 0", () => {
    // 1. content-pass ingredients
    const { entries } = loadContentPassIngredients(BASIC);
    const { merged, conflicts, collisions } = mergeContentPassIngredients(entries, phase0IngredientIds);
    expect(conflicts).toEqual([]);
    expect(collisions).toEqual([]);
    let ingredients = [...baseIngredients, ...merged];
    let ingredientsById = new Map(ingredients.map((i) => [i.id, i]));

    // 2. meal rewrites
    const freebieIdsFromMeals = new Set();
    let meals = phase0Meals.map((meal) => {
      const loaded = loadMealRewrite(BASIC, meal.id);
      if (loaded.status !== "ok") return meal;
      const result = applyMealRewrite(meal, loaded.data, ingredientsById);
      if (result.status !== "ok") return meal;
      for (const id of result.freebies) freebieIdsFromMeals.add(id);
      return result.meal;
    });

    // 3. freebie flip (base or content-pass records)
    ingredients = ingredients.map((ing) => (freebieIdsFromMeals.has(ing.id) ? { ...ing, freebie: true } : ing));
    ingredientsById = new Map(ingredients.map((i) => [i.id, i]));

    // 4. approvals
    const approvals = loadApprovals(path.join(BASIC, "approvals.json"));
    const approvalMap = batchApprovalMap(approvals);
    meals = meals.map((m) => {
      const approved = m.method.rev === "B" && (approvalMap.get(m.id) ?? false);
      return { ...m, method: { ...m.method, approved } };
    });

    const a1b = meals.find((m) => m.id === "a-d1b");
    expect(a1b.method.rev).toBe("B");
    expect(a1b.method.approved).toBe(true); // a1 batch, approved:true in the fixture

    const a1d = meals.find((m) => m.id === "a-d1d");
    expect(a1d.method.rev).toBe("B");
    expect(a1d.method.approved).toBe(true);

    // A meal with no matching fixture rewrite (a-d4b isn't in tools/extract/
    // fixtures/basic/) must pass through byte-for-byte unchanged from
    // whatever phase0Meals already held for it — this proves pass-through
    // fidelity itself, deliberately NOT asserting a specific rev value:
    // data/meals.json may already carry REAL Phase 1 overlay content from a
    // concurrent `npm run extract` run (the two rewriter agents write
    // directly to data/rewrites/, which this fixture-only test never reads),
    // so "untouched" means "identical to its own prior state", not "rev A".
    // a-d4b is chosen specifically because it's in batch a2, which THIS
    // fixture's approvals.json also marks unapproved — so step 4's approval
    // recompute is a no-op for it regardless of whatever rev it already
    // carries, keeping the comparison clean (a-d1b/a-d1d/a-d1l's own batch,
    // a1, IS approved in this fixture, so they're deliberately excluded from
    // this "nothing at all changes" check — see the two assertions above).
    const before = phase0Meals.find((m) => m.id === "a-d4b");
    const untouched = meals.find((m) => m.id === "a-d4b");
    expect(untouched).toEqual(before);

    // freebies flowed through to ingredients.json
    expect(ingredients.find((i) => i.id === "salt").freebie).toBe(true);
    expect(ingredients.find((i) => i.id === "black_pepper").freebie).toBe(true);
    // a pre-existing ingredient never referenced as a freebie stays untouched
    expect(ingredients.find((i) => i.id === "egg").freebie).toBe(false);
    // the content-pass, non-freebie seasoning stays freebie:false
    expect(ingredients.find((i) => i.id === "oregano_dried").freebie).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation — against tools/extract/fixtures/empty/ (deliberately
// empty, unlike data/rewrites/ which the real rewriter agents populate):
// every loader must report "missing"/empty/null, never an error, proving
// the "zero rewrite files = Phase 0 output exactly" guarantee mechanically,
// independent of whatever real content currently exists on disk.
// ---------------------------------------------------------------------------

describe("graceful degradation with zero rewrite files", () => {
  it("every loader reports missing/empty/null against an empty directory — nothing throws", () => {
    for (const m of phase0Meals.slice(0, 5)) {
      expect(loadMealRewrite(EMPTY, m.id).status).toBe("missing");
    }
    expect(loadPrepRewrite(EMPTY, "A").status).toBe("missing");
    expect(loadPrepRewrite(EMPTY, "B").status).toBe("missing");
    const { entries, invalid } = loadContentPassIngredients(EMPTY);
    expect(entries).toEqual([]);
    expect(invalid).toEqual([]);
    expect(loadApprovals(path.join(EMPTY, "approvals.json"))).toBeNull();
    expect(loadOwnerRulings(path.join(EMPTY, "owner-rulings.json"))).toBeNull();
  });
});
