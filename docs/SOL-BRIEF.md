# FD-5 Dashboard — Sol §8 Builder Brief (required outputs 1–4)
*Build session · 2026-08-04 · for owner review before Phase 0. Source: PLAN.md §6 + atlas 5.6 Sol. Nothing here re-opens a D1–D14 ruling.*

---

## 1 · User & task assumptions

- **Users:** two adults, one household, one shared plan. Covers: her 70 kg, him 85 kg. They cook and eat the same plates; only gram tables and macro bands differ per cover.
- **The loop:** Sat shop → Sun batch session → Mon–Fri cook/log → midweek defrost moves → day-7 top-up → stocktake/restock. Five plated days per week ("Five Days at Table"); **Sat/Sun carry duties, not plated meals** — TODAY on a weekend shows the duty stack plus next-station guidance ("next: sat shop" / "tomorrow: sunday session"), an explicit non-empty state.
- **Surfaces:** desktop at home (PLAN, SHOP console, MEAL browsing); the phone in two hostile environments — supermarket (LIST: bright store light, one thumb, trolley in the other hand) and kitchen (COOK: wet hands, 2 m viewing distance, phone locked/unlocked repeatedly).
- **Sessions are short and instrumental** — glance TODAY (≤10 s), 90 s stocktake, tick-as-you-shop, run a cook program. No content-site patterns; every screen answers one question.
- **Accessibility target:** WCAG 2.2 AA. Reduced-motion, forced-colors, 200% zoom, 320 px reflow, keyboard-complete. Motion/color never sole cue (all heroes have text + stepper/keyboard contracts per PLAN §6.1).
- **Working assumptions (overturnable at any checkpoint; silence = assent):**
  - Serve-time pref defaults to **19:30**, set once in the settings drawer; "start by" = serve − method critical path.
  - The fortnight anchors to a **user-set start Saturday** (settings drawer); cycle cursor derives from weekday.
  - Timezone Europe/London; dates DD MMM; no notification/push infrastructure (timers live in the open app, timestamp-math across lock/reload).
  - Offline delivery = the single-file build **plus a small service worker + manifest** (a bare single HTML file cannot guarantee offline; this keeps D1's spirit — one artifact — with a two-line SW as deployment chrome).
  - COOK's chime is synthesized (WebAudio), no audio assets to license.
  - `navigator.vibrate` no-ops on iOS Safari — tick feedback never relies on it (it's third-cue at best).

## 2 · Reference-to-principle mapping

| Ref (Sol entry) | Role | Principle borrowed | Quoted under D14 (deliberately recognizable) |
|---|---|---|---|
| **OP-1 field** (#01) | Structure | Fixed chassis; one coherent scene per mode; 3–4 stable semantic parameter channels app-wide | Palette character; the color-to-parameter idea, expressed as the four macro channels |
| **TP-7** (#02) | Interaction | **State belongs to the control** — reel motion *is* program state; one hero earns the visual budget | Black-body / orange-index reel identity in COOK; stopped-reel-as-alarm |
| **Braun ET66 / Beogram 4000** (#09/#11) | Surface | Repeated quiet geometry; a calm low control horizon; exceptions—not size inflation—create hierarchy | Faceplate/key character on pads, paddles, and the SHOP console horizon |

- **Project signature — the attention arbiter** (PLAN §6.0): app-wide, exactly ONE act-now slot per screen; urgency competes in a fixed priority queue (expired > defrost-overdue > timer-due > over-band > verify-nominee > primary action); runners-up render quiet with a queue count. Conventional fallback: plainly styled banner. Reduced-motion: no pulse, static chevron. Semantic danger/warning/success keep distinct tokens and second cues everywhere — the arbiter is composition, not a state model.
- **Per-screen leans** are fixed by PLAN §6.0's table (COOK is the only precision-industrial-dominant screen; no screen blends 50/50). Reviewers enforce.

## 3 · Originality departure note (per D14)

The atlas's §6 originality rules and distance test are **waived by owner decision D14** — this is a personal instrument and may wear its influences openly: TE palette character, TP-7 reel identity, OP-1 chassis feel, silkscreen voice are all sanctioned quotes. **Still binding:** no third-party logos, wordmarks, or proprietary icon sets anywhere in the UI; all shipped assets licensed (fonts below; icons are custom-drawn primitives or text); every Sol accessibility and usability gate applies at full strength. Rubric's originality category is scored on rights/licensing only.

**Fonts (all OFL, self-hosted at build time — no runtime CDN, for offline):** UI face per Q2 below (Inter heritage vs Space Grotesk), data face JetBrains Mono.

## 4 · Scoped semantic tokens

Two candidate bases — **Q2 in the question round decides**. Both keep Sol's structure: scoped root, semantic (not decorative) color roles, second cues mandatory, light playful field for six screens, dark precision block for COOK only.

**Candidate A — heritage base (my recommendation).** The existing FD-5.html is already the brand: warm putty chassis, cream panels, LCD console, orange/yellow/blue/green channels, Inter + JetBrains Mono. The dashboard reads as generation 2 of the same device. Sol supplies the discipline (contrast-fixed variants, state contract), not the paint.

```css
.fd5 {
  --fd-font-ui: "Inter", system-ui, sans-serif;          /* heritage */
  --fd-font-data: "JetBrains Mono", ui-monospace, monospace;
  /* chassis (from FD-5.html, kept) */
  --fd-chassis:#c9c6bf; --fd-panel:#eeebe4; --fd-panel2:#e3dfd6;
  --fd-line:#b8b4ab; --fd-ink:#17171a; --fd-ink2:#5d5a54;   /* ink2 darkened from #6f6c66 → ≥4.5:1 on panel */
  /* semantic accents — each ALWAYS paired with a second cue (shape/label/position) */
  --fd-accent-fill:#ff4d00; --fd-on-accent:#ffffff;      /* the arbiter's act-now slot ONLY */
  --fd-accent-text:#a33500;                              /* orange as text/ink, AA on panel */
  --fd-cursor:#1160ff;                                   /* today-ring, playhead, cycle dot, focused row */
  --fd-success:#00753f; --fd-danger:#b3271e; --fd-warning:#735100;
  --fd-focus:#0057B8;                                    /* Sol focus blue, 2px, offset 3px */
  /* the four macro channels (OP-1 quote; used on ladders/gauges with label+position cues) */
  --fd-ch-protein:#ff4d00; --fd-ch-fat:#ffc400; --fd-ch-carb:#1160ff; --fd-ch-fibre:#00a35c;
}
.fd5[data-scene="cook"] {                                /* precision-industrial block (COOK only) */
  color-scheme: dark;
  --fd-bg:#101012; --fd-panel:#1b1b1e; --fd-text:#e9e6df; --fd-muted:#b9b5ac;
  --fd-reel-index:#ff4d00;                               /* TP-7 quote */
}
```

**Candidate B — Sol verbatim base.** Atlas §4.2 tokens exactly (`#D9D8D4` field, Space Grotesk, `#FF5A1F`/`#8A2E00` accent pair; dark block for COOK), extended only with the four `--fd-ch-*` macro channels above. Cooler, more "new instrument," less continuity with the current tool.

**Shared regardless of A/B:**
- **Roles** (PLAN §6.1): success = settled/confirmed; cursor-blue = "you are here"; accent-fill = the single act-now slot; danger/warning = true states only; **estimates = ink `≈` + dotted underline, never color**.
- **Ladder states:** on (channel color + filled), off (neutral), over-band (hollow past the bracket + text naming the overage), all with exact `value/target` text beside (Sol gauge rule).
- **Type scale:** functional labels 13–16 px relative; 9–11 px mono only for nonessential engraving. Tabular lining figures on all data.
- **Targets:** ≥44 px house; ≥56 px LIST rows + COOK controls. Motion tokens 80 ms snap / 160 ms state; reduced-motion collapses all mechanical motion to instant swaps + text.
- Forced-colors: borders from ButtonText, focus from Highlight, no fill-only meaning (per Sol §4.2 block).

---

*Output 5–8 of the Sol brief (state matrices, keyboard contracts, responsive/reduced-motion behavior, verification) live in PLAN §5.1-refs, §6.1–6.10 and §8, and get instantiated per-screen in Phase 2 task briefs.*
