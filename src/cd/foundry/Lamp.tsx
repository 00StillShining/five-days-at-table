/**
 * src/cd/foundry/Lamp.tsx — II.2.17 / II.3.24, and it never travels alone.
 *
 * "Emissive surfaces make their own light and are the only things on screen
 * allowed to out-bright the field. The grammar is three bloom shells at radii
 * r, 4r, 12r with alpha 80%, 40%, 16%, hue held constant across all three ...
 * The state beneath is binary and commits in the frame it changes — bloom
 * dramatizes light, never state."
 *
 * II.3.24: "unlit, it is still a lamp" — the lens and its well stay visible,
 * because a vanishing indicator is indistinguishable from a missing one.
 *
 * II.7.7: colour never travels alone. `word` is compulsory, not decorative:
 * it is what survives desaturation, an 8px blur, forced-colours, and a viewer
 * who cannot separate that hue from its neighbour. A Lamp with no word is a
 * Lamp that has one channel, and one channel is not a report.
 *
 * MEASURED for the chassis deployment (WCAG 2.x, this build):
 *   lit  #FF2B1A on the lens well #121213 ......... 5.00 : 1
 *   lit  #FF2B1A vs the II.2.17 off well #1E0907 .. 5.11 : 1
 *   lens rim #FFFFFF66 over the off well,
 *     against a #121212 spine ..................... 3.67 : 1
 * --cd-role-live-dim (#76211C) is NOT used as the off fill: it measures
 * 2.80:1 against lit, under the 3:1 graphical floor.
 */

import "./foundry.css";

export interface LampProps {
  lit: boolean;
  /**
   * The printed state word — II.7.7's second channel. Two values, one per
   * state, so the word changes with the light rather than appearing with it.
   */
  word: { on: string; off: string };
  /** What this lamp is FOR, for assistive tech. Never the value; the role. */
  label: string;
  /** Any reserved role hue. Defaults to --cd-role-live. */
  hue?: string;
  /** Lens diameter. Default 0.875rem, per II.2.17's worked example. */
  size?: string;
  /** Print the word beside the lens. Off only where the caller prints it. */
  showWord?: boolean;
  className?: string;
}

export function Lamp({ lit, word, label, hue, size, showWord = true, className }: LampProps) {
  const stateWord = lit ? word.on : word.off;
  return (
    <span
      className={["cd-lamp-set", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={`${label}: ${stateWord}`}
    >
      <span
        className="cd-lamp"
        data-cd-lit={lit ? "true" : "false"}
        style={{
          ...(hue ? ({ "--cd-lamp-hue": hue } as React.CSSProperties) : null),
          ...(size ? ({ "--cd-lamp-size": size } as React.CSSProperties) : null),
        }}
        aria-hidden="true"
      />
      {showWord && (
        <span className="cd-lamp-word" aria-hidden="true">
          {stateWord}
        </span>
      )}
    </span>
  );
}
