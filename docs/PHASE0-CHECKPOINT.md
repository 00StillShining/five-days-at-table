# Phase 0 Checkpoint — Data Health Report & Decisions Queue
*Owner checkpoint per PLAN §9.3 · 2026-08-04 · run by the orchestrator*

## Verdict chain

Four parser builders → all self-checks PASS, zero decision requests. Join builder → 15/15 checksums. Fable reviewer → **FIX** (6 items: two factually-wrong queue entries, missing pass-2 freezer bring-downs in the regenerated calendar, mislabeled a+b defrost moves, validation-honesty issues) → builder fixed all six → reviewer re-verified → **PASS**. One fix cycle, no takeover. Committed at `39285f5`.

## Data health (independently verified by the reviewer against the six source files)

- **Pipeline:** `npm run extract` → `npm run validate`: 15/15 join checksums, 22/22 vitest, two consecutive runs byte-identical (deterministic). Zod schema gate is real (validates before writing; failure aborts).
- **Datasets:** 57 ingredients (54 register-backed + 3 created in extraction, flagged) + 5 retired (milk, egg_white, whey, edamame, mango) · 40 meals (20/week) · 2 Sunday sessions (A: 15 ops/11 yields, B: 12 ops/8 yields) · calendar 21 entries (a+b preserved, **a-twice regenerated incl. pass-2 freezer bring-downs**) · plan.json with per-week re-banded targets and labeled-divisor economics.
- **Checksums vs PLAN §3:** methods↔spec join **281/281**; macros recompute within ±1 (±0.2 fibre) on **80/80 cover-checks** (better than the predicted 36/40 — the §4 defects are internally consistent within each card); basket **£179.31** (S 72.70 / M 98.31 / X 8.30) + day-7 **£8.58** exact; legacy ×3 **£257.32** exact; alias map 55/55, register map 54/54, zero fuzzy; estimate overlay differs from base on exactly **19 items**, overlay wins.
- **One deviation, explained and asserted exactly:** Week A day totals (her) recompute to **1671/1675/1670/1650/1694** vs the plan's 1667/1663/1670/1646/1694. Cause: the three D10 avocado-garnish drops each came with a compensating olive-oil increase (pizza & steak sandwich 9/11→14/17 g; burrito bowl +5/6 g). Deltas +4/+12/0/+4/0 are asserted to the kcal in validation.
- **Source-document defects found (not ours):** two penny drifts inside FD5-Provisioning.html (Morrisons day-0 £89.46 shown vs £89.47 summed; day-0 header £183.06 vs £183.07). Recorded, not normalized.
- **Fortnight economics:** £179.31 + £8.58 = **£187.89 / 14 days / 2 people = £6.71 per person-day** (every figure carries its divisor in plan.json).

## Decisions queue — 34 entries (31 resolved-by-default, 3 OPEN)

Full detail with evidence: `data/decisions-queue.json`. Any default is overturnable now.

**D10 rulings applied (the batch you pre-approved, now with verified numbers):**
| id | ruling |
|---|---|
| D0-001 | Retire milk, egg_white, whey, edamame, mango → retired.json (referenced nowhere in any meal) |
| D0-011 | Three avocado garnishes dropped (methods = plate truth) — with the compensating oil increases, numbers cited |
| D0-012 | Week-B Fri breakfast is scrambled eggs on toast, no salmon (verified diff, grams cited) |
| D0-013 | **Bonus find:** two additional Week-B batch/fresh tag diffs beyond what PLAN documented — methods wins per D10 |
| D0-022 | Week-B cottage-cheese-pineapple snack sanctioned (tinned chunks) |
| D0-026 | Targets re-banded per week from actuals — four independent bands (A/B × her/him) replacing the single shared pair |

**The seven §4 content defects (D0-014…D0-021):** all verified present with cited evidence; data kept as-extracted; fixes land in the Phase 1 rewrite. Highlights: cabbage reconciles 335+180=515 g exactly (Fri-dinner slaw is the omitted third consumer); both Week-B oil inversions confirmed; kofta's 40 g onion lives in the Sunday op but not the card table; chicken yield 600 g vs 575 g consumer demand (25 g headroom).

**Extraction judgment calls (all evidence-backed):** peppers raw/frozen SKU split (D0-004); second shared-SKU pair discovered — frozen mixed berries covers raspberries+blueberries (D0-006); 20+ stale FD-5 prices never used for SKUs (D0-007); storage classes derived mechanically from the 5 distinct day-0 pill strings (D0-028); a-twice calendar methodology incl. pass-2 bring-downs (D0-025, post-fix); prep op-ingredient table hand-built (D0-032); Week-B session 75 min derived vs "eighty minutes" prose — both kept (D0-033).

**OPEN items needing your ruling (none block Phase 1):**
1. **D0-003** — sweetheart cabbage & rapeseed oil have real substitution rules in prose ("where the gem is only shredded" / "everything that hits a hot pan") but no meal-level linkage was guessed. Reviewer rec: leave unlinked; revisit in Phase 1 when steps get per-step oil attribution.
2. **D0-030** — `name.canonical` derived as display-name-truncated-at-comma. Reviewer rec: keep; revisit only if search/filter needs more.
3. **D0-031** — `sku.verifiedOn` is null everywhere (no verification dates exist upstream). Reviewer rec: populate only from real future price-check events, never backfill guesses.

## Next: Phase 1 (methods rewrite)

Two Sonnet rewriters (Week A / Week B) + one Fable content reviewer; four owner approval batches (A: Sun+Mon–Wed, A: Thu–Fri+snacks, B: same split) rendered as old-vs-new review pages. The seven §4 defects get fixed in the rewrite; seasonings get weights; every step timed or flagged; batch cards get `batchTakeG`.
