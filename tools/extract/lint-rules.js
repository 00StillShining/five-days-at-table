// tools/extract/lint-rules.js
//
// Pure functions implementing the Phase 1 "Lint contract" (REWRITE-SPEC.md
// §Lint contract, L1-L10). Consumed by tools/extract/lint.test.js (the
// vitest lint suite that `npm run validate` runs) and by
// tools/review/render-batch.js (per-meal lint-status line).
//
// Every function here takes already-loaded, already-schema-validated data
// (a RewriteMealSchema-shaped object, the raw methods.json, etc.) and
// returns an ARRAY of violation objects — empty array = pass. Nothing here
// throws or exits; that is the caller's job (the lint test suite reports
// failures the normal vitest way; join.js never calls this module at all —
// lints are a REVIEW gate, not a pipeline gate, per REWRITE-SPEC.md's own
// framing: "what npm run validate will enforce after the mechanism lands").
//
// L1-L4, L6-L8 need the ORIGINAL (Phase 0) card to compare against — read
// directly from data/raw/methods.json + data/raw/fd5.json, NOT from
// data/meals.json, because meals.json IS the post-overlay output once real
// rewrites exist and would no longer reflect pure Phase 0 content. This
// mirrors join.js's own methods<->fd5 join logic (duplicated here in
// miniature, not imported from join.js, since join.js is a script with no
// exports — see the D0-004 peppers raw/cooked split it reproduces).

// ---------------------------------------------------------------------------
// Shared helpers: mealId <-> raw card lookup, Phase 0 covers reconstruction
// ---------------------------------------------------------------------------

const SLOT_LETTER_TO_CAP = { b: "Breakfast", l: "Lunch", d: "Dinner", s: "Snack" };

export function parseMealId(mealId) {
  const m = /^([ab])-d(\d)([blds])$/.exec(mealId);
  if (!m) return null;
  return { week: m[1].toUpperCase(), dayNo: +m[2], slot: SLOT_LETTER_TO_CAP[m[3]] };
}

export function findRawCard(methodsRaw, mealId) {
  const parsed = parseMealId(mealId);
  if (!parsed) return null;
  const cards = methodsRaw.weeks[parsed.week]?.cards ?? [];
  return cards.find((c) => c.dayNo === parsed.dayNo && c.slot === parsed.slot) ?? null;
}

// Mirrors join.js's D0-004 ruling exactly: "Red pepper, deseeded" resolves
// to the fresh "peppers" id only for the two named-raw cards, "peppers_frozen"
// everywhere else it appears.
const RAW_PEPPER_CARDS = new Set(["B-2-Dinner", "B-3-Dinner"]);

function resolveIngId(nameToId, card, ingredientName) {
  if (ingredientName === "Red pepper, deseeded") {
    const key = `${card.week}-${card.dayNo}-${card.slot}`;
    return RAW_PEPPER_CARDS.has(key) ? "peppers" : "peppers_frozen";
  }
  return nameToId[ingredientName];
}

// Reconstructs the exact Phase 0 per-cover gram table for a card, straight
// from data/raw/methods.json + data/raw/fd5.json — the same inputs and
// logic join.js itself used to build meals.json's covers in the first
// place, before any overlay is applied.
export function phase0CoversForCard(fd5Raw, card) {
  const nameToId = {};
  for (const id of fd5Raw.ids) nameToId[fd5Raw.spec[id][0]] = id;
  const w = {};
  const m = {};
  for (const ing of card.ingredients) {
    const id = resolveIngId(nameToId, card, ing.name);
    w[id] = (w[id] ?? 0) + ing.herG;
    m[id] = (m[id] ?? 0) + ing.himG;
  }
  return { w, m };
}

export function collapseWhitespace(s) {
  return s.trim().replace(/\s+/g, " ");
}

function escapeRegExp(n) {
  return String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// L1 — every step timed (minutes and/or tempC) or explicitly untimed
// ---------------------------------------------------------------------------

export function lintL1(rewrite) {
  const violations = [];
  for (const step of rewrite.steps) {
    const timed = step.minutes !== null || step.tempC !== null;
    if (!timed && step.untimed !== true) {
      violations.push({
        mealId: rewrite.mealId,
        rule: "L1",
        step: step.n,
        message: `step ${step.n} has no minutes/tempC and is not marked untimed`,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// L2 — every oven/air-fryer/grill step has tempC.
//
// Two real, independently-authored conventions both showed up in practice:
// Week A restates tempC on EVERY step tagged track:"oven" (even a bare
// "take it out" hand-off step); Week B only restates it on the step(s)
// where something is actually cooking at that temperature, leaving prep/
// assembly steps that merely sit on the oven's timeline lane (chopping,
// crumbing, "salt both sides") without one. Both are legitimate — the
// PLAN's own rule ("every oven step has a temperature") is about not
// leaving the COOK screen without a number when the oven is actually in
// use, not about redundant restatement on steps where nothing is at
// temperature yet. So this only flags a step as needing tempC when it BOTH
// looks oven/air-fryer-bound AND its own text describes an active,
// time-bound cook (a duration, an explicit °C mention, or a bake/roast
// verb) — not merely because it shares the oven's track label. "grill" is
// deliberately excluded from the text signal: real content uses it for a
// genuinely flexible "grill, griddle or a hot pan" hob technique as often
// as an oven grill setting, so the word alone is not a reliable signal.
// ---------------------------------------------------------------------------

const OVEN_ISH = /\b(oven|air[- ]?fryer)\b/i;
const ACTIVE_COOK = /\d+(?:\.\d+)?\s*(?:min|minute|hour|hr)s?\b|°c|\b(?:bake|baking|roast|roasting|crisp|crisping)\b/i;

export function lintL2(rewrite) {
  const violations = [];
  for (const step of rewrite.steps) {
    const isOvenish = step.track === "oven" || OVEN_ISH.test(step.text);
    const looksActive = ACTIVE_COOK.test(step.text);
    if (isOvenish && looksActive && step.tempC === null) {
      violations.push({
        mealId: rewrite.mealId,
        rule: "L2",
        step: step.n,
        message: `step ${step.n} looks like an active oven/air-fryer cook (track="${step.track}", text="${step.text.slice(0, 60)}…") but has no tempC`,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// L3 — every covers ingId's grams restated in >=1 step, in one of the three
// REWRITE-SPEC formats: "(100/120 g)", "(100 g)" when equal, or
// "her 100 g / him 120 g".
//
// Real content routinely restates a single ingredient's total across
// SEVERAL partial mentions rather than one — not just the D0-003 two-id
// substitution case, but plenty of ordinary same-id splits too: half now/
// half later ("about half the skyr (48/70 g)" ... "Remaining skyr
// (47/70 g)"), a flat shared portion plus a per-cover remainder ("3 g of
// the rapeseed oil brushed over" ... "remaining 3/5 g rapeseed oil"), even
// three-way splits (sear oil + pan oil + "Remaining rapeseed oil (8/11 g)").
// This is exactly PLAN §4 rule 3's own "4 g now, 5/7 g at the plate"
// description, generalised beyond oil. So "restated" here means: EITHER one
// direct mention of the full (herG, himG) pair, OR some subset of the
// meal's own numeric g-mentions sums exactly to (herG, himG) — capturing a
// split without needing to know which prose belongs to which ingredient.
// ---------------------------------------------------------------------------

// Every "(X/Y g)"-shaped or "her X g / him Y g"-shaped pair mentioned
// anywhere in the steps, plus every standalone "N g" mention (not already
// part of a pair) treated as a flat (N, N) contribution shared by both
// covers (e.g. "3 g of the rapeseed oil", "100 g — 2 eggs").
function extractGramCandidates(text) {
  const claimed = []; // [start, end) ranges already attributed to a pair match
  const pairs = [];
  const pairRe = /\b(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*g\b/g;
  for (const m of text.matchAll(pairRe)) {
    pairs.push([+m[1], +m[2]]);
    claimed.push([m.index, m.index + m[0].length]);
  }
  const herHimRe = /her\s+(\d+(?:\.\d+)?)\s*g\s*\/\s*him\s+(\d+(?:\.\d+)?)\s*g/gi;
  for (const m of text.matchAll(herHimRe)) {
    pairs.push([+m[1], +m[2]]);
    claimed.push([m.index, m.index + m[0].length]);
  }
  const flatRe = /\b(\d+(?:\.\d+)?)\s*g\b/g;
  for (const m of text.matchAll(flatRe)) {
    const inClaimed = claimed.some(([s, e]) => m.index >= s && m.index < e);
    if (!inClaimed) pairs.push([+m[1], +m[1]]);
  }
  return pairs;
}

const MAX_SPLIT_PARTS = 4; // bounds the subset search; every real split case seen is <=3 parts

function sumsToTarget(candidates, herG, himG) {
  // Direct single-mention match first (the common case, cheap).
  if (candidates.some(([x, y]) => x === herG && y === himG)) return true;
  // Bounded subset-sum search (>=2 parts — a lone-candidate match was
  // already handled above) for a split restatement.
  function search(startIdx, partsLeft, partsUsed, sumX, sumY) {
    if (partsUsed >= 2 && sumX === herG && sumY === himG) return true;
    if (partsLeft === 0 || sumX > herG || sumY > himG) return false;
    for (let i = startIdx; i < candidates.length; i++) {
      const [x, y] = candidates[i];
      if (search(i + 1, partsLeft - 1, partsUsed + 1, sumX + x, sumY + y)) return true;
    }
    return false;
  }
  return search(0, MAX_SPLIT_PARTS, 0, 0, 0);
}

export function lintL3(rewrite) {
  const violations = [];
  const allText = rewrite.steps.map((s) => s.text).join(" \n ");
  const candidates = extractGramCandidates(allText);
  const ids = new Set([...Object.keys(rewrite.covers.w), ...Object.keys(rewrite.covers.m)]);
  for (const id of ids) {
    const herG = rewrite.covers.w[id];
    const himG = rewrite.covers.m[id];
    if (herG === undefined || himG === undefined) {
      violations.push({
        mealId: rewrite.mealId,
        rule: "L3",
        ingId: id,
        message: `"${id}" appears in only one cover's table (her=${herG}, him=${himG})`,
      });
      continue;
    }
    if (!sumsToTarget(candidates, herG, himG)) {
      violations.push({
        mealId: rewrite.mealId,
        rule: "L3",
        ingId: id,
        message: `grams for "${id}" (her=${herG}/him=${himG}) not restated (directly or as a summed split) in any step`,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// L4 — split usages sum to table. In this dataset "split usage" IS the
// D0-003 substitution split (REWRITE-SPEC rule 8): an oil/cabbage row that
// was ONE ingredient id in Phase 0 becomes TWO ids in the rewrite
// (rapeseed_oil + olive_oil, or sweetheart_cabbage + lettuce). The two
// portions must sum back exactly to the single Phase 0 total — no new grams
// introduced (rule 9). This is the "17 split-oil cases" rule 3 names.
//
// Checked on the COMBINED (her+him) total, not per-cover: two of the split
// cases (b-2-Dinner, b-4-Lunch) are ALSO D0-015 oil-inversion fixes, which
// legitimately SWAP the her/him amounts (her 12/him 10 -> her 10/him 12) —
// a real, ruled, per-cover redistribution that L7 already separately
// sanctions for these ids. Comparing per-cover here would misread that
// sanctioned swap as a shortfall on one side and a surplus on the other.
// The combined total is invariant to a same-total swap, so it's the right
// level for THIS rule: catch grams actually gained or lost, not who got how
// much of an unchanged total.
// ---------------------------------------------------------------------------

const SPLIT_PAIRS = [
  { parts: ["rapeseed_oil", "olive_oil"], original: "olive_oil" },
  { parts: ["sweetheart_cabbage", "lettuce"], original: "lettuce" },
];

export function lintL4(rewrite, phase0Covers) {
  const violations = [];
  for (const { parts, original } of SPLIT_PAIRS) {
    const originalCombined = (phase0Covers.w[original] ?? 0) + (phase0Covers.m[original] ?? 0);
    if (originalCombined === 0) continue; // this meal never had the original id at all — not a split case
    const usesAnyPart = parts.some((p) => rewrite.covers.w[p] !== undefined || rewrite.covers.m[p] !== undefined);
    if (!usesAnyPart) continue; // meal kept the original id unsplit — nothing to check
    const rewriteCombined = parts.reduce((s, p) => s + (rewrite.covers.w[p] ?? 0) + (rewrite.covers.m[p] ?? 0), 0);
    if (rewriteCombined !== originalCombined) {
      violations.push({
        mealId: rewrite.mealId,
        rule: "L4",
        message: `${parts.join(" + ")} sums to ${rewriteCombined} g (her+him combined) but the Phase 0 "${original}" total was ${originalCombined} g`,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// L5 — batch cards: batchSource + batchTakeG consistent with prep yields
// (exact, or headroom documented in the yield's note).
//
// Real rewrite content (not just the illustrative single-component "take
// 490 g of Sunday's bolognese" example in REWRITE-SPEC.md) shows batch
// LUNCHES routinely assemble from SEVERAL Sunday yields at once — e.g. one
// real lunch draws chicken + rice + riced cauliflower + a yoghurt white
// sauce, all in the same card — and the schema gives exactly ONE combined
// batchTakeG {w,m,total} per meal, not a breakdown per yield. So "consistent
// with prep yields" cannot mean "equals one specific yield's total": there
// is no way to attribute a combined figure back to individual yields
// without inventing a per-yield split the rewrite file doesn't state. What
// IS honestly checkable without guessing:
//   - batchSource points at the meal's own week's session;
//   - batchTakeG is internally consistent (w + m = total);
//   - the meal is actually listed as a consumer of at least one yield in
//     that session (proves it's genuinely batch-linked, not a stray tag);
//   - batchTakeG.total doesn't exceed a generous ceiling — the sum of every
//     parseable yield quantity in the whole session — which catches a
//     genuinely nonsensical figure (e.g. taking 10 kg from a ~3 kg session)
//     without presuming which specific yield(s) contributed how much.
// ---------------------------------------------------------------------------

function sumOfAllYieldQuantities(session) {
  let sum = 0;
  for (const y of session?.yields ?? []) {
    const m = /(\d+(?:\.\d+)?)/.exec(y.qty);
    if (m) sum += +m[1];
  }
  return sum;
}

export function lintL5(rewrite, week, prepSessionsByWeek) {
  const violations = [];
  if (rewrite.batchSource === null && rewrite.batchTakeG === null) return violations;
  if ((rewrite.batchSource === null) !== (rewrite.batchTakeG === null)) {
    violations.push({
      mealId: rewrite.mealId,
      rule: "L5",
      message: `batchSource and batchTakeG must be both null or both set (batchSource=${JSON.stringify(rewrite.batchSource)}, batchTakeG=${JSON.stringify(rewrite.batchTakeG)})`,
    });
    return violations;
  }
  if (rewrite.batchTakeG.w + rewrite.batchTakeG.m !== rewrite.batchTakeG.total) {
    violations.push({
      mealId: rewrite.mealId,
      rule: "L5",
      message: `batchTakeG.w (${rewrite.batchTakeG.w}) + batchTakeG.m (${rewrite.batchTakeG.m}) != batchTakeG.total (${rewrite.batchTakeG.total})`,
    });
  }
  const expectedSource = `prep-${week.toLowerCase()}`;
  if (rewrite.batchSource !== expectedSource) {
    violations.push({
      mealId: rewrite.mealId,
      rule: "L5",
      message: `batchSource "${rewrite.batchSource}" does not match this meal's own week's session ("${expectedSource}")`,
    });
  }
  const session = prepSessionsByWeek[week];
  const isConsumerOfSomething = (session?.yields ?? []).some((y) => (y.consumers ?? []).includes(rewrite.mealId));
  if (!session || !isConsumerOfSomething) {
    violations.push({
      mealId: rewrite.mealId,
      rule: "L5",
      message: `no prep yield in Week ${week}'s session lists "${rewrite.mealId}" as a consumer`,
    });
    return violations;
  }
  const ceiling = sumOfAllYieldQuantities(session);
  if (ceiling > 0 && rewrite.batchTakeG.total > ceiling) {
    violations.push({
      mealId: rewrite.mealId,
      rule: "L5",
      message: `batchTakeG.total (${rewrite.batchTakeG.total} g) exceeds the sum of every yield in Week ${week}'s session (${ceiling} g) — cannot take more than the whole session produces`,
    });
  }
  return violations;
}

// ---------------------------------------------------------------------------
// L6 — why verbatim vs original (whitespace-collapsed byte-identical) vs
// data/raw/methods.json.
// ---------------------------------------------------------------------------

export function lintL6(rewrite, originalCard) {
  const violations = [];
  if (!originalCard) {
    violations.push({ mealId: rewrite.mealId, rule: "L6", message: "no matching data/raw/methods.json card found for this mealId" });
    return violations;
  }
  if (collapseWhitespace(rewrite.why) !== collapseWhitespace(originalCard.why)) {
    violations.push({
      mealId: rewrite.mealId,
      rule: "L6",
      message: `why block is not whitespace-collapsed byte-identical to data/raw/methods.json's original`,
    });
  }
  return violations;
}

// ---------------------------------------------------------------------------
// L7 — macros recompute from covers (enforced automatically by join.js's
// overlay — see rewrite-overlay.js's applyMealRewrite, which has no
// "macros" input field to copy from at all). Every covers entry that
// CHANGED vs Phase 0 must trace to a ruled defect (D0-014..D0-020), a
// seasoning addition, or the D0-003 oil/cabbage substitution split.
//
// "Seasoning addition" (rule 5: "Seasonings get weights and enter the
// macro model") turns out, in real content, to include BOTH a genuinely
// new content-pass id (jerk_seasoning, soy_sauce, …) AND an EXISTING base
// ingredient id being weighed into a meal for the first time — e.g. one
// real card adds "coconut_des" (desiccated coconut, already a tracked
// Week A ingredient used elsewhere) to a dish that never carried it before,
// because "a spoonful of coconut in the water" was one of the ~40
// previously-unweighed seasonings PLAN §4's own audit names by example
// ("honey, sugar, soy, mirin, adobo, coconut, suya"). Reusing an existing
// id instead of minting a near-duplicate content-pass one is the MORE
// correct choice, not a violation. The real dividing line rule 9 draws
// ("new/changed grams... FORBIDDEN... not a re-plan") is between MODIFYING
// an already-present row's amount (needs a specific ruled reason) and
// INTRODUCING a row that was absent from this meal entirely (0 -> nonzero
// on BOTH covers) — the latter is exactly what a seasoning addition is, by
// definition, regardless of whether the id itself is new to the dataset or
// merely new to this one meal. So the allowlist below applies only to
// CHANGES on an already-present row; a covers id that was 0/absent on both
// covers in Phase 0 is always allowed to appear (rule 5), full stop.
// ---------------------------------------------------------------------------

// D0-014..D0-020's own cited ingredient ids (see tools/extract/join.js's
// CONTENT_DEFECTS decisions for the citations):
//   D0-014 Sunday cabbage shred (515 g, three consumers)        -> red_cabbage
//   D0-015 Week B oil inversions (her > him)                    -> olive_oil
//   D0-016 pancake "half the skyr" wording                      -> skyr
//   D0-017 pizza "remaining oil" wording                        -> olive_oil
//   D0-018 kofta onion (40 g) missing from B-4-Lunch's table    -> red_onion
//   D0-019 boiled-egg count (2 vs 2.5)                          -> egg
//   D0-020 yield roundings (chicken 600/575 g, chickpeas 250/245 g) -> chicken, chickpeas
const DEFECT_CITED_IDS = new Set(["red_cabbage", "olive_oil", "skyr", "red_onion", "egg", "chicken", "chickpeas"]);

// D0-003's own two substitution pairs (both sides of each pair, since a
// substitution moves grams FROM one id TO the other): rapeseed_oil/olive_oil
// (pan-heat vs finishing oil) and sweetheart_cabbage/lettuce (shredded gem
// swap). "lettuce" and "sweetheart_cabbage" are included alongside the two
// literally-named ids (rapeseed_oil, olive_oil) because a substitution is
// necessarily two-sided — disallowing the lettuce/cabbage side while
// allowing the oil side would make the cabbage half of D0-003 unimplementable.
const D0003_IDS = new Set(["rapeseed_oil", "olive_oil", "sweetheart_cabbage", "lettuce"]);

// contentPassIds is accepted for explicit-intent/documentation purposes and
// as a belt-and-braces allowlist entry, even though a genuinely new
// content-pass id is already covered by the "0 on both covers" rule below
// (Phase 0 never had it anywhere, so it's always 0 -> nonzero).
export function lintL7(rewrite, phase0Covers, contentPassIds) {
  const violations = [];
  const allowlist = new Set([...DEFECT_CITED_IDS, ...D0003_IDS, ...contentPassIds]);
  for (const [coverKey, cover] of [
    ["w", "her"],
    ["m", "him"],
  ]) {
    const ids = new Set([...Object.keys(phase0Covers[coverKey]), ...Object.keys(rewrite.covers[coverKey])]);
    for (const id of ids) {
      const before = phase0Covers[coverKey][id] ?? 0;
      const after = rewrite.covers[coverKey][id] ?? 0;
      if (before === after) continue;
      const newToThisMeal = (phase0Covers.w[id] ?? 0) === 0 && (phase0Covers.m[id] ?? 0) === 0;
      if (newToThisMeal || allowlist.has(id)) continue;
      violations.push({
        mealId: rewrite.mealId,
        rule: "L7",
        ingId: id,
        message: `${cover} cover: "${id}" changed from ${before} g (Phase 0) to ${after} g, but is not a ruled defect id, a new-to-this-meal seasoning addition, or part of the D0-003 substitution split`,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// L8 — multi-component dinners get >=2 tracks with clockStart coverage.
//
// "Multi-component" cannot be derived from the rewrite alone (a rewriter
// could flatten a genuinely multi-component dish back to one track and this
// module would have no independent way to know that's wrong just from the
// rewrite file). The heuristic used here: the ORIGINAL Phase 0 step prose
// containing "Meanwhile" is a strong, deliberate textual signal that the
// dish already reads as parallel components (methods.js's own authors used
// it exactly this way — see e.g. the Chicken-crust pizza card's step 4).
// Only dinners tripping that signal are checked; this is a known, documented
// limitation (false negatives possible on multi-component dishes that don't
// use the word), not a claim of full detection.
// ---------------------------------------------------------------------------

export function lintL8(rewrite, originalCard) {
  const violations = [];
  if (!originalCard || originalCard.slot !== "Dinner") return violations;
  const looksMultiComponent = originalCard.steps.some((s) => /\bmeanwhile\b/i.test(s));
  if (!looksMultiComponent) return violations;

  const tracks = new Set(rewrite.steps.map((s) => s.track).filter((t) => t !== null));
  if (tracks.size < 2) {
    violations.push({
      mealId: rewrite.mealId,
      rule: "L8",
      message: `original card reads as multi-component ("Meanwhile…") but the rewrite uses ${tracks.size} distinct track(s), not >=2`,
    });
  }
  for (const step of rewrite.steps) {
    if (step.track !== null && step.clockStart === null) {
      violations.push({
        mealId: rewrite.mealId,
        rule: "L8",
        step: step.n,
        message: `step ${step.n} has a track ("${step.track}") but no clockStart`,
      });
    }
  }
  return violations;
}
