/**
 * src/app/App.tsx — the chassis, assembled.
 *
 * ---------------------------------------------------------------------------
 * R5 — NO CAGE ANYWHERE. COOK's lid-closed mode is DROPPED.
 * ---------------------------------------------------------------------------
 * What used to live here: `const lidClosed = route.screen === "cook"`, a
 * `data-lidclosed` attribute on the frame, and four CSS rules in
 * src/tokens.css. All of it is gone, along with the exit tab it produced. The
 * rail is present on EVERY screen and the operator may leave any room at any
 * time, from anywhere. The wet-hands mis-tap risk that mode was protecting
 * against is accepted by owner ruling and is NOT re-introduced as guarding —
 * no confirm-before-leaving, no disabled keys, no "are you sure" on COOK.
 *
 * ---------------------------------------------------------------------------
 * R6 — OPEN PANELS SURVIVE NAVIGATION.
 * ---------------------------------------------------------------------------
 * `sceneRegistry[route.screen]` yields a different component type per route, so
 * React unmounts the outgoing scene and every useState inside it. The
 * OpenPanelProvider therefore mounts ABOVE the scene and is keyed by screen.
 * See src/cd/chassis/panels.tsx for the API screens consume.
 *
 * ---------------------------------------------------------------------------
 * THE SCOPE FENCE
 * ---------------------------------------------------------------------------
 * `data-cd-language="back-channel"` sits on the chassis root; the legacy
 * `.fd5[data-language="playful"]` bridge sits on the WORKSPACE, one level in.
 * They are deliberately on different elements: `.fd5[data-language]` is
 * specificity (0,2,0) and `[data-cd-language]` is (0,1,0), so on one shared
 * element the bridge would win every overlapping custom property and the
 * chassis would render in cream painted steel. Two elements, two scopes, and
 * CD-BRIEF's zone fence holds: "No element may read tokens from two language
 * scopes."
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { RAIL_STATIONS, stationForDate, useHashRoute, type RailScreenId } from "./router";
import { sceneRegistry } from "./scenes";
import { CookRunningProvider, useCookRunning } from "./cookRunningStub";
import { OpenSettingsProvider } from "../components/OpenSettings";
import { OpenPanelProvider } from "../cd/chassis/panels";
import { StationRail, type RailStation } from "../cd/chassis/StationRail";
import { StationTray } from "../cd/chassis/StationTray";
import { StationSettings } from "./StationSettings";
import { CloseRead, CycleCap } from "./ChassisReport";
import { armOnFirstGesture } from "../cd/sound/bus";
import { useFrameBudget } from "../cd/shed/useFrameBudget";
import "../cd/chassis/chassis.css";

const STATIONS: readonly RailStation<RailScreenId>[] = RAIL_STATIONS.map((id, index) => ({
  id,
  label: id,
  digit: index + 1,
}));

// Two formatters rather than one, because the rail prints the date on two
// lines: the one-line form measured 78px inside the committed 4.5rem (72px)
// footprint and was clipped. Europe/London throughout, matching every other
// date in the product (state/london.ts).
const weekdayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  timeZone: "Europe/London",
});
const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "Europe/London",
});

const TRAY_ID = "cd-station-tray";

function AppShell() {
  const route = useHashRoute();
  const [trayOpen, setTrayOpen] = useState(false);
  const openSettings = useCallback(() => setTrayOpen(true), []);
  const [now, setNow] = useState(() => new Date());
  const cookRunning = useCookRunning();

  /*
    II.4.12's shed ladder, armed once, at the chassis. Nothing re-renders on a
    stage change: the hook writes one attribute on <html>, and tokens/motion.css
    is what each stage actually costs.

    HISTORY, because it is load-bearing for anyone who touches this line.
    Mounting this hook was what first surfaced a defect in it: measured at
    complete idle on a healthy 60Hz display, 148 of 148 frames counted as over
    budget, data-cd-shed pinned at "3", and --cd-tray-open / --cd-drill-in /
    --cd-stagger-step sat at 100ms / 100ms / 0ms against their committed 280ms /
    300ms / 24ms. The hook was comparing `now - last` — the interval BETWEEN
    frames, which is 16.7ms on every 60Hz display that ever worked — against a
    12ms budget meant for the WORK INSIDE a frame. It could never recover.

    src/cd/shed/** is frozen, so the chassis carried this disarmed with the
    defect reported upward rather than shipping a permanently degraded motion
    dialect for no reason. The orchestrator has since repaired the hook from the
    STORES spike: it now calibrates the display's own refresh period and counts
    DROPPED frames (interval > period * 1.5), which is correct at 60Hz, 90Hz and
    120Hz alike. Re-armed, and re-measured here — see the report.
  */
  useFrameBudget();

  // II.5.14 — "No cue plays before the first qualifying gesture. Create the
  // AudioContext INSIDE that gesture's handler." The chassis arms the bus for
  // the SCREENS; the rail itself never speaks (navigation is on II.5.16's own
  // silence list, and this language retires audible contact outright).
  useEffect(() => armOnFirstGesture(), []);

  // Keep the date and the cycle-cursor suggestion fresh without a heavy clock.
  // A minute is plenty for "today" / "suggested now"; the per-second reading
  // belongs to the Cycle Cap alone, which owns its own 1Hz tick and only while
  // a program is actually running.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const suggestedStation = useMemo(() => stationForDate(now), [now]);

  const navigate = useCallback((screen: RailScreenId) => {
    window.location.hash = `#/${screen}`;
  }, []);

  // Hotkeys 1-5 for the five rail stations, 0 for the Station Tray. Never
  // steal from an input, never fire alongside a modifier (so browser and OS
  // shortcuts stay intact), and never fire behind an open modal — the legacy
  // <dialog> Sheets that PLAN and STORES still use own the keyboard while up.
  // The TRAY is deliberately NOT in that exclusion: it has no scrim and the
  // workspace beneath it stays live, so the hotkeys stay live with it.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.querySelector("dialog[open]")) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        Boolean(target?.isContentEditable);
      if (isEditable) return;
      if (event.key === "0") {
        setTrayOpen((open) => !open);
        return;
      }
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < RAIL_STATIONS.length) {
        navigate(RAIL_STATIONS[index]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const Scene = sceneRegistry[route.screen];
  const activeStation = (RAIL_STATIONS as readonly string[]).includes(route.screen)
    ? (route.screen as RailScreenId)
    : null;

  return (
    <div className="cd-chassis" data-cd-language="back-channel">
      <OpenSettingsProvider value={openSettings}>
        <OpenPanelProvider screen={route.screen}>
          <StationRail
            stations={STATIONS}
            active={activeStation}
            onNavigate={navigate}
            suggested={suggestedStation}
            cap={<CycleCap now={now} />}
            date={{
              weekday: weekdayFormatter.format(now).toLowerCase(),
              day: dayFormatter.format(now).toLowerCase(),
            }}
            live={cookRunning}
            onOpenTray={() => setTrayOpen((open) => !open)}
            trayOpen={trayOpen}
            trayId={TRAY_ID}
          />

          {/* The workspace keeps the legacy bridge scope on its own element,
              one level in from the chassis — see the note at the top of the
              file for why they may not share one. Each screen sets its own
              data-cd-language on its scene root as it is rebuilt. */}
          <div className="fd5 cd-workspace" data-language="playful">
            <main id="fd5-scene" className="fd5-scene">
              <Scene route={route} />
            </main>
          </div>

          {/* No scrim. The workspace above stays live and touchable while this
              is open, and the rail stays reachable to leave entirely. */}
          <StationTray
            open={trayOpen}
            onClose={() => setTrayOpen(false)}
            id={TRAY_ID}
            closeRead={<CloseRead now={now} />}
          >
            <StationSettings />
          </StationTray>
        </OpenPanelProvider>
      </OpenSettingsProvider>
    </div>
  );
}

export function App() {
  return (
    <CookRunningProvider>
      <AppShell />
    </CookRunningProvider>
  );
}
