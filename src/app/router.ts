// Tiny hash router (docs/PHASE2-CONTRACT.md: "no router lib").
// Routes: #/today #/plan #/meal/:id #/cook #/stores #/shop #/list
import { useEffect, useSyncExternalStore } from "react";

export type ScreenId = "today" | "plan" | "meal" | "cook" | "stores" | "shop" | "list";

/** The five loop-rail keys, in the fixed on-screen + hotkey order (PLAN §6.2 / D6). */
export type RailScreenId = "today" | "plan" | "cook" | "stores" | "shop";
export const RAIL_STATIONS: RailScreenId[] = ["today", "plan", "cook", "stores", "shop"];

const KNOWN_SCREENS: ScreenId[] = ["today", "plan", "meal", "cook", "stores", "shop", "list"];

export interface Route {
  screen: ScreenId;
  params: { id?: string };
}

/** Props every registered scene component receives (src/app/scenes.tsx). */
export interface SceneProps {
  route: Route;
}

export function parseHash(hash: string): Route | null {
  const clean = hash.replace(/^#\/?/, "");
  const segments = clean.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const [screen, param] = segments;
  if (!KNOWN_SCREENS.includes(screen as ScreenId)) return null;
  if (screen === "meal") {
    if (!param) return null;
    return { screen: "meal", params: { id: param } };
  }
  return { screen: screen as ScreenId, params: {} };
}

/**
 * The cycle cursor's suggested station, derived from weekday only (SOL-BRIEF §1 /
 * PLAN §6.2): Sat -> shop, Sun -> cook, Mon-Fri -> today, Fri evening (>=17:00) ->
 * stores. Advisory only — it never reorders or hides rail keys.
 */
export function stationForDate(now: Date): RailScreenId {
  const day = now.getDay(); // 0 = Sunday ... 6 = Saturday
  const hour = now.getHours();
  if (day === 6) return "shop";
  if (day === 0) return "cook";
  if (day === 5 && hour >= 17) return "stores";
  return "today";
}

export function defaultRoute(now: Date = new Date()): string {
  return `#/${stationForDate(now)}`;
}

function readHash(): string {
  return window.location.hash;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

/**
 * Reads the current hash route and redirects once per change:
 * - empty hash (first load) -> the cycle-cursor's suggested station
 * - any other unrecognised hash -> #/today
 * Known routes pass through untouched.
 */
export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, readHash, readHash);

  useEffect(() => {
    if (hash === "" || hash === "#" || hash === "#/") {
      window.location.hash = defaultRoute();
      return;
    }
    if (!parseHash(hash)) {
      window.location.hash = "#/today";
    }
  }, [hash]);

  return parseHash(hash) ?? { screen: "today", params: {} };
}
