/**
 * src/screens/list/useRunOut.ts — the window, and the clock that closes it.
 *
 * IRREDUCIBLE §1: "One window of consequence that closes itself, on a clock the
 * operator never has to remember ... IRREDUCIBLE hands its authority to the
 * clock rather than the grip — the entire trust the language builds."
 *
 * On LIST the window is the undo. Pressing a row buys it AT ONCE — the semantic
 * commit is applied to the model ref inside the input's own task, before this
 * hook is touched at all — and this hook holds open the 1800ms during which the
 * decision can still be taken back. When the clock ends it, the row stops being
 * rendered. Nothing here gates a commit; it only decides how long a row stays
 * on the plate after its truth has already changed.
 *
 * SYSTÈME S, WRITTEN INTO THE EVENT MODEL RATHER THAN CAST IN BRASS
 * ---------------------------------------------------------------------------
 * §3: "a press against a window already running does nothing, and continued
 * contact past the release that started it cannot extend, retrigger, or hold
 * the window open." `isRunning` is that guard, and it is read from a REF rather
 * than from render state so a second press landing in the same frame as the
 * first — the exact double-tap a jostled thumb produces in a shop — is already
 * inert, without waiting for React to catch up.
 *
 * PER-INSTANCE STATE, NEVER A MODULE-LEVEL FLAG
 * ---------------------------------------------------------------------------
 * §3's own worked JS: "the control passed in, not a shared flag — every
 * station's window is its own." Two rows pressed a second apart run two
 * independent windows; neither shortens or extends the other.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RUNOUT_MS } from "./model";

export interface RunOutWindow {
  ingId: string;
  /** performance.now() at the release that opened it. */
  startedAt: number;
}

export interface RunOut {
  /** Rows still inside their own window: rendered, draining, undoable. */
  inFlight: ReadonlySet<string>;
  /** The most recently opened window — what the fixed-position key addresses. */
  newest: RunOutWindow | null;
  /** Système S: true while this row's window runs. A press then does nothing. */
  isRunning: (ingId: string) => boolean;
  /** Open a window. Called AFTER the semantic commit, never before it. */
  arm: (ingId: string) => void;
  /** Close a window early — the put-back. Returns false if it was not open. */
  cancel: (ingId: string) => boolean;
  /** Close every window at once, e.g. when the trip closes. */
  clear: () => void;
}

export function useRunOut(durationMs: number = RUNOUT_MS): RunOut {
  const timers = useRef(new Map<string, number>());
  const opened = useRef(new Map<string, number>());
  const [order, setOrder] = useState<string[]>([]);

  useEffect(
    () => () => {
      for (const t of timers.current.values()) window.clearTimeout(t);
      timers.current.clear();
      opened.current.clear();
    },
    []
  );

  const isRunning = useCallback((ingId: string) => opened.current.has(ingId), []);

  const close = useCallback((ingId: string) => {
    const t = timers.current.get(ingId);
    if (t != null) window.clearTimeout(t);
    timers.current.delete(ingId);
    opened.current.delete(ingId);
    setOrder((prev) => (prev.includes(ingId) ? prev.filter((id) => id !== ingId) : prev));
  }, []);

  const arm = useCallback(
    (ingId: string) => {
      if (opened.current.has(ingId)) return; // Système S — inert against itself
      opened.current.set(ingId, performance.now());
      timers.current.set(
        ingId,
        window.setTimeout(() => close(ingId), durationMs)
      );
      setOrder((prev) => [...prev.filter((id) => id !== ingId), ingId]);
    },
    [close, durationMs]
  );

  const cancel = useCallback(
    (ingId: string) => {
      if (!opened.current.has(ingId)) return false;
      close(ingId);
      return true;
    },
    [close]
  );

  const clear = useCallback(() => {
    for (const t of timers.current.values()) window.clearTimeout(t);
    timers.current.clear();
    opened.current.clear();
    setOrder((prev) => (prev.length === 0 ? prev : []));
  }, []);

  /* Stable identity: `groups` and `boughtRows` memoise on this Set, and a fresh
     Set every render would recompute the whole register on every keystroke
     anywhere on the page. */
  const inFlight = useMemo(() => new Set(order), [order]);

  const newestId = order.length > 0 ? order[order.length - 1] : null;
  const newest =
    newestId != null ? { ingId: newestId, startedAt: opened.current.get(newestId) ?? 0 } : null;

  return { inFlight, newest, isRunning, arm, cancel, clear };
}
