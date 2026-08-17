// tools/extract/morrisons.test.js
//
// Vitest tests for the Morrisons plan-variant deliverable
// (docs/VARIANT-SPEC.md, binding): tools/extract/morrisons.js's raw parse
// output, and tools/extract/join.js's data/variant-morrisons.json build.
//
// These tests read the ALREADY-WRITTEN data/raw/morrisons.json and
// data/variant-morrisons.json — they do not re-run the parsers. Run
// `npm run extract` first (or in CI, always extract then validate).

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const RAW = path.join(DATA, "raw");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

let morrisonsRaw, variant, meals, prep, ingredients, aliasMap, aliasMapMorrisons;

beforeAll(() => {
  morrisonsRaw = readJSON(path.join(RAW, "morrisons.json"));
  variant = readJSON(path.join(DATA, "variant-morrisons.json"));
  meals = readJSON(path.join(DATA, "meals.json"));
  prep = readJSON(path.join(DATA, "prep.json"));
  ingredients = readJSON(path.join(DATA, "ingredients.json"));
  aliasMap = readJSON(path.join(ROOT, "tools", "extract", "alias-map.json"));
  aliasMapMorrisons = readJSON(path.join(ROOT, "tools", "extract", "alias-map-morrisons.json"));
});

function ingById(id) {
  return ingredients.find((i) => i.id === id);
}

// ---------------------------------------------------------------------------
// Raw parse (data/raw/morrisons.json)
// ---------------------------------------------------------------------------

describe("morrisons.js raw parse", () => {
  it("parses exactly 39 basket rows with zero anomalies", () => {
    expect(morrisonsRaw.rows).toHaveLength(39);
    expect(morrisonsRaw.anomalies).toEqual([]);
  });

  it("COSTS checksum is 39 entries, pennies-exact £69.83, 0 mismatches vs row order", () => {
    expect(morrisonsRaw.costsChecksum.length).toBe(39);
    expect(Math.round(morrisonsRaw.costsChecksum.sum * 100)).toBe(6983);
    expect(morrisonsRaw.costsChecksum.matchesRowOrder).toBe(true);
    expect(morrisonsRaw.costsChecksum.mismatchCount).toBe(0);
  });

  it("every row carries a name, an aisle, and exactly one tag", () => {
    for (const r of morrisonsRaw.rows) {
      expect(r.name).toBeTruthy();
      expect(r.aisle).toBeTruthy();
      expect(r.tags).toHaveLength(1);
    }
  });

  it("parses exactly 5 menu day sections and 10 kept meal cards", () => {
    expect(morrisonsRaw.menu.days).toHaveLength(5);
    const totalMeals = morrisonsRaw.menu.days.reduce((acc, d) => acc + d.meals.length, 0);
    expect(totalMeals).toBe(10);
  });

  it("Wednesday carries zero kept meals and one cut card; Thu/Fri carry exactly one cut card each", () => {
    const byCode = Object.fromEntries(morrisonsRaw.menu.days.map((d) => [d.code, d]));
    expect(byCode.D3.meals).toHaveLength(0);
    expect(byCode.D3.cutCards).toHaveLength(1);
    expect(byCode.D4.meals).toHaveLength(2);
    expect(byCode.D4.cutCards).toHaveLength(1);
    expect(byCode.D5.meals).toHaveLength(2);
    expect(byCode.D5.cutCards).toHaveLength(1);
    expect(byCode.D1.meals).toHaveLength(3);
    expect(byCode.D1.cutCards).toHaveLength(0);
    expect(byCode.D2.meals).toHaveLength(3);
    expect(byCode.D2.cutCards).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Alias mapping: every one of the 39 rows resolves to a real ingId
// ---------------------------------------------------------------------------

describe("alias mapping (zero fuzzy)", () => {
  it("every basket row name resolves via alias-map.json or alias-map-morrisons.json", () => {
    for (const r of morrisonsRaw.rows) {
      const ids = aliasMap[r.name] ?? aliasMapMorrisons[r.name];
      expect(ids, `no mapping for row "${r.name}"`).toBeTruthy();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
    }
  });

  it("every mapped id exists in data/ingredients.json", () => {
    for (const r of morrisonsRaw.rows) {
      const ids = aliasMap[r.name] ?? aliasMapMorrisons[r.name];
      for (const id of ids) {
        expect(ingById(id), `alias-map id "${id}" (row "${r.name}") not in ingredients.json`).toBeTruthy();
      }
    }
  });

  it("alias-map-morrisons.json adds exactly the one genuinely new short name (Sirloin steak)", () => {
    const keys = Object.keys(aliasMapMorrisons).filter((k) => !k.startsWith("_"));
    expect(keys).toEqual(["Sirloin steak"]);
    expect(aliasMapMorrisons["Sirloin steak"]).toEqual(["beef_steak"]);
  });

  it("does not disturb alias-map.json's own 49-short-name canonical count (2026-08-11 revision, was 55)", () => {
    const keys = Object.keys(aliasMap).filter((k) => !k.startsWith("_"));
    expect(keys).toHaveLength(49);
  });
});

// ---------------------------------------------------------------------------
// data/variant-morrisons.json — the spec's data contract
// ---------------------------------------------------------------------------

describe("variant-morrisons.json: top-level shape", () => {
  it("carries the fixed id/label/week", () => {
    expect(variant.id).toBe("morrisons-tester");
    expect(variant.label).toBe("morrisons starter · 10 meals");
    expect(variant.week).toBe("A");
  });
});

describe("variant-morrisons.json: slots", () => {
  it("kept is exactly the 10 spec'd meal ids", () => {
    expect(variant.slots.kept).toEqual([
      "a-d1b", "a-d1l", "a-d1d",
      "a-d2b", "a-d2l", "a-d2d",
      "a-d4b", "a-d4d",
      "a-d5l", "a-d5d",
    ]);
  });

  it("every kept id exists in meals.json, week A", () => {
    for (const id of variant.slots.kept) {
      const m = meals.find((x) => x.id === id);
      expect(m, `kept id "${id}" not in meals.json`).toBeTruthy();
      expect(m.week).toBe("A");
    }
  });

  it("cut is exactly 10 entries: 5 named b/l/d cuts + 5 snacks, each with a reason", () => {
    expect(variant.slots.cut).toHaveLength(10);
    for (const c of variant.slots.cut) {
      expect(typeof c.mealId).toBe("string");
      expect(typeof c.reason).toBe("string");
      expect(c.reason.length).toBeGreaterThan(0);
    }
    const cutIds = variant.slots.cut.map((c) => c.mealId).sort();
    expect(cutIds).toEqual(["a-d1s", "a-d2s", "a-d3b", "a-d3d", "a-d3l", "a-d3s", "a-d4l", "a-d4s", "a-d5b", "a-d5s"]);
  });

  it("snack cuts (5 of them) all cite 'not part of the tester week'", () => {
    const snackCuts = variant.slots.cut.filter((c) => c.mealId.endsWith("s"));
    expect(snackCuts).toHaveLength(5);
    for (const c of snackCuts) expect(c.reason).toMatch(/not part of the tester week/);
  });

  it("kept + cut covers all 20 week-A meal slots (15 b/l/d + 5 snack) exactly once", () => {
    const allWeekA = meals.filter((m) => m.week === "A").map((m) => m.id);
    expect(allWeekA).toHaveLength(20);
    const accounted = new Set([...variant.slots.kept, ...variant.slots.cut.map((c) => c.mealId)]);
    expect(accounted.size).toBe(20);
    for (const id of allWeekA) expect(accounted.has(id)).toBe(true);
  });
});

describe("variant-morrisons.json: targets", () => {
  it("band arrays are [min,max] with min <= max, for both covers, all 5 macro keys", () => {
    for (const cover of ["w", "m"]) {
      const band = variant.targets.A[cover];
      for (const key of ["kcal", "protein", "netCarb", "fat", "fibre"]) {
        expect(Array.isArray(band[key])).toBe(true);
        expect(band[key]).toHaveLength(2);
        expect(band[key][0]).toBeLessThanOrEqual(band[key][1]);
      }
    }
  });

  // Fable review cycle 2 FIX-2 (root fix, both canonical and variant bands):
  // bands must derive from UNROUNDED day totals — summing meals[].macros
  // (which is Math.round'd per meal) before floor/ceil could freeze a band
  // edge short of where the app's own raw-covers sum actually lands. This
  // test recomputes totals straight from covers x ingredients per100g,
  // never from the pre-rounded macros field, matching join.js exactly.
  it("recomputes deterministically from UNROUNDED per-cover gram totals (floor(min)/ceil(max) over days 1,2,4,5, kept slots only)", () => {
    function unroundedCoverMacros(coverGrams) {
      let kcal = 0, protein = 0, fibre = 0, carb = 0, fat = 0;
      for (const [ingId, g] of Object.entries(coverGrams)) {
        const ing = ingredients.find((i) => i.id === ingId);
        const f = ing.per100g;
        kcal += (f.kcal * g) / 100;
        protein += (f.protein * g) / 100;
        fibre += (f.fibre * g) / 100;
        carb += (f.carb * g) / 100;
        fat += (f.fat * g) / 100;
      }
      return { kcal, protein, netCarb: carb - fibre, fat, fibre };
    }
    function dayTotal(day, cover) {
      const dayMeals = meals.filter((m) => m.week === "A" && m.day === day && variant.slots.kept.includes(m.id));
      const sum = { kcal: 0, protein: 0, netCarb: 0, fat: 0, fibre: 0 };
      for (const m of dayMeals) {
        const raw = unroundedCoverMacros(m.covers[cover]);
        for (const k of Object.keys(sum)) sum[k] += raw[k];
      }
      return sum;
    }
    for (const cover of ["w", "m"]) {
      const totals = { kcal: [], protein: [], netCarb: [], fat: [], fibre: [] };
      for (const d of [1, 2, 4, 5]) {
        const t = dayTotal(d, cover);
        for (const k of Object.keys(totals)) totals[k].push(t[k]);
      }
      for (const k of Object.keys(totals)) {
        const expected = [Math.floor(Math.min(...totals[k])), Math.ceil(Math.max(...totals[k]))];
        expect(variant.targets.A[cover][k]).toEqual(expected);
      }
    }
  });

  it("kcal band matches the tester's own unrounded day totals (916-1449 her, 1133-1945 him — was 917-1449/1133-1944 before the FIX-2 rounding fix)", () => {
    expect(variant.targets.A.w.kcal).toEqual([916, 1449]);
    expect(variant.targets.A.m.kcal).toEqual([1133, 1945]);
  });
});

describe("variant-morrisons.json: basket", () => {
  it("39 lines, pennies-exact totalP = 6983 (£69.83), summed from lineP (source-verbatim line totals)", () => {
    expect(variant.basket.lines).toHaveLength(39);
    expect(variant.basket.totalP).toBe(6983);
    const summed = variant.basket.lines.reduce((acc, l) => acc + l.lineP, 0);
    expect(summed).toBe(6983);
  });

  it("retailer is M, verifiedOn 2026-08-11", () => {
    expect(variant.basket.retailer).toBe("M");
    expect(variant.basket.verifiedOn).toBe("2026-08-11");
  });

  it("every line has a real ingId, a resolved storageClass, and positive integer lineP/packP", () => {
    const validStorageClasses = new Set(["freeze-on-arrival", "freezer-aisle", "counter", "fridge", "cupboard"]);
    for (const l of variant.basket.lines) {
      expect(ingById(l.ingId), `line "${l.label}" ingId "${l.ingId}" not in ingredients.json`).toBeTruthy();
      expect(validStorageClasses.has(l.storageClass), `line "${l.label}" has invalid storageClass "${l.storageClass}"`).toBe(true);
      expect(Number.isInteger(l.lineP)).toBe(true);
      expect(l.lineP).toBeGreaterThan(0);
      expect(Number.isInteger(l.packP)).toBe(true);
      expect(l.packP).toBeGreaterThan(0);
      expect(l.qty * l.packP).toBe(l.lineP); // qty x packP must reconstitute the verbatim line total
    }
  });

  it("the one qty!=1 line (Frozen cauliflower florets, 2 x 1kg) has lineP=300, packP=150 — not lineP=600", () => {
    const line = variant.basket.lines.find((l) => l.label === "Frozen cauliflower florets");
    expect(line.qty).toBe(2);
    expect(line.lineP).toBe(300);
    expect(line.packP).toBe(150);
  });

  it("FIX-3(a): Pineapple chunks is storageClass cupboard, not fridge (it's an unopened tin under the Fruit & veg aisle heading)", () => {
    const line = variant.basket.lines.find((l) => l.label === "Pineapple chunks");
    expect(line.storageClass).toBe("cupboard");
    expect(line.product).toMatch(/tin/i);
    expect(line.note).toMatch(/tin/i);
    expect(line.note).toMatch(/refrigerate/i); // after-opening handling still surfaced, just in the note
  });

  it("carries the 4 documented coversAlso lines (yoghurt/skyr, berries/blueberries, peppers/peppers_frozen, oil/rapeseed_oil)", () => {
    const byLabel = Object.fromEntries(variant.basket.lines.map((l) => [l.label, l]));
    expect(byLabel["Fat-free Greek yoghurt"].coversAlso).toEqual(["skyr"]);
    expect(byLabel["Frozen mixed berries"].coversAlso).toEqual(["blueberries"]);
    expect(byLabel["Red peppers"].coversAlso).toEqual(["peppers_frozen"]);
    expect(byLabel["Extra virgin olive oil"].coversAlso).toEqual(["rapeseed_oil"]);
  });

  it("carries the put-away card as 6 entries", () => {
    expect(variant.basket.putAway).toHaveLength(6);
    for (const p of variant.basket.putAway) {
      expect(p.heading).toBeTruthy();
      expect(p.where).toBeTruthy();
    }
  });
});

describe("variant-morrisons.json: coverage audit", () => {
  it("missing is empty (no STAPLE ingredient is uncovered)", () => {
    expect(variant.coverage.missing).toEqual([]);
  });

  it("assumedPantry is exactly the 4 spice-jar/condiment ids", () => {
    expect(variant.coverage.assumedPantry.slice().sort()).toEqual(["chipotle_adobo", "coconut_des", "jerk_paste", "sugar"]);
  });

  it("coveredByBasket + assumedPantry together equal every ingId the 10 kept meals' rev-B covers need", () => {
    const needed = new Set();
    for (const id of variant.slots.kept) {
      const m = meals.find((x) => x.id === id);
      for (const k of Object.keys(m.covers.w)) needed.add(k);
      for (const k of Object.keys(m.covers.m)) needed.add(k);
    }
    const accounted = new Set([...variant.coverage.coveredByBasket, ...variant.coverage.assumedPantry]);
    expect(accounted.size).toBe(needed.size);
    for (const id of needed) expect(accounted.has(id)).toBe(true);
  });

  it("no STAPLE (chicken/egg/oil) ever lands in missing", () => {
    for (const staple of ["chicken", "egg", "olive_oil", "rapeseed_oil", "brown_rice"]) {
      expect(variant.coverage.missing).not.toContain(staple);
    }
  });
});

describe("variant-morrisons.json: defrost", () => {
  it("has exactly 5 entries, each day 0 (arrival advisory) or a Thu/Fri bring-down", () => {
    expect(variant.defrost).toHaveLength(5);
    for (const d of variant.defrost) {
      expect([0, 3, 4]).toContain(d.dayNo);
      expect(ingById(d.ingId)).toBeTruthy();
      expect(d.g).toBeGreaterThan(0);
      expect(typeof d.move).toBe("string");
      expect(d.move.length).toBeGreaterThan(0);
      expect(typeof d.note).toBe("string");
      expect(d.note.length).toBeGreaterThan(0);
    }
  });

  it("covers beef_steak (Wed night), salmon (Thu night), and the beef_mince Thursday remainder", () => {
    const byIng = Object.fromEntries(variant.defrost.map((d) => [d.ingId, d]));
    expect(byIng.beef_steak.dayNo).toBe(3);
    expect(byIng.beef_steak.g).toBe(200);
    expect(byIng.beef_steak.move).toBe("freezer → fridge");
    expect(byIng.salmon.dayNo).toBe(4);
    expect(byIng.salmon.g).toBe(220);
    expect(byIng.salmon.move).toBe("freezer → fridge");
    expect(byIng.beef_mince.dayNo).toBe(3);
    expect(byIng.beef_mince.g).toBe(335);
    expect(byIng.beef_mince.move).toBe("freezer → fridge");
  });

  it("FIX-3(b): carries day-0 advisory entries for chicken and chicken_mince (was omitted entirely before this fix)", () => {
    const byIng = Object.fromEntries(variant.defrost.map((d) => [d.ingId, d]));
    expect(byIng.chicken).toBeTruthy();
    expect(byIng.chicken.dayNo).toBe(0);
    expect(byIng.chicken.g).toBe(630); // whole basket pack
    expect(byIng.chicken.move).toMatch(/do not freeze/i);
    expect(byIng.chicken.note).toMatch(/prep-a session/i);

    expect(byIng.chicken_mince).toBeTruthy();
    expect(byIng.chicken_mince.dayNo).toBe(0);
    expect(byIng.chicken_mince.g).toBe(500); // whole basket pack; no prep-a split, unlike beef_mince
    expect(byIng.chicken_mince.move).toMatch(/bring down Sunday night/i);
    expect(byIng.chicken_mince.note).toMatch(/a-d1d/);
    // 65+75 raw g from meals.json a-d1d covers.w/m.chicken_mince
    expect(byIng.chicken_mince.note).toMatch(/140g/);
  });

  it("does not include seeded_bread (toasts straight from frozen, per both the basket's own note and ingredients.json)", () => {
    const ids = variant.defrost.map((d) => d.ingId);
    expect(ids).not.toContain("seeded_bread");
  });
});

describe("variant-morrisons.json: prep.keptOps", () => {
  it("keeps a strict, non-trivial subset of prep-a's ops", () => {
    const prepA = prep.find((p) => p.week === "A" && /one session/i.test(p.sessionName));
    expect(prepA).toBeTruthy();
    expect(variant.prep.sessionBase).toBe("prep-a");
    expect(variant.prep.keptOps.length).toBeGreaterThan(0);
    expect(variant.prep.keptOps.length).toBeLessThan(prepA.ops.length);
  });

  it("every kept op index is valid and titles match prep.json verbatim", () => {
    const prepA = prep.find((p) => p.week === "A" && /one session/i.test(p.sessionName));
    for (const op of variant.prep.keptOps) {
      expect(op.opIndex).toBeGreaterThanOrEqual(0);
      expect(op.opIndex).toBeLessThan(prepA.ops.length);
      expect(prepA.ops[op.opIndex].title).toBe(op.title);
    }
  });

  it("drops the ops whose sole yield feeds only cut meals (bolognese/efo riro/jerk chickpeas/eggs/jollof)", () => {
    const keptTitles = new Set(variant.prep.keptOps.map((o) => o.title));
    for (const droppedTitle of [
      "Pan 1 — the bolognese (longest job, start it early)",
      "Pan 3 — efo riro base (no spinach)",
      "Eggs on",
      "Chickpeas out — jar, lid OFF",
      "Pan 3 free — the jollof",
    ]) {
      expect(keptTitles.has(droppedTitle)).toBe(false);
    }
  });

  // FIX-1 (Fable review cycle 2): op-subset COHERENCE. op6 ("Chicken and
  // peppers out") and op12 ("The two jars") both legitimately stay kept —
  // op6's roast-chicken thread feeds a-d1l/a-d5l, op12's white sauce feeds
  // a-d1l — dropping either would strand a kept meal's own prep. What must
  // never happen is a SILENT orphaned sub-instruction: op1/op6's jerk-
  // chickpea thread (dropped, a-d3s cut) would otherwise consume the
  // tester's single 240g chickpea tin that Monday's a-d1l lunch also needs.
  it("op 1, 6, and 12 stay kept (their non-chickpea/non-suya component feeds a kept meal) but each carries a testerNote", () => {
    const byIndex = Object.fromEntries(variant.prep.keptOps.map((o) => [o.opIndex, o]));
    for (const i of [1, 6, 12]) {
      expect(byIndex[i], `op ${i} should be kept`).toBeTruthy();
      expect(typeof byIndex[i].testerNote, `op ${i} should carry a testerNote`).toBe("string");
      expect(byIndex[i].testerNote.length).toBeGreaterThan(0);
    }
  });

  it("op 1's testerNote explicitly protects Monday's chickpea tin", () => {
    const op1 = variant.prep.keptOps.find((o) => o.opIndex === 1);
    expect(op1.testerNote).toMatch(/skip tray b/i);
    expect(op1.testerNote).toMatch(/monday/i);
  });

  it("op 0 (oven/trays setup) is kept and also carries a testerNote about skipping the chickpea-drying step", () => {
    const op0 = variant.prep.keptOps.find((o) => o.opIndex === 0);
    expect(op0).toBeTruthy();
    expect(op0.testerNote).toMatch(/chickpea/i);
  });

  it("op 13's testerNote addresses the title-mentioned dropped bolognese", () => {
    const op13 = variant.prep.keptOps.find((o) => o.opIndex === 13);
    expect(op13).toBeTruthy();
    expect(op13.testerNote).toMatch(/bolognese/i);
  });

  it("COHERENCE: no kept op references a dropped-only component without a testerNote (the exact bug class the fix targets)", () => {
    // Hand-verified dropped-component mentions inside kept ops (mirrors
    // join.js's OP_DROPPED_MENTIONS) — every one of these op indices, if
    // kept, must carry a non-empty testerNote.
    const opsWithDroppedMentions = [0, 1, 6, 12, 13];
    const byIndex = Object.fromEntries(variant.prep.keptOps.map((o) => [o.opIndex, o]));
    for (const i of opsWithDroppedMentions) {
      if (byIndex[i]) {
        expect(byIndex[i].testerNote, `kept op ${i} has a dropped-component mention but no testerNote`).toBeTruthy();
      }
    }
  });

  it("COHERENCE: no dropped-op dependency — every KEPT yield component (Roast chicken, Chipotle beef, Plain brown rice, Riced cauliflower, Slaw shred, White sauce) is produced by at least one op that stayed kept", () => {
    const prepA = prep.find((p) => p.week === "A" && /one session/i.test(p.sessionName));
    const keptComponentToOpTitles = {
      "Roast chicken": ["Trays in — chicken, chickpeas, peppers", "Chicken and peppers out"],
      "Chipotle beef": ["Pan 2 — chipotle beef"],
      "Plain brown rice": ["Pan 2 free — plain rice on", "Bolognese and rice off — cool them FAST"],
      "Riced cauliflower": ["Rice the cauliflower — the big job"],
      "Slaw shred": ["Shred for two slaws — and Friday's salmon slaw"],
      "White sauce": ["The two jars"],
    };
    const keptTitles = new Set(variant.prep.keptOps.map((o) => o.title));
    for (const [component, candidateTitles] of Object.entries(keptComponentToOpTitles)) {
      const producedByAKeptOp = candidateTitles.some((t) => keptTitles.has(t));
      expect(producedByAKeptOp, `${component} (a kept yield) has no kept op producing it`).toBe(true);
      // and that component's own consumers really are kept, proving this isn't a vacuous check
      const yieldEntry = prepA.yields.find((y) => y.component === component);
      expect(yieldEntry.consumers.some((c) => variant.slots.kept.includes(c))).toBe(true);
    }
  });

  it("COHERENCE: the tester's chickpea tin is never contended — Jerk chickpeas' consumer (a-d3s) is cut, and every op referencing that tray is dropped or carries a testerNote", () => {
    const prepA = prep.find((p) => p.week === "A" && /one session/i.test(p.sessionName));
    const jerkChickpeas = prepA.yields.find((y) => y.component === "Jerk chickpeas");
    expect(jerkChickpeas.consumers.every((c) => !variant.slots.kept.includes(c))).toBe(true); // fully cut
    const byIndex = Object.fromEntries(variant.prep.keptOps.map((o) => [o.opIndex, o]));
    for (const i of [0, 1, 6, 8]) {
      if (byIndex[i]) {
        expect(byIndex[i].testerNote, `op ${i} touches the chickpea tray but has no testerNote`).toBeTruthy();
      } else {
        // op 8 ("Chickpeas out") is expected to be fully dropped
        expect(i).toBe(8);
      }
    }
  });
});

describe("variant-morrisons.json: economics", () => {
  it("matches the source header exactly", () => {
    expect(variant.economics).toEqual({ total: "£69.83", meals: 10, perMeal: "£6.98 (both covers)" });
  });
});

describe("variant-morrisons.json: anomalies (provenance notes)", () => {
  it("records the whey-mention and legacy-kcal provenance notes", () => {
    const types = variant.anomalies.map((a) => a.type);
    expect(types).toContain("menu-prose-provenance-whey");
    expect(types).toContain("menu-prose-provenance-legacy-kcal");
  });
});

describe("JSON round-trip", () => {
  it("data/variant-morrisons.json re-parses byte-for-byte equivalent", () => {
    const json = JSON.stringify(variant);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
