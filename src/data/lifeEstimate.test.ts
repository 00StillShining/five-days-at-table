import { describe, expect, it } from "vitest";
import { ingredientsList } from "./ingredients";
import { estimateFreeTextLifeDays, isFreezerStock, operativeLifeDays, parseIngredientLife } from "./lifeEstimate";

describe("parseIngredientLife", () => {
  it("reproduces every ingredient's own canonical numeric fields from its prose", () => {
    // The 24/97 ingredients that already carry sealedDays/openDays/frozenDays/
    // freshDays are the ground truth for the parsing grammar — if the parser
    // can't re-derive these exactly, it can't be trusted on the other 73
    // that have prose only. See lifeEstimate.ts's module doc.
    const withGroundTruth = ingredientsList.filter((i) => {
      const l = i.storage.life;
      return l.sealedDays != null || l.openDays != null || l.frozenDays != null || l.freshDays != null;
    });
    expect(withGroundTruth.length).toBeGreaterThanOrEqual(24);

    for (const ing of withGroundTruth) {
      const parsed = parseIngredientLife(ing.storage.life.prose);
      expect(parsed, `${ing.id}: ${ing.storage.life.prose}`).toEqual({
        sealedDays: ing.storage.life.sealedDays,
        openDays: ing.storage.life.openDays,
        frozenDays: ing.storage.life.frozenDays,
        freshDays: ing.storage.life.freshDays,
      });
    }
  });

  it("parses a plain range with sealed/open keywords", () => {
    expect(parseIngredientLife("2–3 weeks sealed · 5–7 days open")).toEqual({
      sealedDays: 18, // (2+3)/2 * 7
      openDays: 6, // (5+7)/2
      frozenDays: null,
      freshDays: null,
    });
  });

  it("treats a bare segment (no sealed/open/frozen keyword) as freshDays", () => {
    expect(parseIngredientLife("2 weeks").freshDays).toBe(14);
    expect(parseIngredientLife("Keeps three weeks").freshDays).toBe(21);
  });

  it("leaves bare unit words with no digit unparsed (matches canonical extraction)", () => {
    expect(parseIngredientLife("Months")).toEqual({ sealedDays: null, openDays: null, frozenDays: null, freshDays: null });
    expect(parseIngredientLife("Months, sealed")).toEqual({ sealedDays: null, openDays: null, frozenDays: null, freshDays: null });
  });
});

describe("operativeLifeDays", () => {
  it("prefers the canonical numeric field when present (confidence: numeric)", () => {
    const cottage = ingredientsList.find((i) => i.id === "cottage")!;
    const est = operativeLifeDays(cottage);
    expect(est.confidence).toBe("numeric");
    expect(est.bucket).toBe("open"); // buy-once/topup order prefers "open" first
    expect(est.days).toBe(5);
  });

  it("falls back to the prose-parsed figure when no canonical field exists (confidence: parsed)", () => {
    // mustard: buy-once, prose "6 months open", no numeric ground truth at all for this ingredient.
    const mustard = ingredientsList.find((i) => i.id === "mustard")!;
    expect(mustard.storage.life.sealedDays ?? mustard.storage.life.openDays ?? mustard.storage.life.frozenDays ?? mustard.storage.life.freshDays).toBeNull();
    const est = operativeLifeDays(mustard);
    expect(est.confidence).toBe("parsed");
    expect(est.bucket).toBe("open");
    expect(est.days).toBe(183); // round(6 * 30.44)
  });

  it("uses freshDays (post-thaw) for freeze-day0/buy-frozen classes, not the long frozen figure", () => {
    const chicken = ingredientsList.find((i) => i.id === "chicken")!;
    expect(chicken.storage.class).toBe("freeze-day0");
    const est = operativeLifeDays(chicken);
    expect(est.days).toBe(2); // "2 days fresh · 6 months frozen" -> 2, not ~180
    expect(est.bucket).toBe("fresh");
  });

  it("returns a large low-confidence sentinel for a bare 'Months'/'Years' prose with no digit at all", () => {
    const suya = ingredientsList.find((i) => i.id === "suya_spice")!;
    const est = operativeLifeDays(suya);
    expect(est.confidence).toBe("low");
    expect(est.days).toBeGreaterThan(30); // never trips an "expiring soon" (<=1 day) threshold
  });

  it("never throws and always returns a positive day count, for every ingredient in the dataset", () => {
    for (const ing of ingredientsList) {
      const est = operativeLifeDays(ing);
      expect(est.days).toBeGreaterThan(0);
    }
  });
});

describe("estimateFreeTextLifeDays", () => {
  it("parses a prep-yield storage string", () => {
    expect(estimateFreeTextLifeDays("Fridge, whole, 4 days").days).toBe(4);
    expect(estimateFreeTextLifeDays("Fridge raw, 4 days").days).toBe(4);
  });

  it("falls back to a low-confidence default when there is no duration language at all", () => {
    const est = estimateFreeTextLifeDays("Jar, lid off, counter");
    expect(est.confidence).toBe("low");
    expect(est.days).toBeGreaterThan(0);
  });
});

describe("isFreezerStock — P1 wave-1-review fix", () => {
  it("is true for every freeze-day0/buy-frozen ingredient in the dataset (all 18 are located in the Freezer)", () => {
    const frozenClassIngredients = ingredientsList.filter((i) => i.storage.class === "freeze-day0" || i.storage.class === "buy-frozen");
    expect(frozenClassIngredients.length).toBeGreaterThanOrEqual(18);
    for (const ing of frozenClassIngredients) expect(isFreezerStock(ing), ing.id).toBe(true);
  });

  it("is false for a non-frozen storage class even if it happens to share other traits", () => {
    const cottage = ingredientsList.find((i) => i.id === "cottage")!; // topup, Fridge
    expect(isFreezerStock(cottage)).toBe(false);
  });

  it("specifically covers chicken and tilapia — the review's own reproduction ingredients", () => {
    expect(isFreezerStock(ingredientsList.find((i) => i.id === "chicken")!)).toBe(true);
    expect(isFreezerStock(ingredientsList.find((i) => i.id === "tilapia")!)).toBe(true);
  });
});
