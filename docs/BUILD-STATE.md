# BUILD-STATE — resume point
*Updated 2026-08-04 (mid session 2). Read this + `git log --oneline` to resume cold.*

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
