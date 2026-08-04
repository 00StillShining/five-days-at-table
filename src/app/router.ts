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
  /**
   * The raw query string from the hash (everything after "?", not including
   * it), or "" when absent — e.g. "#/list?t=abc" -> "t=abc". Deliberately
   * NOT parsed into URLSearchParams here: lz-string's URL-safe alphabet
   * (engine/tripCodec.ts) includes literal "+" characters, and
   * URLSearchParams/application-x-www-form-urlencoded parsing treats "+" as
   * a space, silently corrupting any payload that contains one. Callers
   * that need a specific key should extract it themselves with a plain
   * substring/regex match instead of URLSearchParams.
   */
  query: string;
}

/** Props every registered scene component receives (src/app/scenes.tsx). */
export interface SceneProps {
  route: Route;
}

export function parseHash(hash: string): Route | null {
  const withoutPrefix = hash.replace(/^#\/?/, "");
  const queryIndex = withoutPrefix.indexOf("?");
  const path = queryIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : withoutPrefix.slice(queryIndex + 1);

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const [screen, param] = segments;
  if (!KNOWN_SCREENS.includes(screen as ScreenId)) return null;
  if (screen === "meal") {
    if (!param) return null;
    return { screen: "meal", params: { id: param }, query };
  }
  return { screen: screen as ScreenId, params: {}, query };
}

const LONDON_TIME_ZONE = "Europe/London";
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const londonPartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TIME_ZONE,
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
});

/**
 * The household's weekday/hour in Europe/London, independent of the device's own
 * timezone (matches the masthead's date formatting — PHASE2-CONTRACT conventions:
 * "Dates: Europe/London"). Without this, a builder or owner travelling abroad would
 * see the cycle cursor suggest the wrong day.
 */
function londonParts(now: Date): { day: number; hour: number } {
  const parts = londonPartsFormatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "0";
  return { day: WEEKDAY_INDEX[weekday] ?? now.getDay(), hour: Number(hour) };
}

/**
 * The cycle cursor's suggested station, derived from weekday only (SOL-BRIEF §1 /
 * PLAN §6.2): Sat -> shop, Sun -> cook, Mon-Fri -> today, Fri evening (>=17:00) ->
 * stores. Advisory only — it never reorders or hides rail keys.
 */
export function stationForDate(now: Date): RailScreenId {
  const { day, hour } = londonParts(now); // 0 = Sunday ... 6 = Saturday
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

  return parseHash(hash) ?? { screen: "today", params: {}, query: "" };
}
