# DESIGN REFERENCE ATLAS — 5.6 Sol
*Hardware-inspired UI: reference, translation, and production guide*

`20 CORE SOURCE ENTRIES · 20 REFERENCE ENTRIES · TWO DESIGN LANGUAGES · ACCESSIBILITY + ORIGINALITY GUARDRAILS`

`STATUS: OPINIONATED CREATIVE DIRECTION — NOT A PRODUCT SPECIFICATION`

Research and links checked: **2026-08-04**

---

## 0 · READ THIS FIRST

### 0.1 What this atlas is

This atlas helps a designer, developer, or AI builder create digital controls with the clarity, restraint, and character of well-designed hardware. Its core proposition remains:

> A good control communicates its purpose, present state, possible action, and consequence before decoration is added.

The hardware references are not templates. They are evidence for design principles: restrained palettes, explicit control-to-result mapping, visible state, deliberate hierarchy, and pleasure earned through precision.

Use this document to:

- establish a shared visual and interaction direction;
- turn reference objects into project-specific principles;
- constrain early concepts before they dissolve into generic UI;
- brief a human or AI builder;
- critique whether a result is coherent, usable, and original.

### 0.2 What this atlas is not

It is not user research, a usability standard, legal advice, an asset license, or a finished component library. Product requirements, platform conventions, task completion, and accessibility override its aesthetic defaults.

Do not hand a palette and a handful of hardware metaphors to a builder and call the result a design system. A shippable system also needs semantic tokens, complete component states, responsive behavior, content rules, input alternatives, error recovery, and testing.

### 0.3 Reading labels

Every object analysis separates four different kinds of statement:

| Label | Meaning |
|---|---|
| **VERIFIED FACT** | A product or collection claim supported by a linked primary or museum source. |
| **DESIGN READING** | An interpretation of why the object feels or works as it does. |
| **UI TRANSLATION** | A digital-design proposal inspired by the object. It is not a fact about the source. |
| **PRODUCTION GATE** | A usability, accessibility, implementation, or originality condition that must survive the styling. |

### 0.4 Rule strength

| Strength | How to use it |
|---|---|
| **Principle** | Preserve the intent across projects: clear mapping, visible state, honest hierarchy. |
| **Default** | Start here, then change it when the user, content, or platform gives a reason. |
| **Signature option** | Use at most one or two; these create character but are not required. |
| **Context-sensitive** | Test before adopting. Dials, modes, micro-labels, and motion often belong here. |
| **Hard gate** | Must pass before release: operability, comprehension, accessibility, provenance, and originality. |

### 0.5 The seven-step workflow

1. Write the user, primary task, platform, content density, and accessibility target.
2. Choose one dominant language from Section 1.
3. Select no more than three reference objects: one for structure, one for interaction, one for surface character.
4. For each reference, record one principle to borrow and one recognizable feature not to copy.
5. Solve the primary flow in plain grayscale using familiar controls.
6. Add one project-specific signature interaction, plus conventional and reduced-motion alternatives.
7. Apply the Production Contract and Release Rubric before polishing.

### 0.6 What changed in 5.6 Sol

- Factual claims and source status are separated from interpretation.
- Stale or conflated product descriptions were corrected.
- Koenigsegg Jesko replaces the insufficiently supported Gemera HMI example.
- Ressence Type 2 is no longer described as oil-filled; the oil-filled Type 3/5/7 family is distinguished explicitly.
- Rabbit r1 hardware is separated from the current rabbitOS 2 interface.
- “Replication” has become **translation**: principles should travel, brand signatures should not.
- Absolutes such as “no menus,” “tiny labels,” and “motion instead of text” are now context-sensitive heuristics.
- Scoped semantic tokens, full states, accessibility behavior, originality checks, an AI brief, and a release rubric were added.

---

## 1 · THE TWO DESIGN LANGUAGES

### 1A · Playful-technical

This language combines disciplined industrial layout with a small amount of wit. It is associated here with Teenage Engineering, Playdate, restrained instruments, and compact creative tools.

**Principles**

- **Neutral is the field; color carries meaning.** Saturated color marks a parameter family, active state, warning, or exceptional action. Color reinforces meaning rather than carrying it alone.
- **The face explains the object.** Labels, scales, icons, and diagrams sit close to what they describe. The core loop should not depend on hidden instruction.
- **Repetition creates rhythm.** A strict grid of related controls makes the exception legible.
- **Toy seriousness.** Friendly proportions and animation can coexist with exact alignment, strong feedback, and restrained behavior.
- **Constraint creates identity.** A limited number of tracks, inputs, colors, or modes can make a tool learnable—provided limitations follow the task rather than merely looking clever.
- **State belongs to the control.** A reel turns, a key moves, a light changes, or a value updates at the point of action.

**Good fits:** creative tools, music and media products, learning interfaces, compact utilities, games, playful developer tools, focused device controls.

**Use cautiously:** dense enterprise software, long-form content, high-stakes workflows, or products whose users cannot afford to learn unconventional controls.

### 1B · Precision-industrial

This language treats hierarchy, material, and mechanism as evidence of care. Its reference set includes Pagani, Koenigsegg, Leica, Ressence, Astell&Kern, and high-end instruments.

**Principles**

- **Material hierarchy.** One touch point or information object receives exceptional craft; supporting controls stay quiet.
- **Mechanism is legible.** A user can see, infer, or verify what a control changes. Digital “exposure” should reveal a meaningful relationship, not decorative gears.
- **Primary variables remain present.** Core parameters are glanceable and close to the hand; secondary configuration is progressively disclosed.
- **Depth follows structure.** Recess, edge, shadow, and highlight explain layers, grouping, or touch—not a generic desire to look expensive.
- **Analog dignity, digital selectivity.** Use a dial, gauge, or dedicated control only when continuous adjustment, glanceability, or muscle memory makes it superior.
- **Restraint signals confidence.** Fewer, better-resolved elements can feel more valuable than a screen full of effects.

**Good fits:** professional instruments, vehicle or machine interfaces, premium media products, monitoring dashboards, high-consideration configurators.

**Use cautiously:** low-end hardware simulation, data-dense tables, fast transactional flows, or any interface where material effects reduce contrast or speed.

### 1C · How to choose and mix

| Project signal | Dominant language | Borrow carefully from the other |
|---|---|---|
| Creative play, exploration, approachable tools | Playful-technical | One crafted hero control or precise gauge. |
| Monitoring, calibration, professional operation | Precision-industrial | A small color-coding system or moment of wit. |
| Consumer utility with one signature action | Playful-technical | Material restraint and a quieter frame. |
| Premium product with frequent adjustment | Precision-industrial | Clear faceplate labeling and friendlier motion. |
| Dense enterprise workflow | Neither as a skin | Borrow only hierarchy, semantic color, and clear control mapping. |
| Safety-critical or regulated workflow | Task- and standard-led | References may inform finish only after human-factors validation. |

**Mixing default:** 70% dominant language, 20% supporting language, 10% project-specific identity. This is a composition prompt, not mathematics. If every control is a “hero,” there is no hierarchy.

---

## 2 · TWENTY CORE SOURCE ENTRIES

These were selected for primary imagery, documented objects, or dependable product information. A current link is not a reuse license; record creator, rights, access date, and intended use for every asset placed in a deliverable.

| # | Source | Type | Best use | Caution |
|---:|---|---|---|---|
| 01 | [Teenage Engineering — designs](https://teenage.engineering/designs) | Official archive | Product families, form, CMF, collaborations | Separate product generations; do not infer interaction from stills alone. |
| 02 | [Teenage Engineering — press](https://teenage.engineering/press) | Official press archive | High-resolution imagery and launch material | Marketing language is not usability evidence. |
| 03 | [Playdate — designing for the device](https://help.play.date/developer/designing-for-playdate/) | Official developer guidance | 1-bit graphics, screen constraints, accessibility considerations | Device-specific advice does not transfer automatically to the web. |
| 04 | [Rams Foundation archive](https://rams-foundation.org/archive/introduction/) | Foundation archive | Dieter Rams objects, chronology, and design context | Confirm object-level image rights before reuse. |
| 05 | [MoMA — Industrial Design](https://www.moma.org/collection/terms/industrial-design) | Museum collection | Canonical objects, designers, dates, materials | Image licensing varies by object. |
| 06 | [Cooper Hewitt Collection](https://collection.cooperhewitt.org/) | Museum collection | Industrial and graphic-design history | Confirm rights per record. |
| 07 | [Vitsœ](https://www.vitsoe.com/) | Official manufacturer | Rams principles expressed through a living product system | Furniture logic is useful, but not a UI recipe. |
| 08 | [Leica M11-D](https://leica-camera.com/en-US/photography/cameras/m/m11-d-black) | Official product page | Control subtraction and layered configuration | Luxury marketing does not prove universal usability. |
| 09 | [Ressence innovation](https://ressencewatches.com/pages/innovation) | Official technical overview | Orbital displays, crownless setting, mechanical/electronic hybrids | Distinguish ROCS variants; not every Ressence is oil-filled. |
| 10 | [Pagani Utopia](https://www.pagani.com/pagani-utopia/) | Official product story | Analog hierarchy and exposed mechanism | Automotive safety and ergonomics remain domain-specific. |
| 11 | [Koenigsegg Jesko](https://www.koenigsegg.com/index.php/model/jesko-attack) | Official product story | SmartWheel and moving SmartCluster | In-wheel touch is not automatically suitable for general touch UI. |
| 12 | [Bang & Olufsen — Beogram 4000c story](https://www.bang-olufsen.com/en/us/story/beosystem-4000c) | Official archive/story | Long-life product design, calm control surfaces | Region-specific links may redirect. |
| 13 | [Analogue Pocket](https://www.analogue.co/pocket) | Official product page | Minimal hardware face and display fidelity | Product imagery is controlled brand material. |
| 14 | [Nothing Phone (3) — Glyph Matrix](https://nothing.tech/products/phone-3) | Official product page | Peripheral, glanceable state | Always duplicate essential status on the main accessible interface. |
| 15 | [CMF Buds Pro 2 support](https://support.cmf.tech/hc/en-us/categories/26040605225873-Buds-pro-2) | Official support documentation | Multifunction physical dial behavior | Configurable gestures need discoverability and current-mode feedback. |
| 16 | [Devialet](https://www.devialet.com/) | Official manufacturer | Output expressed through physical motion | Spectacle can obscure ordinary controls. |
| 17 | [Astell&Kern SP3000](https://www.astellnkern.com/en/product/view.php?idx=133) | Official product page | Protected hero control and material framing | Rendered material language must not compromise performance or contrast. |
| 18 | [Mondaine — design and stop2go](https://ch.mondaine.com/en/pages/design-technologie) | Official manufacturer | Motion choreography as identity | Branded timing is not a license to disguise latency. |
| 19 | [iF Design Award winners](https://ifdesign.com/en/winner-ranking) | Juried gallery | Broad comparative research | An award is not proof of task success or accessibility. |
| 20 | [Red Dot search](https://www.red-dot.org/search) | Juried gallery | Product-form discovery | Treat jury copy as a lead, then find primary documentation. |

**Secondary discovery sources:** [Core77](https://www.core77.com/), [Dezeen Design](https://www.dezeen.com/design/), [Fonts In Use](https://fontsinuse.com/), [leManoosh](https://lemanoosh.com/), and [Designboom](https://www.designboom.com/design/). These are valuable for discovery and commentary, but label them as editorial or community sources rather than “official.”

---

## 3 · TWENTY REFERENCE ENTRIES

### PART I — FULL TRANSLATIONS (01–08)

#### 01 · Teenage Engineering OP–1 field — portable synthesizer

**Sources:** [official product page](https://teenage.engineering/products/op-1), [official guide](https://teenage.engineering/guides/op-1), [official store specifications](https://teenage.engineering/store/op-1-field/)

**VERIFIED FACT.** OP–1 field uses a low-profile aluminum body, a flush high-resolution display, a four-track tape workflow, and color-related encoder/display mappings. The official guide also contains browsers, settings, lists, and management screens; the interface is constrained, not menu-free.

**DESIGN READING.** The strongest idea is not “tiny gray synth.” It is correspondence. A small set of physical controls remains in a consistent place while the screen explains what each control means in the current context. Repeated key geometry calms the face; color makes the changing mapping legible; playful graphics make abstract synthesis memorable.

**UI TRANSLATION.** Keep three or four semantic parameter channels consistent across a tool. Put the label and live value close to the control. Let each workspace have one coherent scene rather than a pile of unrelated cards. Use restraint to shorten the decision path—not to hide necessary navigation.

**PRODUCTION GATE.** Color must have a second cue such as label, position, pattern, or icon. Do not reproduce the OP–1 palette, keyboard layout, illustrations, or color-to-parameter bundle as a branded lookalike.

---

#### 02 · Teenage Engineering TP–7 — field recorder

**Sources:** [official product page](https://teenage.engineering/products/tp-7), [official guide](https://teenage.engineering/guides/tp-7), [official specifications](https://teenage.engineering/store/tp-7-black)

**VERIFIED FACT.** TP–7 measures 96 × 68 × 16 mm. Its motorized reel supports scrubbing, scratching, pausing, menu navigation, and playback/recording feedback. A side rocker provides rapid scrubbing, and a red record lamp supplies an additional state cue.

**DESIGN READING.** One component earns most of the visual area because it performs several related jobs: input, display, feedback, and identity. The reel is meaningful spectacle. Supporting buttons remain visually subordinate.

**UI TRANSLATION.** A circular scrubber can rotate during playback, respond directly to pointer or touch input, and expose an off-center index mark. Keep elapsed time, duration, playback state, and a conventional timeline available beside it. The hero control should reduce conceptual load, not merely increase rendering complexity.

**PRODUCTION GATE.** Circular dragging cannot be the only interaction. Provide keyboard steps, buttons, and a directly accessible value. Respect reduced-motion preferences and never delete persistent status merely because motion is expressive.

---

#### 03 · Playdate — handheld console

**Sources:** [official product page](https://play.date/), [official design guidance](https://help.play.date/developer/designing-for-playdate/)

**VERIFIED FACT.** Playdate is 76 × 74 × 9 mm and uses a 400 × 240, 1-bit Sharp Memory LCD without a backlight. Its inputs include a D-pad, buttons, accelerometer, and fold-out crank.

**DESIGN READING.** The device turns constraint into culture. A 1-bit display creates a shared graphic grammar; the yellow enclosure frames rather than competes with that content; the crank gives developers a novel variable with physical range and personality.

**UI TRANSLATION.** A high-contrast mode can use pure foreground/background, deliberate dithering, and a single frame color. Introduce an unconventional input only when it unlocks a genuinely better action—continuous adjustment, playful timing, or spatial exploration—not simply to be memorable.

**PRODUCTION GATE.** Dither must not reduce text legibility. Provide a conventional control path for essential operations, preserve sufficient target size, and test under the display and lighting conditions users will actually encounter.

---

#### 04 · Rabbit r1 — AI companion hardware and rabbitOS 2

**Sources:** [official hardware introduction](https://www.rabbit.tech/newsroom/introducing-r1), [current interaction guidance](https://www.rabbit.tech/support/article/use-rabbit-r1), [rabbitOS 2 launch](https://www.rabbit.tech/newsroom/rabbitos-2-launch)

**VERIFIED FACT.** r1 has a 2.88-inch touchscreen, push-to-talk button, scroll wheel, and motorized rotating camera. Its hardware uses a luminous-orange identity. Current rabbitOS 2 adds touch navigation, menus, settings, and a colorful card-stack interface; the launch-era black field and pixel rabbit are not the whole current system.

**DESIGN READING.** The hardware succeeds at recognition through a small number of bold decisions: one body color, one vertical control zone, and a camera whose orientation is physically legible. The software history is also instructive: a memorable shell does not eliminate the need for conventional navigation as capability grows.

**UI TRANSLATION.** Use a signature color and animated personality as orientation and feedback, then anchor them in familiar structure. If a privacy-related component can visibly turn away, close, or disconnect, reinforce that truth in text and programmatic state.

**PRODUCTION GATE.** A mascot supplements status; it does not replace “listening,” “working,” “done,” or “failed.” Treat r1 as a hardware and branding reference, not proof that its service model or launch UX was successful.

---

#### 05 · Pagani Utopia — hypercar interior

**Sources:** [official Utopia page](https://www.pagani.com/pagani-utopia/), [official press release](https://www.pagani.com/app/uploads/2022/09/Pagani-Utopia_Press-Release_ENG-2.pdf)

**VERIFIED FACT.** Utopia uses analog instruments, a minimal driver display rather than a large center-screen field, an exposed gear-lever mechanism, and a steering wheel fashioned from a solid aluminum block. Pagani explicitly frames functional components as opportunities for craft.

**DESIGN READING.** Hierarchy follows jewelry logic: one mechanical centerpiece, major instruments, then supporting switches. Visibility of mechanism builds a sense of causality and care. Material variation is concentrated at touch points and structural boundaries.

**UI TRANSLATION.** Give one task-critical control the richest resolution. Show a meaningful link between action and affected system—through topology, before/after state, dependency, or live response. Use inset, edge, and highlight to explain layering, not to paint every component as metal.

**PRODUCTION GATE.** Decorative screws, fake linkages, and expensive gradients are not “honest mechanism.” The effect must help users predict or verify a consequence. Keep text, values, and targets clear under glare, zoom, and reduced contrast.

---

#### 06 · Koenigsegg Jesko — SmartWheel and SmartCluster

**Source:** [official Jesko page](https://www.koenigsegg.com/index.php/model/jesko-attack)

**VERIFIED FACT.** Jesko’s SmartWheel places two small touchscreens in the steering-wheel spokes with haptic feedback. A compact SmartCluster sits behind the wheel and turns with it so the driver information remains aligned with the wheel.

**DESIGN READING.** Frequent controls live near the hand, while persistent vehicle information occupies a stable dedicated region. The arrangement reduces reach and separates contextual action from continuous status.

**UI TRANSLATION.** Place the most frequent contextual actions close to the point of interaction; keep the essential status strip persistent. On mobile, this may mean a restrained bottom action zone rather than two ornamental “spokes.” Show no more choices than can be distinguished reliably at that location.

**PRODUCTION GATE.** Thumb reach is not permission to crowd the bottom corners. Validate target size, accidental activation, handedness, occlusion, safe-area insets, and screen-reader order. Automotive interaction requires domain-specific human-factors testing.

---

#### 07 · Leica M11-D — digital rangefinder without a monitor

**Source:** [official Leica M11-D page](https://leica-camera.com/en-US/photography/cameras/m/m11-d-black)

**VERIFIED FACT.** M11-D omits the rear monitor and replaces that area with a mechanical ISO dial. Its black all-metal housing uses magnesium and aluminum, and the red Leica logo is deliberately omitted. The Leica FOTOS app can act as a display and adjust nearly all settings.

**DESIGN READING.** Subtraction works because the three exposure variables retain direct physical access while review and extended configuration move to a companion layer. The object does not eliminate complexity; it relocates it around a focused capture loop.

**UI TRANSLATION.** Identify the three or four variables experts change continuously and keep them present as direct controls. Move infrequent configuration into a clearly available secondary surface. Offer a focused mode without making recovery, onboarding, or advanced settings obscure.

**PRODUCTION GATE.** “Delete everything into a config file” is not a design strategy. Advanced controls need discoverable access, sensible defaults, reversible changes, and a visible way back. Do not add a red brand-like dot; the reference object intentionally removes it.

---

#### 08 · Ressence Type 2 — orbital display with e-Crown

**Sources:** [official Type 2 page](https://ressencewatches.com/products/type-2-anthracite), [ROCS overview](https://ressencewatches.com/pages/rocs), [e-Crown overview](https://ressencewatches.com/pages/e-crown), [oil-filled models overview](https://ressencewatches.com/pages/oil-filled)

**VERIFIED FACT.** Type 2 uses the ROCS 2 orbital convex system, a grade-5 titanium dial with eccentric satellites, and an electro-mechanical e-Crown that can monitor and set time. It is operated through the case back and touch interaction. Type 2 is **not** one of Ressence’s oil-filled models; the company identifies Types 3, 5, and 7 for that construction.

**DESIGN READING.** Hierarchy comes from scale, orbit, and continuous relation rather than stacked panels. Electronics automate correction while the mechanical display remains the main experience.

**UI TRANSLATION.** Orbital or satellite layouts can make a primary cycle and its dependent metrics feel connected. Use them for naturally cyclical or relational data, not arbitrary dashboards. Automation should expose current state, last action, confidence, and manual override.

**PRODUCTION GATE.** Supply exact text values and a conventional list/table alternative. Motion must pause or simplify under reduced-motion settings. If the desired reference is the “dial under glass” oil effect, study Type 3, 5, or 7 instead of attributing it to Type 2.

---

### PART II — TWELVE CAPSULES (09–20)

#### 09 · Braun ET 66 calculator

**Sources:** [Centre Pompidou collection record](https://www.centrepompidou.fr/en/ressources/oeuvre/cX4y7Bj), [Powerhouse collection note](https://collection.powerhouse.com.au/object/434214)

**VERIFIED FACT.** The 1987 ABS calculator was designed by Dieter Rams and Dietrich Lubs. Museum commentary connects this Braun calculator language to the original iPhone calculator, but “direct ancestor” remains stronger than the evidence warrants.

**DESIGN READING.** Repeated round keys, disciplined spacing, a black field, and sparse color coding make exceptional operations immediately visible.

**UI TRANSLATION.** Repeat geometry; let semantic exceptions—not arbitrary size inflation—create hierarchy.

**PRODUCTION GATE.** Do not clone Braun’s exact face or turn influence into an unsupported origin story.

#### 10 · Braun SK4 radio-phonograph

**Source:** [MoMA collection record](https://www.moma.org/collection/works/2649)

**VERIFIED FACT.** The 1956 SK4/10 combines painted metal, wood, and a transparent plastic lid.

**DESIGN READING.** The lid exposes the record area while the surrounding enclosure remains elemental.

**UI TRANSLATION.** Reveal a process when seeing it improves trust or comprehension; place primary controls where use naturally begins.

**PRODUCTION GATE.** Transparency that shows meaningless implementation detail is noise.

#### 11 · Bang & Olufsen Beogram 4000 / 4000c

**Source:** [B&O design and restoration story](https://www.bang-olufsen.com/en/us/story/beosystem-4000c)

**VERIFIED FACT.** Jacob Jensen’s 1972 design used a tangential arm, suspended chassis, aluminum, and wood; the 4000c program restored and updated original units.

**DESIGN READING.** A low horizontal control zone and process-aligned arm movement make the object calm without making it inert.

**UI TRANSLATION.** Build a calm “horizon” of controls, align motion to the underlying process, and design components for long-term maintainability.

**PRODUCTION GATE.** Longevity requires real architecture, not a vintage skin.

#### 12 · Analogue Pocket

**Source:** [official product page](https://www.analogue.co/pocket)

**VERIFIED FACT.** Pocket centers a 3.5-inch, 615 ppi, 1600 × 1440 display in a handheld and uses FPGA hardware rather than software emulation for its core systems.

**DESIGN READING.** Proportion, screen fidelity, and disciplined control placement carry more identity than surface branding.

**UI TRANSLATION.** Let proportion, fidelity, and control placement carry identity; keep branding away from the task surface.

**PRODUCTION GATE.** Restraint still needs visible focus, state, and help.

#### 13 · Nothing Phone (3) — Glyph Matrix

**Source:** [official product page](https://nothing.tech/products/phone-3)

**VERIFIED FACT.** The rear Glyph Matrix uses 489 micro-LEDs for notifications, timers, volume visualization, NFC animation, utilities, and playful experiences.

**DESIGN READING.** A peripheral low-resolution layer can make status glanceable without reopening the main screen.

**UI TRANSLATION.** Create a secondary layer that compresses status into pattern and rhythm.

**PRODUCTION GATE.** Every essential message must also be available as text and through the primary accessible interface.

#### 14 · CMF Buds Pro 2 — charging-case Smart Dial

**Sources:** [official support category](https://support.cmf.tech/hc/en-us/categories/26040605225873-Buds-pro-2), [Smart Dial functions](https://support.cmf.tech/hc/en-us/articles/26407573025425-What-is-the-function-of-the-knob-on-the-charging-case)

**VERIFIED FACT.** The dial can map rotation and several click gestures to functions configured in the Nothing X app; it has no assigned function by default.

**DESIGN READING.** A compact multifunction control trades surface area for a larger learnability burden.

**UI TRANSLATION.** Use a multifunction control to reduce reach only when its current mapping is visible and feedback is immediate.

**PRODUCTION GATE.** Hidden gesture vocabularies require onboarding, discoverability, an undo path, and mode/state feedback.

#### 15 · Devialet Phantom / Phantom Ultimate — coupled lateral woofers

**Sources:** [official Phantom product page](https://www.devialet.com/en-us/phantom-speaker/phantom-ultimate-98db/), [official design page](https://www.devialet.com/en-us/phantom-speaker/phantom-design/)

**VERIFIED FACT.** Phantom uses two synchronized lateral woofers that move in opposition.

**DESIGN READING.** Their movement makes low-frequency output physically visible.

**UI TRANSLATION.** Let a component embody its output—load, intensity, or signal—when the mapping is truthful and legible.

**PRODUCTION GATE.** Motion is supplementary; exact value, warning state, and reduced-motion presentation remain available.

#### 16 · Astell&Kern A&ultima SP3000

**Source:** [official product page](https://www.astellnkern.com/en/product/view.php?idx=133)

**VERIFIED FACT.** SP3000 uses a 904L stainless-steel body and an LED volume wheel that can communicate playback information.

**DESIGN READING.** Faceted framing protects and emphasizes the wheel as the object’s primary continuous control.

**UI TRANSLATION.** Frame one high-frequency continuous control as the crafted centerpiece while keeping its numeric value explicit.

**PRODUCTION GATE.** Sharp gradients and material effects must not reduce contrast or scrolling performance.

#### 17 · Singer-reimagined Porsche 911 instrumentation — cross-project reading

**Sources:** [Singer official project release](https://singervehicledesign.com/press/introducing-the-porsche-911-carrera-coupe-reimagined-by-singer/), [Smiths instrument case study](https://www.smiths-instruments.co.uk/projects/singer-vehicle-design/)

**VERIFIED FACT.** Across related but distinct Singer projects, the familiar five-dial 911 architecture is reinterpreted with bespoke instruments; the linked instrument supplier also documents discreet digital capability. The two sources do not describe one identical implementation.

**DESIGN READING.** Typography, material, and switchgear are resolved as one system rather than isolated retro details; analog and digital are not treated as enemies.

**UI TRANSLATION.** When invoking a historical language, redraw the complete information hierarchy and numeral system coherently.

**PRODUCTION GATE.** Nostalgia cannot justify illegibility, fake aging, or indiscriminate skeuomorphism.

#### 18 · SBB railway station clock / Mondaine stop2go

**Sources:** [Museum für Gestaltung eGuide](https://www.eguide.ch/en/objekt/sbb-bahnhofsuhr/), [Mondaine stop2go](https://mondaine.com/pages/stop2go)

**VERIFIED FACT.** Hans Hilfiker tested a red-seconds prototype in 1943; SBB standardized the station clock in 1944; he designed the current paddle-shaped red hand in 1952, and it entered use in 1955. Mondaine licensed the SBB dial language in 1986. On stop2go models, the second hand completes its rotation in 58 seconds, pauses at 12 for two seconds, and then the minute hand advances.

**DESIGN READING.** A small but purposeful timing behavior became a recognizable signature because it expressed system logic.

**UI TRANSLATION.** Let one distinctive timing behavior become identity when it communicates what the system is doing.

**PRODUCTION GATE.** Choreography must never disguise actual latency or delay confirmation of an action.

#### 19 · SpaceX Crew Dragon displays

**Sources:** [NASA display paper](https://nepp.nasa.gov/docs/etw/2022/14-jun-tue/1540-ryder-20220008993.pdf), [NASA Crew Dragon controls note](https://blogs.nasa.gov/commercialcrew/2020/05/page/10/), [NASA crew-interface guidance](https://www.nasa.gov/reference/10-0-crew-interfaces-vol-2/)

**VERIFIED FACT.** Crew Dragon uses three touchscreen display units, touchscreen-compatible gloves, and physical manual-control options. NASA guidance emphasizes explicit display/control relationships, redundant cues for critical color coding, immediate feedback, and distinct treatment of hazardous controls.

**DESIGN READING.** Automation, touch interaction, and independent/manual control paths form a layered safety strategy rather than an argument that screens should replace everything.

**UI TRANSLATION.** Keep critical information simultaneous, guard irreversible action, and provide redundant control paths.

**PRODUCTION GATE.** Borrow the principles, not a speculative imitation of a spacecraft screen.

#### 20 · PRESTO DL 400 SE — timed-flow shower control

**Sources:** [PRESTO technology overview](https://presto.fr/en/company/technologies/), [DL 400 range](https://presto.fr/en/robinetteries/dl400/)

**VERIFIED FACT.** The French manufacturer documents the DL 400 range; the DL 400 SE uses a push control, timed flow, anti-blocking behavior, and controlled flow rate.

**DESIGN READING.** Severe operational constraints reveal a component’s irreducible core: one action, one immediate result, and straightforward serviceability.

**UI TRANSLATION.** Design the institutional version of a component: one clear action, durable feedback, minimal ambiguity, and easy recovery or service.

**PRODUCTION GATE.** Do not romanticize punitive environments or invent a “Swedish prison,” piezo mechanism, or firehose-cleaning provenance; clarity and robustness are the transferable principles.

---

## 4 · TRANSLATION SYSTEM

### 4.1 Translate the shorthand

| Creative shorthand | Production interpretation |
|---|---|
| “Color = function” | Color reinforces function; label, shape, icon, pattern, or position supplies a second cue. |
| “One red/orange element” | A composition heuristic, not a state model. Danger, warning, success, focus, and selection retain distinct semantic roles. |
| “Tiny silkscreen labels” | Reserve 9–11 px styling for nonessential engraving or metadata. Functional labels default to a readable relative size and survive 200% text zoom. |
| “Labels outside controls” | A visual option. Every control still has a visible, programmatically associated label and an accessible name matching that wording. |
| “No tooltips” | The core loop is self-labeled. Supplemental tooltips may work on focus and hover but never contain the only instruction. |
| “Show state mechanically” | Motion may reinforce state; persistent text/graphics and programmatic state remain available. |
| “Prefer modes over menus” | Use modes only when the active mode is continuously visible, reversible, and operable without a hidden modifier. |
| “Four choices per panel” | A progressive-disclosure goal, not a reason to hide frequent actions. |
| “No menus deeper than two levels” | A warning to repair information architecture, not an arbitrary hard limit. |
| “One hero control” | Valid only when it reflects task priority; spectacle never outranks the user’s primary action. |

### 4.2 Scoped starter styles—not sampled brand colors

These values are intentionally project-neutral starting points. They are scoped, semantic, and incomplete until tested in the real interface.

```css
.sol-atlas {
  --sol-font-ui: "Space Grotesk", system-ui, sans-serif;
  --sol-font-data: "JetBrains Mono", ui-monospace, monospace;

  --sol-text-body: 1rem;
  --sol-text-label: 0.8125rem;
  --sol-target-min-size: 2.75rem; /* 44 CSS px house target */
  --sol-focus-width: 2px;
  --sol-motion-snap: 80ms;
  --sol-motion-state: 160ms;

  font-family: var(--sol-font-ui);
  font-size: var(--sol-text-body);
  line-height: 1.5;
  color: var(--sol-text);
  background: var(--sol-bg);
}

.sol-atlas[data-language="playful"] {
  color-scheme: light;
  --sol-bg: #D9D8D4;
  --sol-panel: #F2F0EA;
  --sol-text: #1C1C1C;
  --sol-text-muted: #55534F;
  --sol-border: #6E6B65;
  --sol-accent: #8A2E00;
  --sol-accent-fill: #FF5A1F;
  --sol-on-accent-fill: #161616;
  --sol-focus: #0057B8;
  --sol-danger: #A51D27;
  --sol-success: #006B3C;
  --sol-warning: #735100;
}

.sol-atlas[data-language="precision-industrial"] {
  color-scheme: dark;
  --sol-bg: #17191B;
  --sol-panel: #24272A;
  --sol-text: #F4F5F5;
  --sol-text-muted: #BEC4C8;
  --sol-border: #777D81;
  --sol-accent: #FF8A3D;
  --sol-accent-fill: #FF8A3D;
  --sol-on-accent-fill: #111315;
  --sol-focus: #75BFFF;
  --sol-danger: #FF7B82;
  --sol-success: #59D59B;
  --sol-warning: #FFD166;
}

.sol-control {
  min-inline-size: var(--sol-target-min-size);
  min-block-size: var(--sol-target-min-size);
  font: inherit;
  color: var(--sol-text);
  background: var(--sol-panel);
  border: 1px solid var(--sol-border);
}

.sol-control:focus-visible {
  outline: var(--sol-focus-width) solid var(--sol-focus);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .sol-atlas [data-motion] {
    animation: none !important;
    transition-duration: 0.01ms !important;
  }
}

@media (forced-colors: active) {
  .sol-control { border-color: ButtonText; }
  .sol-control:focus-visible { outline-color: Highlight; }
}
```

Values are examples, not a compliance guarantee. Test every foreground/background/state combination. WCAG 2.2 AA requires 4.5:1 contrast for normal text and 3:1 for meaningful non-text UI components in the applicable criteria. The WCAG minimum pointer-target criterion is 24 × 24 CSS px with defined exceptions; **44 × 44 CSS px is the Sol house target**.

### 4.3 Typography

- Functional labels default to **13–16 px equivalent in relative units**, depending on platform and density. Micro-labels below that range are nonessential and remain legible when enlarged.
- Use a geometric grotesk for interface language and a mono face selectively for data, scales, IDs, and instrument-like metadata.
- Dial numerals use tabular lining figures and a clear unit. Radial text is decorative unless it remains readable at operating size.
- Hierarchy comes from position, weight, grouping, and space before dramatic size changes.
- Test 200% text zoom, 320 CSS px reflow, localization expansion, long values, and user font overrides.
- Verify every font’s license before production.

### 4.4 Component grammar

**Knob / rotary.** A visual dial may expose slider semantics. Support arrow keys, Home/End where appropriate, typed or stepper input for precision, and a visible value with unit. Circular dragging is never the only path.

**Button / key.** Start with a native button. Resting affordance must be visible without hover. Press feedback is immediate and should not shift surrounding layout.

**Toggle / switch.** Use checkbox semantics or `role="switch"` with an unchanging label and programmatic checked state. A pivot animation may reinforce, not replace, the state.

**Scrubber.** Expose current time, duration, minimum, maximum, and step. Provide keyboard and button alternatives to dragging.

**Gauge.** Present the exact value, unit, range, and status as text. A read-only gauge does not pretend to be an interactive slider.

**Mascot / status scene.** Treat decorative animation as redundant. Meaningful state changes are also carried by visible text and a suitable live-status mechanism.

**Guarded action.** Prefer undo for reversible operations and explicit confirmation for irreversible ones. Confirmation copy states the object and consequence, not “Are you sure?” alone.

**Modes and modifiers.** Keep the active mode continuously visible. Every essential action has a non-modifier path.

### 4.5 Layout

1. Use a visible underlying grid, but group by task before geometric symmetry.
2. Let whitespace perform most grouping; add borders or regions when users need stronger structure.
3. Give one control special treatment only when it is genuinely the primary action or metric.
4. Keep critical status persistent and close to its control.
5. Put frequent actions within comfortable reach without crowding screen edges or breaking logical focus order.
6. Choose either restrained flatness or explanatory depth. Avoid effects that imply false affordance.
7. On narrow screens, preserve task order and exact values before ornamental composition.

### 4.6 Anti-patterns

- Color assigned by decoration rather than semantic role.
- Brand colors or distinctive control arrangements copied as a bundle.
- Motion-only, color-only, sound-only, hover-only, or drag-only meaning.
- Tiny gray-on-gray functional labels used to simulate “industrial” taste.
- Custom dials replacing faster native inputs without a measurable benefit.
- Modes whose current state is not continuously visible.
- Material gradients on every surface, creating “luxury soup.”
- Decorative screws, knurling, linkages, or wear that imply a function they do not have.
- A mascot replacing real progress, failure, privacy, or permission status.
- Hidden settings justified by citing Leica, or needless menus justified by citing software complexity.

---

## 5 · PRODUCTION CONTRACT

`AESTHETIC RULES ARE DEFAULTS. USER COMPREHENSION, ACCESSIBILITY, PLATFORM CONVENTIONS, AND TASK COMPLETION OVERRIDE THEM.`

Target [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) for web content and follow the target platform’s accessibility conventions. Prefer native semantics before custom ARIA; when a custom pattern is necessary, use the [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/patterns/) as implementation guidance and test with real assistive technology.

### 5.1 Complete state contract

Every interactive component specifies:

| State | Required treatment |
|---|---|
| Rest | Function and affordance are identifiable without hover. |
| Hover | Optional enhancement; essential content never exists only here. |
| Focus-visible | Persistent, unclipped, and visually distinct; never hidden by sticky UI. |
| Active / pressed | Immediate response without layout shift. |
| Selected / on | At least two perceptible cues plus programmatic state. |
| Disabled / unavailable | Label remains readable; explain why nearby when useful. |
| Busy / loading | Preserve context, expose determinate progress when known, and announce completion or failure appropriately. |
| Error / warning / success | Icon or text accompanies color; identify the affected item and recovery action. |
| Empty / offline / denied | Explain the condition and present the next valid action. |

### 5.2 Input and resilience requirements

- Keyboard and switch access follow a logical order and operate all functionality covered by the conformance target.
- Pointer and touch targets meet the applicable minimum and spacing requirements; the house target is 44 × 44 CSS px.
- Drag-and-drop and circular dragging have a single-pointer or button/menu alternative.
- Focus is never trapped unintentionally, obscured, or lost after dialogs and dynamic updates.
- Meaning survives reduced motion, forced colors, high contrast, zoom, narrow reflow, and localization.
- Privacy, recording, destructive, and permission states are explicit in text as well as visually encoded.
- Loading, latency, offline operation, failure, and recovery are designed—not left to the framework default.

### 5.3 Accessibility references

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Understanding Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
- [Understanding Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [ARIA switch pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)
- [ARIA slider pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)

---

## 6 · ORIGINALITY, RIGHTS, AND PROVENANCE

Use references to extract principles, not signatures.

- Do not reproduce a source’s exact silhouette, control arrangement, palette ratios, icon set, labels, distinctive animation, or hero gesture as a bundle.
- Combine principles from several sources, then invent one project-specific signature interaction justified by the user’s task.
- Remove logos and brand names from production comps unless inclusion is authorized.
- A linked image is not automatically licensed for reuse. Record creator, URL, access date, asset license, and intended use.
- Verify font, icon, sound, and image licensing before shipping.
- Tag research claims as `VERIFIED FACT`, `DESIGN READING`, `UI TRANSLATION`, or `TO VERIFY`.
- Run the **distance test**: if a logo-free screenshot is immediately mistaken for one named brand or product, transform it further.
- Review similarity across silhouette, layout, palette, typography, iconography, microcopy, and motion—not just pixel-level resemblance.

This is an originality workflow, not legal advice. Obtain qualified review when release risk is material.

---

## 7 · PROJECT WORKSHEET

```text
PRODUCT:
PRIMARY USER:
PRIMARY TASK:
PLATFORM / INPUTS:
CONTENT DENSITY:
ACCESSIBILITY TARGET:
DOMINANT LANGUAGE: playful-technical | precision-industrial | neither

REFERENCE 1 — STRUCTURE:
principle to borrow:
recognizable feature not to copy:

REFERENCE 2 — INTERACTION:
principle to borrow:
recognizable feature not to copy:

REFERENCE 3 — SURFACE / CHARACTER:
principle to borrow:
recognizable feature not to copy:

PROJECT-SPECIFIC SIGNATURE:
why it helps the task:
conventional fallback:
reduced-motion fallback:

CORE STATES:
empty | ready | active | busy | success | warning | error | offline | denied

SHIP RISKS:
facts to verify:
assets/licenses to verify:
accessibility tests:
usability assumptions:
```

---

## 8 · AI BUILDER BRIEF

> Use **Design Reference Atlas — 5.6 Sol** as a principle library, not an imitation instruction. Begin with the user, task, content, platform, and accessibility target. Select no more than three references and state the abstract principle taken from each. Create an original hierarchy and one project-specific signature interaction. Preserve native semantics and platform conventions. Provide all component states, keyboard behavior, accessible names, non-drag alternatives, exact text equivalents for motion and gauges, reduced-motion behavior, forced-color behavior, 200% zoom, narrow reflow, localization expansion, errors, empty states, latency, offline behavior, and recovery. Scope semantic tokens to the chosen language. Never rely on color, motion, position, sound, hover, or dragging alone. Do not fabricate product facts, specifications, source status, or licensing. Do not copy logos, proprietary icons, product silhouettes, distinctive layouts, branded animations, or unlicensed assets.

**Required builder output**

1. User and task assumptions.
2. Reference-to-principle mapping.
3. Originality departure note.
4. Scoped semantic tokens.
5. Component anatomy and complete state matrix.
6. Keyboard and assistive-technology contract.
7. Responsive, reduced-motion, and high-contrast behavior.
8. Verification plan and unresolved claims.

---

## 9 · RELEASE RUBRIC

| Category | Weight |
|---|---:|
| Task clarity and information hierarchy | 20 |
| Accessible operation and semantics | 20 |
| Complete states, feedback, and recovery | 15 |
| Visual-system coherence | 15 |
| Responsive, zoom, and content resilience | 10 |
| Originality, rights, and provenance | 10 |
| Motion restraint and performance | 5 |
| Evidence and cross-platform validation | 5 |
| **Total** | **100** |

**Release threshold:** 85/100 with no hard-gate failure.

**Hard gates**

- All functionality covered by the conformance target works with the target platform’s keyboard/switch access, pointer/touch, and assistive technology.
- Contrast, focus visibility, accessible name/role/value, and target-size requirements pass.
- No meaning depends only on color, motion, sound, position, hover, or dragging.
- Reduced-motion and forced-color modes retain all information and controls.
- Destructive actions support confirmation or recovery appropriate to consequence.
- No unresolved fabricated fact, unlicensed production asset, or recognizable one-brand imitation ships.

---

## 10 · ONE-PARAGRAPH DIRECTION BRIEF

> Build the interface like a precise instrument, not a themed skin: start with the user’s primary task on a calm neutral field; use a strict but task-led grid; keep core state and values visible beside their controls; reserve saturated color for stable semantic roles and always add a second cue; give one genuinely important control extra craft; and let motion, depth, and material explain cause, hierarchy, or feedback. Preserve familiar operation, native semantics, readable labels, complete states, non-drag alternatives, reduced-motion behavior, and resilient layouts. Borrow principles from the references, never their recognizable bundle. When a flourish does not improve prediction, feedback, comprehension, or delight in the core task, remove it.

---

`END · DESIGN REFERENCE ATLAS — 5.6 Sol · ORIGINAL SOURCE FILE LEFT UNCHANGED`
