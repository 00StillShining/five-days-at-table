# Phase 1 Rewrite Specification (orchestrator-authored, binding for all Phase 1 tasks)

Purpose: PLAN §4 executed as data. Rewritten methods live as **overlay files** consumed by `join.js` — the pipeline stays re-runnable; `data/meals.json`/`data/prep.json` remain generated artifacts.

## File layout

```
data/rewrites/<mealId>.json      one per meal (a-d1b … b-d5s), 40 total
data/rewrites/prep-a.json        Week A Sunday session rewrite
data/rewrites/prep-b.json        Week B Sunday session rewrite
data/rewrites/_ingredients.A.json  new seasoning/oil ingredient records + freebie flags (Week A rewriter)
data/rewrites/_ingredients.B.json  same (Week B rewriter)
tools/extract/owner-rulings.json   Phase 0 checkpoint rulings overlay (mechanism builder)
tools/extract/approvals.json       owner batch approvals; join flips approved only from here
```

## Meal rewrite schema — `data/rewrites/<mealId>.json`

```jsonc
{
  "mealId": "a-d1b",
  "rev": "B",
  "covers": { "w": {"ingId": grams, ...}, "m": {...} },   // FULL table incl. seasonings & oil splits
  "freebies": ["ingId", ...],                              // zero-cal items used (must exist w/ freebie:true)
  "steps": [ { "n": 1, "text": "…", "minutes": 2|null, "tempC": 200|null,
               "track": "pan"|"oven"|"prep"|null, "clockStart": 0|null,
               "station": "hob 1"|null, "untimed": true /* only when minutes null by design */ } ],
  "why": "<verbatim original — byte-identical after whitespace collapse>",
  "batchSource": "prep-a"|null,
  "batchTakeG": { "w": g, "m": g, "total": g }|null,       // batch cards only
  "notes": ["rewriter remarks for the reviewer"]
}
```

Step semantics: `minutes` = duration of the step itself. Multi-component meals (every multi-track dinner) use `track` + `clockStart` (elapsed minutes from meal start — the Sunday-run-order structure); single-pan meals may leave both null and read sequentially. `untimed: true` is an explicit declaration, never a default.

## Rewrite rules (PLAN §4, the D10/§4 defects, and the owner's D0-003 ruling)

1. Every step timed (`minutes` and/or `tempC`) or explicitly `untimed`. **Every oven/air-fryer/grill step has `tempC`** (fan temps as the originals use).
2. Multi-component meals get parallel tracks with elapsed clock (`track` + `clockStart`), structured like the Sunday run-orders.
3. Every ingredient row's her/him grams restated in the step where used — formats: `(100/120 g)` her/him, `(100 g)` when equal, or `her 100 g / him 120 g`. Split usages (the 17 split-oil cases) state each portion and must sum to the table.
4. Batch cards state the take: `batchTakeG` computed from the consuming meal's covers vs the prep yield ("of Sunday's ~1,010 g bolognese, take 490 g her+him").
5. Seasonings get weights and enter `covers` (comps via `_ingredients.<week>.json`, standard reference values, flagged `addedInContentPass: true`). Zero-cal items (salt, most dried herbs at these masses, hot sauce ≤ trace) go on `freebies` and get `freebie: true` in their ingredient record.
6. `why` blocks verbatim; the voice of the original steps preserved — terse, imperative, concrete ("Non-stick pan, dry, medium-high"), no recipe-blog filler.
7. **Defect fixes (queue-ruled):** D0-014 cabbage 515 g (Sunday op + all three consumers); D0-015 oil inversions corrected (him ≥ her); D0-016 pancake skyr wording quantified; D0-017 pizza "remaining oil" states grams; D0-018 kofta onion 40 g enters the B-4-Lunch table (per-cover split consistent with the 255 g mince tray op); D0-019 egg count resolved cleanly; D0-020 yields either tightened to consumer demand or headroom stated explicitly in the op text.
8. **Substitution linkage (owner ruling on D0-003):** oil that hits a hot pan = `rapeseed_oil`; finishing/dressing oil = `olive_oil` — split rows accordingly wherever both uses occur. Little gem → `sweetheart_cabbage` only where the gem is *shredded* (not where leaves are used whole). Apply per meal where the condition holds; note each application in `notes`.
9. New/changed grams beyond the ruled defects are FORBIDDEN — this is a rewrite for timing, structure, and the ruled fixes, not a re-plan. Uncertain? File a decision-request, never guess.
10. Sessions (`prep-a/b.json`): same op schema plus `minutes` per op, structured `ingredients: [{ingId, g}]` per op, yields with explicit headroom notes where D0-020 applies, midweek notes carried over.

## Lint contract (what `npm run validate` will enforce after the mechanism lands)

L1 every step minutes|untimed · L2 oven/grill ⇒ tempC · L3 every covers ingId's grams restated in ≥1 step (both covers) · L4 split usages sum to table · L5 batch cards: batchSource + batchTakeG consistent with prep yields (exact, or headroom documented in the yield) · L6 why verbatim vs original · L7 macros recompute from covers (automatic in join) and every changed-vs-Phase-0 covers entry traces to a ruled defect, a seasoning addition, or the D0-003 substitution split · L8 multi-component dinners ≥2 tracks with clockStart coverage · L9 covers reference only known ingredient ids (base + _ingredients merges; conflicting duplicate ids across A/B files fail validation) · L10 `approved` is set by `approvals.json` only.

## Owner approval batches

`a1` = prep-a + A Mon/Tue/Wed b·l·d (9 cards) · `a2` = A Thu/Fri b·l·d (6) + all 5 A snacks · `b1`/`b2` = same split for B. Review pages: `tools/review/render-batch.js` → `docs/review/batch-<id>.html`, plain utilitarian old-vs-new (original prose + grams vs rewrite + recomputed macros, changes highlighted). Not Sol-styled — it is a review artifact, and Phase 1 merges no polish.
