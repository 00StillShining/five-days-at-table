// tools/extract/morrisons.js
//
// Parses the owner-authored Morrisons tester pair (archival, read-only):
//   FD5-Shopping-List-Morrisons.html — 39-line single-shop basket, COSTS
//     checksum, "moment you get home" put-away card, kept/cut summary card.
//   FD5-Menu-Morrisons.html — 10 kept meal cards over 4 day sections (Wed
//     off entirely), with cut cards carrying the owner's stated reasons.
//
// Per tools/extract/CONTRACT.md: cheerio only, archival source untouched,
// numbers are numbers, tags keyed on TEXT (never the t-* colour class, which
// is reused ambiguously across both files), anomalies recorded not silently
// fixed, STOP on real ambiguity via data/raw/decision-request.morrisons.json.
//
// Scope: this file only. Emits data/raw/morrisons.json when run directly.

import * as cheerio from "cheerio";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHOP_FILE = "FD5-Shopping-List-Morrisons.html";
const MENU_FILE = "FD5-Menu-Morrisons.html";
const OUT_FILE = path.join("data", "raw", "morrisons.json");
const DECISION_FILE = path.join("data", "raw", "decision-request.morrisons.json");

// ---------- helpers (mirrors shoppinglist.js's conventions) ----------

function cleanText(s) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** "£10.00" -> 1000 (integer pence). Returns null if it doesn't parse. */
function priceToPence(str) {
  const m = /^£\s*([\d,]+(?:\.\d+)?)$/.exec(cleanText(str));
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Math.round(n * 100);
}

/** "1 × 630 g" -> {qty:1, pack:630}. Returns {qty:null, pack:null} if it doesn't parse. */
function parseQtyPack(str) {
  const m = /^(\d+)\s*×\s*([\d,]+)\s*g$/.exec(cleanText(str));
  if (!m) return { qty: null, pack: null };
  return { qty: parseInt(m[1], 10), pack: parseInt(m[2].replace(/,/g, ""), 10) };
}

function penceToPoundStr(pence) {
  const sign = pence < 0 ? "-" : "";
  return `${sign}£${(Math.abs(pence) / 100).toFixed(2)}`;
}

// ---------- FD5-Shopping-List-Morrisons.html ----------

function parseShop(html, anomalies) {
  const $ = cheerio.load(html);

  // LCD header totals.
  const totBlocks = $(".tot > div");
  const header = { wholeOrder: null, mealsCovered: null, perMeal: null };
  totBlocks.each((i, el) => {
    const label = cleanText($(el).find("span").text());
    const value = cleanText($(el).find("b").text());
    if (/whole order/i.test(label)) header.wholeOrder = value;
    else if (/meals covered/i.test(label)) header.mealsCovered = value;
    else if (/per meal/i.test(label)) header.perMeal = value;
    else anomalies.push({ type: "unexpected-header-block", detail: `Unrecognized .tot block label "${label}".` });
  });
  const subLine = cleanText($(".lcd .sub").first().text());
  const hint = cleanText($(".lcd .hint").first().text());

  // Single shop panel.
  const shopEl = $(".shop").first();
  const code = cleanText(shopEl.find(".shophead .code").first().text());
  const heading = cleanText(shopEl.find(".shophead h2").first().text());
  const blurb = cleanText(shopEl.find(".shophead > span.note").first().text()) || null;
  const amtShown = cleanText(shopEl.find(".shophead .amt").first().text()) || null;

  if (code !== "M") {
    anomalies.push({ type: "unexpected-shop-code", detail: `Shop heading "${heading}" carries code "${code}", expected "M".` });
  }

  // Walk the shop panel's direct children in document order, tracking the
  // current aisle heading (.aisle) and attaching it to every .row until the
  // next .aisle marker.
  const rows = [];
  let currentAisle = null;
  let domIndex = 0;
  const children = shopEl.children().toArray();
  for (const child of children) {
    const $child = $(child);
    if ($child.hasClass("aisle")) {
      currentAisle = cleanText($child.text());
      continue;
    }
    if (!$child.hasClass("row")) continue;

    const $mid = $child.find(".mid").first();
    const name = cleanText($mid.find(".name").first().text());
    const prodEl = $mid.find(".prod").first();
    const productString = prodEl.length ? cleanText(prodEl.text()) : null;
    const noteEl = $mid.find("div.note").first();
    const note = noteEl.length ? cleanText(noteEl.text()) : null;

    const tagEls = $mid.find(".tag").toArray();
    const tags = tagEls.map((t) => cleanText($(t).text()));
    if (tagEls.length !== 1) {
      anomalies.push({
        type: "unexpected-tag-count",
        detail: `Row "${name}" (domIndex ${domIndex}) has ${tagEls.length} .tag elements, expected 1.`,
      });
    }

    const $right = $child.find(".right").first();
    const qtyRaw = cleanText($right.find(".qty").first().text());
    const { qty, pack } = parseQtyPack(qtyRaw);
    if (qty === null) {
      anomalies.push({ type: "unparseable-qty", detail: `Row "${name}" (domIndex ${domIndex}) has qty text "${qtyRaw}" that does not match "N × Xg".` });
    }
    const priceShown = cleanText($right.find(".cost").first().text()) || null;

    if (!name) anomalies.push({ type: "missing-name", detail: `Row at domIndex ${domIndex} has no name.` });
    if (!currentAisle) anomalies.push({ type: "missing-aisle", detail: `Row "${name}" (domIndex ${domIndex}) has no aisle heading above it.` });

    rows.push({ domIndex, name, productString, pack, qty, priceShown, tags, note, aisle: currentAisle });
    domIndex++;
  }

  if (rows.length !== 39) {
    anomalies.push({ type: "row-count-mismatch", detail: `Expected 39 rows in ${SHOP_FILE}, found ${rows.length}.` });
  }

  // Cards: "What's on the plate" (kept/cut by day) and "The moment you get home" (put-away).
  let keptCutCard = { entries: [] };
  let putAwayCard = { entries: [] };
  const cardEls = $(".card").toArray();
  for (const cardEl of cardEls) {
    const $card = $(cardEl);
    const h3 = cleanText($card.find("h3").first().text());
    const liEls = $card.find("li").toArray();
    const entries = liEls.map((li) => {
      const $li = $(li);
      return {
        title: cleanText($li.find("b").first().text()),
        detail: cleanText($li.find("i").first().text()),
        status: cleanText($li.find("span").first().text()),
      };
    });
    if (/what's on the plate/i.test(h3)) keptCutCard = { entries };
    else if (/moment you get home/i.test(h3)) putAwayCard = { entries };
    else anomalies.push({ type: "unexpected-card", detail: `Unrecognized .card heading "${h3}".` });
  }
  if (keptCutCard.entries.length === 0) anomalies.push({ type: "empty-keptcut-card", detail: "No rows found under 'What's on the plate'." });
  if (putAwayCard.entries.length === 0) anomalies.push({ type: "empty-putaway-card", detail: "No entries found under the put-away card." });

  // COSTS checksum (positionally aligned to .row DOM order).
  const costsMatch = /const\s+COSTS\s*=\s*\[([^\]]*)\]/.exec(html);
  let costs = [];
  if (!costsMatch) {
    anomalies.push({ type: "costs-not-found", detail: "Could not locate `const COSTS=[...]` in the source script." });
  } else {
    costs = costsMatch[1]
      .split(",")
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
      type: "costs-row-mismatch",
      detail: `${mismatchCount} index(es) where COSTS[i] does not equal the price parsed from row i.`,
      mismatches: mismatchDetails,
    });
  }

  // Summary row cross-check ("Morrisons — 39 lines £69.83").
  const sumShown = cleanText($(".sum .amt").first().text()) || null;
  const sumComputedPence = rows.reduce((acc, r) => acc + (priceToPence(r.priceShown) ?? 0), 0);
  if (priceToPence(sumShown) !== sumComputedPence) {
    anomalies.push({
      type: "summary-total-mismatch",
      detail: `Sum-row shows ${sumShown}, computed row total is ${penceToPoundStr(sumComputedPence)}.`,
    });
  }
  if (priceToPence(amtShown) !== sumComputedPence) {
    anomalies.push({
      type: "shophead-total-mismatch",
      detail: `Shophead .amt shows ${amtShown}, computed row total is ${penceToPoundStr(sumComputedPence)}.`,
    });
  }
  if (priceToPence(header.wholeOrder) !== sumComputedPence) {
    anomalies.push({
      type: "header-total-mismatch",
      detail: `LCD header 'Whole order' shows ${header.wholeOrder}, computed row total is ${penceToPoundStr(sumComputedPence)}.`,
    });
  }

  return {
    header: { subLine, hint, totals: header },
    shop: { code, heading, blurb, amtShown },
    rows,
    keptCutCard,
    putAwayCard,
    costsChecksum,
    _internal: { sumShown, sumComputedPence },
  };
}

// ---------- FD5-Menu-Morrisons.html ----------

function parseKcalPair(str) {
  // "1,420 / 1,786 kcal" -> {w:1420, m:1786}. "cut" -> {w:null, m:null}.
  const t = cleanText(str);
  if (/^cut$/i.test(t)) return { w: null, m: null, raw: t };
  const m = /^([\d,]+)\s*\/\s*([\d,]+)\s*kcal$/.exec(t);
  if (!m) return { w: null, m: null, raw: t };
  return { w: parseInt(m[1].replace(/,/g, ""), 10), m: parseInt(m[2].replace(/,/g, ""), 10), raw: t };
}

function parseMenu(html, anomalies) {
  const $ = cheerio.load(html);

  const totBlocks = $(".tot > div");
  const header = { mealsThisWeek: null, minutes: null, kcalTotal: null };
  totBlocks.each((i, el) => {
    const label = cleanText($(el).find("span").text());
    const value = cleanText($(el).find("b").text());
    if (/meals this week/i.test(label)) header.mealsThisWeek = value;
    else if (/minutes/i.test(label)) header.minutes = value;
    else if (/kcal total/i.test(label)) header.kcalTotal = value;
    else anomalies.push({ type: "unexpected-menu-header-block", detail: `Unrecognized .tot block label "${label}".` });
  });
  const subLine = cleanText($(".lcd .sub").first().text());
  const hint = cleanText($(".lcd .hint").first().text());

  const days = [];
  const dayEls = $(".day").toArray();
  for (const dayEl of dayEls) {
    const $day = $(dayEl);
    const code = cleanText($day.find(".dayhead .code").first().text());
    const weekday = cleanText($day.find(".dayhead h2").first().text());
    const amtShown = cleanText($day.find(".dayhead .amt").first().text());
    const kcal = parseKcalPair(amtShown);

    const meals = [];
    const mealEls = $day.find(".meal").toArray();
    for (const mealEl of mealEls) {
      const $meal = $(mealEl);
      const slot = cleanText($meal.find(".slot").first().text()).toLowerCase();
      const name = cleanText($meal.find(".mealname").first().text());
      const difficulty = cleanText($meal.find(".meta .tag").first().text());
      const metaItems = $meal.find(".meta .metaitem").toArray().map((el) => cleanText($(el).text()));
      const dotsOn = $meal.find(".dots .dot.on").length;
      const method = cleanText($meal.find(".method").first().text());

      const mcols = $meal.find(".macros .mcol").toArray();
      const macros = {};
      for (const col of mcols) {
        const $col = $(col);
        const who = cleanText($col.find(".who").first().text()).toLowerCase(); // "her" | "him"
        const kcalTxt = cleanText($col.find(".kcal").first().text());
        const kcalM = /^([\d,]+)\s*kcal$/.exec(kcalTxt);
        const restTxt = cleanText($col.find(".rest").first().text());
        const restM = /^([\d.]+)g pro\s*·\s*([\d.]+)g fat\s*·\s*([\d.]+)g carb$/.exec(restTxt);
        if (!kcalM || !restM) {
          anomalies.push({ type: "unparseable-menu-macro", detail: `Meal "${name}" (${who}) macro text "${kcalTxt} / ${restTxt}" did not parse.` });
          continue;
        }
        const key = who === "her" ? "w" : who === "him" ? "m" : who;
        macros[key] = {
          kcal: parseInt(kcalM[1].replace(/,/g, ""), 10),
          protein: parseFloat(restM[1]),
          fat: parseFloat(restM[2]),
          netCarb: parseFloat(restM[3]),
        };
      }

      meals.push({ slot, name, difficulty, metaItems, spiceDots: dotsOn, method, macros });
    }

    // Cut-card prose, if this day section carries one (Wed's whole-day cut,
    // or Thu/Fri's single-slot cut appended after the kept .meal blocks).
    const cutEls = $day.find(".cutcard").toArray();
    const cutCards = cutEls.map((el) => cleanText($(el).text()));

    days.push({ code, weekday, kcalShown: amtShown, kcal, meals, cutCards });
  }

  if (days.length !== 5) {
    anomalies.push({ type: "day-count-mismatch", detail: `Expected 5 day sections in ${MENU_FILE}, found ${days.length}.` });
  }
  const totalMeals = days.reduce((acc, d) => acc + d.meals.length, 0);
  if (totalMeals !== 10) {
    anomalies.push({ type: "meal-count-mismatch", detail: `Expected 10 kept meal cards across ${MENU_FILE}, found ${totalMeals}.` });
  }

  // Closing "Reading the numbers" card.
  let readingNumbers = null;
  const cardEls = $(".card").toArray();
  for (const cardEl of cardEls) {
    const $card = $(cardEl);
    const h3 = cleanText($card.find("h3").first().text());
    if (/reading the numbers/i.test(h3)) readingNumbers = cleanText($card.find("p").first().text());
    else anomalies.push({ type: "unexpected-menu-card", detail: `Unrecognized .card heading "${h3}".` });
  }

  return {
    header: { subLine, hint, totals: header },
    days,
    readingNumbers,
  };
}

// ---------- main extract() ----------

export function extract(root = process.cwd()) {
  const anomalies = [];

  const shopPath = path.join(root, SHOP_FILE);
  const menuPath = path.join(root, MENU_FILE);
  const shopHtml = fs.readFileSync(shopPath, "utf8");
  const menuHtml = fs.readFileSync(menuPath, "utf8");

  const shop = parseShop(shopHtml, anomalies);
  const menu = parseMenu(menuHtml, anomalies);

  const data = {
    shop: shop.shop,
    header: shop.header,
    rows: shop.rows,
    keptCutCard: shop.keptCutCard,
    putAwayCard: shop.putAwayCard,
    costsChecksum: shop.costsChecksum,
    menu,
    anomalies,
  };

  return {
    data,
    _report: {
      rowCount: shop.rows.length,
      shopInternal: shop._internal,
      dayCount: menu.days.length,
      mealCount: menu.days.reduce((acc, d) => acc + d.meals.length, 0),
    },
  };
}

// ---------- CLI entry point ----------

function isMain() {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
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
      question: "morrisons.js failed to parse the source HTML deterministically.",
      context: String(err && err.stack ? err.stack : err),
      options: [
        "Inspect the error above against tools/extract/CONTRACT.md.",
        "Fix the source HTML expectation in morrisons.js if the format genuinely changed.",
        "If ambiguous, decide manually and record the ruling before re-running.",
      ],
    };
    fs.mkdirSync(path.dirname(path.join(root, DECISION_FILE)), { recursive: true });
    fs.writeFileSync(path.join(root, DECISION_FILE), JSON.stringify(decision, null, 2));
    console.error("BLOCKED: see", DECISION_FILE);
    console.error(err);
    process.exit(1);
  }

  const { data, _report } = result;

  const json = JSON.stringify(data, null, 2);
  JSON.parse(json);

  fs.mkdirSync(path.join(root, path.dirname(OUT_FILE)), { recursive: true });
  fs.writeFileSync(path.join(root, OUT_FILE), json);

  const pass = (label, ok, detail) => `${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`;

  console.log("=== morrisons.js extraction summary ===");
  console.log(`Basket rows:         ${_report.rowCount}`);
  console.log(`Menu days:           ${_report.dayCount}`);
  console.log(`Menu kept meals:     ${_report.mealCount}`);
  console.log(`COSTS length:        ${data.costsChecksum.length}`);
  console.log(`COSTS sum:           £${data.costsChecksum.sum.toFixed(2)}`);
  console.log("");
  console.log(pass("exactly 39 basket rows", _report.rowCount === 39));
  console.log(pass("COSTS length 39", data.costsChecksum.length === 39));
  console.log(pass("COSTS sum = £69.83", Math.round(data.costsChecksum.sum * 100) === 6983));
  console.log(pass("COSTS matches row order (0 mismatches)", data.costsChecksum.matchesRowOrder, `${data.costsChecksum.mismatchCount} mismatches`));
  console.log(pass("exactly 5 menu day sections", _report.dayCount === 5));
  console.log(pass("exactly 10 kept meal cards", _report.mealCount === 10));
  console.log(pass("JSON round-trips", (() => { try { JSON.parse(json); return true; } catch { return false; } })()));
  console.log("");
  console.log(`Anomalies recorded:  ${data.anomalies.length}`);
  for (const a of data.anomalies) console.log(`  - [${a.type}] ${a.detail}`);
  console.log("");
  console.log(`Wrote ${OUT_FILE}`);
}

if (isMain()) {
  main();
}
