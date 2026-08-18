/**
 * src/screens/shop/useRowBudget.ts — how much of the register actually fits.
 *
 * CD-BRIEF R7: "No page-length scrolling. Long registers use a grouped
 * accordion, one section open at a time, with the hidden remainder printed as a
 * number ('confess the overflow')."
 *
 * A LIMIT TYPED BY HAND IS A TASTE VALUE; A LIMIT MEASURED IS A FACT. II.6.24's
 * confession has to be a measurement or it is decoration, and so does the clip
 * that produces it. The deck is measured, the arithmetic below turns it into a
 * lid count and a row count, and everything past both is printed as a figure.
 *
 * THE ROWS RUN IN TRACKS (shop.css's declared delta 5). The open group lays its
 * rows into as many 26rem tracks as the deck's WIDTH can hold at the chapter's
 * own 0.875rem gutter, so the budget is a rectangle rather than a column: a
 * 1280px desk seats roughly twice what a phone does, on the same clip.
 *
 * COST. One ResizeObserver for the whole deck, coalesced to a single state write
 * per distinct measurement. The perf law budgets renders, not layers — this
 * renders only when the answer actually changes, which after the first frame is
 * only on a real resize.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

/** The committed row pitch — 2rem, II.6.13's Dense band. 44 lines is a scan. */
export const ROW_PX = 32;
/**
 * The narrow pitch — 3.25rem, II.6.13's Comfortable band with its second line.
 * shop.css switches to it below 767.84px viewport, which is a 744px deck once
 * the scene's own 1rem frame is taken off, so the two thresholds are the SAME
 * threshold expressed in the two units each file can see.
 */
export const ROW_TWO_LINE_PX = 52;
export const NARROW_DECK_PX = 744;

/** Which band the deck is actually rendering, derived from its own width. */
export function rowPxFor(width: number): number {
  return width > 0 && width < NARROW_DECK_PX ? ROW_TWO_LINE_PX : ROW_PX;
}
/** A closed lid at the Floor's own 44px, plus the register's 2px seam. */
export const LID_PX = 46;
/** The confession plate at the foot of a clipped group — printed, not a control. */
export const OVERFLOW_PX = 32;
/** The register's own padding inside the open group. */
export const ROWS_PAD_PX = 12;
/** A costed row's real minimum width: mark, identity, value, delta, state. */
export const TRACK_MIN_PX = 416; /* 26rem */
export const GUTTER_PX = 14; /* 0.875rem */

/** Never fewer than this, however short the deck: one row is still a register. */
export const MIN_ROWS = 1;

export interface DeckSize {
  height: number;
  width: number;
}

export function useDeckSize(ref: RefObject<HTMLElement | null>): DeckSize {
  const [size, setSize] = useState<DeckSize>({ height: 0, width: 0 });
  const last = useRef<DeckSize>({ height: 0, width: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      // Coalesce: a sub-pixel reflow must not re-render the register.
      if (Math.abs(rect.height - last.current.height) < 1 && Math.abs(rect.width - last.current.width) < 1) {
        return;
      }
      last.current = { height: rect.height, width: rect.width };
      setSize(last.current);
    });
    observer.observe(el);
    const rect = el.getBoundingClientRect();
    last.current = { height: rect.height, width: rect.width };
    setSize(last.current);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

export interface Budget {
  /** How many lids the deck can seat. */
  lids: number;
  /** How many rows the OPEN lid may render before the clip confesses. */
  rows: number;
  /** How many tracks those rows lay into — reported so the caller can print it. */
  tracks: number;
}

/** How many 26rem tracks fit across `width`, at the committed gutter. */
export function tracksFor(width: number): number {
  if (width <= 0) return 1;
  return Math.max(1, Math.floor((width + GUTTER_PX) / (TRACK_MIN_PX + GUTTER_PX)));
}

/**
 * R7's two clips, solved together.
 *
 * The deck holds a column of lids of which exactly one is open, so its height is
 * `lids x 46 + ceil(rows / tracks) x 32 + padding` and nothing else. Both clips
 * confess: the rows clip through the Register's own remainder, the lids clip
 * through a printed plate at the foot. Neither is allowed to run off the bottom
 * unannounced.
 *
 * `reserve` is the number of ROW LINES the open lid is guaranteed before lids
 * start being clipped, because a register that shows every aisle and none of
 * their contents has answered the wrong question.
 */
export function budgetFor(
  size: DeckSize,
  groupCount: number,
  openRowCount: number,
  reserve = 3
): Budget {
  const tracks = tracksFor(size.width);
  const rowPx = rowPxFor(size.width);
  if (size.height <= 0) {
    return { lids: Math.max(1, groupCount), rows: MIN_ROWS * tracks, tracks };
  }

  const openLines = Math.max(1, Math.ceil(Math.max(1, openRowCount) / tracks));
  /* Reserve only what the OPEN lid can actually use: a lid column shortened to
     protect empty space is a clip paying for rows that do not exist. */
  const forRows = Math.min(reserve, openLines) * rowPx + ROWS_PAD_PX;
  const fit = (avail: number) =>
    Math.max(1, Math.min(groupCount, Math.floor((avail - forRows) / LID_PX)));

  /* Two passes, because the lid clip's OWN confession costs a line. First ask
     whether every lid fits; if it does not, ask again with room for the plate
     that says so. A confession that pushes the thing it is confessing off the
     bottom is not a confession. */
  let lids = fit(size.height);
  let avail = size.height;
  if (lids < groupCount) {
    avail = size.height - OVERFLOW_PX;
    lids = fit(avail);
  }

  const lineBudget = Math.max(
    MIN_ROWS,
    Math.floor((avail - lids * LID_PX - ROWS_PAD_PX - OVERFLOW_PX) / rowPx)
  );
  return { lids, rows: Math.max(MIN_ROWS, lineBudget * tracks), tracks };
}
