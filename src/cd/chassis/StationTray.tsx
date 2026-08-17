/**
 * src/cd/chassis/StationTray.tsx — section 4's Tool Menu, and where settings live.
 *
 * "Tool Menu — the Station Tray. A long-press past 350ms ... opens a Foundry
 * tray (II.3.30) from the Answer Key's own position, holding the DAILY/WEEKLY/
 * RARE tiers of IV.2: the field's own stations sit at the daily tier, one press
 * away; a weekly tier of deeper settings sits one tray disclosure further; a
 * rare tier — factory reset, storage wipe — sits behind an explicit long-press
 * confirmation of its own, never surfaced by default."
 *
 * THE SETTINGS SURFACE IS NOT A NINTH LANGUAGE. It is this one. Every control
 * below is a press — the only gesture 13 BACK CHANNEL permits — and every
 * two-position value is a two-station seat selector with a lit seat point,
 * which is the Cycle Ring at its smallest honest size.
 *
 * REACH, per screencraft/02 ("Reach obeys frequency, not category"):
 *   DAILY    the five rooms .................... on the rail, one press
 *   WEEKLY   week, cover, plan, serve, cycle,
 *            sound ............................. this tray, one disclosure
 *   RARE     import (it REPLACES every slice) ... the danger zone, guarded
 *
 * GROUP BY CONSEQUENCE, not by alphabet. Everything above the rule line is
 * instant-apply and freely reversible — "the value the operator sees is the
 * value in force". Below the line sits the one operation this product cannot
 * undo, keyed in the danger role and behind a hold-to-arm interlock.
 */

import { useId, useRef, useState, type ReactNode } from "react";
import { Tray } from "../foundry/Tray";
import { PressKey } from "../foundry/PressKey";
import { GuardedKey } from "../foundry/GuardedKey";
import { isMuted, setMuted } from "../sound/bus";
import "./chassis.css";

export interface SeatOption<T extends string> {
  value: T;
  label: string;
}

export interface SeatSelectorProps<T extends string> {
  legend: string;
  options: readonly [SeatOption<T>, SeatOption<T>];
  value: T;
  onChange: (next: T) => void;
  note?: string;
}

/**
 * Two stations, addressed by press. Not a slider, not a switch that travels —
 * this world's grammar has exactly one gesture, and a control that asked for a
 * drag would be a second language smuggled into a single control, which
 * CORRECTIONARY 3.5 keeps banned even after loosening everything around it.
 *
 * The seated position is carried by THREE channels, not by colour alone
 * (II.7.7): the key sits down in its socket, its seat point steps from
 * #8A8A8A to #F5F7F8 (4.99:1 to 16.03:1 on the key face), and aria-checked
 * states it outright.
 */
export function SeatSelector<T extends string>({
  legend,
  options,
  value,
  onChange,
  note,
}: SeatSelectorProps<T>) {
  const legendId = useId();
  return (
    <div className="cd-field-row" role="group" aria-labelledby={legendId}>
      <span id={legendId} className="cd-field-label">
        {legend}
      </span>
      <div className="cd-seats">
        {options.map((option) => {
          const seated = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={seated}
              className="cd-seat cd-focusable"
              data-cd-seated={seated ? "true" : undefined}
              onPointerDown={() => navigator.vibrate?.(10)}
              onClick={() => onChange(option.value)}
            >
              <span className="cd-seat-point" aria-hidden="true" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
      {note ? (
        <p className="cd-field-note" role="status" aria-live="polite">
          {note}
        </p>
      ) : null}
    </div>
  );
}

export interface FieldRowProps {
  label: string;
  htmlFor?: string;
  note?: ReactNode;
  children: ReactNode;
}

export function FieldRow({ label, htmlFor, note, children }: FieldRowProps) {
  return (
    <div className="cd-field-row">
      {htmlFor ? (
        <label className="cd-field-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="cd-field-label">{label}</span>
      )}
      {children}
      {note}
    </div>
  );
}

export interface StationTrayProps {
  open: boolean;
  onClose: () => void;
  id: string;
  /**
   * The Close Read: the rail's own cap, promoted to full lattice resolution.
   * A node for the same reason the rail's cap is one — the 1Hz clock of a
   * running program stays inside the leaf that owns it.
   */
  closeRead: ReactNode;
  children: ReactNode;
}

/**
 * Section 4's Close Read: "Selecting a row promotes its small field to full
 * Field Screen scale ... the field carried across as ONE OBJECT WITH TWO HOMES
 * rather than exiting and re-entering." The tray's head field renders exactly
 * the pattern the rail's cap is rendering, at 25x25 / 489 rather than 7x7 / 37.
 * Same reading, more resolution — never a second, differently-derived number.
 */
export function StationTray({ open, onClose, id, closeRead, children }: StationTrayProps) {
  return (
    <Tray
      open={open}
      onClose={onClose}
      id={id}
      title="station"
      exitLabel="close"
      edge="inline-start"
      className="cd-station-tray"
    >
      <div className="cd-tray-close-read">{closeRead}</div>
      {children}
    </Tray>
  );
}

/**
 * The sound bus's mute, which II.5.14 names a CHASSIS control explicitly:
 * "Mute is a chassis control, persisted in storage, honored across sessions
 * forever, and it silences the SENSORY LAYER ONLY: every commit, every motion,
 * every warning lamp proceeds identically with the gain at zero."
 *
 * Read once on mount rather than subscribed: the value only changes here.
 */
export function MuteSeat() {
  const [muted, setLocal] = useState(() => isMuted());
  return (
    <SeatSelector
      legend="sound"
      options={[
        { value: "on", label: "on" },
        { value: "off", label: "muted" },
      ]}
      value={muted ? "off" : "on"}
      onChange={(next) => {
        const nextMuted = next === "off";
        setMuted(nextMuted);
        setLocal(nextMuted);
      }}
      note={
        muted
          ? "cues silenced · every lamp, motion and commit is unchanged"
          : "cues audible · nothing sounds until your first press"
      }
    />
  );
}

export interface FilePickKeyProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

/**
 * Import replaces EVERY slice of state, all-or-nothing, and nothing in this
 * product can undo it. screencraft/02: "Undo outranks confirm wherever reversal
 * is real ... A confirmation dialog is reserved for the narrower case:
 * consequence that undo cannot restore." That is this. So it is a guarded
 * switch, not a bigger button.
 */
export function ImportGuard({ onFile, disabled }: FilePickKeyProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <GuardedKey
        onCommit={() => input.current?.click()}
        armLabel="arm import"
        commitLabel="choose file"
        consequence="armed · the chosen file REPLACES every stored slice, and cannot be undone"
        disabled={disabled}
      />
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="cd-visually-hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = ""; // allow re-selecting the same file after a retry
          if (file) onFile(file);
        }}
      />
    </>
  );
}

export { PressKey };
