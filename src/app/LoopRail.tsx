import { Key } from "../components/Key";
import { CycleCursor } from "./CycleCursor";
import { RAIL_STATIONS, type RailScreenId, type ScreenId } from "./router";

export interface LoopRailProps {
  activeScreen: ScreenId;
  onNavigate: (screen: RailScreenId) => void;
  suggestedStation: RailScreenId;
  cookRunning: boolean;
  lidClosed: boolean;
  onExitCook: () => void;
}

/**
 * The loop rail (PLAN §6.2 / D6): five fixed keys, real buttons, lowercase verbs,
 * active = key-face depression + aria-current="page". COOK is lid-closed: the whole
 * rail is replaced by one exit tab so wet hands can't mis-tap modes. Elsewhere, a
 * running cook program shows as a pulsing dot on the cook key (text equivalent lives
 * in the masthead status region).
 */
export function LoopRail({
  activeScreen,
  onNavigate,
  suggestedStation,
  cookRunning,
  lidClosed,
  onExitCook,
}: LoopRailProps) {
  if (lidClosed) {
    return (
      <nav className="fd5-rail fd5-rail--lidclosed" aria-label="cook">
        <button type="button" className="fd5-control fd5-exit-tab" onClick={onExitCook}>
          exit <span aria-hidden="true">▸</span>
        </button>
      </nav>
    );
  }

  return (
    <nav className="fd5-rail" aria-label="loop">
      <ul className="fd5-rail-keys">
        {RAIL_STATIONS.map((station, index) => (
          <li key={station} className="fd5-rail-cell">
            <Key
              label={station}
              active={activeScreen === station}
              onSelect={() => onNavigate(station)}
              hotkeyDigit={index + 1}
            >
              {station === "cook" && cookRunning && (
                <span className="fd5-key-pulse" data-motion aria-hidden="true" />
              )}
            </Key>
            <span className="fd5-cycle-cursor-slot">
              {suggestedStation === station && <CycleCursor station={station} />}
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
