# The single Fable review — findings, 2026-08-18

*The one design review this product receives, run over all eight surfaces after every
screen had landed. Eight independent builders each self-critiqued; none saw another's
work. This is the only pass that saw the whole thing as one object.*

**Method (its own account):** read CD-BRIEF, the CORRECTIONARY and BUILD-STATE in full
before looking. Walked the product live at 1280×800 (TODAY → SHOP → PLAN → MEAL tray →
COOK → back → STORES), drove real interactions, and ran **two independent contrast
sweeps** on all eight surfaces — a composited-gradient walker in-page (worst-stop law,
pseudo-element paints included) and a **real-pixel histogram audit via headless
Chrome/CDP** — with disputed items adjudicated by zoomed screenshot crops. Reduced motion
verified under the **real media feature** (`--force-prefers-reduced-motion`);
forced-colors under CDP Blink forced-palette emulation. Both plan states, 390×844,
Trophy Mode and COOK's live state rendered and looked at.

## The §2 verdict — does it read as one object?

**YES, with one weak room.** First-word test passes everywhere: TODAY "a car cluster on
carbon" · PLAN "a restomod gauge fascia" · MEAL "a faceted volume tray" · COOK loaded "a
reel deck" (**the strongest screen in the product**) · STORES "a specimen case" · SHOP "a
turntable console" · LIST "a grey till terminal".

**Room-to-room transitions read as rooms of one instrument.** Credit goes to what the
chassis owns: the rail's live clock travelling through every room (a running COOK program
watched ticking "0:02 → 2:09 · LIVE" from SHOP and from mobile); the foundry vocabulary
recurring in every world's own materials; one freshness grammar in five rooms; and the
five reserved roles declared once with **zero screen overrides** (grepped) — `#FF2B1A`
verified live on exactly the rail lamp and the reel's REC dot.

**The one weak room: COOK standby** reads flat-first. Its loaded state redeems it
completely, but standby is what a viewer sees first.

---

## F1 · FLOOR — the muted-ink tier fails 4.5:1 against real grounds on four screens

The re-sweep the brief demanded. The trap's prediction came true: failures live where
de-emphasised ink meets gradient/tint grounds that flat-token audits never composited.

### STORES — the worst
- `.str-row__figure` / `__countdown` / `__age`: "never" **2.72–3.13:1**, "—" **2.93:1**
  (ink `#5F5A50` over the never-counted tint band, composited ground L≈0.34–0.40).
- `.str-row__suffix` "1kg (yoghurt)" **3.54:1**.
- warning countdown "△ today"/"4d" **3.61:1**; danger "✕ expired" **3.62:1** over strip tint.
- **REPAIR (preferred):** apply the ink-plate law — figure/countdown/age never print raw
  over the tint stack in `.cd-register-rows`; seat on a printed plate at `#EDE8DE`, where
  muted `#5F5A50` = **5.61**, warning `#8D5E1E` = **4.58**, danger `#BD372D` = **4.59**.
- **REPAIR (fallback):** floor the tint's darkest composite at `#DDD9CD` (muted **4.86**)
  AND darken roles to warning `#7E5419` (**4.70**), danger `#A62A20` (**5.00**).
- `.str-gauge__of` "/65" ≈ **2.4:1** — a load-bearing denominator as dim decoration.
  REPAIR: full figure ink `#5F5A50` (**5.61**); keep hierarchy **by size, not by ink**.
- `div.str-row--leftover > button.cd-key` measured **77.1 × 36px** — fails 44px block axis.
  REPAIR: `min-block-size: 44px`, or PLAN's elementFromPoint-verified `::after` pattern.

### SHOP
- unselected store seats: "SAI"/"MKT" caps **2.17:1**; seat-figure "27" **1.78:1**.
  REPAIR: unselected seats keep the selected cap ink `#E8E6DD`; mark selection by **fill
  and weight** (the product already rules "roles spend in weight" on LIST).
- `.cd-stale-age` "7d" **2.45–2.79:1** on the plinth — honesty-critical.
  REPAIR: `#E8E6DD` (**6.31** there) or seat on the header's cream chip.
- selected control-band caps **4.01:1** vs the key gradient's darkest stop.
  REPAIR: floor that stop at `#5E5F60` (strobe then **5.12**). One stop, no ink change.
- minor: per-line "£" prefixes **2.26:1**; `.shop-etch` serial **2.06:1** (it *is*
  information — the trip id — so lift it or make the id legible elsewhere).

### TODAY
- `.tdy-face-unit` "HOURS"/"KCAL" **4.23:1** pixel-measured, **4.35** vs the face
  gradient's darkest stop. REPAIR: `#675E53` (**4.93**).
- MARGIN (not live): macro ladder "prot" **4.32** / "carb" **4.39** vs the plate's darkest
  stop `rgb(220,211,191)` — flat-token audits read 5.17+, **the trap's exact signature**.
  Pixels pass where glyphs sit. REPAIR: `#9E2F00` (**4.93**) / `#0044CC` (**5.23**).

### COOK — borderline, needs adjudication not a blind fix
Seat-meta ink passes **5.13** on the flat panel, but pixel bins found sheen regions at
**2.6–2.9** under "80 min"/"4 rows". Determine whether the sheen crosses the glyphs. If it
does, darkening is insufficient (`#3A3C3F` only reaches 3.33) — **plate the meta text**.

### PLAN, MEAL, LIST — clean
PLAN swept zero failures on the live DOM; its flagged items were rect artifacts acquitted
by crops. MEAL and LIST's flags were bezel-highlight artifacts.

## F2 · HONESTY — the annunciator's queue count is three claims at one instant

Same seeded state, same minute: TODAY "**2 behind**" · STORES "**1 behind**" (both chips
shown) · SHOP "**3 behind**" · LIST "**3 behind**". PLAN and COOK carry no strip at all.
**REPAIR:** one queue, one selector, exported by the chassis beside the R6 panel context.
If rooms legitimately filter to what they can address, say so in figures — "1 behind here
· 2 elsewhere" — never a bare count that disagrees room to room. Pin with a test. Decide
explicitly whether PLAN/COOK's missing strip is a **ruling** or a **gap**, and record it.

## F3 · COHERENCE — Trophy Mode is one wall with three dialects

`useTrophy` exists in **seven** copies (BUILD-STATE said four byte-identical; none are
byte-identical now). Comment-stripped: today/plan/stores/meal code-equal; shop/list differ
in formatting; **COOK diverges semantically** — adds `pointermove` + `focusin` to
`WAKE_EVENTS` and clears the idle timer on `visibilitychange`. Lived consequence: a dimmed
TODAY ignores an approaching hand; COOK wakes to one.
**REPAIR:** promote one `useTrophy` to `src/cd/chassis/` **carrying COOK's wake list and
visibility guard**, delete the seven. Trophy itself is otherwise excellent — captured live,
survivors enlarged, controls withdrawn, 0.55 lux, rigid-frame orbit. The lux dip is
doctrine-sanctioned and exits on any input; **not** a finding.

## F4 · FLOOR — the seated rail station loses its label under forced colors

Station 1 renders as an unlabeled filled block; stations 2–5 legible.
**REPAIR:** in `src/cd/chassis/chassis.css`'s forced-colors block, give
`.cd-station[aria-current="page"]` `background: Highlight` + `color: HighlightText`, or
keyline the seat and keep `ButtonText`. Caveat: emulation, but it drives Blink's real
forced-palette paint path — stronger than the rule injection used mid-build.

## F5 · COHERENCE (minor) — four verbs for one act

"ACK" (TODAY) · "address →" (STORES) · "ACT" (SHOP) · "ack" + "act →" (LIST).
**RULED (orchestrator, recorded in CD-BRIEF):** `ACK` product-wide for the acknowledge
act; the **navigational** key stays per-room in its own language's voice.

## F6 · CRAFT

- TODAY scrolls **83px** at 1280×800 (883 vs 800) — the meter bridge's FAT row under the
  fold. Closable by trimming one `--cd-module` gap.
- LIST at desk width leaves its lower-right third bare epoxy. Phone-first by design (QR
  arrival), so **suggestion only**: pull PUT BACK / NEXT / CLOSE into the empty zone.
- COOK standby is the flattest room — consider letting the loaded deck's materials
  (collar, tick arc) show at rest so the first-word test passes before a program loads.

---

## Verified healthy — DO NOT TOUCH

- **R5/R6/R7 as lived behaviour**: rail present in every room including with a tray open
  and a program running; PLAN's open accordion survived navigation to COOK *and* a
  MEAL-tray round trip; one-section-at-a-time held; overflow confessed in words everywhere.
- **MEAL's truth propagation** — one keyboard-driven wheel seat ×0.75→×0.80 and **seven
  readouts re-reported exactly** (391 = 488×0.80; day total, plate drum, broccoli grams,
  house-stock % all consistent). *The honesty law made visible.*
- **COOK loaded/live** — REC and rail lamp both `#FF2B1A` `.cd-lamp` with real radial
  bloom; the grip rotates only while the clock runs. The strongest single screen.
- **Reduced motion under the REAL media feature: PASS** — content byte-identical (1069
  chars both instances), tokens translate (settle 180→120ms, reveal 260→120ms), needle
  keeps its angle with 80ms linear travel. **This closes a gap open all build.** Method
  (headless Chrome + `--force-prefers-reduced-motion`, zero deps) is CI-able; scripts were
  in the session scratchpad under `cdp/`.
- Honest empty states, the freshness grammar, single-declaration role tokens, mobile's
  block-end rail with the travelling live clock.

## Not verified — stated plainly

- **Tester variant end to end**: flipping `planVariant` under a persisted full trip does
  not rebuild the trip (honest — a trip is a receipt), so SHOP's 39/39 authored receipt
  **stands on the builder's own verification, unreviewed**.
- **Sound**: bus unconditionally muted by owner ruling; cue *scheduling* not audited
  beyond confirming the mute law. 60fps / 16ms ack not re-measured (the spike's evidence
  and the synchronous-commit pattern stand).
- SHOP's reconcile flow, the QR hand-off, LIST's 1800ms run-out, and a **full
  keyboard-only loop** were not driven end to end. Real HCM hardware and real-device GPU
  raster remain untested.

## Artifact classes that produced FALSE failures in its own tooling

Recorded because whoever re-runs an audit will hit them:
1. **Engraved type's emboss highlights.**
2. **Adjacent-instrument pixels inside text rects.**
3. **Trophy Mode dimming the page mid-audit** — its first sweep measured a 0.55-lux
   screen. **Wake the page, then measure.** Same-URL navigations do not reload, so state
   survives.


---

# POST-REVIEW: a FLOOR failure the review itself dismissed

*Added 2026-08-22 by the orchestrator, after the SHOP builder found it during repairs and
I verified the mechanism independently.*

The review wrote of Trophy Mode: *"the 0.55-lux contrast dip is doctrine-sanctioned idle
behaviour and exits on any input — **not a finding**."* It considered the tier and **never
measured contrast under it**. That dismissal is wrong, and the defect is product-wide.

```
DEFECT    Trophy's ambient tier collapses contrast on every reading.
EVIDENCE  filter: brightness(0.55) multiplies sRGB-ENCODED channel values,
          which is NOT luminance-preserving. Ink and ground crush TOWARD EACH
          OTHER rather than the ground dimming beneath a fixed ink.
          Verified independently at 0.55:
            14.58:1 -> 4.88      11.65:1 -> 4.47  BELOW FLOOR
             6.45:1 -> 2.61  BELOW FLOOR
          SHOP measured four separate Floor failures this way.
REPAIR    Spend the tier on the GROUND, never on the reading. Commit dimmed
          ground values -- same recipes, same stops, dropped in value -- and
          leave every ink unmoved. NO filter anywhere above a reading.
```

**Affected, all using the same pattern:** SHOP `filter: brightness(0.55)` (**repaired**,
`1b214cf`) · TODAY `today.css:774` `grayscale(1) brightness(0.55)` · PLAN `plan.css:202`
`brightness(var(--pln-lux))` · LIST `list.css:1548` `brightness(0.55)` · COOK
`cook.css:1472/1475/1478/1766` `brightness(1)/(0.55)/(0.2)` — **COOK carries the deepest
tier in the product.**

**The trap inside the repair.** SHOP's first fix was also wrong: it moved the filter to a
narrower element, but that element *contained* the controls, so the subtree still dimmed
and a label came back at **2.70:1** — the same failure one level in. **A filter anywhere
above a reading is the bug.**

**Two screens carry extra hazard.** LIST is bound by THE EPOXY CEILING (epoxy tops out at
2.75:1 vs white / 7.64:1 vs black; stamped ink sits at 4.54:1 with almost no margin), so
dimming its ground may not be sufficient on its own and the departure must be declared.
PLAN's needle `#E8590C` is only 2.89:1 on ivory and reads by its `#1B1B1B` keyline —
under a filter the orange and its keyline crush together, degrading the one channel
carrying the needle exactly when it is read from furthest away.

**The principle, worth carrying past this project: the Floor is not waived by a doctrinal
tier.** Trophy is the state read from across a room; it is the last place a reading may go
dim. A dimmed panel with a few bright readings is what the trophy chapter actually asks
for — SHOP's post-repair panel still visibly dims while every reading passes (seat 13.18,
crown label 7.00, row name 15.52).

## And the review's F1c was misdiagnosed

Its prescribed repair — floor the key gradient's darkest stop at `#5E5F60` — would have
been **actively harmful**: dropping a mid-grey plate into SHOP's near-black inset track
takes strobe white from 14.58:1 to 5.12:1, a **3x loss**. No mid-grey ground exists under
any control-band cap in the active state (selected seats measure 11.65:1, unselected
14.58:1).

**Probable cause of the review's numbers**, per the SHOP builder: its screenshot returned
at **2x device pixels while the page reported rects in CSS pixels**. Sampling one against
the other lands every box at quarter size in the wrong place, and for 11px text that
samples the **antialiased ramp between glyph and ground** — producing ratios in exactly
the 1.7-4.0 band, on exactly the de-emphasised inks. Recorded as a fourth artifact class
for anyone re-running an audit: **derive the image scale from the image, never assume it.**

This does not discredit the review — F1a/F1b/F1d were real, and chasing F1c is what
uncovered four genuine Floor failures. But it is why a finding's *repair* must be
verified against the real ground rather than applied on authority.
