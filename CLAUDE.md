# FD-5 Meal System Dashboard

## Design work — read this first, always

**All UI/design work in this repo is governed by `docs/CD-BRIEF.md`. Read it before writing any styling, component, or layout code.**

It exists because the controlling design authority — **`/Users/stillshining/correctionary/CORRECTIONARY.md`** — is *not* installed on the Council Defiance skill's path. A session that loads the skill alone receives a taste doctrine that this project has **revoked**, with no signal that it is revoked, and will produce restrained work that fails the gate.

> The tell: *"if you find yourself producing something quiet, flat, tasteful, restrained, or 'clean,' you have followed a revoked law."*

Precedence: **CORRECTIONARY** → Council Defiance's *engineering only* → `docs/CD-BRIEF.md` project rulings.

## Where things are

- `docs/BUILD-STATE.md` — resume point; read with `git log --oneline`.
- `docs/CD-BRIEF.md` — the binding design contract (language per screen, committed values, Floor, frozen modules).
- `PLAN.md` — the original product contract; decisions D1–D14 still hold **except D6** (superseded: no lid-closed) and **D11/R1** (Sol design law, superseded by Council Defiance).
- `docs/VARIANT-SPEC.md` — the plan-variant system (`full` | `morrisons-tester`).

## Frozen

`src/state/**` · `src/engine/**` · `src/data/**` · `tools/**` · `data/**`. 358 tests must stay green. Source HTML files in the repo root are archival — never edit them. `npm run extract && npm run validate` must stay deterministic.

## Commands

```bash
npm run dev          # vite dev server
npm run build        # tsc --noEmit && vite build → single-file dist/
npx vitest run       # full suite
npm run extract      # re-run the data pipeline
```

Deploy: `npm run build && $HOME/.local/fd5-netlify/node_modules/.bin/netlify deploy --prod --dir dist`
