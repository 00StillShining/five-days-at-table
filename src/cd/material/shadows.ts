/**
 * src/cd/material/shadows.ts — the four-layer stack, composed.
 *
 * II.2.3 fixes the roles and the geometry: rim light on top and left edges only
 * (#FFFFFF40, the machined edge catch); lip on bottom and right (#00000052, the
 * edge turning away); cast shadows drop STRAIGHT DOWN at control scale, vector
 * x:y = 0:1; recess wells alone carry the full 1:2 vector, because a well's
 * shadow must show its own cast direction against a bounded interior.
 *
 * II.2.5 gives the four depth tiers their budgets. CORRECTIONARY 3.1 revokes
 * the "exactly 1" cap on tier 3: the tiers survive as construction SETS, never
 * as a ration. `stack("hero")` may be called six times on one screen and that
 * is the normal condition here.
 *
 * II.2.6 gives the press grammar: 1px of travel on transform, core and ambient
 * tighten, the contact line NEVER moves, and no box dimension changes.
 *
 * tokens/material.css already ships these as custom properties for the static
 * case. This module exists for the case CSS cannot cover: a stack whose ambient
 * radius is computed from the object's own size, and II.2.23's neighbour
 * occlusion, which needs a measured distance.
 */

export type Tier = "flat" | "chassis" | "control" | "hero";

export interface ShadowLayer {
  /** The role this layer plays. Every layer has one; a layer without one is cut. */
  role: "rim" | "lip" | "contact" | "core" | "ambient";
  inset: boolean;
  x: number;
  y: number;
  blur: number;
  color: string;
}

/** II.2.3 — the committed edge pair. */
export const RIM = "#FFFFFF40";
export const LIP = "#00000052";
export const CONTACT = "#00000066";
export const CORE = "#0000003D";
export const AMBIENT = "#00000021";

const TIERS: Record<Tier, ShadowLayer[]> = {
  // tier 0 — flat information: numerals, labels, plots, tick rings. No shadow.
  flat: [],

  // tier 1 — quiet chassis: faceplate, rails, trays, escutcheons.
  chassis: [
    { role: "rim", inset: true, x: 0, y: 1, blur: 0, color: "#FFFFFF14" },
    { role: "contact", inset: false, x: 0, y: 1, blur: 0, color: "#00000038" },
  ],

  // tier 2 — tactile control: anything a hand operates. The full stack.
  control: [
    { role: "rim", inset: true, x: 0, y: 1, blur: 0, color: RIM },
    { role: "lip", inset: true, x: 0, y: -1, blur: 0, color: LIP },
    { role: "contact", inset: false, x: 0, y: 1, blur: 0, color: CONTACT },
    { role: "core", inset: false, x: 0, y: 3, blur: 6, color: CORE },
    { role: "ambient", inset: false, x: 0, y: 10, blur: 24, color: AMBIENT },
  ],

  // tier 3 — resolved hero. NOT rationed to one per screen (CORRECTIONARY 3.1).
  hero: [
    { role: "rim", inset: true, x: 0, y: 1, blur: 0, color: "#FFFFFF4D" },
    { role: "lip", inset: true, x: 0, y: -1, blur: 0, color: "#00000047" },
    { role: "contact", inset: false, x: 0, y: 1, blur: 0, color: CONTACT },
    { role: "core", inset: false, x: 0, y: 4, blur: 8, color: "#00000040" },
    { role: "ambient", inset: false, x: 0, y: 24, blur: 56, color: "#00000029" },
  ],
};

function render(layers: readonly ShadowLayer[]): string {
  return layers
    .map((l) => `${l.inset ? "inset " : ""}${l.x}px ${l.y}px ${l.blur}px ${l.color}`)
    .join(", ");
}

/** The layer list for a tier, as data — for tests, and for composing variants. */
export function layers(tier: Tier): readonly ShadowLayer[] {
  return TIERS[tier];
}

/** The box-shadow value for a tier. */
export function stack(tier: Tier): string {
  return render(TIERS[tier]);
}

/**
 * II.2.6 — press shortens the shadow. Core and ambient tighten; the 1px CONTACT
 * LINE NEVER MOVES, because the object has not left the panel — it has arrived
 * at it. The rim compresses because less edge is presented to the light.
 * No box dimension changes: travel lives on transform, layout is untouchable.
 */
export function pressed(tier: Tier): string {
  return render(
    TIERS[tier].map((l) => {
      switch (l.role) {
        case "rim":
          return { ...l, color: "#FFFFFF2E" };
        case "contact":
          return l; // by law
        case "core":
          return { ...l, y: Math.max(1, Math.round(l.y / 2)), blur: Math.round(l.blur / 3) };
        case "ambient":
          return { ...l, y: Math.round(l.y * 0.42), blur: Math.round(l.blur * 0.42) };
        default:
          return l;
      }
    })
  );
}

/**
 * II.2.3 — the recess well. The pair INVERTS: shadow enters at the top, the lit
 * lip closes the bottom, and this is the one place the full 1:2 cast vector is
 * spent, because a well's shadow must show its cast direction against a bounded
 * interior.
 */
export function well(depth = 1): string {
  return [
    `inset ${depth}px ${depth * 2}px ${depth * 4}px #00000047`, // the well itself, 1:2
    `inset 0 -1px 0 #FFFFFF1F`, // lip — the cut edge catching light
  ].join(", ");
}

/**
 * II.2.5's hero ambient scaled to the object. "A hero" at 3rem and one at 22rem
 * cannot share a 56px ambient throw and both read as sitting in the same room.
 * Ambient offset and blur scale with the object's larger dimension, pinned to
 * the tier-3 reference of 24px / 56px at a 320px hero.
 */
export function heroStack(sizePx: number): string {
  const k = Math.max(0.5, Math.min(2, sizePx / 320));
  return render(
    TIERS.hero.map((l) =>
      l.role === "ambient"
        ? { ...l, y: Math.round(l.y * k), blur: Math.round(l.blur * k) }
        : l
    )
  );
}

/**
 * II.2.23 — neighbours cast onto each other. "The higher piece's ambient shell
 * darkens the near edge of whatever shares its space ... an additional 6%
 * multiply darkening, CAPPED AT 10%, layered ON TOP of — never substituting for
 * — the neighbour's own rest-state shadow."
 *
 * Returns 0 outside the casting control's own ambient radius, rising to the cap
 * as the two close. Feed it into --cd-neighbour-strength; the multiply layer
 * itself lives in tokens/material.css.
 */
export const OCCLUSION_BASE = 0.06;
export const OCCLUSION_CAP = 0.1;

export function occlusionStrength(distancePx: number, ambientRadiusPx: number): number {
  if (distancePx >= ambientRadiusPx || ambientRadiusPx <= 0) return 0;
  const closeness = 1 - distancePx / ambientRadiusPx;
  return Math.min(OCCLUSION_CAP, OCCLUSION_BASE + (OCCLUSION_CAP - OCCLUSION_BASE) * closeness);
}

/**
 * II.2.17 — the three bloom shells at r / 4r / 12r, alpha 80% / 40% / 16%, hue
 * held constant across all three.
 *
 * II.2.24 — "when centre-to-centre spacing between emissive elements falls
 * under twice the widest bloom shell, every lamp in the cluster scales its
 * three shells down TOGETHER until neighbouring shells stop touching. The
 * r : 4r : 12r ratio holds at any scale — a crowded lamp glows smaller, never
 * differently shaped — and the CORE never shrinks, only the shells."
 */
export function bloom(hex: string, baseR = 2, spacingPx = Infinity): string {
  const outer = Math.min(12 * baseR, spacingPx / 2);
  const k = outer / (12 * baseR);
  const r1 = baseR * k;
  const r2 = 4 * baseR * k;
  const r3 = 12 * baseR * k;
  return [
    `0 0 ${r1.toFixed(1)}px ${hex}CC`, // shell 1 — r, 80%
    `0 0 ${r2.toFixed(1)}px ${hex}66`, // shell 2 — 4r, 40%
    `0 0 ${r3.toFixed(1)}px ${hex}29`, // shell 3 — 12r, 16%
  ].join(", ");
}
