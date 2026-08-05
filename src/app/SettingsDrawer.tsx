import { useEffect, useId, useRef, useState } from "react";
import { useStore } from "../state/store";
import { Sheet } from "../components/Sheet";
import { exportState, importState } from "../state/importExport";
import { formatShortDateFromIso, londonDateIso, snapToSaturdayOnOrBefore } from "../state/london";

export interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

type IoStatus =
  | { kind: "idle" }
  | { kind: "busy"; text: string }
  | { kind: "success"; text: string }
  | { kind: "error"; text: string };

// Matches the established transient-confirmation duration used elsewhere
// (screens/shop/SendToPhoneKey.tsx's copy-status announce()) — long enough
// to read, short enough not to linger as stale state.
const IO_STATUS_TIMEOUT_MS = 6000;

/**
 * Settings drawer shell (gear in masthead). Prefs wired live to the store.
 *
 * `cycleStartSaturday` is snapped to the most recent Saturday on-or-before
 * whatever date is entered (owner-walkthrough fix: a non-Saturday value
 * silently broke TODAY's fortnight-day math — no day number, wrong duty
 * copy). See state/london.ts's `snapToSaturdayOnOrBefore` for the snap
 * semantics and state/persist.ts's `healCycleStartSaturday` for the matching
 * hydrate-time self-heal of values stored before this fix existed.
 *
 * Export/import round-trip the full app state via state/importExport.ts
 * (long shipped, zod-validated, all-or-nothing) — the drawer just needed
 * wiring: export downloads a Blob, import reads a picked file and dispatches
 * the parsed state through the existing `state/replace` action (already
 * documented in state/types.ts as "used by importExport").
 */
export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const { state, dispatch } = useStore();
  const { serveTime, cycleStartSaturday } = state.prefs;
  const ioNoteId = useId();
  const cycleStartInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ioStatusTimer = useRef<number | null>(null);
  const [ioStatus, setIoStatus] = useState<IoStatus>({ kind: "idle" });

  useEffect(
    () => () => {
      if (ioStatusTimer.current != null) window.clearTimeout(ioStatusTimer.current);
    },
    [],
  );

  function announceIo(next: IoStatus) {
    if (ioStatusTimer.current != null) window.clearTimeout(ioStatusTimer.current);
    setIoStatus(next);
    // Busy is a transitional state that always resolves to success/error on
    // its own; only success/error (dead-end states) get the auto-clear timer.
    if (next.kind === "success" || next.kind === "error") {
      ioStatusTimer.current = window.setTimeout(() => setIoStatus({ kind: "idle" }), IO_STATUS_TIMEOUT_MS);
    }
  }

  function handleExport() {
    try {
      const json = exportState(state);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fd5-export-${londonDateIso(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      announceIo({ kind: "success", text: "exported ✓" });
    } catch {
      // Defence in depth (matches exportState's own doc comment): the
      // reducer should only ever produce schema-valid state, so this
      // shouldn't be reachable — but a visible failure beats a silent one
      // or an uncaught exception if it ever is.
      announceIo({ kind: "error", text: "export failed — could not serialize the current state." });
    }
  }

  async function handleImportFile(file: File) {
    announceIo({ kind: "busy", text: "reading file…" });
    let text: string;
    try {
      text = await file.text();
    } catch {
      announceIo({ kind: "error", text: "import failed — couldn't read the file." });
      return;
    }
    const result = importState(text);
    if (!result.ok) {
      announceIo({ kind: "error", text: `import failed — ${result.error}` });
      return;
    }
    dispatch({ type: "state/replace", state: result.state });
    const sliceCount = Object.keys(result.state).length;
    announceIo({ kind: "success", text: `imported · ${sliceCount} slices` });
  }

  const ioBusy = ioStatus.kind === "busy";
  const ioIdleNote = "export downloads a dated json file; import restores state from one (all-or-nothing).";

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
        {/* NOT a wrapping <label> (unlike the serve-time field above): the
            confirmation <p> below needs to live outside the labelled
            control's accessible-name computation, or the input's accessible
            name would grow to include the confirmation text every time it
            renders ("cycle start · saturday cycle start · saturday 01 aug").
            Explicit htmlFor/id keeps the same association, just scoped to
            only the label text. */}
        <div className="fd5-field">
          <label htmlFor={cycleStartInputId} className="fd5-field-label">
            cycle start · saturday
          </label>
          <input
            id={cycleStartInputId}
            type="date"
            className="fd5-control"
            value={cycleStartSaturday ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              dispatch({
                type: "prefs/set",
                // Snap on commit — the input always ends up showing (and the
                // store always holds) a genuine Saturday, never whatever raw
                // weekday was picked.
                patch: { cycleStartSaturday: raw ? snapToSaturdayOnOrBefore(raw) : null },
              });
            }}
          />
          {cycleStartSaturday && (
            <p className="fd5-note fd5-settings-confirm" role="status" aria-live="polite">
              cycle start <span aria-hidden="true">·</span> saturday {formatShortDateFromIso(cycleStartSaturday)}
            </p>
          )}
        </div>
      </div>
      <div className="fd5-settings-io">
        <button type="button" className="fd5-control" onClick={handleExport} aria-describedby={ioNoteId}>
          export json
        </button>
        <button
          type="button"
          className="fd5-control"
          onClick={() => fileInputRef.current?.click()}
          disabled={ioBusy}
          aria-describedby={ioNoteId}
        >
          import json
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="fd5-visually-hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = ""; // allow re-selecting the same file after a retry
            if (file) void handleImportFile(file);
          }}
        />
        <p id={ioNoteId} className="fd5-note" role="status" aria-live="polite">
          {ioStatus.kind === "idle" ? ioIdleNote : ioStatus.text}
        </p>
      </div>
    </Sheet>
  );
}
