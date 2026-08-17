/**
 * src/cd/foundry/Register.tsx — CD-BRIEF R7, the grouped accordion.
 *
 * "R7 — No page-length scrolling. Long registers use a GROUPED ACCORDION, ONE
 * SECTION OPEN AT A TIME, with the hidden remainder printed as a number
 * ('confess the overflow'). Only one group renders at full material at a time."
 *
 * Two laws are doing the work here and they are not the same law:
 *
 *  1. ONE SECTION OPEN. A 65-row register never becomes a 65-row page. It
 *     becomes a column of engraved lids of which exactly one is lifted, so the
 *     visible extent is bounded by the tallest single group rather than by the
 *     sum of every group.
 *  2. CONFESS THE OVERFLOW (II.6.24). "Every clip states its remainder as a
 *     number. No fade curtains." Two remainders are confessed, separately,
 *     because they are different facts: a CLOSED group prints how many rows it
 *     is holding, and an OPEN group that clips prints how many of its own rows
 *     are still below the cut. A gradient standing in for either is a lie with
 *     a soft edge.
 *
 * CONTROLLED BY DESIGN. `openId` and `onOpenChange` are props rather than
 * internal state, because CD-BRIEF R6 requires open-panel state to survive
 * navigation and scenes UNMOUNT on navigation. Drive it from the chassis-level
 * store:
 *
 *     const [openId, setOpenId] = useOpenPanel<string | null>("register", null);
 *     <Register openId={openId} onOpenChange={setOpenId} groups={groups} />
 *
 * KEYBOARD. The WAI-ARIA accordion pattern, whole: every header is a real
 * button carrying aria-expanded and aria-controls; ArrowUp/ArrowDown walk the
 * headers; Home/End jump to the first and last. Nothing here is reachable by
 * pointer alone.
 */

import { useCallback, useId, useRef, type ReactNode } from "react";
import { PressKey } from "./PressKey";
import "./foundry.css";

export interface RegisterGroup {
  /** Stable across renders — this is what `openId` holds. */
  id: string;
  /** The engraved lid word. */
  label: string;
  /**
   * The rows this group holds. THE COUNT IS DERIVED FROM THIS ARRAY and is
   * never supplied by the caller.
   *
   * The first build took `count: number` beside a `rows: () => ReactNode`
   * thunk. Rendered, the lids printed the right figures — but only because the
   * literals happened to match, and nothing stopped a group gaining a row while
   * its lid kept claiming the old number. II.6.24's confession has to be a
   * measurement or it is decoration, so the array is the only source.
   *
   * A thunk per item, not a rendered node, so a closed group costs nothing.
   */
  items: (() => ReactNode)[];
  /**
   * Render at most this many. The difference between `items.length` and what
   * renders is printed at the foot as II.6.24's confession — "every clip states
   * its remainder as a number. No fade curtains."
   */
  limit?: number;
  /** An instrument for the lid: a lamp, a small field, an age. */
  lidSlot?: ReactNode;
}

export interface RegisterProps {
  groups: RegisterGroup[];
  /** The open group's id, or null for all closed. */
  openId: string | null;
  onOpenChange: (next: string | null) => void;
  /** Accessible name for the whole register. */
  label: string;
  /** The word printed beside a clipped remainder. Default "more". */
  overflowWord?: string;
  className?: string;
}

export function Register({
  groups,
  openId,
  onOpenChange,
  label,
  overflowWord = "more",
  className,
}: RegisterProps) {
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  /**
   * The lids are walked by querying the register's own DOM rather than by
   * holding an array of refs. One source of truth for "which lids exist",
   * and it cannot fall out of step with a groups array that changed length
   * between renders.
   */
  const onHeadKeyDown = useCallback((event: React.KeyboardEvent, index: number) => {
    const heads = Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>("[data-cd-register-head]") ?? []
    );
    if (heads.length === 0) return;
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (index + 1) % heads.length;
    else if (event.key === "ArrowUp") next = (index - 1 + heads.length) % heads.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = heads.length - 1;
    if (next === null) return;
    event.preventDefault();
    heads[next]?.focus();
  }, []);

  return (
    <div
      ref={rootRef}
      className={["cd-register", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={label}
    >
      {groups.map((group, index) => {
        const open = openId === group.id;
        const panelId = `${baseId}-${group.id}`;
        const total = group.items.length;
        const rendered = group.limit != null ? Math.min(total, group.limit) : total;
        const hidden = total - rendered;
        return (
          <div key={group.id} className="cd-register-group" data-cd-open={open ? "true" : "false"}>
            <PressKey
              className="cd-register-head"
              onPress={() => onOpenChange(open ? null : group.id)}
              aria-expanded={open}
              aria-controls={panelId}
              onKeyDown={(event) => onHeadKeyDown(event, index)}
              data-cd-register-head="true"
            >
              <span className="cd-register-label">{group.label}</span>
              {group.lidSlot}
              {/* The count is printed on the lid whether the lid is up or
                  down: a closed group that hides its size is a fade curtain
                  made of nothing. */}
              <span className="cd-register-count cd-data">
                {total}
                <span className="cd-unit">{total === 1 ? "row" : "rows"}</span>
              </span>
            </PressKey>
            <div id={panelId} hidden={!open}>
              {open ? (
                <div className="cd-register-rows">
                  {group.items.slice(0, rendered).map((row, i) => (
                    <div key={i} className="cd-register-row">
                      {row()}
                    </div>
                  ))}
                  {hidden > 0 && (
                    <div className="cd-register-overflow">
                      {/* II.6.24 — the clip states its remainder as a NUMBER. */}
                      <span className="cd-overflow-count cd-data">
                        {hidden}
                        <span className="cd-unit">{overflowWord}</span>
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
