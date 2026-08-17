// The attention arbiter (PLAN §6.0 project signature): exactly one act-now
// slot per screen; urgency competes in a fixed priority queue. Rendered only
// via the shared <ArbiterSlot> component (F1's job) — this module just
// computes {rank1, queued}.
//
// Priority (contract): expired > defrost-overdue > timer-due > over-band >
// verify-nominee > primary-action. The first five categories are APP-WIDE —
// an expired item or a ringing timer must surface on every screen's slot
// regardless of which screen you're looking at ("runners-up render quiet
// with a queue count and inherit the slot when rank 1 clears," PLAN §6.0).
// Only `primary-action` is screen-specific.
import { ingredientShortName } from "../data/ingredients";
import { activeVariant } from "../data/variant";
import { bands, coverageForAllMeals, eatenSoFar, dutyStack, overBandMacros, todayInfo, tripBuild, type StartByDuty, type TripDay } from "../state/selectors";
import type { AppState } from "../state/types";
import { deriveProgramState } from "./timers";
import { getVariantProgram } from "./programs";

export type ScreenId = "today" | "plan" | "meal" | "cook" | "stores" | "shop" | "list";

export type ArbiterKind = "expired" | "defrost-overdue" | "timer-due" | "over-band" | "verify-nominee" | "primary-action";

export interface ArbiterDuty {
  kind: ArbiterKind;
  id: string;
  text: string;
  /** Best-effort deep-link hint for the ArbiterSlot's tap target — a screen
   * id and, where meaningful, an entity id. F1 interprets this; arbiter.ts
   * doesn't own routing. */
  target?: { screen: ScreenId; id?: string };
}

export interface ArbiterResult {
  rank1: ArbiterDuty | null;
  /** Count of remaining candidates behind rank1 (PLAN: "runners-up render
   * quiet with a queue count"). */
  queued: number;
}

export interface ArbiterContext {
  /** MEAL screen: which meal is being viewed (its primary-action is "cook").
   * Omit on other screens or when unknown — the meal-specific primary
   * action is simply absent (no fallback guess). */
  mealId?: string;
  /** SHOP/LIST verify-nominee scoping: which trip is current. Auto-inferred
   * from the fortnight position when omitted (see below) — pass explicitly
   * when the screen already knows (e.g. from the URL/trip id). */
  tripDay?: TripDay;
}

const STOCKTAKE_STALE_DAYS = 7;

function inferTripDay(state: AppState, now: Date): TripDay | null {
  const info = todayInfo(now, state.prefs.cycleStartSaturday);
  if (!info.anchored || info.fortnightDay == null) return null;
  if (info.fortnightDay === 0) return 0;
  if (info.fortnightDay === 7) return 7;
  return null;
}

/**
 * HEURISTIC: STORES' "stocktake nudge if stale >7d" needs a "when did we
 * last stocktake" timestamp that AppState has no dedicated field for (a full
 * stocktake isn't a distinct event in the contract-pinned schema — it's just
 * a burst of individual `inventory/set` dispatches). Approximated here as
 * the most recent `inventory[*].updatedAt` across the whole register: a real
 * stocktake touches most rows at once, so its timestamp dominates the max:
 * a single defrost move updating one item won't make the *whole* register
 * look fresh, since a real stocktake pass would still be visible as the max
 * unless literally every other row is more recent. Documented approximation,
 * not a precise "last full stocktake" ledger.
 */
function daysSinceLikelyStocktake(state: AppState, now: Date): number | null {
  const timestamps = Object.values(state.inventory).map((e) => new Date(e.updatedAt).getTime());
  if (timestamps.length === 0) return null;
  const mostRecent = Math.max(...timestamps);
  return (now.getTime() - mostRecent) / 86_400_000;
}

function primaryActionFor(screen: ScreenId, state: AppState, now: Date, ctx: ArbiterContext, startByDuty: ArbiterDuty | null): ArbiterDuty | null {
  switch (screen) {
    case "today":
      return startByDuty; // "tonight's cook" — dutyStack's start-by duty, if a dinner is scheduled today
    case "plan":
      return null; // contract: PLAN has no primary action
    case "meal":
      return ctx.mealId ? { kind: "primary-action", id: ctx.mealId, text: "cook →", target: { screen: "cook", id: ctx.mealId } } : null;
    case "cook":
      return null; // contract: COOK's own reel/done-button is the interaction, not an arbiter action
    case "stores": {
      const staleDays = daysSinceLikelyStocktake(state, now);
      if (staleDays == null || staleDays > STOCKTAKE_STALE_DAYS) {
        return { kind: "primary-action", id: "stocktake", text: "stocktake →", target: { screen: "stores" } };
      }
      return null;
    }
    case "shop":
      return { kind: "primary-action", id: "send-to-phone", text: "send to phone →", target: { screen: "shop" } };
    case "list":
      return { kind: "primary-action", id: "next-aisle", text: "next ▸", target: { screen: "list" } };
    default:
      return null;
  }
}

export function arbiterFor(screen: ScreenId, state: AppState, now: Date, ctx: ArbiterContext = {}): ArbiterResult {
  const candidates: ArbiterDuty[] = [];
  const variant = activeVariant(state); // docs/VARIANT-SPEC.md: over-band uses variant targets; verify-nominee idles under the tester's all-verified basket

  const duties = dutyStack(state, now);

  // Two explicit passes (not one combined loop): dutyStack's own return order
  // is defrost-before-expiring (its natural TODAY-list order), which is the
  // OPPOSITE of the arbiter's priority (expired must outrank defrost-overdue)
  // — candidates must be pushed in arbiter-priority order regardless of the
  // order dutyStack happens to list them in.
  for (const d of duties) {
    if (d.kind === "expiring" && d.expired) {
      candidates.push({ kind: "expired", id: d.id, text: d.text, target: { screen: "stores", id: d.ingId } });
    }
  }
  for (const d of duties) {
    if (d.kind === "defrost" && d.overdue) {
      candidates.push({ kind: "defrost-overdue", id: d.id, text: d.text, target: { screen: "stores", id: d.ingId } });
    }
  }

  // timer-due: the loaded program's alarm state, computed the same way
  // engine/timers.ts's useProgram() derives it, so the two never disagree.
  const program = state.timers.programId ? getVariantProgram(state.timers.programId, variant) : null;
  if (program) {
    const derived = deriveProgramState(program, state.timers, now.getTime());
    if (derived.dueNow && derived.stepNow) {
      candidates.push({
        kind: "timer-due",
        id: `${program.id}:${derived.stepNow.n}`,
        text: `${derived.stepNow.text} — time's up`,
        target: { screen: "cook", id: program.id },
      });
    }
  }

  // over-band: EATEN-SO-FAR macros vs band (wave-1 review fix — was the full
  // planned day, which sits by design right at the band edge and so fired
  // on nearly every day regardless of what had actually been eaten or the
  // time of day; eatenSoFar is swaps-aware by construction, see its doc).
  // Only meaningful on a plated weekday (Mon-Fri) — weekends carry duties,
  // not a banded plate (PLAN §1: "Sat/Sun carry duties, not plated meals").
  const info = todayInfo(now, state.prefs.cycleStartSaturday);
  if (info.dayNo !== "weekend") {
    const dayNo = info.anchored ? (info.dayNo as number) : null;
    if (dayNo != null) {
      const macros = eatenSoFar("A", dayNo, state.prefs.cover, state, now); // always Week A
      const macroBands = bands("A", state.prefs.cover, variant);
      const over = overBandMacros(macros, macroBands);
      if (over.length > 0) {
        candidates.push({
          kind: "over-band",
          id: `over-band:${over.join(",")}`,
          text: `over on ${over[0]}`,
          target: { screen: "today" },
        });
      }
    }
  }

  // verify-nominee: price-verify candidates from the current/inferable trip,
  // excluding anything already recorded in priceChecks.
  const tripDay = ctx.tripDay ?? inferTripDay(state, now);
  if (tripDay != null) {
    const trip = tripBuild(state.inventory, tripDay, state.swaps, variant); // swaps-aware (P2-PLAN-001); variant-aware (tester's basket is all-verified, no nominees)
    const outstanding = trip.verifyNominees.filter((ingId) => !state.priceChecks[ingId]);
    if (outstanding.length > 0) {
      candidates.push({
        kind: "verify-nominee",
        id: outstanding[0],
        // INT-3: display name, not the raw ingId ("verify price · banana",
        // not "· beef_mince") — id stays on `target`/`id` for navigation.
        text: `verify price · ${ingredientShortName(outstanding[0])}`,
        target: { screen: "shop", id: outstanding[0] },
      });
    }
  }

  const startByDuty = duties.find((d): d is StartByDuty => d.kind === "start-by");
  const startByArbiterDuty: ArbiterDuty | null = startByDuty
    ? { kind: "primary-action", id: startByDuty.id, text: `${startByDuty.text} (cook →)`, target: { screen: "cook", id: startByDuty.mealId } }
    : null;
  const primary = primaryActionFor(screen, state, now, ctx, startByArbiterDuty);
  if (primary) candidates.push(primary);

  if (candidates.length === 0) return { rank1: null, queued: 0 };
  const [rank1, ...rest] = candidates;
  return { rank1, queued: rest.length };
}

// Re-exported for screens that want the raw cook-from-stock ranking without
// going through the arbiter (STORES §6.7's strip) — kept here rather than
// duplicated since arbiter.ts already imports selectors.
export { coverageForAllMeals };
