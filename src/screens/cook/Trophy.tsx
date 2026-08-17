/**
 * src/screens/cook/Trophy.tsx — COOK at the wall.
 *
 * Owner ruling, every screen: 3-5 survivors at 2x card scale; the age at
 * 1.21875rem and the exact figure at 1.75rem, ALWAYS VISIBLE; everything else
 * DISAPPEARS rather than shrinking. Silent except the warning, and alerts
 * pierce at wall scale the instant they exist.
 *
 * 02 REEL LOGIC section 4's own Trophy variant names what may never disappear
 * here: "an armed or recording lamp, because the live role's deployment is
 * exactly this condition; the elapsed-time freshness figure, printed as a real
 * number and never an icon standing in for one; and any warning already on a
 * zone band ... REEL LOGIC's own addition to the wall face: THE REEL IS THE ONE
 * SURVIVING MOVING PART at any distance — every other value on the composition
 * is static print, and the disc's continued turn is the single proof, readable
 * across a room, that the session is still truthfully live."
 *
 * So the five survivors are the reel plus four printed pods. Nothing here is
 * pressable: every control disappeared with the rest, and any input at all has
 * already begun the 240ms return to the instrument face (useTrophy). The trophy
 * is never the only route to an action because it is the route to none.
 *
 * DECLARED DEPARTURE (CORRECTIONARY 6.5). 1.21875rem is not a step on II.6.19's
 * closed seven-step scale. The owner's Trophy ruling states it as a figure, so
 * it is used as a figure, for the wall face only, and no other surface in this
 * screen uses a size off the ladder.
 */

import { Escutcheon } from "../../cd/foundry";
import { Drums } from "./Drums";
import { ReelFace } from "./Reel";
import { orbitOffset } from "./useTrophy";
import "./cook.css";

export interface TrophySurvivor {
  /** The engraved word. What this figure IS. */
  label: string;
  /** The exact figure. Always a real number, never an icon standing in. */
  figure: string;
  /** The reading's own age. Always visible. */
  age: string;
  /** A frozen reading holds at 55% ink and prints its state word. */
  held?: boolean;
  word?: string;
}

export interface TrophyProps {
  open: boolean;
  orbit: number;
  elapsedMin: number;
  totalMin: number;
  spinning: boolean;
  overrun: boolean;
  seedSeconds: number;
  survivors: TrophySurvivor[];
  /** The alarm. It pierces: the face never dims while this is true. */
  alert: string | null;
  lampWord: string;
  lampLit: boolean;
}

export function Trophy({
  open,
  orbit,
  elapsedMin,
  totalMin,
  spinning,
  overrun,
  seedSeconds,
  survivors,
  alert,
  lampWord,
  lampLit,
}: TrophyProps) {
  const { x, y } = orbitOffset(orbit);
  return (
    <div
      className="ck-trophy"
      data-ck-open={open ? "true" : "false"}
      data-ck-alert={alert ? "true" : undefined}
      aria-hidden={open ? undefined : "true"}
      // ONE RIGID FRAME: the burn-in offset moves the whole face, never a part.
      style={{ "--ck-burn-x": `${x}px`, "--ck-burn-y": `${y}px` } as React.CSSProperties}
    >
      <div className="ck-trophy-face">
        <div className="ck-trophy-reel">
          <ReelFace
            elapsedMin={elapsedMin}
            totalMin={totalMin}
            spinning={spinning}
            overrun={overrun}
            seedSeconds={seedSeconds}
            hub={false}
          />
          <div className="ck-trophy-lampline">
            <span className="ck-trophy-lamp" data-cd-lit={lampLit ? "true" : "false"} aria-hidden="true" />
            <Escutcheon>{lampWord}</Escutcheon>
          </div>
        </div>

        {alert && (
          <div className="ck-trophy-alert" role="alert">
            <Escutcheon>due now</Escutcheon>
            <p className="ck-trophy-alert-text">{alert}</p>
          </div>
        )}

        <div className="ck-trophy-row">
          {survivors.map((s) => (
            <div key={s.label} className="ck-trophy-pod">
              <Escutcheon>{s.label}</Escutcheon>
              <Drums
                value={s.figure}
                size="var(--ck-trophy-figure)"
                held={s.held}
                label={s.label}
                className="ck-trophy-figure"
              />
              <span className="ck-trophy-age cd-printed">
                {s.age}
                {s.word ? ` · ${s.word}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
