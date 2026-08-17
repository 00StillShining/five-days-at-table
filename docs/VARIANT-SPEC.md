# Plan-Variant Specification — "Morrisons Starter" tester (orchestrator-authored, binding)

Purpose: the owner's hand-authored tester (FD5-Menu-Morrisons.html + FD5-Shopping-List-Morrisons.html, archival sources in the project root) becomes a first-class **plan variant** the whole app follows. Variants are additive: the full fortnight remains the default; nothing about the canonical dataset changes.

## Source facts (verified by orchestrator checksum)

- 39 basket lines, £69.83 exact (COSTS array agrees), one retailer (Morrisons), all prices verified 2026-08-11 per the document.
- 10 kept meals, Week A only: Mon b/l/d · Tue b/l/d · Thu b+d · Fri l+d. Cut with stated reasons: all Wednesday (plantain; efo riro also egusi), Thu lunch (edamame spaghetti + turkey breast mince unstocked), Fri breakfast (plantain). **Snacks: all five absent from the tester** (no snack ingredients in the basket — bananas/apples/suya dip lines don't exist). Cut = cut, per the owner's document.
- Substitution notes that matter for mapping: ONE yoghurt tub covers greek_yog + skyr lines; savers mozzarella; Loyd Grossman grated for parmesan; cheddar SLICES 100 g; chicken breast 630 g pack (vs 575 g need); raw peppers only (no frozen split); wonky berries covers raspberries+blueberries; sweetcorn frozen 800 g; small EVOO 250 ml; small peanut butter 340 g.
- The menu file's prose is a SUMMARY of the old tool's methods (it still mentions whey in the pancakes). The app's approved rev-B methods remain the truth — do NOT import menu prose. Kcal figures in the menu are pre-seasoning legacy numbers; the app's recomputed macros win. Record both facts in the variant data as provenance notes, not errors.

## Data contract — `data/variant-morrisons.json` (emitted by the extraction pipeline, re-runnable)

```jsonc
{
  "id": "morrisons-tester",
  "label": "morrisons starter · 10 meals",
  "week": "A",
  "slots": {
    "kept": ["a-d1b","a-d1l","a-d1d","a-d2b","a-d2l","a-d2d","a-d4b","a-d4d","a-d5l","a-d5d"],
    "cut": [ {"mealId": "...", "reason": "verbatim-ish reason from the source"} ]   // 5 b/l/d cuts + 5 snacks ("not part of the tester week")
  },
  "targets": { "A": { "w": {...}, "m": {...} } },   // D0-026 method over the FOUR kept days' recomputed totals (rev-B macros), min–max rounded outward
  "basket": {
    "retailer": "M",
    "verifiedOn": "2026-08-11",
    "totalP": 6983,
    "lines": [ { "ingId": "...", "label", "product", "packG", "qty", "priceP", "aisle": "source aisle heading",
                 "tags": ["text..."], "note": "verbatim", "storageClass": "freeze-on-arrival|freezer-aisle|counter|fridge|cupboard (derive from tag text)",
                 "coversAlso": ["skyr"]? } ],        // the shared-tub / wonky-berries style lines
    "putAway": [ {"heading","body","where"} ]        // "The moment you get home" card verbatim
  },
  "coverage": {   // computed audit, not hand-authored:
    "coveredByBasket": [...ingIds], "assumedPantry": [...], "missing": [...]   // kept meals' rev-B covers vs basket; freebies+spice-jar ingredients (suya/jerk/adobo/shawarma etc.) classify as assumedPantry, never silently ignored
  },
  "defrost": [ {"dayNo": 4, "ingId": "salmon", "g": 220, "move": "freezer → fridge", "note": "..."} ],  // derived: freeze-on-arrival lines needed on Thu/Fri get a bring-down the evening before; Mon/Tue-needed meat gets "keep out on arrival" notes in putAway instead
  "prep": { "sessionBase": "prep-a", "keptOps": [...op indices/clocks], "note": "ops whose yields feed no kept meal are dropped; grams stay as authored (630 g pack vs 600 g op text noted)" },
  "economics": { "total": "£69.83", "meals": 10, "perMeal": "£6.98 (both covers)" },
  "anomalies": []
}
```

Validation (vitest, alongside existing suites): 39 lines, pennies-exact £69.83; every line maps to a known ingId (extend the alias map — zero fuzzy, stop-on-uncertain); kept-slot ids exist and are exactly the 10; coverage.missing is REPORTED (expected near-empty; spice jars → assumedPantry); targets recompute deterministically.

## Runtime contract (state/app)

- New pref `planVariant: "full" | "morrisons-tester"` (default "full"), set from the settings drawer (a two-position control near week/cover semantics; label "plan · full | starter"). Persisted in fd5.v1.prefs (schema-migration-safe: absent → "full").
- A single variant module (`src/data/variant.ts`) exposes `activeVariant(state)` → {slots kept/cut with reasons, targets, basket, defrost, prep filter} — **every consumer reads through it**; "full" returns the canonical shapes so existing code paths stay identical when full is active.
- Variant-aware behavior when tester is active:
  - `effectiveMealForSlot`/`mealsByWeekDay`-driven surfaces: cut slots resolve to null with a reason.
  - TODAY: Wednesday renders an explicit "off in the tester" state (reason shown); cut slots don't render tick buttons; ladders/bands use variant targets; dutyStack uses variant defrost + kept meals only.
  - PLAN: board renders cut slots as quiet "cut · reason" cells (non-color second cue); week roll-up + gauge use variant targets; swap deck hidden for cut slots (nothing to swap into a cut slot in tester mode).
  - COOK: picker lists kept meals only + the reduced "starter Sunday session" (prep-a ops filtered per data contract); full sessions hidden in tester mode.
  - SHOP: the trip IS the authored basket verbatim (single Morrisons column; no day-7 toggle in tester mode; **no have-list dedupe** — the tester is an on-ramp first shop; note rendered saying so); totals from the basket; all lines verified (no ≈ marks, no verify nominees — arbiter's verify class idles); send-to-phone/tripCodec unchanged (kind may stay "full").
  - LIST: receives the tester trip through the same codec — no changes expected beyond what SHOP encodes.
  - STORES: register unchanged (it's ingredient-level); coverage strip ranks kept meals first in tester mode (others still listed, marked "not this week").
- Bands/arbiter: over/under-band judgments use variant targets; nothing screams "under band" because the tester runs lighter — the targets ARE the tester's own days.
- All §6.1 accessibility law, screen leans, and the polish layer untouched. No new deps.

## Review gate

Fable review before deploy: data checksums + mapping spot-checks against the source HTML; rendered variant walk (switch to starter → TODAY Wed off-state, PLAN cut cells, COOK picker, SHOP basket totals + QR → LIST intake, ladders vs new targets); regression walk with variant OFF (full mode byte-identical behavior); tests green.
