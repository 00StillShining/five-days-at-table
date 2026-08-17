/**
 * src/cd/material/specular.ts — how a surface answers the one sun.
 *
 * Two mechanisms, and the difference between them is the difference between
 * chrome and brushed aluminium:
 *
 * II.2.8 — the HARD MIRROR. "Chrome does not shade, it reflects: bright sky, a
 * hard horizon, dark ground, one bounce — TWO HARD STOP PAIRS at 47%/48% and
 * 62%/63% ... nothing soft in between." A stop pair is two colour stops at
 * adjacent percentages, which is what produces an edge rather than a ramp. Get
 * the pair wrong by one percent and chrome becomes grey plastic.
 *
 * II.2.7 — the ANISOTROPIC BAND. "Brushed metal is grain plus an anisotropic
 * answer to the sun: a specular band that runs ACROSS the grain, never along
 * it. Grain pitch 3px at +/-4% luminance; band centred at 47% of the light
 * axis, brightest stop #D6D9DD."
 *
 * Both are keyed per world: II.2's hexes are worked examples in neutral greys,
 * and "a language re-keys hue and value to its own palette without touching
 * structure". So both functions take endpoint values and hold the STRUCTURE —
 * the stop percentages — fixed.
 */

/** II.2.8 — the two pairs. These percentages are the recipe; they never move. */
export const HORIZON_PAIR: readonly [number, number] = [47, 48];
export const BOUNCE_PAIR: readonly [number, number] = [62, 63];

/** II.2.7 — the anisotropic band's centre, as a percentage of the light axis. */
export const BAND_CENTRE = 47;

export interface MirrorKeys {
  /** The bright sky at the top of the reflection. */
  sky: string;
  /** Sky as it falls toward the horizon. */
  skyFall: string;
  /** The last light above the horizon line. */
  horizonHigh: string;
  /** The dark ground immediately below it — the hard edge. */
  horizonLow: string;
  /** Ground as it rises toward the bounce. */
  groundRise: string;
  /** The bounce itself — the second hard edge. */
  bounce: string;
  /** The bright return at the bottom. */
  base: string;
}

/**
 * The neutral bench keys of II.2.8, verbatim. A world overrides any subset;
 * REEL LOGIC darkens both ends to #161719 .. #E2E3E4, FACETED VOLUME to
 * #9FA4A7 .. #EDEFEF, IRREDUCIBLE re-values against a LIGHT field at
 * #8A8C8E .. #ECECEA. All three keep these stop percentages exactly.
 */
export const BENCH_MIRROR: MirrorKeys = {
  sky: "#F2F4F7",
  skyFall: "#C6CBD1",
  horizonHigh: "#6A6F76",
  horizonLow: "#23262B",
  groundRise: "#3C4046",
  bounce: "#969BA2",
  base: "#DFE2E6",
};

/**
 * A hard-mirror gradient. `angle` defaults to 178deg — II.2.8's own figure,
 * two degrees off vertical so the horizon is not a perfectly level line.
 *
 * NEVER SET TYPE DIRECTLY ON THIS. A hard mirror crosses from #F2F4F7 to
 * #23262B across one hard stop pair, so any single ink colour laid over it is
 * legible on one half and invisible on the other — measured on the bench keys,
 * #141414 reads 14.9:1 against the sky and 1.2:1 against the horizon's dark
 * side. CD-BRIEF ruling 5 already forbids it by rule ("text never renders raw
 * over carbon weave or brushed grain ... text-on-carbon is a HARD FAIL BY RULE,
 * not by measured ratio"), and chrome is the same argument with a worse range.
 * A chrome key carries its legend on an engraved `.cd-plate` inset into the
 * cap, never painted onto the reflection.
 */
export function hardMirror(keys: Partial<MirrorKeys> = {}, angle = 178): string {
  const k = { ...BENCH_MIRROR, ...keys };
  return (
    `linear-gradient(${angle}deg, ` +
    `${k.sky} 0%, ` +
    `${k.skyFall} 34%, ` +
    `${k.horizonHigh} ${HORIZON_PAIR[0]}%, ` + // hard pair — the horizon
    `${k.horizonLow} ${HORIZON_PAIR[1]}%, ` +
    `${k.groundRise} ${BOUNCE_PAIR[0]}%, ` + // hard pair — the ground bounce
    `${k.bounce} ${BOUNCE_PAIR[1]}%, ` +
    `${k.base} 100%)`
  );
}

export interface BandKeys {
  edgeLow: string;
  rise: string;
  /** The brightest stop, at BAND_CENTRE. The bench value is #D6D9DD. */
  peak: string;
  fall: string;
  edgeHigh: string;
}

export const BENCH_BAND: BandKeys = {
  edgeLow: "#8E9298",
  rise: "#B4B8BD",
  peak: "#D6D9DD",
  fall: "#A8ACB2",
  edgeHigh: "#7F838A",
};

/**
 * The anisotropic band. `angle` defaults to 160deg — II.2.7's own figure, which
 * runs the band ACROSS a 90deg grain. Pass the grain axis plus 70 degrees to
 * keep that relationship on any other grain direction; a band running ALONG the
 * grain is the single tell that turns brushed metal back into a gradient.
 */
export function anisotropicBand(keys: Partial<BandKeys> = {}, angle = 160): string {
  const k = { ...BENCH_BAND, ...keys };
  return (
    `linear-gradient(${angle}deg, ` +
    `${k.edgeLow} 0%, ` +
    `${k.rise} 34%, ` +
    `${k.peak} ${BAND_CENTRE}%, ` +
    `${k.fall} 60%, ` +
    `${k.edgeHigh} 100%)`
  );
}

/** II.2.7 — the grain pass: 3px pitch at +/-4% luminance, across the band. */
export function grain(angleDeg = 90, strength = 1): string {
  const light = Math.round(15 * strength)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  const dark = light;
  return (
    `repeating-linear-gradient(${angleDeg}deg, ` +
    `#FFFFFF00 0px, #FFFFFF${light} 1px, #000000${dark} 2px, #FFFFFF00 3px)`
  );
}

/**
 * II.2.12 — lacquer's wet window: ONE small hard reflection ellipse at 8%/7%,
 * sized 34% x 26%, core #FFFFFF59. "The window is fixed to the sun and does not
 * travel on press" — so this returns a static background, never an animated one.
 */
export function lacquerWindow(core = "#FFFFFF59"): string {
  return `radial-gradient(closest-side, ${core} 0%, #FFFFFF21 55%, #FFFFFF00 100%)`;
}

/**
 * II.2.4 — texture rotates, light HOLDS. Returns the pair of transforms an
 * assembly needs: the grip turns with the value, the lighting plate does not.
 * The separation is what carries most of the illusion of a real part, and it is
 * a two-line rule that is trivially got backwards.
 */
export function rotaryLayers(angleDeg: number): { grip: string; light: string } {
  return { grip: `rotate(${angleDeg}deg)`, light: "none" };
}

/**
 * The fixed lighting plate a rotary mounts OVER its grip. Pair it with the grip
 * tile from `texture({ pattern: "knurl", ... })`; a knurl tile with no plate
 * over it renders as a flat disc of teeth with no sun on it, which is a texture
 * swatch rather than a machined part.
 *
 * The plate is `pointer-events: none` by construction — the room does not turn,
 * and the room is not clickable.
 */
export const ROTARY_LIGHT_PLATE = {
  background: "var(--cd-rotary-light)",
  boxShadow: "var(--cd-rotary-light-shadow)",
  pointerEvents: "none",
} as const;
