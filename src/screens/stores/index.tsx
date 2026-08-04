// STORES — register + fuzzy inventory (PLAN §6.7 / D7). "The 54-row register
// fused with live inventory: how much do we have, how long does it last."
// Phase 2 wave 1 (docs/PHASE2-CONTRACT.md): this folder is self-contained per
// the ownership rule — no other screen folder imports from it, and it
// imports only components/engine/state/data, never another screen.
//
// KEY FACT (PLAN §5 / state/selectors.ts module doc): the executing
// fortnight is ALWAYS Week A, twice (D5) — `prefs.week` is a browsing toggle
// for PLAN/MEAL, not "which week is being cooked". Tonight's dinner lookup
// below resolves through `effectiveMealForSlot` (swaps-aware, P2-PLAN-001 —
// wave-1-fix item 2: a committed swap must change what "log dinner" offers,
// same as it already changes TODAY's tonight card and start-by time) but
// stays hard-coded to week "A" — the executing week — independent of the
// week paddle. Cook-from-stock is the one deliberate exception to Week-A-
// only: it ranks meals from BOTH weeks via `coverageForAllMeals(inventory,
// cover, ["A", "B"])`, since Week B is the swap/variety pool (D5) and "what
// can I cook from what's in the fridge" is a real question about Week B
// dishes too.
import { useRef, useState } from "react";
import type { SceneProps } from "../../app/router";
import { useStore } from "../../state/store";
import type { InventoryLevel } from "../../state/store";
import { arbiterFor } from "../../engine/arbiter";
import { ArbiterSlot, type ArbiterDuty as SlotDuty } from "../../components/ArbiterSlot";
import { coverageForAllMeals, effectiveMealForSlot, todayInfo } from "../../state/selectors";
import { londonDateIso } from "../../state/london";
import { useNow } from "../../state/useNow";
import { requireMeal } from "../../data";
import { LOCATION_GROUP_LABEL, LOCATION_GROUP_ORDER, REGISTER_FLAT, REGISTER_GROUPS } from "./location";
import { countdownForIngredient } from "./countdown";
import { registerDisambiguator } from "./registerName";
import { RegisterRow } from "./RegisterRow";
import { LeftoverRow } from "./LeftoverRow";
import { ThumbWheel, DETENT_ANNOUNCE } from "./wheel";
import { LogDinnerCard } from "./logDinner";
import { WasteSheet } from "./WasteSheet";
import "./stores.css";

const RESTOCK_DISPLAY_CAP = 10;

interface Confirmation {
  name: string;
  level: InventoryLevel;
}

export default function StoresScene(_props: SceneProps) {
  const { state, dispatch } = useStore();
  const now = useNow();
  const [armedId, setArmedId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [wasteOpen, setWasteOpen] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  // Consumed by the very next `onArm` call after an auto-advance-triggered
  // focus, so that call does NOT clear `confirmation` — see `commitLevel`.
  const suppressNextArmClearRef = useRef(false);

  const todayIso = londonDateIso(now);
  const info = todayInfo(now, state.prefs.cycleStartSaturday);
  const dinner = typeof info.dayNo === "number" ? (effectiveMealForSlot("A", info.dayNo, "dinner", state) ?? null) : null;
  const alreadyEaten = Boolean(state.eaten[todayIso]?.dinner);

  const hasAnyInventory = Object.keys(state.inventory).length > 0;
  const arbiter = arbiterFor("stores", state, now);
  const rank1 = arbiter.rank1;

  function registerEl(id: string, el: HTMLButtonElement | null) {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }

  /** A genuine user-initiated arm (tap/Tab onto a row): always clears any
   * stale confirmation so the wheel falls back to announcing THIS row's own
   * level — UNLESS this call is the direct result of `commitLevel`'s
   * auto-advance moving focus, in which case the confirmation of what was
   * just set is exactly what should keep showing (wave-1-fix item 6). */
  function handleArm(id: string) {
    setArmedId(id);
    if (suppressNextArmClearRef.current) {
      suppressNextArmClearRef.current = false;
    } else {
      setConfirmation(null);
    }
  }

  /** Arm a row and bring it on-screen — used by the empty-state "start
   * stocktake" CTA and by the arbiter's expired/defrost-overdue deep links
   * (both can be jumping from anywhere in a long, scrolled list). */
  function armAndReveal(id: string) {
    handleArm(id);
    const el = rowRefs.current.get(id);
    el?.scrollIntoView({ block: "center" });
    el?.focus();
  }

  /**
   * The one place a level actually gets dispatched. `advance` distinguishes
   * the wheel's ABSOLUTE detent picks (auto-advance to the next row, PLAN
   * §6.7: "auto-advance to next row on set") from the register row's own
   * RELATIVE arrow-key nudges (stay put — wave-1-fix item 3: auto-advancing
   * on every relative step meant a keyboard user could never move a row past
   * level 1, since the very first ArrowUp bounced them to the next row).
   * Always records a confirmation of what was just set (item 6); when
   * advancing, `suppressNextArmClearRef` keeps that confirmation alive
   * through the focus move instead of it being immediately overwritten by
   * the next row's own (usually "empty") level.
   */
  function commitLevel(id: string, level: InventoryLevel, advance: boolean) {
    dispatch({ type: "inventory/set", ingId: id, level });
    const ing = REGISTER_FLAT.find((i) => i.id === id);
    if (ing) setConfirmation({ name: ing.name.short, level });
    if (!advance) return;
    const idx = REGISTER_FLAT.findIndex((i) => i.id === id);
    const next = idx >= 0 ? REGISTER_FLAT[idx + 1] : undefined;
    if (!next) return;
    suppressNextArmClearRef.current = true;
    setArmedId(next.id);
    rowRefs.current.get(next.id)?.focus();
  }

  function handleRowAdjust(id: string, level: InventoryLevel) {
    commitLevel(id, level, false);
  }

  function handleWheelSet(level: InventoryLevel) {
    if (armedId) commitLevel(armedId, level, true);
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

  // Restock queue (wave-1-fix item 4): restrict to items that have actually
  // been stocktaken at least once (an inventory ENTRY exists) — a never-
  // touched staple defaults to level 0 same as a genuinely-just-ran-out one,
  // but listing all 65 never-touched items as "needs restocking" before a
  // first stocktake is noise, not signal. Capped with "+N more" so a long
  // list still reads as a queue, not a wall.
  const restockAll = REGISTER_FLAT.filter((ing) => {
    const entry = state.inventory[ing.id];
    return entry !== undefined && entry.level <= 1;
  }).map((ing) => `${ing.name.short}${registerDisambiguator(ing)}`);
  const restockShown = restockAll.slice(0, RESTOCK_DISPLAY_CAP);
  const restockMoreCount = restockAll.length - restockShown.length;

  const cookFromStock = hasAnyInventory ? coverageForAllMeals(state.inventory, state.prefs.cover, ["A", "B"]).slice(0, 5) : [];

  const armedIng = armedId ? (REGISTER_FLAT.find((i) => i.id === armedId) ?? null) : null;
  const armedLevel: InventoryLevel | null = armedIng ? ((state.inventory[armedIng.id]?.level ?? 0) as InventoryLevel) : null;

  const announceText = confirmation
    ? `${confirmation.name}: ${DETENT_ANNOUNCE[confirmation.level]}`
    : armedIng && armedLevel != null
      ? `${armedIng.name.short}: ${DETENT_ANNOUNCE[armedLevel]}`
      : "tap a row to set its level";

  const arbiterDuty: SlotDuty | null = rank1 ? { text: rank1.text, actionLabel: "act →", onActivate: handleArbiterActivate } : null;

  return (
    <section className="scr-stores">
      <ArbiterSlot rank1={arbiterDuty} count={arbiter.queued} />

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
                    onArm={handleArm}
                    onAdjust={handleRowAdjust}
                    registerEl={registerEl}
                  />
                ))}
                {group === "fridge" &&
                  activeLeftovers.map((lo) => <LeftoverRow key={lo.id} entry={lo} now={now} dispatch={dispatch} />)}
              </ul>
            </section>
          ))}
        </div>

        <ThumbWheel armedName={armedIng?.name.short ?? null} level={armedLevel} onSet={handleWheelSet} announceText={announceText} />
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
          ) : restockShown.length === 0 ? (
            <p className="scr-stores-muted">nothing needed.</p>
          ) : (
            <p className="scr-stores-restock-list">
              {restockShown.join(" · ")}
              {restockMoreCount > 0 ? ` · +${restockMoreCount} more` : ""}
            </p>
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
