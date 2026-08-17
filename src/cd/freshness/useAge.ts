/**
 * src/cd/freshness/useAge.ts — reading the ages that already exist.
 *
 * Every timestamp below is ALREADY in the frozen state. Nothing here writes,
 * migrates, or extends `src/state/**` — the honesty layer's whole job is to
 * surface ages the store has been recording all along and nobody has been
 * showing.
 *
 *   inventory[ingId].updatedAt   the stocktake anchor
 *   inventory[ingId].thawedAt    the defrost instant, deliberately separate
 *   eaten[date][slot].at         one tick per date+slot
 *   priceChecks[ingId].on        ISO DATE (no time) — see the note below
 *   timers.startedAt             epoch ms, null until start()
 *   variant verifiedOn           the price sheet's own ISO date
 *
 * CORRECTIONARY 4: "every live reading shows its exact figure AND ITS AGE".
 * These hooks return the exact figure alongside the age so a caller physically
 * cannot render one without the other.
 */

import { useEffect, useState } from "react";
import { ageOf, type Age, type FreshnessClass } from "./classes";

/**
 * A ticking clock for age display.
 *
 * Deliberately NOT `src/state/useNow` — that hook's 30s default is right for
 * defrost countdowns and wrong for a 2000ms timer class, and importing it here
 * would tie the honesty layer's cadence to a screen-freshness decision made for
 * a different reason. The default here is 1000ms because the shortest declared
 * threshold in classes.ts is 2000ms, and a clock must tick at least twice
 * inside the window it polices or a reading can be stale for a full second
 * before anything says so.
 *
 * II.4.17 — offscreen is asleep. The interval is dropped while the document is
 * hidden and one immediate read happens on return, so a backgrounded tab does
 * not run a timer per stale badge.
 */
export function useAgeClock(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const doc = typeof document !== "undefined" ? document : null;
    let id: number | null = null;

    const start = (): void => {
      if (id !== null) return;
      setNow(Date.now());
      id = window.setInterval(() => setNow(Date.now()), intervalMs);
    };
    const stop = (): void => {
      if (id === null) return;
      window.clearInterval(id);
      id = null;
    };
    const onVisibility = (): void => {
      if (doc?.visibilityState === "hidden") stop();
      else start();
    };

    if (doc?.visibilityState !== "hidden") start();
    doc?.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      doc?.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  return now;
}

/** Age one timestamp against its declared class. */
export function useAge(
  cls: FreshnessClass,
  takenAt: string | number | null | undefined,
  intervalMs = 1000
): Age {
  const now = useAgeClock(intervalMs);
  return ageOf(cls, takenAt, now);
}

/* ------------------------------------------------------------------ */
/* readers over the frozen state's own shapes                          */
/* ------------------------------------------------------------------ */

interface InventoryEntryLike {
  updatedAt: string;
  thawedAt?: string | null;
}

/**
 * How old the stocktake on one shelf entry is.
 * An entry that is not in the inventory at all has never been counted, which
 * `ageOf` reports as NEVER rather than as an age of zero.
 */
export function stocktakeAge(
  entry: InventoryEntryLike | undefined,
  now: number
): Age {
  return ageOf("stocktake", entry?.updatedAt, now);
}

/**
 * How long ago an item was moved out of the freezer.
 *
 * `thawedAt` is absent on anything still frozen — and on every entry persisted
 * before the field existed. Both mean "not yet thawed", which is the correct
 * conservative answer and NOT a stale reading, so this returns null rather than
 * an Age. Reporting a frozen item as a stale thaw is exactly the false-expired
 * flood the field was split out to prevent.
 */
export function thawAge(entry: InventoryEntryLike | undefined, now: number): Age | null {
  if (!entry?.thawedAt) return null;
  return ageOf("stocktake", entry.thawedAt, now);
}

interface EatenTickLike {
  at: string;
}

/** How long ago a slot was ticked. */
export function eatenAge(tick: EatenTickLike | undefined, now: number): Age {
  return ageOf("eaten", tick?.at, now);
}

interface PriceCheckLike {
  price: number;
  on: string;
}

/**
 * How old a price check is.
 *
 * `PriceCheck.on` is an ISO DATE with no time component, so `Date.parse` reads
 * it as midnight UTC. A price checked today therefore ages from this morning
 * rather than from the moment it was entered — which understates freshness by
 * up to a day and never overstates it. Against a 14-day threshold that error
 * can only ever call a price stale early, never late, and a price quoted as
 * older than it is cannot mislead a shopper.
 */
export function priceAge(check: PriceCheckLike | undefined, now: number): Age {
  return ageOf("price", check?.on, now);
}

/** How old the variant price sheet's own verification is. */
export function verifiedAge(verifiedOn: string | null | undefined, now: number): Age {
  return ageOf("price", verifiedOn, now);
}

interface TimerSliceLike {
  startedAt: number | null;
  pausedAt: number | null;
}

/**
 * Whether a running program is still reporting.
 *
 * II.3.18's stale rule is "no data for 2000ms". A PAUSED timer is not stale —
 * it is paused, and it says so; a timer that has never started has no reading
 * to age. Only a timer that claims to be running while its clock has stopped
 * advancing is lying, and that is the one case this reports.
 */
export function timerAge(
  timers: TimerSliceLike,
  lastTickAt: number | null,
  now: number
): Age | null {
  if (timers.startedAt === null) return null; // never started — no reading
  if (timers.pausedAt !== null) return null; // paused — a declared state, not a gap
  return ageOf("timer", lastTickAt ?? timers.startedAt, now);
}
