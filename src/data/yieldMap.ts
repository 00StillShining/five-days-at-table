// Hand-authored mapping from prep.json yields (`{week, component}`) onto a
// single raw ingredient id, for the subset of yields where that mapping is
// unambiguous — used by the COOK completion hook (contract: "prep session
// done → stamp yields into inventory with computed use-by dates").
//
// HEURISTIC (documented per the F2 standing rule — this is the "life
// countdown semantic the data can't support" case, resolved conservatively):
//
// prep.json's `yields[]` are prepared components ("Turkey bolognese", "Efo
// riro base", "Slaw shred"), not raw ingredients — but AppState.inventory is
// keyed by ingId with a single 0–4 level + updatedAt per key (PLAN §5). Most
// yields have no 1:1 ingId: they're composites of 2–5 raw ingredients cooked
// together (bolognese = onion+carrot+courgette+turkey_mince+passata) with no
// ingredient record of their own. Forcing them into the ingId-keyed inventory
// would either invent ingredient records the canonical dataset doesn't have,
// or silently pick one constituent as a stand-in for the whole dish.
//
// So: a yield is mapped onto a raw ingId ONLY when exactly one ingredient
// >15g (i.e. excluding trivial seasoning/coating grams — the threshold that
// separates "this dish is basically ingredient X" from "this dish is made
// from several ingredients") appears across the prep ops that produce it, AND
// no earlier yield in the same session has already claimed that ingId (e.g.
// Week A's "Plain brown rice" and "Jollof" both reduce to `brown_rice` alone;
// the earlier yield in `yields[]` order wins the inventory slot, the later
// one falls back to a leftovers[] record — see engine/programs.ts). This was
// derived by hand from data/prep.json (2 sessions, 20 yields total) and
// cross-checked against every consuming meal's `covers` (which do use the
// same ingId at the expected gram order of magnitude — verified for all
// mapped entries below).
//
// Every yield NOT listed here is recorded as a `leftovers[]` entry instead
// (component name + free-text storage life, parsed via the same prose
// fallback as src/data/lifeEstimate.ts) — never forced into `inventory`.

export interface YieldMapping {
  week: "A" | "B";
  component: string;
  ingId: string;
}

export const YIELD_TO_INGREDIENT: YieldMapping[] = [
  // Week A (prep-a) — session has 12 yields; 7 map cleanly.
  { week: "A", component: "Roast chicken", ingId: "chicken" },
  { week: "A", component: "Jerk chickpeas", ingId: "chickpeas" }, // jerk_seasoning (5g) excluded as coating
  { week: "A", component: "Boiled eggs", ingId: "egg" },
  { week: "A", component: "Plain brown rice", ingId: "brown_rice" }, // claims brown_rice first
  // "Jollof" also reduces to brown_rice alone but brown_rice is already
  // claimed by "Plain brown rice" above (earlier in yields[] order) —
  // intentionally NOT mapped; falls back to leftovers[].
  { week: "A", component: "Riced cauliflower", ingId: "cauliflower" },
  { week: "A", component: "White sauce", ingId: "greek_yog" }, // garlic/lemon/pepper below extraction threshold
  { week: "A", component: "Suya spice", ingId: "suya_spice" },
  // NOT mapped (composite, 2+ significant ingredients): Chipotle beef
  // (beef_mince+chipotle_adobo), Turkey bolognese (5 ingredients), Efo riro
  // base (4 ingredients), Jollof (collision, see above), Slaw shred
  // (red_cabbage+carrot).

  // Week B (prep-b) — session has 8 yields; 4 map cleanly.
  { week: "B", component: "Roast chicken", ingId: "chicken" },
  { week: "B", component: "Boiled eggs", ingId: "egg" },
  { week: "B", component: "Brown rice", ingId: "brown_rice" },
  { week: "B", component: "Riced cauliflower", ingId: "cauliflower" },
  // NOT mapped: Turkey & okra stew (5 ingredients), Beef koftas
  // (beef_mince+red_onion), Suya jar / Chilli salt jar (ops carry no
  // `ingredients[]` gram data at all for these two — nothing to stamp
  // numerically; recorded as leftovers with g: null, description-only).
];

export function ingIdForYield(week: "A" | "B", component: string): string | null {
  return YIELD_TO_INGREDIENT.find((y) => y.week === week && y.component === component)?.ingId ?? null;
}
