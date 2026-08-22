# BUILD-STATE — resume point

> **ACTIVE again 2026-08-18** — the owner received free usage credits, so the halt was
> lifted the same day rather than waiting for Saturday. **The MEAL and SHOP builders are
> resumed from their transcripts.** `docs/RESUME-2026-08-22.md` remains accurate as a
> cold-start briefing and as the ordered list of what still has to happen; only its
> "halted until Saturday" framing is superseded.
> **ALL EIGHT SURFACES ARE LANDED.** The single Fable review is running over the whole
> product. Remaining after it: action its findings, then deploy.
> **The tree is GREEN** — the SHOP builder cleared its own `onRecover` error while
> running. tsc clean repo-wide, **677/677** tests, build **1.619 MB** under the 2.0 MB
> amber line. **MEAL landed at `c9926bd`; SHOP is the last surface still building.**
*Updated 2026-08-17 (session 3, CD redesign). Read this + `git log --oneline` to resume cold.*

## SESSION 3 — Council Defiance redesign (CURRENT PHASE, supersedes everything below)

The Sol build shipped and was owner-approved at 92/100. **The owner's own design
authority judges that outcome a failure** — THE CORRECTIONARY: *"Boring correctness is
failure. Accurate + accessible + honest + forgettable = has not met the bar."* This
phase rebuilds the **presentation layer only** as instrument-grade hardware. The
functional spine does not move.

**Read before any styling code, in this order:**
1. `docs/CD-BRIEF.md` — the binding contract (project-local).
2. `/Users/stillshining/correctionary/CORRECTIONARY.md` — the CONTROLLING AUTHORITY,
   beats Council Defiance always. **It is NOT on the skill's path**, so invoking the
   council-defiance skill normally returns the revoked doctrine with no signal that it
   is revoked. This is the single most likely cause of silent failure on this phase.
3. The approved plan: `~/.claude/plans/okay-now-lets-design-stateful-thompson.md`.

**Execution model for this phase (supersedes PLAN §7 / D12):** builders are **Opus**
agents, one per surface, each self-critiquing with the mandatory five-pass protocol
before handoff. **No intermediate design reviews.** Exactly **one Fable review after
everything is built**, walking screen-to-screen as a whole product.
**OWNER REVISION 2026-08-18: the review's findings ARE to be actioned.** The original
ruling was that they be planned and not built; the owner has lifted it — *"you're free
to action the fable reviewer's instructions when that stage happens."* Timing is
unchanged: still one review, still at the very end, still no mid-build design gates.
The orchestrator verifies mechanical facts at every landing; a failure there is a build
defect returned immediately, not a review finding.

**Eight surfaces, one language each** (chassis = 13 BACK CHANNEL · TODAY = 05 EXPOSED
WORKS · PLAN = 17 RESTOMOD · MEAL = 16 FACETED VOLUME · COOK = 02 REEL LOGIC · STORES =
10 CLEAR LID · SHOP = 11 TANGENT HORIZON · LIST = 20 IRREDUCIBLE). 28 pairs checked
against every chapter's never-pair list; **one collision** (FACETED VOLUME × REEL LOGIC,
physics class), fenced at screen level.

**Owner rulings this phase — R5/R6/R7:** R5 no cage anywhere, COOK's lid-closed mode
DROPPED (D6 superseded), rail present on every screen. R6 open panels survive
navigation and reset on reload — scenes unmount on nav, so this lives in a
**chassis-level context above the scene**, in memory, no frozen-state change. R7 no
page-length scrolling — grouped accordion, one section open at a time.

### Progress

- **Foundation COMPLETE and committed** (`a85e57e`): `src/cd/**`, 28 files / 5,251
  lines. Eight language scopes with a bridge keeping the live app deployable; cached
  procedural material factory; ONE shared 120Hz integrator; five-cue sound bus at
  −18dBFS; shed ladder; freshness layer. Builder's own five-pass critique found and
  repaired 9 defects, 7 of which only rendering revealed.
  **Orchestrator repairs at landing** (three measured Floor failures the builder
  missed, found by sweeping every ink against every ground in every scope):
  back-channel `--cd-label-ink` 4.23→4.59:1, restomod `--cd-muted-ink` 4.00→4.56:1,
  plus two stale recorded figures. **THE EPOXY CEILING** is now law in the IRREDUCIBLE
  scope: epoxy `#9B9C9E` tops out at 2.75:1 vs white / 7.64:1 vs black, so **no
  coloured role ink can ever be legal on that body** — roles spend in weight, live is a
  lamp in its well.
- **STORES perf spike COMPLETE** (`f192758`) — **the gate is passed and risk 1 is
  dead.** Full material at 65 rows costs **under 1ms of style+layout per frame at 20×
  CPU throttle** (0.9% of the frame); zero long frames at the mobile baseline in every
  configuration, including a naive 828-shadow-layer translation. **Richness is
  affordable — spend it.** 97% of the frame is React reconciliation, so the law is
  *budget renders, not layers*. Seven binding rules now in CD-BRIEF's **Measured
  performance law** section (`fd93528`), led by: **a React `dispatch` does not satisfy
  the 16ms ack** — commit synchronously at input. The spike also found the shed ladder's
  trigger measuring frame *intervals* as if they were *costs*, escalating to stage 3 on
  any idle page in ~3s; repaired with tests at `fe6a23e`.
- **Chassis COMPLETE** (`3ad2bc4`) — BACK CHANNEL rail, the language-agnostic foundry
  (`Enclosure`/`Plate`/`Lamp`/`PressKey`/`GuardedKey`/`Tray`/`Register`), and R5/R6/R7
  proven live. **The rail seam was the finding that mattered:** a `#121212` rail reads
  15.34:1 on cream but **1.09:1 on REEL LOGIC's chassis black** — the one object holding
  the product together would have vanished on four of seven screens. Repaired as a
  two-tone edge (`#C7C9C9` filament + `#121212` keyline), worst best-of-pair **6.15:1**
  across all eleven grounds the rail can border. 18 findings over four halt-and-repair
  rounds. **One gotcha hits every screen builder:** `.cd-focusable:focus-visible` is in
  `@layer cd.material`, so a control's own `box-shadow` in `cd.screen` silently
  overwrites the focus keyline — compose via `--cd-stack`. Ladder artifact at
  `docs/ladder/chassis-ladder.html`.
- **TODAY (EXPOSED WORKS) COMPLETE** (`9757763`) — seven hero instruments; the geared
  Signature verified (22.5° per click, a forward-forward-back-back reversal returns to
  −33.75° and never −67.5°, carrier `transform: none`). Its truth pass **failed twice**
  and the critique re-ran from truth each time. The builder also **withdrew a finding of
  its own** after discovering it had measured a backgrounded tab, where transitions do
  not advance. Gates verified independently: tsc clean · 520/520 · 1.378 MB · 0 contrast
  failures measured in the running page · 0 nodes under 11px · 0 targets under 44px.
- **COOK (REEL LOGIC) COMPLETE** (`da530ea` + `23782ee`) — the builder was killed by a
  session limit mid-handoff, resumed, and delivered the full report: **19 findings over
  six rounds.** Its worst, caught by its own sound audit on the final truth re-run: **the
  alarm SOUNDED for a look-ahead** — holding the scrub rocker forward 1.6s fired 65
  tritone bursts at a step that was not due, because the audible warning read the same
  preview-shifted boolean the pixels do. The picture keeps the look-ahead (the preview
  plate captions it); the tritone cannot, so it now gates on the unshifted condition.
  **The Signature was answered straight:** the builder built the claim (transport keys
  gone, the three keys seated in the reel's own collar) and **declined the mechanism**
  (tap-centre / radial-flick / hold all require a grab), drawing and refusing them by
  name in the ladder artifact. **Never-grab verified by me, not taken on trust:** exactly
  two `onPointerDown` handlers exist in the whole folder, both on the rocker ends;
  `Reel.tsx` has zero. A guard test now pins it.
  *Superseded note (the pre-report state was recorded here as)* (`da530ea`) — the builder was
  killed by a session limit mid-handoff. Work and ladder artifact survived; **the report
  did not.** Verified by me: tsc clean, 23 COOK tests inside 520/520, build under amber,
  ladder artifact complete, R5 confirmed. **NOT established:** the five-pass findings,
  measured contrast, 44px both axes, keyboard, forced-colors, reduced-motion, frame
  budget, the sound audit, the §6.6 checklist, and whether the Signature was built or
  honestly declined against the never-grab constraint. **The agent has been resumed to
  deliver exactly these.** Do not treat COOK as done until it reports.
  **A WIP checkpoint of both was committed at `67d2e19` at the owner's request (usage
  93%). It is a snapshot, NOT a landing** — tsc clean and 492/492 at the time, but
  neither screen had reported, neither had run its handoff critique, and none of the
  landing gates (measured contrast, 44px both axes, keyboard, reduced motion,
  forced-colors, frame budget, build size, ladder artifacts) were verified. **Do not
  treat either screen as done on the strength of that commit.** Resume by letting both
  agents finish and report, then verify and land properly.
- **The dev server is SILENT by default** as of `d0f7a1c`-era `src/cd/sound/bus.ts`:
  with HMR running and builders driving live cook timers, the warning cue fired on every
  reload and the owner's machine made noise continuously. In DEV the bus starts muted
  unless `fd5.v1.cdMuted` is explicitly `"0"`. **Production is unchanged.** To run a
  sound audit: `localStorage.setItem("fd5.v1.cdMuted", "0")`.
- **WAVE 2 STARTED 2026-08-18 (overnight, owner asleep, autonomy granted).** STORES
  (CLEAR LID) and LIST (IRREDUCIBLE) dispatched in parallel — disjoint folders, the two
  register-shaped screens, both inheriting the spike's proven pattern. COOK's builder is
  concurrently finishing its report. **On each landing: verify gates, commit, then
  dispatch the next of PLAN → MEAL → SHOP.** Background agents survive orchestrator
  usage limits and their completions re-invoke the orchestrator, so progress continues
  across resets.
- **LIST (IRREDUCIBLE) COMPLETE** (`53fc5df`) — a register that **empties itself**, so
  nothing on it scrolls; the 1800ms run-out is the undo window. Its worst finding: the
  plan followed the till, so the over-run could never fire (spend £340.88, plan £340.88,
  over £0.00 — a budget that always agrees with the basket). It also **corrected two
  stale facts in its own brief**: the full trip is 44 lines / £170.44, not 49, and a
  "pantry-optional line" does not exist on the wire. **THE EPOXY CEILING held.**
- **Two foundation defects repaired** (`677ab55`), both found by the LIST builder and
  confirmed by reading: `.cd-focusable:focus-visible` used `var(--cd-stack, none)`, so an
  unset stack produced `0 0 0 6px #141414, none` — **invalid CSS, whole declaration
  dropped, focus keyline gone** on every control a screen builder writes without reading
  foundry.css. And IRREDUCIBLE was the one scope of eight declaring no `--cd-well`, so
  BACK CHANNEL's `#121212` inherited into a grey epoxy world. **Recorded not repaired:**
  `Voicing.contactOnRelease` has no consumer — `PressKey` still voices on the down-stroke.
  Left alone deliberately while builders are mid-flight; resolve after wave 2.
- **ALL FIVE WAVE-2 SCREENS DISPATCHED.** STORES and PLAN were near done at 03:20 (both
  ladder artifacts already written); MEAL (FACETED VOLUME, a tray) and SHOP
  (TANGENT HORIZON, the last screen) dispatched after.
- **MEAL (FACETED VOLUME) COMPLETE** (`c9926bd`) — the wheel refuses coast, verified at
  keyboard and pointer; the format ring does **not** report portion scale (its chapter's
  named ornament failure), proven by driving the wheel end to end while the ring's word
  held. **The language fence held** and I verified it independently: nothing under
  `src/screens/cook/` or `src/app/` touches the wheel but a scene import and a comment,
  and COOK's `Reel.tsx` still has zero handlers. **It confirmed the contrast-audit trap
  on real gradients** — `--cd-muted-ink` is 4.53:1 against the flat token but **3.68:1
  and 3.75:1 composited**, on five labels a naive audit passed. That is the second
  independent confirmation after STORES.
- *(superseded)* **STORES, PLAN LANDED** (`a48bd8d`, `227d935`). **MEAL + SHOP UNFINISHED** — both
  builders killed by a session limit mid-build, saved as WIP at `4619bf0`, neither
  reported. See `docs/RESUME-2026-08-22.md`.
- **Next:** finish MEAL + SHOP, repair the foundry's six gradient surfaces, re-sweep
  contrast on every landed screen, delete the legacy bridge. Then deploy,
  then the single Fable review — **and action its findings** (owner revision, 2026-08-18).

### Carried defects — fix when the owning screen is rebuilt

- **PLAN — `.scr-plan-card-name` fails the 44px Floor on the block axis.** Measured
  199.6 × **24** px. It is a bare inline anchor in `src/screens/plan/plan.css:275` with no
  `min-block-size`, no padding and no `display` change. **This is pre-existing in the
  shipped Sol app**, not introduced by this phase — the chassis builder found it while
  auditing targets and reported it rather than reaching outside its scope, which was
  correct. Not repaired in place because PLAN is rebuilt from Simple in wave 2 and the
  fix would be thrown away. **The PLAN builder must clear it.**

### Open verification gaps (carry these to the end; do not let them pass as verified)

- **`prefers-reduced-motion` has never been verified by rendering under the media
  query** — only by rule inspection. No tool available in this session can force the
  media feature (`chrome-devtools emulate` covers colour scheme, CPU, network and
  viewport, but not this one), and changing the owner's system setting to test it is not
  acceptable. **Close it one of two ways:** a confirming render on a machine with the
  setting on, or — better, because it then runs on every commit — an automated rule test
  over the built CSS asserting that every animated property has a translating (never
  deleting) counterpart inside the media block. Position that carries meaning must still
  move.
- **Lighthouse's performance category is not obtainable** through the available tooling
  (`lighthouse_audit` excludes it), so the "mobile-throttled 80" baseline figure has not
  been reproduced this phase. Direct rAF frame sampling plus Long Animation Frame
  attribution was substituted and is stronger evidence for the 60fps question — but it
  is not the same number.
- **GPU memory and real-device raster are unmeasured.** CPU throttling does not model a
  phone's GPU. This does not affect the shipping recommendation (the milled-plate pattern
  uses zero `backdrop-filter` nodes) but the naive translation's true cost on an iPhone
  is unknown.

### Standing law for this phase

- Frozen: `src/state/**`, `src/engine/**`, `src/data/**`, `tools/**`, `data/**`.
- **The app is live and must stay deployable at every commit** — token migration is
  bridge-then-burn, per screen.
- Procedural materials only. **No image assets. WebGL banned.** Amber line **2.0 MB**
  (currently 1.25 MB).
- **Text never renders raw over carbon weave or brushed grain** — hard fail by rule,
  not by ratio. Every scope declares `--cd-plate` / `--cd-plate-ink` for this.
- Gates at every landing: tsc clean · **466/466** tests · build under amber ·
  **measured** contrast (4.5:1 text, 3:1 controls) · 44px both axes · keyboard ·
  reduced-motion translating not deleting · 60fps · 16ms ack.
- Ornament-without-function rule: portholes and rocker arms attach only to values whose
  change is **user-caused or clock-continuous**. A daily stock level gets a needle and a
  printed zone, not a spinning disc.

---

## Session-2 and earlier (the Sol build — historical)

## Session-2 progress (supersedes the "Next actions" list below where they conflict)

- Chassis design review: PASS after 7 fixes. Wave-1 screens (TODAY/PLAN/MEAL/STORES) built, design-reviewed (FIX), and ALL fix rounds complete — swaps threaded everywhere, eaten-so-far console, thawedAt/frozen-bucket life model, shared useNow/formatters, AA channel-text tokens, always-render ArbiterSlot convention.
- Wave-2 screens (COOK/SHOP/LIST) built and complete: reel+alarm with reload-safe timers; SHOP with from-scratch verified QR + pinned tripCodec (wire-format compact); LIST on the real codec with offline restore. Survived a mid-session spend-limit kill (all agents resumed from transcripts; salvage commit ae2b538).
- RULINGS this session: tripCodec pinned contract ratified over LIST's stub (decision-request.shop.json resolved); COOK is the sanctioned exception to always-render-ArbiterSlot (the stopped-reel alarm IS its act-now slot); Friday-evening stores cursor stands (day-6 with Sat=day-0).
- ALL review gates CLOSED: chassis PASS, wave-1 four screens PASS after fix rounds, wave-2 + FINAL integration review → fix rounds → re-verification **PASS, rubric 91/100, hard gate clear** (was 86 with the INT-1 cascade hard-gate failure; fixed in main.tsx — tokens.css must import before App, load-bearing comment there). Offline PWA layer done (cache-first SW + manifest + iOS PNGs; genuine offline test passed; dist = 5 files).
- Additional rulings: done ▸ targets the alarm's earliest-deadline overdue step; estimate mark renders figure-then-≈ app-wide; LIST arbiter guards verify-nominees against the loaded envelope and never navigates to #/shop mid-trip.
- Owner chose **Netlify CLI** hosting (installed isolated at ~/.local/fd5-netlify — NOT a project dep, conflicts with vitest; use $HOME/.local/fd5-netlify/node_modules/.bin/netlify). Login initiated, awaiting owner browser auth.
- IN FLIGHT: §8 P2 verification-residue agent (Lighthouse, forced-colors rendered pass, 200% zoom, keyboard loop, contrast sweep, multi-tab localStorage check).
- §8 P2 suite COMPLETE (desktop Lighthouse 100/100/100, mobile-throttled perf 80 = accepted D1 tradeoff; forced-colors rendered PASS all 7; 200% zoom PASS; keyboard loop PASS incl. Escape-close; contrast sweep PASS after fixes). DEPLOYED + redeployed with pre-polish fixes.
- Phase 2 owner checkpoint delivered (docs/PHASE2-CHECKPOINT.md): 7 session rulings RATIFIED by owner; findings ruling = fix-before-polish, DONE (protein fill #d13f00 at 3.33/4.17:1; arbiter border drift-proofed; multi-tab race fixed — mount gating + storage-event rehydrate, 251/251 tests).
- **PHASE 3 COMPLETE — SHIPPED 2026-08-05** (commit e8a7253, deployed): seven heroes polished (both builders' gates green), final Fable ship-gate review 92/100 with the one hard-gate failure (SHOP key forced-colors legibility) fixed by the orchestrator and redeployed. Before/after screenshot set (49 files) delivered to owner. SW note: devices show the pre-polish app until the versioned service worker activates on a SECOND visit/reload. Awaiting final owner sign-off on the before/afters; any hero taste-tweaks are normal FIX cycles from here.
- **Owner walkthrough APPROVED 2026-08-05** (orchestrator drove the desktop leg live on the deployed app via the owner's Chrome — all six steps verified incl. stopped-reel alarm + overdue targeting + reload-restore + swaps threading; owner did the phone leg incl. QR scan and offline). Two walkthrough findings in fix flight: Saturday-snap for cycleStartSaturday (input accepted a Wednesday) + wiring the settings drawer to the shipped export/import. PHASE 3 OPEN. Was: paused on owner walkthrough (desktop + iPhone, script in PHASE2-CHECKPOINT.md). On approval → Phase 3 polish (heroes only: knob, gauge, reel, thumbwheel, odometer, paddles, engraved labels + darken-protein already done; before/after screenshots per hero to owner; §8 re-run; rubric ≥85 to ship). On issues → fix cycle first.

## Where the build stands

- **Phase 0 (extraction): COMPLETE.** Reviewer PASS, owner checkpoint done. `npm run extract && npm run validate` is the pipeline; 34-entry decisions queue fully resolved (3 owner rulings recorded in `tools/extract/owner-rulings.json`).
- **Phase 1 (methods rewrite): COMPLETE.** All four batches (a1/a2/b1/b2) owner-approved 2026-08-04; `tools/extract/approvals.json` carries provenance. 40/40 meals + both prep sessions rev B approved. Bands recomputed post-overlay.
- **Phase 2 (dashboard): FOUNDATION COMPLETE, screens not started.**
  - Scaffold: Vite + React + TS + vite-plugin-singlefile. `npm run dev` / `npm run build` (single dist/index.html, ~854 KB). Full suite: `npx vitest run` = 165 tests green (71 extract + 94 state/engine).
  - F1 chassis DONE: `src/tokens.css` (Sol §4.2 verbatim, `.fd5` scope, `--fd-ch-*` extensions), `src/app/**` (masthead, week/cover switches, loop rail + cycle cursor, hash router, COOK lid-closed shell, settings drawer), `src/components/**` (Key, Paddle, ArbiterSlot, EstimateMark, Sheet). Screens are placeholders in `src/app/scenes.tsx` — swap one import line per screen.
  - F2 state core DONE: `src/state/**` (persisted store fd5.v1.*, selectors, import/export), `src/engine/**` (timers, programs, arbiter), `src/data/**` (typed accessors). **Key fact for screen builders: executing week is ALWAYS "A" (D5 a-twice); `prefs.week` is a browsing toggle only — never wire TODAY/COOK/SHOP off it.** Other heuristics documented in code (yieldMap, lifeEstimate, coverage, trip split).

## Next actions, in order (PLAN §7.3 + docs/PHASE2-CONTRACT.md govern)

1. **Fable design review of the rendered chassis** (live browser, 1280×800 + 390×844, keyboard walk, Sol §4.6/§5.1) — chassis has NOT yet had its design review. Two F1-flagged items to verify: Sheet Escape-close on a real keyboard; reduced-motion/forced-colors rendered passes (rule-presence verified only).
2. **Wave 1 screens** (parallel Sonnet builders, one per screen + per-screen Fable design review): TODAY (§6.3), PLAN (§6.4), MEAL (§6.5), STORES (§6.7). Then integration review.
3. **Wave 2**: COOK (§6.6), SHOP (§6.8), LIST (§6.9 — lz-string URL fragment from SHOP). Then integration review.
4. **§8 P2 verification suite**, service worker + manifest for offline (SOL-BRIEF assumption), Lighthouse ≥90.
5. **Ask owner: Netlify vs GitHub Pages** (ruling R3 deferred it to now), deploy, then **owner walkthrough** (desktop + their iPhone) — orchestrator runs this checkpoint personally.
6. Phase 3 polish (heroes only, before/after reviews per hero; §8 P2 re-run; Sol rubric ≥85, hard gates minus waived originality per D14).

## Standing law (do not re-derive)

- PLAN.md §1 decisions D1–D14 + owner rulings R1–R4 (docs/SOL-BRIEF.md): Sol-verbatim tokens, shared household ticks, hosting TBD, iPhone Safari target (no vibrate, safe-areas, timer persistence).
- Execution model (§7): Sonnet builders / Fable reviewers / PASS-FIX(≤2)-TAKEOVER-ESCALATE; rendered design review per screen; no 50/50 style blends (§6.0 lean table); owner checkpoints run by the orchestrator personally.
- **No polish in Phase 2** — flat functional only; metals/gradients are Phase 3, heroes only.
- Source HTML files are archival — never edit. `tools/extract` stays re-runnable; commit per phase minimum.

## Deploy (Phase 2)

- Live URL: https://cool-sfogliatella-404a77.netlify.app (Netlify, team JustMereMortals, site id 9c35af8e-1863-4b59-a694-51495c407e05; SSO protection disabled 2026-08-04)
- Redeploy: `npm run build && $HOME/.local/fd5-netlify/node_modules/.bin/netlify deploy --prod --dir dist` (folder is linked)

- **Morrisons Starter variant shipped 2026-08-05** (commit 8d9cc4e + deploy): plan · full | starter switch in settings drawer; canonical list revision adopted (owner-ruled D0-035: 49 lines £172.57/£6.93, 22 SKUs verifiedOn 11 Aug, 6 pantryOptional); variant reviewed PASS after coherence+band fix cycle (chickpea-tin-not-contended checksum, unrounded bands both modes). 358/358 tests.


## Post-wave-2 status (2026-08-18)

- **SHOP (TANGENT HORIZON) COMPLETE** (`213dcf3`) — the last screen. It **confessed an
  invented `verifiedOn`** unprompted and replaced it with a real read (23 SKUs carry one,
  all `2026-08-11` — I verified the count against the dataset myself; my brief had said
  22). It then found a **second** invention: cost class judged against the canonical SKU
  even in tester mode, rendering the authored receipt as `18 costed / 21 unpriced`
  against VARIANT-SPEC's "all lines verified". Now 39/39.
  **The `onRecover` refusal was vindicated.** Supplying it honestly *forced a design
  change*: the reconcile pad held only 2–3 arbiter nominees, but a stale price sheet goes
  stale across all 44 lines — "a key that opens a panel which cannot reach the value that
  expired". A faked no-op would have shipped that defect invisibly. `reconcileState`,
  which reported a subset whose truth had no consequence, was **deleted** rather than
  kept as decoration.
- **Foundry repairs landed** (`b3d0f0a`-era): the **contrast-audit trap closed at
  source** (background-color declared alongside all six gradient surfaces);
  **TANGENT HORIZON's missing `--cd-well`** — the *second* scope caught omitting it, after
  LIST found the same in `irreducible`, which makes it a pattern: a scope that omits a
  token silently adopts the chassis's; and `.cd-tray-head` / `.cd-tray-title` added to the
  forced-colours block.
- **The legacy bridge is NOT yet removable.** All remaining `--sol-*` mentions in screens
  are comments, but `App.tsx:183` still renders `data-language="playful"` on the
  workspace and `Sheet` / `ArbiterSlot` / `Paddle` still wear `.fd5-control`. Migrating
  those three shared components is the real remaining work. Hygiene, not correctness.
- **Review ordering changed deliberately:** the approved plan said deploy *then* review,
  written when findings were not to be actioned. Since the owner lifted that, the review
  runs **first** so that what goes live already incorporates it.


## Review-repair round (2026-08-18 → 2026-08-22)

The single Fable review ran and **its findings are preserved in full at
`docs/REVIEW-FINDINGS.md`** — read that, not this summary, before acting on any of them.

**Verdict: the product reads as ONE OBJECT.** The §2 first-word test passes in every
room and room-to-room transitions read as rooms of one instrument — the one risk no
per-screen verification could catch. Six findings, ranked FLOOR / HONESTY / COHERENCE /
CRAFT.

**Landed so far** (`542f25f`): SHOP's F1a (selection spent in weight, not ink lightness),
F1b (the stale-price age lifted in scope only), F1d (the currency prefix **subtracted**
rather than lifted); COOK's local `.cd-unit` floor removed now that it is floored
centrally.

**THE NEW DEFECT CLASS, and the most valuable thing to come out of this round.** SHOP
found a Floor failure its own *composited* audit had missed, because it composited the
ground but **not `opacity`**: an etch printing `--cd-muted-ink` at `--cd-micro-alpha`
(0.4) measured **2.06:1** while its declared ink read 6.45:1. In its own words, *"the
same class of mistake as trusting `backgroundColor`, one property along."*
**A contrast audit must composite every channel that can dim a glyph — ground, gradient
stop, AND opacity.** This is now the third distinct way this product has hidden a Floor
failure inside a passing audit, and it generalises past this project.

**Outstanding, with five builders resumed on them:**
- **chassis** — F2 (the annunciator queue reporting 2/1/3/3 behind in four rooms at one
  instant; one queue, one selector, exported by the chassis) and F4 (the seated rail
  station losing its label under forced colors).
- **STORES** — F1a/b/c. The diagnosis is the hard part: `.cd-register-rows` declares
  `background-color: #ede8de` and the inks are correct on *that* ground, so something
  paints over it. **The opacity hypothesis above is the cheapest explanation and fits an
  L≈0.34–0.40 composite over a plate declared at `#EDE8DE`.**
- **SHOP** — F1c only. Not guessed at by the orchestrator: `.shop-key` is a flat fill, so
  the 4.01:1 caps are a surface that could not be identified from source with confidence.
- **TODAY** — F1a (`#675E53`), F1b margin (`#9E2F00` / `#0044CC`), F6 (the 83px scroll).
- **COOK** — F1 adjudication (does the seat sheen cross the glyphs, or sit beside them?)
  and F6 (standby is the flattest room; its loaded state was called the strongest screen
  in the product).

**Orchestrator-owned, after the screens land:** promote one `useTrophy` to `src/cd/`
carrying **COOK's** wake list (it is the only one that wakes to an approaching hand);
implement the `ACK` verb ruling; then deploy.
