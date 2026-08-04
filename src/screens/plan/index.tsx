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
import { useState } from "react";
import type { SceneProps } from "../../app/router";
import { ArbiterSlot } from "../../components/ArbiterSlot";
import { mealsByWeekDay, planDays, planThemes } from "../../data";
import type { Slot } from "../../data/types";
import type { ArbiterDuty } from "../../engine/arbiter";
import { arbiterFor } from "../../engine/arbiter";
import { useStore } from "../../state/store";
import { AdherenceGauge } from "./AdherenceGauge";
import { dayMacrosWithSwaps, dayOverBand, MACRO_LABEL } from "./helpers";
import "./plan.css";
import { EmptySlotCard, SlotCard } from "./SlotCard";
import { SwapDeck } from "./SwapDeck";
import { commitSwap, swapKeyOf, useSwaps } from "./swapStore";

const SLOTS: Slot[] = ["breakfast", "lunch", "dinner", "snack"];

function navigateTo(target: ArbiterDuty["target"]): void {
  if (!target) return;
  window.location.hash = target.screen === "meal" && target.id ? `#/meal/${target.id}` : `#/${target.screen}`;
}

export default function PlanScreen(_props: SceneProps) {
  const { state } = useStore();
  const { week, cover } = state.prefs;
  const swaps = useSwaps();

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
  // primary-action is null per engine/arbiter.ts's contract; computed fresh
  // each render off `new Date()` since SceneProps carries no live clock from
  // App.tsx (chassis-owned, out of this screen's ownership — see final report).
  const arbiter = arbiterFor("plan", state, new Date());

  function openSwap(day: number, slot: Slot): void {
    setSwapTarget({ day, slot });
    setSheetOpen(true);
  }

  return (
    <div className="scr-plan">
      <ArbiterSlot
        text={arbiter.rank1?.text ?? "board's clear · nothing needs attention"}
        count={arbiter.queued}
        actionLabel={arbiter.rank1 ? "go" : undefined}
        onActivate={arbiter.rank1 ? () => navigateTo(arbiter.rank1?.target) : undefined}
      />

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
          const theme = planThemes[i];
          const mealBySlot = new Map(mealsByWeekDay(week, day).map((m) => [m.slot, m]));
          const dayTotals = dayMacrosWithSwaps(week, day, cover, swaps);
          const over = dayOverBand(week, day, cover, swaps);

          return (
            <article className="scr-plan-day" key={day}>
              <h2 className="scr-plan-day-heading">
                {dayName.slice(0, 3).toLowerCase()}
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
        onCommit={(candidateId) => {
          commitSwap(swapKeyOf(week, swapTarget.day, swapTarget.slot), candidateId);
          setSheetOpen(false);
        }}
      />
    </div>
  );
}
