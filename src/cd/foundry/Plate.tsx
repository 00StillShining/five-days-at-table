/**
 * src/cd/foundry/Plate.tsx — the ink plate, and the escutcheon cut into one.
 *
 * CD-BRIEF ruling 5, THE INK-PLATE LAW: "Text never renders raw over carbon
 * weave or brushed grain. It sits on a cream face, an anthracite panel, or an
 * engraved billet plate. Text-on-carbon is a HARD FAIL BY RULE, not by measured
 * ratio."
 *
 * Every language scope declares --cd-plate and --cd-plate-ink for exactly this,
 * so a Plate renders correctly inside any of the eight worlds without knowing
 * which one it is in.
 *
 * `Escutcheon` is the same law applied to permanent naming text: II.6.7's
 * engraved register — the glyph cut INTO the plate, darker than it, carrying
 * the dual shadow the one light casts.
 */

import type { ElementType, ReactNode } from "react";
import "./foundry.css";

export interface PlateProps {
  as?: ElementType;
  /** II.2.21 — a read surface gets bare field; the grain layer is removed. */
  surface?: "data" | "material";
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
  id?: string;
  [key: `data-${string}`]: unknown;
  [key: `aria-${string}`]: unknown;
}

/** A face for text to sit on. Anything a task reads belongs on one of these. */
export function Plate({ as: Tag = "div", surface = "data", className, children, ...rest }: PlateProps) {
  return (
    <Tag
      className={["cd-plate", "cd-plate-mount", className].filter(Boolean).join(" ")}
      data-cd-surface={surface}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export interface EscutcheonProps {
  as?: ElementType;
  className?: string;
  children?: ReactNode;
  [key: `data-${string}`]: unknown;
  [key: `aria-${string}`]: unknown;
}

/**
 * The engraved naming plate. Names a thing permanently — it never reports a
 * value, which is what separates it from a readout (II.6.7: "permanent text
 * only"). Uppercase and tracked, because that is what a real one is.
 */
export function Escutcheon({ as: Tag = "span", className, children, ...rest }: EscutcheonProps) {
  return (
    <Tag className={["cd-escutcheon", "cd-engraved", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </Tag>
  );
}
