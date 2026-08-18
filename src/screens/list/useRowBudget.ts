/**
 * src/screens/list/useRowBudget.ts — how many rows the bay can actually hold.
 *
 * CD-BRIEF R7: "No page-length scrolling. Long registers use a grouped
 * accordion, one section open at a time, with the hidden remainder printed as a
 * number ('confess the overflow')."
 *
 * A LIMIT TYPED BY HAND IS A TASTE VALUE; A LIMIT MEASURED IS A FACT.
 * The Register's own doc makes the same argument about its lid counts: "II.6.24's
 * confession has to be a MEASUREMENT or it is decoration." The same is true of
 * the clip that produces it. So the open group renders exactly as many rows as
 * the bay can seat at the committed 3.5rem pitch, and the remainder is printed.
 * On a 390x844 phone that is a handful; on a 1280x800 desk it is a dozen; on
 * neither does the operator ever scroll, and on both the number they are not
 * being shown is on screen as a figure.
 *
 * This works because bought rows LEAVE (model.ts's `aisleGroups`): the clip is
 * not a wall the operator has to climb, it is a queue that empties from the top
 * as the trolley fills.
 *
 * COST. One ResizeObserver for the whole screen, coalesced to a single state
 * write per distinct budget. The perf law's rule is "budget renders, not
 * layers" — this renders only when the answer actually changes, which on a
 * phone in a shop is never after the first frame.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

/** The committed row pitch — 3.5rem. One-thumb, above the Floor's 44px. */
export const ROW_PX = 56;
/** A closed lid plus the register's own half-module gap. */
export const LID_PX = 44 + 4;
/** The confession plate at the foot of a clipped group — printed, not a control. */
export const OVERFLOW_PX = 28;

/** Never fewer than this, however short the viewport: one row is still a list. */
export const MIN_ROWS = 1;

/**
 * The bay's own height, in pixels, or 0 before it has been measured.
 * The arithmetic that turns it into a lid count and a row count lives in
 * index.tsx's `budgetFor`, because BOTH clips have to be solved together: a lid
 * column that overflows silently is the same defect as a row list that does.
 */
export function useBayHeight(ref: RefObject<HTMLElement | null>): number {
  const [bayPx, setBayPx] = useState(0);
  const lastRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      // Coalesce: a sub-pixel scroll-bar reflow must not re-render the register.
      if (Math.abs(h - lastRef.current) < 1) return;
      lastRef.current = h;
      setBayPx(h);
    });
    observer.observe(el);
    lastRef.current = el.getBoundingClientRect().height;
    setBayPx(lastRef.current);
    return () => observer.disconnect();
  }, [ref]);

  return bayPx;
}

export interface Budget {
  /** How many lids the bay can seat. */
  lids: number;
  /** How many rows the OPEN lid may render before the clip confesses. */
  rows: number;
}

/**
 * R7's two clips, solved together.
 *
 * The bay holds a column of lids of which exactly one is open, so its height is
 * `lids x 48 + rows x 56 + 28` and nothing else. Both clips confess: the rows
 * clip through the Register's own remainder, the lids clip through a printed
 * plate at the foot. Neither is allowed to run off the bottom of the bay
 * unannounced, which is what the first build did — measured at 390x844, the
 * FREEZER lid was cut in half by `overflow: hidden` and said nothing about it.
 *
 * `reserve` is the number of rows the open lid is guaranteed before lids start
 * being clipped, because a register that shows every aisle and none of their
 * contents has answered the wrong question.
 */
export function budgetFor(
  bayPx: number,
  groupCount: number,
  openRowCount: number,
  reserve = 3
): Budget {
  if (bayPx <= 0) return { lids: Math.max(1, groupCount), rows: MIN_ROWS };
  /* Reserve only what the OPEN lid can actually use. The first build reserved
     three rows unconditionally and then clipped four aisles off the bottom to
     pay for two rows that did not exist — a lid column shortened to protect
     empty space. */
  const forRows = Math.min(reserve, Math.max(1, openRowCount)) * ROW_PX + OVERFLOW_PX;
  const fit = (avail: number) =>
    Math.max(1, Math.min(groupCount, Math.floor((avail - forRows) / LID_PX)));

  /* Two passes, because the lid clip's OWN confession costs a line. First ask
     whether every lid fits; if it does not, ask again with room for the plate
     that says so. A confession that pushes the thing it is confessing off the
     bottom is not a confession. */
  let lids = fit(bayPx);
  let avail = bayPx;
  if (lids < groupCount) {
    avail = bayPx - OVERFLOW_PX;
    lids = fit(avail);
  }
  const rows = Math.max(MIN_ROWS, Math.floor((avail - lids * LID_PX - OVERFLOW_PX) / ROW_PX));
  return { lids, rows };
}
