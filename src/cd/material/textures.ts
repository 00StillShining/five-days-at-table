/**
 * src/cd/material/textures.ts — procedural material, painted once.
 *
 * CD-BRIEF product ruling 7: "Procedural materials only. Canvas textures
 * painted once and cached by {pattern, scale, dpr}; no image assets; WebGL is
 * BANNED (single-file build + offline). Build stays under a 2.0 MB amber line."
 *
 * II.2.22 — "Escalate to canvas only when texture must be unique per instance
 * or track state per frame ... canvas plates are painted once and cached ...
 * A texture repainting every frame without a state reason has failed this
 * rule." Every factory below paints ONE tile and returns a data URL; the tile
 * repeats via background-repeat, so a 480x160 plate costs one paint no matter
 * how many nodes wear it.
 *
 * CORRECTIONARY 3.3 removes the intensity cap that II.2 put on these recipes.
 * The construction methods are unchanged and the strengths are raised: the only
 * test is "does this read as the material it claims to be?", never "is it quiet
 * enough?". Each factory takes an explicit `strength` so a screen can push
 * further without editing this file.
 *
 * The CSS gradient recipes in tokens/material.css cover the common case. These
 * exist for the three textures a repeating-linear-gradient cannot honestly
 * fake: twill that must not visibly tile, grain that runs RADIALLY around a
 * circular cap, and knurl with per-tooth highlight pairs.
 */

export type Pattern = "carbon-twill" | "radial-brushed" | "knurl";

export interface TextureRequest {
  pattern: Pattern;
  /**
   * Tile size in CSS px for carbon-twill; cap diameter for radial-brushed and
   * knurl, both of which paint a whole disc rather than a repeating tile.
   */
  scale: number;
  /** Device pixel ratio the tile was painted for. Part of the cache key. */
  dpr: number;
  /**
   * Contrast, 0-1. Defaults follow each recipe's own note below. The bible's
   * caps are gone (CORRECTIONARY 3.3); these are floors to push up from.
   */
  strength?: number;
}

const cache = new Map<string, string>();

function keyOf(r: Required<TextureRequest>): string {
  return `${r.pattern}|${r.scale}|${r.dpr}|${r.strength}`;
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * HTMLCanvasElement FIRST, OffscreenCanvas only as the fallback.
 *
 * The order matters and is not a preference. `OffscreenCanvas` has no
 * synchronous `toDataURL` — only `convertToBlob()`, which is async — so a tile
 * painted on one cannot be handed back as a `url()` in the same task. Every
 * modern browser has BOTH constructors, so preferring OffscreenCanvas made
 * `texture()` return null on every real browser while still passing a
 * document-less check: the whole factory was dead and the CSS gradient fallback
 * was silently carrying every surface.
 */
function makeCanvas(w: number, h: number): AnyCanvas | null {
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(w, h);
  return null;
}

function toDataUrl(canvas: AnyCanvas): string | null {
  // A worker's OffscreenCanvas cannot serialize synchronously. The caller gets
  // null and falls back to the CSS gradient recipe — the honest answer, not a
  // silent blank.
  if (typeof HTMLCanvasElement !== "undefined" && canvas instanceof HTMLCanvasElement) {
    return canvas.toDataURL("image/png");
  }
  return null;
}

/**
 * II.2.15 — carbon weave: 45 degree twill, two crossing passes, 8px cell over a
 * near-black plate, sealed by a resin rim. EXPOSED WORKS raises the aliasing
 * floor to a 32px cell at working density.
 *
 * The canvas version exists for II.2.15's own escalation clause: "Signature
 * runs the weave on canvas with a 2 degree axis wobble PER CELL — the tow
 * shimmer no repeating gradient can fake." The wobble is why this cannot be
 * two repeating-linear-gradients.
 */
function paintCarbonTwill(ctx: CanvasRenderingContext2D, size: number, strength: number): void {
  ctx.fillStyle = "#1B1D22"; // the near-black plate II.2.15 lays the weave over
  ctx.fillRect(0, 0, size, size);

  // Two crossing passes at +/-45 degrees. The intercept step must DIVIDE the
  // tile so the stripe that leaves one edge re-enters at the matching offset on
  // the other; anything else seams, and a seamed weave reads as printed fabric.
  // step = size/4 puts the perpendicular period at step/sqrt(2) — 11.3px on the
  // default 64px tile, inside the working density ch.05 declares (a 32px cell
  // floor at working density, opening to II.2.15's true 24px cell at Trophy
  // scale). Stripe width is half the period: the recipe's 4-on / 4-off duty.
  const step = size / 4;
  const width = step / (2 * Math.SQRT2);
  ctx.lineCap = "butt";
  ctx.lineWidth = width;

  for (const pass of [
    { sign: 1, stroke: "#FFFFFF", alpha: 0.031 }, // warp — catches the sun
    { sign: -1, stroke: "#000000", alpha: 0.02 }, // weft — turns away from it
  ]) {
    ctx.strokeStyle = pass.stroke;
    ctx.globalAlpha = Math.min(1, pass.alpha * strength);
    for (let c = -size * 2; c <= size * 2; c += step) {
      ctx.beginPath();
      if (pass.sign > 0) {
        ctx.moveTo(c, 0);
        ctx.lineTo(c + size * 3, size * 3);
      } else {
        ctx.moveTo(c, 0);
        ctx.lineTo(c - size * 3, size * 3);
      }
      ctx.stroke();
    }
  }

  // NOTE ON THE OMITTED WOBBLE. II.2.15's Signature escalation offers "a 2 degree
  // axis wobble per cell — the tow shimmer no repeating gradient can fake". It is
  // deliberately NOT implemented: rotating individual stripes breaks the intercept
  // arithmetic above and the tile seams, and a per-cell brightness jitter — the
  // obvious substitute — prints a visible quilt at the jitter's own cell size,
  // which is a worse artefact than the shimmer it was meant to add. The weave
  // ships without it. If a hero surface later earns the shimmer, it needs a
  // per-tow displacement along each stripe, not a per-cell wash.
  ctx.globalAlpha = 1;
}

/**
 * II.2.7 — brushed metal is grain plus an anisotropic answer to the sun: 3px
 * grain pitch at +/-4% luminance, a specular band across the grain.
 *
 * EXPOSED WORKS' declared delta: "EXPOSED WORKS runs that grain RADIALLY around
 * every bezel and knob cap instead of in one direction, a declared delta earned
 * by the cap's own circular form; the specular band sweeps WITH the light
 * rather than crossing it." A radial grain is exactly what a linear repeating
 * gradient cannot produce, which is why this one is canvas.
 */
function paintRadialBrushed(ctx: CanvasRenderingContext2D, size: number, strength: number): void {
  const r = size / 2;
  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, "#8E9298");
  base.addColorStop(0.34, "#B4B8BD");
  base.addColorStop(0.47, "#D6D9DD"); // the anisotropic band's brightest stop
  base.addColorStop(0.6, "#A8ACB2");
  base.addColorStop(1, "#7F838A");
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();

  // radial strokes: 3px pitch measured at the rim, so the grain reads as one
  // turned surface rather than as spokes
  const strokes = Math.max(64, Math.round((2 * Math.PI * r) / 3));
  ctx.save();
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < strokes; i++) {
    const a = (i / strokes) * Math.PI * 2;
    const jitter = (Math.sin(i * 78.233) * 43758.5453) % 1;
    ctx.strokeStyle = jitter < 0.5 ? "#FFFFFF" : "#000000";
    ctx.globalAlpha = (0.02 + Math.abs(jitter) * 0.04) * strength * 2.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r + Math.cos(a) * r * 0.06, r + Math.sin(a) * r * 0.06);
    ctx.lineTo(r + Math.cos(a) * r, r + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/**
 * II.2.4 — knurl: a repeating conic grip at an 8 degree period, and its own
 * escalation clause, "Pushed sharpens the knurl with per-tooth highlight PAIRS
 * inside the same 8deg period". A pair per tooth is what makes the grip read as
 * cut metal rather than as stripes, and a conic-gradient cannot place them.
 *
 * CORRECTIONARY 3.3: "knurling you can almost grip". Default strength 1.0 draws
 * the pairs at full contrast rather than at the bible's restrained alpha.
 */
function paintKnurl(ctx: CanvasRenderingContext2D, size: number, strength: number): void {
  const r = size / 2;
  const teeth = 45; // 360 / 8 degrees
  ctx.fillStyle = "#34373D";
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
    const a2 = ((i + 1) / teeth) * Math.PI * 2;
    // lit flank — the half of the tooth turned toward the one sun
    ctx.fillStyle = `rgba(255,255,255,${0.22 * strength})`;
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.arc(r, r, r, a0, a1);
    ctx.closePath();
    ctx.fill();
    // shadowed flank — the half turning away
    ctx.fillStyle = `rgba(0,0,0,${0.3 * strength})`;
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.arc(r, r, r, a1, a2);
    ctx.closePath();
    ctx.fill();
  }

  // the hub: knurl is a rim texture, and a cap has a machined centre
  const hub = ctx.createRadialGradient(r * 0.9, r * 0.85, 0, r, r, r * 0.55);
  hub.addColorStop(0, "#4A4E56");
  hub.addColorStop(1, "#2C2F35");
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

const DEFAULT_STRENGTH: Record<Pattern, number> = {
  // 1.0 reproduces the bible's own committed alphas; CORRECTIONARY 3.3 removed
  // the ceiling above them, so these sit deliberately past 1. They are
  // multipliers on the recipe's alpha, NOT free gain: carbon at 2.5 puts the
  // warp pass at 7.8% and the weft at 5%, which reads as tow under raking light
  // and still passes the one test that matters — "does this read as the
  // material it claims to be?"
  "carbon-twill": 2.5,
  "radial-brushed": 1.3,
  knurl: 1.0,
};

/**
 * Paint (or fetch from cache) a texture tile and return it as a data URL,
 * ready for `background-image: url(...)`.
 *
 * Cached by {pattern, scale, dpr, strength}. A second caller with the same key
 * gets the same string and no second paint — which is the whole of II.2.22's
 * budget clause. Returns null where no 2D canvas exists (SSR, or a worker with
 * only OffscreenCanvas); callers fall back to the CSS gradient recipe.
 */
export function texture(request: TextureRequest): string | null {
  const full: Required<TextureRequest> = {
    ...request,
    strength: request.strength ?? DEFAULT_STRENGTH[request.pattern],
  };
  const key = keyOf(full);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const px = Math.max(1, Math.round(full.scale * full.dpr));
  const canvas = makeCanvas(px, px);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) return null;
  ctx.scale(full.dpr, full.dpr);

  switch (full.pattern) {
    case "carbon-twill":
      paintCarbonTwill(ctx, full.scale, full.strength);
      break;
    case "radial-brushed":
      paintRadialBrushed(ctx, full.scale, full.strength);
      break;
    case "knurl":
      paintKnurl(ctx, full.scale, full.strength);
      break;
  }

  const url = toDataUrl(canvas);
  if (url === null) return null;
  cache.set(key, url);
  return url;
}

/** How many distinct tiles have been painted this session. Probe for the budget. */
export function textureCacheSize(): number {
  return cache.size;
}

/** Drop the cache. Call on a dpr change — that is the ONE repaint reason (II.2.22). */
export function clearTextureCache(): void {
  cache.clear();
}
