import { useId } from "react";
import { useStore } from "../state/store";
import { Sheet } from "../components/Sheet";

export interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Settings drawer shell (gear in masthead). Prefs wired live to the store. Export/
 * import are placeholder buttons, disabled with an explanation nearby (Sol §5.1
 * disabled-state rule) until the state-core build lands.
 */
export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const { state, dispatch } = useStore();
  const { serveTime, cycleStartSaturday } = state.prefs;
  const ioNoteId = useId();

  return (
    <Sheet open={open} onClose={onClose} title="settings">
      <div className="fd5-settings-fields">
        <label className="fd5-field">
          <span className="fd5-field-label">serve time</span>
          <input
            type="time"
            className="fd5-control"
            value={serveTime}
            onChange={(event) =>
              dispatch({ type: "prefs/set", patch: { serveTime: event.target.value } })
            }
          />
        </label>
        <label className="fd5-field">
          <span className="fd5-field-label">cycle start · saturday</span>
          <input
            type="date"
            className="fd5-control"
            value={cycleStartSaturday ?? ""}
            onChange={(event) =>
              dispatch({
                type: "prefs/set",
                patch: { cycleStartSaturday: event.target.value || null },
              })
            }
          />
        </label>
      </div>
      <div className="fd5-settings-io">
        <button type="button" className="fd5-control" disabled aria-describedby={ioNoteId}>
          export json
        </button>
        <button type="button" className="fd5-control" disabled aria-describedby={ioNoteId}>
          import json
        </button>
        <p id={ioNoteId} className="fd5-note">
          arriving with the state-core build — export/import will round-trip your saved data once
          it lands.
        </p>
      </div>
    </Sheet>
  );
}
