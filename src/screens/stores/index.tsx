// STORES — register + fuzzy inventory (PLAN §6.7 / D7). "The 54-row register
// fused with live inventory: how much do we have, how long does it last."
// Phase 2 wave 1 (docs/PHASE2-CONTRACT.md): this folder is self-contained per
// the ownership rule — no other screen folder imports from it, and it
// imports only components/engine/state/data, never another screen.
//
// KEY FACT (PLAN §5 / state/selectors.ts module doc): the executing
// fortnight is ALWAYS Week A, twice (D5) — `prefs.week` is a browsing toggle
// for PLAN/MEAL, not "which week is being cooked". Tonight's dinner lookup
// below is hard-coded to week "A" independent of the week paddle. Cook-from-
// stock is the one deliberate exception: it ranks meals from BOTH weeks,
// since Week B is the swap pool this screen surfaces (see ./cookFromStock.ts
// for why that isn't simply the shared `coverageForAllMeals` selector).
import { useRef, useState } from "react";
import type { SceneProps } from "../../app/router";
import { useStore } from "../../state/store";
import type { InventoryLevel } from "../../state/store";
import { arbiterFor } from "../../engine/arbiter";
import { ArbiterSlot } from "../../components/ArbiterSlot";
import { todayInfo } from "../../state/selectors";
import { londonDateIso } from "../../state/london";
import { mealForSlot, requireMeal } from "../../data";
import { LOCATION_GROUP_LABEL, LOCATION_GROUP_ORDER, REGISTER_FLAT, REGISTER_GROUPS } from "./location";
import { countdownForIngredient } from "./countdown";
import { RegisterRow } from "./RegisterRow";
import { LeftoverRow } from "./LeftoverRow";
import { ThumbWheel } from "./wheel";
import { LogDinnerCard } from "./logDinner";
import { WasteSheet } from "./WasteSheet";
import { coverageForAllMealsBothWeeks } from "./cookFromStock";
import { useNow } from "./useNow";
import "./stores.css";

export default function StoresScene(_props: SceneProps) {
  const { state, dispatch } = useStore();
  const now = useNow();
  const [armedId, setArmedId] = useState<string | null>(null);
  const [wasteOpen, setWasteOpen] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  const todayIso = londonDateIso(now);
  const info = todayInfo(now, state.prefs.cycleStartSaturday);
  const dinner = typeof info.dayNo === "number" ? (mealForSlot("A", info.dayNo, "dinner") ?? null) : null;
  const alreadyEaten = Boolean(state.eaten[todayIso]?.dinner);

  const hasAnyInventory = Object.keys(state.inventory).length > 0;
  const arbiter = arbiterFor("stores", state, now);
  const rank1 = arbiter.rank1;

  function registerEl(id: string, el: HTMLButtonElement | null) {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }

  /** Arm a row and bring it on-screen — used by the empty-state "start
   * stocktake" CTA and by the arbiter's expired/defrost-overdue deep links
   * (both can be jumping from anywhere in a long, scrolled list). */
  function armAndReveal(id: string) {
    setArmedId(id);
    const el = rowRefs.current.get(id);
    el?.scrollIntoView({ block: "center" });
    el?.focus();
  }

  /** Every level-set — whichever of the three input paths triggered it (row
   * arrow keys, wheel tap, wheel arrow keys) — auto-advances to the next
   * register row (PLAN §6.7: "auto-advance to next row on set"). Advancing
   * means MOVING FOCUS, not a timer: the next keypress/tap is entirely the
   * user's own action, so it's "snappy" (zero added delay) and "interruptible"
   * (nothing keeps running if they tab away or click elsewhere instead). */
  function handleSetLevel(id: string, level: InventoryLevel) {
    dispatch({ type: "inventory/set", ingId: id, level });
    const idx = REGISTER_FLAT.findIndex((i) => i.id === id);
    const next = idx >= 0 ? REGISTER_FLAT[idx + 1] : undefined;
    if (next) {
      setArmedId(next.id);
      rowRefs.current.get(next.id)?.focus();
    }
  }

  function handleArbiterActivate() {
    const target = rank1?.target;
    if (!target) return;
    if (target.screen === "stores" && target.id) {
      armAndReveal(target.id);
      return;
    }
    window.location.hash = `#/${target.screen}`;
  }

  let expiredCount = 0;
  let expiringCount = 0;
  for (const ing of REGISTER_FLAT) {
    const status = countdownForIngredient(ing, state.inventory[ing.id], now).status;
    if (status === "expired") expiredCount++;
    else if (status === "expiring") expiringCount++;
  }

  const activeLeftovers = state.leftovers.filter((l) => l.consumedAt == null);
  const restockNames = REGISTER_FLAT.filter((ing) => (state.inventory[ing.id]?.level ?? 0) <= 1).map((ing) => ing.name.short);
  const cookFromStock = hasAnyInventory ? coverageForAllMealsBothWeeks(state.inventory, state.prefs.cover).slice(0, 5) : [];

  const armedIng = armedId ? (REGISTER_FLAT.find((i) => i.id === armedId) ?? null) : null;
  const armedLevel: InventoryLevel | null = armedIng ? ((state.inventory[armedIng.id]?.level ?? 0) as InventoryLevel) : null;

  return (
    <section className="scr-stores">
      {rank1 && (
        <ArbiterSlot text={rank1.text} count={arbiter.queued} actionLabel="act →" onActivate={handleArbiterActivate} />
      )}

      <header className="scr-stores-header">
        <h1 className="scr-stores-title">stores</h1>
        {hasAnyInventory && (
          <p className={`scr-stores-status scr-stores-status--${expiredCount > 0 ? "expired" : expiringCount > 0 ? "expiring" : "fresh"}`}>
            {expiredCount > 0
              ? `✕ ${expiredCount} expired`
              : expiringCount > 0
                ? `△ ${expiringCount} expiring soon`
                : "✓ all fresh · nothing expiring"}
          </p>
        )}
      </header>

      {!hasAnyInventory && (
        <div className="scr-stores-empty" role="note">
          <p className="scr-stores-empty-title">no stocktake yet</p>
          <p className="scr-stores-empty-body">
            set a level for what's actually in the fridge, freezer, counter and cupboard — {REGISTER_FLAT.length} items, about
            two minutes with the wheel.
          </p>
          <button type="button" className="fd5-control scr-stores-empty-cta" onClick={() => REGISTER_FLAT[0] && armAndReveal(REGISTER_FLAT[0].id)}>
            start stocktake →
          </button>
        </div>
      )}

      <div className="scr-stores-body">
        <div className="scr-stores-register">
          {LOCATION_GROUP_ORDER.map((group) => (
            <section key={group} className="scr-stores-group" aria-labelledby={`scr-stores-group-${group}`}>
              <h2 id={`scr-stores-group-${group}`} className="scr-stores-group-h">
                {LOCATION_GROUP_LABEL[group]}
              </h2>
              <ul className="scr-stores-row-list">
                {REGISTER_GROUPS[group].map((ing) => (
                  <RegisterRow
                    key={ing.id}
                    ing={ing}
                    entry={state.inventory[ing.id]}
                    armed={armedId === ing.id}
                    now={now}
                    onArm={setArmedId}
                    onSetLevel={handleSetLevel}
                    registerEl={registerEl}
                  />
                ))}
                {group === "fridge" &&
                  activeLeftovers.map((lo) => <LeftoverRow key={lo.id} entry={lo} now={now} dispatch={dispatch} />)}
              </ul>
            </section>
          ))}
        </div>

        <ThumbWheel
          armedName={armedIng?.name.short ?? null}
          level={armedLevel}
          onSet={(level) => armedId && handleSetLevel(armedId, level)}
        />
      </div>

      <section className="scr-stores-section" aria-labelledby="scr-stores-cookstock-h">
        <h2 id="scr-stores-cookstock-h" className="scr-stores-h">
          from stock
        </h2>
        {!hasAnyInventory ? (
          <p className="scr-stores-muted">stocktake to see this.</p>
        ) : (
          <ul className="scr-stores-cookstock-list">
            {cookFromStock.map((c) => {
              const meal = requireMeal(c.mealId);
              return (
                <li key={c.mealId}>
                  <a className="fd5-control scr-stores-cookstock-chip" href={`#/meal/${c.mealId}`}>
                    <span>{meal.name}</span>
                    <span className="scr-stores-cookstock-pct">~{Math.round(c.coverage * 100)}%</span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="scr-stores-section scr-stores-footer-row">
        <div className="scr-stores-restock">
          <h2 className="scr-stores-h">restock queue</h2>
          {!hasAnyInventory ? (
            <p className="scr-stores-muted">stocktake to see this.</p>
          ) : restockNames.length === 0 ? (
            <p className="scr-stores-muted">nothing needed.</p>
          ) : (
            <p className="scr-stores-restock-list">{restockNames.join(" · ")}</p>
          )}
        </div>
        <button type="button" className="fd5-control scr-stores-wastelog-btn" onClick={() => setWasteOpen(true)}>
          waste log ▸
        </button>
      </section>

      <LogDinnerCard dinner={dinner} now={now} alreadyEaten={alreadyEaten} dispatch={dispatch} />

      <WasteSheet open={wasteOpen} onClose={() => setWasteOpen(false)} waste={state.waste} now={now} />
    </section>
  );
}
