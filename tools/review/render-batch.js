#!/usr/bin/env node
// tools/review/render-batch.js
//
// node tools/review/render-batch.js <a1|a2|b1|b2>
//
// Renders docs/review/batch-<id>.html — a plain, utilitarian old-vs-new
// review page for the owner's Phase 1 checkpoint (REWRITE-SPEC.md §Owner
// approval batches, PLAN.md §4 "Review checkpoint"). Per meal: original
// steps/why/gram table (from data/raw/methods.json) beside the rewrite (if
// one exists and validates), covers diffs highlighted, old and new
// recomputed macro lines, batch metadata (batchTakeG), a per-meal lint
// status line. Meals with no rewrite yet render with an explicit "not yet
// rewritten" marker rather than breaking. Batches that include a Sunday
// session (a1 -> prep-a, b1 -> prep-b) also render that session's ops/
// yields old-vs-new.
//
// Reads ONLY: data/raw/*.json, data/rewrites/*, data/ingredients.json,
// tools/extract/approvals.json. Writes ONLY docs/review/batch-<id>.html.
// Never touches data/rewrites/ or data/*.json — this is a read-only report.
//
// Plain HTML, inline CSS, no external assets, no Sol styling — REWRITE-SPEC
// is explicit that this is a review artifact, not product UI.

import fs from "node:fs";
import path from "node:path";
import {
  loadMealRewrite,
  loadPrepRewrite,
  loadContentPassIngredients,
  mergeContentPassIngredients,
} from "../extract/rewrite-overlay.js";
import { findRawCard, phase0CoversForCard, lintL1, lintL2, lintL3, lintL4, lintL5, lintL6, lintL7, lintL8 } from "../extract/lint-rules.js";

const ROOT = process.cwd();
const RAW = path.join(ROOT, "data", "raw");
const REWRITES_DIR = path.join(ROOT, "data", "rewrites");
const DOCS_REVIEW = path.join(ROOT, "docs", "review");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const BATCH_ID = process.argv[2];
const KNOWN_BATCHES = ["a1", "a2", "b1", "b2"];
if (!BATCH_ID || !KNOWN_BATCHES.includes(BATCH_ID)) {
  console.error(`Usage: node tools/review/render-batch.js <${KNOWN_BATCHES.join("|")}>`);
  process.exit(1);
}

const approvalsPath = path.join(ROOT, "tools", "extract", "approvals.json");
if (!fs.existsSync(approvalsPath)) {
  console.error(`Missing ${approvalsPath} — run the mechanism builder's setup first.`);
  process.exit(1);
}
const approvalsRaw = readJSON(approvalsPath);
const batch = approvalsRaw[BATCH_ID];
if (!batch) {
  console.error(`No batch "${BATCH_ID}" in tools/extract/approvals.json.`);
  process.exit(1);
}

const fd5Raw = readJSON(path.join(RAW, "fd5.json"));
const methodsRaw = readJSON(path.join(RAW, "methods.json"));
const baseIngredients = readJSON(path.join(ROOT, "data", "ingredients.json"));

// Merge content-pass ingredients fresh from data/rewrites/ (not from
// data/ingredients.json, which may be stale or may already have run
// through join.js — this script is self-contained the same way
// lint.test.js is) so names/macros/lint work correctly even before the
// next `npm run extract`.
const phase0IngredientIds = new Set(baseIngredients.filter((i) => !i.addedInContentPass).map((i) => i.id));
const { entries: cpEntries, invalid: cpInvalid } = loadContentPassIngredients(REWRITES_DIR);
const { merged: cpMerged, conflicts: cpConflicts } = mergeContentPassIngredients(cpEntries, phase0IngredientIds);
if (cpConflicts.length) {
  console.error(`Conflicting _ingredients.A.json/_ingredients.B.json definitions: ${cpConflicts.map((c) => c.id).join(", ")} — fix before rendering.`);
  process.exit(1);
}
for (const inv of cpInvalid) console.warn(`WARNING: skipping invalid ${inv.file}: ${inv.message}`);

const ingredients = [...baseIngredients.filter((i) => !i.addedInContentPass), ...cpMerged];
const ingredientsById = new Map(ingredients.map((i) => [i.id, i]));
const contentPassIds = new Set(cpMerged.map((r) => r.id));

function ingName(id) {
  return ingredientsById.get(id)?.name?.display ?? `${id} (unknown id)`;
}

function recomputeMacros(coverGrams) {
  let kcal = 0,
    protein = 0,
    fibre = 0,
    carb = 0,
    fat = 0;
  for (const [id, g] of Object.entries(coverGrams)) {
    const ing = ingredientsById.get(id);
    if (!ing) continue; // rendered elsewhere as an "unknown id" warning
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
    fibre: Math.round(fibre * 10) / 10,
  };
}

function macroLine(m) {
  return `kcal ${m.kcal} &middot; protein ${m.protein} g &middot; net carb ${m.netCarb} g &middot; fat ${m.fat} g &middot; fibre ${m.fibre} g`;
}

// Pre-load both prep sessions (real rewrite if present+valid, else Phase 0
// reconstruction) once — needed for every batch meal's L5 check, and for
// rendering the session section of a1/b1.
function phase0PrepSession(week) {
  const s = methodsRaw.weeks[week].sunday;
  return {
    week,
    sessionName: s.theme,
    ops: s.ops.map((o) => ({ clock: o.clock, title: o.title, body: o.body, station: o.kit })),
    yields: s.yields.map((y) => ({ component: y.component, qty: y.qty, consumers: null, storage: y.storage })),
    midweek: s.midweek,
  };
}

const prepSessionsByWeek = {};
const prepRewriteStatusByWeek = {};
for (const week of ["A", "B"]) {
  const loaded = loadPrepRewrite(REWRITES_DIR, week);
  prepRewriteStatusByWeek[week] = loaded;
  prepSessionsByWeek[week] = loaded.status === "ok" ? { ...loaded.data, rev: "B" } : { ...phase0PrepSession(week), rev: "A" };
}

// ---------------------------------------------------------------------------
// Per-meal rendering
// ---------------------------------------------------------------------------

function runLints(rewrite, week, originalCard) {
  const phase0Covers = phase0CoversForCard(fd5Raw, originalCard);
  return [
    ...lintL1(rewrite),
    ...lintL2(rewrite),
    ...lintL3(rewrite),
    ...lintL4(rewrite, phase0Covers),
    ...lintL5(rewrite, week, prepSessionsByWeek),
    ...lintL6(rewrite, originalCard),
    ...lintL7(rewrite, phase0Covers, contentPassIds),
    ...lintL8(rewrite, originalCard),
  ];
}

function lintStatusLine(violations) {
  if (violations.length === 0) return `<span class="lint-pass">LINT: PASS (0 findings)</span>`;
  const byRule = {};
  for (const v of violations) byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;
  const summary = Object.entries(byRule)
    .map(([r, n]) => `${r}&times;${n}`)
    .join(", ");
  return `<span class="lint-fail">LINT: ${violations.length} finding(s) — ${esc(summary)}</span>`;
}

function oldGramTable(card) {
  const rows = card.ingredients
    .map(
      (ing) =>
        `<tr><td>${esc(ing.name)}</td><td class="num">${ing.herG}</td><td class="num">${ing.himG}</td><td>${esc(ing.weightState)}</td></tr>`
    )
    .join("\n");
  return `<table class="gram-table"><thead><tr><th>ingredient</th><th>her g</th><th>him g</th><th>state</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function newGramTable(rewrite, phase0Covers) {
  const ids = new Set([...Object.keys(rewrite.covers.w), ...Object.keys(rewrite.covers.m)]);
  const rows = [...ids]
    .sort()
    .map((id) => {
      const herG = rewrite.covers.w[id];
      const himG = rewrite.covers.m[id];
      const oldHer = phase0Covers.w[id] ?? 0;
      const oldHim = phase0Covers.m[id] ?? 0;
      const changed = herG !== oldHer || himG !== oldHim;
      const isNew = oldHer === 0 && oldHim === 0;
      const flag = isNew ? ` <span class="tag-new">new</span>` : changed ? ` <span class="tag-changed">&Delta;</span>` : "";
      const cls = changed ? ' class="row-changed"' : "";
      return `<tr${cls}><td>${esc(ingName(id))}${flag}</td><td class="num">${herG ?? "&mdash;"}</td><td class="num">${himG ?? "&mdash;"}</td></tr>`;
    })
    .join("\n");
  // Rows Phase 0 had that the rewrite dropped entirely.
  const dropped = Object.keys(phase0Covers.w)
    .filter((id) => !ids.has(id))
    .map((id) => `<tr class="row-dropped"><td>${esc(ingName(id))} <span class="tag-dropped">dropped</span></td><td class="num">&mdash;</td><td class="num">&mdash;</td></tr>`)
    .join("\n");
  return `<table class="gram-table"><thead><tr><th>ingredient</th><th>her g</th><th>him g</th></tr></thead><tbody>${rows}${dropped}</tbody></table>`;
}

function stepsListOld(card) {
  return `<ol class="steps">${card.steps.map((s) => `<li>${esc(s)}</li>`).join("\n")}</ol>`;
}

function stepsListNew(rewrite) {
  return `<ol class="steps">${rewrite.steps
    .map((s) => {
      const bits = [];
      if (s.minutes !== null) bits.push(`${s.minutes} min`);
      if (s.tempC !== null) bits.push(`${s.tempC}&deg;C`);
      if (s.untimed) bits.push("untimed");
      if (s.track) bits.push(`track:${esc(s.track)}`);
      if (s.clockStart !== null) bits.push(`clock:${s.clockStart}`);
      if (s.station) bits.push(`@ ${esc(s.station)}`);
      const meta = bits.length ? ` <span class="step-meta">[${bits.join(" &middot; ")}]</span>` : "";
      return `<li>${esc(s.text)}${meta}</li>`;
    })
    .join("\n")}</ol>`;
}

function renderMeal(mealId) {
  const originalCard = findRawCard(methodsRaw, mealId);
  if (!originalCard) {
    return `<section class="meal"><h2>${esc(mealId)}</h2><p class="error">No data/raw/methods.json card found for this meal id.</p></section>`;
  }
  const phase0Covers = phase0CoversForCard(fd5Raw, originalCard);
  const oldMacros = { her: recomputeMacros(phase0Covers.w), him: recomputeMacros(phase0Covers.m) };

  const loaded = loadMealRewrite(REWRITES_DIR, mealId);
  const week = mealId.startsWith("a-") ? "A" : "B";

  const header = `<h2>${esc(originalCard.name)} <span class="meal-id">${esc(mealId)}</span> <span class="tag-${originalCard.tag}">${originalCard.tag}</span></h2>
    <p class="meta">${esc(originalCard.dayName)} ${esc(originalCard.slot)} &middot; ${esc(originalCard.timeChip)} &middot; origin: ${esc(originalCard.originChip)}</p>`;

  let statusBanner = "";
  let newColumn = "";

  if (loaded.status === "missing") {
    statusBanner = `<p class="status status-missing">NOT YET REWRITTEN</p>`;
    newColumn = `<div class="col"><h3>new</h3><p class="placeholder">— no data/rewrites/${esc(mealId)}.json yet —</p></div>`;
  } else if (loaded.status === "invalid") {
    statusBanner = `<p class="status status-invalid">REWRITE FILE INVALID — original prose shown, kept as rev A</p><p class="error">${esc(loaded.message)}</p>`;
    newColumn = `<div class="col"><h3>new</h3><p class="placeholder">— rewrite file present but failed validation, see above —</p></div>`;
  } else {
    const rewrite = loaded.data;
    const violations = runLints(rewrite, week, originalCard);
    const newMacros = { her: recomputeMacros(rewrite.covers.w), him: recomputeMacros(rewrite.covers.m) };
    const batchLine =
      rewrite.batchSource || rewrite.batchTakeG
        ? `<p class="batch-meta">batch: source <code>${esc(rewrite.batchSource)}</code>, take her ${rewrite.batchTakeG?.w} g / him ${rewrite.batchTakeG?.m} g (total ${rewrite.batchTakeG?.total} g)</p>`
        : "";
    const freebiesLine = rewrite.freebies?.length ? `<p class="freebies">freebies: ${rewrite.freebies.map((id) => esc(ingName(id))).join(", ")}</p>` : "";
    const notesLine = rewrite.notes?.length ? `<details class="notes"><summary>rewriter notes (${rewrite.notes.length})</summary><ul>${rewrite.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></details>` : "";
    statusBanner = `<p class="status status-ok">rev B &middot; ${lintStatusLine(violations)}</p>`;
    newColumn = `<div class="col">
      <h3>new</h3>
      ${stepsListNew(rewrite)}
      <p class="why"><strong>why:</strong> ${esc(rewrite.why)}</p>
      ${newGramTable(rewrite, phase0Covers)}
      <p class="macros"><strong>her:</strong> ${macroLine(newMacros.her)}<br><strong>him:</strong> ${macroLine(newMacros.him)}</p>
      ${batchLine}
      ${freebiesLine}
      ${notesLine}
    </div>`;
  }

  const oldColumn = `<div class="col">
    <h3>old (Phase 0, data/raw/methods.json)</h3>
    ${stepsListOld(originalCard)}
    <p class="why"><strong>why:</strong> ${esc(originalCard.why)}</p>
    ${oldGramTable(originalCard)}
    <p class="macros"><strong>her:</strong> ${macroLine(oldMacros.her)}<br><strong>him:</strong> ${macroLine(oldMacros.him)}</p>
  </div>`;

  return `<section class="meal">
    ${header}
    ${statusBanner}
    <div class="cols">${oldColumn}${newColumn}</div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Session rendering (prep-a / prep-b)
// ---------------------------------------------------------------------------

function opRow(op, isNew) {
  const ingRows = (op.ingredients ?? []).map((i) => `${esc(ingName(i.ingId))} ${i.g} g`).join(", ");
  const extra = isNew
    ? [op.minutes !== undefined && op.minutes !== null ? `${op.minutes} min` : null, op.tempC ? `${op.tempC}&deg;C` : null, op.untimed ? "untimed" : null]
        .filter(Boolean)
        .join(" &middot; ")
    : "";
  return `<tr>
    <td>${esc(op.clock)}</td>
    <td><strong>${esc(op.title)}</strong>${extra ? ` <span class="step-meta">[${extra}]</span>` : ""}<br>${esc(op.body)}</td>
    <td>${esc(op.station)}</td>
    <td>${ingRows || "&mdash;"}</td>
  </tr>`;
}

function yieldRow(y) {
  const consumers = y.consumers ? y.consumers.join(", ") : "&mdash;";
  const note = y.note ? `<br><em>${esc(y.note)}</em>` : "";
  return `<tr><td>${esc(y.component)}</td><td>${esc(y.qty)}</td><td>${esc(consumers)}</td><td>${esc(y.storage)}${note}</td></tr>`;
}

function renderSession(week) {
  const sessionId = `prep-${week.toLowerCase()}`;
  const old = phase0PrepSession(week);
  const loaded = prepRewriteStatusByWeek[week];
  const oldOpsTable = `<table class="op-table"><thead><tr><th>clock</th><th>op</th><th>station</th><th>ingredients</th></tr></thead><tbody>${old.ops.map((o) => opRow(o, false)).join("\n")}</tbody></table>`;
  const oldYieldsTable = `<table class="yield-table"><thead><tr><th>component</th><th>qty</th><th>consumers</th><th>storage</th></tr></thead><tbody>${old.yields.map(yieldRow).join("\n")}</tbody></table>`;

  let statusBanner, newBlock;
  if (loaded.status === "missing") {
    statusBanner = `<p class="status status-missing">NOT YET REWRITTEN</p>`;
    newBlock = `<div class="col"><h3>new</h3><p class="placeholder">— no data/rewrites/${sessionId}.json yet —</p></div>`;
  } else if (loaded.status === "invalid") {
    statusBanner = `<p class="status status-invalid">REWRITE FILE INVALID — original session shown, kept as rev A</p><p class="error">${esc(loaded.message)}</p>`;
    newBlock = `<div class="col"><h3>new</h3><p class="placeholder">— rewrite file present but failed validation, see above —</p></div>`;
  } else {
    const rw = loaded.data;
    const newOpsTable = `<table class="op-table"><thead><tr><th>clock</th><th>op</th><th>station</th><th>ingredients</th></tr></thead><tbody>${rw.ops.map((o) => opRow(o, true)).join("\n")}</tbody></table>`;
    const newYieldsTable = `<table class="yield-table"><thead><tr><th>component</th><th>qty</th><th>consumers</th><th>storage</th></tr></thead><tbody>${rw.yields.map(yieldRow).join("\n")}</tbody></table>`;
    const notesLine = rw.notes?.length ? `<details class="notes"><summary>rewriter notes (${rw.notes.length})</summary><ul>${rw.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></details>` : "";
    statusBanner = `<p class="status status-ok">rev B &middot; totalMin ${rw.totalMin ?? "&mdash;"}</p>`;
    newBlock = `<div class="col"><h3>new</h3><p class="meta">${esc(rw.sessionName)}</p>${newOpsTable}${newYieldsTable}${notesLine}</div>`;
  }

  return `<section class="meal session">
    <h2>Week ${week} Sunday session <span class="meal-id">${sessionId}</span></h2>
    ${statusBanner}
    <div class="cols">
      <div class="col"><h3>old (Phase 0)</h3><p class="meta">${esc(old.sessionName)}</p>${oldOpsTable}${oldYieldsTable}</div>
      ${newBlock}
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Page assembly
// ---------------------------------------------------------------------------

const mealSections = batch.mealIds.map(renderMeal).join("\n");
const sessionSections = batch.sessionIds.map((sessionId) => renderSession(sessionId.endsWith("-a") ? "A" : "B")).join("\n");

const rewrittenCount = batch.mealIds.filter((id) => loadMealRewrite(REWRITES_DIR, id).status === "ok").length;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>FD-5 Phase 1 review — batch ${esc(BATCH_ID)}</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 1400px; margin: 0 auto; padding: 24px; color: #111; background: #fff; }
  h1 { font-size: 22px; }
  h2 { font-size: 18px; margin-top: 40px; border-top: 2px solid #333; padding-top: 12px; }
  h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
  .summary { background: #f4f4f4; padding: 12px 16px; border-radius: 4px; font-size: 14px; }
  .meal-id { font-family: monospace; font-size: 13px; color: #666; font-weight: normal; }
  .meta { color: #555; font-size: 13px; margin: 2px 0 8px; }
  .cols { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
  .col { flex: 1 1 460px; min-width: 360px; border: 1px solid #ddd; border-radius: 4px; padding: 12px 16px; }
  .status { font-weight: bold; padding: 6px 10px; border-radius: 4px; display: inline-block; margin: 8px 0; }
  .status-missing { background: #fff3cd; color: #7a5c00; }
  .status-invalid { background: #f8d7da; color: #7a1520; }
  .status-ok { background: #d4edda; color: #155724; }
  .lint-pass { color: #155724; }
  .lint-fail { color: #7a1520; font-weight: bold; }
  .error { color: #7a1520; font-family: monospace; font-size: 12px; white-space: pre-wrap; }
  .steps { padding-left: 20px; font-size: 14px; }
  .steps li { margin-bottom: 6px; }
  .step-meta { color: #888; font-size: 12px; }
  .why { font-size: 13px; font-style: italic; color: #333; background: #fafafa; padding: 8px; border-radius: 4px; }
  table.gram-table, table.op-table, table.yield-table { border-collapse: collapse; width: 100%; font-size: 13px; margin: 8px 0; }
  table.gram-table th, table.gram-table td, table.op-table th, table.op-table td, table.yield-table th, table.yield-table td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; vertical-align: top; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.row-changed { background: #fff8e1; }
  tr.row-dropped { background: #fbeaea; text-decoration: line-through; color: #888; }
  .tag-new { background: #cce5ff; color: #004085; font-size: 10px; padding: 1px 5px; border-radius: 3px; }
  .tag-changed { background: #fff3cd; color: #7a5c00; font-size: 11px; padding: 1px 5px; border-radius: 3px; }
  .tag-dropped { background: #f8d7da; color: #7a1520; font-size: 10px; padding: 1px 5px; border-radius: 3px; }
  .tag-batch, .tag-fresh { font-size: 11px; padding: 1px 6px; border-radius: 3px; font-weight: normal; }
  .tag-batch { background: #e2d9f3; color: #4b3679; }
  .tag-fresh { background: #d4edda; color: #155724; }
  .macros { font-size: 13px; }
  .batch-meta, .freebies { font-size: 12px; color: #444; }
  .placeholder { color: #999; font-style: italic; }
  .notes { font-size: 12px; margin-top: 8px; }
  .notes summary { cursor: pointer; color: #555; }
  .notes ul { padding-left: 18px; }
  code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; }
</style>
</head>
<body>
<h1>FD-5 Phase 1 review — batch ${esc(BATCH_ID)}</h1>
<div class="summary">
  <strong>${batch.mealIds.length} meal(s)</strong>${batch.sessionIds.length ? ` + <strong>${batch.sessionIds.length} session(s)</strong> (${batch.sessionIds.join(", ")})` : ""}
  &middot; <strong>${rewrittenCount}/${batch.mealIds.length}</strong> rewritten
  &middot; approvals.json batch approval: <strong>${batch.approved ? "APPROVED" : "not yet approved"}</strong>
  &middot; generated ${esc(new Date().toISOString())}
</div>
${mealSections}
${sessionSections}
</body>
</html>
`;

fs.mkdirSync(DOCS_REVIEW, { recursive: true });
const outPath = path.join(DOCS_REVIEW, `batch-${BATCH_ID}.html`);
fs.writeFileSync(outPath, html);
console.log(`wrote ${path.relative(ROOT, outPath)} (${rewrittenCount}/${batch.mealIds.length} meals rewritten, ${batch.sessionIds.length} session(s))`);
