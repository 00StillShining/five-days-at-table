// Shelf-life estimation over ingredients.json's `storage.life` and
// prep.json's free-text yield `storage` strings.
//
// ============================================================================
// HEURISTIC — documented per the F2 standing rule (docs/PHASE2-CONTRACT.md /
// build brief): "a life-countdown semantic the data can't support."
//
// Only 24 of 97 ingredients carry a structured day count in one of
// sealedDays/openDays/frozenDays/freshDays; the other 73 carry `prose` only
// (e.g. "2–3 weeks sealed · 5–7 days open", "Months", "Keeps three weeks").
// STORES/TODAY need a countdown for all of them (contract: dutyStack's
// "use-today/expiring" duties and STORES' per-row countdown).
//
// Resolution (conservative, grounded in the data):
// 1. `parseIngredientLife` re-derives the same four structured fields from
//    `prose` with a small grammar (quantity[-range] + unit + optional
//    sealed/open/frozen keyword; bare segment with no keyword = "fresh").
//    Verified byte-for-byte against all 24 ingredients that already carry
//    canonical numeric fields (see src/data/lifeEstimate.test.ts) — this is
//    not a guess, it reproduces the extraction pipeline's own numbers.
// 2. Where a prose segment has NO leading digit at all ("Months", "Years",
//    "Months, sealed") — 46 of the 73 — there is no number to recover; the
//    canonical extraction itself leaves these null rather than invent one,
//    and we match that at the parse layer.
// 3. `operativeLifeDays` (the only function selectors.ts should call) adds
//    ONE more layer for that residual case: a large, clearly-flagged
//    low-confidence sentinel (90d for a bare "Months", 365d for a bare
//    "Years"), which practically means "never surfaces as expiring within a
//    two-week planning horizon" — the correct behaviour, since every bare
//    case audited is a pantry-stable good (spices, oils, dried goods,
//    condiments) where the exact figure genuinely doesn't matter at this
//    timescale. `confidence` is exposed so the UI can render these
//    differently (e.g. no countdown, or "~" prefixed) if desired.
// ============================================================================

import type { Ingredient, IngredientLife, StorageClass } from "./types";

const UNIT_DAYS: Record<string, number> = {
  day: 1,
  days: 1,
  week: 7,
  weeks: 7,
  month: 30.44,
  months: 30.44,
  year: 365,
  years: 365,
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const UNIT_RE = "(day|days|week|weeks|month|months|year|years)";

/** Extract a day count from a free-text segment, or null if no leading
 * quantity (digit or number-word) is present alongside a duration unit. */
function quantityUnitDays(segment: string): number | null {
  let m = segment.match(new RegExp(`(\\d+)\\s*[\\u2013\\u2012-]\\s*(\\d+)\\s*${UNIT_RE}`, "i"));
  if (m) {
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    return Math.round(((lo + hi) / 2) * UNIT_DAYS[m[3].toLowerCase()]);
  }
  m = segment.match(new RegExp(`(\\d+)\\s*${UNIT_RE}`, "i"));
  if (m) return Math.round(Number(m[1]) * UNIT_DAYS[m[2].toLowerCase()]);
  m = segment.match(new RegExp(`\\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\b\\s*${UNIT_RE}`, "i"));
  if (m) return Math.round(NUMBER_WORDS[m[1].toLowerCase()] * UNIT_DAYS[m[2].toLowerCase()]);
  return null; // bare unit word ("Months", "Years") — no number to recover
}

type LifeBucket = "sealed" | "open" | "frozen" | "fresh";

function bucketFor(segment: string): LifeBucket {
  const s = segment.toLowerCase();
  if (/sealed|unopened/.test(s)) return "sealed";
  if (/open/.test(s)) return "open";
  if (/frozen/.test(s)) return "frozen";
  // "fresh", "cut", "riced", "ripens", "whole", or no keyword at all — all
  // describe the countdown that applies once the item is in active use.
  return "fresh";
}

export interface ParsedLife {
  sealedDays: number | null;
  openDays: number | null;
  frozenDays: number | null;
  freshDays: number | null;
}

/** Re-derive {sealedDays, openDays, frozenDays, freshDays} from a prose
 * string using the grammar documented above. Segments are split on "·"
 * (the dataset's separator) and on "," when a segment has no digit (covers
 * "Months, sealed" / "Months, opened" — a comma-joined keyword with no
 * per-segment number). */
export function parseIngredientLife(prose: string): ParsedLife {
  const rawSegments = prose.split("·").map((s) => s.trim()).filter(Boolean);
  const segments: string[] = [];
  for (const seg of rawSegments) {
    if (seg.includes(",") && !/\d/.test(seg)) segments.push(...seg.split(",").map((s) => s.trim()));
    else segments.push(seg);
  }

  const parsed = segments
    .map((seg) => ({ bucket: bucketFor(seg), days: quantityUnitDays(seg) }))
    .filter((p): p is { bucket: LifeBucket; days: number } => p.days != null);

  const sawFresh = parsed.some((p) => p.bucket === "fresh");
  const out: ParsedLife = { sealedDays: null, openDays: null, frozenDays: null, freshDays: null };
  for (const p of parsed) {
    if (p.bucket === "sealed" && out.sealedDays == null) out.sealedDays = p.days;
    else if (p.bucket === "open" && out.openDays == null) out.openDays = p.days;
    else if (p.bucket === "fresh" && out.freshDays == null) out.freshDays = p.days;
    // A frozen segment only becomes the operative frozenDays figure when
    // there's no fresh (thawed-use) countdown alongside it — matches the
    // canonical extraction: freeze-day0 meats carry "2 days fresh · 6 months
    // frozen" but only freshDays is populated (frozen shelf life is
    // deliberately not tracked once there's a short post-thaw figure).
    else if (p.bucket === "frozen" && !sawFresh && out.frozenDays == null) out.frozenDays = p.days;
  }
  return out;
}

const BARE_MONTHS_SENTINEL = 90;
const BARE_YEARS_SENTINEL = 365;

export type LifeConfidence = "numeric" | "parsed" | "low";

export interface LifeEstimate {
  days: number;
  bucket: LifeBucket;
  confidence: LifeConfidence;
  prose: string;
}

/** Merge an ingredient's canonical numeric life fields (ground truth, when
 * present) with the prose-parsed fallback. Canonical fields always win. */
function mergedLife(life: IngredientLife): ParsedLife {
  const parsed = parseIngredientLife(life.prose);
  return {
    sealedDays: life.sealedDays ?? parsed.sealedDays,
    openDays: life.openDays ?? parsed.openDays,
    frozenDays: life.frozenDays ?? parsed.frozenDays,
    freshDays: life.freshDays ?? parsed.freshDays,
  };
}

/** Which bucket order to prefer per storage class — see module doc.
 * freeze-day0/buy-frozen: the item lives in the freezer until a defrost duty
 * moves it to the fridge (inventory.updatedAt is the freshness anchor for
 * that move, per selectors.ts); freshDays is the short post-thaw countdown
 * that then applies. buy-once/topup/stagger: prefer the "opened and in use"
 * figure, falling back to the bare/fresh produce figure, then sealed. */
function bucketOrder(storageClass: StorageClass): LifeBucket[] {
  if (storageClass === "freeze-day0" || storageClass === "buy-frozen") {
    return ["fresh", "frozen", "sealed", "open"];
  }
  return ["open", "fresh", "sealed", "frozen"];
}

const FIELD_FOR_BUCKET: Record<LifeBucket, keyof ParsedLife> = {
  sealed: "sealedDays",
  open: "openDays",
  frozen: "frozenDays",
  fresh: "freshDays",
};

/**
 * The single entry point selectors.ts should use: the operative shelf-life
 * estimate for an ingredient, class-aware. Always returns a number (never
 * null) — confidence tells you how much to trust it:
 *  - "numeric": read straight from the canonical sealedDays/openDays/... field.
 *  - "parsed": recovered from prose via the grammar above.
 *  - "low": no number anywhere in the prose (bare "Months"/"Years") — a
 *    sentinel large enough to never trip an "expiring soon" threshold.
 */
export function operativeLifeDays(ing: Ingredient): LifeEstimate {
  const life = ing.storage.life;
  const merged = mergedLife(life);
  const order = bucketOrder(ing.storage.class);

  for (const bucket of order) {
    const field = FIELD_FOR_BUCKET[bucket];
    if (merged[field] != null) {
      const isCanonical = life[field] != null;
      return { days: merged[field]!, bucket, confidence: isCanonical ? "numeric" : "parsed", prose: life.prose };
    }
  }

  // Nothing parseable anywhere in the prose — bare "Months"/"Years" (or
  // similar). Pick the sentinel from whichever unit word appears.
  const s = life.prose.toLowerCase();
  const days = /year/.test(s) ? BARE_YEARS_SENTINEL : BARE_MONTHS_SENTINEL;
  return { days, bucket: order[0], confidence: "low", prose: life.prose };
}

/**
 * Best-effort day count from a short free-text storage description, for
 * prep-session yields (`prep.json`'s `yields[].storage`, e.g. "Fridge,
 * whole, 4 days", "Jar, cupboard, weeks", "FREEZER — down Wed night").
 * These have no sealed/open/frozen structure — just "does a number appear."
 * Falls back to the same low-confidence sentinels when it doesn't.
 */
export function estimateFreeTextLifeDays(text: string): { days: number; confidence: LifeConfidence } {
  const days = quantityUnitDays(text);
  if (days != null) return { days, confidence: "parsed" };
  const s = text.toLowerCase();
  if (/year/.test(s)) return { days: BARE_YEARS_SENTINEL, confidence: "low" };
  if (/month/.test(s)) return { days: BARE_MONTHS_SENTINEL, confidence: "low" };
  if (/freezer/.test(s)) return { days: BARE_MONTHS_SENTINEL, confidence: "low" }; // frozen, no figure given
  // No duration language at all (e.g. "Jar, lid off, counter") — assume a
  // conservative counter-life default rather than treating it as immortal.
  return { days: 7, confidence: "low" };
}
