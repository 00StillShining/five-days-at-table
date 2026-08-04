import { describe, expect, it } from "vitest";
import { formatPackG } from "./format";

describe("formatPackG — shared SHOP/LIST pack-size convention", () => {
  it("renders sub-kilogram quantities in grams", () => {
    expect(formatPackG(500)).toBe("500g");
    expect(formatPackG(1)).toBe("1g");
    expect(formatPackG(999)).toBe("999g");
  });

  it("renders whole kilograms with no decimal", () => {
    expect(formatPackG(1000)).toBe("1kg");
    expect(formatPackG(2000)).toBe("2kg");
  });

  it("renders fractional kilograms to one decimal place", () => {
    expect(formatPackG(1500)).toBe("1.5kg");
    expect(formatPackG(1250)).toBe("1.3kg"); // toFixed(1) rounding, not truncation
  });

  it("matches the two screens' previously-duplicated implementations exactly (regression pin)", () => {
    // SHOP tripHelpers.ts's formatPackG / LIST model.ts's formatGrams were
    // byte-identical before this promotion — pin a spread of real SKU pack
    // sizes from the dataset so a future edit can't silently change either
    // screen's numbers.
    expect(formatPackG(0)).toBe("0g");
    expect(formatPackG(125)).toBe("125g");
    expect(formatPackG(4500)).toBe("4.5kg");
  });
});
