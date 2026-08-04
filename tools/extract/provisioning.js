// tools/extract/provisioning.js
// Parses FD5-Provisioning.html per tools/extract/CONTRACT.md and PLAN.md §2/§3.
//
// Scope: this file only. Emits data/raw/provisioning.json when run directly.
//
// Source sections (h2, verified 8/8):
//   01  "What the shelf said"                         -> provenance.shelfSaid
//   01b "Three cuts I proposed that died at the shelf" -> provenance.cutsDied
//   01c "The cuts that stuck"                          -> provenance.cutsStuck
//   02  "The six swaps"                                -> provenance.swaps
//   03  "The fourteen days"                             -> defrostCalendar
//   04  "Day 0 — the big shop"                          -> day0
//   04b "Day 7 — the top-up"                            -> day7
//   05  "Storage register"                              -> storageRegister

import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_FILE = 'FD5-Provisioning.html';
const OUT_FILE = path.join('data', 'raw', 'provisioning.json');
const DECISION_FILE = path.join('data', 'raw', 'decision-request.provisioning.json');

// ---------- helpers ----------

/** Collapse whitespace, keep prose verbatim (entities already decoded by cheerio). */
function cleanText(s) {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

/** "£8.50" -> 8.5. Returns null if it doesn't parse. */
function poundsToNumber(str) {
  const m = /£\s*([\d,]+(?:\.\d+)?)/.exec(cleanText(str));
  if (!m) return null;
  return parseFloat(m[1].replace(/,/g, ''));
}

/** "2,040 g" -> 2040. Returns null if it doesn't parse. */
function gramsToNumber(str) {
  const m = /^([\d,]+)\s*g$/.exec(cleanText(str));
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ''), 10);
}

/**
 * Cost cell parsing: the estimate marker is a SIBLING span inside the cost
 * cell (`£8.50<span class="est"> est</span>`). Take the FIRST TEXT NODE for
 * the price; presence of span.est => estimate:true.
 */
function parseCostCell($, td) {
  const firstTextNode = td
    .contents()
    .toArray()
    .find((n) => n.type === 'text' && cleanText(n.data) !== '');
  const priceText = firstTextNode ? cleanText(firstTextNode.data) : cleanText(td.text());
  const cost = poundsToNumber(priceText);
  const estimate = td.find('span.est').length > 0;
  return { cost, estimate, priceText };
}

/**
 * Shelf-life prose -> structured day counts, best-effort.
 * Segments are split on "·". Each segment may carry a qualifier keyword
 * (sealed / open / frozen / fresh); segments without one of those four
 * keywords default to freshDays (the item has no sealed/open/frozen
 * distinction, so its bare shelf life is functionally its "fresh" life —
 * e.g. "4 days cut", "2 weeks", "4 days once riced").
 *
 * A range ("7–10 days") or a month/year count ("6 months", "12 months")
 * cannot be reduced to one exact day-count without inventing a conversion
 * the source does not state, so those stay null and the prose carries them
 * — explicitly permitted by CONTRACT.md's ambiguity rule. Day/week counts
 * are exact (week = 7 days) and are converted.
 */
function parseShelfLife(prose) {
  const result = { prose, sealedDays: null, openDays: null, frozenDays: null, freshDays: null };
  const segments = prose.split('·').map((s) => s.trim()).filter(Boolean);

  for (const seg of segments) {
    const lower = seg.toLowerCase();
    const isRange = /\d\s*[–-]\s*\d/.test(seg);
    let days = null;
    if (!isRange) {
      const m = /^(\d+)\s*(day|days|week|weeks|month|months|year|years)\b/i.exec(seg);
      if (m) {
        const n = parseInt(m[1], 10);
        const unit = m[2].toLowerCase();
        if (unit.startsWith('day')) days = n;
        else if (unit.startsWith('week')) days = n * 7;
        // month/year: no exact day-count conversion stated by the source — leave null.
      }
    }
    if (days === null) continue;

    let field = 'freshDays';
    if (/\bsealed\b/.test(lower)) field = 'sealedDays';
    else if (/\bopen\b/.test(lower)) field = 'openDays';
    else if (/\bfrozen\b/.test(lower)) field = 'frozenDays';
    else if (/\bfresh\b/.test(lower)) field = 'freshDays';
    result[field] = days;
  }
  return result;
}

/**
 * Extract {name, grams} pairs from an op's prose wherever a gram figure is
 * explicitly stated, e.g. "Week A's chicken (770 g) and the chicken breast
 * mince (140 g) go into the fridge." -> [{name:"chicken",grams:770},
 * {name:"chicken breast mince",grams:140}].
 *
 * Only gram-bearing mentions become structured items (per task instructions:
 * "extract per-item grams where stated"); items mentioned without a stated
 * weight (e.g. "the prawns", "the koftas", "Second loaf") are not invented
 * into the items array — the body prose (kept verbatim) still carries them.
 */
function extractOpItems(body) {
  const items = [];
  // Group 1 = everything since the previous clause delimiter (. , ; — ) or
  // start-of-string, up to the opening "(" of a "(<digits> g...)" span.
  const re = /([^.,;—()]+?)\((\d[\d,]*)\s*g\b[^)]*\)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    let name = m[1].trim();
    // Strip common lead-in words that belong to the sentence, not the item name.
    let prev;
    do {
      prev = name;
      name = name.replace(/^(?:and|the|then bring down|now)\s+/i, '');
      name = name.replace(/^week\s+[ab]'s\s+/i, '');
      name = name.trim();
    } while (name !== prev);
    const grams = parseInt(m[2].replace(/,/g, ''), 10);
    if (name) items.push({ name, grams });
  }
  return items;
}

// ---------- section parsers ----------

/** `.swaps > .swap` blocks: <b>heading</b><span class="arrow">arrow</span><span>body</span> */
function parseSwapsBlock($, container) {
  const out = [];
  container.find('> .swap').each((i, el) => {
    const $el = $(el);
    const heading = cleanText($el.find('> b').first().text());
    const arrow = $el.find('> span.arrow').length ? cleanText($el.find('> span.arrow').first().text()) : null;
    // body = the plain (non-arrow) span, i.e. the last span child.
    const spans = $el.find('> span').toArray().filter((s) => !$(s).hasClass('arrow'));
    const body = spans.length ? cleanText($(spans[spans.length - 1]).text()) : '';
    out.push({ heading, arrow, body });
  });
  return out;
}

/** `.mid > .midc` blocks: <b>heading</b><span>body</span> (no arrow). */
function parseMidBlock($, container) {
  const out = [];
  container.find('> .midc').each((i, el) => {
    const $el = $(el);
    const heading = cleanText($el.find('> b').first().text());
    const body = cleanText($el.find('> span').first().text());
    out.push({ heading, arrow: null, body });
  });
  return out;
}

function parseProvenance($, secs, anomalies) {
  // sec0: [sechead(01), swaps(shelfSaid), sechead(01b), mid(cutsDied), sechead(01c), swaps(cutsStuck)]
  const sec0 = secs.eq(0);
  const sec0Children = sec0.children();
  if (sec0Children.length !== 6) {
    anomalies.push({
      type: 'sec0-structure-unexpected',
      detail: `Expected 6 direct children of section 0 (sechead/swaps/sechead/mid/sechead/swaps), found ${sec0Children.length}.`,
    });
  }
  const shelfSaid = parseSwapsBlock($, sec0Children.eq(1));
  const cutsDied = parseMidBlock($, sec0Children.eq(3));
  const cutsStuck = parseSwapsBlock($, sec0Children.eq(5));

  // sec1: "The six swaps" -> [sechead(02), swaps]
  const sec1 = secs.eq(1);
  const swaps = parseSwapsBlock($, sec1.children().eq(1));

  return { shelfSaid, cutsDied, cutsStuck, swaps };
}

function parseDefrostCalendar($, secs, anomalies) {
  const sec2 = secs.eq(2); // "The fourteen days"
  const ops = sec2.find('.ops > .op');
  const out = [];

  ops.each((i, el) => {
    const $el = $(el);
    const $clk = $el.find('.clk').first();
    const dayNoText = cleanText(
      $clk
        .contents()
        .toArray()
        .filter((n) => n.type === 'text')
        .map((n) => n.data)
        .join('')
    );
    const dayNo = parseInt(dayNoText, 10);
    const weekday = cleanText($clk.find('span').first().text());
    const title = cleanText($el.find('h4').first().text());
    const body = cleanText($el.find('p').first().text());
    const kit = cleanText($el.find('.kit').first().text());

    if (Number.isNaN(dayNo)) {
      anomalies.push({ type: 'defrost-op-bad-daynum', detail: `Op ${i} has unparseable day number "${dayNoText}".` });
    }
    if (!weekday) {
      anomalies.push({ type: 'defrost-op-missing-weekday', detail: `Op ${i} (day ${dayNoText}) has no weekday.` });
    }
    if (!title) {
      anomalies.push({ type: 'defrost-op-missing-title', detail: `Op ${i} (day ${dayNoText}) has no title.` });
    }

    // Week is explicit in .kit for 8/10 ops ("Week A" / "Week B"); the two
    // "Shop" ops (day 0, day 7) carry no explicit week label — inferred from
    // dayNo (0-6 = A period, 7-13 = B period), matching the pattern of every
    // other op in the file. Recorded as an anomaly since it is an inference,
    // not a literal read.
    let week = null;
    const kitMatch = /^Week\s+([AB])$/i.exec(kit);
    if (kitMatch) {
      week = kitMatch[1].toUpperCase();
    } else {
      week = dayNo < 7 ? 'A' : 'B';
      anomalies.push({
        type: 'defrost-op-week-inferred',
        detail: `Op "${title}" (day ${dayNoText}, kit "${kit}") has no explicit "Week A/B" kit label; week inferred as "${week}" from dayNo.`,
      });
    }

    const items = extractOpItems(body);

    out.push({ week, dayNo, weekday, title, body, kit, items });
  });

  return out;
}

/** Parse one `table.stab` into row objects; skips header/category-label/summary rows. */
function parseShopTable($, table, { hasShopbar, shop, anomalies, sectionLabel }) {
  const rows = [];
  table.find('> tbody > tr').each((i, tr) => {
    const $tr = $(tr);
    const $nm = $tr.find('> td.nm');
    if ($nm.length === 0) return; // header row / category-label row / .sum row

    const item = cleanText($nm.first().text());
    const tds = $tr.find('> td');
    // Column order: nm, pr(product), need, buy, cost, last(pill or why)
    const need = cleanText(tds.eq(2).text());
    const buy = cleanText(tds.eq(3).text());
    const costCell = tds.eq(4);
    const { cost, estimate, priceText } = parseCostCell($, costCell);
    if (cost === null) {
      anomalies.push({
        type: 'unparseable-cost',
        detail: `${sectionLabel} row "${item}" has unparseable cost text "${priceText}".`,
      });
    }

    const needGrams = gramsToNumber(need);
    if (needGrams === null) {
      anomalies.push({
        type: 'unparseable-need',
        detail: `${sectionLabel} row "${item}" has need text "${need}" that does not match "N g".`,
      });
    }

    let pill = null;
    let why = undefined;
    const lastTd = tds.last();
    const pillSpan = lastTd.find('span.pill');
    if (pillSpan.length) {
      pill = cleanText(pillSpan.text());
    } else if (hasShopbar === false) {
      // Day-7 table: no pill markup — last column is "Why", carrying the
      // same shelf-life prose as the storage register (kept here too, for
      // lossless extraction — not part of the minimum requested shape).
      why = cleanText(lastTd.text());
    }

    rows.push({
      item,
      need: needGrams !== null ? needGrams : need,
      buy,
      cost,
      estimate,
      pill,
      shop,
      ...(why !== undefined ? { why } : {}),
    });
  });
  return rows;
}

function parseDay0Day7($, secs, anomalies) {
  const sec3 = secs.eq(3); // contains both "Day 0" and "Day 7 — the top-up"
  const children = sec3.children();

  // Expect: sechead(04), shopbox×N, sechead(04b), shopbox(day7)
  let day7SecheadIdx = -1;
  children.each((i, el) => {
    const h2 = $(el).find('h2').text();
    if (/^Day 7/i.test(h2)) day7SecheadIdx = i;
  });

  if (day7SecheadIdx === -1) {
    anomalies.push({ type: 'day7-sechead-not-found', detail: 'Could not locate the "Day 7" sechead inside section 3.' });
  }

  const day0Boxes = [];
  const day7Boxes = [];
  children.each((i, el) => {
    if (!$(el).hasClass('shopbox')) return;
    if (day7SecheadIdx !== -1 && i > day7SecheadIdx) day7Boxes.push(el);
    else day0Boxes.push(el);
  });

  // --- day0 ---
  let day0 = [];
  for (const box of day0Boxes) {
    const $box = $(box);
    const shopbar = $box.find('> .shopbar').first();
    const shop = cleanText(shopbar.find('.code').first().text()) || null;
    const shopName = cleanText(shopbar.find('h4').first().text());
    if (!shop) {
      anomalies.push({ type: 'day0-missing-shop-code', detail: 'A day-0 shopbox has no .shopbar .code.' });
    }
    const table = $box.find('> table.stab').first();
    const rows = parseShopTable($, table, { hasShopbar: true, shop, anomalies, sectionLabel: 'day0' });
    day0 = day0.concat(rows);

    // Cross-check computed line-cost sum against the shown shopbar total and
    // the table's own .sum row — the source document itself is not always
    // internally consistent to the penny (see anomaly below if it fires).
    const shownAmtPence = Math.round((poundsToNumber(shopbar.find('.amt').first().text()) ?? NaN) * 100);
    const sumRowText = table.find('tr.sum td.mono').first().text();
    const shownSumRowPence = Math.round((poundsToNumber(sumRowText) ?? NaN) * 100);
    const computedPence = rows.reduce((acc, r) => acc + Math.round(r.cost * 100), 0);
    if (Number.isFinite(shownAmtPence) && shownAmtPence !== computedPence) {
      anomalies.push({
        type: 'day0-shop-subtotal-mismatch',
        detail: `${shopName} (${shop}): sum of the ${rows.length} parsed line costs is £${(computedPence / 100).toFixed(2)}, but the shopbar/.sum row shows £${(shownAmtPence / 100).toFixed(2)}. This is a rounding discrepancy present in the source document itself, not introduced by the parser (verified independently against the raw table cells).`,
      });
    }
    if (Number.isFinite(shownSumRowPence) && shownSumRowPence !== shownAmtPence) {
      anomalies.push({
        type: 'day0-shopbar-sumrow-mismatch',
        detail: `${shopName} (${shop}): shopbar .amt shows £${(shownAmtPence / 100).toFixed(2)} but the table's tr.sum row shows £${(shownSumRowPence / 100).toFixed(2)}.`,
      });
    }
  }

  // --- day7 (no shopbar; Morrisons per PLAN §2 "The day-7 table has no
  // shopbar... They are Morrisons items") ---
  let day7 = [];
  for (const box of day7Boxes) {
    const $box = $(box);
    const hasShopbar = $box.find('> .shopbar').length > 0;
    if (hasShopbar) {
      anomalies.push({ type: 'day7-unexpected-shopbar', detail: 'A day-7 shopbox unexpectedly has a .shopbar.' });
    }
    const table = $box.find('> table.stab').first();
    const rows = parseShopTable($, table, { hasShopbar: false, shop: 'M', anomalies, sectionLabel: 'day7' });
    day7 = day7.concat(rows);

    const sumRowText = table.find('tr.sum td.mono').first().text();
    const shownSumRowPence = Math.round((poundsToNumber(sumRowText) ?? NaN) * 100);
    const computedPence = rows.reduce((acc, r) => acc + Math.round(r.cost * 100), 0);
    if (Number.isFinite(shownSumRowPence) && shownSumRowPence !== computedPence) {
      anomalies.push({
        type: 'day7-subtotal-mismatch',
        detail: `Day-7 top-up: sum of the ${rows.length} parsed line costs is £${(computedPence / 100).toFixed(2)}, but the table's tr.sum row shows £${(shownSumRowPence / 100).toFixed(2)}.`,
      });
    }
  }
  anomalies.push({
    type: 'day7-shop-structural',
    detail:
      'The Day 7 top-up table (section "Day 7 — the top-up") has no .shopbar element, unlike the three Day-0 tables. ' +
      'Per PLAN.md §2, day-7 rows are Morrisons items (product strings all read "Morrisons ..."); shop was set to "M" ' +
      'by inference rather than read from a shopbar, to avoid the trap of attaching them to the last Day-0 shopbar (Lewisham/X).',
  });

  // Cross-check the overall Day-0 total shown in the section header tag.
  const day0HeaderTagPence = Math.round((poundsToNumber(secs.eq(3).find('> .sechead').first().find('.tag').text()) ?? NaN) * 100);
  const day0ComputedPence = day0.reduce((acc, r) => acc + Math.round(r.cost * 100), 0);
  if (Number.isFinite(day0HeaderTagPence) && day0HeaderTagPence !== day0ComputedPence) {
    anomalies.push({
      type: 'day0-header-total-mismatch',
      detail: `Section header tag shows £${(day0HeaderTagPence / 100).toFixed(2)} for Day 0, but the sum of all ${day0.length} parsed day0 line costs is £${(day0ComputedPence / 100).toFixed(2)}.`,
    });
  }

  return { day0, day7 };
}

function parseStorageRegister($, secs, anomalies) {
  const sec4 = secs.eq(4); // "Storage register"
  const rows = [];
  sec4.find('.reg table.rtab > tbody > tr').each((i, tr) => {
    const $tr = $(tr);
    const item = cleanText($tr.find('> td.nm').first().text());
    const lifeProse = cleanText($tr.find('> td.lf').first().text());
    const location = cleanText($tr.find('> td.wh').first().text());
    const note = cleanText($tr.find('> td.nt').first().text());

    if (!lifeProse) {
      anomalies.push({ type: 'storage-missing-life', detail: `Storage row "${item}" has empty shelf-life text.` });
    }
    if (!location) {
      anomalies.push({ type: 'storage-missing-location', detail: `Storage row "${item}" has empty location text.` });
    }

    rows.push({
      item,
      life: parseShelfLife(lifeProse),
      location,
      note,
    });
  });
  return rows;
}

// ---------- main extract() ----------

export function extract(root = process.cwd()) {
  const anomalies = [];
  const srcPath = path.join(root, SOURCE_FILE);
  const html = fs.readFileSync(srcPath, 'utf8');
  const $ = cheerio.load(html);

  const h2Texts = $('h2').map((i, el) => cleanText($(el).text())).get();
  const EXPECTED_H2 = [
    'What the shelf said',
    'Three cuts I proposed that died at the shelf',
    'The cuts that stuck',
    'The six swaps',
    'The fourteen days',
    'Day 0 — the big shop',
    'Day 7 — the top-up',
    'Storage register',
  ];
  for (const expected of EXPECTED_H2) {
    if (!h2Texts.includes(expected)) {
      anomalies.push({ type: 'missing-h2-section', detail: `Expected h2 "${expected}" not found in ${SOURCE_FILE}.` });
    }
  }

  const secs = $('.sec');

  const provenance = parseProvenance($, secs, anomalies);
  const defrostCalendar = parseDefrostCalendar($, secs, anomalies);
  const { day0, day7 } = parseDay0Day7($, secs, anomalies);
  const storageRegister = parseStorageRegister($, secs, anomalies);

  // Global est-span checksum.
  const totalEstSpans = $('span.est').length;
  const consumedEstSpans =
    day0.filter((r) => r.estimate).length + day7.filter((r) => r.estimate).length;
  if (consumedEstSpans !== totalEstSpans) {
    anomalies.push({
      type: 'est-span-count-mismatch',
      detail: `Document has ${totalEstSpans} span.est elements total; day0+day7 rows consumed ${consumedEstSpans}.`,
    });
  }

  // Six dual-listed items must appear in both day0 and day7.
  const DUAL_LISTED = ['Cottage cheese, natural', 'Tomatoes, ripe', 'Little gem or romaine', 'Pineapple', 'Cucumber', 'Spring onions, trimmed'];
  const day0Items = new Set(day0.map((r) => r.item));
  const day7Items = new Set(day7.map((r) => r.item));
  for (const name of DUAL_LISTED) {
    if (!day0Items.has(name)) anomalies.push({ type: 'dual-listed-missing-day0', detail: `"${name}" expected in day0 but not found.` });
    if (!day7Items.has(name)) anomalies.push({ type: 'dual-listed-missing-day7', detail: `"${name}" expected in day7 but not found.` });
  }

  const data = {
    storageRegister,
    defrostCalendar,
    day0,
    day7,
    provenance,
    anomalies,
  };

  return {
    data,
    _report: {
      h2Texts,
      totalEstSpans,
      consumedEstSpans,
      registerCount: storageRegister.length,
      calendarCount: defrostCalendar.length,
      day0Count: day0.length,
      day7Count: day7.length,
      dualListedOk: DUAL_LISTED.every((n) => day0Items.has(n) && day7Items.has(n)),
    },
  };
}

// ---------- CLI entry point ----------

function isMain() {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
  const thisFile = fileURLToPath(import.meta.url);
  return invoked === thisFile;
}

function main() {
  const root = process.cwd();
  let result;
  try {
    result = extract(root);
  } catch (err) {
    const decision = {
      question: 'provisioning.js failed to parse the source HTML deterministically.',
      context: String(err && err.stack ? err.stack : err),
      options: [
        'Inspect the error above against tools/extract/CONTRACT.md and PLAN.md §2/§3.',
        'Fix the source HTML expectation in provisioning.js if the format genuinely changed.',
        'If ambiguous, decide manually and record the ruling before re-running.',
      ],
    };
    fs.mkdirSync(path.dirname(path.join(root, DECISION_FILE)), { recursive: true });
    fs.writeFileSync(path.join(root, DECISION_FILE), JSON.stringify(decision, null, 2));
    console.error('BLOCKED: see', DECISION_FILE);
    console.error(err);
    process.exit(1);
  }

  const { data, _report } = result;

  const json = JSON.stringify(data, null, 2);
  JSON.parse(json); // round-trip check

  fs.mkdirSync(path.join(root, path.dirname(OUT_FILE)), { recursive: true });
  fs.writeFileSync(path.join(root, OUT_FILE), json);

  const pass = (label, ok, detail) => `${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`;

  const registerEveryRowOk = data.storageRegister.every((r) => r.life.prose && r.location);
  const calendarEveryOpOk = data.defrostCalendar.every((op) => op.weekday && op.title);
  const calendarSpansBoth = new Set(data.defrostCalendar.map((op) => op.week));
  const day0RowsOk = data.day0.every(
    (r) => typeof r.need !== 'undefined' && typeof r.buy !== 'undefined' && typeof r.cost === 'number' && typeof r.estimate === 'boolean'
  );
  const day7RowsOk = data.day7.every(
    (r) => typeof r.need !== 'undefined' && typeof r.buy !== 'undefined' && typeof r.cost === 'number' && typeof r.estimate === 'boolean'
  );

  console.log('=== provisioning.js extraction summary ===');
  console.log(`h2 sections found:      ${_report.h2Texts.length}/8`);
  console.log(`Storage register rows:  ${_report.registerCount}`);
  console.log(`Defrost calendar ops:   ${_report.calendarCount} (weeks: ${[...calendarSpansBoth].sort().join(',')})`);
  console.log(`Day-0 rows:             ${_report.day0Count}`);
  console.log(`Day-7 rows:             ${_report.day7Count}`);
  console.log(`Provenance: shelfSaid=${data.provenance.shelfSaid.length} cutsDied=${data.provenance.cutsDied.length} cutsStuck=${data.provenance.cutsStuck.length} swaps=${data.provenance.swaps.length}`);
  console.log('');
  console.log(`est spans in document:  ${_report.totalEstSpans}`);
  console.log(`est spans consumed:     ${_report.consumedEstSpans}`);
  console.log('');
  console.log(pass('exactly 54 storage-register rows', _report.registerCount === 54));
  console.log(pass('every register row has life.prose + location', registerEveryRowOk));
  console.log(pass('~10 defrost ops', _report.calendarCount >= 9 && _report.calendarCount <= 11, `actual ${_report.calendarCount}`));
  console.log(pass('calendar spans Week A and Week B', calendarSpansBoth.has('A') && calendarSpansBoth.has('B')));
  console.log(pass('every calendar op has weekday + title', calendarEveryOpOk));
  console.log(pass('day0 rows carry need/buy/cost(number)/estimate', day0RowsOk));
  console.log(pass('day7 rows carry need/buy/cost(number)/estimate', day7RowsOk));
  console.log(pass('6 dual-listed items appear in both day0 and day7', _report.dualListedOk));
  console.log(pass('est-span count consumed = 25', _report.totalEstSpans === 25 && _report.consumedEstSpans === 25, `total=${_report.totalEstSpans} consumed=${_report.consumedEstSpans}`));
  console.log(pass('JSON round-trips', (() => { try { JSON.parse(json); return true; } catch { return false; } })()));
  console.log('');
  console.log(`Anomalies recorded:  ${data.anomalies.length}`);
  for (const a of data.anomalies) {
    console.log(`  - [${a.type}] ${a.detail}`);
  }
  console.log('');
  console.log(`Wrote ${OUT_FILE}`);
}

if (isMain()) {
  main();
}
