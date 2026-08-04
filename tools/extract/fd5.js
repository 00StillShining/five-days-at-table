// tools/extract/fd5.js — Phase 0 parser for FD-5.html
//
// Lifts the dataset literal `const D = {…};` from FD-5.html line 303 and
// emits data/raw/fd5.json. See tools/extract/CONTRACT.md for the shared
// parser rules and PLAN.md §2/§3 for the source-format facts this parser
// relies on.
//
// Scope: this file only. It does not touch package.json, other parsers,
// or git.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE_FILE = 'FD-5.html';
const SOURCE_LINE_NUMBER = 303; // 1-indexed, per PLAN.md §2
const LINE_PREFIX = 'const D = '; // exactly 10 characters
const LINE_SUFFIX = ';';
const OUTPUT_PATH = join('data', 'raw', 'fd5.json');
const DECISION_REQUEST_PATH = join('data', 'raw', 'decision-request.fd5.json');

const EXPECTED_ID_COUNT = 59;
const EXPECTED_PRICE_COUNT = 55;
const EXPECTED_MEAL_COUNT = 20;
const EXPECTED_MEALSB_COUNT = 20;
const EXPECTED_MEAL_KEY_PATTERN = /^d[1-5][blds]$/;
const ALLOWED_SHOPS = new Set(['S', 'M', 'X']);
const ALLOWED_VERS = new Set([0, 1]);
const EXPECTED_NO_PRICE_IDS = ['milk', 'egg_white', 'edamame', 'mango'];

/**
 * Write a decision-request file and signal the caller to stop and exit
 * non-zero. Per the CONTRACT.md standing rule, this is used only when
 * faithful extraction is blocked by real ambiguity — never for ordinary
 * observations, which belong in `anomalies` instead.
 */
function writeDecisionRequest(question, context, options) {
  mkdirSync(join('data', 'raw'), { recursive: true });
  writeFileSync(
    DECISION_REQUEST_PATH,
    JSON.stringify({ question, context, options }, null, 2) + '\n',
    'utf8'
  );
}

class BlockedByAmbiguity extends Error {}

/**
 * Extract the FD-5 dataset. Returns the data object described in the task
 * brief. Throws BlockedByAmbiguity if the source line doesn't match the
 * documented exact format (in which case the caller must write a
 * decision-request and exit non-zero rather than guessing).
 */
export function extract() {
  const html = readFileSync(SOURCE_FILE, 'utf8');
  const lines = html.split('\n');
  const line = lines[SOURCE_LINE_NUMBER - 1];

  if (line === undefined) {
    throw new BlockedByAmbiguity(
      `${SOURCE_FILE} has only ${lines.length} lines; line ${SOURCE_LINE_NUMBER} does not exist.`
    );
  }
  if (!line.startsWith(LINE_PREFIX)) {
    throw new BlockedByAmbiguity(
      `Line ${SOURCE_LINE_NUMBER} of ${SOURCE_FILE} does not start with the expected ` +
        `${JSON.stringify(LINE_PREFIX)} prefix. First 40 chars observed: ` +
        JSON.stringify(line.slice(0, 40))
    );
  }
  if (!line.endsWith(LINE_SUFFIX)) {
    throw new BlockedByAmbiguity(
      `Line ${SOURCE_LINE_NUMBER} of ${SOURCE_FILE} does not end with the expected ` +
        `${JSON.stringify(LINE_SUFFIX)} suffix. Last 40 chars observed: ` +
        JSON.stringify(line.slice(-40))
    );
  }

  const jsonText = line.slice(LINE_PREFIX.length, line.length - LINE_SUFFIX.length);

  let D;
  try {
    D = JSON.parse(jsonText);
  } catch (err) {
    throw new BlockedByAmbiguity(
      `Line ${SOURCE_LINE_NUMBER} of ${SOURCE_FILE}, after stripping prefix/suffix, is not ` +
        `strict JSON: ${err.message}`
    );
  }

  const requiredKeys = [
    'food', 'spec', 'prices', 'shops', 'aisle', 'aisleName', 'targets',
    'days', 'themes', 'train', 'notes', 'prep', 'meals', 'mealsB',
  ];
  const missingKeys = requiredKeys.filter((k) => !(k in D));
  if (missingKeys.length > 0) {
    throw new BlockedByAmbiguity(
      `Parsed D is missing expected top-level key(s): ${missingKeys.join(', ')}. ` +
        `Keys present: ${Object.keys(D).join(', ')}`
    );
  }

  const anomalies = [];

  const ids = Object.keys(D.food);
  const specIds = Object.keys(D.spec);
  const priceIds = Object.keys(D.prices);
  const mealIds = Object.keys(D.meals);
  const mealsBIds = Object.keys(D.mealsB);

  // --- food/spec id-set parity ---
  if (ids.length !== EXPECTED_ID_COUNT) {
    anomalies.push({
      type: 'food-id-count-mismatch',
      expected: EXPECTED_ID_COUNT,
      actual: ids.length,
    });
  }
  if (specIds.length !== EXPECTED_ID_COUNT) {
    anomalies.push({
      type: 'spec-id-count-mismatch',
      expected: EXPECTED_ID_COUNT,
      actual: specIds.length,
    });
  }
  const foodSet = new Set(ids);
  const specSet = new Set(specIds);
  const foodNotInSpec = ids.filter((id) => !specSet.has(id));
  const specNotInFood = specIds.filter((id) => !foodSet.has(id));
  if (foodNotInSpec.length > 0 || specNotInFood.length > 0) {
    anomalies.push({
      type: 'food-spec-key-set-mismatch',
      foodNotInSpec,
      specNotInFood,
    });
  }

  // --- prices ---
  if (priceIds.length !== EXPECTED_PRICE_COUNT) {
    anomalies.push({
      type: 'price-count-mismatch',
      expected: EXPECTED_PRICE_COUNT,
      actual: priceIds.length,
    });
  }
  const pricesNotInFood = priceIds.filter((id) => !foodSet.has(id));
  if (pricesNotInFood.length > 0) {
    anomalies.push({
      type: 'price-id-not-in-food',
      ids: pricesNotInFood,
    });
  }
  const badShopRecords = [];
  const badVerRecords = [];
  for (const id of priceIds) {
    const rec = D.prices[id];
    if (!ALLOWED_SHOPS.has(rec.shop)) {
      badShopRecords.push({ id, shop: rec.shop });
    }
    if (!ALLOWED_VERS.has(rec.ver)) {
      badVerRecords.push({ id, ver: rec.ver });
    }
  }
  if (badShopRecords.length > 0) {
    anomalies.push({
      type: 'price-uses-dead-shop-code',
      note: 'PLAN.md §2 says shop "H" is a dead code path; record, do not drop.',
      records: badShopRecords,
    });
  }
  if (badVerRecords.length > 0) {
    anomalies.push({
      type: 'price-uses-dead-ver-code',
      note: 'PLAN.md §2 says ver===2 is a dead code path; record, do not drop.',
      records: badVerRecords,
    });
  }

  // --- meals / mealsB ---
  if (mealIds.length !== EXPECTED_MEAL_COUNT) {
    anomalies.push({
      type: 'meals-count-mismatch',
      expected: EXPECTED_MEAL_COUNT,
      actual: mealIds.length,
    });
  }
  if (mealsBIds.length !== EXPECTED_MEALSB_COUNT) {
    anomalies.push({
      type: 'mealsB-count-mismatch',
      expected: EXPECTED_MEALSB_COUNT,
      actual: mealsBIds.length,
    });
  }
  const badMealKeys = mealIds.filter((k) => !EXPECTED_MEAL_KEY_PATTERN.test(k));
  const badMealsBKeys = mealsBIds.filter((k) => !EXPECTED_MEAL_KEY_PATTERN.test(k));
  if (badMealKeys.length > 0) {
    anomalies.push({ type: 'meals-key-pattern-mismatch', keys: badMealKeys });
  }
  if (badMealsBKeys.length > 0) {
    anomalies.push({ type: 'mealsB-key-pattern-mismatch', keys: badMealsBKeys });
  }

  // --- mealsB method placeholder check ---
  const methodStrings = mealsBIds.map((id) => D.mealsB[id]?.method);
  const distinctMethods = [...new Set(methodStrings)];
  anomalies.push({
    type: 'mealsB-method-placeholder-note',
    note:
      'Known fact (not an error): all 20 mealsB.method strings are expected to be one ' +
      'identical placeholder (Week B methods live in FD5-Week-B-Methods.html; this field ' +
      'is copy-pasted from Week A per PLAN.md §2).',
    distinctCount: distinctMethods.length,
    distinctStrings: distinctMethods,
  });
  if (distinctMethods.length !== 1) {
    anomalies.push({
      type: 'mealsB-method-not-single-placeholder',
      note: 'Expected exactly one distinct placeholder string; found more than one.',
      distinctCount: distinctMethods.length,
    });
  }

  // --- food ids with no price entry ---
  const noPriceIds = ids.filter((id) => !priceIds.includes(id));
  const sortedNoPrice = [...noPriceIds].sort();
  const sortedExpected = [...EXPECTED_NO_PRICE_IDS].sort();
  const noPriceMatches =
    sortedNoPrice.length === sortedExpected.length &&
    sortedNoPrice.every((id, i) => id === sortedExpected[i]);
  if (!noPriceMatches) {
    anomalies.push({
      type: 'no-price-ids-mismatch',
      expected: EXPECTED_NO_PRICE_IDS,
      actual: noPriceIds,
    });
  }

  const data = {
    ids,
    food: D.food,
    spec: D.spec,
    prices: D.prices,
    shops: D.shops,
    aisle: D.aisle,
    aisleName: D.aisleName,
    targets: D.targets,
    days: D.days,
    themes: D.themes,
    train: D.train,
    notes: D.notes,
    prep: D.prep,
    meals: D.meals,
    mealsB: D.mealsB,
    format: {
      food: 'per-100g positional [kcal, protein, FIBRE, carb, fat] — fibre at index 2, BEFORE carb; net carb is DERIVED (carb − fibre), never stored',
      spec: '[displayName, weightState, householdUnitGrams|null, unitSingular, unitPlural]',
      prices: '{shop: S|M|X, name, pack(g), price(£), ver: 0|1} — ver:0 = estimate',
    },
    anomalies,
  };

  return {
    data,
    diagnostics: {
      foodCount: ids.length,
      specCount: specIds.length,
      priceCount: priceIds.length,
      mealCount: mealIds.length,
      mealsBCount: mealsBIds.length,
      noPriceIds,
      distinctMealsBMethodCount: distinctMethods.length,
    },
  };
}

function runAcceptanceChecks(data, diagnostics) {
  const results = [];

  results.push({
    criterion: 'food and spec each have 59 ids; key sets identical',
    pass:
      diagnostics.foodCount === EXPECTED_ID_COUNT &&
      diagnostics.specCount === EXPECTED_ID_COUNT &&
      !data.anomalies.some((a) => a.type === 'food-spec-key-set-mismatch'),
    detail: { foodCount: diagnostics.foodCount, specCount: diagnostics.specCount },
  });

  results.push({
    criterion: 'prices has 55 ids, all present in food; ver ∈ {0,1}; shop ∈ {S,M,X} (H/ver2 recorded not dropped)',
    pass:
      diagnostics.priceCount === EXPECTED_PRICE_COUNT &&
      !data.anomalies.some((a) => a.type === 'price-id-not-in-food'),
    detail: {
      priceCount: diagnostics.priceCount,
      deadShopRecords: data.anomalies.find((a) => a.type === 'price-uses-dead-shop-code') ?? null,
      deadVerRecords: data.anomalies.find((a) => a.type === 'price-uses-dead-ver-code') ?? null,
    },
  });

  results.push({
    criterion: 'meals has 20 entries, mealsB has 20 entries (keys d1b…d5s pattern)',
    pass:
      diagnostics.mealCount === EXPECTED_MEAL_COUNT &&
      diagnostics.mealsBCount === EXPECTED_MEALSB_COUNT &&
      !data.anomalies.some(
        (a) => a.type === 'meals-key-pattern-mismatch' || a.type === 'mealsB-key-pattern-mismatch'
      ),
    detail: { mealCount: diagnostics.mealCount, mealsBCount: diagnostics.mealsBCount },
  });

  results.push({
    criterion: '20 mealsB method strings are one identical placeholder (known fact, recorded in anomalies)',
    pass: diagnostics.distinctMealsBMethodCount === 1,
    detail: { distinctCount: diagnostics.distinctMealsBMethodCount },
  });

  const sortedNoPrice = [...diagnostics.noPriceIds].sort();
  const sortedExpected = [...EXPECTED_NO_PRICE_IDS].sort();
  const noPriceMatches =
    sortedNoPrice.length === sortedExpected.length &&
    sortedNoPrice.every((id, i) => id === sortedExpected[i]);
  results.push({
    criterion: 'food ids with no price entry are exactly: milk, egg_white, edamame, mango',
    pass: noPriceMatches,
    detail: { actual: diagnostics.noPriceIds },
  });

  return results;
}

function main() {
  let extraction;
  try {
    extraction = extract();
  } catch (err) {
    if (err instanceof BlockedByAmbiguity) {
      writeDecisionRequest(
        'FD-5.html line 303 did not match the documented exact format required for faithful, ' +
          'non-guessing extraction of the D dataset.',
        err.message,
        [
          'Inspect FD-5.html around line 303 and confirm/update the expected prefix/suffix/line number.',
          'If the file has been intentionally edited, update PLAN.md §2 to describe the new format and re-run.',
        ]
      );
      console.error('BLOCKED: ' + err.message);
      console.error('Decision request written to ' + DECISION_REQUEST_PATH);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const { data, diagnostics } = extraction;

  mkdirSync(join('data', 'raw'), { recursive: true });
  const json = JSON.stringify(data, null, 2);
  writeFileSync(OUTPUT_PATH, json, 'utf8');

  // Round-trip check: JSON.parse(readFileSync(...)) succeeds and deep-equals
  // what was written.
  const readBack = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'));
  const roundTripOk = JSON.stringify(readBack) === JSON.stringify(data);

  const acceptance = runAcceptanceChecks(data, diagnostics);
  acceptance.push({
    criterion: 'data/raw/fd5.json round-trips (parse succeeds and deep-equals written data)',
    pass: roundTripOk,
    detail: {},
  });

  const allPass = acceptance.every((a) => a.pass);

  console.log('=== fd5.js extraction summary ===');
  console.log(`ids: ${diagnostics.foodCount}`);
  console.log(`prices: ${diagnostics.priceCount}`);
  console.log(`meals: ${diagnostics.mealCount}`);
  console.log(`mealsB: ${diagnostics.mealsBCount}`);
  console.log('');
  console.log('--- acceptance criteria ---');
  for (const a of acceptance) {
    console.log(`[${a.pass ? 'PASS' : 'FAIL'}] ${a.criterion}`);
    if (!a.pass) {
      console.log('  detail:', JSON.stringify(a.detail));
    }
  }
  console.log('');
  console.log('--- anomalies ---');
  console.log(JSON.stringify(data.anomalies, null, 2));
  console.log('');
  console.log(`file written: ${OUTPUT_PATH}`);
  console.log('');
  console.log(allPass ? 'RESULT: ALL ACCEPTANCE CRITERIA PASS' : 'RESULT: ONE OR MORE ACCEPTANCE CRITERIA FAILED');

  if (!allPass) {
    process.exitCode = 1;
  }
}

// Only run when executed directly (`node tools/extract/fd5.js`), not on import.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main();
}
