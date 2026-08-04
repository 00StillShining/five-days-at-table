// tools/extract/methods.js
// Parses FD5-Week-A-Methods.html and FD5-Week-B-Methods.html into data/raw/methods.json.
// See tools/extract/CONTRACT.md for the shared parser contract.

import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();

const MACRO_KEYS = {
  kcal: 'kcal',
  protein: 'protein',
  'net carb': 'netCarb',
  fat: 'fat',
  fibre: 'fibre',
};

function norm(text) {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function parseGram(rawText) {
  const cleaned = norm(rawText).replace(/,/g, '');
  const m = cleaned.match(/^([\d.]+)\s*g$/);
  if (m) return { value: parseFloat(m[1]), raw: null };
  return { value: null, raw: norm(rawText) };
}

function parseSunday($, sec0, anomalies, weekLabel) {
  const secheads = sec0.find('> div.sechead');
  const sechead00 = secheads.first();
  const theme = norm(sechead00.find('span.theme').first().text());
  const tag = norm(sechead00.find('span.tag').first().text());

  const ops = [];
  sec0.find('> div.ops > div.op').each((i, el) => {
    const $op = $(el);
    const clock = norm($op.find('> div.clk').first().text());
    const title = norm($op.find('h4').first().text());
    const body = norm($op.find('p').first().text());
    const kit = norm($op.find('> div.kit').first().text());
    if (!clock) {
      anomalies.push({ week: weekLabel, section: 'sunday-ops', index: i, detail: 'op missing clock' });
    }
    ops.push({ clock, title, body, kit });
  });

  const yields = [];
  sec0.find('> div.yield table.ytab tr').each((i, tr) => {
    const tds = $(tr).find('td');
    if (tds.length !== 4) {
      anomalies.push({ week: weekLabel, section: 'sunday-yield', index: i, detail: `expected 4 td, got ${tds.length}` });
      return;
    }
    yields.push({
      component: norm($(tds.get(0)).text()),
      qty: norm($(tds.get(1)).text()),
      consumers: norm($(tds.get(2)).text()),
      storage: norm($(tds.get(3)).text()),
    });
  });

  const midweek = [];
  sec0.find('> div.mid > div.midc').each((i, el) => {
    const $midc = $(el);
    const heading = norm($midc.find('b').first().text());
    const body = norm($midc.find('span').first().text());
    midweek.push({ heading, body });
  });

  return { theme, tag, ops, yields, midweek };
}

function parseCard($, cardEl, weekLabel, dayNo, dayName, anomalies) {
  const $card = $(cardEl);
  const slot = norm($card.find('span.slot').first().text());
  const name = norm($card.find('h3').first().text());

  const chips = $card.find('div.chips > span.chip');
  let tag = null;
  let timeChip = '';
  let originChip = '';
  if (chips.length >= 1) {
    const $first = $(chips.get(0));
    if ($first.hasClass('batch')) tag = 'batch';
    else if ($first.hasClass('fresh')) tag = 'fresh';
    else {
      anomalies.push({ week: weekLabel, card: name, detail: `first chip class not batch/fresh: "${$first.attr('class')}"` });
    }
  } else {
    anomalies.push({ week: weekLabel, card: name, detail: 'no chips found' });
  }
  if (chips.length >= 2) timeChip = norm($(chips.get(1)).text());
  if (chips.length >= 3) originChip = norm($(chips.get(2)).text());
  if (chips.length !== 3) {
    anomalies.push({ week: weekLabel, card: name, detail: `expected 3 chips, got ${chips.length}` });
  }

  const ingredients = [];
  $card.find('table.itab tr').each((i, tr) => {
    const $tr = $(tr);
    if ($tr.find('th').length) return; // header row, skip
    const tds = $tr.find('td');
    if (tds.length < 3) {
      anomalies.push({ week: weekLabel, card: name, detail: `ingredient row with ${tds.length} td` });
      return;
    }
    const nameTd = $(tds.get(0));
    const nameClone = nameTd.clone();
    const wSpan = nameClone.find('span.w');
    const weightState = wSpan.length ? norm(wSpan.text()) : '';
    wSpan.remove();
    const ingName = norm(nameClone.text());

    const herTd = $tr.find('td.n.her');
    const himTd = $tr.find('td.n.him');

    const herResult = parseGram(herTd.text());
    if (herResult.value === null) {
      anomalies.push({ week: weekLabel, card: name, ingredient: ingName, detail: `non-clean her gram cell: "${herResult.raw}"` });
    }

    const himClone = himTd.clone();
    const uSpan = himClone.find('span.u');
    let unitHint = null;
    if (uSpan.length) {
      unitHint = norm(uSpan.text());
      uSpan.remove();
    }
    const himResult = parseGram(himClone.text());
    if (himResult.value === null) {
      anomalies.push({ week: weekLabel, card: name, ingredient: ingName, detail: `non-clean him gram cell: "${himResult.raw}"` });
    }

    const row = {
      name: ingName,
      weightState,
      herG: herResult.value,
      himG: himResult.value,
      unitHint,
    };
    if (herResult.value === null) row.herRaw = herResult.raw;
    if (himResult.value === null) row.himRaw = himResult.raw;
    ingredients.push(row);
  });

  if (ingredients.length < 3) {
    anomalies.push({ week: weekLabel, card: name, detail: `only ${ingredients.length} ingredient rows (expected >= 3)` });
  }

  const steps = [];
  $card.find('div.steps ol li p').each((i, el) => {
    steps.push(norm($(el).text()));
  });
  if (steps.length === 0) {
    anomalies.push({ week: weekLabel, card: name, detail: 'no steps found' });
  }

  const why = norm($card.find('div.why span').first().text());

  const macros = {};
  const whoSpans = $card.find('div.mac span.who');
  if (whoSpans.length !== 2) {
    anomalies.push({ week: weekLabel, card: name, detail: `expected 2 span.who, got ${whoSpans.length}` });
  }
  whoSpans.each((i, whoEl) => {
    const $who = $(whoEl);
    const whoText = norm($who.text()).toLowerCase();
    const key = whoText === 'her' ? 'her' : whoText === 'him' ? 'him' : null;
    if (!key) {
      anomalies.push({ week: weekLabel, card: name, detail: `unexpected who label: "${whoText}"` });
      return;
    }
    const $row = $who.next('span.row');
    const vs = $row.find('span.v');
    const macroObj = {};
    vs.each((vi, vEl) => {
      const $v = $(vEl);
      const label = norm($v.find('i').first().text()).toLowerCase();
      const valClone = $v.clone();
      valClone.find('i').remove();
      const valText = norm(valClone.text());
      const mapped = MACRO_KEYS[label];
      if (!mapped) {
        anomalies.push({ week: weekLabel, card: name, detail: `unrecognized macro label: "${label}"` });
        return;
      }
      const num = parseFloat(valText.replace(/,/g, ''));
      macroObj[mapped] = Number.isNaN(num) ? null : num;
      if (Number.isNaN(num)) {
        anomalies.push({ week: weekLabel, card: name, detail: `non-numeric macro value for ${mapped}: "${valText}"` });
      }
    });
    if (Object.keys(macroObj).length !== 5) {
      anomalies.push({ week: weekLabel, card: name, detail: `${key} macro row has ${Object.keys(macroObj).length} values (expected 5)` });
    }
    macros[key] = macroObj;
  });

  return {
    week: weekLabel,
    dayNo,
    dayName,
    slot,
    name,
    tag,
    timeChip,
    originChip,
    ingredients,
    steps,
    why,
    macros,
  };
}

function parseWeek(filePath, weekLabel, anomalies) {
  const html = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(html);

  const secs = $('div.sec');
  const sec0 = secs.eq(0);
  const sunday = parseSunday($, sec0, anomalies, weekLabel);

  const cards = [];
  secs.each((i, secEl) => {
    if (i === 0) return; // Sunday section, no cards
    const $sec = $(secEl);
    const sechead = $sec.find('> div.sechead').first();
    const noText = norm(sechead.find('span.no').first().text());
    const dayNo = parseInt(noText, 10);
    const dayName = norm(sechead.find('h2').first().text());
    if (Number.isNaN(dayNo)) {
      anomalies.push({ week: weekLabel, section: `sec-${i}`, detail: `could not parse day number from "${noText}"` });
    }
    $sec.find('div.card').each((ci, cardEl) => {
      cards.push(parseCard($, cardEl, weekLabel, dayNo, dayName, anomalies));
    });
  });

  if (cards.length !== 20) {
    anomalies.push({ week: weekLabel, detail: `expected 20 cards, got ${cards.length}` });
  }

  return { sunday, cards };
}

export function extract() {
  const anomalies = [];

  const fileA = path.join(ROOT, 'FD5-Week-A-Methods.html');
  const fileB = path.join(ROOT, 'FD5-Week-B-Methods.html');

  const weekA = parseWeek(fileA, 'A', anomalies);
  const weekB = parseWeek(fileB, 'B', anomalies);

  return {
    weeks: { A: weekA, B: weekB },
    anomalies,
  };
}

function summarizeWeek(label, week) {
  const ingredientRows = week.cards.reduce((sum, c) => sum + c.ingredients.length, 0);
  const unitHints = week.cards.reduce((sum, c) => sum + c.ingredients.filter((ing) => ing.unitHint !== null).length, 0);
  const macroStrips = week.cards.filter((c) => Object.keys(c.macros.her || {}).length === 5 && Object.keys(c.macros.him || {}).length === 5).length;
  const whyBlocks = week.cards.filter((c) => c.why && c.why.length > 0).length;
  const tagsOk = week.cards.every((c) => c.tag === 'batch' || c.tag === 'fresh');
  return {
    label,
    cards: week.cards.length,
    ingredientRows,
    unitHints,
    macroStrips,
    ops: week.sunday.ops.length,
    yields: week.sunday.yields.length,
    midweek: week.sunday.midweek.length,
    whyBlocks,
    tagsOk,
  };
}

function runAcceptanceChecks(data) {
  const results = [];
  const { A, B } = data.weeks;
  const sA = summarizeWeek('A', A);
  const sB = summarizeWeek('B', B);

  const check = (name, pass, detail) => results.push({ name, pass, detail });

  check('A: 20 cards', sA.cards === 20, `got ${sA.cards}`);
  check('B: 20 cards', sB.cards === 20, `got ${sB.cards}`);

  const minIngredientsA = A.cards.every((c) => c.ingredients.length >= 3);
  const minIngredientsB = B.cards.every((c) => c.ingredients.length >= 3);
  check('A: every card >=3 ingredient rows', minIngredientsA, '');
  check('B: every card >=3 ingredient rows', minIngredientsB, '');

  const macros5A = A.cards.every((c) => Object.keys(c.macros.her || {}).length === 5 && Object.keys(c.macros.him || {}).length === 5);
  const macros5B = B.cards.every((c) => Object.keys(c.macros.her || {}).length === 5 && Object.keys(c.macros.him || {}).length === 5);
  check('A: every card 2x5 macros', macros5A, '');
  check('B: every card 2x5 macros', macros5B, '');

  check('A: her gram cells total 149', sA.ingredientRows === 149, `got ${sA.ingredientRows}`);
  check('B: her gram cells total 132', sB.ingredientRows === 132, `got ${sB.ingredientRows}`);

  check('A: unit hints 43', sA.unitHints === 43, `got ${sA.unitHints}`);
  check('B: unit hints 44', sB.unitHints === 44, `got ${sB.unitHints}`);

  check('A: 20 why blocks', sA.whyBlocks === 20, `got ${sA.whyBlocks}`);
  check('B: 20 why blocks', sB.whyBlocks === 20, `got ${sB.whyBlocks}`);

  check('A: every card tag batch|fresh', sA.tagsOk, '');
  check('B: every card tag batch|fresh', sB.tagsOk, '');

  const opsClocksA = A.sunday.ops.every((op) => op.clock && op.clock.length > 0);
  check('A: sunday ops count > 5', A.sunday.ops.length > 5, `got ${A.sunday.ops.length}`);
  check('A: every op has a clock', opsClocksA, '');

  check('A: yields non-empty', A.sunday.yields.length > 0, `got ${A.sunday.yields.length}`);
  check('B: yields non-empty', B.sunday.yields.length > 0, `got ${B.sunday.yields.length}`);
  check('A: midweek notes non-empty', A.sunday.midweek.length > 0, `got ${A.sunday.midweek.length}`);
  check('B: midweek notes non-empty', B.sunday.midweek.length > 0, `got ${B.sunday.midweek.length}`);

  return { results, sA, sB };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const data = extract();

  const { results, sA, sB } = runAcceptanceChecks(data);
  const allPass = results.every((r) => r.pass);

  const outPath = path.join(ROOT, 'data', 'raw', 'methods.json');
  const json = JSON.stringify(data, null, 2);

  // Round-trip check before writing.
  let roundTripOk = false;
  try {
    JSON.parse(json);
    roundTripOk = true;
  } catch (e) {
    roundTripOk = false;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, json, 'utf8');

  console.log('=== methods.js extraction summary ===');
  console.log('Week A:', JSON.stringify(sA));
  console.log('Week B:', JSON.stringify(sB));
  console.log('');
  console.log('=== Acceptance criteria ===');
  for (const r of results) {
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  }
  console.log(`[${roundTripOk ? 'PASS' : 'FAIL'}] JSON round-trips through JSON.parse`);
  console.log('');
  console.log(`Anomalies recorded: ${data.anomalies.length}`);
  if (data.anomalies.length > 0) {
    console.log(JSON.stringify(data.anomalies, null, 2));
  }
  console.log('');
  console.log(`Wrote ${outPath}`);

  if (!allPass || !roundTripOk) {
    console.error('One or more acceptance criteria FAILED.');
    process.exit(1);
  }
}
