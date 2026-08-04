# Phase 2 Architecture Contract (orchestrator-authored, binding for all Phase 2 tasks)

PLAN §5 (runtime state), §6 (design system + screens) and the Sol atlas are the spec; this contract pins only what they leave open: code architecture, module APIs, and conventions — so parallel builders integrate without drift. Owner rulings R1–R4 (docs/SOL-BRIEF.md) apply: **Sol verbatim token base**, shared household ticks, hosting-agnostic build, iPhone Safari is the mobile target.

## Stack & layout

- **Vite + React + TypeScript**, `vite-plugin-singlefile` build → one `dist/index.html`. Dev: `npm run dev`. Data: static imports of `data/*.json` (compiled in; zod-validated at build by the existing pipeline — the UI trusts the JSON, contains no food facts).
- Deps allowed: react, react-dom, lz-string, @fontsource/space-grotesk, @fontsource/jetbrains-mono (self-hosted, inlined at build; no runtime CDN). Nothing else without an orchestrator ruling. No router lib (tiny hash router in `src/app/router.ts`), no state lib (context + reducer).
- Layout:
```
src/app/        chassis: App, Masthead, Paddles, LoopRail, CycleCursor, router, SettingsDrawer
src/tokens.css  the .fd5 scoped token sheet (Sol §4.2 verbatim base + §6.1 extensions)
src/state/      store.ts (localStorage fd5.v1.*), types.ts, selectors.ts, importExport.ts
src/engine/     timers.ts, arbiter.ts, programs.ts (meal/prep → timed program), duties.ts
src/screens/<today|plan|meal|cook|stores|shop|list>/   one folder per screen, self-contained
src/components/ shared primitives ONLY (Key, Paddle, Ladder segment, EstimateMark, ArbiterSlot, Sheet)
src/data/       typed accessors over the imported JSON (mealsById, ingredientsById, calendar variant, plan)
```
- A screen folder may not import from another screen folder. Shared anything lives in components/engine/state — if two screens need it, it moves down (integration reviewer enforces).

## Tokens & type (R1: Sol verbatim)

`src/tokens.css` defines `.fd5` with the atlas §4.2 blocks verbatim: `data-language="playful"` (light) is the app default; `data-language="precision-industrial"` (dark) applies ONLY on COOK's scene root. Extensions (names fixed): `--fd-ch-protein:#ff4d00; --fd-ch-fat:#8a6d00; --fd-ch-carb:#1160ff; --fd-ch-fibre:#00753f` (heritage hues, AA-adjusted where used as text; on segments pair with position+label), plus `--fd-target-list: 3.5rem` (56 px rows). Fonts: Space Grotesk (UI), JetBrains Mono (data, tabular-nums). Semantic roles per PLAN §6.1 — success=settled, focus-blue=cursor family, accent-fill=THE arbiter slot only, danger/warning=true states only, estimates=ink `≈` + dotted underline. Metals/gradients: FORBIDDEN in Phase 2 (polish-phase only — any "while I'm here" styling is a defect).

## State core API (F2 builds; screens consume — do not reinvent)

```ts
useStore(): { state: AppState; dispatch: (a: Action) => void }
// AppState (persisted fd5.v1.*, per §5): prefs {cover, week, scale, serveTime="19:30", cycleStartSaturday: ISODate|null},
// inventory {ingId: {level: 0|1|2|3|4, updatedAt}}, eaten {[isoDate]: {[slot]: {mealId, at}}},  // shared household ticks (R2)
// shopTicks {[tripId]: {[ingId]: {at}}}, leftovers[], waste[], priceChecks {ingId: {price, on}},
// timers (engine-owned slice), settings drawer handles JSON export/import (round-trip tested).
```
Selectors (`src/state/selectors.ts`): `todayInfo(now)` → {dayNo 1–5|weekend, weekday, station, weekIndex 1|2}; `dayMacros(week, dayNo, cover)` + `bands(week, cover)` from plan.json; `dutyStack(now)` → ordered duties (defrost moves due from calendar a-twice, use-today/expiring from inventory+life, tonight's start-by = serveTime − critical path); `coverageForMeal(mealId)` (stock %, fuzzy levels); `tripBuild()` (SHOP: plan variant + inventory deltas + carry-overs).

Arbiter (`src/engine/arbiter.ts`): `arbiterFor(screen, state, now)` → `{ rank1: Duty|null, queued: number }`. Priority: expired > defrost-overdue > timer-due > over-band > verify-nominee > primary-action. Rendered ONLY via the shared `<ArbiterSlot>` component (accent-fill + chevron + text; reduced-motion: static). One slot per screen, no exceptions.

Timer engine (`src/engine/timers.ts`): timestamp-math only (`startedAt` epochs, drift <1 s/30 min), persists through reload/lock (fd5.v1.timers), `useProgram()` hook: load(programId)/start/pause/+60s/done-step/scrub-preview; programs compiled from approved meals' tracks (`clockStart`/`minutes`) and prep sessions' ops by `src/engine/programs.ts`. Wake-lock requested with graceful fallback note. Completion events: meal program → eaten tick (shared, R2); prep session → STORES yield stamps with computed use-by dates.

## Accessibility & component grammar (binding, from §6.1 + Sol §4.4/5.1–5.2)

Native elements first; every control keyboard-operable; visible focus (`--sol-focus`, 2px, offset 3px, never clipped); targets ≥44px (≥56px LIST rows + COOK controls); labels 13–16px relative, programmatically associated, accessible name = visible text; NO swipe-only/drag-only/color-only/motion-only meaning anywhere; all heroes get keyboard + stepper/typed alternatives per their PLAN §6 contracts; reduced-motion = instant state swaps + text equivalents (`prefers-reduced-motion` + the atlas `[data-motion]` kill rule); forced-colors per Sol §4.2; state contract Sol §5.1 for every interactive component (rest/hover/focus/active/selected/disabled/busy/error/empty). Estimates always `≈` + dotted underline + accessible "(estimate)".

## Screen leans (D13 — reviewers enforce, no 50/50 blends)

TODAY/PLAN/MEAL/STORES/SHOP/LIST lean playful-technical (light); COOK leans precision-industrial (dark, lid-closed: rail replaced by `exit ▸`). Per-screen hero + borrowed-accent table: PLAN §6.0. Silkscreen lowercase labels on playful screens; engraved caps on COOK.

## Conventions

- Components PascalCase; hooks camelCase `useX`; CSS modules or colocated plain CSS scoped by screen-root class (`.scr-today` etc.) — no CSS-in-JS libs.
- Dates: Europe/London, `Intl` formatting; the fortnight anchors to `prefs.cycleStartSaturday` (null → onboarding card on TODAY asks once).
- localStorage writes debounced ≤500 ms; schema versioned `fd5.v1.`; `importExport` validates with zod and refuses partial imports.
- Tests: vitest for engine/state (timer math incl. fake-clock drift, arbiter ordering, selectors, import/export round-trip). Screens verified by design review (rendered) — no snapshot tests.
- `npm run build` must emit a single self-contained HTML ≤ ~2.5 MB with fonts inlined; `npm run dev` and `npm run build && npx serve dist` both work.

## Review gates (PLAN §7.2)

Every screen: code review + separate rendered design review (live browser, 1280×800 and 390×844, reduced-motion and forced-colors passes, Sol §4.6 anti-pattern walk, §5.1 state walk, lean check). Integration review after every 3–4 merged screens. Phase 2 exit: §8 P2 checklist + owner walkthrough (desktop + phone).
