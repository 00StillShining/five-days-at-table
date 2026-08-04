// Pure reducer over AppState. Kept separate from store.tsx (the React
// provider) so it's trivially unit-testable without React.
import type { AppState, Action, TimerSliceState } from "./types";
import { computePrepCompletion } from "./prepCompletion";
import { makeId } from "./ids";
export { makeId } from "./ids"; // re-exported for backwards-compatible import sites

export const defaultTimers: TimerSliceState = {
  programId: null,
  startedAt: null,
  pausedAt: null,
  accumulatedPauseMs: 0,
  extraMs: 0,
  doneSteps: [],
};

export const defaultState: AppState = {
  prefs: { cover: "w", week: "A", scale: 1, serveTime: "19:30", cycleStartSaturday: null },
  inventory: {},
  eaten: {},
  shopTicks: {},
  leftovers: [],
  waste: [],
  priceChecks: {},
  timers: defaultTimers,
  swaps: {},
};

export function reducer(state: AppState, action: Action): AppState {
  const nowIso = () => new Date().toISOString();

  switch (action.type) {
    case "prefs/set":
      return { ...state, prefs: { ...state.prefs, ...action.patch } };

    case "inventory/set": {
      // Preserve any existing thawedAt — a plain stocktake/level touch must
      // never itself start (or silently drop) the post-thaw clock; only
      // inventory/markThawed does that (P1 wave-1-review fix).
      const existing = state.inventory[action.ingId];
      return {
        ...state,
        inventory: {
          ...state.inventory,
          [action.ingId]: { level: action.level, updatedAt: action.at ?? nowIso(), thawedAt: existing?.thawedAt ?? null },
        },
      };
    }

    case "inventory/setMany": {
      const next = { ...state.inventory };
      for (const e of action.entries) {
        const existing = state.inventory[e.ingId];
        next[e.ingId] = { level: e.level, updatedAt: e.at ?? nowIso(), thawedAt: existing?.thawedAt ?? null };
      }
      return { ...state, inventory: next };
    }

    case "inventory/markThawed": {
      const existing = state.inventory[action.ingId];
      const at = action.at ?? nowIso();
      return {
        ...state,
        inventory: {
          ...state.inventory,
          [action.ingId]: { level: existing?.level ?? 4, updatedAt: at, thawedAt: at },
        },
      };
    }

    case "eaten/tick": {
      const day = { ...(state.eaten[action.date] ?? {}) };
      day[action.slot] = { mealId: action.mealId, at: action.at ?? nowIso() };
      return { ...state, eaten: { ...state.eaten, [action.date]: day } };
    }

    case "eaten/untick": {
      const day = { ...(state.eaten[action.date] ?? {}) };
      delete day[action.slot];
      return { ...state, eaten: { ...state.eaten, [action.date]: day } };
    }

    case "shopTicks/tick": {
      const trip = { ...(state.shopTicks[action.tripId] ?? {}) };
      trip[action.ingId] = { at: action.at ?? nowIso() };
      return { ...state, shopTicks: { ...state.shopTicks, [action.tripId]: trip } };
    }

    case "shopTicks/untick": {
      const trip = { ...(state.shopTicks[action.tripId] ?? {}) };
      delete trip[action.ingId];
      return { ...state, shopTicks: { ...state.shopTicks, [action.tripId]: trip } };
    }

    case "leftovers/add": {
      const entry = { ...action.entry, id: action.entry.id ?? makeId("lo") };
      return { ...state, leftovers: [...state.leftovers, entry] };
    }

    case "leftovers/consume":
      return {
        ...state,
        leftovers: state.leftovers.map((l) => (l.id === action.id ? { ...l, consumedAt: action.at ?? nowIso() } : l)),
      };

    case "leftovers/remove":
      return { ...state, leftovers: state.leftovers.filter((l) => l.id !== action.id) };

    case "waste/add": {
      const entry = { ...action.entry, id: action.entry.id ?? makeId("waste") };
      return { ...state, waste: [...state.waste, entry] };
    }

    case "priceChecks/set":
      return {
        ...state,
        priceChecks: { ...state.priceChecks, [action.ingId]: { price: action.price, on: action.on ?? nowIso().slice(0, 10) } },
      };

    case "timers/load":
      return { ...state, timers: { ...defaultTimers, programId: action.programId } };

    case "timers/start": {
      if (state.timers.programId == null) return state; // no-op: nothing loaded
      if (state.timers.startedAt != null) return state; // no-op: already started, see engine/timers.ts doc
      return { ...state, timers: { ...state.timers, startedAt: action.at ?? Date.now() } };
    }

    case "timers/pause": {
      if (state.timers.startedAt == null || state.timers.pausedAt != null) return state; // not running
      return { ...state, timers: { ...state.timers, pausedAt: action.at ?? Date.now() } };
    }

    case "timers/resume": {
      if (state.timers.pausedAt == null) return state; // not paused
      const at = action.at ?? Date.now();
      const additionalPause = Math.max(0, at - state.timers.pausedAt);
      return {
        ...state,
        timers: {
          ...state.timers,
          pausedAt: null,
          accumulatedPauseMs: state.timers.accumulatedPauseMs + additionalPause,
        },
      };
    }

    case "timers/plusOneMinute":
      if (state.timers.startedAt == null) return state;
      return { ...state, timers: { ...state.timers, extraMs: state.timers.extraMs + 60_000 } };

    case "timers/doneStep":
      if (state.timers.doneSteps.includes(action.step)) return state;
      return { ...state, timers: { ...state.timers, doneSteps: [...state.timers.doneSteps, action.step].sort((a, b) => a - b) } };

    case "timers/reset":
      return { ...state, timers: defaultTimers };

    case "prep/completeSession": {
      const result = computePrepCompletion(action.week, state.inventory, action.at ?? nowIso());
      if (!result) return state; // defensive: unknown week
      return { ...state, inventory: result.inventory, leftovers: [...state.leftovers, ...result.newLeftovers] };
    }

    // P2-PLAN-001: PLAN §6.4 swap deck. See state/types.ts's `Swaps` doc for
    // the keying rationale (planned meal id -> replacement meal id).
    case "swaps/commit":
      return { ...state, swaps: { ...state.swaps, [action.slotMealId]: action.replacementMealId } };

    case "swaps/clear": {
      const next = { ...state.swaps };
      delete next[action.slotMealId];
      return { ...state, swaps: next };
    }

    case "swaps/clearAll":
      return { ...state, swaps: {} };

    case "state/replace":
      return action.state;

    default:
      return state;
  }
}
