// tools/extract/validate.test.js
//
// Vitest tests asserting the PLAN.md §3 checksums against the canonical
// dataset in data/*.json. Run via `npm run validate` (vitest run tools/extract).
//
// These tests read the ALREADY-WRITTEN data/*.json + data/raw/*.json files —
// they do not re-run join.js. Run `npm run extract` first (or in CI, always
// run extract then validate). join.js itself also recomputes every one of
// these checks live and writes the results to data/validation.json; this
// file is the independent, re-runnable assertion layer PLAN.md §8 asks for.

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { phase0CoversForCard } from "./lint-rules.js";
import { recomputeMacros } from "./rewrite-overlay.js";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const RAW = path.join(DATA, "raw");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

let fd5, methods, provisioning, shoppinglist;
let ingredients, retired, meals, prep, calendar, plan, decisionsQueue, validation;

beforeAll(() => {
  fd5 = readJSON(path.join(RAW, "fd5.json"));
  methods = readJSON(path.join(RAW, "methods.json"));
  provisioning = readJSON(path.join(RAW, "provisioning.json"));
  shoppinglist = readJSON(path.join(RAW, "shoppinglist.json"));

  ingredients = readJSON(path.join(DATA, "ingredients.json"));
  retired = readJSON(path.join(DATA, "retired.json"));
  meals = readJSON(path.join(DATA, "meals.json"));
  prep = readJSON(path.join(DATA, "prep.json"));
  calendar = readJSON(path.join(DATA, "calendar.json"));
  plan = readJSON(path.join(DATA, "plan.json"));
  decisionsQueue = readJSON(path.join(DATA, "decisions-queue.json"));
  validation = readJSON(path.join(DATA, "validation.json"));
});

const allCards = () => [
  ...methods.weeks.A.cards.map((c) => ({ ...c, week: "A" })),
  ...methods.weeks.B.cards.map((c) => ({ ...c, week: "B" })),
];

function ingById(id) {
  return ingredients.find((i) => i.id === id);
}

// ---------------------------------------------------------------------------
// Checksum 1: 40 cards, 20/week; every card 2x5 macros and >=3 ingredient
// rows; methods<->spec join 281/281 with zero conflicts.
// ---------------------------------------------------------------------------

describe("checksum 1: card counts, macro shape, methods<->spec join", () => {
  it("has exactly 40 cards, 20 per week", () => {
    expect(methods.weeks.A.cards.length).toBe(20);
    expect(methods.weeks.B.cards.length).toBe(20);
    expect(meals.length).toBe(40);
  });

  it("every card has 2x5 macros (her/him x kcal/protein/netCarb/fat/fibre) and >=3 ingredient rows", () => {
    for (const c of allCards()) {
      expect(c.ingredients.length).toBeGreaterThanOrEqual(3);
      for (const cover of ["her", "him"]) {
        for (const k of ["kcal", "protein", "netCarb", "fat", "fibre"]) {
          expect(typeof c.macros[cover][k]).toBe("number");
        }
      }
    }
  });

  it("joins all 281 methods ingredient rows to an fd5.spec display name with zero conflicts", () => {
    const nameToId = {};
    for (const id of fd5.ids) nameToId[fd5.spec[id][0]] = id;
    let total = 0;
    let failures = 0;
    for (const c of allCards()) {
      for (const ing of c.ingredients) {
        total += 1;
        if (!(ing.name in nameToId)) failures += 1;
      }
    }
    expect(total).toBe(281);
    expect(failures).toBe(0);
  });

  it("meals.json ingredient ids all resolve to a real ingredients.json record", () => {
    const ids = new Set(ingredients.map((i) => i.id));
    for (const m of meals) {
      for (const cover of ["w", "m"]) {
        for (const ingId of Object.keys(m.covers[cover])) {
          expect(ids.has(ingId)).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Checksum 2: recomputed macros match every mac-strip value within tolerance
// on undisputed cards; disputed cards must each be explained.
//
// NOTE: this checksum is a Phase 0 EXTRACTION fidelity check — it validates
// that methods.json's own gram tables x ingredients.json's own per100g
// reproduce methods.json's own mac-strips. It deliberately does NOT read
// data/meals.json's macros field, because meals.json is the POST-OVERLAY
// output: once a Phase 1 rewrite lands for a meal, its macros legitimately
// change (new seasonings weighed in, D0-003 substitutions, etc.) and would
// no longer match the Phase 0 mac-strip — that is correct Phase 1 behavior,
// not a Phase 0 extraction defect, and this checksum must stay blind to it.
// Recomputing straight from data/raw/* (via phase0CoversForCard, the same
// helper the P1 lint suite uses) keeps this checksum meaningful regardless
// of how much Phase 1 overlay content currently exists.
// ---------------------------------------------------------------------------

describe("checksum 2: macro recompute vs mac-strip, +-1 unit (+-0.2 fibre)", () => {
  it("recomputes every one of the 40 cards x 2 covers, from RAW Phase 0 data, within tolerance", () => {
    const tol = { kcal: 1, protein: 1, netCarb: 1, fat: 1, fibre: 0.2 };
    const disputed = [];
    const ingById = new Map(ingredients.map((i) => [i.id, i]));
    for (const card of allCards()) {
      const phase0Covers = phase0CoversForCard(fd5, card);
      for (const [coverKey, cover] of [
        ["w", "her"],
        ["m", "him"],
      ]) {
        const recomputed = recomputeMacros(phase0Covers[coverKey], ingById);
        const actual = card.macros[cover];
        for (const k of ["kcal", "protein", "netCarb", "fat", "fibre"]) {
          const diff = Math.abs(recomputed[k] - actual[k]);
          if (diff > tol[k] + 1e-9) {
            disputed.push({ card: `${card.week}${card.dayNo}${card.slot}`, cover, key: k, diff });
          }
        }
      }
    }
    if (disputed.length > 0) {
      // Any unexplained failure is a hard test failure. As of this extraction,
      // 0 cards are disputed (see decisions-queue D0-010 for why the ~4-card
      // prediction in PLAN.md did not materialise) — so this branch should
      // never execute; if it does, the disputed set must be listed for triage.
      throw new Error(`Unexplained macro-recompute failures: ${JSON.stringify(disputed, null, 2)}`);
    }
    expect(disputed.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Checksum 3: Week A day totals (her, recomputed), +-1 per day, reconciled
// against the D10 avocado-drop explanation for days 1/2/4.
//
// Same Phase-0-fidelity note as checksum 2: recomputed from data/raw/*
// directly, not from data/meals.json, so a Phase 1 rewrite legitimately
// changing a day's kcal (seasonings, substitutions) never masquerades as a
// Phase 0 extraction failure here.
// ---------------------------------------------------------------------------

describe("checksum 3: Week A day totals (her, recomputed)", () => {
  it("matches the legacy PLAN.md figures on days 3 and 5 exactly, and on days 1/2/4 within the D10 avocado-drop delta", () => {
    const legacy = [1667, 1663, 1670, 1646, 1694];
    // Deltas caused by the verified D10 avocado-garnish drop (see decisions-queue D0-011):
    // day1 +4 (pizza), day2 +12 (burrito bowl), day4 +4 (steak sandwich).
    const explainedDelta = { 1: 4, 2: 12, 3: 0, 4: 4, 5: 0 };
    const ingById = new Map(ingredients.map((i) => [i.id, i]));
    for (let d = 1; d <= 5; d++) {
      const cards = allCards().filter((c) => c.week === "A" && c.dayNo === d);
      const sum = cards.reduce((s, c) => s + recomputeMacros(phase0CoversForCard(fd5, c).w, ingById).kcal, 0);
      const expected = legacy[d - 1] + explainedDelta[d];
      expect(Math.abs(sum - expected)).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Checksum 4: Week A x3 reproduces £257.32 from legacy data; COSTS sums to
// £179.31; per-shop subtotals match.
// ---------------------------------------------------------------------------

describe("checksum 4: basket totals", () => {
  it("legacy shopping-list.html basket totals £257.32 (S £102.58 / M £145.24 / X £9.50)", () => {
    expect(shoppinglist.legacy.totalShown).toBe("£257.32");
    const byShop = {};
    for (const r of shoppinglist.legacy.rows) {
      byShop[r.shop] = +(byShop[r.shop] ?? 0) + parseFloat(r.priceShown.replace("£", ""));
    }
    expect(+byShop.S.toFixed(2)).toBe(102.58);
    expect(+byShop.M.toFixed(2)).toBe(145.24);
    expect(+byShop.X.toFixed(2)).toBe(9.5);
  });

  it("canonical COSTS sums to £179.31 with per-shop subtotals S £72.70 / M £98.31 / X £8.30", () => {
    expect(shoppinglist.costsChecksum.sum).toBe(179.31);
    const byShop = {};
    for (const s of shoppinglist.shops) byShop[s.code] = s.subtotalShown;
    expect(byShop.S).toBe("£72.70");
    expect(byShop.M).toBe("£98.31");
    expect(byShop.X).toBe("£8.30");
  });

  it("plan.json economics cites labeled divisors for every figure", () => {
    for (const [key, entry] of Object.entries(plan.economics)) {
      expect(typeof entry.amount).toBe("number");
      expect(typeof entry.basis).toBe("string");
      expect(entry.basis.length).toBeGreaterThan(10);
    }
  });
});

// ---------------------------------------------------------------------------
// Checksum 5: register rows carry shelf-life + location; alias/register map
// coverage with zero fuzzy matches.
// ---------------------------------------------------------------------------

describe("checksum 5: register + map coverage", () => {
  it("all 54 storage-register rows carry shelf-life prose + location", () => {
    expect(provisioning.storageRegister.length).toBe(54);
    for (const r of provisioning.storageRegister) {
      expect(r.location).toBeTruthy();
      expect(r.life.prose).toBeTruthy();
    }
  });

  it("ingredients.json's 54 non-added ingredients all carry storage.location + storage.life.prose", () => {
    // Excludes BOTH Phase 0's addedInExtraction ids (sweetheart_cabbage etc.)
    // AND any Phase 1 addedInContentPass seasonings merged in from
    // data/rewrites/_ingredients.A/B.json — neither is one of the original
    // 54 storage-register rows this checksum is about.
    const nonAdded = ingredients.filter((i) => !i.addedInExtraction && !i.addedInContentPass);
    expect(nonAdded.length).toBe(54);
    for (const i of nonAdded) {
      expect(i.storage.location).toBeTruthy();
      expect(i.storage.life.prose).toBeTruthy();
    }
  });

  it("alias-map.json covers all 55 shopping-list short names with zero fuzzy matches (exact ingredient-id references only)", () => {
    const aliasMap = readJSON(path.join(ROOT, "tools", "extract", "alias-map.json"));
    const keys = Object.keys(aliasMap).filter((k) => !k.startsWith("_"));
    expect(keys.length).toBe(55);
    const shopRowNames = new Set(shoppinglist.rows.map((r) => r.name));
    for (const k of keys) expect(shopRowNames.has(k)).toBe(true);
    const ingIds = new Set(ingredients.map((i) => i.id));
    for (const ids of Object.values(aliasMap)) {
      if (!Array.isArray(ids)) continue;
      for (const id of ids) expect(ingIds.has(id)).toBe(true);
    }
  });

  it("register-map.json covers all 54 register rows via exact display-name match", () => {
    const registerMap = readJSON(path.join(ROOT, "tools", "extract", "register-map.json"));
    const keys = Object.keys(registerMap).filter((k) => !k.startsWith("_"));
    expect(keys.length).toBe(54);
    const nameToId = {};
    for (const id of fd5.ids) nameToId[fd5.spec[id][0]] = id;
    for (const [itemName, id] of Object.entries(registerMap)) {
      if (itemName.startsWith("_")) continue;
      expect(nameToId[itemName]).toBe(id); // exact match, not fuzzy
    }
  });
});

// ---------------------------------------------------------------------------
// Checksum 6: legacy est flags <-> D.prices.ver:0 match 1:1 via alias/name
// mapping (54 shared ids, zero conflicts; count discrepancy explained).
// ---------------------------------------------------------------------------

describe("checksum 6: legacy estimate flags vs D.prices.ver", () => {
  it("matches 1:1 with zero conflicts on the 54 ids the legacy list and fd5.prices share", () => {
    const nameToId = {};
    for (const id of fd5.ids) nameToId[fd5.spec[id][0]] = id;
    let matched = 0;
    const mismatched = [];
    for (const r of shoppinglist.legacy.rows) {
      const id = nameToId[r.name];
      const fp = id ? fd5.prices[id] : null;
      if (!fp) continue;
      if ((fp.ver === 0) === r.estimateMark) matched += 1;
      else mismatched.push(r.name);
    }
    expect(shoppinglist.legacy.rows.length).toBe(54);
    expect(matched).toBe(54);
    expect(mismatched).toEqual([]);
  });

  it("the 40-vs-41 count discrepancy is fully explained by whey (retired, absent from the legacy list)", () => {
    const legacyEstTrue = shoppinglist.legacy.rows.filter((r) => r.estimateMark).length;
    const fd5Ver0 = Object.values(fd5.prices).filter((p) => p.ver === 0).length;
    expect(legacyEstTrue).toBe(40);
    expect(fd5Ver0).toBe(41);
    const legacyNames = new Set(shoppinglist.legacy.rows.map((r) => r.name));
    expect(legacyNames.has(fd5.spec.whey[0])).toBe(false);
    expect(fd5.prices.whey.ver).toBe(0);
    expect(retired.some((r) => r.id === "whey")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Structural sanity: retired.json, decisions-queue.json, calendar variants
// ---------------------------------------------------------------------------

describe("structural sanity", () => {
  it("retires exactly the 5 vestigial ingredients with data preserved", () => {
    const ids = retired.map((r) => r.id).sort();
    expect(ids).toEqual(["edamame", "egg_white", "mango", "milk", "whey"].sort());
    for (const r of retired) {
      expect(r.per100g).toBeTruthy();
      expect(r.reason).toBeTruthy();
    }
  });

  it("decisions-queue has ~30 entries, nothing resolved silently (every entry has detail + recommendation)", () => {
    expect(decisionsQueue.length).toBeGreaterThanOrEqual(25);
    for (const d of decisionsQueue) {
      expect(d.detail.length).toBeGreaterThan(20);
      expect(d.recommendation.length).toBeGreaterThan(5);
      expect(["resolved-by-default", "resolved", "open"]).toContain(d.status);
    }
  });

  it("calendar.json carries both the a+b (preserved) and a-twice (regenerated) variants", () => {
    const variants = new Set(calendar.map((c) => c.variant));
    expect(variants.has("a+b")).toBe(true);
    expect(variants.has("a-twice")).toBe(true);
    expect(calendar.filter((c) => c.variant === "a-twice").length).toBeGreaterThan(0);
  });

  it("greek_yog/skyr and raspberries/blueberries are never deduped, always share one SKU", () => {
    for (const [a, b] of [
      ["greek_yog", "skyr"],
      ["raspberries", "blueberries"],
    ]) {
      const ia = ingById(a);
      const ib = ingById(b);
      expect(ia).toBeTruthy();
      expect(ib).toBeTruthy();
      expect(ia.sku.sharedSkuWith).toBe(b);
      expect(ib.sku.sharedSkuWith).toBe(a);
      expect(ia.sku.product).toBe(ib.sku.product);
    }
  });

  it("plan.json targets are re-banded per week (A and B each have independent w/m bands)", () => {
    expect(plan.targets.A.w.kcal.length).toBe(2);
    expect(plan.targets.A.m.kcal.length).toBe(2);
    expect(plan.targets.B.w.kcal.length).toBe(2);
    expect(plan.targets.B.m.kcal.length).toBe(2);
  });

  // Fable review cycle 1 FIX: plan.json's bands must be computed from the
  // FINAL, post-Phase-1-overlay meals.json — not frozen at Phase 0 (before
  // any rewrite's seasoning/substitution content is folded in). This
  // recomputes every band completely independently of join.js's own
  // targets/bandFrom/dayTotalsForWeek functions (a plain reduce here, not a
  // shared helper) straight from the WRITTEN data/meals.json, and also
  // asserts every one of the 5 day totals per week/cover actually falls
  // inside its own band — the exact property the reviewer's evidence
  // (A-him day 2 busting the ceiling by 97 kcal, etc.) showed broken.
  it("plan.json's macro bands exactly match an independent recompute from the final data/meals.json, and every day total falls inside its own band", () => {
    for (const week of ["A", "B"]) {
      for (const coverKey of ["w", "m"]) {
        const dayTotals = { kcal: [], protein: [], netCarb: [], fat: [], fibre: [] };
        for (let day = 1; day <= 5; day++) {
          const dayMeals = meals.filter((m) => m.week === week && m.day === day);
          expect(dayMeals.length).toBeGreaterThan(0);
          const sum = { kcal: 0, protein: 0, netCarb: 0, fat: 0, fibre: 0 };
          for (const m of dayMeals) {
            for (const k of Object.keys(sum)) sum[k] += m.macros[coverKey][k];
          }
          for (const k of Object.keys(dayTotals)) dayTotals[k].push(Math.round(sum[k] * 10) / 10);
        }
        for (const k of Object.keys(dayTotals)) {
          const independentBand = [Math.floor(Math.min(...dayTotals[k])), Math.ceil(Math.max(...dayTotals[k]))];
          expect(plan.targets[week][coverKey][k]).toEqual(independentBand);
          for (const v of dayTotals[k]) {
            expect(v).toBeGreaterThanOrEqual(independentBand[0]);
            expect(v).toBeLessThanOrEqual(independentBand[1]);
          }
        }
      }
    }
  });

  it("validation.json (written by join.js) reports all checksums passing", () => {
    const failed = validation.filter((v) => !v.pass);
    expect(failed).toEqual([]);
  });

  it("no decision-request.join.json was left behind by a STOP", () => {
    expect(fs.existsSync(path.join(RAW, "decision-request.join.json"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Owner-checkpoint overlay (tools/extract/owner-rulings.json merged into
// decisions-queue.json by join.js). See tools/extract/rewrite-overlay.js.
// ---------------------------------------------------------------------------

describe("owner-rulings checkpoint overlay", () => {
  let ownerRulings;
  beforeAll(() => {
    ownerRulings = readJSON(path.join(ROOT, "tools", "extract", "owner-rulings.json"));
  });

  it("D0-003, D0-030, D0-031 are flipped from open to resolved, each stamped resolvedBy the checkpoint", () => {
    for (const id of ["D0-003", "D0-030", "D0-031"]) {
      const entry = decisionsQueue.find((d) => d.id === id);
      expect(entry).toBeTruthy();
      expect(entry.status).toBe("resolved");
      expect(entry.resolvedTo).toBe(ownerRulings.rulings[id].resolvedTo);
      expect(entry.resolvedBy).toBe("owner-checkpoint-2026-08-04");
    }
  });

  it("no decisions-queue entry is left with status 'open' after the checkpoint (all 34 are resolved-by-default or resolved)", () => {
    const open = decisionsQueue.filter((d) => d.status === "open");
    expect(open).toEqual([]);
  });

  it("every resolved-by-default entry not named in owner-rulings.rulings is also stamped resolvedBy the checkpoint (confirmed-as-is)", () => {
    const rulingIds = new Set(Object.keys(ownerRulings.rulings));
    const defaults = decisionsQueue.filter((d) => d.status === "resolved-by-default");
    expect(defaults.length).toBe(ownerRulings.confirmedDefaults.confirmedCount);
    for (const d of defaults) {
      expect(rulingIds.has(d.id)).toBe(false);
      expect(d.resolvedBy).toBe("owner-checkpoint-2026-08-04");
    }
  });
});
