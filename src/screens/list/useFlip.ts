import { useLayoutEffect, useRef } from "react";

/**
 * Minimal FLIP (First-Last-Invert-Play) for the aisle row list, whose DOM
 * order changes when a tick settles (PLAN §6.9: "row settles below unticked
 * items within its aisle... reduced-motion: instant reorder, no
 * animation"). Rows never mount/unmount here (ticking only reorders), which
 * keeps this safe and simple: no bookkeeping for elements that vanish
 * mid-animation.
 *
 * Mechanics: before the browser paints a reordered DOM (useLayoutEffect runs
 * after commit, before paint), every tracked row is measured; any row whose
 * position moved gets an inverse `transform` applied with transitions
 * disabled, so the FIRST paint still shows it in its OLD spot. One
 * `requestAnimationFrame` later, the inline transform is cleared — the
 * row's own CSS `transition: transform` (list.css, `--sol-motion-state`)
 * then animates it to its true new position. `enabled=false` (reduced
 * motion) skips all of this and the reordered DOM simply paints in its
 * final position immediately, satisfying "instant reorder, no animation"
 * exactly.
 */
export function useFlip(orderedIds: string[], elements: Map<string, HTMLElement>, enabled: boolean): void {
  const prevRects = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    if (!enabled) {
      prevRects.current = new Map();
      return;
    }

    const prev = prevRects.current;
    const next = new Map<string, DOMRect>();
    const toAnimate: { el: HTMLElement; dy: number }[] = [];

    for (const id of orderedIds) {
      const el = elements.get(id);
      if (!el) continue;
      const after = el.getBoundingClientRect();
      const before = prev.get(id);
      if (before) {
        const dy = before.top - after.top;
        if (Math.abs(dy) > 0.5) toAnimate.push({ el, dy });
      }
      next.set(id, after);
    }
    prevRects.current = next;

    if (toAnimate.length === 0) return;

    for (const { el, dy } of toAnimate) {
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
    }
    // Force one reflow so the inverted transform above is actually applied
    // before the animation-frame callback clears it — without this the
    // browser may coalesce both style writes into a single paint.
    void toAnimate[0]?.el.offsetHeight;

    const raf = requestAnimationFrame(() => {
      for (const { el } of toAnimate) {
        el.style.transition = "";
        el.style.transform = "";
      }
    });
    return () => cancelAnimationFrame(raf);
  });
}
