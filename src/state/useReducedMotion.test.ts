import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion } from "./useReducedMotion";

// `useReducedMotion` (the hook) isn't render-tested here — this repo has no
// jsdom/@testing-library dependency (file-ownership rules forbid adding one
// via package.json; react-dom/test-utils alone isn't enough without a DOM to
// render into), the same constraint documented for src/state/useNow.test.ts's
// absence. Coverage instead focuses on `prefersReducedMotion`, the exact
// function both the hook's initial state AND its change-listener callback
// delegate to — there is no separate logic inside the hook to miss.

function stubMatchMedia(matches: boolean) {
  const mql = { matches, media: "(prefers-reduced-motion: reduce)", addEventListener: vi.fn(), removeEventListener: vi.fn() };
  (globalThis as unknown as { window: unknown }).window = { matchMedia: vi.fn(() => mql) };
  return mql;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("prefersReducedMotion", () => {
  it("returns false when there is no window/matchMedia at all (this repo's default test environment)", () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it("reflects window.matchMedia(...).matches", () => {
    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("queries the exact 'prefers-reduced-motion: reduce' media string — must match tokens.css's own rule", () => {
    const matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    (globalThis as unknown as { window: unknown }).window = { matchMedia };
    prefersReducedMotion();
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("degrades gracefully when window exists but matchMedia doesn't (older/odd environments)", () => {
    (globalThis as unknown as { window: unknown }).window = {};
    expect(prefersReducedMotion()).toBe(false);
  });
});
