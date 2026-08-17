/**
 * src/cd/foundry/Enclosure.tsx — a machined housing, not a card.
 *
 * CORRECTIONARY 5.1: "If any container on your screen is a rounded rectangle
 * with padding, a border, and a soft shadow — remake it as machined housing
 * before continuing. The word 'card' appearing in your own reasoning is a
 * warning sign."
 *
 * CD-BRIEF retires the data card (II.3.32) outright. This is what replaces it.
 * Five variants, each one a real II.2 construction rather than a decoration:
 *
 *   faceplate  tier 1 — the ground a cluster is mounted to
 *   well       a recess CUT INTO a faceplate; II.2.3's inverted pair, and the
 *              one place the full 1:2 cast vector is spent
 *   pod        tier 2 — a raised housing a hand may operate
 *   hero       tier 3 — full stack, deepest ambient. CORRECTIONARY 3.1 revokes
 *              the "exactly 1 per screen" cap: call this six times if the
 *              screen has six heroes, which is the normal condition here
 *   bezel      a ring of machined trim wrapping an instrument (II.2.8 chrome)
 *
 * `grain` composites the microtexture layer of II.2.21 at the project's own
 * --cd-grain-strength (0.06 — three times the bible's default, because
 * CORRECTIONARY 3.3 removed the cap). II.2.21's SURVIVING clause is honoured
 * by `surface="data"`, which removes the layer rather than fading it: the
 * reading eye gets bare field.
 */

import type { ElementType, ReactNode } from "react";
import "./foundry.css";

export type EnclosureVariant = "faceplate" | "well" | "pod" | "hero" | "bezel";

export interface EnclosureProps {
  variant: EnclosureVariant;
  /** Render as something other than a div — `section`, `nav`, `li`, `aside`. */
  as?: ElementType;
  /** II.2.21 — the finish. Earned by heroes and material-led chassis. */
  grain?: boolean;
  /**
   * II.2.21's surviving half: "no grain under numerals, plots, or any read
   * surface". Pass "data" for anything the eye reads and the layer is REMOVED.
   */
  surface?: "data" | "material";
  /** A bezel that wraps a rectangle rather than a disc. */
  shape?: "round" | "rect";
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
  [key: `data-${string}`]: unknown;
  [key: `aria-${string}`]: unknown;
  id?: string;
  role?: string;
}

export function Enclosure({
  variant,
  as: Tag = "div",
  grain = false,
  surface,
  shape,
  className,
  children,
  ...rest
}: EnclosureProps) {
  const classes = ["cd-encl", grain ? "cd-grain" : null, className].filter(Boolean).join(" ");
  return (
    <Tag
      className={classes}
      data-cd-encl={variant}
      data-cd-shape={shape === "rect" ? "rect" : undefined}
      data-cd-surface={surface}
      {...rest}
    >
      {children}
    </Tag>
  );
}
