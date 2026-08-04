# BUILD-STATE — resume point
*Updated 2026-08-04, end of session 1. Read this + `git log --oneline` to resume cold.*

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
