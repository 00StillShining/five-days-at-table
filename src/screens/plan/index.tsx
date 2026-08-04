// PLAN — the fortnight board (PLAN.md §6.4). Playful-technical lean; the
// week adherence gauge is this screen's one borrowed precision object,
// everything else (grid, chips, roll-up) stays flat/silkscreen per §6.0's
// no-50/50-blend rule.
//
// The A/B paddle in the global masthead (src/app/Paddles.tsx, prefs.week) IS
// this board's view switch — PLAN does not render a second paddle. The
// executing fortnight is always Week A twice (D5); prefs.week here is purely
// the browsing toggle PHASE2-CONTRACT documents, exactly as SOL-BRIEF's key
// fact states.
//
// Swap commits now go through the real `swaps` AppState slice
// (state/types.ts, landed to unblock data/raw/decision-request.plan.json /
// P2-PLAN-001) — reload-persistent, dispatched via useStore() like every
// other slice. No screen-local swap store anymore.
import { useState } from "react";
import type { SceneProps } from "../../app/router";
import { ArbiterSlot, type ArbiterDuty as ArbiterSlotDuty } from "../../components/ArbiterSlot";
import { mealsByWeekDay, planDays, planThemes } from "../../data";
import type { Slot } from "../../data/types";
import type { ArbiterDuty } from "../../engine/arbiter";
import { arbiterFor } from "../../engine/arbiter";
import { dayMacros } from "../../state/selectors";
import { useStore } from "../../state/store";
import { useNow } from "../../state/useNow";
import { AdherenceGauge } from "./AdherenceGauge";
import { dayOverBand, MACRO_LABEL } from "./helpers";
import "./plan.css";
import { EmptySlotCard, SlotCard } from "./SlotCard";
import { SwapDeck } from "./SwapDeck";

const SLOTS: Slot[] = ["breakfast", "lunch", "dinner", "snack"];
const IDLE_TEXT = "board's clear · nothing needs attention";

function navigateTo(target: ArbiterDuty["target"]): void {
  if (!target) return;
  window.location.hash = target.screen === "meal" && target.id ? `#/meal/${target.id}` : `#/${target.screen}`;
}

export default function PlanScreen(_props: SceneProps) {
  const { state, dispatch } = useStore();
  const { week, cover } = state.prefs;
  const swaps = state.swaps;

  // swapTarget stays defined once initialized (defaults harmlessly to day 1
  // breakfast, never shown until sheetOpen flips true) rather than resetting
  // to null on close — <SwapDeck> is always mounted, only `open` toggles, so
  // the shared <Sheet>'s own effect gets to call the native dialog.close()
  // (Esc/backdrop/cancel/commit all funnel through the same `onClose`
  // prop -> setSheetOpen(false) path), which is what restores keyboard focus
  // to the "swap ▸" button that opened it. Unmounting SwapDeck outright on
  // close would skip that native close() call and drop focus to <body>.
  const [swapTarget, setSwapTarget] = useState<{ day: number; slot: Slot }>({ day: 1, slot: "breakfast" });
  const [sheetOpen, setSheetOpen] = useState(false);

  // arbiterFor's screen-agnostic candidates (expired/defrost-overdue/timer-
  // due/over-band/verify-nominee) are still live on PLAN even though its own
  // primary-action is null per engine/arbiter.ts's contract. useNow() (wave-1
  // review fix, promoted to src/state/** during integration) ticks every 30s
  // so an item that becomes due while this tab sits open on PLAN — a timer
  // firing, a defrost going overdue — actually appears without the user
  // having to navigate away and back to force a re-render.
  const now = useNow();
  const arbiterResult = arbiterFor("plan", state, now);
  const arbiterDuty = arbiterResult.rank1;
  // Bridge engine/arbiter.ts's ArbiterDuty ({kind,id,text,target}) to
  // components/ArbiterSlot's own same-named ArbiterDuty ({text,actionLabel,
  // onActivate,busy}) — the two are deliberately different shapes owned by
  // different modules, not the same type.
  const rank1: ArbiterSlotDuty | null = arbiterDuty
    ? { text: arbiterDuty.text, actionLabel: "go", onActivate: () => navigateTo(arbiterDuty.target) }
    : null;

  function openSwap(day: number, slot: Slot): void {
    setSwapTarget({ day, slot });
    setSheetOpen(true);
  }

  return (
    <div className="scr-plan">
      <ArbiterSlot rank1={rank1} count={arbiterResult.queued} idleText={IDLE_TEXT} />

      <header className="scr-plan-head">
        <h1 className="scr-plan-title">plan</h1>
        <p className="scr-plan-sub">
          week {week.toLowerCase()} board · {cover === "w" ? "her 70" : "him 85"}
        </p>
      </header>

      <AdherenceGauge week={week} cover={cover} swaps={swaps} />

      <section className="scr-plan-grid" aria-label={`week ${week} fortnight board`}>
        {planDays.map((dayName, i) => {
          const day = i + 1;
          const dayAbbr = dayName.slice(0, 3).toLowerCase();
          const theme = planThemes[i];
          const mealBySlot = new Map(mealsByWeekDay(week, day).map((m) => [m.slot, m]));
          const dayTotals = dayMacros(week, day, cover, 1, swaps);
          const over = dayOverBand(week, day, cover, swaps);

          return (
            <article className="scr-plan-day" key={day}>
              <h2 className="scr-plan-day-heading">
                {dayAbbr}
                <span className="scr-plan-day-theme">{theme}</span>
              </h2>
              <ul className="scr-plan-day-slots">
                {SLOTS.map((slot) => {
                  const meal = mealBySlot.get(slot);
                  return (
                    <li key={slot}>
                      {meal ? (
                        <SlotCard
                          week={week}
                          day={day}
                          dayLabel={dayAbbr}
                          slot={slot}
                          meal={meal}
                          cover={cover}
                          eaten={state.eaten}
                          swaps={swaps}
                          onOpenSwap={() => openSwap(day, slot)}
                        />
                      ) : (
                        <EmptySlotCard slot={slot} />
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="scr-plan-day-total" data-over={over.length > 0 || undefined}>
                day total {Math.round(dayTotals.kcal)} kcal
                {over.length > 0 && (
                  <strong className="scr-plan-day-flag">
                    {" "}
                    <span aria-hidden="true">▲</span> over band · {over.map((k) => MACRO_LABEL[k]).join(", ")}
                  </strong>
                )}
              </p>
            </article>
          );
        })}
      </section>

      <SwapDeck
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        week={week}
        day={swapTarget.day}
        dayLabel={planDays[swapTarget.day - 1]}
        slot={swapTarget.slot}
        cover={cover}
        inventory={state.inventory}
        swaps={swaps}
        onCommit={(plannedMealId, candidateMealId) => {
          dispatch({ type: "swaps/commit", slotMealId: plannedMealId, replacementMealId: candidateMealId });
          setSheetOpen(false);
        }}
      />
    </div>
  );
}
