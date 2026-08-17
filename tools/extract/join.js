// tools/extract/join.js
//
// Phase 0 JOIN builder. Reads ONLY data/raw/*.json (the four verified parser
// outputs) plus the two hand-authored map files (alias-map.json, register-map.json)
// in this directory, and writes the canonical dataset to data/*.json.
//
// Per tools/extract/CONTRACT.md and PLAN.md §3/§5. Re-runnable: `node tools/extract/join.js`
// (or `npm run extract`, which runs run.js -> this file).
//
// STANDING RULE: any real ambiguity this file cannot resolve deterministically
// from the data STOPS the run — writes data/raw/decision-request.join.json and
// exits non-zero. Nothing is guessed. See DECISIONS (built below) for every
// judgment call that WAS made, each with its evidence cited.

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  RewriteFileError,
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
const RAW = path.join(ROOT, "data", "raw");
const OUT = path.join(ROOT, "data");
const HERE = path.join(ROOT, "tools", "extract");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function stop(question, context, options) {
  const req = { question, context, options };
  fs.writeFileSync(
    path.join(RAW, "decision-request.join.json"),
    JSON.stringify(req, null, 2) + "\n"
  );
  console.error("STOP — decision required:", question);
  console.error("Written to data/raw/decision-request.join.json");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load inputs
// ---------------------------------------------------------------------------

const fd5 = readJSON(path.join(RAW, "fd5.json"));
const methods = readJSON(path.join(RAW, "methods.json"));
const provisioning = readJSON(path.join(RAW, "provisioning.json"));
const shoppinglist = readJSON(path.join(RAW, "shoppinglist.json"));
const morrisons = readJSON(path.join(RAW, "morrisons.json"));
const aliasMap = readJSON(path.join(HERE, "alias-map.json"));
// Variant-only extension (kept separate from alias-map.json so its own
// "alias-map-covers-49-short-names" hard gate, scoped to the canonical
// 49-row basket, is never disturbed by Morrisons-tester-only additions).
const aliasMapMorrisons = readJSON(path.join(HERE, "alias-map-morrisons.json"));
const registerMap = readJSON(path.join(HERE, "register-map.json"));

let decisions = []; // decisions-queue.json accumulator
let decisionSeq = 0;
// Returns the pushed entry (a live reference into `decisions`) so callers
// whose real content isn't known yet at call time (e.g. the targets/plan
// re-banding decision, whose real numbers only exist after the Phase 1
// overlay runs) can amend detail/resolvedTo in place later — WITHOUT
// changing decisionSeq / this call's position in the sequence. Decision
// IDs are assigned by CALL ORDER and are referenced elsewhere by fixed ID
// string (tools/extract/owner-rulings.json rules D0-003/030/031 by name) —
// moving a decide() CALL to fire later would renumber every decision after
// its original position and silently misapply an owner ruling to the wrong
// topic. Amend the object in place; never reorder the calls themselves.
function decide({ topic, detail, options = [], recommendation, status, resolvedTo }) {
  decisionSeq += 1;
  const entry = {
    id: `D0-${String(decisionSeq).padStart(3, "0")}`,
    topic,
    detail,
    options,
    recommendation,
    status,
    resolvedTo,
  };
  decisions.push(entry);
  return entry;
}

const validation = []; // validation.json accumulator
function check(name, pass, detail) {
  validation.push({ name, pass: !!pass, detail });
  if (!pass) console.error("CHECKSUM FAIL:", name, "-", detail);
}

// ---------------------------------------------------------------------------
// Spine join: methods.json ingredient display names <-> fd5.spec[id][0]
// ---------------------------------------------------------------------------

const nameToId = {};
for (const id of fd5.ids) nameToId[fd5.spec[id][0]] = id;

const allCards = [
  ...methods.weeks.A.cards.map((c) => ({ ...c, week: "A" })),
  ...methods.weeks.B.cards.map((c) => ({ ...c, week: "B" })),
];

{
  let totalRows = 0;
  let joinFailures = 0;
  const failures = [];
  for (const c of allCards) {
    for (const ing of c.ingredients) {
      totalRows += 1;
      if (!(ing.name in nameToId)) {
        joinFailures += 1;
        failures.push({ card: `${c.week}${c.dayNo}${c.slot}`, name: ing.name });
      }
    }
  }
  check(
    "methods-spec-join-281",
    totalRows === 281 && joinFailures === 0,
    `${totalRows} ingredient rows across 40 cards, ${joinFailures} join failures (expect 281 rows, 0 failures). Failures: ${JSON.stringify(
      failures
    )}`
  );
  if (joinFailures > 0) {
    stop(
      "Methods ingredient display name(s) do not match any fd5.spec[id][0] display name.",
      { failures },
      ["Add the missing ingredient to fd5.json (out of scope for join.js)", "Investigate a methods.js extraction bug"]
    );
  }
  const cardCount = allCards.length;
  const perWeek = { A: methods.weeks.A.cards.length, B: methods.weeks.B.cards.length };
  const macroShapeOk = allCards.every(
    (c) =>
      c.macros &&
      c.macros.her &&
      c.macros.him &&
      ["kcal", "protein", "netCarb", "fat", "fibre"].every(
        (k) => typeof c.macros.her[k] === "number" && typeof c.macros.him[k] === "number"
      )
  );
  const rowCountOk = allCards.every((c) => c.ingredients.length >= 3);
  check(
    "40-cards-20-per-week-2x5-macros-min3-ingredients",
    cardCount === 40 && perWeek.A === 20 && perWeek.B === 20 && macroShapeOk && rowCountOk,
    `cards=${cardCount} (A=${perWeek.A}, B=${perWeek.B}), every card has 2x5 macros: ${macroShapeOk}, every card >=3 ingredient rows: ${rowCountOk}`
  );
}

// ---------------------------------------------------------------------------
// Vestigial ingredients -> retired.json
// ---------------------------------------------------------------------------

const VESTIGIAL_IDS = ["milk", "egg_white", "whey", "edamame", "mango"];

{
  // Confirm each is genuinely unused anywhere (fd5 meals, methods cards, register).
  const registerNames = new Set(provisioning.storageRegister.map((r) => r.item));
  const allFd5Meals = { ...fd5.meals, ...fd5.mealsB };
  for (const id of VESTIGIAL_IDS) {
    const name = fd5.spec[id][0];
    const usedInFd5 = Object.entries(allFd5Meals).some(([, m]) => id in m.w || id in m.m);
    const usedInMethods = allCards.some((c) => c.ingredients.some((i) => i.name === name));
    const inRegister = registerNames.has(name);
    if (usedInFd5 || usedInMethods || inRegister) {
      stop(
        `Vestigial ingredient candidate "${id}" (${name}) is unexpectedly referenced somewhere — D10's purge list may be stale.`,
        { id, name, usedInFd5, usedInMethods, inRegister },
        ["Do not retire it", "Retire it anyway with a note"]
      );
    }
  }
}

const retired = VESTIGIAL_IDS.map((id) => ({
  id,
  name: fd5.spec[id][0],
  per100g: {
    kcal: fd5.food[id][0],
    protein: fd5.food[id][1],
    fibre: fd5.food[id][2],
    carb: fd5.food[id][3],
    fat: fd5.food[id][4],
  },
  spec: {
    weightState: fd5.spec[id][1],
    householdUnitG: fd5.spec[id][2],
    unitSingular: fd5.spec[id][3],
    unitPlural: fd5.spec[id][4],
  },
  price: fd5.prices[id] ?? null,
  aisle: Object.entries(fd5.aisle).find(([, list]) => list.includes(id))?.[0] ?? null,
  reason:
    id === "whey"
      ? "Never used in any Week A/B meal (fd5.meals/mealsB) or methods.json card, and absent from the 54-row storage register. Has a legacy fd5.prices entry marked '(optional)' but was never purchased on any shopping list (55-row canonical basket or 54-row legacy basket). D10 ruling: purge whey + vestigial ingredients."
      : "Never used in any Week A/B meal (fd5.meals/mealsB) or methods.json card, absent from the storage register, and absent from both shopping lists' price data. D10 ruling: purge vestigial ingredients (milk, egg_white, edamame, mango).",
}));

decide({
  topic: "retired ingredients purge (D10)",
  detail: `Confirmed by cross-reference against fd5.meals+mealsB, all 40 methods.json cards, and the 54-row storage register: milk, egg_white, whey, edamame, mango are referenced nowhere except fd5.food/fd5.spec/fd5.aisle (and, for whey only, a stray fd5.prices entry marked "(optional)"). All 5 purged to data/retired.json with their data preserved. This is exactly the D10-named list (milk, egg_white, edamame, mango) plus whey, which the task brief flagged as "likely already absent" — it is NOT absent from fd5.json's data tables, but IS absent from every meal/register/shopping-list use, so it is retired for the same reason as the other four.`,
  options: ["Keep as unused ingredients", "Retire to retired.json (chosen)"],
  recommendation: "Retire all 5 to retired.json, preserving full data + reason.",
  status: "resolved-by-default",
  resolvedTo: "retired.json holds all 5 (milk, egg_white, whey, edamame, mango).",
});

// ---------------------------------------------------------------------------
// New ingredients discovered at extraction time (addedInExtraction: true)
// ---------------------------------------------------------------------------

// 1) sweetheart_cabbage — shopping row "Sweetheart cabbage", no fd5 counterpart,
//    no methods.json mention ("cabbage" only ever means "Red cabbage, shredded").
// 2) peppers_frozen — shopping row "Frozen sliced peppers"; the existing "peppers"
//    id (Red pepper, deseeded) covers ALL pepper uses in fd5/methods, but the
//    canonical basket buys it as TWO different retail SKUs (fresh vs frozen
//    sliced) depending on whether the dish uses it raw or cooked. See the
//    peppers raw/cooked split decision below.
// 3) rapeseed_oil — shopping row "Rapeseed oil", no fd5 counterpart, no
//    methods.json mention (methods.json only ever says "Extra virgin olive oil").

const NEW_INGREDIENTS = {
  sweetheart_cabbage: {
    displayName: "Sweetheart cabbage",
    food: [27, 1.4, 2.3, 5.0, 0.2], // kcal, protein, fibre, carb, fat per 100g
    spec: { weightState: "Prepared", householdUnitG: null, unitSingular: "", unitPlural: "" },
    aisle: "Produce",
  },
  peppers_frozen: {
    displayName: "Red pepper, deseeded (frozen sliced)",
    food: fd5.food.peppers.slice(), // freezing does not materially change per-100g composition
    spec: { weightState: "Frozen", householdUnitG: null, unitSingular: "", unitPlural: "" },
    aisle: "Produce", // matches the fd5 convention: frozen spinach/cauliflower/broccoli/okra all stay "Produce"
  },
  rapeseed_oil: {
    displayName: "Rapeseed oil",
    food: [884, 0, 0, 0, 100], // standard reference value for a pure vegetable oil, matches olive_oil's profile
    spec: { weightState: "As it comes", householdUnitG: 4.5, unitSingular: "tsp", unitPlural: "tsp" },
    aisle: "Cupboard",
  },
};

decide({
  topic: "three addedInExtraction ingredients + assumed compositions",
  detail:
    "Three FD5-Shopping-List.html rows have no ingredient anywhere in fd5.json/methods.json: " +
    "'Sweetheart cabbage' (row 22), 'Frozen sliced peppers' (row 35), 'Rapeseed oil' (row 49). " +
    "Verified by grep: methods.json's only cabbage mentions are all 'Red cabbage, shredded'; its only oil mentions are all 'Extra virgin olive oil'; 'sweetheart'/'rapeseed' appear zero times in any of the 40 cards. " +
    "Created 3 new ingredient ids (sweetheart_cabbage, peppers_frozen, rapeseed_oil), all addedInExtraction:true, with per-100g composition from standard UK reference values: " +
    "sweetheart_cabbage uses a generic raw-cabbage reference (27 kcal/1.4 protein/2.3 fibre/5.0 carb/0.2 fat per 100g, chosen close to the dataset's existing red_cabbage entry [31,1.4,2.1,7.4,0.2] since the two vegetables are nutritionally near-identical); " +
    "peppers_frozen reuses fd5.food.peppers verbatim (freezing does not materially change a vegetable's macro composition); " +
    "rapeseed_oil uses the standard pure-oil reference (884 kcal, 100g fat, 0 protein/carb/fibre per 100g), identical in shape to olive_oil since both are pure fats. " +
    "Provisioning's provenance.cutsStuck section independently corroborates all three as genuine SKU decisions: 'Half the peppers frozen' (Morrisons Sliced Mixed Peppers 500g £1.25 vs fresh £3.98/kg), 'Sweetheart cabbage where the gem is only shredded' (Morrisons British Sweetheart Cabbage £0.75 each ~500g), 'Split the oil two ways' (KTC Extended Life Rapeseed 1L £3.50 vs EVOO £7.14/kg).",
  options: [
    "Leave the 3 shopping rows unmapped (breaks the 'alias map covers all short names' checksum)",
    "Create 3 new ingredient records with standard-reference composition (chosen)",
  ],
  recommendation: "Create the 3 records; no meal in meals.json references sweetheart_cabbage or rapeseed_oil (methods.json prose never distinguishes them from their siblings) — they exist as shopping-list/basket SKUs only. peppers_frozen IS wired into meals.json per the raw/cooked split decision below.",
  status: "resolved-by-default",
  resolvedTo: "ingredients.json carries all 3 with addedInExtraction:true; sweetheart_cabbage and rapeseed_oil have no meals.json linkage (see separate decision entries for why that linkage was not attempted).",
});

decide({
  topic: "sweetheart_cabbage / rapeseed_oil: no meal-level linkage attempted",
  detail:
    "provisioning.provenance notes sweetheart cabbage substitutes for lettuce 'where the gem is only shredded', and rapeseed oil substitutes for olive oil 'everything that hits a hot pan'. Both are real substitution rules, but methods.json's 210 ingredient rows never distinguish 'shredded' lettuce from whole-leaf lettuce, nor 'hot-pan' oil from 'dressing' oil, at the row level — every lettuce row is just 'Little gem or romaine' and every oil row is just 'Extra virgin olive oil', with a single combined gram figure per dish covering all uses within that dish (e.g. the pizza's 14/17 g oil figure explicitly covers both the 5 g used to soften vegetables AND the remaining oil used to dress the salad, per that card's own steps text). Splitting these combined per-dish gram figures between two ingredient ids would require guessing what fraction of each figure was for which purpose — not offered anywhere in the data. join.js does not attempt it. The task brief's explicit 'map ... to cooked uses / raw uses where the distinction appears' instruction names peppers only, not cabbage or oil, so this is treated as in-scope for peppers and out-of-scope (by design, not oversight) for cabbage/oil.",
  options: [
    "Guess a split fraction per dish (rejected — no basis in the data)",
    "Leave lettuce/olive_oil meal references as-is; sweetheart_cabbage/rapeseed_oil exist only as basket SKUs (chosen)",
  ],
  recommendation: "As chosen. Revisit in Phase 1 if the methods rewrite adds per-step oil/lettuce attribution.",
  status: "open",
  resolvedTo: null,
});

// ---------------------------------------------------------------------------
// Peppers raw/cooked split (fresh "peppers" SKU vs frozen "peppers_frozen" SKU)
// ---------------------------------------------------------------------------

// shoppinglist row 18 "Red peppers" note: "The raw ones — Wednesday's suya salad
// and Tuesday's escovitch." Those two dishes, unambiguously identified by name:
//   - "Wednesday's suya salad" -> Week B Wed Dinner "Suya chicken skewers with pepper salad"
//   - "Tuesday's escovitch"    -> Week B Tue Dinner "Basa escovitch with cauliflower rice"
// shoppinglist row 35 "Frozen sliced peppers" note: "For everything cooked down —
// jollof, efo riro, the stews, the hash" — matches every OTHER pepper-using card
// by name (jollof=B1Lunch, efo riro=A3Lunch, stews=B3Lunch turkey&okra, hash=B3Breakfast).
const RAW_PEPPER_CARDS = new Set(["B-2-Dinner", "B-3-Dinner"]);

function cardKey(c) {
  return `${c.week}-${c.dayNo}-${c.slot}`;
}

{
  const pepperCards = allCards.filter((c) => c.ingredients.some((i) => i.name === "Red pepper, deseeded"));
  const raw = pepperCards.filter((c) => RAW_PEPPER_CARDS.has(cardKey(c)));
  const cooked = pepperCards.filter((c) => !RAW_PEPPER_CARDS.has(cardKey(c)));
  decide({
    topic: "peppers raw-vs-frozen SKU split (task brief explicit instruction)",
    detail:
      `10 methods.json cards use 'Red pepper, deseeded': ${pepperCards.map((c) => cardKey(c) + " " + c.name).join("; ")}. ` +
      `shoppinglist.json row 18 ('Red peppers', fresh, Morrisons Savers Mixed Peppers 3pk £3.58/2) note reads 'The raw ones — Wednesday's suya salad and Tuesday's escovitch', which names exactly B-3-Dinner (Suya chicken skewers with pepper salad) and B-2-Dinner (Basa escovitch with cauliflower rice) — confirmed by exact dish-name match, not guessed. ` +
      `row 35 ('Frozen sliced peppers', Morrisons Sliced Mixed Peppers 500g £1.25) note reads 'For everything cooked down — jollof, efo riro, the stews, the hash', which names B-1-Lunch (Jollof fried rice), A-3-Lunch (Efo riro), B-3-Lunch (Turkey & okra stew), B-3-Breakfast (Plantain & pepper hash) — 4 of the remaining 8 cooked cards named explicitly, the other 4 (A-1-Dinner pizza, A-2-Lunch burrito bowl, A-3-Breakfast egg sauce, A-3-Dinner pepper soup) all cook the pepper in a pan/oven/soup per their own steps text, consistent with 'cooked'. ` +
      `Raw group (2 cards, id stays 'peppers', SKU = fresh row 18): ${raw.map(cardKey).join(", ")}. Cooked group (8 cards, id becomes 'peppers_frozen', SKU = frozen row 35): ${cooked.map(cardKey).join(", ")}.`,
    options: [
      "Map all pepper rows to the single existing 'peppers' id (loses the real fresh/frozen price split; contradicts task brief instruction)",
      "Split by card per the shopping-list note text, using the existing 'peppers' id for the 2 named-raw cards and a new 'peppers_frozen' id for the other 8 (chosen)",
    ],
    recommendation: "As chosen — fully derived from the two shopping-list row notes, zero guessing.",
    status: "resolved-by-default",
    resolvedTo: "meals.json: peppers id used only for B-2-Dinner and B-3-Dinner; peppers_frozen id used for the other 8 pepper-bearing cards.",
  });
}

function resolveIngId(card, ingredientName) {
  if (ingredientName === "Red pepper, deseeded") {
    return RAW_PEPPER_CARDS.has(cardKey(card)) ? "peppers" : "peppers_frozen";
  }
  return nameToId[ingredientName];
}

// ---------------------------------------------------------------------------
// ingredients.json
// ---------------------------------------------------------------------------

const ACTIVE_IDS = fd5.ids.filter((id) => !VESTIGIAL_IDS.includes(id));
const ALL_ING_IDS = [...ACTIVE_IDS, ...Object.keys(NEW_INGREDIENTS)];

// Reverse the alias map: ingredient id -> { shortName, sharedWith[] }
const idToShort = {};
const idToSharedWith = {};
for (const [shortName, ids] of Object.entries(aliasMap)) {
  if (shortName.startsWith("_")) continue;
  for (const id of ids) {
    idToShort[id] = shortName;
    if (ids.length > 1) idToSharedWith[id] = ids.filter((x) => x !== id);
  }
}
{
  const keys = Object.keys(aliasMap).filter((k) => !k.startsWith("_"));
  const idSet = new Set();
  for (const ids of Object.values(aliasMap)) {
    if (Array.isArray(ids)) ids.forEach((i) => idSet.add(i));
  }
  check(
    "alias-map-covers-49-short-names",
    keys.length === 49,
    `alias-map.json has ${keys.length} short-name keys (expect 49, per the 2026-08-11 owner-ruled canonical revision — was 55/6 removed)`
  );
  // "peppers_frozen" and "peppers" both used, plus 54 active + 3 new = distinct id coverage
  check(
    "alias-map-zero-fuzzy (all mapped ids exist)",
    [...idSet].every((id) => ALL_ING_IDS.includes(id)),
    `alias-map ids not found in ALL_ING_IDS: ${[...idSet].filter((id) => !ALL_ING_IDS.includes(id))}`
  );
}
{
  const keys = Object.keys(registerMap).filter((k) => !k.startsWith("_"));
  check("register-map-covers-54-rows", keys.length === 54, `register-map.json has ${keys.length} keys (expect 54)`);
}

// Reverse the register map: ingredient id -> register row
const idToRegisterRow = {};
for (const [itemName, id] of Object.entries(registerMap)) {
  if (itemName.startsWith("_")) continue;
  const row = provisioning.storageRegister.find((r) => r.item === itemName);
  idToRegisterRow[id] = row;
}

// Reverse shoppinglist rows: shortName -> row (for SKU); day0 pill -> class
const shopRowByName = {};
for (const r of shoppinglist.rows) shopRowByName[r.name] = r;

const PILL_TO_CLASS = {
  "Freeze on day 0": "freeze-day0",
  "Buy once": "buy-once",
  "Buy frozen": "buy-frozen",
  "Day-7 top-up": "topup",
  "Buy mixed ripeness": "stagger",
};

const day0ByItem = {};
for (const r of provisioning.day0) day0ByItem[r.item] = r;

// canonical name heuristic: text before first comma or "(" , trimmed.
function canonicalName(display) {
  const m = display.match(/^([^,(]+)/);
  return (m ? m[1] : display).trim();
}

function aisleBucketFor(id) {
  const found = Object.entries(fd5.aisle).find(([, list]) => list.includes(id));
  return found ? found[0] : null;
}

const ESTIMATE_OVERLAY = {}; // id -> {estimate, source}
{
  const provRows = [...provisioning.day0, ...provisioning.day7];
  for (const row of provRows) {
    const id = nameToId[row.item];
    if (!id) continue;
    // last-wins across day0/day7 for the same id; both are recorded in decisions-queue below
    ESTIMATE_OVERLAY[id] = { estimate: row.estimate, source: "provisioning" };
  }
}

{
  // Verify + record the 19 items where the provisioning overlay differs from D.prices.ver
  const diffs = [];
  for (const [id, overlay] of Object.entries(ESTIMATE_OVERLAY)) {
    const base = fd5.prices[id] ? fd5.prices[id].ver === 0 : null;
    if (base !== null && base !== overlay.estimate) {
      diffs.push({ id, name: fd5.spec[id][0], fd5VerEstimate: base, provisioningEstimate: overlay.estimate });
    }
  }
  decide({
    topic: "19 estimate-flag differences: provisioning overlay wins over D.prices.ver",
    detail: `Base layer is fd5.json D.prices[id].ver (ver:0 = estimate). Overlay is provisioning.json's day0/day7 'estimate' field (from the Provisioning HTML's est spans). ${diffs.length} ids differ (task brief predicted 19; confirmed exactly 19): ${JSON.stringify(diffs)}`,
    options: ["Keep fd5.prices.ver as final", "Overlay wins because Provisioning is newer (chosen)"],
    recommendation: "Overlay wins per PLAN.md §2 ('overlay wins — newer'). estimateSource recorded per ingredient.",
    status: "resolved-by-default",
    resolvedTo: "ingredients.json sku.estimate uses the overlay value for these 19 ids; sku.estimateSource='provisioning' for them, 'fd5' otherwise.",
  });
}

// --- 2026-08-11 owner-ruled canonical revision -----------------------------
// The owner re-verified the canonical basket at the till on 2026-08-11:
// 6 lines dropped entirely (never actually needed at that shop), 22
// remaining lines got updated prices. Both are derived from alias-map.json
// (which lines still have a mapping = still bought) and the shortName set
// below (hand-verified against a name-for-name diff of the old vs revised
// FD5-Shopping-List.html, git history), not guessed.
const PANTRY_OPTIONAL_IDS = new Set(["cottage", "apple", "banana", "chia", "pumpkin_seeds", "coconut_des"]);
const REVERIFIED_2026_08_11_SHORT_NAMES = new Set([
  "Chicken breast", "Eggs", "Beef mince, 5%", "Basa fillets", "Rump or sirloin steak",
  "Turkey breast mince", "Chicken breast mince", "King prawns", "Reduced-fat cheddar",
  "Mozzarella", "Parmesan", "Panko breadcrumbs", "Fat-free Greek yoghurt", "Avocados",
  "Salad tomatoes", "Carrots", "Chestnut mushrooms", "Frozen sweetcorn", "Red kidney beans",
  "Chickpeas", "Porridge oats", "Rapeseed oil",
]);
check(
  "reverified-2026-08-11-count-22",
  REVERIFIED_2026_08_11_SHORT_NAMES.size === 22,
  `${REVERIFIED_2026_08_11_SHORT_NAMES.size} re-verified short names tracked (expect 22)`
);
check(
  "pantry-optional-count-6",
  PANTRY_OPTIONAL_IDS.size === 6,
  `${PANTRY_OPTIONAL_IDS.size} pantryOptional ids tracked (expect 6)`
);

// NOTE: the decide() call documenting this revision is placed at the very
// END of the decisions sequence (right before the variant-morrisons build,
// alongside that section's own new decisions), NOT here — decisionSeq
// assigns D0-XXX ids by CALL ORDER, and owner-rulings.json references
// D0-003/030/031 by that exact id (see the `decide()` helper's own comment,
// top of file). Inserting a new decide() call at this early point would
// renumber every decision after it and silently misapply an owner ruling to
// the wrong topic — confirmed the hard way: doing this once during
// development dropped the confirmed-defaults count from 31 to 30 and
// tripped the "owner-rulings-confirmed-defaults-count" STOP gate.

let ingredients = [];

for (const id of ALL_ING_IDS) {
  const isNew = id in NEW_INGREDIENTS;
  let display, foodArr, specArr, aisle;

  if (isNew) {
    const n = NEW_INGREDIENTS[id];
    display = n.displayName;
    foodArr = n.food;
    specArr = [n.displayName, n.spec.weightState, n.spec.householdUnitG, n.spec.unitSingular, n.spec.unitPlural];
    aisle = n.aisle;
  } else {
    display = fd5.spec[id][0];
    foodArr = fd5.food[id];
    specArr = fd5.spec[id];
    aisle = aisleBucketFor(id);
  }

  const shortName = idToShort[id] ?? null;
  const shopRow = shortName ? shopRowByName[shortName] : null;

  // storage
  let storage;
  if (isNew) {
    const NEW_STORAGE = {
      sweetheart_cabbage: {
        class: "buy-once",
        location: "Fridge",
        note: "Keeps three weeks (shopping-list note). Substitutes for shredded little-gem uses per provisioning provenance; no register row exists (not in the original 54-item register).",
        life: { prose: "Keeps three weeks", sealedDays: null, openDays: null, frozenDays: null, freshDays: 21 },
      },
      peppers_frozen: {
        class: "buy-frozen",
        location: "Freezer",
        note: "Frozen sliced retail SKU of red pepper, used for all cooked/stewed uses. No dedicated register row; shelf life assumed identical to sibling frozen vegetables (spinach/cauliflower/broccoli/okra all register at 12 months frozen).",
        life: { prose: "12 months frozen (assumed, matching sibling frozen veg)", sealedDays: null, openDays: null, frozenDays: 365, freshDays: null },
      },
      rapeseed_oil: {
        class: "buy-once",
        location: "Cupboard, dark",
        note: "No dedicated register row; assumed identical shelf life to olive_oil (register: 'Years').",
        life: { prose: "Years (assumed, matching olive_oil)", sealedDays: null, openDays: null, frozenDays: null, freshDays: null },
      },
    };
    storage = NEW_STORAGE[id];
  } else {
    const reg = idToRegisterRow[id];
    const d0 = day0ByItem[display];
    if (!reg) {
      stop(`No storage-register row for active ingredient ${id} (${display}).`, { id, display }, ["Investigate register-map.json"]);
    }
    const cls = d0 ? PILL_TO_CLASS[d0.pill] : undefined;
    if (d0 && !cls) {
      stop(`Unrecognised day0 pill "${d0.pill}" for ${id}.`, { id, pill: d0.pill }, Object.keys(PILL_TO_CLASS));
    }
    storage = {
      class: cls ?? "buy-once",
      location: reg.location,
      note: reg.note,
      life: reg.life,
    };
  }

  // sku
  let sku = null;
  const reverified = shortName ? REVERIFIED_2026_08_11_SHORT_NAMES.has(shortName) : false;
  if (shopRow) {
    const unitPrice = +(parseFloat(shopRow.priceShown.replace("£", "")) / shopRow.qty).toFixed(2);
    const fd5Price = fd5.prices[id];
    const baseEstimate = fd5Price ? fd5Price.ver === 0 : true; // new ingredients default to estimate:true
    const overlay = ESTIMATE_OVERLAY[id];
    const estimate = overlay ? overlay.estimate : baseEstimate;
    const estimateSource = overlay ? "provisioning" : fd5Price ? "fd5" : "shoppinglist-only";
    sku = {
      shop: shopRow.shop,
      product: shopRow.productString,
      packG: shopRow.pack,
      price: unitPrice,
      // 2026-08-11 owner re-verification wins over both the fd5/provisioning
      // base estimate flags AND null verifiedOn (D0-031's 2026-08-04 ruling
      // kept verifiedOn null until a REAL price-check event existed — this
      // is that event, not a backfilled extraction/file date; see the
      // "canonical-revision-2026-08-11-adopted" decision below).
      estimate: reverified ? false : isNew ? true : estimate,
      estimateSource: reverified ? "owner-reverify-2026-08-11" : isNew ? "extraction-assumed" : estimateSource,
      verifiedOn: reverified ? "2026-08-11" : null,
      sharedSkuWith: idToSharedWith[id]?.[0] ?? null,
    };
  }

  ingredients.push({
    id,
    name: { display, short: shortName ?? display, canonical: canonicalName(display) },
    aliases: shortName && shortName !== display ? [shortName] : [],
    per100g: { kcal: foodArr[0], protein: foodArr[1], fat: foodArr[4], carb: foodArr[3], fibre: foodArr[2] },
    spec: {
      weightState: specArr[1],
      householdUnitG: specArr[2],
      unitSingular: specArr[3],
      unitPlural: specArr[4],
    },
    aisle,
    freebie: false,
    ...(isNew ? { addedInExtraction: true } : {}),
    // "Not bought in the canonical basket / assumed on hand or optional" —
    // the 6 ids dropped from the 2026-08-11 canonical revision. Their
    // meals.json references are untouched (per the owner's instruction);
    // sku is already null here via the shortName->shopRow chain above,
    // since their alias-map.json entries were removed, not left dangling.
    ...(PANTRY_OPTIONAL_IDS.has(id) ? { pantryOptional: true } : {}),
    storage,
    sku,
  });
}

{
  // register coverage checksum: 54 register rows all carry shelf-life + location
  const nonNewIngredients = ingredients.filter((i) => !i.addedInExtraction);
  const allHaveLifeAndLocation = nonNewIngredients.every(
    (i) => i.storage && i.storage.location && i.storage.life && i.storage.life.prose
  );
  check(
    "54-register-rows-have-shelf-life-and-location",
    nonNewIngredients.length === 54 && allHaveLifeAndLocation,
    `${nonNewIngredients.length} non-new ingredients (expect 54), all with location+life.prose: ${allHaveLifeAndLocation}`
  );
}

// Greek yoghurt / skyr and raspberries / blueberries: confirm never deduped
{
  const gy = ingredients.find((i) => i.id === "greek_yog");
  const sk = ingredients.find((i) => i.id === "skyr");
  const rb = ingredients.find((i) => i.id === "raspberries");
  const bb = ingredients.find((i) => i.id === "blueberries");
  check(
    "greek-yog-skyr-two-records-one-shared-sku",
    gy && sk && gy.sku && sk.sku && gy.sku.sharedSkuWith === "skyr" && sk.sku.sharedSkuWith === "greek_yog",
    `greek_yog.sku.sharedSkuWith=${gy?.sku?.sharedSkuWith}, skyr.sku.sharedSkuWith=${sk?.sku?.sharedSkuWith}`
  );
  check(
    "raspberries-blueberries-two-records-one-shared-sku",
    rb && bb && rb.sku && bb.sku && rb.sku.sharedSkuWith === "blueberries" && bb.sku.sharedSkuWith === "raspberries",
    `raspberries.sku.sharedSkuWith=${rb?.sku?.sharedSkuWith}, blueberries.sku.sharedSkuWith=${bb?.sku?.sharedSkuWith}`
  );
}

decide({
  topic: "second shared-SKU pair discovered: raspberries + blueberries",
  detail:
    "shoppinglist.json row 36 'Frozen mixed berries' note: 'One bag replaces both the raspberries and the blueberries.' This is structurally identical to the Greek-yoghurt/skyr shared-SKU case named explicitly in the task brief, but was not named there — discovered by reading every row note. Handled the same way: two ingredient records (raspberries, blueberries), one shared SKU via sharedSkuWith, alias-map row maps to both ids.",
  options: ["Treat as a single merged ingredient (rejected — loses macro distinction, contradicts 'never dedupe')", "Two records, one shared SKU (chosen)"],
  recommendation: "As chosen, consistent with the named greek_yog/skyr precedent.",
  status: "resolved-by-default",
  resolvedTo: "raspberries and blueberries are both real ingredients.json entries with sku.sharedSkuWith pointing at each other.",
});

// ---------------------------------------------------------------------------
// Stale FD-5 prices vs canonical basket
// ---------------------------------------------------------------------------

{
  const stale = [];
  for (const ing of ingredients) {
    if (ing.addedInExtraction || !ing.sku) continue;
    const fp = fd5.prices[ing.id];
    if (!fp) continue;
    const isStale = Math.abs(fp.price - ing.sku.price) > 0.001 || fp.pack !== ing.sku.packG;
    if (isStale) {
      stale.push({
        id: ing.id,
        name: ing.name.display,
        fd5Price: fp.price,
        fd5Pack: fp.pack,
        canonicalPrice: ing.sku.price,
        canonicalPack: ing.sku.packG,
      });
    }
  }
  decide({
    topic: "stale FD-5 prices vs canonical basket",
    detail: `Compared fd5.json D.prices[id] (price+pack) against the canonical FD5-Shopping-List.html basket (data/raw/shoppinglist.json, price-per-pack = priceShown/qty) for all 54 non-added ingredients with a shopping-list SKU. ${stale.length}/54 differ in price and/or pack size (task brief's planning-session estimate was '~26/54'; the actual measured figure is ${stale.length}/54 — recorded here as the authoritative, reproducible count). Full list: ${JSON.stringify(stale)}`,
    options: ["Keep fd5.prices as canonical (rejected — PLAN.md §2 names the shopping list as canonical for price)", "Use shoppinglist.json prices as canonical, fd5.prices retained only for the legacy/est-flag checksums (chosen)"],
    recommendation: "ingredients.json sku.price is always the canonical-basket price; fd5.prices is never written into sku directly, only used for the ver:0 base-layer estimate flag and the legacy checksum.",
    status: "resolved-by-default",
    resolvedTo: `${stale.length}/54 ids repriced relative to fd5.json; ingredients.json uses canonical-basket prices throughout.`,
  });
}

// ---------------------------------------------------------------------------
// provisioning penny-drift anomalies -> decisions-queue
// ---------------------------------------------------------------------------

for (const a of provisioning.anomalies) {
  if (a.type === "day0-shop-subtotal-mismatch" || a.type === "day0-header-total-mismatch") {
    decide({
      topic: `provisioning parser penny-drift anomaly: ${a.type}`,
      detail: a.detail,
      options: ["Correct the source figure (rejected — not join.js's job; source HTML is archival/read-only)", "Record as-is, both figures preserved"],
      recommendation: "No action — this is a rounding discrepancy present in the source HTML itself, already flagged by provisioning.js. Recorded here for visibility per task brief.",
      status: "resolved-by-default",
      resolvedTo: "No correction applied; both figures cited in this entry.",
    });
  }
}

// ---------------------------------------------------------------------------
// meals.json
// ---------------------------------------------------------------------------

const SLOT_LETTER = { Breakfast: "b", Lunch: "l", Dinner: "d", Snack: "s" };
const SLOT_NAME = { Breakfast: "breakfast", Lunch: "lunch", Dinner: "dinner", Snack: "snack" };
const DAY_ABBR_TO_NO = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 };

function mealId(week, dayNo, slot) {
  return `${week.toLowerCase()}-d${dayNo}${SLOT_LETTER[slot]}`;
}

function round1(x) {
  return Math.round(x * 10) / 10;
}

let meals = [];
const mealsByKey = {}; // "A-2-Dinner" -> meal

for (const c of allCards) {
  const id = mealId(c.week, c.dayNo, c.slot);
  const activeMinMatch = c.timeChip.match(/(\d+(?:\.\d+)?)/);
  const activeMin = activeMinMatch ? +activeMinMatch[1] : null;

  const covers = { w: {}, m: {} };
  for (const ing of c.ingredients) {
    const ingId = resolveIngId(c, ing.name);
    covers.w[ingId] = (covers.w[ingId] ?? 0) + ing.herG;
    covers.m[ingId] = (covers.m[ingId] ?? 0) + ing.himG;
  }

  function recompute(coverGrams) {
    let kcal = 0,
      protein = 0,
      fibre = 0,
      carb = 0,
      fat = 0;
    for (const [ingId, g] of Object.entries(coverGrams)) {
      const ing = ingredients.find((i) => i.id === ingId);
      const f = ing.per100g;
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
      fibre: round1(fibre),
    };
  }

  const macros = { w: recompute(covers.w), m: recompute(covers.m) };

  const steps = c.steps.map((text, i) => ({
    n: i + 1,
    text,
    minutes: null,
    tempC: null,
    track: null,
    station: null,
    clockStart: null,
  }));

  const meal = {
    id,
    week: c.week,
    day: c.dayNo,
    slot: SLOT_NAME[c.slot],
    name: c.name,
    origin: c.originChip,
    tag: c.tag,
    activeMin,
    covers,
    macros,
    method: {
      steps,
      why: c.why,
      batchSource: null,
      batchTakeG: null,
      approved: false,
      rev: "A",
    },
  };
  meals.push(meal);
  mealsByKey[cardKey(c)] = meal;
}

check("meals-count-40-20-per-week", meals.length === 40 && meals.filter((m) => m.week === "A").length === 20 && meals.filter((m) => m.week === "B").length === 20, `meals=${meals.length}`);

// ---------------------------------------------------------------------------
// Macro recompute checksum (grams x per100g vs mac-strip, +-1 / +-0.2 fibre)
// ---------------------------------------------------------------------------

{
  const tol = { kcal: 1, protein: 1, netCarb: 1, fat: 1, fibre: 0.2 };
  const disputed = [];
  for (const c of allCards) {
    const meal = mealsByKey[cardKey(c)];
    for (const [cover, coverKey] of [
      ["her", "w"],
      ["him", "m"],
    ]) {
      const recomputed = meal.macros[coverKey];
      const actual = c.macros[cover];
      const diffs = {};
      let bad = false;
      for (const k of ["kcal", "protein", "netCarb", "fat", "fibre"]) {
        const d = recomputed[k] - actual[k];
        if (Math.abs(d) > tol[k] + 1e-9) {
          bad = true;
          diffs[k] = +d.toFixed(2);
        }
      }
      if (bad) disputed.push({ card: cardKey(c), name: c.name, cover, diffs });
    }
  }
  check(
    "macro-recompute-within-tolerance-36-undisputed",
    disputed.length === 0, // see decisions-queue entry: empirically 40/40 pass, better than the ~36/40 predicted
    `${40 - disputed.length}/40 cards recompute within +-1 unit (+-0.2 fibre) on BOTH covers. Disputed: ${JSON.stringify(disputed)}`
  );
  decide({
    topic: "macro recompute checksum: empirically 40/40 cards pass, not the predicted ~36/40",
    detail:
      `Recomputed all 40 cards x 2 covers (80 checks) from methods.json's own per-cover gram tables x ingredients.json per100g, and compared to methods.json's own mac-strip macros. Result: 0 cards outside tolerance (task brief predicted ~4 disputed cards / 36 undisputed, citing PLAN.md §4's known arithmetic-bug list). ` +
      `Explanation: the mac-strips in methods.json were computed CONSISTENTLY from the SAME per-cover gram tables also in methods.json — including the tables that carry known Phase-1 defects (e.g. Week B oil inversions: B-2-Dinner Extra virgin olive oil her=12g/him=10g, B-4-Lunch her=10g/him=8g — verified present in methods.json, her cover getting MORE oil than the larger him cover, backwards from every other card). A defect in the SOURCE gram table does not cause a mac-strip MISMATCH, because both the gram table and the mac-strip were authored/extracted from the same (possibly-wrong) numbers. The §4 known defects are real and are preserved as-extracted per Phase 0 scope (Phase 1 fixes them), but none of them manifest as a recompute-vs-mac-strip discrepancy.`,
    options: ["Force 4 cards into a 'disputed' bucket to match the prediction (rejected — fabricates a failure that doesn't exist)", "Report the true empirical result: 40/40 pass (chosen)"],
    recommendation: "Report 40/40. The oil-inversion and red-cabbage-quantity defects are separately logged (see the §4 content-defect entries) since they are real content issues, just not macro-recompute failures.",
    status: "resolved-by-default",
    resolvedTo: "validation.json checksum 'macro-recompute' reports 40/40 cards within tolerance, zero disputed.",
  });
}

// ---------------------------------------------------------------------------
// Week A day totals checksum (her, recomputed) — reconciled against D10 avocado drop
// ---------------------------------------------------------------------------

{
  const legacyExpected = [1667, 1663, 1670, 1646, 1694];
  const perDay = [];
  for (let d = 1; d <= 5; d++) {
    const cards = allCards.filter((c) => c.week === "A" && c.dayNo === d);
    const sum = cards.reduce((s, c) => s + mealsByKey[cardKey(c)].macros.w.kcal, 0);
    perDay.push(sum);
  }
  const diffs = perDay.map((v, i) => v - legacyExpected[i]);
  // Exact expected deltas, not "any diff on these days": days 1/2/4 must land
  // within +-1 of the specific D10 avocado-drop-plus-compensating-oil deltas
  // (+4/+12/+4 kcal respectively, cited and derived in the decision below);
  // days 3/5 must match the legacy figure exactly (delta 0). Any diff outside
  // its day's expected value is a genuine unexplained failure, not waved through.
  const expectedDelta = { 1: 4, 2: 12, 3: 0, 4: 4, 5: 0 };
  const allExplained = diffs.every((d, i) => Math.abs(d - expectedDelta[i + 1]) <= 1);
  check(
    "week-A-day-totals-her-recomputed",
    allExplained,
    `recomputed=${JSON.stringify(perDay)} vs legacy PLAN.md figures=${JSON.stringify(legacyExpected)}, diffs=${JSON.stringify(diffs)}, expected diffs=${JSON.stringify(Object.values(expectedDelta))}. Days 1,2,4 diffs match the D10 avocado-garnish-drop-plus-compensating-oil-increase deltas exactly (see decisions-queue); days 3,5 match the legacy figure exactly (diff 0).`
  );
  decide({
    topic: "D10: three dropped avocado garnishes — verified diffs, cited numbers",
    detail:
      `Verified by diffing fd5.json meals/mealsB ingredient tables against methods.json's per-cover gram tables for every one of the 40 cards. Exactly 3 cards lost an avocado row between fd5.json and methods.json, all in Week A, all matching provisioning.provenance.cutsStuck's 'Three avocado garnishes dropped' note ('the chicken-crust pizza salad, the burrito bowl's guacamole scoop and the steak sandwich'): ` +
      `(1) A-1-Dinner 'Chicken-crust pizza': fd5 had avocado 25g(her)/35g(him); methods drops it, oil rises 9/11g -> 14/17g. ` +
      `(2) A-2-Lunch 'Chipotle burrito bowl': fd5 had avocado 20g/28g and NO oil; methods drops avocado, adds oil 5g/6g. ` +
      `(3) A-4-Breakfast 'Steak & egg breakfast sandwich': fd5 had avocado 25g/35g; methods drops it, oil rises 9/11g -> 14/17g. ` +
      `Consequence traced to Week A day-kcal totals (her cover): day1 recomputed 1671 vs legacy-quoted 1667 (+4), day2 1675 vs 1663 (+12), day4 1650 vs 1646 (+4) — days 3 and 5 (no avocado-drop cards) match the legacy figure exactly (diff 0). The true mechanism producing each delta is NOT the avocado drop alone — it is the avocado drop (a small kcal loss) PLUS a compensating olive-oil increase in the SAME dish (a larger kcal gain, since oil is far more calorie-dense per gram than avocado), netting to a small POSITIVE delta on each affected day: e.g. A-1-Dinner loses ~25-35g avocado (~35-50 kcal) but gains 5g oil (~44 kcal); A-2-Lunch loses ~20-28g avocado (~30-40 kcal) but gains a full 5-6g oil from zero (~44-53 kcal); A-4-Breakfast mirrors A-1-Dinner's pattern. The 'legacy' 1667/1663/1670/1646/1694 figures in PLAN.md §3 were computed from fd5.json's PRE-ruling meal data; methods.json (D10: plate-truth) already reflects the post-ruling plate (avocado dropped, oil correspondingly raised), so the small positive diffs on days 1/2/4 are the expected, fully-explained net consequence of applying D10, not a data-quality problem.`,
    options: ["Treat as validation failure requiring a STOP", "Recognise as expected net consequence (avocado drop + compensating oil rise) of the D10 ruling PLAN.md itself commissioned; report both figures (chosen)"],
    recommendation: "Report recomputed totals as canonical (methods.json is plate-truth); keep the legacy totals in this entry for audit trail.",
    status: "resolved-by-default",
    resolvedTo: "validation.json week-A-day-totals check reports the recomputed 1671/1675/1670/1650/1694 alongside the legacy 1667/1663/1670/1646/1694, asserting the exact +4/+12/0/+4/0 deltas (avocado-drop + compensating-oil net effect) rather than accepting any diff.",
  });
}

decide({
  topic: "D10: salmon -> eggs, Week B Friday breakfast — verified diff, cited numbers",
  detail:
    "fd5.mealsB.d5b was 'Salmon & egg toast with chilli' (salmon 70g/95g, egg 100g/150g, seeded_bread 45g/55g, spinach 60g/80g, tomato 60g/80g, spring_onion 15g/20g, olive_oil 5g/6g). methods.json's B-5-Breakfast card is 'Scrambled eggs & tomato on seeded toast' (egg 175g/225g — no salmon; spinach 60g/80g, tomato 60g/80g, seeded_bread 55g/70g, spring_onion 15g/20g, olive_oil 5g/6g). Egg quantity rose from 100/150g to 175/225g to replace the dropped salmon's protein. Recomputed macros: her 477 kcal / 35 protein (vs fd5's implied salmon-bearing dish, not separately recomputed here since methods.json is the sole plate-truth source). Matches provisioning.provenance.cutsStuck 'Friday breakfast: salmon -> eggs' note exactly: 'Week B's Friday had 420 g of salmon across two meals at £19.77/kg. The teriyaki dinner is the one worth keeping.'",
  options: ["Keep fd5.json's salmon breakfast", "Use methods.json's eggs breakfast (plate-truth, chosen)"],
  recommendation: "meals.json b-d5b is 'Scrambled eggs & tomato on seeded toast', no salmon.",
  status: "resolved-by-default",
  resolvedTo: "meals.json b-d5b matches methods.json exactly; fd5.json's salmon version is superseded, not separately retained.",
});

// Two additional (previously unnamed) tag diffs discovered between fd5 and methods
{
  const fdMeals = { ...fd5.meals, ...fd5.mealsB };
  const tagDiffs = [];
  for (const [key, meal] of Object.entries(fdMeals)) {
    const isB = key in fd5.mealsB && fd5.mealsB[key] === meal;
    // determine week by checking identity against fd5.mealsB
  }
  // Simpler: iterate both explicitly
  for (const [weekLetter, fdSet] of [["A", fd5.meals], ["B", fd5.mealsB]]) {
    for (const [k, meal] of Object.entries(fdSet)) {
      const slotCap = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" }[meal.slot];
      const card = allCards.find((c) => c.week === weekLetter && c.dayNo === meal.day && c.slot === slotCap);
      if (card && card.tag !== meal.tag) {
        tagDiffs.push({ key: `${weekLetter}${k}`, card: cardKey(card), name: card.name, fd5Tag: meal.tag, methodsTag: card.tag });
      }
    }
  }
  decide({
    topic: "two additional batch/fresh tag diffs found between fd5.json and methods.json (Week B)",
    detail: `Beyond the task-brief-named diffs, a full fd5-vs-methods diff over all 40 cards' tag field found 2 more discrepancies, not previously documented anywhere in PLAN.md: ${JSON.stringify(tagDiffs)}. B-2-Breakfast 'Apple & cinnamon overnight oats': fd5 says tag=fresh, methods says tag=batch (methods.json's Week B midweek note confirms it IS a batch/prep-ahead dish: 'Make the overnight oats — 4 minutes... It is the only dish this week that has to be started the day before', i.e. genuinely prepped in advance, supporting methods' batch tag over fd5's fresh tag). B-3-Snack 'Greek yoghurt, raspberries & seeds': fd5 says tag=batch, methods says tag=fresh (no batch-prep basis found anywhere in the Sunday session data for this snack — supporting methods' fresh tag).`,
    options: ["Keep fd5.json tags", "Use methods.json tags (plate-truth per D10, chosen)"],
    recommendation: "methods.json wins per D10 ('Methods files are plate-truth'), consistent with how the named avocado/salmon diffs were resolved.",
    status: "resolved-by-default",
    resolvedTo: "meals.json b-d2b.tag='batch', b-d3s.tag='fresh' (both from methods.json).",
  });
}

// ---------------------------------------------------------------------------
// §4 content defects — recorded per task brief (resolved-by-default, data kept as-extracted)
// ---------------------------------------------------------------------------

const CONTENT_DEFECTS = [
  {
    topic: "§4 defect: Week A Sunday shreds 335g red cabbage, not 515g — all three consumers identified, fully reconciled",
    detail:
      "methods.json Week A Sunday op 'Shred for two slaws' (clock 1:05) says '335 g red cabbage and 230 g carrot, shredded fine... Thursday's burger slaw and Friday's wrap both come out of this' — naming only TWO consumers. meals.json confirms those two sum to exactly 335g: A-4-Dinner (Smash burger) red_cabbage her=90/him=95 (=185g) + A-5-Lunch (Chicken shawarma wrap) red_cabbage her=70/him=80 (=150g) = 335g exactly. But there is a THIRD consumer the op text omits entirely: A-5-Dinner 'Jerk salmon, rice & red beans' also carries a red_cabbage row, her=80/him=100 (=180g), for its 'slaw of red cabbage and charred pineapple'. 335g + 180g = 515g exactly, matching provisioning.day0's need figure ('Red cabbage, shredded' need=515, buy='1 x 700g') to the gram. This is precisely PLAN §4's own description of the bug: the Sunday-prep instruction (335g) 'omits' the Friday-DINNER slaw (A-5-Dinner, 180g) — distinct from the Friday-LUNCH wrap (A-5-Lunch, already counted in the 335g). All three consumers and the exact reconciliation are now cited; nothing is unexplained.",
    options: ["Silently correct the op body text to 515g and add the third consumer", "Ship the op text as-extracted (335g, two consumers named), flag the full three-consumer/515g reconciliation here (chosen)"],
    recommendation: "Phase 1 rewrite corrects the Sunday-prep instruction to '515 g red cabbage... Thursday's burger slaw, Friday's wrap AND Friday's salmon slaw all come out of this.' Phase 0 ships prep.json's op body verbatim from methods.json (335g, two consumers named).",
    status: "resolved-by-default",
    resolvedTo: "applied in Phase 1 rewrite; prep.json op body text kept as-extracted (335g, naming only the wrap+burger consumers) for now. prep.json's 'Slaw shred' yield consumers array is limited to the two the op text itself names (a-d4d, a-d5l) since yield-consumer mapping is drawn from the yields table, not the op body — a-d5d's separate red_cabbage need is real but is not part of THIS yield's stated consumer list, per the source table.",
  },
  {
    topic: "§4 defect: Week B oil inversions (her > him)",
    detail:
      "Verified present in methods.json: B-2-Dinner 'Basa escovitch' Extra virgin olive oil her=12g/him=10g; B-4-Lunch 'Beef kofta wrap' Extra virgin olive oil her=10g/him=8g. In both cases the smaller (70kg, her) cover is given MORE oil than the larger (85kg, him) cover — backwards from every other oil row in the dataset (all other 209 ingredient rows give him >= her).",
    options: ["Silently swap the figures", "Ship as-extracted, flag here (chosen)"],
    recommendation: "Phase 1 rewrite corrects. Phase 0 meals.json carries the inverted figures as methods.json states them (covers.w.olive_oil=12/10, covers.m.olive_oil=10/8 respectively).",
    status: "resolved-by-default",
    resolvedTo: "applied in Phase 1 rewrite; meals.json b-d2d and b-d4l keep the inverted grams as-extracted.",
  },
  {
    topic: "§4 defect: pancake 'half the skyr' arithmetic",
    detail:
      "A-2-Breakfast 'Protein pancakes with berries' step 2 says 'half the skyr' goes into the batter, step 5 says 'Remaining skyr... on top'. Ingredient table total skyr = her 95g/him 140g. Step text quantifies the batter portion as 48g(her)/70g(him) and the topping as 47g(her)/70g(him) — 48+47=95 (her, exact) but 70+70=140 (him, exact) — actually both halves DO sum correctly to the table total. Flagged here per task brief's §4 list regardless, since 48/47 is not an exact half of 95 (47.5) — a rounding artefact, not a real arithmetic bug; recorded as reviewed-and-found-benign.",
    options: ["Treat as a bug needing correction", "Reviewed: rounding artefact only, no correction needed (chosen)"],
    recommendation: "No Phase 1 action required beyond cosmetic 'half' wording softened to 'about half' if desired.",
    status: "resolved-by-default",
    resolvedTo: "No numeric correction applied — the two halves already sum exactly to the ingredient-table total on both covers.",
  },
  {
    topic: "§4 defect: pizza 'remaining oil' wording",
    detail:
      "A-1-Dinner 'Chicken-crust pizza' step 4 uses '5 g of the oil' for cooking vegetables, out of a table total of her=14g/him=17g; step 7 refers to 'the remaining oil (14/17 g total across the dish)' for dressing the salad — the step 7 wording restates the FULL table total (14/17g) rather than the true remainder after step 4's 5g (which would be 9/12g). This is a wording defect (the step calls the full amount 'remaining' when only part of it remains), not a gram-table error — the ingredient table total (14/17g) is internally consistent with meals.json's covers/macros.",
    options: ["Correct the step wording now", "Ship as-extracted; flag for Phase 1 rewrite (chosen)"],
    recommendation: "Phase 1 rewrite should read '9 g of the remaining oil' or similar.",
    status: "resolved-by-default",
    resolvedTo: "applied in Phase 1 rewrite; meals.json a-d1d step text kept verbatim for now.",
  },
  {
    topic: "§4 defect: kofta onion (40g) missing from B-4-Lunch's card-level ingredient table",
    detail:
      "The Week B Sunday session's kofta tray op specifies '255 g 5% beef mince with 40 g grated onion squeezed dry...' but B-4-Lunch 'Beef kofta wrap with cucumber yoghurt''s own methods.json ingredient table has no separate onion row alongside its 110g/145g beef_mince (Sunday-batch koftas) — the 40g onion is baked INTO the kofta mixture on Sunday and never appears as a per-cover onion gram figure on the consuming card. Confirmed: B-4-Lunch ingredients = [beef_mince, lc_tortilla, greek_yog, cucumber, lettuce, tomato, red_onion(35g/45g — this IS a separate raw-onion garnish row, distinct from the 40g cooked into the kofta), olive_oil]. So there IS a red_onion row on the card, but it is the raw garnish, not the 40g cooked-in onion — the cooked-in 40g is genuinely unaccounted for in per-cover macros.",
    options: ["Add an estimated per-cover share of the cooked-in onion to B-4-Lunch's macros now (guessing a per-portion split of a Sunday-batch ingredient not stated per-cover anywhere)", "Ship as-extracted; the card's macros under-count this small amount, flagged for Phase 1 (chosen)"],
    recommendation: "Phase 1 methods rewrite should either add a per-cover onion row to B-4-Lunch or explicitly note it as a freebie-level seasoning-onion within the kofta mix.",
    status: "resolved-by-default",
    resolvedTo: "applied in Phase 1 rewrite; meals.json b-d4l macros unchanged (as methods.json states), defect flagged.",
  },
  {
    topic: "§4 defect: boiled-egg count (2 vs 2.5)",
    detail:
      "Week A Sunday session boils '4 medium eggs... Two are for Tuesday's snack; the spares will get eaten' (op text says 2 of 4 are earmarked). A-2-Snack 'Suya-spiced eggs & carrots' ingredient table: egg her=50g/him=75g with unitHint '1 / 1½ eggs' — at fd5's own 50g/egg spec unit, 75g = 1.5 eggs, not a whole number, meaning the 'him' cover's boiled-egg allocation from Sunday's batch of 4 is fractional (2 eggs would only cover the 'her' 50g side cleanly; the 'him' side's 75g implies 1.5 eggs, i.e. the batch's 2 earmarked eggs (100g) don't quite stretch to her+him's combined 50+75=125g need without a fractional egg). Recorded as a known table/reality mismatch (Sunday boils whole eggs; the per-cover table wants a fractional egg count for the larger cover).",
    options: ["Round the him-cover figure to a whole-egg equivalent now (guessing which direction to round)", "Ship as-extracted (75g / 1.5 eggs), flag here (chosen)"],
    recommendation: "Phase 1 rewrite should either boil an odd number of eggs or adjust the him-cover gram figure to a clean multiple of 50g.",
    status: "resolved-by-default",
    resolvedTo: "applied in Phase 1 rewrite; meals.json a-d2s.covers.m.egg=75 kept as-extracted.",
  },
  {
    topic: "§4 defect: yield roundings (chicken 600 vs 575g, chickpeas 250 vs 245g) — reproduced exactly from consumer sums",
    detail:
      "Week A Sunday yields table states 'Roast chicken: 600 g raw' (op text TRAY A: 600g chicken breast — batch quantity, matches) with consumers a-d1l/a-d3l/a-d5l (per prep.json). Summing meals.json's actual per-cover chicken grams across those three consuming meals: a-d1l (75+100) + a-d3l (85+110) + a-d5l (95+110) = 175+195+205 = 575g exactly — 25g less than the 600g batched, i.e. Sunday cooks 25g of headroom/wastage-allowance beyond what the three lunches actually plate. Likewise 'Jerk chickpeas: 250 g drained' (op text TRAY B: 250g drained chickpeas) has sole consumer a-d3s; meals.json a-d3s.covers chickpeas her=110+him=135=245g exactly — 5g less than the 250g batched. Both defects reproduce exactly and are fully derivable from join.js's own outputs (prep.json yields[].consumers x meals.json covers): the Sunday batch quantities (600g/250g) are consistently ~4% larger than the sum of what the per-cover gram tables actually call for, i.e. genuine small over-batching, not a transcription error.",
    options: ["Silently shrink the Sunday batch quantities to 575g/245g", "Ship the op text and yields as-extracted (600g/250g batched), cite the exact 575g/245g consumer-sum reconciliation here (chosen)"],
    recommendation: "Phase 1 rewrite should either explain the headroom explicitly (e.g. 'cooks 600g, ~25g extra for taste/loss') or tighten the batch quantity to match consumer demand exactly.",
    status: "resolved-by-default",
    resolvedTo: "applied in Phase 1 rewrite; prep.json yields keep the as-extracted 600g/250g batch figures; the 575g/245g consumer-demand figures are derivable on demand from meals.json and are cited here for the record.",
  },
];
for (const d of CONTENT_DEFECTS) decide(d);

decide({
  topic: "§4 content defects (all seven) — overall disposition",
  detail:
    "Per task brief: all seven §4 arithmetic/content defects are recorded status resolved-by-default, resolution 'applied in Phase 1 rewrite', data kept as-extracted for now. See the seven individual entries immediately above for the verified specifics of each (all seven were checked against the actual extracted data; six reproduce exactly with cited numbers, one — the pancake 'half the skyr' — was checked and found benign/a rounding artefact rather than a real bug).",
  options: ["Fix all seven in the data now (rejected — Phase 0 scope is 'ship originals'; would pre-empt the Phase 1 review checkpoint and the owner's ability to overturn individual items per D10)", "Leave all seven as-extracted in Phase 0, fix in the Phase 1 methods rewrite (chosen, matches D10 and PLAN §4's own phasing)"],
  recommendation: "No Phase 0 data changes from any of the seven; Phase 1 methods rewrite addresses them.",
  status: "resolved-by-default",
  resolvedTo: "meals.json and prep.json carry all seven defects as-extracted from methods.json, matching Phase 0 scope ('Phase 0 ships originals').",
});

decide({
  topic: "pineapple rule amendment sanctioning the Week-B cottage-cheese snack",
  detail:
    "fd5.json's notes[5] ('What is not on the card') lists dishes considered and cut, and notes[8] ('Peas, swaps & the rest') establishes the plan's general swap philosophy, but B-1-Snack 'Cottage cheese, pineapple & chilli' (methods.json: cottage 100g/135g, pineapple 200g/260g, pumpkin_seeds 8g/11g, chia 6g/8g, tinned pineapple chunks griddled) is a real Week B card present in both fd5.mealsB and methods.json — it is not cut. D10 sanctions this dish under an amended 'pineapple rule' (the plan's general low-sugar-fruit discipline is relaxed for this one griddled-tinned-chunk snack). No conflicting data was found anywhere requiring removal of this card; it is included in meals.json as b-d1s exactly as methods.json states it.",
  options: ["Remove the dish as inconsistent with a stricter reading of the fruit rule", "Keep it; D10 amends the rule to explicitly sanction it (chosen)"],
  recommendation: "Keep b-d1s as extracted.",
  status: "resolved-by-default",
  resolvedTo: "meals.json b-d1s present, unmodified, tag='fresh' per methods.json.",
});

// ---------------------------------------------------------------------------
// prep.json
// ---------------------------------------------------------------------------

// Hand-verified op-level ingredient extraction: every "<number> g <ingredient>"
// literal mention in each Sunday op's body text that names a tracked
// ingredient. Seasonings/spice-blend/stock mentions with no gram figure (or
// with only a tsp/tbsp figure, which has no explicit gram conversion stated
// anywhere in the source) are omitted, not guessed. Egg counts are converted
// via fd5.spec's own household-unit gram weight (50g/egg) since that
// conversion is stated directly in the data, not invented.
const OP_INGREDIENTS = {
  A: {
    "Trays in — chicken, chickpeas, peppers": [
      { ingId: "chicken", g: 600 },
      { ingId: "chickpeas", g: 250 },
      { ingId: "peppers_frozen", g: 160 },
      { ingId: "red_onion", g: 70 },
    ],
    "Pan 1 — the bolognese (longest job, start it early)": [
      { ingId: "red_onion", g: 90 },
      { ingId: "carrot", g: 135 },
      { ingId: "courgette", g: 330 },
      { ingId: "turkey_mince", g: 120 },
      { ingId: "passata", g: 400 },
    ],
    "Pan 2 — chipotle beef": [{ ingId: "beef_mince", g: 165 }],
    "Pan 3 — efo riro base (no spinach)": [
      { ingId: "peppers_frozen", g: 160 },
      { ingId: "red_onion", g: 90 },
      { ingId: "passata", g: 220 },
      { ingId: "egusi", g: 27 },
    ],
    "Eggs on": [{ ingId: "egg", g: 200 }], // 4 medium eggs x 50g (fd5.spec household unit)
    "Pan 2 free — plain rice on": [{ ingId: "brown_rice", g: 320 }],
    "Pan 3 free — the jollof": [{ ingId: "brown_rice", g: 95 }],
    "Rice the cauliflower — the big job": [{ ingId: "cauliflower", g: 1400 }],
    "Shred for two slaws": [
      { ingId: "red_cabbage", g: 335 }, // as-extracted; see §4 defect entry (true weekly need is 515g)
      { ingId: "carrot", g: 230 },
    ],
    "The two jars": [{ ingId: "greek_yog", g: 115 }],
  },
  B: {
    "Tray A — the week's chicken": [{ ingId: "chicken", g: 760 }],
    "Pan 1 — turkey and okra stew": [
      { ingId: "red_onion", g: 90 },
      { ingId: "peppers_frozen", g: 160 },
      { ingId: "turkey_mince", g: 280 },
      { ingId: "passata", g: 260 },
      { ingId: "okra", g: 270 },
    ],
    "Tray B — the koftas": [
      { ingId: "beef_mince", g: 255 },
      { ingId: "red_onion", g: 40 },
    ],
    "Eggs on": [{ ingId: "egg", g: 300 }], // 6 medium eggs x 50g
    "Pan 3 — the rice": [{ ingId: "brown_rice", g: 380 }],
    "Rice the cauliflower": [{ ingId: "cauliflower", g: 810 }],
  },
};

// Hand-parsed yield consumers. Where the yield table names a weekday without
// a slot word ("Tue x2" etc.) the consuming meals are cross-checked against
// the actual meals.json ingredient tables for that ingredient/week rather
// than guessed from prose. Two Week-B jars (suya, chilli salt) are seasoning
// blends that appear in step PROSE, not as a tracked gram-quantified
// ingredient row anywhere — their consumers cannot be derived from ingredient
// presence, so they are left as prose-only (see decisions-queue).
function consumersForIngredientAcrossWeek(week, ingId) {
  return allCards
    .filter((c) => c.week === week && c.ingredients.some((i) => resolveIngId(c, i.name) === ingId))
    .map((c) => mealId(c.week, c.dayNo, c.slot));
}

const YIELD_CONSUMERS = {
  A: {
    "Roast chicken": ["a-d1l", "a-d3l", "a-d5l"],
    "Chipotle beef": ["a-d2l"],
    "Turkey bolognese": ["a-d4l"],
    "Efo riro base": ["a-d3l"],
    "Jerk chickpeas": ["a-d3s"],
    "Boiled eggs": ["a-d2s"],
    "Plain brown rice": ["a-d1l", "a-d2l", "a-d2d"],
    Jollof: ["a-d3l"],
    "Riced cauliflower": consumersForIngredientAcrossWeek("A", "cauliflower"), // cross-checked, see decisions-queue
    "Slaw shred": ["a-d4d", "a-d5l"],
    "White sauce": ["a-d1l"],
  },
  B: {
    "Roast chicken": ["b-d1l", "b-d2l", "b-d5l"],
    "Turkey & okra stew": ["b-d3l"],
    "Beef koftas": ["b-d4l"],
    "Boiled eggs": ["b-d2s"],
    "Brown rice": ["b-d1l", "b-d3l", "b-d2d"],
    "Riced cauliflower": consumersForIngredientAcrossWeek("B", "cauliflower"),
    "Suya jar": null, // prose-only, see decisions-queue
    "Chilli salt jar": null, // prose-only, see decisions-queue
  },
};

{
  const aCauli = YIELD_CONSUMERS.A["Riced cauliflower"];
  const bCauli = YIELD_CONSUMERS.B["Riced cauliflower"];
  decide({
    topic: "prep.json yield consumers: cross-checked against meals.json instead of parsing ambiguous prose",
    detail:
      `Week A 'Riced cauliflower' yield consumers text reads 'Mon, Tue x2, Wed, Fri' with no slot words. Cross-checking against actual meals.json cauliflower use for Week A gives exactly 5 meals: ${JSON.stringify(aCauli)} (Mon lunch=1, Tue lunch+dinner=2, Wed lunch=1, Fri dinner=1 — matches the prose's day-by-day mention counts, including the 'x2' on Tuesday, exactly). Week B 'Riced cauliflower' text ('Mon lunch, Tue + Fri dinner') parses cleanly without cross-referencing: ${JSON.stringify(bCauli)}. Week B 'Suya jar' ('Tue, Wed x2, Fri') and 'Chilli salt jar' ('Tue snack, and everywhere else') were NOT resolved this way because suya/chilli-salt are seasoning blends with no tracked ingredient id and no gram-quantified row on any card — there is nothing in meals.json to cross-reference against, so their consumers are left null (prose preserved in the yield's qty/component fields) rather than guessed.`,
    options: ["Parse all consumer strings with a generic day/slot text parser (rejected for the ×2/bare-weekday cases — too fragile, risks wrong slot assignment)", "Cross-check against real ingredient presence in meals.json wherever the yield maps to a single tracked ingredient; leave prose-only where it doesn't (chosen)"],
    recommendation: "As chosen.",
    status: "resolved-by-default",
    resolvedTo: "prep.json yields[].consumers is a meal-id array for 9/11 (Week A) and 6/8 (Week B) yields; null for the 2 seasoning-jar yields in Week B.",
  });
}

function parseTotalMin(ops) {
  const last = ops[ops.length - 1];
  const m = last.clock.match(/^(\d+):(\d+)$/);
  return m ? +m[1] * 60 + +m[2] : null;
}

let prep = ["A", "B"].map((wk) => {
  const s = methods.weeks[wk].sunday;
  return {
    week: wk,
    sessionName: s.theme,
    totalMin: parseTotalMin(s.ops),
    ops: s.ops.map((o) => ({
      clock: o.clock,
      title: o.title,
      body: o.body,
      station: o.kit,
      ingredients: OP_INGREDIENTS[wk][o.title] ?? [],
    })),
    yields: s.yields.map((y) => ({
      component: y.component,
      qty: y.qty,
      consumers: YIELD_CONSUMERS[wk][y.component] ?? null,
      storage: y.storage,
    })),
    midweek: s.midweek,
    rev: "A",
    approved: false,
  };
});

// ---------------------------------------------------------------------------
// calendar.json — a+b (as extracted) + a-twice (regenerated)
// ---------------------------------------------------------------------------

const CALENDAR_ITEM_NAME_TO_ID = {
  chicken: "chicken",
  "chicken breast mince": "chicken_mince",
  Basa: "tilapia",
  "Sirloin steak": "beef_steak",
  Salmon: "salmon",
  "turkey mince": "turkey_mince",
  "kofta mince": "beef_mince",
  "smash-taco mince": "beef_mince",
};

function opPhase(op) {
  if (op.kit === "Shop") return "shop";
  if (op.items.length === 0) return "prep";
  return "defrost";
}

// A "shop"-phase op can still carry defrost-move ITEMS: provisioning's own
// day-7 "THE TOP-UP" op mixes a genuine top-up buy (5 unitemized produce
// lines, described only in body prose) with a freezer->fridge bring-down of
// ALREADY-PURCHASED frozen meat for tomorrow's session ("Then bring down
// Week B's chicken (1,270 g...), the turkey mince (280 g) and the kofta
// mince (255 g), all for tomorrow" — every itemized quantity in that op is a
// bring-down, not a purchase; the actual top-up buy is never itemized at
// all). So op-level phase is NOT a reliable proxy for item-level move —
// detect "bring down" in the body text explicitly, per item-owning op.
function moveForOp(op) {
  if (opPhase(op) === "defrost") return "freezer → fridge";
  if (/bring down/i.test(op.body ?? "")) return "freezer → fridge";
  return "buy";
}

const WEEKDAY_CYCLE = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
function weekdayForDay(dayNo) {
  return WEEKDAY_CYCLE[dayNo % 7];
}

const abCalendar = provisioning.defrostCalendar.map((op) => ({
  variant: "a+b",
  day: op.dayNo,
  weekday: op.weekday,
  phase: opPhase(op),
  title: op.title,
  body: op.body,
  station: op.kit,
  items: op.items.map((it) => {
    const ingId = CALENDAR_ITEM_NAME_TO_ID[it.name];
    if (!ingId) stop(`Unrecognised defrost-calendar item name "${it.name}".`, { it }, Object.keys(CALENDAR_ITEM_NAME_TO_ID));
    return { ingId, g: it.grams, move: moveForOp(op) };
  }),
}));

decide({
  topic: "a+b calendar: day-7 items are defrost bring-downs, not buys — move field corrected",
  detail:
    "provisioning.defrostCalendar's day-7 'THE TOP-UP' op has kit:'Shop' (a shopping day), which the original opPhase()-only move logic read as move:'buy' for ALL of its items. But the op's own body text is explicit that every itemized quantity (chicken 1270g, turkey mince 280g, kofta mince 255g) is a freezer->fridge bring-down for tomorrow's Week B Sunday session ('Then bring down Week B's chicken... the turkey mince... and the kofta mince... all for tomorrow') — the actual day-7 shopping (five produce lines, 'under nine pounds') is never itemized in items[] at all, only described in prose. Fixed via moveForOp(): a 'shop'-phase op's items still get move:'freezer → fridge' if the op body contains 'bring down' (case-insensitive), matching the source text precisely; otherwise 'buy'. Day-0's 'THE BIG SHOP' body has no 'bring down' text and correctly keeps move:'buy' for its chicken 770g/chicken_mince 140g (freshly purchased, going straight to fridge).",
  options: ["Leave day-7 items as move:'buy' (contradicts the op's own body text)", "Detect 'bring down' in body text and override to 'freezer → fridge' per item-owning op (chosen)"],
  recommendation: "As chosen — moveForOp() is now the single source of truth for both the a+b and a-twice variants' item moves.",
  status: "resolved-by-default",
  resolvedTo: "calendar.json a+b day-7 items (chicken, turkey_mince, beef_mince/kofta) now carry move:'freezer → fridge'.",
});

// a-twice: days 0-6 = clone of a+b's Week-A ops (dayNo 0,1,3,4,5) unmodified;
// day 7 = new top-up shop op from shoppinglist.day7Card; days 8,10,11,12 =
// the SAME Week-A defrost moves (days 1,3,4,5) shifted +7, since pass 2 cooks
// the identical Week-A recipes a second time. No op on days 2,6,9,13 (matches
// the original calendar's own gaps on days 2 and 6).
const weekAOps = provisioning.defrostCalendar.filter((op) => op.week === "A");

const twiceDay0 = weekAOps.find((op) => op.dayNo === 0);
const day0Adapted = {
  variant: "a-twice",
  day: 0,
  weekday: "Sat",
  phase: "shop",
  title: twiceDay0.title,
  body:
    twiceDay0.body +
    " (A-twice variant: this single day-0 shop buys enough of every Week-A ingredient for BOTH passes through the fortnight — the canonical FD5-Shopping-List.html basket already doubles quantities for this reason, e.g. 2x1kg chicken packs.)",
  station: twiceDay0.kit,
  items: twiceDay0.items.map((it) => {
    const ingId = CALENDAR_ITEM_NAME_TO_ID[it.name];
    return { ingId, g: it.grams, move: "buy" };
  }),
};

const pass1Ops = weekAOps
  .filter((op) => op.dayNo !== 0)
  .map((op) => ({
    variant: "a-twice",
    day: op.dayNo,
    weekday: op.weekday,
    phase: opPhase(op),
    title: op.title,
    body: op.body,
    station: op.kit,
    items: op.items.map((it) => ({
      ingId: CALENDAR_ITEM_NAME_TO_ID[it.name],
      g: it.grams,
      move: moveForOp(op),
    })),
  }));

// day 7 = the real A-twice top-up (shoppinglist.day7Card) PLUS the pass-2
// freezer bring-down for tomorrow's (day 8) Sunday session — chicken 770g +
// chicken_mince 140g, the same quantities pass 1 kept out on day 0, since
// pass 2 cooks the identical Sunday session a second time. This mirrors the
// a+b source's own day-7 op exactly (one op = top-up shop + "bring down ...
// for tomorrow"); the canonical basket buys chicken FROZEN ("Frozen chicken
// breast fillets 1kg" x2, tag "Freeze on arrival"; put-away keeps only pass
// 1's 770g+140g out), so pass 2's chicken genuinely needs its own bring-down.
const day7ChickenBringDown = [
  { ingId: "chicken", g: 770, move: "freezer → fridge" },
  { ingId: "chicken_mince", g: 140, move: "freezer → fridge" },
];

const day7TopUp = {
  variant: "a-twice",
  day: 7,
  weekday: "Sat",
  phase: "shop",
  title: "THE TOP-UP",
  body: `Seven lines, ${shoppinglist.day7Card.totalShown}, restocking the short-life produce that would not have lasted the second Week-A pass: ${shoppinglist.day7Card.rows.map((r) => r.name).join(", ")}. Sourced from FD5-Shopping-List.html's day-7 card (the canonical A-twice top-up), not from provisioning.json's Week-B-specific day-7 table. Then bring down the second pass's chicken (770 g) and chicken breast mince (140 g) from the freezer — it needs a full night before tomorrow's Sunday session, exactly as the source A+B calendar's own day-7 op brings down Week B's meat the night before Week B's prep.`,
  station: "Shop",
  items: [
    ...shoppinglist.day7Card.rows
      .map((r) => {
        const ids = aliasMap[r.name];
        if (!ids) stop(`No alias-map entry for day7Card row "${r.name}".`, { r }, []);
        return ids.map((ingId) => ({ ingId, g: r.pack * r.qty, move: "buy" }));
      })
      .flat(),
    ...day7ChickenBringDown,
  ],
};

const pass2Ops = weekAOps
  .filter((op) => [1, 3, 4, 5].includes(op.dayNo))
  .map((op) => {
    const day = op.dayNo + 7;
    // day 8 (dayNo 1, "Week A prep") verbatim-reuses pass 1's body, which
    // falsely says "Nothing needs defrosting for it" — true for pass 1 (day
    // 1) but FALSE for pass 2 (day 8), which depends on last night's (day 7)
    // chicken/mince bring-down and today's own mozzarella bring-down (see
    // the separate day-8 "Mozzarella down" entry below). Body corrected for
    // this one op only; every other pass-2 op's body is unmodified apart
    // from the day-number annotation.
    const body =
      op.dayNo === 1
        ? op.body.replace(
            "Nothing needs defrosting for it.",
            "Chicken and chicken breast mince should already be down from the freezer (see Saturday's top-up op) — this pass, unlike pass 1's day-0 shop, starts from frozen stock, not a fresh buy. The frozen mozzarella half also needs to come down today, ready for tomorrow's pizza (see the separate 'Mozzarella down' op)."
          )
        : op.body;
    return {
      variant: "a-twice",
      day,
      weekday: weekdayForDay(day),
      phase: opPhase(op),
      title: op.title,
      body: body + " (second Week-A pass, day " + day + ")",
      station: op.kit,
      items: op.items.map((it) => ({
        ingId: CALENDAR_ITEM_NAME_TO_ID[it.name],
        g: it.grams,
        move: moveForOp(op),
      })),
    };
  });

// Frozen mozzarella-half bring-down for pass 2's Monday pizza (day 9).
// register.storageRegister "Mozzarella, reduced fat, block": "Freezer →
// fridge", "3 weeks sealed · 4 days open"; shoppinglist.json's put-away card:
// "Halve the mozzarella - one half frozen — it gets opened twice, eight days
// apart" (day 1 = pass 1's pizza, day 9 = pass 2's pizza: exactly 8 days
// apart, confirming day 9 as the second use). Sensible lead time, matching
// every other single-day-ahead bring-down in this calendar (chicken/basa/
// steak/salmon all come down exactly one day before use): day 8 (Sunday),
// one day ahead of day-9 (Monday) pizza.
const day8MozzarellaDown = {
  variant: "a-twice",
  day: 8,
  weekday: weekdayForDay(8),
  phase: "defrost",
  title: "Mozzarella down for Monday's pizza",
  body:
    "The half-block frozen on day 0 needs to come down today for tomorrow's (day 9) pizza — register: 'Freezer → fridge', 'Mozzarella... it gets opened twice, eight days apart' (day 1 and day 9 are exactly 8 days apart).",
  station: "Fridge",
  items: [{ ingId: "mozzarella", g: 125, move: "freezer → fridge" }],
};

const aTwiceCalendar = [day0Adapted, ...pass1Ops, day7TopUp, ...pass2Ops, day8MozzarellaDown].sort(
  (a, b) => a.day - b.day
);

const calendar = [...abCalendar, ...aTwiceCalendar];

decide({
  topic: "a-twice calendar regeneration methodology (D5) — corrected after Fable review cycle 1",
  detail:
    "provisioning.json's defrostCalendar was authored for the A+B fortnight (days 0-5 = Week A, days 7-12 = Week B-specific moves: Basa 370g for escovitch, kofta/smash-taco mince, salmon 255g for teriyaki — none of which apply to an A-twice fortnight, which repeats Week A's own recipes). Regeneration method: (1) days 0-6 = the A+B calendar's own Week-A ops (dayNo 0,1,3,4,5), reused verbatim — these ARE genuinely Week-A-specific and correct for pass 1 regardless of what happens in week 2; day-0's body text is lightly adapted to note it buys for two passes. (2) day 7 = a NEW 'THE TOP-UP' shop op built from shoppinglist.json's day7Card (the actual canonical A-twice top-up: 7 rows, £8.58), replacing provisioning's Week-B-specific day-7 table entirely, PLUS — corrected in review cycle 1 — a freezer->fridge bring-down of pass 2's chicken (770g) and chicken breast mince (140g), mirroring the A+B source's own day-7 op which combines a top-up shop with 'bring down Week B's chicken... for tomorrow' in a single op. This is necessary because the canonical basket buys chicken FROZEN (shoppinglist.json row 0: 'Frozen chicken breast fillets 1kg' x2, tag 'Freeze on arrival'; the put-away card only keeps pass 1's 770g+140g out of the freezer) — without this move, pass 2's Sunday session (day 8) would have no thawed chicken. (3) days 8,10,11,12 = the SAME Week-A defrost moves from days 1,3,4,5, mechanically shifted +7 days, because pass 2 cooks the identical Week-A recipes a second time and therefore needs the identical defrost lead times against the storage register (chicken/basa/steak/salmon freshDays all read directly from the register in ingredients.json). Day 8's body text — corrected in review cycle 1 — no longer claims 'nothing needs defrosting' (true for pass 1's day 1, false for pass 2, which depends on last night's chicken bring-down and today's mozzarella bring-down). (4) NEW in review cycle 1: a day-8 'Mozzarella down for Monday's pizza' entry, freezer->fridge, 125g (the half-block frozen on day 0 per the put-away card's 'Halve the mozzarella... one half frozen — it gets opened twice, eight days apart' — day 1 and day 9 pizzas are exactly 8 days apart, confirming day 9 as the second use, so day 8 is the correct one-day-ahead lead time matching every other bring-down in this calendar). No op on days 2,6,9,13, matching the original calendar's own gaps on days 2 and 6 (no defrost move needed those days in Week A pass 1, so none in pass 2 either). " +
    "Known residual gap, inherited unchanged from the a+b source (not introduced by the regeneration): provisioning.defrostCalendar's day-3 'Down for Wednesday' op body reads 'Basa (230 g) and the prawns, for Wednesday's pepper soup' but its structured items[] array contains ONLY Basa (230g) — prawns are named in body prose with no gram figure captured in the structured data anywhere in provisioning.json (the actual prawns gram figure, her=40/him=55, lives only in meals.json's A-3-Dinner covers). join.js does not invent a prawns calendar item for this gap, in either variant, since provisioning.js (out of scope to modify) never extracted one — see the prep-op-ingredient-extraction decision entry for the same category of gap.",
  options: [
    "Guess new Week-A-repeat-specific moves from scratch (rejected — no basis; the mechanical +7 shift IS the correct 'same meal-driven moves recomputed' per D5's own wording)",
    "Reuse Week-A's own defrost pattern for both passes, shifted +7 for pass 2, with day 7 replaced by the real A-twice top-up, PLUS explicit pass-2 freezer bring-downs (chicken/mince on day 7, mozzarella on day 8) that the source's own day-7 precedent requires (chosen)",
  ],
  recommendation: "As chosen. Reviewable — if freezer stock timing differs between pass 1 and pass 2 in practice (e.g. because pass 1 already drew down some frozen stock), that is a Phase 2 inventory-tracking concern, not a Phase 0 calendar-authoring one.",
  status: "resolved-by-default",
  resolvedTo: "data/calendar.json contains both variant:'a+b' (10 ops, as extracted, day-7 items now correctly move:'freezer → fridge') and variant:'a-twice' (11 ops: day0 adapted, days1/3/4/5 verbatim, day7 top-up+chicken-bring-down, day8 mozzarella-down (new), days8/10/11/12 = +7 shift of days1/3/4/5 with day8's body corrected).",
});

// ---------------------------------------------------------------------------
// plan.json
// ---------------------------------------------------------------------------

function parseRange(s) {
  const cleaned = s.replace(/,/g, "").replace(/g$/, "").trim();
  const m = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
  return m ? [+m[1], +m[2]] : null;
}

// mealsList is an explicit parameter (not a closure over the module-level
// `let meals`) precisely so this function can never silently read a stale
// snapshot depending on where in the file it happens to be called from —
// see the "Final targets re-banding" section below, which is the ONLY
// place this is called, deliberately after the Phase 1 overlay has finished
// mutating `meals` (a Fable review cycle 1 FIX: this used to be called
// before the overlay, producing kcal bands frozen at pre-seasoning Phase 0
// values that real post-overlay days then busted).
// Fable review cycle 2 FIX (root cause, both canonical and variant bands):
// bands used to be built from PER-MEAL ROUNDED macros (meals[].macros —
// Math.round'd kcal/protein/netCarb/fat, round1'd fibre) summed per day and
// then floor/ceil'd again. The app itself sums the RAW per-cover gram
// covers directly (never meals[].macros), so a day whose rounded-macro sum
// landed exactly on a band edge could have its true (unrounded) sum spill
// 0.0-0.9 past that edge — e.g. Monday's her cover read 102 (rounded) but
// summed 102.2 raw, band ceiling frozen at 102, spurious "over band" arrow.
// Fix: recompute every meal's macros UNROUNDED straight from its own
// `covers` (grams) x the FINAL `ingredients` per100g table — bypassing
// meals[].macros entirely for band purposes — sum those raw floats per day,
// and only then floor(min)/ceil(max) across the day set. This is the same
// arithmetic recompute() / recomputeMacros() already do, minus their final
// Math.round/round1 step; meals[].macros itself is untouched (still
// rounded, still what meal cards display) since only band derivation needed
// the raw values.
function unroundedCoverMacros(coverGrams) {
  let kcal = 0,
    protein = 0,
    fibre = 0,
    carb = 0,
    fat = 0;
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

function dayTotalsForWeek(mealsList, week, coverKey) {
  const totals = { kcal: [], protein: [], netCarb: [], fat: [], fibre: [] };
  for (let d = 1; d <= 5; d++) {
    const dayMeals = mealsList.filter((m) => m.week === week && m.day === d);
    const sum = { kcal: 0, protein: 0, netCarb: 0, fat: 0, fibre: 0 };
    for (const m of dayMeals) {
      const raw = unroundedCoverMacros(m.covers[coverKey]);
      for (const k of Object.keys(sum)) sum[k] += raw[k];
    }
    // No intermediate rounding — bandFrom floors/ceils the true unrounded
    // day total, matching how the app itself sums covers.
    for (const k of Object.keys(totals)) totals[k].push(sum[k]);
  }
  return totals;
}

function bandFrom(totals) {
  const band = {};
  for (const [k, arr] of Object.entries(totals)) {
    band[k] = [Math.floor(Math.min(...arr)), Math.ceil(Math.max(...arr))];
  }
  return band;
}

function bandsForAllWeeks(mealsList) {
  return {
    A: { w: bandFrom(dayTotalsForWeek(mealsList, "A", "w")), m: bandFrom(dayTotalsForWeek(mealsList, "A", "m")) },
    B: { w: bandFrom(dayTotalsForWeek(mealsList, "B", "w")), m: bandFrom(dayTotalsForWeek(mealsList, "B", "m")) },
  };
}

// The ACTUAL `targets`/`plan` objects are assembled further down, in
// "Final targets re-banding + plan assembly", AFTER the Phase 1 overlay
// section — never here, since re-banding must read final (post-overlay)
// meals.json (Fable review cycle 1 FIX). But the DECIDE() CALL for this
// topic fires HERE, at its original sequence position, so its id (D0-026)
// never shifts and every decision after it keeps its own id too — decide()
// ids are assigned by call order and tools/extract/owner-rulings.json
// references D0-003/030/031 by that exact id string, so nothing may ever
// reorder relative to what fired before/after it. `targetsDecision` is a
// live reference into the decisions array; its detail/resolvedTo text is
// amended in place once the real post-overlay numbers exist, further down.
// NOTE: only the ID is trustworthy to hold onto across that gap, not the
// object reference itself — the owner-rulings overlay (which runs before
// the meal-rewrite overlay, further down) reassigns `decisions` to a FRESH
// array of copies (applyOwnerRulings maps every entry, including this one,
// to stamp resolvedBy), so the object decide() returns here gets orphaned;
// mutating it later would silently vanish. The amendment step below looks
// the entry up by id from whatever `decisions` currently IS, not from this
// stale reference.
const targetsDecisionId = decide({
  topic: "re-banded macro targets per week, old vs new (D10)",
  detail:
    "Placeholder — this decide() call fires here (preserving its D0-026 id) purely to hold its sequence position; the real per-week band numbers only exist after the Phase 1 rewrite-overlay section runs (data/rewrites/*, tools/extract/approvals.json), since a seasoning-weighed or D0-003-substituted meal legitimately changes its day's kcal total. See the amended text further down in this same entry (join.js looks this entry up by id and amends it in place right after computing final targets/plan) — if you are reading this exact sentence in data/decisions-queue.json, the amendment step did not run and something is wrong.",
  options: ["Keep the single old fixed band for both weeks", "Re-band per week from the 5 recomputed day totals (D10, chosen)"],
  recommendation: "Placeholder — amended after the overlay runs.",
  status: "resolved-by-default",
  resolvedTo: "Placeholder — amended after the overlay runs.",
}).id;

{
  const basketMain = shoppinglist.shops.reduce((s, sh) => s + parseFloat(sh.subtotalShown.replace("£", "")), 0);
  const basketTopUp = parseFloat(shoppinglist.day7Card.totalShown.replace("£", ""));
  const fortnightTotal = +(basketMain + basketTopUp).toFixed(2);
  var economics = {
    basketMain: { amount: +basketMain.toFixed(2), basis: "sum of shoppinglist.json shops[].subtotalShown (S £82.51 + M £81.76 + X £8.30, per the 2026-08-11 owner-ruled canonical revision), the day-0 canonical basket for one Week-A pass" },
    basketDay7TopUp: { amount: basketTopUp, basis: "shoppinglist.json day7Card.totalShown, the second-pass produce top-up" },
    fortnightTotal: { amount: fortnightTotal, basis: `£${basketMain.toFixed(2)} (day-0 basket) + £${basketTopUp.toFixed(2)} (day-7 top-up) over the 14-day A-twice fortnight` },
    perDay: { amount: +(fortnightTotal / 14).toFixed(2), basis: `£${fortnightTotal.toFixed(2)} ÷ 14 days` },
    perPersonPerDay: { amount: +(fortnightTotal / 14 / 2).toFixed(2), basis: `£${fortnightTotal.toFixed(2)} ÷ 14 days ÷ 2 people` },
  };
}

{
  const s = shoppinglist.shops.reduce((acc, sh) => ({ ...acc, [sh.code]: parseFloat(sh.subtotalShown.replace("£", "")) }), {});
  // Gate values as of the 2026-08-11 owner-ruled canonical revision (was
  // 55 lines / £179.31 / S£72.70 / M£98.31 / X£8.30; day-7 £8.58/7 rows —
  // see the "canonical-revision-2026-08-11-adopted" decision below for the
  // full old-vs-new numbers and the 6 reclassified ingredients).
  check(
    "costs-sum-172.57-per-shop-subtotals",
    shoppinglist.rows.length === 49 &&
      Math.abs(shoppinglist.costsChecksum.sum - 172.57) < 0.001 &&
      s.S === 82.51 &&
      s.M === 81.76 &&
      s.X === 8.3,
    `rows=${shoppinglist.rows.length}, costsChecksum.sum=${shoppinglist.costsChecksum.sum}, per-shop=${JSON.stringify(s)}`
  );
  check(
    "day7-topup-6.93-per-2026-08-11-revision",
    shoppinglist.day7Card.rows.length === 6 && Math.abs(shoppinglist.day7Card.totalShown.replace("£", "") - 6.93) < 0.001,
    `day7Card rows=${shoppinglist.day7Card.rows.length}, totalShown=${shoppinglist.day7Card.totalShown}`
  );
  const legacyByShop = {};
  for (const r of shoppinglist.legacy.rows) {
    legacyByShop[r.shop] = (legacyByShop[r.shop] ?? 0) + parseFloat(r.priceShown.replace("£", ""));
  }
  for (const k in legacyByShop) legacyByShop[k] = +legacyByShop[k].toFixed(2);
  check(
    "week-A-x3-reproduces-257.32-legacy",
    Math.abs(shoppinglist.legacy.totalShown.replace("£", "") - 257.32) < 0.001 &&
      legacyByShop.S === 102.58 &&
      legacyByShop.M === 145.24 &&
      legacyByShop.X === 9.5,
    `legacy.totalShown=${shoppinglist.legacy.totalShown}, per-shop=${JSON.stringify(legacyByShop)}`
  );
}

// ---------------------------------------------------------------------------
// Legacy estimate flags <-> D.prices.ver:0 checksum
// ---------------------------------------------------------------------------

{
  const legacyByName = new Map(shoppinglist.legacy.rows.map((r) => [r.name, r]));
  let matched = 0;
  const mismatched = [];
  for (const r of shoppinglist.legacy.rows) {
    const id = nameToId[r.name];
    const fp = id ? fd5.prices[id] : null;
    if (!fp) continue;
    if ((fp.ver === 0) === r.estimateMark) matched += 1;
    else mismatched.push({ name: r.name, id, legacy: r.estimateMark, fd5: fp.ver === 0 });
  }
  const legacyEstTrueCount = shoppinglist.legacy.rows.filter((r) => r.estimateMark).length;
  const fd5Ver0Count = Object.values(fd5.prices).filter((p) => p.ver === 0).length;
  const orphan = Object.entries(fd5.prices).find(([id, p]) => p.ver === 0 && !legacyByName.has(fd5.spec[id][0]));

  check(
    "legacy-est-flags-vs-D-prices-ver0",
    shoppinglist.legacy.rows.length === 54 && matched === 54 && mismatched.length === 0,
    `legacy rows=${shoppinglist.legacy.rows.length}, matched=${matched}/54, mismatched=${JSON.stringify(mismatched)}. legacy estimateMark=true count=${legacyEstTrueCount}, fd5.prices ver:0 count=${fd5Ver0Count} (differ by 1: "${orphan?.[0]}" has an fd5.prices entry marked ver:0 but no legacy shopping-list row at all).`
  );
  decide({
    topic: "legacy est-flags vs D.prices.ver:0: the '41 each' checksum does not hold exactly — explained",
    detail: `The task brief's checksum #6 expects 41=41. Measured: legacy shopping-list.html (54 rows, matches shoppinglist.js's own checksum) has 40 rows with estimateMark=true, not 41. fd5.json D.prices has 41 entries with ver:0. The two sets match 1:1 with ZERO conflicts on the 54 ids they share (matched=54/54) — the count discrepancy (40 vs 41) is fully explained by "whey": fd5.prices.whey has ver:0 (an estimate) but whey has NO row in the 54-line legacy shopping list at all (consistent with whey being one of the 5 vestigial/retired ingredients — see retired.json — it was priced speculatively in fd5.json but never actually bought on either shopping list).`,
    options: ["Report a false '41=41 pass'", "Report the true 40-matched-of-54 + 1-orphan(whey) breakdown (chosen)"],
    recommendation: "validation.json records: 54/54 legacy rows matched fd5.prices.ver with zero conflicts; fd5.prices' 41st ver:0 entry (whey) has no legacy counterpart, fully explained by whey's retired/vestigial status.",
    status: "resolved-by-default",
    resolvedTo: "validation.json checksum reports 54/54 matched, 0 conflicts, and cites the whey orphan explicitly.",
  });
}

// ---------------------------------------------------------------------------
// Remaining judgment calls (storage-class derivation, naming heuristics, gaps)
// ---------------------------------------------------------------------------

decide({
  topic: "storage.class derivation: provisioning day0 'pill' text -> storage class enum",
  detail:
    `Every one of the 54 non-added ingredients' storage.class comes from provisioning.json's day0[].pill field via a fixed, exhaustive lookup table (verified: exactly 5 distinct pill strings appear across all 54 day0 rows, no others): 'Freeze on day 0'->freeze-day0, 'Buy once'->buy-once, 'Buy frozen'->buy-frozen, 'Day-7 top-up'->topup, 'Buy mixed ripeness'->stagger. This is a clean bijection onto the PLAN §5 enum {buy-once, freeze-day0, buy-frozen, stagger, topup} — every enum value is used, no pill string was left unmapped, and join.js STOPs (does not guess) if an unrecognised pill string is ever encountered. The 3 addedInExtraction ingredients (no day0 row) were assigned class by analogy instead: peppers_frozen='buy-frozen' (its shopping-list tag is 'Freezer aisle', matching every other buy-frozen sibling); sweetheart_cabbage and rapeseed_oil='buy-once' (shopping-list tag 'Store normally', matching every other buy-once sibling with that tag).`,
  options: ["Derive class from the register's location/life text instead (rejected — less direct than the purpose-built pill field, and the register has no pill-equivalent column)", "Use day0.pill via the 5-value lookup table (chosen)"],
  recommendation: "As chosen — fully mechanical, zero ambiguity encountered in practice (all 54 rows matched one of the 5 known pills).",
  status: "resolved-by-default",
  resolvedTo: "ingredients.json storage.class populated for all 57 ids; 54 from day0.pill, 3 by documented analogy.",
});

decide({
  topic: "register-map.json methodology: exact-name join, not fuzzy",
  detail:
    "register-map.json was generated by joining provisioning.json's 54 storageRegister[].item strings against fd5.json's spec[id][0] display names with EXACT string equality (===), then hand-verified: 54/54 matched, 0 unmatched, 0 collisions (no two register rows resolved to the same id, no register row failed to resolve). Because the match rate was already 100% on first attempt, no fuzzy step (edit distance, substring, case-folding) was ever invoked or needed — recorded here per the task brief's instruction to log 'any ... register-mapping judgment calls', even though the outcome required none.",
  options: ["Fuzzy-match any near-misses (not needed — there were none)", "Exact match only (chosen, and sufficient)"],
  recommendation: "No further action; the join is airtight.",
  status: "resolved-by-default",
  resolvedTo: "register-map.json's 54 entries are all exact-name matches; see tools/extract/register-map.json's own header comment.",
});

decide({
  topic: "ingredients.json name.canonical heuristic",
  detail:
    "PLAN §5 specifies name:{display, short, canonical} but does not define how 'canonical' differs from 'display' beyond implying a plainer form. join.js derives canonical as the display name truncated at its first comma or open-parenthesis (e.g. 'Greek yoghurt, 0% fat' -> 'Greek yoghurt'; 'Cheddar, reduced fat (~14%)' -> 'Cheddar'; 'Extra virgin olive oil' -> unchanged, no comma/paren present). This is a deterministic, documented rule applied uniformly to all 57 ingredients, not a per-item judgment call — flagged here because no source file defines a third name variant explicitly.",
  options: ["Leave canonical === display (loses the distinction PLAN §5 implies)", "Derive via comma/paren truncation (chosen)"],
  recommendation: "Revisit in Phase 1/2 if the dashboard's search/filter UI needs a different canonicalisation rule (e.g. singular/plural normalisation).",
  status: "open",
  resolvedTo: null,
});

decide({
  topic: "sku.verifiedOn is null for all 57 ingredients",
  detail:
    "PLAN §5 schema includes sku.verifiedOn (a date). None of the four raw extractions (fd5.json, methods.json, provisioning.json, shoppinglist.json) carry any price-verification timestamp anywhere — shoppinglist.json's rows have no date field, and provisioning.json's provenance notes are undated prose. join.js sets verifiedOn:null for every ingredient rather than inventing a date (e.g. the extraction date or shoppinglist.html's file date). D4 in PLAN.md names a Phase-2 'price re-verification tracker' extra, which is presumably how this field gets populated going forward.",
  options: ["Backfill with the shopping list's known file date (Aug 3) as a proxy 'verified on' date (rejected — conflates 'the list was authored' with 'this specific price was checked at the till', which is what the field is for)", "Leave null (chosen)"],
  recommendation: "Populate verifiedOn only from real future price-check events (the localStorage priceChecks mechanism in §5's runtime state), not from extraction-time guesses.",
  status: "open",
  resolvedTo: null,
});

decide({
  topic: "prep.json op-ingredient extraction methodology (hand-verified, not fuzzy prose parsing)",
  detail:
    "methods.json's Sunday-session ops carry only free prose bodies (clock/title/body/kit) — no structured per-op ingredient list; that structure does not exist anywhere upstream (methods.js, per CONTRACT.md, is out of scope for join.js to modify or re-parse beyond its own output). join.js's OP_INGREDIENTS table hand-extracts every literal '<number> g <ingredient>' mention from all 25 op bodies (13 Week A + 12 Week B) against the 57 tracked ingredient ids, using exact keyword identification (not fuzzy/edit-distance matching) verified against each op's own text, reproduced verbatim in this file's source comments. Two explicit, non-guessed conversions were applied: egg counts ('4 medium eggs') were converted to grams via fd5.spec.egg's own stated household-unit weight (50g/egg) — a data-stated conversion, not an assumption. Seasoning/spice-blend/stock mentions with no gram figure (chipotles in adobo, curry powder, stock powder, bay leaf, etc.) were omitted rather than assigned an invented gram figure, consistent with fd5.json's own treatment of seasonings as untracked 'freebies'.",
  options: ["Regex-extract all '<number> g <word>' patterns generically and fuzzy-match the word against ingredient names (rejected — risk of false positives on seasoning words, e.g. matching 'onion powder' to 'onion')", "Hand-verify every op body's ingredient mentions against the 57-id ingredient list (chosen)"],
  recommendation: "As chosen. If Phase 1's methods rewrite adds structured per-op ingredient data to methods.js's own output, this hand-built table should be retired in favour of reading it directly.",
  status: "resolved-by-default",
  resolvedTo: "prep.json ops[].ingredients populated for 12/25 ops (the ones with an explicit gram figure); the other 13 have ingredients:[] (process-only steps: oven preheat, portioning, cooling, jar-making with tsp/tbsp-only seasoning quantities).",
});

decide({
  topic: "Week B Sunday session totalMin: derived clock total (75 min) vs theme prose ('eighty minutes')",
  detail:
    "methods.json's Week B sunday.theme reads 'one session, eighty minutes — lighter than Week A', but the session's own last op clock is '1:15' (75 minutes elapsed at the start of the final 'Portion, label, and check the freezer' op, which itself takes a few more minutes to complete). prep.json's totalMin is computed mechanically from the last op's clock timestamp (75), not parsed from the English-words prose figure in theme text (which would require number-word parsing not needed anywhere else in this codebase). The 5-minute gap is consistent with the final op's own unstated duration, not a data error.",
  options: ["Parse 'eighty minutes' out of the theme prose via a number-words dictionary and use 80 (adds a fragile, single-use parser for one field)", "Use the clock-derived total (75) and keep theme prose verbatim alongside it (chosen)"],
  recommendation: "No action needed — both figures are preserved (totalMin=75 is derived/objective, sessionName carries the original 'eighty minutes' prose verbatim).",
  status: "resolved-by-default",
  resolvedTo: "prep.json[1].totalMin=75; prep.json[1].sessionName='one session, eighty minutes — lighter than Week A' (verbatim).",
});

decide({
  topic: "calendar.json day-0 body text adapted for the a-twice variant",
  detail:
    "The a+b defrostCalendar's day-0 'THE BIG SHOP' body text describes buying for Week A immediately plus freezing stock for Week B later. For the a-twice variant this op is reused (same kept-out items: chicken 770g, chicken breast mince 140g — both correct for pass 1's Sunday session regardless of what happens in week 2) but its body text has an appended clarifying sentence noting the canonical FD5-Shopping-List.html basket buys double quantities of Week-A-only ingredients to cover both passes. This is prose annotation only; no item/gram figures were changed.",
  options: ["Leave the a+b body text completely unmodified under the a-twice variant (would read as if buying for a genuine Week B, misleading)", "Append a short clarifying sentence (chosen)"],
  recommendation: "As chosen.",
  status: "resolved-by-default",
  resolvedTo: "calendar.json's a-twice day-0 entry body = a+b's original text + one appended sentence; item list unchanged.",
});

// ---------------------------------------------------------------------------
// Phase 1 overlay (REWRITE-SPEC.md): owner-rulings.json -> decisions-queue;
// data/rewrites/* -> meals.json / prep.json / ingredients.json; approvals.json
// -> method.approved. Everything here runs AFTER every Phase 0 checksum/
// decide() above (which must see pure Phase 0 data), and BEFORE the zod
// validation + write pass below (which must see the final, overlaid data).
//
// With zero files in data/rewrites/ (current repo state) every block below
// is a no-op and meals/prep/ingredients/decisions pass through unchanged —
// this is what keeps `npm run extract` producing exactly Phase 0 output
// (plus the owner-rulings stamps) until the rewriters' files land.
// ---------------------------------------------------------------------------

const REWRITES_DIR = path.join(ROOT, "data", "rewrites");

// --- owner-rulings.json -> decisions-queue.json -----------------------------
{
  let ownerRulings;
  try {
    ownerRulings = loadOwnerRulings(path.join(HERE, "owner-rulings.json"));
  } catch (err) {
    if (err instanceof RewriteFileError) {
      stop(`owner-rulings.json is present but invalid: ${err.message}`, { file: err.file }, ["Fix tools/extract/owner-rulings.json"]);
    }
    throw err;
  }
  if (ownerRulings) {
    const { decisions: merged, appliedRulingIds, confirmedDefaultIds, unknownRulingIds } = applyOwnerRulings(decisions, ownerRulings);
    if (unknownRulingIds.length) {
      stop(
        `owner-rulings.json references decision id(s) not present in decisions-queue.json: ${unknownRulingIds.join(", ")}`,
        { unknownRulingIds },
        ["Fix the ruling's id in owner-rulings.json", "Investigate why join.js's decision sequence changed"]
      );
    }
    const expectedConfirmed = ownerRulings.confirmedDefaults.confirmedCount;
    check(
      "owner-rulings-confirmed-defaults-count",
      confirmedDefaultIds.length === expectedConfirmed,
      `owner-rulings.json declares confirmedCount=${expectedConfirmed}; actual un-ruled resolved-by-default entries=${confirmedDefaultIds.length}`
    );
    if (confirmedDefaultIds.length !== expectedConfirmed) {
      stop(
        `owner-rulings.json's confirmedDefaults.confirmedCount (${expectedConfirmed}) no longer matches the actual number of un-ruled resolved-by-default decisions-queue entries (${confirmedDefaultIds.length}) — the checkpoint's confirmation coverage has drifted and needs a fresh owner skim-review.`,
        { expected: expectedConfirmed, actual: confirmedDefaultIds.length, confirmedDefaultIds },
        ["Update owner-rulings.json's confirmedCount after a fresh owner skim-review", "Investigate why the decisions-queue entry set changed shape"]
      );
    }
    decisions = merged;
    console.log(
      `owner-rulings: applied ${appliedRulingIds.length} explicit ruling(s) [${appliedRulingIds.join(", ")}], stamped ${confirmedDefaultIds.length} confirmed default(s), resolvedBy="${ownerRulings.resolvedBy}".`
    );
  } else {
    console.warn("owner-rulings.json not found — decisions-queue.json ships with Phase 0 statuses, no owner-checkpoint stamp.");
  }
}

// --- data/rewrites/_ingredients.A.json, _ingredients.B.json -> ingredients.json
let contentPassFreebieIds = new Set();
{
  const { entries, invalid } = loadContentPassIngredients(REWRITES_DIR);
  for (const inv of invalid) console.warn(`SKIPPED invalid content-pass ingredients file ${inv.file}: ${inv.message}`);

  const existingIds = new Set(ingredients.map((i) => i.id));
  const { merged, conflicts, collisions } = mergeContentPassIngredients(entries, existingIds);

  for (const c of collisions) {
    console.warn(`SKIPPED content-pass ingredient "${c.id}" from _ingredients.${c.week}.json: id already exists in Phase 0 ingredients.json.`);
  }
  if (conflicts.length) {
    stop(
      `Conflicting content-pass ingredient definitions across _ingredients.A.json/_ingredients.B.json for id(s): ${conflicts.map((c) => c.id).join(", ")}`,
      { conflicts },
      ["Make the two rewriters' definitions for this id identical", "Pick one definition and remove it from the other file"]
    );
  }

  ingredients = [...ingredients, ...merged];
  for (const rec of merged) if (rec.freebie) contentPassFreebieIds.add(rec.id);
  if (merged.length) {
    console.log(`content-pass ingredients: merged ${merged.length} new record(s) [${merged.map((r) => r.id).join(", ")}].`);
  }
}

// --- data/rewrites/<mealId>.json -> meals.json ------------------------------
let ingredientsById = new Map(ingredients.map((i) => [i.id, i]));
const freebieIdsFromMeals = new Set();
{
  let appliedCount = 0;
  meals = meals.map((meal) => {
    const loaded = loadMealRewrite(REWRITES_DIR, meal.id);
    if (loaded.status === "missing") return meal;
    if (loaded.status === "invalid") {
      console.warn(`SKIPPED invalid rewrite ${loaded.file}: ${loaded.message} — meal ${meal.id} keeps Phase 0 content (rev A).`);
      return meal;
    }
    const result = applyMealRewrite(meal, loaded.data, ingredientsById);
    if (result.status === "invalid") {
      console.warn(`SKIPPED rewrite ${loaded.file}: ${result.message} — meal ${meal.id} keeps Phase 0 content (rev A).`);
      return meal;
    }
    for (const id of result.freebies) freebieIdsFromMeals.add(id);
    appliedCount += 1;
    return result.meal;
  });
  if (appliedCount) console.log(`meal rewrites: applied ${appliedCount}/${meals.length}.`);
}

// --- freebies (from meal rewrites) -> freebie:true on the referenced record -
{
  const allFreebieIds = new Set([...freebieIdsFromMeals, ...contentPassFreebieIds]);
  if (allFreebieIds.size) {
    ingredients = ingredients.map((ing) => (allFreebieIds.has(ing.id) ? { ...ing, freebie: true } : ing));
    ingredientsById = new Map(ingredients.map((i) => [i.id, i]));
  }
}

// --- data/rewrites/prep-a.json, prep-b.json -> prep.json --------------------
{
  const knownIds = new Set(ingredients.map((i) => i.id));
  prep = prep.map((session) => {
    const loaded = loadPrepRewrite(REWRITES_DIR, session.week);
    if (loaded.status === "missing") return session;
    if (loaded.status === "invalid") {
      console.warn(`SKIPPED invalid rewrite ${loaded.file}: ${loaded.message} — Week ${session.week} session keeps Phase 0 content (rev A).`);
      return session;
    }
    const result = applyPrepRewrite(session, loaded.data, knownIds);
    if (result.status === "invalid") {
      console.warn(`SKIPPED rewrite ${loaded.file}: ${result.message} — Week ${session.week} session keeps Phase 0 content (rev A).`);
      return session;
    }
    console.log(`prep rewrite applied: Week ${session.week} session.`);
    return result.session;
  });
}

// --- tools/extract/approvals.json -> method.approved / prep session approved
{
  let approvals;
  try {
    approvals = loadApprovals(path.join(HERE, "approvals.json"));
  } catch (err) {
    if (err instanceof RewriteFileError) {
      stop(`approvals.json is present but invalid: ${err.message}`, { file: err.file }, ["Fix tools/extract/approvals.json"]);
    }
    throw err;
  }
  const approvalMap = batchApprovalMap(approvals);

  // L10: approved is set by approvals.json ONLY — derived here from batch
  // membership, and only ever true when a rewrite was actually applied
  // (rev "B"); a meal/session with no content pass is never "approved".
  meals = meals.map((m) => {
    const approved = m.method.rev === "B" && (approvalMap.get(m.id) ?? false);
    if (approved === m.method.approved) return m;
    return { ...m, method: { ...m.method, approved } };
  });
  prep = prep.map((s) => {
    const approved = s.rev === "B" && (approvalMap.get(`prep-${s.week.toLowerCase()}`) ?? false);
    if (approved === s.approved) return s;
    return { ...s, approved };
  });
}

// ---------------------------------------------------------------------------
// Final targets re-banding + plan assembly — MUST run here, after every
// overlay step above (meal rewrites, freebie flips, prep rewrites), never
// earlier. Fable review cycle 1 FIX: this used to run before the overlay
// (right after Phase 0's own `const meals = [...]` build), so plan.json's
// bands were frozen at pre-seasoning Phase 0 kcal — honest post-overlay
// days (seasonings weighed in, D0-003 substitutions applied) then legitimately
// busted those stale ceilings/floors. `meals`/`prep` here are the FINAL,
// fully-overlaid arrays (whatever mix of rev A/rev B that turned out to be,
// independent of which specific meals the two rewriters had finished at
// any given moment — every day's total is read fresh from `meals` at this
// point, not accumulated incrementally).
// ---------------------------------------------------------------------------

const targets = bandsForAllWeeks(meals);

{
  const oldW = {
    kcal: parseRange(fd5.targets.w.kcal),
    protein: parseRange(fd5.targets.w.p),
    fat: parseRange(fd5.targets.w.fat),
    netCarb: parseRange(fd5.targets.w.c),
    fibre: parseRange(fd5.targets.w.f),
  };
  const oldM = {
    kcal: parseRange(fd5.targets.m.kcal),
    protein: parseRange(fd5.targets.m.p),
    fat: parseRange(fd5.targets.m.fat),
    netCarb: parseRange(fd5.targets.m.c),
    fibre: parseRange(fd5.targets.m.f),
  };
  const rewrittenMealCount = meals.filter((m) => m.method.rev === "B").length;
  // Amend the SAME decision entry decide() pushed at its original sequence
  // position (see `targetsDecisionId` above, ~line 1330) — looked up by id
  // from whatever `decisions` currently IS (not the stale object decide()
  // originally returned — the owner-rulings overlay already replaced the
  // whole array with fresh copies by this point). This must be a mutation
  // of the existing entry, never a new decide() call, or every id after it
  // would shift (see decide()'s own comment). topic/options/status are
  // already correct from the placeholder; only the numbers-bearing prose
  // changes.
  const targetsDecision = decisions.find((d) => d.id === targetsDecisionId);
  targetsDecision.detail =
    `Old targets (fd5.json D.targets, single fixed band applied to whichever week is active): her cover ${JSON.stringify(oldW)}, him cover ${JSON.stringify(oldM)}. ` +
    `New targets (recomputed: band = [floor(min-of-5-recomputed-day-totals), ceil(max-of-5-recomputed-day-totals)], PER WEEK, from meals.json's own recomputed macros): ` +
    `Week A her ${JSON.stringify(targets.A.w)}, him ${JSON.stringify(targets.A.m)}; Week B her ${JSON.stringify(targets.B.w)}, him ${JSON.stringify(targets.B.m)}. ` +
    `Week A's new kcal band reflects the D10 avocado-drop (slightly higher than fd5's old band on the days it touches). Week B, never checked against a per-week band before (fd5.json only ever published ONE combined-week band), now has its own explicit band for the first time. ` +
    `Fable review cycle 1 FIX: this recompute is deliberately positioned AFTER the Phase 1 rewrite-overlay section (data/rewrites/*, tools/extract/approvals.json) runs, not before it — the bands reflect whatever the FINAL meals.json actuals are at write time (${rewrittenMealCount}/${meals.length} meals currently carry a Phase 1 rewrite, rev "B"; the rest remain Phase 0 rev "A"), including any weighed-in seasonings and D0-003 substitutions. If run again after more rewrites land or content changes, these bands are recomputed fresh from whatever data/rewrites/* contains at that time — they are never frozen at a prior state. (This decide() call itself still fires at its original D0-026 sequence position, before the overlay runs, so every decision id stays stable; only this text is amended in place once the real numbers exist — see decide()'s own comment.)`;
  targetsDecision.recommendation = "As chosen — plan.json.targets is now {A:{w,m}, B:{w,m}}, four independent bands instead of one shared pair, recomputed from final (post-overlay) meals.json.";
  targetsDecision.resolvedTo = "plan.json.targets holds the 4 recomputed bands, computed from final meals.json (post Phase 1 overlay); old fd5.json bands preserved only in this decisions-queue entry.";
}

const plan = {
  variant: "a-twice",
  targets,
  shops: fd5.shops,
  days: fd5.days,
  themes: fd5.themes,
  train: fd5.train,
  notes: fd5.notes,
  economics,
};

{
  // Independent recompute proof (Fable review cycle 1 FIX requirement):
  // rebuild the bands a second time, from `meals` as it stands right here,
  // via the exact same pure functions — but called fresh at THIS point in
  // the file rather than trusting whatever `targets` was assigned above.
  // This is the regression guard against the exact bug just fixed: if
  // targets/plan assembly ever gets moved back before the overlay (or the
  // overlay ever mutates `meals` again after this point without updating
  // `targets`), this check fails loudly instead of silently shipping stale
  // bands.
  const independentTargets = bandsForAllWeeks(meals);
  const bandsMatch = JSON.stringify(independentTargets) === JSON.stringify(plan.targets);
  check(
    "plan-targets-match-independent-recompute-from-final-meals",
    bandsMatch,
    bandsMatch
      ? "plan.json.targets equals a fresh bandsForAllWeeks(meals) recompute (proves targets were built from the FINAL post-overlay meals, not a stale earlier snapshot)."
      : `MISMATCH — plan.targets=${JSON.stringify(plan.targets)} vs independent recompute=${JSON.stringify(independentTargets)}. This means targets/plan assembly ran before some later mutation of \`meals\` — it must run last, after every overlay step.`
  );
}

// ---------------------------------------------------------------------------
// Write outputs
// ---------------------------------------------------------------------------

// ---- zod schemas -----------------------------------------------------------

const StorageClass = z.enum(["buy-once", "freeze-day0", "buy-frozen", "stagger", "topup"]);
const ShopCode = z.enum(["S", "M", "X"]);

const IngredientSchema = z.object({
  id: z.string(),
  name: z.object({ display: z.string(), short: z.string(), canonical: z.string() }),
  aliases: z.array(z.string()),
  per100g: z.object({ kcal: z.number(), protein: z.number(), fat: z.number(), carb: z.number(), fibre: z.number() }),
  spec: z.object({
    weightState: z.string(),
    householdUnitG: z.number().nullable(),
    unitSingular: z.string(),
    unitPlural: z.string(),
  }),
  aisle: z.string().nullable(),
  freebie: z.boolean(),
  addedInExtraction: z.boolean().optional(),
  addedInContentPass: z.boolean().optional(),
  contentPassSources: z.array(z.enum(["A", "B"])).optional(),
  // Additive (2026-08-11 canonical revision): "not bought in the canonical
  // basket — assumed on hand / optional". Absent for every other ingredient.
  pantryOptional: z.boolean().optional(),
  storage: z.object({
    class: StorageClass,
    location: z.string(),
    note: z.string(),
    life: z.object({
      sealedDays: z.number().nullable().optional(),
      openDays: z.number().nullable().optional(),
      frozenDays: z.number().nullable().optional(),
      freshDays: z.number().nullable().optional(),
      prose: z.string(),
    }),
  }),
  sku: z
    .object({
      shop: ShopCode,
      product: z.string(),
      packG: z.number(),
      price: z.number(),
      estimate: z.boolean(),
      estimateSource: z.string(),
      verifiedOn: z.string().nullable(),
      sharedSkuWith: z.string().nullable(),
    })
    .nullable(),
});

const StepSchema = z.object({
  n: z.number(),
  text: z.string(),
  minutes: z.number().nullable(),
  tempC: z.number().nullable(),
  track: z.string().nullable(),
  station: z.string().nullable(),
  // Elapsed minutes from meal/session start (REWRITE-SPEC.md: "clockStart:
  // 0|null"). Phase 0 steps always carry null here, so widening this from
  // the prior (mistaken) z.string().nullable() to z.number().nullable() is
  // a non-breaking correction — it only starts mattering once a rewrite
  // supplies a real numeric clockStart.
  clockStart: z.number().nullable(),
  untimed: z.boolean().optional(),
});

const MacroSchema = z.object({ kcal: z.number(), protein: z.number(), netCarb: z.number(), fat: z.number(), fibre: z.number() });

const MealSchema = z.object({
  id: z.string(),
  week: z.enum(["A", "B"]),
  day: z.number(),
  slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  name: z.string(),
  origin: z.string(),
  tag: z.enum(["batch", "fresh"]),
  activeMin: z.number().nullable(),
  covers: z.object({ w: z.record(z.string(), z.number()), m: z.record(z.string(), z.number()) }),
  macros: z.object({ w: MacroSchema, m: MacroSchema }),
  method: z.object({
    steps: z.array(StepSchema),
    why: z.string(),
    // Phase 0 output is always null here; a Phase 1 rewrite may set a real
    // batchSource/batchTakeG (REWRITE-SPEC.md meal rewrite schema).
    batchSource: z.string().nullable(),
    batchTakeG: z.object({ w: z.number(), m: z.number(), total: z.number() }).nullable(),
    approved: z.boolean(),
    rev: z.string(),
  }),
});

const PrepSchema = z.object({
  week: z.enum(["A", "B"]),
  sessionName: z.string(),
  totalMin: z.number().nullable(),
  ops: z.array(
    z.object({
      clock: z.string(),
      title: z.string(),
      body: z.string(),
      station: z.string(),
      ingredients: z.array(z.object({ ingId: z.string(), g: z.number() })),
      // Only present once a Phase 1 prep rewrite supplies it (REWRITE-SPEC.md
      // rule 10: "minutes per op"); Phase 0 ops never carry this key.
      minutes: z.number().nullable().optional(),
      tempC: z.number().nullable().optional(),
      untimed: z.boolean().optional(),
    })
  ),
  yields: z.array(
    z.object({
      component: z.string(),
      qty: z.string(),
      consumers: z.array(z.string()).nullable(),
      storage: z.string(),
      // Free-text remark on the yield — D0-020 headroom is the common case.
      note: z.string().nullable().optional(),
    })
  ),
  midweek: z.array(z.object({ heading: z.string(), body: z.string() })),
  // rev/approved mirror meals.json's method.{rev,approved} at the session
  // level, so render-batch.js and the reviewer can show session old-vs-new
  // and approval state the same way they do for meals (REWRITE-SPEC.md's
  // approval batches explicitly include prep-a/prep-b).
  rev: z.string(),
  approved: z.boolean(),
  notes: z.array(z.string()).optional(),
});

const CalendarItemSchema = z.object({
  variant: z.enum(["a-twice", "a+b", "3-week"]),
  day: z.number(),
  weekday: z.string(),
  phase: z.string(),
  title: z.string(),
  body: z.string().optional(),
  station: z.string().optional(),
  items: z.array(z.object({ ingId: z.string(), g: z.number(), move: z.string().nullable() })),
});

const PlanSchema = z.object({
  variant: z.literal("a-twice"),
  targets: z.object({
    A: z.object({ w: z.record(z.string(), z.array(z.number())), m: z.record(z.string(), z.array(z.number())) }),
    B: z.object({ w: z.record(z.string(), z.array(z.number())), m: z.record(z.string(), z.array(z.number())) }),
  }),
  shops: z.any(),
  days: z.any(),
  themes: z.any(),
  train: z.any(),
  notes: z.any(),
  economics: z.record(z.string(), z.object({ amount: z.number(), basis: z.string() })),
});

const DecisionSchema = z.object({
  id: z.string(),
  topic: z.string(),
  detail: z.string(),
  options: z.array(z.string()),
  recommendation: z.string(),
  // "resolved" = an explicit owner ruling from owner-rulings.json overrode
  // an "open" Phase 0 item (D0-003/030/031 at the 2026-08-04 checkpoint).
  status: z.enum(["resolved-by-default", "resolved", "open"]),
  resolvedTo: z.string().nullable(),
  // Present only once owner-rulings.json has stamped this entry (either an
  // explicit ruling or a confirmed-as-is default) — absent for any entry
  // still genuinely open.
  resolvedBy: z.string().optional(),
});

function validateOrStop(schema, data, label) {
  const result = schema.safeParse(data);
  if (!result.success) {
    stop(`${label} failed zod validation.`, { issues: result.error.issues }, ["Fix join.js output shape"]);
  }
  return result.data;
}

// Validate each ingredient/meal/etc individually so one bad record doesn't
// obscure the rest, but still stop the run on any failure.
{
  const issues = [];
  for (const ing of ingredients) {
    const r = IngredientSchema.safeParse(ing);
    if (!r.success) issues.push({ id: ing.id, issues: r.error.issues });
  }
  if (issues.length) stop("ingredients.json failed zod validation.", { issues }, ["Fix join.js"]);
}
{
  const issues = [];
  for (const m of meals) {
    const r = MealSchema.safeParse(m);
    if (!r.success) issues.push({ id: m.id, issues: r.error.issues });
  }
  if (issues.length) stop("meals.json failed zod validation.", { issues }, ["Fix join.js"]);
}
for (const p of prep) validateOrStop(PrepSchema, p, "prep.json");
for (const c of calendar) validateOrStop(CalendarItemSchema, c, "calendar.json");
validateOrStop(PlanSchema, plan, "plan.json");
{
  const issues = [];
  for (const d of decisions) {
    const r = DecisionSchema.safeParse(d);
    if (!r.success) issues.push({ id: d.id, issues: r.error.issues });
  }
  if (issues.length) stop("decisions-queue.json failed zod validation.", { issues }, ["Fix join.js"]);
}

check("decisions-queue-target-30", decisions.length >= 25, `decisions-queue has ${decisions.length} entries (target ~30)`);

decide({
  topic: "canonical-revision-2026-08-11-adopted: owner re-verified FD5-Shopping-List.html at the till",
  detail:
    "Owner ruling, 2026-08-11: the previously-canonical 55-line basket is superseded by a 49-line re-verified revision. OLD -> NEW, all pennies-exact: " +
    "lines 55 -> 49; day-0 total £179.31 -> £172.57; shop S subtotal £72.70 -> £82.51; shop M subtotal £98.31 -> £81.76; shop X subtotal £8.30 -> £8.30 (unchanged); " +
    "day-7 top-up £8.58/7 rows -> £6.93/6 rows (the day-7 card itself lost one row as a side effect of the day-0 removals, since day-7 top-up rows are always a subset of day-0 items); " +
    "'straight to the freezer' weight 13.0kg -> 12.6kg. " +
    "6 lines removed entirely (all Morrisons: Cottage cheese £1.65, Apples £3.60, Bananas £0.90, Chia seeds £2.75, Pumpkin seeds £1.80, Desiccated coconut £1.15 — none needed at the till this pass). " +
    "22 remaining lines got updated prices (12 Sainsbury's: Chicken breast £10.00->£15.00, Eggs £16.75->£13.40, Beef mince 5% £8.50->£10.38, Basa fillets £3.50->£5.50, Rump or sirloin steak £5.50->£8.00, Turkey breast mince £4.50->£4.95, Chicken breast mince £4.25->£3.00, King prawns £3.50->£5.28, Reduced-fat cheddar £3.25->£2.95, Mozzarella £2.25->£2.95, Parmesan £2.60->£3.10, Panko breadcrumbs £1.50->£1.40; 10 Morrisons: Fat-free Greek yoghurt £6.30->£4.20, Avocados £3.00->£1.50, Salad tomatoes £1.88->£3.58, Carrots £1.38->£0.69, Chestnut mushrooms £1.35->£1.50, Frozen sweetcorn £1.25->£1.50, Red kidney beans £1.00->£0.74, Chickpeas £1.80->£0.74, Porridge oats £1.29->£0.85, Rapeseed oil £3.50->£2.75). " +
    "The 6 removed ingredient ids (cottage, apple, banana, chia, pumpkin_seeds, coconut_des) are NOT deleted from ingredients.json — their meals.json references stay exactly as-is, per the owner's instruction — they are flagged pantryOptional:true (\"not bought in the canonical basket — assumed on hand / optional\") with sku:null. Affected meals, by id (kept untouched, just no longer basket-sourced): cottage -> a-d5s, b-d1s; apple -> a-d4s, b-d2b; banana -> a-d1s; chia -> a-d1s, b-d1s, b-d2b, b-d3s; pumpkin_seeds -> a-d1s, a-d4s, b-d1s, b-d3s, b-d4s; coconut_des -> a-d4s, a-d5d, b-d4s (coconut_des is independently already classified assumedPantry in the Morrisons-tester variant's own coverage audit — this canonical flag corroborates that classification rather than conflicting with it). " +
    "The 22 re-verified prices flow into ingredients.json SKUs with verifiedOn:\"2026-08-11\", estimate:false, estimateSource:\"owner-reverify-2026-08-11\" — this is the first REAL population of D0-031's verifiedOn field (D0-031, 2026-08-04: verifiedOn stays null until a real price-check event exists, never backfilled from a file/extraction date). This is that event, not a backfill: the owner actually re-verified these 22 prices at the till on 2026-08-11, which is exactly the case D0-031's own resolution anticipated (\"populated only by real price-check events\") — this decision extends D0-031, it does not override it. " +
    "The LEGACY 3-week cross-checks (£257.32 total, legacy per-shop £102.58/£145.24/£9.50, legacy estimateMark<->fd5.prices.ver checksum) are untouched: the legacy shopping-list.html file itself was not touched by this revision, only the canonical FD5-Shopping-List.html was.",
  options: [
    "Keep the old 55-line/£179.31 numbers as canonical, treat the owner's edit as a draft (rejected — owner ruling is binding per the coordinator's explicit instruction)",
    "Adopt the revised 49-line/£172.57 file as canonical; re-point every §3 checksum gate at the new numbers; flag the 6 dropped ingredients pantryOptional rather than deleting them (chosen)",
  ],
  recommendation: "As chosen. join.js's checksum gates (alias-map-covers-49-short-names, costs-sum-172.57-per-shop-subtotals, day7-topup-6.93-per-2026-08-11-revision) and validate.test.js's checksum-4/5 assertions now read the revised numbers; alias-map.json's 6 obsolete keys were removed (not left dangling) so the 49-count invariant stays live-checkable.",
  status: "resolved",
  resolvedTo:
    "data/raw/shoppinglist.json: 49 rows, £172.57 (S£82.51/M£81.76/X£8.30), day-7 £6.93/6 rows. data/ingredients.json: 22 SKUs carry verifiedOn:\"2026-08-11\"/estimate:false/estimateSource:\"owner-reverify-2026-08-11\"; 6 SKUs carry pantryOptional:true/sku:null. tools/extract/alias-map.json: 49 keys (6 removed). tools/extract/join.js: 2 renamed/updated checksum gates, 2 new gates (re-verified-count, pantry-optional-count).",
});

// ---------------------------------------------------------------------------
// Variant: "morrisons-tester" plan-variant (docs/VARIANT-SPEC.md, binding).
// Additive-only, mirrors how calendar.json already layers a second variant
// (a-twice) alongside the canonical one (a+b) without disturbing it: reads
// the FINAL `meals`/`ingredients`/`prep` (post Phase-1 overlay, already
// computed above) plus data/raw/morrisons.json, and writes a single new
// file, data/variant-morrisons.json. Nothing above this point is touched;
// no existing data/*.json output changes shape or content.
// ---------------------------------------------------------------------------

const variantMorrisons = (function buildVariantMorrisons() {
  const va = []; // local anomalies for this section, folded into the output's own anomalies[]

  // --- 1. Kept/cut slots, derived from morrisons.json's own menu section,
  //     cross-checked against meals.json's own `name` field so a silent
  //     mismatch (wrong day/slot) fails loudly instead of shipping wrong. ---
  const DAY_CODE_TO_NUM = { D1: 1, D2: 2, D3: 3, D4: 4, D5: 5 };
  const kept = [];
  const cutNonSnack = [];
  for (const day of morrisons.menu.days) {
    const dayNo = DAY_CODE_TO_NUM[day.code];
    if (dayNo === undefined) {
      va.push({ type: "unrecognized-day-code", detail: `morrisons.json menu day code "${day.code}" not in D1..D5.` });
      continue;
    }
    for (const meal of day.meals) {
      const found = meals.find((m) => m.week === "A" && m.day === dayNo && m.slot === meal.slot);
      if (!found) {
        va.push({ type: "kept-meal-not-found", detail: `No meals.json entry for week A day ${dayNo} slot ${meal.slot} ("${meal.name}").` });
        continue;
      }
      if (found.name !== meal.name) {
        va.push({
          type: "kept-meal-name-mismatch",
          detail: `meals.json ${found.id} name "${found.name}" != morrisons.json menu name "${meal.name}" for week A day ${dayNo} ${meal.slot}.`,
        });
      }
      kept.push(found.id);
    }
    // Any breakfast/lunch/dinner slot in this day NOT present among the kept
    // meals for that day is a non-snack cut. Wednesday has none kept, so all
    // three of its slots are cuts; Thu/Fri drop exactly one slot each.
    const keptSlotsThisDay = new Set(day.meals.map((m) => m.slot));
    for (const slot of ["breakfast", "lunch", "dinner"]) {
      if (keptSlotsThisDay.has(slot)) continue;
      const cutMeal = meals.find((m) => m.week === "A" && m.day === dayNo && m.slot === slot);
      if (!cutMeal) {
        va.push({ type: "cut-meal-not-found", detail: `No meals.json entry for week A day ${dayNo} slot ${slot} (expected a cut meal).` });
        continue;
      }
      // Reason text: the day's own cutCard(s), verbatim. Wednesday carries
      // one combined cutCard for all three of its slots (the source text
      // genuinely is one shared reason); Thursday/Friday each carry exactly
      // one cutCard naming their single cut slot.
      const reason = day.cutCards.length === 1 ? day.cutCards[0] : day.cutCards.join(" ") || null;
      if (!reason) va.push({ type: "cut-meal-no-reason", detail: `${cutMeal.id} (week A day ${dayNo} ${slot}) has no cutCard text to cite as a reason.` });
      cutNonSnack.push({ mealId: cutMeal.id, reason });
    }
  }

  check("variant-morrisons-kept-count-10", kept.length === 10, `derived ${kept.length} kept meal ids from morrisons.json menu (expect 10)`);
  check("variant-morrisons-cut-nonsnack-count-5", cutNonSnack.length === 5, `derived ${cutNonSnack.length} non-snack cut meals (expect 5)`);

  // All 5 Week A snacks are absent from the tester basket entirely (no
  // snack ingredients appear anywhere in morrisons.json's 39 lines) — per
  // docs/VARIANT-SPEC.md's own framing, these are cuts too, just not
  // itemised on the source's day cards the way the b/l/d cuts are.
  const snackCuts = meals
    .filter((m) => m.week === "A" && m.slot === "snack")
    .sort((a, b) => a.day - b.day)
    .map((m) => ({ mealId: m.id, reason: "not part of the tester week — no snack ingredients appear in the 39-line Morrisons basket" }));
  check("variant-morrisons-snack-cuts-5", snackCuts.length === 5, `found ${snackCuts.length} week-A snack meals (expect 5)`);

  const slots = { kept, cut: [...cutNonSnack, ...snackCuts] };

  // --- 2. Basket lines: ingId resolution (alias-map.json, zero fuzzy) +
  //     storageClass derivation (from the row's own tag TEXT + aisle + note
  //     — never the reused t-* colour class) + coversAlso (shared-SKU rows,
  //     plus two variant-specific substitutions this basket's own note text
  //     documents explicitly — see VARIANT_COVERS_ALSO below). ---

  // Two substitutions this smaller single-shop basket makes that the
  // canonical (49-line) basket does not, each evidenced by the row's own
  // note text rather than assumed:
  //   - "Red peppers" (raw): note says "Raw — no frozen split needed for a
  //     single small shop" — stands in for peppers_frozen too.
  //   - "Extra virgin olive oil": note cites "178 g of dressing use" for
  //     the smallest bottle on the site. The 10 kept meals' rev-B covers
  //     need rapeseed_oil (39+50=89 g, w+m) AND olive_oil (38+51=89 g, w+m)
  //     — 89+89=178 g exactly, matching the note's own figure only when
  //     both oils are combined. One bottle is standing in for both.
  const VARIANT_COVERS_ALSO = {
    "Red peppers": ["peppers_frozen"],
    "Extra virgin olive oil": ["rapeseed_oil"],
  };

  // Fable review cycle 2 FIX-3(a): a derived clarifying note, applied ONLY
  // where the source row carries no note of its own (row.note === null —
  // never overwrites real verbatim prose). "Pineapple chunks" moved to
  // storageClass:"cupboard" above (it's an unopened tin, not chilled
  // produce, despite sitting under the "Fruit & veg" aisle heading); this
  // records the after-opening handling the storageClass alone can't convey.
  const DERIVED_NOTE_WHEN_ABSENT = {
    "Pineapple chunks": "Tin — cupboard while sealed. Once opened, decant and refrigerate; use within a couple of days.",
  };

  function deriveStorageClass(row) {
    const tag = row.tags[0] ?? null;
    if (tag === "Freeze on arrival") return "freeze-on-arrival";
    if (tag === "Freezer aisle") return "freezer-aisle";
    if (tag === "Mixed ripeness") return "counter"; // avocados: "Buy hard, ripen on the counter."
    if (tag === "Store normally") {
      if (row.note && /counter/i.test(row.note)) return "counter"; // "Counter, not fridge." (tomatoes)
      // Fable review cycle 2 FIX-3(a): "Pineapple chunks" sits under the
      // "Fruit & veg" aisle heading (the source's own layout groups it with
      // fresh produce) but its productString reads "Pineapple Chunks in
      // Juice, 425 g tin (260 g drained)" — an unopened tin, not chilled
      // produce. Storage is cupboard until opened; the "goes in the fridge
      // once opened" detail belongs in the line's own note text, not the
      // top-level storageClass. Checked by product text ("tin"), not aisle,
      // so this rule only ever fires for genuinely tinned lines.
      if (row.productString && /\btin\b/i.test(row.productString)) return "cupboard";
      if (row.aisle === "Dairy & chilled") return "fridge";
      if (row.aisle === "Cupboard") return "cupboard";
      if (row.aisle === "Meat, fish & eggs") return "fridge"; // eggs, the one non-freeze row in this aisle
      if (row.aisle === "Fruit & veg") return "fridge"; // default for fresh produce; counter/tinned cases are caught above
    }
    va.push({ type: "unresolved-storage-class", detail: `Row "${row.name}" (tag "${tag}", aisle "${row.aisle}") did not match any storageClass rule.` });
    return null;
  }

  const lines = morrisons.rows.map((row) => {
    const ids = aliasMap[row.name] ?? aliasMapMorrisons[row.name];
    if (!ids) {
      va.push({ type: "unmapped-basket-row", detail: `No alias-map.json entry for basket row "${row.name}".` });
      return null;
    }
    const [ingId, ...sharedSkuAlso] = ids;
    const extraCoversAlso = VARIANT_COVERS_ALSO[row.name] ?? [];
    const coversAlso = [...sharedSkuAlso, ...extraCoversAlso];
    // The source's .cost column (and the COSTS[] checksum array) is the LINE
    // TOTAL, source-verbatim — not a per-pack unit price. Confirmed by the
    // one row where qty != 1 ("Frozen cauliflower florets", "2 × 1,000 g",
    // cost "£3.00"): £3.00 is 2 packs at £1.50 each, and COSTS[]'s own 3.0
    // entry at that position is what sums the 39-line array to exactly
    // 69.83. Storing this as a would-be per-pack price and multiplying by
    // qty downstream double-counts it (300p x 2 = 600p, not 300p). `lineP`
    // is the verbatim total (what basket.totalP must sum to); `packP` is
    // derived (lineP/qty) for any per-pack unit-price display.
    const lineP = priceToPence(row.priceShown);
    if (lineP === null) va.push({ type: "unparseable-line-price", detail: `Row "${row.name}" price "${row.priceShown}" did not parse.` });
    let packP = null;
    if (lineP !== null && row.qty) {
      if (lineP % row.qty !== 0) {
        va.push({ type: "line-price-not-evenly-divisible", detail: `Row "${row.name}": lineP ${lineP}p is not evenly divisible by qty ${row.qty}.` });
      }
      packP = Math.round(lineP / row.qty);
    }
    return {
      ingId,
      label: row.name,
      product: row.productString,
      packG: row.pack,
      qty: row.qty,
      lineP,
      packP,
      aisle: row.aisle,
      tags: row.tags,
      note: row.note ?? DERIVED_NOTE_WHEN_ABSENT[row.name] ?? null,
      storageClass: deriveStorageClass(row),
      ...(coversAlso.length ? { coversAlso } : {}),
    };
  });

  const totalP = lines.reduce((acc, l) => acc + (l ? l.lineP : 0), 0);
  check("variant-morrisons-39-lines-pennies-exact", lines.length === 39 && totalP === 6983, `${lines.length} lines, totalP=${totalP} (expect 39 lines, 6983p)`);
  check(
    "variant-morrisons-qty-x-packP-reconstitutes-lineP",
    lines.every((l) => !l || l.qty * l.packP === l.lineP),
    "every line's qty x packP must reconstitute its verbatim lineP (proves the qty!=1 cauliflower row isn't double-counted)"
  );

  decide({
    topic: "variant-morrisons basket price field semantics: lineP vs packP (runtime-builder-reported bug fix)",
    detail:
      "The runtime builder found data/variant-morrisons.json basket lines summed to 7283p under Σ(qty x priceP) against a stated total of 6983p — a 300p overcount. Root cause: the single field this section originally emitted, `priceP`, held the source's .cost column value directly, which is the LINE TOTAL, not a per-pack unit price — confirmed by the one qty!=1 row ('Frozen cauliflower florets', '2 × 1,000 g', cost '£3.00'): £3.00 is 2 packs at £1.50 each, and the COSTS[] checksum array's own 3.0 entry at that position is exactly what makes the 39-entry array sum to 69.83. Any consumer that (reasonably, given the ambiguous single-field name `priceP`) treated it as a per-pack price and multiplied by qty double-counted this one row (300p x 2 = 600p instead of 300p, a 300p/£3.00 overcount — exactly the 7283-6983=300p gap reported). " +
      "Fix: the field is renamed `lineP` (source-verbatim line total; basket.totalP = Σ lineP, still 6983p exactly) and a new derived field `packP` (lineP/qty, integer pence, 150p for the cauliflower row) is added to every line so a consumer that wants a per-pack unit price for display has one without needing to re-derive it. qty x packP reconstitutes lineP exactly for every line (locked as a checksum above).",
    options: [
      "Keep the single `priceP` field, document that it is a line total in prose only (rejected — the exact ambiguity that caused the bug)",
      "Split into `lineP` (verbatim total) + `packP` (derived unit price), both always present (chosen)",
    ],
    recommendation: "As chosen — matches the runtime builder's own suggested contract.",
    status: "resolved",
    resolvedTo: `basket.lines[].priceP renamed to lineP; basket.lines[].packP added (=lineP/qty). basket.totalP unchanged at 6983p, now = Σ lineP exactly. Verified: totalP=${totalP}p.`,
  });
  check("variant-morrisons-all-lines-mapped", lines.every((l) => l && l.ingId), `${lines.filter((l) => !l || !l.ingId).length} unmapped lines`);
  check(
    "variant-morrisons-all-lines-storage-classed",
    lines.every((l) => l && l.storageClass),
    `${lines.filter((l) => !l || !l.storageClass).length} lines without a resolved storageClass`
  );

  function priceToPence(str) {
    const m = /^£\s*([\d,]+(?:\.\d+)?)$/.exec((str ?? "").trim());
    if (!m) return null;
    return Math.round(parseFloat(m[1].replace(/,/g, "")) * 100);
  }

  const basket = {
    retailer: morrisons.shop.code,
    verifiedOn: "2026-08-11",
    totalP,
    lines,
    putAway: morrisons.putAwayCard.entries.map((e) => ({ heading: e.title, body: e.detail, where: e.status })),
  };

  // --- 3. Targets: D0-026 method (bandFrom, already defined above for the
  //     canonical plan) but over the FOUR kept days only (Wed dropped
  //     entirely), and within Thu/Fri only the kept slots — i.e. exactly
  //     what the tester week's own days actually total, not the full
  //     canonical day. ---
  // Same root fix as the canonical bands (unroundedCoverMacros, defined
  // above): sum RAW per-cover gram covers, never the pre-rounded
  // meals[].macros, so the tester's band edges match what the app itself
  // computes when it sums covers directly (Fable review cycle 2 FIX).
  function dayTotalsForKeptMeals(keptIds, coverKey) {
    const totals = { kcal: [], protein: [], netCarb: [], fat: [], fibre: [] };
    for (const d of [1, 2, 4, 5]) {
      const dayMeals = meals.filter((m) => m.week === "A" && m.day === d && keptIds.includes(m.id));
      const sum = { kcal: 0, protein: 0, netCarb: 0, fat: 0, fibre: 0 };
      for (const m of dayMeals) {
        const raw = unroundedCoverMacros(m.covers[coverKey]);
        for (const k of Object.keys(sum)) sum[k] += raw[k];
      }
      for (const k of Object.keys(totals)) totals[k].push(sum[k]);
    }
    return totals;
  }
  const targets = {
    A: {
      w: bandFrom(dayTotalsForKeptMeals(kept, "w")),
      m: bandFrom(dayTotalsForKeptMeals(kept, "m")),
    },
  };

  // --- 4. Coverage audit: kept meals' rev-B covers vs basket ingIds (+
  //     coversAlso). Freebies never appear as covers keys (fd5's own
  //     treatment — untracked seasonings are omitted from covers entirely,
  //     see the OP_INGREDIENTS comment above), so nothing here needs a
  //     separate freebie carve-out; the four content-pass/spice-jar
  //     seasonings below are gram-tracked but deliberately absent from a
  //     39-line single-shop basket (named explicitly in
  //     docs/VARIANT-SPEC.md's own coverage-audit guidance: "suya/jerk/
  //     adobo/shawarma etc." classify as assumedPantry) — recorded as a
  //     decision below, not silently assumed. ---
  const neededIds = new Set();
  const keptMealObjs = meals.filter((m) => kept.includes(m.id));
  for (const m of keptMealObjs) {
    for (const k of Object.keys(m.covers.w)) neededIds.add(k);
    for (const k of Object.keys(m.covers.m)) neededIds.add(k);
  }
  const basketCoveredIds = new Set();
  for (const l of lines) {
    if (!l) continue;
    basketCoveredIds.add(l.ingId);
    for (const id of l.coversAlso ?? []) basketCoveredIds.add(id);
  }
  const ASSUMED_PANTRY_IDS = new Set(["chipotle_adobo", "jerk_paste", "sugar", "coconut_des"]);
  const coveredByBasket = [];
  const assumedPantry = [];
  const missing = [];
  for (const id of [...neededIds].sort()) {
    if (basketCoveredIds.has(id)) coveredByBasket.push(id);
    else if (ASSUMED_PANTRY_IDS.has(id)) assumedPantry.push(id);
    else missing.push(id);
  }
  const coverageDecision = decide({
    topic: "morrisons-tester coverage audit: 4 gram-tracked seasonings absent from the 39-line basket",
    detail:
      `The 10 kept meals' rev-B covers need ${neededIds.size} distinct ingredient ids. ${coveredByBasket.length} are covered by the basket's 39 lines (${lines.length - coveredByBasket.length + assumedPantry.length + missing.length >= 0 ? "including" : ""} shared-SKU coversAlso: skyr via the yoghurt tub, blueberries via the wonky-berries bag, peppers_frozen via the raw-peppers substitution, rapeseed_oil via the single olive-oil bottle). The remaining 4 — chipotle_adobo, jerk_paste, sugar, coconut_des — never appear anywhere in the 39 lines. All four are small-gram (3-30g raw-batch) spice-jar/condiment ingredients: chipotle_adobo and jerk_paste are literally the "adobo"/"jerk" seasoning-jar category docs/VARIANT-SPEC.md names explicitly; sugar is a content-pass pinch-seasoning (ingredients.json's own storage note: "Introduced in the Phase 1 content pass ... pinches are weighed at 1g rather than listed in freebies[]"); coconut_des is a 3g garnish quantity in a-d5d. None is a bulk/staple ingredient (meat, veg, starch, dairy, oil) whose absence would indicate a mapping bug.`,
    options: [
      "Report all 4 as coverage.missing (treats a genuinely tiny spice-jar gap as equivalent to a real basket gap)",
      "Classify all 4 as coverage.assumedPantry, matching the spec's own named example categories (chosen)",
    ],
    recommendation: "Classify as assumedPantry, per docs/VARIANT-SPEC.md's coverage-audit guidance.",
    // "resolved" (not "resolved-by-default"): the latter status is reserved
    // by the owner-checkpoint overlay (tools/extract/owner-rulings.json,
    // validate.test.js's "owner-rulings checkpoint overlay" suite) for an
    // EXACT pre-counted set of Phase-0 decisions confirmed-as-is on
    // 2026-08-04 — this decision postdates that checkpoint and must not be
    // folded into its count.
    status: "resolved",
    resolvedTo: `coverage.assumedPantry = [${[...assumedPantry].sort().join(", ")}]; coverage.missing = [] (empty, as expected).`,
  });
  check("variant-morrisons-coverage-missing-reported", true, `coverage.missing = ${JSON.stringify(missing)} (${missing.length} ids) — reported, not a hard gate per spec`);
  check(
    "variant-morrisons-no-staple-missing",
    missing.every((id) => id !== "chicken" && id !== "egg" && id !== "olive_oil" && id !== "rapeseed_oil"),
    `missing=${JSON.stringify(missing)} — a STAPLE (chicken/egg/oil) here would indicate a mapping bug`
  );

  const coverage = { coveredByBasket, assumedPantry, missing };

  // --- 5. Defrost derivation. Only the 6 "Freeze on arrival" basket lines
  //     are candidates. seeded_bread is toasted straight from frozen per
  //     both the basket's own note ("Toast from frozen") and
  //     ingredients.json's canonical note ("no defrosting") — no defrost
  //     entry, ever. beef_steak (Thu) and salmon (Fri) are single-use
  //     bring-downs. beef_mince is a split case: 165g of its 500g pack is
  //     used immediately Sunday for prep-a's "Chipotle beef" batch (a-d2l,
  //     Tuesday's lunch) — hand-verified against prep.json's own yield note
  //     (165g raw, consumers:["a-d2l"]) — and the remaining 335g is
  //     fresh-cooked Thursday for the smash burger (a-d4d, which appears in
  //     NO prep-a yield's consumers list, i.e. it is never batch-prepped,
  //     only cooked same-day) and so needs its own bring-down. chicken and
  //     chicken_mince (Fable review cycle 2 FIX-3(b)) are both needed
  //     almost immediately (day 0's prep-a session / day 1's fresh-cooked
  //     pizza) — rather than silently omitting them (the original
  //     reasoning: "never actually frozen"), they now get their own day-0
  //     advisory entries below, since a user following the basket's literal
  //     "Freeze on arrival" tag with no guidance could easily freeze
  //     something they need out again within a day. ---
  function findKeptMeal(id) {
    return keptMealObjs.find((m) => m.id === id) ?? null;
  }
  const beefMinceThuNeed = (() => {
    const m = findKeptMeal("a-d4d");
    if (!m || m.covers.w.beef_mince == null || m.covers.m.beef_mince == null) {
      va.push({ type: "defrost-beef-mince-need-missing", detail: "a-d4d covers no longer contain beef_mince for both covers — defrost figure needs re-deriving." });
      return null;
    }
    return m.covers.w.beef_mince + m.covers.m.beef_mince;
  })();

  const defrost = [];
  const findLine = (ingId) => lines.find((l) => l && l.ingId === ingId);

  const steakLine = findLine("beef_steak");
  if (steakLine) {
    defrost.push({
      dayNo: 3,
      ingId: "beef_steak",
      g: steakLine.packG,
      move: "freezer → fridge",
      note: "Thursday breakfast's steak & egg sandwich (a-d4b) — Week A Thursday only, freeze on arrival, down Wednesday night (matches ingredients.json's own canonical beef_steak note).",
    });
  }
  const salmonLine = findLine("salmon");
  if (salmonLine) {
    defrost.push({
      dayNo: 4,
      ingId: "salmon",
      g: salmonLine.packG,
      move: "freezer → fridge",
      note: "Friday dinner's jerk salmon (a-d5d) — down Thursday night for Friday's grill.",
    });
  }
  const minceLine = findLine("beef_mince");
  if (minceLine && beefMinceThuNeed != null) {
    const frozenRemainderG = minceLine.packG - 165; // 165g = prep-a "Chipotle beef" yield's raw batch, used immediately Sunday, never frozen
    defrost.push({
      dayNo: 3,
      ingId: "beef_mince",
      g: frozenRemainderG,
      move: "freezer → fridge",
      note: `Thursday dinner's smash burger (a-d4d, ${beefMinceThuNeed}g raw both covers) — the pack's other 165g goes straight into Sunday's prep-a session (Chipotle beef batch, for Tuesday's a-d2l) and is never frozen; only this ${frozenRemainderG}g remainder is bagged for the freezer, brought down Wednesday night.`,
    });
  }

  // Fable review cycle 2 FIX-3(b): two early-week entries for the two
  // "Freeze on arrival"-tagged lines that are actually needed almost
  // immediately (day 0's prep-a session / day 1's fresh-cooked pizza) —
  // both were previously handled by omission (no defrost entry at all,
  // reasoned as "never actually frozen"), but that left the tester with no
  // explicit guidance at the one moment it matters: unpacking the shop.
  // Both entries are advisory/conditional rather than a flat freezer move,
  // matching ingredients.json's own canonical notes for these two ids.
  const chickenLine = findLine("chicken");
  if (chickenLine) {
    defrost.push({
      dayNo: 0,
      ingId: "chicken",
      g: chickenLine.packG,
      move: "arrival → fridge (conditional — do not freeze)",
      note: "Feeds Sunday's own prep-a session (Roast chicken yield, for Mon a-d1l and Fri a-d5l) — don't freeze it if that session lands within ~24h of the shop; fridge it straight from the bag instead (matches ingredients.json's canonical chicken note: '2 days fresh', comfortably covering shop-day to session-day). Only freeze it if the session is genuinely more than a day out.",
    });
  }
  const chickenMinceLine = findLine("chicken_mince");
  if (chickenMinceLine) {
    const chickenMinceNeed = (() => {
      const m = findKeptMeal("a-d1d");
      if (!m || m.covers.w.chicken_mince == null || m.covers.m.chicken_mince == null) {
        va.push({ type: "defrost-chicken-mince-need-missing", detail: "a-d1d covers no longer contain chicken_mince for both covers — defrost figure needs re-deriving." });
        return null;
      }
      return m.covers.w.chicken_mince + m.covers.m.chicken_mince;
    })();
    // No prep-a yield touches chicken_mince at all (verified against
    // prep.json's 12 yield components — none of them is chicken mince;
    // unlike beef_mince, there is no Sunday-immediate portion to split
    // out), so the WHOLE 500g pack is for Monday's pizza (a-d1d) and
    // nothing else — no split, unlike beef_mince's 165g/335g case.
    defrost.push({
      dayNo: 0,
      ingId: "chicken_mince",
      g: chickenMinceLine.packG,
      move: "freezer → fridge (bring down Sunday night)",
      note: `Monday dinner's chicken-crust pizza (a-d1d, ${chickenMinceNeed ?? "?"}g raw both covers, out of the ${chickenMinceLine.packG}g pack — no prep-a yield uses chicken_mince, so the whole pack is for this one meal). If it went in the freezer on arrival per the basket's tag, bring it down Sunday night for Monday's bake; otherwise treat it the same as the chicken above and just fridge it on arrival.`,
    });
  }

  check(
    "variant-morrisons-defrost-days-in-range",
    defrost.every((d) => [0, 3, 4].includes(d.dayNo)),
    "every defrost entry is day 0 (arrival advisory) or a Thursday/Friday bring-down"
  );
  check(
    "variant-morrisons-defrost-count-5",
    defrost.length === 5,
    `${defrost.length} defrost entries (expect 5: chicken, chicken_mince, beef_steak, beef_mince, salmon)`
  );

  // --- 6. prep.keptOps: prep-a ops whose yield(s) feed >=1 kept meal.
  //     Yield-kept status is computed generically from prep.json's own
  //     consumers[] against `kept`. Op -> yield-component is a hand-verified
  //     lookup (each op's own body text, quoted in-line) since prep.json's
  //     ops carry free prose, not a structured ingredient/yield key — the
  //     same kind of hand-extraction join.js already does elsewhere for
  //     prep-op ingredients (see the OP_INGREDIENTS comment earlier in this
  //     file). Ops with no single-component tie (oven-on setup, portion-
  //     and-label close) are GENERAL and stay in as long as anything else
  //     in the session is kept. ---
  const prepA = prep.find((p) => p.week === "A" && /one session/i.test(p.sessionName));
  if (!prepA) {
    va.push({ type: "prep-a-not-found", detail: "Could not find prep.json's Week A session (sessionName matching /one session/i)." });
  }
  const yieldKept = {};
  if (prepA) {
    for (const y of prepA.yields) {
      yieldKept[y.component] = (y.consumers ?? []).some((cid) => kept.includes(cid));
    }
  }
  // Hand-verified against prep.json's ops[].body (quoted): op index -> the
  // yield component(s) that op's body text is actually cooking/handling.
  // "GENERAL" ops carry no single yield and are kept iff >=1 other op keeps.
  const OP_COMPONENTS = [
    /* 0  "Oven on, three trays out"                */ "GENERAL",
    /* 1  "Trays in — chicken, chickpeas, peppers"  */ ["Roast chicken", "Jerk chickpeas"],
    /* 2  "Pan 1 — the bolognese..."                */ ["Turkey bolognese"],
    /* 3  "Pan 2 — chipotle beef"                   */ ["Chipotle beef"],
    /* 4  "Pan 3 — efo riro base..."                */ ["Efo riro base"],
    /* 5  "Eggs on"                                 */ ["Boiled eggs"],
    /* 6  "Chicken and peppers out"                 */ ["Roast chicken", "Jerk chickpeas"],
    /* 7  "Pan 2 free — plain rice on"              */ ["Plain brown rice"],
    /* 8  "Chickpeas out — jar, lid OFF"            */ ["Jerk chickpeas"],
    /* 9  "Pan 3 free — the jollof"                 */ ["Jollof"],
    /* 10 "Rice the cauliflower — the big job"      */ ["Riced cauliflower"],
    /* 11 "Shred for two slaws..."                  */ ["Slaw shred"],
    /* 12 "The two jars" (white sauce + suya)       */ ["White sauce", "Suya spice"],
    /* 13 "Bolognese and rice off — cool them FAST" */ ["Turkey bolognese", "Plain brown rice"],
    /* 14 "Portion and label"                       */ "GENERAL",
  ];
  // Fable review cycle 2 FIX-1: op-subset coherence. Rule (a) is unchanged
  // and literal — "an op is kept iff >=1 of its components feeds a kept
  // meal" — but applying it strictly to op6 ("Chicken and peppers out": its
  // "Roast chicken" component IS kept, feeding a-d1l/a-d5l) and op12 ("The
  // two jars": its "White sauce" component IS kept, feeding a-d1l) means
  // BOTH stay kept under rule (a) itself — dropping either would strand a
  // kept meal's own prep (a-d1l needs both continued roast chicken AND
  // white sauce), which is exactly the class of bug this fix exists to
  // remove, not reintroduce. What DOES need fixing is the orphaned
  // sub-thread inside these mixed ops: op1's TRAY B roasts 250g of the
  // tester's single 240g chickpea tin into "Jerk chickpeas" — a component
  // whose ONLY consumer (a-d3s) is cut — which would leave nothing in that
  // tin for Monday's a-d1l lunch (also a chickpea consumer, straight from
  // the tin, never through this batch). op6's "Chickpeas stay in until
  // 0:45" and op0's "Drain and dry the chickpeas" are the same thread's
  // setup/continuation. op12's suya half (a-d2s, cut) and op13's title
  // ("Bolognese and rice off") are the same class of issue at smaller
  // scale. Fix: every kept op that ALSO carries a dropped-component mention
  // gets an explicit `testerNote` telling the user to skip that specific
  // sub-part — never a silent drop of the whole op, never a silent
  // orphaned instruction either.
  //
  // OP_DROPPED_MENTIONS is hand-verified against each op's own body/title
  // text (quoted below) — component names dropped-but-still-mentioned
  // inside an otherwise-kept op. Separate from OP_COMPONENTS (which drives
  // keep/drop) so a note-worthiness judgment call can never silently change
  // which ops survive.
  const OP_DROPPED_MENTIONS = {
    0: ["Jerk chickpeas"], // "Drain and dry the chickpeas on a tea towel now" — Tray B prep, op1
    1: ["Jerk chickpeas"], // "TRAY B: 250 g drained chickpeas ... 2 tsp jerk seasoning"
    6: ["Jerk chickpeas"], // "Chickpeas stay in until 0:45"
    12: ["Suya spice"], // "SUYA: mix your own — 3 parts ground roasted peanut..."
    13: ["Turkey bolognese"], // title: "Bolognese and rice off — cool them FAST"
  };
  const TESTER_NOTES = {
    0: "No need to dry the chickpeas for Tray B — that tray's skipped in the starter (see op 1's note). The oven/trays are still needed for the chicken.",
    1: "Skip Tray B — jerk chickpeas aren't in the starter; leave the 240 g tin for Monday's lunch instead.",
    6: "Skip the chickpea tray here too (see op 1) — the tin stays whole for Monday's lunch.",
    12: "Skip the suya half — nothing in the starter needs it. Just make the white sauce.",
    13: "Ignore the bolognese mention — it's cut from the starter. Only the rice needs the fast cool here.",
  };

  let keptOps = [];
  if (prepA) {
    if (OP_COMPONENTS.length !== prepA.ops.length) {
      va.push({ type: "op-components-length-mismatch", detail: `OP_COMPONENTS has ${OP_COMPONENTS.length} entries, prep-a has ${prepA.ops.length} ops — re-verify the hand table against prep.json.` });
    }
    const specificKept = prepA.ops.map((op, i) => {
      const comps = OP_COMPONENTS[i];
      if (comps === "GENERAL") return null; // resolved in the second pass below
      return comps.some((c) => yieldKept[c]);
    });
    const anySpecificKept = specificKept.some((v) => v === true);
    keptOps = prepA.ops
      .map((op, i) => ({ i, clock: op.clock, title: op.title, kept: specificKept[i] === null ? anySpecificKept : specificKept[i] }))
      .filter((o) => o.kept)
      .map((o) => ({
        opIndex: o.i,
        clock: o.clock,
        title: o.title,
        ...(TESTER_NOTES[o.i] ? { testerNote: TESTER_NOTES[o.i] } : {}),
      }));

    // Coherence check 1: every KEPT op with a hand-verified dropped-component
    // mention carries a testerNote (no silently-orphaned sub-instruction).
    const keptIndices = new Set(keptOps.map((o) => o.opIndex));
    const missingNotes = Object.keys(OP_DROPPED_MENTIONS)
      .map(Number)
      .filter((i) => keptIndices.has(i) && !keptOps.find((o) => o.opIndex === i)?.testerNote);
    check(
      "variant-morrisons-keptops-no-orphaned-mention-without-testernote",
      missingNotes.length === 0,
      `kept ops with a dropped-component mention but no testerNote: ${JSON.stringify(missingNotes)}`
    );

    // Coherence check 2: no DROPPED op is the sole source of a component a
    // KEPT op (or the coverage audit) still needs — i.e. every kept yield
    // component is produced by at least one op that actually stayed kept.
    const keptYieldComponents = Object.entries(yieldKept)
      .filter(([, v]) => v)
      .map(([c]) => c);
    const strandedComponents = keptYieldComponents.filter(
      (c) => !prepA.ops.some((op, i) => keptIndices.has(i) && Array.isArray(OP_COMPONENTS[i]) && OP_COMPONENTS[i].includes(c))
    );
    check(
      "variant-morrisons-keptops-no-dropped-op-dependency",
      strandedComponents.length === 0,
      `kept yield components with no kept op producing them: ${JSON.stringify(strandedComponents)}`
    );

    // Coherence check 3: the chickpea-tin contention itself — every op that
    // touches the tester's single chickpea tin for the (dropped) jerk-
    // chickpea batch is either fully dropped or, if kept for an unrelated
    // reason, carries a testerNote telling the user to skip that part.
    const chickpeaOpIndices = [0, 1, 6, 8];
    const chickpeaOk = chickpeaOpIndices.every((i) => !keptIndices.has(i) || Boolean(keptOps.find((o) => o.opIndex === i)?.testerNote));
    check(
      "variant-morrisons-chickpea-tin-not-contended",
      chickpeaOk,
      "every kept op touching the jerk-chickpea tray either carries a testerNote or was dropped — Monday's a-d1l chickpea need is never put at risk by the Sunday session"
    );
  }
  check("variant-morrisons-keptops-nonempty", keptOps.length > 0 && keptOps.length < (prepA?.ops.length ?? 1), `${keptOps.length} of ${prepA?.ops.length ?? 0} prep-a ops kept`);

  const prepOut = {
    sessionBase: "prep-a",
    keptOps,
    note: "Ops whose yield(s) feed no kept meal are dropped (Turkey bolognese/Efo riro base/Jerk chickpeas/Boiled eggs/Jollof — all Wednesday or the Tue/Wed snacks, none of which survive the tester); grams stay as authored. Kept ops that still touch a dropped component (op0/op1/op6's jerk-chickpea thread, op12's suya, op13's bolognese mention) carry their own testerNote rather than being dropped outright — dropping op6 or op12 would strand a-d1l's own roast-chicken/white-sauce prep, and op1's Tray B specifically would otherwise consume the tester's single 240g chickpea tin that Monday's a-d1l lunch also needs straight from the tin. Anomaly: prep-a's op1 body reads '600 g chicken breast' but the Morrisons basket buys a 630 g pack (the smallest pack that clears the 575 g whole-Week-A need at a lower total cost than the 1 kg pack) — the op text was never re-derived from the pack size, it states the batch's own working figure.",
  };

  // --- 7. Economics (verbatim from the source's own LCD header, cross-
  //     checked against the computed basket total). ---
  check("variant-morrisons-economics-total-matches-basket", totalP === 6983, `basket totalP=${totalP}, header claims £69.83`);
  const economics = { total: "£69.83", meals: 10, perMeal: "£6.98 (both covers)" };

  // --- 8. Anomalies: parser-level anomalies (should be none — see
  //     morrisons.js's own summary), this section's own `va` findings, plus
  //     the two provenance notes docs/VARIANT-SPEC.md explicitly calls for
  //     (menu prose is a summary of the OLD tool's methods and must not be
  //     imported; menu kcal figures are pre-seasoning legacy numbers). ---
  const legacyKcalDrift = (() => {
    let count = 0;
    for (const day of morrisons.menu.days) {
      for (const menuMeal of day.meals) {
        const m = meals.find((x) => x.week === "A" && x.day === DAY_CODE_TO_NUM[day.code] && x.slot === menuMeal.slot);
        if (!m) continue;
        if (m.macros.w.kcal !== menuMeal.macros.w?.kcal || m.macros.m.kcal !== menuMeal.macros.m?.kcal) count++;
      }
    }
    return count;
  })();

  const anomalies = [
    ...morrisons.anomalies,
    ...va,
    {
      type: "menu-prose-provenance-whey",
      detail:
        "FD5-Menu-Morrisons.html's protein-pancakes method prose (Tuesday breakfast, a-d2b) still reads 'Oats blitzed to flour with the whey, egg and half the skyr...' — a leftover mention from the old tool. The app's approved rev-B covers for a-d2b (oats, egg, blueberries, raspberries, peanut_butter, rapeseed_oil, skyr) carry NO whey ingredient at all, and no 'whey' id exists anywhere in ingredients.json. Per docs/VARIANT-SPEC.md, the rev-B covers are the truth; this menu-prose mention is recorded here as provenance, not imported or treated as a missing ingredient.",
    },
    {
      type: "menu-prose-provenance-legacy-kcal",
      detail: `FD5-Menu-Morrisons.html's per-meal kcal figures are the OLD tool's pre-seasoning numbers, not the app's rev-B recompute. ${legacyKcalDrift} of the 10 kept meals now differ from the menu's published kcal (a-d1l, a-d2l, a-d2d, a-d5l, a-d5d all run slightly higher post-seasoning; the LCD header's own "4,753/6,141 kcal total" sums the menu's legacy per-meal figures exactly, not the rev-B totals used to compute this variant's own targets band). The app's recomputed macros win, per spec.`,
    },
  ];

  return {
    id: "morrisons-tester",
    label: "morrisons starter · 10 meals",
    week: "A",
    slots,
    targets,
    basket,
    coverage,
    defrost,
    prep: prepOut,
    economics,
    anomalies,
    _decisionIds: { coverageDecision: coverageDecision.id },
  };
})();

check(
  "variant-morrisons-shape-ok",
  Array.isArray(variantMorrisons.slots.kept) &&
    variantMorrisons.slots.kept.length === 10 &&
    variantMorrisons.slots.cut.length === 10 &&
    variantMorrisons.basket.lines.length === 39 &&
    variantMorrisons.basket.totalP === 6983,
  "variant-morrisons.json top-level shape sanity"
);

fs.mkdirSync(OUT, { recursive: true });
function write(name, data) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2) + "\n");
  console.log("wrote", name);
}

write("ingredients.json", ingredients);
write("retired.json", retired);
write("meals.json", meals);
write("prep.json", prep);
write("calendar.json", calendar);
write("plan.json", plan);
write("decisions-queue.json", decisions);
write("validation.json", validation);
write("variant-morrisons.json", variantMorrisons);

const anyFail = validation.some((v) => !v.pass);
console.log(`\n${validation.length} checksums run, ${validation.filter((v) => v.pass).length} passed, ${validation.filter((v) => !v.pass).length} failed.`);
console.log(
  `${decisions.length} decisions-queue entries (${decisions.filter((d) => d.status === "open").length} open, ${
    decisions.filter((d) => d.status === "resolved-by-default").length
  } resolved-by-default, ${decisions.filter((d) => d.status === "resolved").length} resolved-by-owner-ruling).`
);

if (anyFail) {
  console.error("One or more checksums failed. See validation.json.");
  process.exit(1);
}
