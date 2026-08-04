import { describe, expect, it } from "vitest";
import { ingredientShortName, ingredientsList } from "./ingredients";

describe("ingredientShortName — INT-3 (final integration review)", () => {
  it("resolves the ingredient's own short name for the review's reproduction cases", () => {
    expect(ingredientShortName("banana")).toBe("Bananas");
    expect(ingredientShortName("beef_mince")).toBe("Beef mince, 5%");
  });

  it("never returns the raw ingId for any real ingredient in the dataset", () => {
    for (const ing of ingredientsList) {
      expect(ingredientShortName(ing.id)).not.toBe(ing.id);
      expect(ingredientShortName(ing.id)).toBe(ing.name.short);
    }
  });

  it("falls back to the raw id for an unknown ingId rather than throwing", () => {
    expect(ingredientShortName("not-a-real-ingredient")).toBe("not-a-real-ingredient");
  });
});
