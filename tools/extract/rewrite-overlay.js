// tools/extract/rewrite-overlay.js
//
// Phase 1 overlay mechanism: pure functions that read/validate the Phase 1
// author files (REWRITE-SPEC.md file layout) and fold them onto Phase 0
// output. Used by both join.js (the real pipeline, pointed at data/rewrites/
// and tools/extract/{owner-rulings,approvals}.json) and the unit tests
// (pointed at tools/extract/fixtures/).
//
// Resilience policy (STANDING RULE: ambiguity -> STOP, never guess; but
// "missing/partial data/rewrites/ must NEVER break the pipeline" per the
// task brief):
//   - A rewrite file that is simply ABSENT is normal — the meal/session
//     keeps its Phase 0 content untouched. Not an error, not logged as one.
//   - A rewrite file that EXISTS but fails schema or referential validation
//     (unknown ingredient id, mealId/filename mismatch, etc.) is treated the
//     SAME as absent for pipeline purposes — it is skipped with a clear
//     console warning naming the file and the problem, and the meal/session
//     falls back to Phase 0 content. Two rewriter agents are iterating on
//     these files in parallel; one file being mid-edit must never take down
//     `npm run extract` for the whole project. The lint suite (L1-L10, run
//     via `npm run validate`) is what surfaces these problems loudly for a
//     human to fix.
//   - The ONE exception: two _ingredients.<week>.json files defining the
//     SAME new ingredient id with DIFFERENT content is a genuine conflict
//     between the two rewriters that only a human can resolve (which one is
//     right?) — this is real ambiguity per CONTRACT.md's standing rule, so
//     join.js treats it as fatal via the existing stop()/decision-request
//     mechanism, not a silent skip.
//   - owner-rulings.json / approvals.json are config files this deliverable
//     itself authors and are expected to always be valid; if PRESENT but
//     invalid, that is a mechanism-level bug, not ordinary rewrite churn, so
//     the caller (join.js) treats it as fatal too. If simply absent, the
//     overlay degrades gracefully (no rulings applied / nothing approved).

import fs from "node:fs";
import path from "node:path";
import {
  ContentPassIngredientsFileSchema,
  RewriteMealSchema,
  RewritePrepSchema,
  ApprovalsSchema,
  OwnerRulingsSchema,
} from "./rewrite-schemas.js";

export class RewriteFileError extends Error {
  constructor(file, message) {
    super(`${file}: ${message}`);
    this.name = "RewriteFileError";
    this.file = file;
  }
}

function readJSONIfExists(p) {
  if (!fs.existsSync(p)) return undefined;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// Mirrors the "_"-prefixed-key convention already used by alias-map.json /
// register-map.json elsewhere in this codebase: metadata/comment keys are
// stripped before schema validation, not treated as unknown-key failures.
function stripUnderscoreKeys(obj) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!k.startsWith("_")) out[k] = v;
  }
  return out;
}

function fieldPath(issue) {
  return issue.path.length ? issue.path.join(".") : "(root)";
}

export function describeIssues(issues) {
  return issues.map((i) => `${fieldPath(i)}: ${i.message}`).join("; ");
}

// ---------------------------------------------------------------------------
// owner-rulings.json -> decisions-queue.json
// ---------------------------------------------------------------------------

export function loadOwnerRulings(rulingsPath) {
  const raw = readJSONIfExists(rulingsPath);
  if (raw === undefined) return null;
  const result = OwnerRulingsSchema.safeParse(stripUnderscoreKeys(raw));
  if (!result.success) {
    throw new RewriteFileError(rulingsPath, `failed validation — ${describeIssues(result.error.issues)}`);
  }
  return result.data;
}

// Returns a NEW decisions array (never mutates the input). Every entry named
// in ownerRulings.rulings gets its status/resolvedTo overwritten and
// resolvedBy stamped; every OTHER "resolved-by-default" entry is left
// content-unchanged but also gets resolvedBy stamped (the checkpoint
// confirmation). Entries still "open" and not named in rulings are untouched.
export function applyOwnerRulings(decisions, ownerRulings) {
  if (!ownerRulings) {
    return { decisions, appliedRulingIds: [], confirmedDefaultIds: [], unknownRulingIds: [] };
  }
  const rulingIds = new Set(Object.keys(ownerRulings.rulings));
  const knownIds = new Set(decisions.map((d) => d.id));
  const unknownRulingIds = [...rulingIds].filter((id) => !knownIds.has(id));

  const appliedRulingIds = [];
  const confirmedDefaultIds = [];

  const out = decisions.map((d) => {
    if (rulingIds.has(d.id)) {
      appliedRulingIds.push(d.id);
      const ruling = ownerRulings.rulings[d.id];
      return { ...d, status: ruling.status, resolvedTo: ruling.resolvedTo, resolvedBy: ownerRulings.resolvedBy };
    }
    if (d.status === "resolved-by-default") {
      confirmedDefaultIds.push(d.id);
      return { ...d, resolvedBy: ownerRulings.resolvedBy };
    }
    return d;
  });

  return { decisions: out, appliedRulingIds, confirmedDefaultIds, unknownRulingIds };
}

// ---------------------------------------------------------------------------
// data/rewrites/_ingredients.A.json, _ingredients.B.json -> ingredients.json
// ---------------------------------------------------------------------------

export function loadContentPassIngredients(rewritesDir) {
  const entries = [];
  const invalid = [];
  for (const week of ["A", "B"]) {
    const file = path.join(rewritesDir, `_ingredients.${week}.json`);
    const raw = readJSONIfExists(file);
    if (raw === undefined) continue;
    const result = ContentPassIngredientsFileSchema.safeParse(raw);
    if (!result.success) {
      invalid.push({ file, message: describeIssues(result.error.issues) });
      continue;
    }
    // Normalize incidental authoring differences BEFORE dedup/conflict
    // comparison, so two rewriters who both wrote a correct, equivalent
    // record don't get flagged as "conflicting" over things join.js itself
    // controls anyway (addedInContentPass is always re-stamped on merge;
    // an omitted sku and an explicit sku:null are the same fact).
    for (const record of result.data) {
      const { addedInContentPass, ...rest } = record;
      entries.push({ week, file, record: { ...rest, sku: record.sku ?? null } });
    }
  }
  return { entries, invalid };
}

// existingIds = the Phase 0 ingredients.json id set (before this merge).
// Returns { merged, conflicts, collisions }:
//   merged     — deduped records ready to append to ingredients.json,
//                addedInContentPass:true, contentPassSources:[week,...]
//   conflicts  — same id, different content, across A/B (join.js STOPs)
//   collisions — id already exists in Phase 0 ingredients.json (skipped,
//                logged — a rewriter reusing e.g. "rapeseed_oil" by mistake
//                should use the existing id directly, not redefine it here)
export function mergeContentPassIngredients(entries, existingIds) {
  const byId = new Map(); // id -> { record, sources: [week,...] }
  const conflicts = [];
  const collisions = [];

  for (const { week, record } of entries) {
    if (existingIds.has(record.id)) {
      collisions.push({ id: record.id, week });
      continue;
    }
    const prior = byId.get(record.id);
    if (!prior) {
      byId.set(record.id, { record, sources: [week] });
      continue;
    }
    if (JSON.stringify(prior.record) === JSON.stringify(record)) {
      if (!prior.sources.includes(week)) prior.sources.push(week);
    } else if (!conflicts.some((c) => c.id === record.id)) {
      conflicts.push({ id: record.id, sources: [...prior.sources, week] });
    }
  }

  const merged = [...byId.values()]
    .filter((v) => !conflicts.some((c) => c.id === v.record.id))
    .map((v) => ({ ...v.record, addedInContentPass: true, contentPassSources: v.sources }));

  return { merged, conflicts, collisions };
}

// ---------------------------------------------------------------------------
// data/rewrites/<mealId>.json -> meals.json
// ---------------------------------------------------------------------------

export function loadMealRewrite(rewritesDir, mealId) {
  const file = path.join(rewritesDir, `${mealId}.json`);
  const raw = readJSONIfExists(file);
  if (raw === undefined) return { status: "missing" };
  const result = RewriteMealSchema.safeParse(raw);
  if (!result.success) {
    return { status: "invalid", file, message: describeIssues(result.error.issues) };
  }
  const data = result.data;
  if (data.mealId !== mealId) {
    return { status: "invalid", file, message: `mealId field ("${data.mealId}") does not match filename ("${mealId}.json")` };
  }
  return { status: "ok", file, data };
}

// Exported: also used by validate.test.js to independently recompute pure
// Phase 0 macros (via lint-rules.js's phase0CoversForCard) so the Phase 0
// checksums stay meaningful once real Phase 1 overlay content exists in
// data/meals.json — see that file's checksum 2/3 for why.
export function recomputeMacros(coverGrams, ingredientsById) {
  let kcal = 0,
    protein = 0,
    fibre = 0,
    carb = 0,
    fat = 0;
  for (const [ingId, g] of Object.entries(coverGrams)) {
    const ing = ingredientsById.get(ingId);
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

// ingredientsById: Map<id, ingredientRecord> — must reflect the FINAL id set
// (Phase 0 + merged content-pass records) so referential checks are correct.
export function applyMealRewrite(meal, rewrite, ingredientsById) {
  const unknown = new Set();
  for (const cover of ["w", "m"]) {
    for (const id of Object.keys(rewrite.covers[cover])) {
      if (!ingredientsById.has(id)) unknown.add(id);
    }
  }
  for (const id of rewrite.freebies) {
    if (!ingredientsById.has(id)) unknown.add(id);
  }
  if (unknown.size) {
    return { status: "invalid", message: `references unknown ingredient id(s): ${[...unknown].join(", ")}` };
  }

  const macros = {
    w: recomputeMacros(rewrite.covers.w, ingredientsById),
    m: recomputeMacros(rewrite.covers.m, ingredientsById),
  };

  const steps = rewrite.steps.map((s) => ({
    n: s.n,
    text: s.text,
    minutes: s.minutes,
    tempC: s.tempC,
    track: s.track,
    station: s.station ?? null,
    clockStart: s.clockStart,
    ...(s.untimed ? { untimed: true } : {}),
  }));

  const overlaid = {
    ...meal,
    covers: { w: { ...rewrite.covers.w }, m: { ...rewrite.covers.m } },
    macros,
    method: {
      steps,
      why: rewrite.why,
      batchSource: rewrite.batchSource,
      batchTakeG: rewrite.batchTakeG,
      approved: false, // approvals.json pass sets this afterwards
      rev: "B",
    },
  };
  return { status: "ok", meal: overlaid, freebies: rewrite.freebies, notes: rewrite.notes };
}

// ---------------------------------------------------------------------------
// data/rewrites/prep-a.json, prep-b.json -> prep.json
// ---------------------------------------------------------------------------

export function loadPrepRewrite(rewritesDir, week) {
  const file = path.join(rewritesDir, week === "A" ? "prep-a.json" : "prep-b.json");
  const raw = readJSONIfExists(file);
  if (raw === undefined) return { status: "missing" };
  const result = RewritePrepSchema.safeParse(raw);
  if (!result.success) {
    return { status: "invalid", file, message: describeIssues(result.error.issues) };
  }
  const data = result.data;
  if (data.week !== week) {
    return { status: "invalid", file, message: `week field ("${data.week}") does not match filename (expected "${week}")` };
  }
  // Normalize the note/headroomNote naming drift between the two rewriters
  // to one field before it goes anywhere else.
  const normalized = {
    ...data,
    yields: data.yields.map(({ headroomNote, note, ...y }) => ({ ...y, note: note ?? headroomNote ?? null })),
  };
  return { status: "ok", file, data: normalized };
}

export function applyPrepRewrite(session, rewrite, knownIngredientIds) {
  const unknown = new Set();
  for (const op of rewrite.ops) {
    for (const ing of op.ingredients) {
      if (!knownIngredientIds.has(ing.ingId)) unknown.add(ing.ingId);
    }
  }
  if (unknown.size) {
    return { status: "invalid", message: `references unknown ingredient id(s): ${[...unknown].join(", ")}` };
  }
  const overlaid = {
    ...session,
    sessionName: rewrite.sessionName,
    totalMin: rewrite.totalMin,
    ops: rewrite.ops,
    yields: rewrite.yields,
    midweek: rewrite.midweek,
    rev: "B",
    approved: false, // approvals.json pass sets this afterwards
  };
  return { status: "ok", session: overlaid };
}

// ---------------------------------------------------------------------------
// tools/extract/approvals.json -> method.approved (meals) / approved (prep)
// ---------------------------------------------------------------------------

export function loadApprovals(approvalsPath) {
  const raw = readJSONIfExists(approvalsPath);
  if (raw === undefined) return null;
  const result = ApprovalsSchema.safeParse(stripUnderscoreKeys(raw));
  if (!result.success) {
    throw new RewriteFileError(approvalsPath, `failed validation — ${describeIssues(result.error.issues)}`);
  }
  return result.data;
}

// meal/session id -> approved boolean, flattened across all four batches.
export function batchApprovalMap(approvals) {
  const map = new Map();
  if (!approvals) return map;
  for (const batch of Object.values(approvals)) {
    for (const id of [...batch.mealIds, ...batch.sessionIds]) map.set(id, batch.approved);
  }
  return map;
}
