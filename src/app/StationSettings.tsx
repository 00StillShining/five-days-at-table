/**
 * src/app/StationSettings.tsx — the Station Tray's contents, wired to the store.
 *
 * This replaces src/app/SettingsDrawer.tsx, which was a modal <dialog> in the
 * legacy CLEAR-LID-bridged scope. Three things changed and all three were
 * rulings:
 *
 *  1. NO SCRIM, NO MODAL (II.3.30 + the owner's tray ruling). A <dialog> opened
 *     with showModal() makes the workspace inert and paints a ::backdrop. The
 *     surface is a foundry Tray instead, and the rail stays reachable the whole
 *     time it is up.
 *  2. ONE LANGUAGE PER ELEMENT. The old drawer's fields read --sol-* tokens,
 *     which the bridge points at 10 CLEAR LID. Rendered inside a BACK CHANNEL
 *     tray that is an element reading tokens from two language scopes, which
 *     CD-BRIEF's zone fence forbids. Every control here is BACK CHANNEL's own.
 *  3. R7 — NO PAGE-LENGTH SCROLLING. Measured, the flat form was 1234px inside
 *     an 840px tray body: 1.47 viewports of scroll on the one long surface the
 *     chassis owns. It is now a grouped Register, ONE SECTION OPEN AT A TIME,
 *     with every closed lid printing its own count. The open group id lives in
 *     the R6 panel store, so opening TIMING, navigating to SHOP and coming back
 *     finds TIMING still open — which is the ruling working, demonstrated on
 *     the chassis itself rather than asserted for the screens.
 *
 * REACH (screencraft/02) stays inside budget: these are all weekly-tier values,
 * and weekly buys two gestures — one to open the tray, one to lift a lid.
 *
 * GROUPED BY CONSEQUENCE, not by alphabet. PLAN, TIMING and SENSORY are
 * instant-apply and freely reversible. STATE reaches beyond the session but is
 * reversible. IRREVERSIBLE holds the one operation nothing here can undo, keyed
 * in the danger role and behind a hold-to-arm interlock.
 *
 * Everything it does to the store is unchanged: the same `prefs/set` patches,
 * the same Saturday snap, the same all-or-nothing importState. The frozen state
 * layer has not moved.
 */

import { useEffect, useId, useRef, useState } from "react";
import { useStore } from "../state/store";
import { exportState, importState } from "../state/importExport";
import { formatShortDateFromIso, londonDateIso, snapToSaturdayOnOrBefore } from "../state/london";
import { PressKey } from "../cd/foundry/PressKey";
import { Register, type RegisterGroup } from "../cd/foundry/Register";
import { useOpenSection } from "../cd/chassis/panels";
import { FieldRow, ImportGuard, MuteSeat, SeatSelector } from "../cd/chassis/StationTray";

type IoStatus =
  | { kind: "idle" }
  | { kind: "busy"; text: string }
  | { kind: "success"; text: string }
  | { kind: "error"; text: string };

/** Matches the transient-confirmation window used across the product. */
const IO_STATUS_TIMEOUT_MS = 6000;

export function StationSettings() {
  const { state, dispatch } = useStore();
  const { serveTime, cycleStartSaturday, planVariant, week, cover } = state.prefs;
  const ioNoteId = useId();
  const cycleStartInputId = useId();
  const serveTimeInputId = useId();
  const ioStatusTimer = useRef<number | null>(null);
  const [ioStatus, setIoStatus] = useState<IoStatus>({ kind: "idle" });

  // R6 — the open lid outlives a scene unmount and dies with the page.
  const [openGroup, setOpenGroup] = useOpenSection("station-tray", "plan");

  useEffect(
    () => () => {
      if (ioStatusTimer.current != null) window.clearTimeout(ioStatusTimer.current);
    },
    []
  );

  function announceIo(next: IoStatus) {
    if (ioStatusTimer.current != null) window.clearTimeout(ioStatusTimer.current);
    setIoStatus(next);
    // Busy always resolves on its own; only the dead-end states auto-clear.
    if (next.kind === "success" || next.kind === "error") {
      ioStatusTimer.current = window.setTimeout(
        () => setIoStatus({ kind: "idle" }),
        IO_STATUS_TIMEOUT_MS
      );
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
      announceIo({ kind: "success", text: "exported" });
    } catch {
      // Defence in depth: the reducer should only ever produce schema-valid
      // state, but a visible failure beats a silent one if it ever does not.
      announceIo({ kind: "error", text: "export failed — could not serialize the current state" });
    }
  }

  async function handleImportFile(file: File) {
    announceIo({ kind: "busy", text: "reading file" });
    let text: string;
    try {
      text = await file.text();
    } catch {
      announceIo({ kind: "error", text: "import failed — couldn't read the file" });
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

  const groups: RegisterGroup[] = [
    {
      id: "plan",
      label: "plan",
      items: [
        () => (
          <SeatSelector
            legend="week"
            options={[
              { value: "A", label: "a" },
              { value: "B", label: "b" },
            ]}
            value={week}
            onChange={(next) => dispatch({ type: "prefs/set", patch: { week: next } })}
            note="browsing only · the executing week is always a"
          />
        ),
        () => (
          <SeatSelector
            legend="cover"
            options={[
              { value: "w", label: "her 70" },
              { value: "m", label: "him 85" },
            ]}
            value={cover}
            onChange={(next) => dispatch({ type: "prefs/set", patch: { cover: next } })}
          />
        ),
        () => (
          <SeatSelector
            legend="variant"
            options={[
              { value: "full", label: "full" },
              { value: "morrisons-tester", label: "starter" },
            ]}
            value={planVariant}
            onChange={(next) => dispatch({ type: "prefs/set", patch: { planVariant: next } })}
            note={
              planVariant === "morrisons-tester"
                ? "morrisons starter · 10 meals, one retailer"
                : "full fortnight"
            }
          />
        ),
      ],
    },
    {
      id: "timing",
      label: "timing",
      items: [
        () => (
          <FieldRow label="serve time" htmlFor={serveTimeInputId}>
            <input
              id={serveTimeInputId}
              type="time"
              className="cd-text-input cd-focusable"
              value={serveTime}
              onChange={(event) =>
                dispatch({ type: "prefs/set", patch: { serveTime: event.target.value } })
              }
            />
          </FieldRow>
        ),
        () => (
          <FieldRow
            label="cycle start · saturday"
            htmlFor={cycleStartInputId}
            note={
              cycleStartSaturday ? (
                <p className="cd-field-note" role="status" aria-live="polite">
                  anchored · saturday {formatShortDateFromIso(cycleStartSaturday)}
                </p>
              ) : (
                <p className="cd-field-note" role="status" aria-live="polite">
                  not anchored · the rail's field has no fortnight position to report
                </p>
              )
            }
          >
            <input
              id={cycleStartInputId}
              type="date"
              className="cd-text-input cd-focusable"
              value={cycleStartSaturday ?? ""}
              onChange={(event) => {
                const raw = event.target.value;
                // Snap on commit — the input always ends up showing (and the
                // store always holds) a genuine Saturday, never whatever
                // weekday was picked.
                dispatch({
                  type: "prefs/set",
                  patch: { cycleStartSaturday: raw ? snapToSaturdayOnOrBefore(raw) : null },
                });
              }}
            />
          </FieldRow>
        ),
      ],
    },
    {
      id: "sensory",
      label: "sound",
      items: [() => <MuteSeat />],
    },
    {
      id: "state",
      label: "state",
      items: [
        () => (
          <FieldRow
          label="export"
          note={
            <p id={ioNoteId} className="cd-field-note" role="status" aria-live="polite">
              {ioStatus.kind === "idle"
                ? "writes a dated json file of every slice"
                : ioStatus.text}
            </p>
          }
        >
          <PressKey onPress={handleExport} cap="export json" aria-describedby={ioNoteId} />
          </FieldRow>
        ),
      ],
    },
    {
      id: "irreversible",
      label: "irreversible",
      lidSlot: (
        <span className="cd-danger-word" aria-hidden="true">
          guarded
        </span>
      ),
      items: [
        () => (
          // screencraft/02: "the danger zone sits below a rule line of its own,
          // keyed in the danger role, and every entry in it is a guarded switch."
          <div className="cd-danger-zone">
            <FieldRow label="import json">
              <ImportGuard onFile={(file) => void handleImportFile(file)} disabled={ioBusy} />
            </FieldRow>
          </div>
        ),
      ],
    },
  ];

  return (
    <Register
      label="station settings"
      groups={groups}
      openId={openGroup}
      onOpenChange={setOpenGroup}
      overflowWord="hidden"
    />
  );
}
