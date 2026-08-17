// tools/extract/shoppinglist.js
// Parses FD5-Shopping-List.html (primary, canonical basket) and shopping-list.html
// (legacy, cross-check only) per tools/extract/CONTRACT.md and PLAN.md §2/§3.
//
// Scope: this file only. Emits data/raw/shoppinglist.json when run directly.

import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRIMARY_FILE = 'FD5-Shopping-List.html';
const LEGACY_FILE = 'shopping-list.html';
const OUT_FILE = path.join('data', 'raw', 'shoppinglist.json');
const DECISION_FILE = path.join('data', 'raw', 'decision-request.shoppinglist.json');

// ---------- helpers ----------

/** Collapse whitespace, keep prose verbatim (entities already decoded by cheerio). */
function cleanText(s) {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

/** "£10.00" -> 1000 (integer pence). Returns null if it doesn't parse. */
function priceToPence(str) {
  const m = /^£\s*([\d,]+(?:\.\d+)?)$/.exec(cleanText(str));
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return Math.round(n * 100);
}

/** "2 × 1,000 g" -> {qty:2, pack:1000}. Returns {qty:null, pack:null} if it doesn't parse. */
function parseQtyPack(str) {
  const m = /^(\d+)\s*×\s*([\d,]+)\s*g$/.exec(cleanText(str));
  if (!m) return { qty: null, pack: null };
  return { qty: parseInt(m[1], 10), pack: parseInt(m[2].replace(/,/g, ''), 10) };
}

/** "4 × 400 g £1.88" (nbsp-separated) -> {qty, pack, priceShown}. */
function parseDay7Line(str) {
  const t = cleanText(str);
  const m = /^(\d+)\s*×\s*([\d,]+)\s*g\s*(£[\d.,]+)$/.exec(t);
  if (!m) return { qty: null, pack: null, priceShown: null, raw: t };
  return {
    qty: parseInt(m[1], 10),
    pack: parseInt(m[2].replace(/,/g, ''), 10),
    priceShown: m[3],
  };
}

function penceToPoundStr(pence) {
  const sign = pence < 0 ? '-' : '';
  return `${sign}£${(Math.abs(pence) / 100).toFixed(2)}`;
}

// ---------- primary file: FD5-Shopping-List.html ----------

function parsePrimary(html, anomalies) {
  const $ = cheerio.load(html);

  // Sanity: overall totals shown in the LCD header.
  const totBlocks = $('.tot > div');
  let headerTotalShown = null;
  let headerDay7Shown = null;
  totBlocks.each((i, el) => {
    const label = cleanText($(el).find('span').text());
    const value = cleanText($(el).find('b').text());
    if (/day 0/i.test(label)) headerTotalShown = value;
    if (/day 7/i.test(label)) headerDay7Shown = value;
  });

  // --- shops ---
  const shopEls = $('.shop').toArray();
  const shops = [];
  const rows = [];
  let domIndex = 0;

  for (const shopEl of shopEls) {
    const $shop = $(shopEl);
    const code = cleanText($shop.find('.shophead .code').first().text());
    const heading = cleanText($shop.find('.shophead h2').first().text());
    const blurbEl = $shop.find('.shophead > span.note');
    const blurb = blurbEl.length ? cleanText(blurbEl.text()) : null;
    const subtotalShown = cleanText($shop.find('.shophead .amt').first().text()) || null;

    if (!['S', 'M', 'X'].includes(code)) {
      anomalies.push({
        type: 'unexpected-shop-code',
        detail: `Shop heading "${heading}" carries code "${code}", not one of S/M/X.`,
      });
    }

    shops.push({ code, heading, blurb, subtotalShown });

    // Rows belonging to this shop, in document order.
    const rowEls = $shop.find('.row').toArray();
    for (const rowEl of rowEls) {
      const $row = $(rowEl);
      const $mid = $row.find('.mid').first();

      const name = cleanText($mid.find('.name').first().text());

      const prodEl = $mid.find('.prod').first();
      const productString = prodEl.length ? cleanText(prodEl.text()) : null;

      // note (div.note) vs shop blurb (span.note) — select by tag, not class alone.
      const noteEl = $mid.find('div.note').first();
      const note = noteEl.length ? cleanText(noteEl.text()) : null;

      // tags: keyed on TEXT only, never the t-* color class (t-bl carries two meanings).
      const tagEls = $mid.find('.tag').toArray();
      const tags = tagEls.map((t) => cleanText($(t).text()));
      if (tagEls.length !== 1) {
        anomalies.push({
          type: 'unexpected-tag-count',
          detail: `Row "${name}" (domIndex ${domIndex}) has ${tagEls.length} .tag elements, expected 1.`,
        });
      }

      const $right = $row.find('.right').first();
      const qtyRaw = cleanText($right.find('.qty').first().text());
      const { qty, pack } = parseQtyPack(qtyRaw);
      if (qty === null) {
        anomalies.push({
          type: 'unparseable-qty',
          detail: `Row "${name}" (domIndex ${domIndex}) has qty text "${qtyRaw}" that does not match "N × Xg".`,
        });
      }

      const priceShown = cleanText($right.find('.cost').first().text()) || null;

      // No visual estimate-marker convention exists in this file (checked: no
      // ".est" class, no literal "est" token, no asterisk marker on any row —
      // matches PLAN.md §2's statement that this file carries zero estimate
      // flags and must be back-joined from D.prices.ver / Provisioning). All
      // rows recorded as estimateMark:false.
      const estimateMark = false;

      if (!name) {
        anomalies.push({ type: 'missing-name', detail: `Row at domIndex ${domIndex} has no name.` });
      }
      if (!code) {
        anomalies.push({ type: 'missing-shop', detail: `Row "${name}" at domIndex ${domIndex} has no shop code.` });
      }

      rows.push({
        domIndex,
        shop: code,
        name,
        productString,
        pack,
        qty,
        priceShown,
        tags,
        note,
        estimateMark,
      });
      domIndex++;
    }
  }

  // 49, not 55: per the 2026-08-11 owner-ruled canonical revision (6 lines
  // dropped — Cottage cheese, Apples, Bananas, Chia seeds, Pumpkin seeds,
  // Desiccated coconut — none needed at the till that pass). See
  // data/decisions-queue.json's "canonical-revision-2026-08-11-adopted"
  // entry for the full old-vs-new numbers.
  if (rows.length !== 49) {
    anomalies.push({
      type: 'row-count-mismatch',
      detail: `Expected 49 rows in ${PRIMARY_FILE} (2026-08-11 revision), found ${rows.length}.`,
    });
  }

  // --- day 7 top-up card ---
  const cardEls = $('.card').toArray();
  let day7Card = { rows: [], totalShown: null };
  let putAwayCard = { entries: [] };

  for (const cardEl of cardEls) {
    const $card = $(cardEl);
    const h3 = cleanText($card.find('h3').first().text());

    if (/day 7/i.test(h3)) {
      const sText = cleanText($card.find('.s').first().text());
      const totalMatch = /£[\d.,]+/.exec(sText);
      day7Card.totalShown = totalMatch ? totalMatch[0] : null;

      const liEls = $card.find('li').toArray();
      for (const li of liEls) {
        const $li = $(li);
        const itemName = cleanText($li.find('b').first().text());
        const shelfLife = cleanText($li.find('i').first().text());
        const spanText = $li.find('span').first().text();
        const { qty, pack, priceShown } = parseDay7Line(spanText);
        if (qty === null) {
          anomalies.push({
            type: 'unparseable-day7-line',
            detail: `Day-7 item "${itemName}" has span text "${cleanText(spanText)}" that does not match "N × Xg £P.PP".`,
          });
        }
        day7Card.rows.push({ name: itemName, shelfLife, qty, pack, priceShown });
      }
    } else if (/moment you get home/i.test(h3)) {
      const liEls = $card.find('li').toArray();
      for (const li of liEls) {
        const $li = $(li);
        putAwayCard.entries.push({
          title: cleanText($li.find('b').first().text()),
          detail: cleanText($li.find('i').first().text()),
          location: cleanText($li.find('span').first().text()),
        });
      }
    } else {
      anomalies.push({ type: 'unexpected-card', detail: `Unrecognized .card heading "${h3}".` });
    }
  }

  if (day7Card.rows.length === 0) {
    anomalies.push({ type: 'empty-day7-card', detail: 'No rows found under the Day 7 top-up card.' });
  }
  if (putAwayCard.entries.length === 0) {
    anomalies.push({ type: 'empty-putaway-card', detail: 'No entries found under the put-away card.' });
  }

  // --- COSTS checksum (line 108, positionally aligned to .row DOM order) ---
  const costsMatch = /const\s+COSTS\s*=\s*\[([^\]]*)\]/.exec(html);
  let costs = [];
  if (!costsMatch) {
    anomalies.push({ type: 'costs-not-found', detail: 'Could not locate `const COSTS=[...]` in the source script.' });
  } else {
    costs = costsMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(Number);
  }

  const costsSumPence = costs.reduce((acc, n) => acc + Math.round(n * 100), 0);

  let mismatchCount = 0;
  const mismatchDetails = [];
  const n = Math.max(costs.length, rows.length);
  for (let i = 0; i < n; i++) {
    const costPence = i < costs.length ? Math.round(costs[i] * 100) : null;
    const rowPence = i < rows.length ? priceToPence(rows[i].priceShown) : null;
    if (costPence !== rowPence) {
      mismatchCount++;
      mismatchDetails.push({ index: i, costsPence: costPence, rowPricePence: rowPence });
    }
  }

  const costsChecksum = {
    length: costs.length,
    sum: Math.round(costsSumPence) / 100,
    matchesRowOrder: mismatchCount === 0,
    mismatchCount,
  };
  if (mismatchCount > 0) {
    anomalies.push({
      type: 'costs-row-mismatch',
      detail: `${mismatchCount} index(es) where COSTS[i] does not equal the price parsed from row i.`,
      mismatches: mismatchDetails,
    });
  }

  // --- per-shop subtotal cross-check (parsed row prices vs. shophead .amt) ---
  const bySubShop = { S: 0, M: 0, X: 0 };
  for (const r of rows) {
    const p = priceToPence(r.priceShown);
    if (p !== null && bySubShop[r.shop] !== undefined) bySubShop[r.shop] += p;
  }
  for (const s of shops) {
    const computed = bySubShop[s.code];
    const shownPence = priceToPence(s.subtotalShown);
    if (computed !== shownPence) {
      anomalies.push({
        type: 'shop-subtotal-mismatch',
        detail: `Shop ${s.code}: sum of row prices = ${penceToPoundStr(computed)}, shophead shows ${s.subtotalShown}.`,
      });
    }
  }

  return {
    shops,
    rows,
    day7Card,
    putAwayCard,
    costsChecksum,
    _internal: {
      headerTotalShown,
      headerDay7Shown,
      shopSubtotalsComputedPence: bySubShop,
    },
  };
}

// ---------- legacy file: shopping-list.html (cross-check only) ----------

function parseLegacy(html, anomalies) {
  const $ = cheerio.load(html);

  const HEADING_TO_CODE = {
    "Sainsbury's": 'S',
    Morrisons: 'M',
    'Lewisham market / Caribbean grocer': 'X',
  };

  const rows = [];
  const panelEls = $('.p').toArray();
  const shops = [];

  for (const panelEl of panelEls) {
    const $panel = $(panelEl);
    const heading = cleanText($panel.find('.ph h2').first().text());
    const totalShown = cleanText($panel.find('.ph .t').first().text()) || null;
    const code = HEADING_TO_CODE[heading];
    shops.push({ code: code ?? null, heading, totalShown });

    if (!code) {
      anomalies.push({
        type: 'legacy-unrecognized-shop-heading',
        detail: `Legacy panel heading "${heading}" did not map to a known shop code.`,
      });
    }

    const rowEls = $panel.find('.r').toArray();
    for (const rowEl of rowEls) {
      const $row = $(rowEl);
      const name = cleanText($row.find('.n b').first().text());
      const smallEl = $row.find('.n small').first();
      const estimateMark = smallEl.find('u').length > 0;
      const priceShown = cleanText($row.find('.c').first().text()) || null;

      if (!name) {
        anomalies.push({ type: 'legacy-missing-name', detail: 'A legacy row has no name.' });
      }

      rows.push({ name, priceShown, estimateMark, shop: code ?? null });
    }
  }

  // Overall total (first shop / £257.32 header value).
  const tbFirst = cleanText($('.tb div').first().find('b').text()) || null;

  if (rows.length !== 54) {
    anomalies.push({
      type: 'legacy-row-count',
      detail: `Expected ~54 rows in ${LEGACY_FILE} (per PLAN.md §2), found ${rows.length}.`,
    });
  }

  const sumPence = rows.reduce((acc, r) => {
    const p = priceToPence(r.priceShown);
    return acc + (p ?? 0);
  }, 0);

  if (tbFirst && priceToPence(tbFirst) !== sumPence) {
    anomalies.push({
      type: 'legacy-total-mismatch',
      detail: `Header total ${tbFirst} vs. sum of row prices ${penceToPoundStr(sumPence)}.`,
    });
  }

  return {
    rows,
    totalShown: tbFirst,
    _internal: { shops, sumPence },
  };
}

// ---------- main extract() ----------

export function extract(root = process.cwd()) {
  const anomalies = [];

  const primaryPath = path.join(root, PRIMARY_FILE);
  const legacyPath = path.join(root, LEGACY_FILE);

  const primaryHtml = fs.readFileSync(primaryPath, 'utf8');
  const legacyHtml = fs.readFileSync(legacyPath, 'utf8');

  const primary = parsePrimary(primaryHtml, anomalies);
  const legacy = parseLegacy(legacyHtml, anomalies);

  const data = {
    shops: primary.shops,
    rows: primary.rows,
    day7Card: primary.day7Card,
    putAwayCard: primary.putAwayCard,
    costsChecksum: primary.costsChecksum,
    legacy: { rows: legacy.rows, totalShown: legacy.totalShown },
    anomalies,
  };

  return {
    data,
    // extra info surfaced only to the CLI summary, not written to JSON output.
    _report: {
      primaryInternal: primary._internal,
      legacyInternal: legacy._internal,
      rowCount: primary.rows.length,
      day7RowCount: primary.day7Card.rows.length,
      legacyRowCount: legacy.rows.length,
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
    // Real ambiguity / hard failure — do not guess.
    const decision = {
      question: 'shoppinglist.js failed to parse the source HTML deterministically.',
      context: String(err && err.stack ? err.stack : err),
      options: [
        'Inspect the error above against tools/extract/CONTRACT.md and PLAN.md §2.',
        'Fix the source HTML expectation in shoppinglist.js if the format genuinely changed.',
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

  // Round-trip check.
  const json = JSON.stringify(data, null, 2);
  JSON.parse(json);

  fs.mkdirSync(path.join(root, path.dirname(OUT_FILE)), { recursive: true });
  fs.writeFileSync(path.join(root, OUT_FILE), json);

  // ---- acceptance-criteria summary ----
  const S = _report.primaryInternal.shopSubtotalsComputedPence;
  const fmt = (p) => `£${(p / 100).toFixed(2)}`;

  const pass = (label, ok, detail) => `${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`;

  console.log('=== shoppinglist.js extraction summary ===');
  console.log(`Rows (primary):      ${_report.rowCount}`);
  console.log(`Day-7 rows:          ${_report.day7RowCount}`);
  console.log(`Legacy rows:         ${_report.legacyRowCount}`);
  console.log('');
  console.log(`COSTS length:        ${data.costsChecksum.length}`);
  console.log(`COSTS sum:           £${data.costsChecksum.sum.toFixed(2)}`);
  console.log(`Per-shop subtotals (computed from row prices): S ${fmt(S.S)} / M ${fmt(S.M)} / X ${fmt(S.X)}`);
  console.log(`Day-7 total shown:   ${data.day7Card.totalShown}`);
  console.log(`Legacy total shown:  ${data.legacy.totalShown}`);
  console.log('');
  // 2026-08-11 owner-ruled canonical revision: 49 rows / £172.57 / S£82.51 /
  // M£81.76 / X£8.30 / day-7 £6.93 (was 55 / £179.31 / £72.70 / £98.31 /
  // £8.30 / £8.58). See data/decisions-queue.json's
  // "canonical-revision-2026-08-11-adopted" entry.
  console.log(pass('exactly 49 rows', _report.rowCount === 49));
  console.log(pass('COSTS length 49', data.costsChecksum.length === 49));
  console.log(pass('COSTS sum = £172.57', Math.round(data.costsChecksum.sum * 100) === 17257));
  console.log(pass('COSTS matches row order (0 mismatches)', data.costsChecksum.matchesRowOrder, `${data.costsChecksum.mismatchCount} mismatches`));
  console.log(pass('shop S subtotal = £82.51', S.S === 8251));
  console.log(pass('shop M subtotal = £81.76', S.M === 8176));
  console.log(pass('shop X subtotal = £8.30', S.X === 830));
  console.log(pass('day-7 total = £6.93', priceToPence(data.day7Card.totalShown) === 693));
  console.log(pass('every row has shop+name', data.rows.every((r) => r.shop && r.name)));
  console.log(pass('legacy rows ~54', _report.legacyRowCount === 54, `actual ${_report.legacyRowCount}`));
  console.log(pass('legacy total = £257.32', priceToPence(data.legacy.totalShown) === 25732));
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
