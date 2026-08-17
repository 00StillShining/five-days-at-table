/**
 * src/cd/chassis/glyph.ts — the lattice, its crop, and the legal shapes.
 *
 * 13 BACK CHANNEL section 2: "The lattice addresses on a 25-by-25 grid — 625
 * positions — and a circular mask leaves 489 of them live, roughly 78% of the
 * square it was cut from; EVERY FIELD IN THIS LANGUAGE, AT ANY SIZE, KEEPS THAT
 * EXACT RATIO rather than rounding it toward a cleaner number."
 *
 * Section 3, the Glyph Field: "everything this world reports draws as one of
 * three coded shapes on the same lattice — a FILL, a SWEEP, or a STEPPED BAR —
 * never as an icon, never as a word."
 *
 * ---------------------------------------------------------------------------
 * DECLARED DEPARTURE 1 — the rail-scale grid is 7x7, not 5x5
 * ---------------------------------------------------------------------------
 * Section 4's Signal List gives row scale "a small 5-by-5 Glyph Field standing
 * in for a lamp". The chassis rail cannot carry a 25x25 field: at the committed
 * 4.5rem footprint a 25-cell lattice resolves to 2.24px per cell, which is
 * texture, not 489 discrete points. So the rail runs a reduced grid — and the
 * reduction is chosen by the chapter's OWN stated law, the 78.24% ratio, rather
 * than by its worked example:
 *
 *     grid   best circular crop   live / total   ratio     error vs 78.24%
 *      5x5   r = 2.24                   21 / 25   84.00%    +5.76 points
 *      7x7   r = 3.50                   37 / 49   75.51%    -2.73 points
 *     25x25  r = 12.40                489 / 625   78.24%     0 (canonical)
 *
 * 7x7 lands closer to the ratio the chapter calls law, and resolves at 6.4px
 * per cell at the rail's own size. The 5x5 worked example is lineage; the ratio
 * is the rule. `cropRatio()` below computes these rather than asserting them.
 *
 * ---------------------------------------------------------------------------
 * DECLARED DEPARTURE 2 — the STEPPED BAR is not built
 * ---------------------------------------------------------------------------
 * The chassis reports two facts and has two shapes for them: the fortnight's
 * position is a FILL, and a running cook program is a SWEEP. There is no third
 * chassis-owned reading that is a live LEVEL, so the stepped bar has nothing to
 * report and is not implemented. This is the Refined rung's own ledger question
 * — "does it state a value, or let the hand do something?" — answered honestly
 * rather than by shipping a renderer with no value behind it. A field that
 * lights for no reason is noise (section 9).
 */

/** Section 3's committed cell geometry. Pitch = cell + gap = 0.40rem. */
export const CELL_REM = 0.34;
export const GAP_REM = 0.06;
export const PITCH_REM = CELL_REM + GAP_REM;

/** The canonical field: 25x25, radius 12.4, 489 live of 625. */
export const CANONICAL_N = 25;
export const CANONICAL_RADIUS = 12.4;
export const CANONICAL_RATIO = 489 / 625; // 0.78240

/** The rail-scale field, per DECLARED DEPARTURE 1 above. */
export const RAIL_N = 7;
export const RAIL_RADIUS = 3.5;

export type CellState = "dead" | "off" | "dim" | "lit" | "hot";

/** Is a cell inside the circular mask? Centre is (N-1)/2 in both axes. */
export function isLive(n: number, radius: number, col: number, row: number): boolean {
  const c = (n - 1) / 2;
  const dx = col - c;
  const dy = row - c;
  return Math.sqrt(dx * dx + dy * dy) <= radius;
}

/** How many of n*n positions survive the crop, and at what ratio. */
export function cropRatio(n: number, radius: number): { live: number; total: number; ratio: number } {
  let live = 0;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) if (isLive(n, radius, col, row)) live++;
  }
  const total = n * n;
  return { live, total, ratio: live / total };
}

export type GlyphPattern =
  /** A quantity. Rows light from the field's own edge inward (section 3). */
  | { kind: "fill"; fraction: number }
  /** Elapsed time. One lit arc advances at the value's OWN rate (II.4.8). */
  | { kind: "sweep"; fraction: number }
  /** Nothing to report. The lattice rests at its ghost print, never blank. */
  | { kind: "rest" };

/**
 * The state of every cell in the grid, row-major, length n*n.
 *
 * `hot` (#FFFFFF) is spent on exactly one boundary — the newest lit row of a
 * fill, or the leading cell of a sweep — because section 3's Signature rung
 * gives "the newest boundary row one frame at the hot value before it settles
 * to lit", and II.2.17 forbids hot as a resting fill. The caller decides
 * whether that boundary is currently fresh; `freshBoundary` is that decision.
 */
export function renderPattern(
  n: number,
  radius: number,
  pattern: GlyphPattern,
  freshBoundary = false
): CellState[] {
  const cells: CellState[] = new Array(n * n).fill("dead");
  const c = (n - 1) / 2;

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!isLive(n, radius, col, row)) continue;
      const i = row * n + col;
      cells[i] = "off"; // the ghost print — an idle lattice is still hardware

      if (pattern.kind === "rest") continue;

      if (pattern.kind === "fill") {
        const f = clamp01(pattern.fraction);
        const litRows = Math.round(f * n);
        const boundaryRow = n - litRows;
        if (row >= boundaryRow) {
          cells[i] = freshBoundary && row === boundaryRow ? "hot" : "lit";
        }
        continue;
      }

      // sweep — one lit arc, measured clockwise from 12 o'clock, exactly as
      // section 3's own ring geometry indexes its stations.
      const f = clamp01(pattern.fraction);
      const dx = col - c;
      const dy = row - c;
      if (dx === 0 && dy === 0) {
        cells[i] = "dim"; // the hub: charged, but it is not part of the arc
        continue;
      }
      let angle = Math.atan2(dy, dx) + Math.PI / 2; // 0 at 12 o'clock
      if (angle < 0) angle += Math.PI * 2;
      const turn = angle / (Math.PI * 2);
      if (turn <= f) {
        const leading = f - turn < 1 / (n * 4);
        cells[i] = freshBoundary && leading ? "hot" : "lit";
      }
    }
  }
  return cells;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}
