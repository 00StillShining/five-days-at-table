# PLAN.md — FD-5 Meal System Dashboard
*Produced by a planning session on 2026-08-04, delivered with `design-reference-atlas-5.6-sol.md`. Execute cold with the §7 multi-agent model; begin at §9 step 1.*

---

## 0 · Context

FD-5 is a meal plan for two people — **optionally rotating, with Week A as the focus** and Week B (same ingredient pool) as the variety/swap layer — "her" cover at 70 kg and "him" cover at 85 kg — costed against real UK supermarket prices across Morrisons, Sainsbury's, and Lewisham market. It currently lives in six hand-authored HTML files that have drifted apart: four documented plate changes exist only in some files, three files model three different shopping horizons, and the prep methods (the known weak point) are well-written prose rather than reliable timed instructions.

This plan builds **an interactive dashboard that supersedes those files**: meal showcase, cook-along with timers, batch-prep guidance, storage/shelf-life tracking with use-by countdowns, fast inventory, stock-driven Week B swaps, and a dedicated mobile shopping layout. Retailer basket handoff is **deferred** (owner decision D9; research preserved in Appendix A).

Design law is **Design Reference Atlas 5.6 Sol** (`design-reference-atlas-5.6-sol.md`, supersedes v1.0). Its Production Contract (§5), anti-patterns (§4.6), and Release Rubric (threshold 85/100) are binding acceptance criteria — **but its originality/distance-test rules are waived (owner decision D14): this is a personal-use product and brand signatures SHOULD be used** where they serve the design. Every "hardware" flourish in this plan is a **Default or Signature option under Sol §0.4 — user comprehension, accessibility, and task completion override it**.

**Execution model (owner decision D12): the build is carried out by Sonnet 5 builder agents working under Fable 5 reviewer agents** — builders implement scoped tasks; Fable reviewers review every deliverable, keep multiple agents' work coherent, guide difficult decisions, rescue struggling tasks, and hold the quality bar. **UI/UX is the declared focus of the effort** — design review is a first-class gate, not an afterthought. Protocol in §7.

**Build session (orchestrator): read this entire plan, the atlas, §7 (execution model), and §9 (owner checkpoints) before writing any code.**

---

## 1 · Decisions log (owner's answers — the builder inherits these; do not re-ask)

| # | Decision | Ruling |
|---|---|---|
| D1 | Stack | **Vite + React, single-file build** (vite-plugin-singlefile). Componentized dev; build emits one self-contained HTML file. Data in separate JSON at dev time, compiled in at build. |
| D2 | Phone delivery | **Free static hosting** (Netlify or GitHub Pages). Phone bookmarks the URL. localStorage per device; the shopping list travels desktop→phone in the URL fragment (compressed, lz-string); check-off state lives on the phone. |
| D3 | Cook-along device | **Both desktop and touch** — genuinely adapted layouts for each. |
| D4 | Extras | All four in scope: cook-from-stock suggester, day/week macro roll-up vs bands, leftovers & waste log, price re-verification tracker. |
| D5 | Canonical plan cycle | **"Week A, twice" fortnight** (matches `FD5-Shopping-List.html`, £179.31 + £8.58 day-7). Week B stays first-class in the data as the **swap/variety pool** (and possible future rotation). The A+B fortnight and 3-week baskets remain computable variants. The existing defrost calendar was authored for A+B — **Phase 0 must regenerate it for A-twice from data**. |
| D6 | Navigation | **Loop rail + cycle cursor**: five fixed mode keys (today · plan · cook · stores · shop); a small cursor dot suggests the week's station (Sat→shop, Sun→cook, weekdays→today), never reorders or hides anything. COOK enters a lid-closed state (rail collapses to one exit tab). |
| D7 | Screen layouts | TODAY = **Duty deck**. COOK = **Tape timeline + reel** (stopped-reel-as-alarm). LIST = **Till odometer, spend-first** (+ `next ▸` aisle-jump). STORES = **Level thumbwheel, fuzzy 5-detent inventory**. |
| D8 | Mobile shopping surface | **Light** (unanimous across drafts: dark UIs mirror under 750–1500 lux store lighting; dark stays reserved for COOK). |
| D9 | Retailer basket handoff | **Skipped — build later, not needed now.** No retailer integration work in any phase. Research preserved in Appendix A for a future session. |
| D10 | Data conflicts (~30) | **Accept recommended defaults in batch**: Methods files are plate-truth (salmon→eggs Fri-B breakfast; three avocado garnishes dropped); purge whey + vestigial ingredients (milk, egg_white, edamame, mango) to `retired.json`; amend the pineapple rule to sanction the Week-B cottage-cheese snack (tinned chunks, griddled); re-band macro targets per week from actuals; fix the seven arithmetic bugs (§4.7). Full ledger stays in `decisions-queue.json`, presented for skim-review at the Phase 0 checkpoint where any item can be overturned. |
| D11 | Design law | **Atlas 5.6 Sol** replaces v1.0. Key consequences: functional labels 13–16 px relative (9–11 px only for nonessential engraving); color never carries meaning alone (second cue mandatory); no drag-only interactions (every dial/wheel/reel needs keyboard + stepper/typed alternatives); 44×44 CSS px minimum targets (house target); reduced-motion and forced-colors behavior specified. |
| D12 | Build execution model | **Sonnet 5 builder agents working under Fable 5 reviewer agents.** Builders (`model: "sonnet"`) implement scoped tasks. Fable reviewers (`model: "fable"`) review every deliverable before merge, ensure the work of multiple agents integrates coherently, guide builders through difficult decisions, take over tasks builders struggle with, and keep the standard of quality HIGH — **UI/UX above all; it is the focus of the effort**. Full protocol in §7. |
| D13 | Style mixing | **A cohesive mix of the atlas's two languages, with every screen leaning more heavily toward a single style.** Cohesion comes from one chassis, one token system, one type system, and app-wide semantic accent roles; the per-screen dominant-language table lives in §6.0. App-level blend stays ≈70% playful-technical / 20% precision-industrial / 10% project identity (Sol §1C). |
| D14 | Brand signatures | **Use them.** Personal-use product: Sol §6 originality rules, the distance test, and the rubric's one-brand-imitation hard gate are **waived**. Recognizable hardware signatures (TE palette character, TP-7 reel identity, OP-1 chassis feel, silkscreen voice) are encouraged where they serve the task. Still binding: asset licensing (fonts/icons), no third-party logos or wordmarks in the UI, and every Sol accessibility/usability gate. |

---

## 2 · Source files: what they are and what wins

All paths relative to `FD5 Two Weekly Meal Plan/`.

| File | Role | Trust |
|---|---|---|
| `FD-5.html` | Main tool. **Line 303** holds the entire dataset: `const D = {…};` — strict machine-generated JSON (strip the 10-char `const D = ` prefix and trailing `;`, then `JSON.parse`). | Canonical for **ingredient identity (the only stable IDs), macro composition, household units, aisles, targets, notes**. Its prices are STALE (26/54 disagree with newer files); its Week B methods are 20 identical placeholder strings; its Week B origin/time/tag metadata is copy-pasted from Week A (do not trust). |
| `FD5-Week-A-Methods.html`, `FD5-Week-B-Methods.html` | The 40 recipe cards + two Sunday run-orders. Static HTML, zero JS; body is ONE giant line — DOM-parse (cheerio), never line-oriented tools. | Canonical for **meals, per-cover grams, weight states, method steps, "why" blocks, batch/fresh flags, per-meal macros, origins, times**. Carry the four documented plate changes. |
| `FD5-Provisioning.html` | Provisioning document. Static, body one mega-line. | Sole source for **storage register (54 items: shelf life + location + note), A+B defrost calendar (10 dated ops with grams), NEED-vs-BUY, price-check provenance, freezer-load figures**. |
| `FD5-Shopping-List.html` | Newest file (Aug 3). Interactive tick list, 55 rows. | **Canonical basket (D5: "Week A, twice", £179.31 + day-7 £8.58)** — prices, pack sizes, product strings, purchase quantities. Zero estimate flags (must be back-joined). Short names — needs the alias map. |
| `shopping-list.html` | Oldest list; 3-week Week-A basket (£257.32). | Legacy. Checksum only: its 54 lines and est flags match FD-5.html `D.prices` exactly. |
| `README.md` | System logic + "decisions worth remembering". | Canonical for intent and constraints; stale on data. |
| `archive/` | Superseded. Ignore. |
| `design-reference-atlas-5.6-sol.md` | Design law (currently at `~/Downloads/`; copy into the project). §4–§9 binding. | — |

### Verified format facts the parser must honor
- `D.food[id]` is positional per-100 g: `[kcal, protein, FIBRE, carb, fat]` — **fibre at index 2, before carb**. Net carb = carb − fibre; derive, never store.
- `D.spec[id]` is `[displayName, weightState, householdUnitGrams|null, unitSingular, unitPlural]`.
- `D.prices[id]` is `{shop: S|M|X|H, name, pack(g), price(£), ver: 0|1}` — `ver:0` = estimate. Shop `H` and `ver===2` are dead code paths; ignore.
- Methods cards: `div.card` ×20/file. Batch/fresh lives in the **class** of the first chip (`chip.batch`/`chip.fresh`), not its text. Ingredient rows: `td.n.her` / `td.n.him`; the 87 countable-unit hints are `<span class=u>` — **unquoted attribute** (a `class="u"` regex silently loses all of them) and sit in the HIM cell only. Macro strips: `span.v` as `VALUE<i>LABEL</i>`, 5 per cover, order kcal/protein/net carb/fat/fibre.
- Week B methods file has an extra `div.sechead` ("00b Not on Sunday") **inside** section 00 — 7 secheads vs Week A's 6. Don't slice on sechead count.
- Provisioning: estimate marker is a **sibling** span inside the cost cell (`£8.50<span class="est"> est</span>`) — take the first text node. Six items appear in BOTH day-0 and day-7 tables (cottage cheese, tomatoes, little gem, pineapple, cucumber, spring onions) — naive summation double-counts. The day-7 table has **no shopbar**; a parser splitting on shopbar attaches its rows to Lewisham. They are Morrisons items.
- `FD5-Shopping-List.html`: `const COSTS` (line 108) is positionally aligned to `.row` DOM order — treat as a checksum only (sums to exactly £179.31). Storage-tag class `t-bl` carries TWO meanings ("Freeze on arrival" and "Freezer aisle") — key on tag TEXT, never color class. `class="note"` is used by both row notes (div) and shop blurbs (span) — select by tag.
- Numbers: comma thousands separators ("2,040 g"); multiplication sign U+00D7; shelf-life strings use `·` separators, `–` ranges, `→` in locations. Decode HTML entities everywhere.
- **Join spine** (verified 281/281 rows, zero conflicts): Methods-file ingredient display names map 1:1 onto `D.spec[id][0]` by exact string. Build this join FIRST. `FD5-Shopping-List.html`'s 55 short names have NO shared key — hand-write the ~55-entry alias map. Known traps: "Basa fillets"="Catfish or tilapia fillet", "Red lentil penne"="Edamame spaghetti", "Frozen cauliflower florets"="Cauliflower, riced", "Frozen leaf spinach"="Spinach, ugu or callaloo", "Low-carb wraps"="Tortilla, high-protein low-carb".
- Greek yoghurt + skyr: two logical ingredients, ONE shared SKU (`sharedSkuWith`); never dedupe the ingredients, always merge the shopping line.
- Estimate flags: base layer = `D.prices[id].ver`, overlay = Provisioning's `est` spans (19 items differ; overlay wins — newer). Record `estimateSource`.
- Three shopping lines have no ingredient/macro/meal anywhere (sweetheart cabbage, frozen sliced peppers, rapeseed oil) — Phase 0 must create ingredient records for them (composition from standard reference values, flagged `addedInExtraction: true`) and map frozen-sliced-peppers vs fresh peppers to cooked vs raw uses.

---

## 3 · Phase 0 — Data extraction

Goal: one canonical dataset the dashboard reads; nothing invented silently, every conflict surfaced.

**Parsers (Node, `tools/extract/`, re-runnable) emit `data/*.json`:**
1. `fd5.js` → lift `D` from FD-5.html line 303: ids, `food`, `spec`, `aisle`/`aisleName`, `targets`, `shops`, `days`, `themes`, `train`, `notes`, `prep` (Week A), meal skeletons.
2. `methods.js` → both Methods files: 40 cards (steps, why, chips, per-cover gram tables, unit hints, mac strips), 2 Sunday sessions (ops with elapsed clock + station, yield tables incl. storage column, midweek notes).
3. `provisioning.js` → storage register (54 rows), A+B defrost calendar, day-0/day-7 NEED+BUY+cost+pill per item, price-check/swap provenance.
4. `shoppinglist.js` → 55 rows from FD5-Shopping-List.html + day-7 card + put-away card; parse legacy shopping-list.html only to cross-check est flags against `D.prices.ver`.
5. `join.js` → merge per the §2 trust table, apply the D10 batch rulings, emit the §5 dataset plus:
   - `data/validation.json` — checksums below, pass/fail;
   - `data/decisions-queue.json` — all ~30 conflicts as `{id, topic, detail, options, recommendation, status: resolved-by-default|open, resolvedTo}` — **nothing resolved silently; D10 defaults are recorded as rulings, reviewable**;
   - **regenerated defrost calendar for the A-twice variant** (computed from meal schedule + storage register + freezer stock; Provisioning's A+B calendar retained as variant data).

**Validation checksums (all must pass before Phase 1):**
- 40 cards, 20/week; every card 2×5 macros and ≥3 ingredient rows. Methods↔`D.spec` join 281/281.
- Recomputed macros (grams × `D.food`) match every mac-strip value ±1 unit (±0.2 fibre) on the 36 undisputed cards.
- Week A day totals (her): 1667/1663/1670/1646/1694 kcal. Week A ×3 reproduces £257.32 (S £102.58 / M £145.24 / X £9.50) from legacy data. `COSTS` sums to £179.31 and per-shop subtotals match (S £72.70 / M £98.31 / X £8.30).
- 54 storage-register rows all carry shelf-life + location; alias map covers all 55 short names, zero fuzzy matches.

---

## 4 · Phase 1 — Content pass (methods rewrite)

Audit findings driving this phase: only 47% of the 210 steps carry any time/temperature; oven temps on 6/40 cards; zero parallelism markup (multi-component dinners read as flat lists); batch-reheat lunches near-unusable standalone (no portion size against ~1 kg Sunday batches — worst: A-Thu bolognese, B-Wed turkey stew, A-Wed efo riro, B-Thu kofta); 32 ingredient rows never appear in their own method text; ~40 unweighed seasonings (honey, sugar, soy, mirin, adobo, coconut, suya carry real calories — every macro strip slightly underestimates).

**Rewrite all 40 methods (Week B included — it's the swap pool) to this bar:**
1. Every step timed (`minutes` and/or `tempC`) or explicitly `untimed`. Every oven step has a temperature.
2. Multi-component meals get **parallel tracks with an elapsed clock** — the structure the Sunday run-order already does well; COOK consumes it directly.
3. Every ingredient row's her/him grams restated in the step where used — including the 17 split-oil cases ("4 g now, 5/7 g at the plate").
4. Batch cards state the portion: "of Sunday's ~1,010 g bolognese, take 490 g (her+him)" — computed from gram tables.
5. Seasonings get weights and enter the macro model; zero-cal items on an explicit `freebies` list; mac strips corrected.
6. Keep the `why` blocks verbatim (the best prose in the system) and the voice of the originals.
7. **Known defects to fix (D10-ruled):** Week A Sunday shreds **515 g** red cabbage, not 335 g (Fri-dinner slaw omitted); Week B oil inversions (d2d her 12/him 10 g, d4l her 10/him 8 g); pancake "half the skyr" arithmetic; pizza "remaining oil" wording; kofta onion (40 g) missing from any table; boiled-egg count (2 vs 2.5); yield roundings (chicken 600 vs 575 g, chickpeas 250 vs 245 g).

**Review checkpoint (hard gate):** rewritten meals go to the owner in four batches (A: Sun+Mon–Wed / A: Thu–Fri+snacks / B: same split), rendered as a plain old-vs-new review page. Owner approves each batch. **Phase 2 may display only approved methods; unapproved cards show original prose tagged `rev A`.**

---

## 5 · Data model spec

Static data in `data/*.json`, schema-checked (zod) at build. UI contains no food facts.

```
ingredients.json  [{ id, name: {display, short, canonical}, aliases[],
                     per100g: {kcal, protein, fat, carb, fibre},
                     spec: {weightState, householdUnitG|null, unitSingular, unitPlural},
                     aisle, freebie: bool, addedInExtraction?: bool,
                     storage: {class: buy-once|freeze-day0|buy-frozen|stagger|topup,
                               location, note,
                               life: {sealedDays?, openDays?, frozenDays?, freshDays?, prose}},
                     sku: {shop: S|M|X, product, packG, price, estimate: bool,
                           estimateSource, verifiedOn|null, sharedSkuWith|null} }]
meals.json        [{ id (a-d1b … b-d5s), week, day, slot, name, origin, tag: batch|fresh,
                     activeMin, covers: {w:{ingId:g}, m:{ingId:g}}, macros: {w,m},
                     method: {steps: [{n, text, minutes|null, tempC|null, track|null,
                                       station|null, clockStart|null, untimed?}],
                              why, batchSource|null, batchTakeG|null, approved: bool, rev} }]
prep.json         [{ week, sessionName, totalMin, ops: [{clock, title, body, station,
                     ingredients: [{ingId, g}]}],
                     yields: [{component, qty, consumers: [mealId], storage}], midweek: [...] }]
calendar.json     [{ variant: a-twice|a+b|3-week, day, weekday, phase, title,
                     items: [{ingId, g, move}] }]      // a-twice regenerated; a+b preserved
plan.json         { variant: "a-twice", targets: {A:{w,m}, B:{w,m}},   // re-banded per week
                    shops, days, themes, train, notes,
                    economics: {labeled divisors only — every £/day figure names its basis} }
decisions-queue.json  [{ id, topic, detail, options[], recommendation, status, resolvedTo }]
```

**Runtime state (localStorage, versioned `fd5.v1.*`, JSON export/import from a plain settings drawer):**
`inventory` {ingId: {level: 0–4, updatedAt}} (D7: fuzzy five-detent), `eaten` log, `shopTicks` (keyed ingId+tripId, never DOM order), `leftovers`/`waste` events {ref, g, £, date}, `priceChecks` {ingId: {price, on}}, `timers` (active COOK program — timestamp-based, survives reload/lock), `prefs` (cover, week, scale).

---

## 6 · Design system & screen-by-screen UX spec

### 6.0 Sol worksheet (atlas §7, filled)

- **Product:** FD-5 meal dashboard · **Users:** two adults, one household · **Primary task:** run the weekly loop (shop → batch-cook → cook/log → restock) · **Platforms:** desktop web + phone (supermarket, kitchen) · **Density:** medium · **Accessibility target:** WCAG 2.2 AA.
- **Dominant language:** playful-technical; precision-industrial borrowed for COOK's dark surface and the per-screen crafted control (≈70/20/10).
- **Reference 1 — structure: OP-1 field.** Borrow: fixed chassis + one coherent scene per mode + 3–4 stable semantic channels. D14: its palette character and color-to-parameter idea may be quoted openly.
- **Reference 2 — interaction: TP-7.** Borrow: state belongs to the control (reel motion = program state). D14: the black-body/orange-dot reel identity may be quoted directly.
- **Reference 3 — surface/character: Braun ET66 / Beogram 4000.** Borrow: repeated quiet geometry, calm control horizon, exceptions create hierarchy. D14: faceplate character may be quoted.
- **Project signature: the attention arbiter** — app-wide, each screen has exactly ONE "act-now" slot; all urgency competes in a priority queue (expired > defrost-overdue > timer-due > over-band > verify-nominee > primary action); runners-up render quiet with a queue count and inherit the slot when rank 1 clears. Fallback: the slot is a plainly styled banner; reduced-motion: no pulsing, static chevron. *(Sol note: this is a composition heuristic — semantic danger/warning/success states keep their distinct tokens and second cues everywhere.)*
- **Originality (amended by D14):** no distance test — this is a personal instrument and may wear its influences proudly. Only third-party logos/wordmarks and unlicensed assets stay out.

**Per-screen dominant language (D13).** The app reads as ONE instrument because the chassis, tokens, type system, and accent semantics never change between screens. Within that constant frame, each screen leans clearly toward a single Sol language — the lean is expressed through its hero's material character, label treatment (silkscreen lowercase vs engraved caps), and depth model:

| Screen | Leans | Borrowed accent (~20%) | How the lean shows |
|---|---|---|---|
| TODAY | playful-technical | precision | LED ladders + day pads, toy-serious grid; engraved band brackets on the console are the precision note |
| PLAN | playful-technical | precision | flat fortnight board, silkscreen labels; the needle adherence gauge is the one precision object |
| MEAL | playful-technical | precision | friendly card, household hints; the machined portion knob is the one precision object |
| COOK | **precision-industrial** | playful | dark instrument panel, engraved caps, honest depth, the reel; the completion status scene is the single playful touch |
| STORES | playful-technical | — | thumbwheel + level pips, the most purely playful screen; countdown figures stay tabular-severe |
| SHOP | playful-technical | precision | calm console horizon (Beogram reading); the convex send-to-phone key and costed-column discipline are the precision notes |
| LIST | playful-technical | precision | paper-light utility list; the till odometer's drum digits are the one precision object |

Reviewer rule (enforced in every design review): a screen may not blend 50/50 — if a component's style allegiance is ambiguous, restyle it toward the screen's declared lean.

### 6.1 Tokens, type, accessibility contract

- Adopt Sol scoped tokens verbatim (`.sol-atlas`, atlas §4.2): light `data-language="playful"` for TODAY/PLAN/MEAL/STORES/SHOP/LIST; dark `data-language="precision-industrial"` for COOK. Metals/gradients appear only in the polish phase and only on hero controls.
- **Semantic accent roles** (each always paired with a second cue — shape, label, or position): `--sol-success` = settled/confirmed (ticks, done-dots, in-stock, verified, in-band); `--sol-focus`-family blue = the cursor (today ring, cycle cursor, playhead, running lane, focused row); `--sol-accent-fill` = the arbiter's single act-now slot; `--sol-danger/warning` = true error/warning states only. Estimates = ink `≈` + dotted underline, never a color alone.
- Functional labels 13–16 px relative, outside controls where composition allows but always programmatically associated (`<label>`/`aria-labelledby`, accessible name = visible text). 9–11 px mono reserved for nonessential engraving (serials, units on tick marks).
- Targets ≥44×44 CSS px everywhere; ≥56 px for LIST rows and COOK controls (wet hands). No swipe-only or drag-only meaning anywhere. All heroes have keyboard + button/typed alternatives (per-control contracts below). Reduced-motion: all mechanical motion (reel, odometer drums, thumbwheel) becomes instant state swaps with text equivalents. Forced-colors and 200% zoom behavior per Sol §4.2/5.2.
- Status scenes (one small idle animation per mode) are redundant decoration by contract: every state they express also exists as text.

### 6.2 Chassis & navigation (D6)

Persistent frame, hash-routed scenes: masthead (`fd-5`, date) + two global paddles — `week [a|b]` and `cover [her 70 | him 85]` — real `role="switch"` semantics, position+label coded, never color. Below it the **loop rail**: five fixed keys `today · plan · cook · stores · shop` (buttons, lowercase verbs, active = key-face depression + `aria-current`), plus the **cycle cursor** — a small blue dot under the station matching the week's rhythm (Sat→shop, Sun→cook, Mon–Fri→today, day-6 eve→stores); it suggests, never reorders (content may reorder; controls never). Desktop: rail top, keys ~48 px, hotkeys 1–5. Mobile: rail bottom full-width, 64 px keys, safe-area insets. COOK = lid-closed: rail replaced by one `exit ▸` tab (top-right), so wet hands can't mis-tap modes; a running program shows as a pulsing dot on the cook key elsewhere (plus text "cooking · 12:40" in the masthead — motion never sole cue). Depth: rail → scene → max one drill-in.

### 6.3 TODAY — duty deck (D7) · light

Answers "what does the system need from me right now."
```
 tue · week a · day 2        (1●)(2●)(3 )(4 )(5 )
 duty stack
  ▸ move 2× salmon  fz → fr    by 18:00    (done)
    use today · cooked rice    0d          (→ stores)
 tonight
  catfish pepper soup · start by 18:40     (cook →)
 ticks   (bfast ✓)(lunch ✓)(dinner  )(snack  )
 ─ console ────────────────────────────────
 kcal ▮▮▮▮▮▮▮▮▮░░░ 1240/1670   prot ▮▮▮▮▮▮░░  84/112
 fat  ▮▮▮▮░░░░░░░░   41/68     carb ▮▮▮▮▮░░░  71/120
```
- **Hero: the LED meter bridge** — four 20-segment ladders vs the active week's re-banded targets, exact `value/target` text beside every ladder (Sol gauge rule), band brackets engraved. Over-band: segments past the band render hollow; the arbiter slot names the worst macro in text.
- Duty stack rows: defrost moves due (from regenerated calendar), use-today expiries, tonight's start-by time (computed: serve time − method critical path; serve time a one-time pref). Each row: one-tap `done` (writes back to STORES/calendar) or a jump link.
- States: all-logged day → pad gains success dot; empty morning → duties only; nothing due → stack shows "nothing owed · next: sat shop" (explicit empty state).
- Mobile: identical order; console docks above the rail; pads horizontal scroll.

### 6.4 PLAN — the fortnight board · light

5×4 grid per week (paddle switches A/B), week-level roll-up, swap deck.
- **Hero: week adherence gauge** — needle dial per macro group with band board; exact numbers in a text table beside it (toggle-free, always present).
- Swap deck: Week-B (and cook-from-stock) candidates for any slot, ranked by stock coverage %, each showing band impact (Δkcal/ΔP) before committing; plain `◂ ▸` steppers, no scrubber. Committing a swap re-labels the slot (`swap` tag) and recomputes the day's ladders + shopping deltas.
- States: slot empty/planned/logged/swapped; over-band day column flagged in ink with text.

### 6.5 MEAL — drill-in card · light

Both covers side by side (macros + grams + household hints "½ avocado / 2 eggs"), in-stock marks per ingredient, rewritten method preview, `cook →`.
- **Hero: the portion knob** — flat circle + index dot, engraved 0.70–1.30 arc, 13 detents (0.05); live rescale of grams, macros, hints. **Contract:** `role="slider"` with arrow keys/Home/End, flanking − + steppers (44 px), typed value; readout `×1.00` outside the knob. (This is the existing tool's proven control, carried over; polish phase machines it.)
- Batch cards show `batchTakeG` prominently ("take 490 g of Sunday's 1,010 g batch").

### 6.6 COOK — tape timeline + reel (D7) · dark, lid-closed

One timed-program engine, two program types: single meals (from rewritten parallel-track methods) and the two Sunday batch sessions (ported from the existing elapsed-clock run orders).
```
 ◔ 05:32 (reel)    SMASH BURGER · 32:00    exit ▸
 NOW    FLIP THE BURGERS          0:45 ▾
 next   toast buns — starts in 1:20
 pan   ▓▓▓▓▓▓▓█▒▒▒░░░░░░░
 oven  ░░░░▓▓▓▓▓▓▓▓░░░░░░
 prep  ▓▓▓▓░░░┃░░░░░░░░░░   ┃ playhead
 [ +1 min ]  [         done ▸          ]
```
- **Hero: the reel** — spins while the program runs; **when a timer hits zero the reel stops — the stopped reel is the alarm** (plus an audible chime option and a text banner: motion is never the only cue; reduced-motion mode uses the banner + chime only). Drag-to-scrub previews ahead with spring-back; scrub also available via `◂ ▸` step buttons and keyboard.
- NOW line: verb-first, legible at 2 m (clamp ~44–56 px, high contrast); `done ▸` is the whole bottom edge (≥72 px). `+1 min` extends the current timer. Hold-to-pause in the opposite corner.
- Timers are timestamp-math (drift <1 s/30 min), persist through reload/phone-lock; wake-lock requested with fallback note. Completion writes meal ticks back to TODAY; finishing a batch session stamps its yields into STORES with computed use-by dates.
- States: standby (program loaded, reel still), running, step-due (arbiter: exactly one red element — the stopped reel dot/banner), paused, complete (tally scene + text).

### 6.7 STORES — register + fuzzy inventory (D7) · light

The 54-row register fused with live inventory: how much do we have, how long does it last.
```
 stores            roll to set ▸   ║
 fridge                            ║
 yoghurt 1kg    ▮▮▮▯▯   4d         ║
 eggs ×12       ▮▮▮▮▮   9d         ▓ ← wheel
 chicken thigh  ▮▯▯▯▯   low        ║
 freezer                           ║
 okra frozen    ▮▮▯▯▯   34d        ║
 ──────────────────────────────────
 from stock: efo riro 92% · katsu 85%
 restock queue · cumin · rice       waste log ▸
```
- **Hero: the count-in thumbwheel** — right-edge wheel; tap a row to focus, roll through five click-detents (empty·¼·½·¾·full). **Contract:** the five level segments are also directly tappable (44 px each), arrow keys adjust, level announced as text ("about half"). A 30-item stocktake ≈ 90 s; auto-advance to next row on set.
- Rows grouped by location (fridge/freezer/counter/cupboard from the register); each shows level + use-by countdown (from open/frozen dates + `life` fields; countdown text, color only as reinforcement). Expired/expiring items feed TODAY's duty stack and the arbiter.
- Leftovers & waste log lives here: logging dinner offers eaten/leftover/binned (≤3 taps); leftover creates a fridge row with computed countdown; binned records £ waste (monthly figure surfaces in SHOP).
- Cook-from-stock strip: meals ranked by coverage % against current levels (fuzzy levels → approximate matching, stated as "~92%").

### 6.8 SHOP (desktop) — Saturday console · light

Three costed columns (Morrisons / Sainsbury's / market ticket), rolling trip strategy (full shop vs day-7 top-up, carry-overs from inventory levels), have-list dedupe ("you're at ¾ on rice — skip"), price-verify nominations (2–3 orange-free `≈` items per trip), waste-cost readout, alternatives per ingredient.
- **Hero: the send-to-phone key** — one convex key that flips up a QR card + short URL (list + trip id in the compressed fragment); also copies the plain-text list to clipboard with visible-textarea fallback. (Replaces the deferred basket key as this screen's primary action.)
- Market items render as the **market ticket**: chrome-free 1-bit print/phone view, large type, guide prices.
- Trip lifecycle: build (auto from plan variant + inventory deltas) → send → in-store (LIST) → reconcile (ticked items and verified prices write back on next desktop open of the same trip URL... state returns via the phone's copy: keep reconciliation manual-first — a "read back" screen on the phone summarizing verify entries to type in; do NOT build sync infrastructure in phase one).

### 6.9 LIST (mobile) — till odometer (D7) · light

```
 morrisons · produce ●●○○○ 3/9 aisles
  ▢ plantain × 4            ~£1.80 ≈
  ▣ frozen spinach 1kg       £1.95
  ▢ avocado × 5              £3.25 [verify]
 ─ dairy ─────────────────────  3/9
  ▢ greek yoghurt 1kg        £2.10
 ═════════ thumb bar ═══════════════
 |mor▮sai|   £042.35 got 23/41  [next ▸]
```
- **Hero: the till odometer** — rolling digit drums total spend on every tick (reduced-motion: instant swap; value always plain text, `aria-live="polite"`).
- Rows: full-row targets ≥56 px; tick = success fill + `navigator.vibrate` + text dim (no heavy strikethrough) + row settles below unticked items within its aisle after a ~1 s undo grace; re-tap to untick. **No swipe gestures.** `next ▸` (thumb bar, right) jumps to the next aisle's first unchecked item. Two-position shop paddle mor|sai; market = ticket view. One `[verify]` nominee at a time (arbiter): tapping opens a big numeric pad to enter the shelf price, writing `priceChecks`.
- Works offline once loaded (single-file app + localStorage); list data arrives in the URL fragment; closing the shop (all ticked or explicit `close trip`) shows the trip summary + verify read-back.

### 6.10 Hero roster (one per screen, distinct mechanism families)

TODAY meter bridge (segment ladder) · PLAN adherence gauge (needle dial) · MEAL portion knob (rotary) · COOK reel (rotating platter) · STORES thumbwheel (edge wheel) · SHOP send-to-phone key (convex key + QR flip) · LIST till odometer (rolling digits). Each hero: justified by task frequency (Sol §4.1 "one hero" gate), full keyboard/stepper contract, named polish attach point.

---

## 7 · Build phases & multi-agent execution model (D12)

### 7.1 Roles

- **Orchestrator** — the build session itself (Fable 5). Decomposes each phase into task briefs, dispatches builders and reviewers, runs the owner checkpoints (§9), holds final integration authority. Never delegates owner-facing decisions to a subagent.
- **Builders** — **Sonnet 5** agents (`model: "sonnet"` on Agent/Workflow calls). Each gets one scoped task: one parser, one screen, one method-rewrite batch, one subsystem. Every task brief must contain: scope, inputs, the plan sections that define its acceptance criteria, the screen's §6.0 style lean (for UI tasks), and the standing instruction: **when you hit ambiguity or a hard trade-off, STOP and file a decision-request — never guess.**
- **Reviewers** — **Fable 5** agents (`model: "fable"`; for small phases the orchestrator may review in its own loop). Four duties:
  1. **Review** every builder deliverable against the plan + Sol Production Contract before it merges. Nothing merges unreviewed.
  2. **Integration** — keep multiple agents' work coherent: shared tokens, accent semantics, component grammar, state contracts, naming; catch drift early rather than at phase end.
  3. **Guidance** — answer builder decision-requests within plan bounds; anything plan-level or taste-level goes onto the owner-checkpoint queue instead.
  4. **Rescue** — when a builder stalls or misses the bar after two FIX cycles, the reviewer takes the task over directly rather than looping.

### 7.2 Review protocol — UI/UX is the focus

- Verdicts: **PASS** / **FIX** (specific, actionable list; max two cycles) / **TAKEOVER** / **ESCALATE** (to orchestrator → owner queue).
- **Design review is a separate, mandatory gate for every screen**, on top of code review: a Fable reviewer walks the *rendered* screen (live browser + screenshots, both viewports, both themes where applicable) against the §6 spec, the §6.0 style-lean table (no 50/50 blends — restyle ambiguous components toward the screen's lean), Sol §4.5 layout rules and §4.6 anti-patterns, and the state table (§5.1 Sol). It scores the Sol rubric's "task clarity & hierarchy" and "visual-system coherence" categories; anything short of excellent goes back as FIX with concrete changes, not vibes.
- **Integration reviews**: at every phase end, and in Phase 2 additionally after every 3–4 merged screen tasks (drift must not accumulate across seven screens built by parallel agents).
- Reviewer gates come **before** owner checkpoints and never replace them (§9).
- Phase 3 exit: full Sol Release Rubric ≥85/100, zero hard-gate failures (the originality gate is waived per D14; that rubric category is scored on rights/licensing only).

### 7.3 Phases with crews

| Phase | Contents | Crew | Done means |
|---|---|---|---|
| **0 Extract** | Parsers, canonical dataset, validation, decisions queue, A-twice calendar regeneration (§3) | 3–4 Sonnet builders (one per parser + join) · 1 Fable reviewer (checksum verification + spot-checks against the source HTML) | Checksums green; reviewer PASS; owner skim-reviews queue (D10 defaults overturnable) |
| **1 Content** | Methods rewrite + defect fixes (§4) | 2 Sonnet rewriters (Week A / Week B) · 1 Fable content reviewer (lint bar + gram-table correctness + voice fidelity) before anything reaches the owner | Reviewer PASS per batch; owner approves all four batches |
| **2 Dashboard** | Full flat functional app: chassis + 7 screens (§6), both surfaces, persistence, timers, extras, deploy (D2). Order: chassis + state core + timer engine first, then screens | Sonnet builders per subsystem/screen · 1 Fable **design reviewer** per screen (rendered-screen gate, §7.2) · 1 Fable **integration reviewer** (rolling) | Every screen PASSed design review; §8 checks pass; owner walkthrough desktop + phone |
| **3 Polish** | Hardware layer on heroes only: machined knob, gauge, paddle pivots, brushed gradients (dark heroes), reel mechanics, engraved labels | 1–2 Sonnet polish builders · Fable design reviewer with before/after screenshots per hero | No functional regressions (§8 re-run); rubric ≥85, hard gates (D14 amendment) |

No basket phase (D9). Phases strictly ordered; the app is usable at the end of 2 and 3. Polish touches only component skins — a polish change needing data/logic edits is misfiled and goes back to the queue.

---

## 8 · Verification

- **P0:** `npm run extract && npm run validate` — §3 checksums as vitest tests; diff report committed.
- **P1:** method lint: every step timed-or-flagged; every oven step has °C; per-cover grams present for every ingredient row; batch cards carry `batchTakeG`; macro recomputation matches ±1 after seasoning weights; owner approvals recorded.
- **P2 (functional + Sol Production Contract):** (a) per-screen walk of Sol §4.6 anti-patterns + §5.1 state table (rest/hover/focus/active/selected/disabled/busy/error/empty per interactive component); (b) keyboard-only full loop: plan a day, run a cook program, stocktake, tick a list; (c) mobile viewports 390×844 and 360×780 — LIST one-thumb operable, targets ≥56 px, no horizontal scroll; (d) timers drift <1 s over 30 min; reload mid-program restores; (e) localStorage export→wipe→import round-trips; (f) deployed URL on the actual phone, offline after first load; (g) reduced-motion and forced-colors passes; 200% zoom reflow; (h) contrast checks on every token pairing; (i) Lighthouse perf ≥90 on the deployed single file.
- **P3:** re-run all P2 checks; screenshot audit against Sol tokens; **Release Rubric scored — ship at ≥85/100 with zero hard-gate failures** (originality category scored on rights/licensing only per D14: licensed fonts/icons, no third-party logos or wordmarks); **hero fidelity check** — each polished hero reads as a convincing mechanical object (motion, light, detents), not a flat themed skin.

---

## 9 · Owner checkpoints (instructions to the build session / orchestrator)

1. **Before any code:** read this plan, atlas 5.6 Sol in full, and the six source files. Produce the Sol §8 required outputs 1–4 (assumptions, reference-to-principle mapping, originality departure note, scoped tokens) as a short doc. Then ask the owner your own batched clarifying questions.
2. **Run the D12 execution model throughout:** Sonnet 5 builders, Fable 5 reviewers, the §7.2 review gates. The orchestrator personally runs these checkpoints — never a subagent.
3. **End of Phase 0:** present the data-health report + decisions queue (D10 defaults marked; owner can overturn any item).
4. **Phase 1:** submit rewritten meals in the four batches (reviewer-PASSed first). Phase 2 must not display unapproved methods.
5. **End of Phase 2:** full walkthrough (desktop + the owner's actual phone) before polish, with the design-review verdicts and screenshots available for the owner to see.
6. **Escalations:** builder decision-requests that are plan-level or taste-level come to the owner batched at the next checkpoint (or immediately if blocking), with the reviewer's recommendation attached.
7. **Never merge polish into function phases.** Any "while I'm here" styling during 0–2 is a defect.
8. Commit per phase minimum; `tools/extract` stays re-runnable; the source HTML files are archival originals — never edit them.

---

## 10 · Getting started (build session)

This document and `design-reference-atlas-5.6-sol.md` are the complete handoff. Start at §9 step 1: read this plan, the atlas, and the six source files; produce the Sol §8 outputs 1–4; then ask the owner your batched clarifying questions before writing any Phase 0 code.

---

## Appendix A · Deferred: retailer basket handoff (D9 — out of scope, research preserved)

Verified 2026-08: **no URL adds an item to a basket at either retailer.** Morrisons (`groceries.morrisons.com`): search prefill works (`/search?q=…`); product URLs carry stable numeric SKUs; `robots.txt` disallows `/api/`; real saved Shopping Lists support one-action bulk add (UI-only). Sainsbury's (`sainsburys.co.uk/gol-ui/`): 403s all non-browser clients; useful routes `SearchResults/<term>`, `search-a-list-of-items` (paste-a-list; existence confirmed, behavior unverified), `favourites-as-list`; no user lists; internal basket API exists (community-documented) but needs in-browser auth context.

If revived, build **Tier 1**: one button = clipboard list (with fallbacks) + open Morrisons `/lists` + open Sainsbury's paste-a-list page + per-item search links; popup-block detection; all retailer URLs in one config object. Optional Tier 2 = hand-pinned product URLs (Morrisons stable, Sainsbury's slugs rot). Optional Tier 3 = Tampermonkey userscript per retailer driving the site's own add flow in the logged-in tab (true auto-add; breaks a few times/year; grey-area ToS). Hard lines regardless: never automate checkout/slots, never store credentials, stop at "trolley populated, human reviews and pays."
