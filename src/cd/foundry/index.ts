/**
 * src/cd/foundry/index.ts — the enclosure vocabulary, for the seven screens.
 *
 * WHAT THIS IS. CORRECTIONARY 5.1 retires the card: "Build enclosures, not
 * cards ... If any container on your screen is a rounded rectangle with padding,
 * a border, and a soft shadow — remake it as machined housing before
 * continuing." CD-BRIEF retires II.3.32's data card by name. This is what
 * replaces both, and it is deliberately language-agnostic: not one hex is
 * written in it. Every value resolves from whatever `[data-cd-language]` scope
 * the element is rendered inside, so the same housing is smoked glass on the
 * chassis, cream painted steel on STORES and gunmetal on MEAL — and no element
 * ever reads tokens from two scopes.
 *
 *   import { Enclosure, Plate, Lamp, PressKey, Tray, Register } from "../../cd/foundry";
 *
 * ---------------------------------------------------------------------------
 * WHAT EACH ONE IS FOR
 * ---------------------------------------------------------------------------
 * Enclosure   the housing. variant="faceplate" (tier 1, the ground a cluster
 *             mounts to) | "well" (a recess cut into one) | "pod" (tier 2, a
 *             housing a hand operates) | "hero" (tier 3 — call it SIX TIMES if
 *             the screen has six heroes; CORRECTIONARY 3.1 revoked the cap) |
 *             "bezel" (chrome trim around an instrument).
 *             `grain` adds II.2.21's texture; `surface="data"` REMOVES it,
 *             which is that clause's surviving half.
 *
 * Plate       the ink plate. CD-BRIEF ruling 5 is a HARD FAIL BY RULE: text
 *             never renders raw over carbon weave or brushed grain. If a value
 *             or a label is going on a material, put it on one of these first.
 * Escutcheon  the engraved naming plate. Names a thing permanently; it never
 *             reports a value — that is what separates it from a readout.
 *
 * Lamp        II.2.17's emissive lamp, with its well, its lens ring and its
 *             three bloom shells. `word` is REQUIRED: II.7.7 does not let a
 *             colour travel alone, and the word is what survives a squint, a
 *             desaturation and forced-colours.
 *
 * PressKey    II.3.13's button. Commits on release inside bounds, ≤1-frame
 *             down-stroke bloom, 80ms release settle, haptic, keyboard-complete,
 *             44px both axes. SOUND IS OFF BY DEFAULT — pass `sound="contact"`
 *             only where your own chapter voices contact, and never for
 *             navigation (II.5.16).
 * GuardedKey  II.3.17's guarded switch, for anything consequential. Hold 350ms
 *             to arm against a real clock, press again to commit, and the guard
 *             runs out after 4000ms of neglect.
 *
 * Tray        II.3.30, under the owner's ruling: travels its own size, NO SCRIM,
 *             the workspace beneath stays live and touchable, an explicit exit,
 *             no focus trap, Escape closes. Set --cd-tray-offset if the tray
 *             must not cover something (the chassis holds it off the rail).
 *
 * Register    CD-BRIEF R7's grouped accordion. One section open at a time; the
 *             count on each lid is DERIVED from the items array and cannot be
 *             typed by hand; `limit` clips and the remainder is confessed as a
 *             number. Drive `openId` from `useOpenPanel` so it survives
 *             navigation (R6) — see src/cd/chassis/panels.tsx.
 *
 * ---------------------------------------------------------------------------
 * THE ONE THING TO REMEMBER WHEN YOU BUILD YOUR OWN CONTROL
 * ---------------------------------------------------------------------------
 * Publish its shadow stack as `--cd-stack` and set `box-shadow: var(--cd-stack)`.
 * The two-tone focus ring (CD-BRIEF repair 3) composes with that property. If
 * you set `box-shadow` directly in @layer cd.screen you will silently delete the
 * ring's dark keyline — measured, on the first build of this chassis, before the
 * pattern existed.
 */

export { Enclosure, type EnclosureProps, type EnclosureVariant } from "./Enclosure";
export { Plate, Escutcheon, type PlateProps, type EscutcheonProps } from "./Plate";
export { Lamp, type LampProps } from "./Lamp";
export { PressKey, HAPTIC_CONTACT_MS, RELEASE_SETTLE_MS, type PressKeyProps } from "./PressKey";
export { GuardedKey, ARM_HOLD_MS, GUARD_RUNOUT_MS, type GuardedKeyProps } from "./GuardedKey";
export { Tray, type TrayProps, type TrayEdge } from "./Tray";
export { Register, type RegisterProps, type RegisterGroup } from "./Register";
