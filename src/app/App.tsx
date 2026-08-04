import { useCallback, useEffect, useMemo, useState } from "react";
import { RAIL_STATIONS, stationForDate, useHashRoute, type RailScreenId } from "./router";
import { sceneRegistry } from "./scenes";
import { Masthead } from "./Masthead";
import { Paddles } from "./Paddles";
import { LoopRail } from "./LoopRail";
import { SettingsDrawer } from "./SettingsDrawer";
import { CookRunningProvider, useCookRunning } from "./cookRunningStub";

function AppShell() {
  const route = useHashRoute();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const cookRunning = useCookRunning();

  // Keep the date + cycle-cursor suggestion fresh without a heavy clock; a minute is
  // plenty for "today" / "suggested now" — timers themselves are the engine's job.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const suggestedStation = useMemo(() => stationForDate(now), [now]);

  const navigate = useCallback((screen: RailScreenId) => {
    window.location.hash = `#/${screen}`;
  }, []);

  // Hotkeys 1-5 for the five rail keys — never steal from inputs, never fire
  // alongside a modifier (so browser/OS shortcuts stay intact), and never fire behind
  // an open modal (e.g. the settings Sheet) — its own focus-trapped controls own the
  // keyboard while it's up.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.querySelector("dialog[open]")) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(target?.isContentEditable);
      if (isEditable) return;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < RAIL_STATIONS.length) {
        navigate(RAIL_STATIONS[index]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const Scene = sceneRegistry[route.screen];
  const lidClosed = route.screen === "cook";

  return (
    <div className="fd5" data-language="playful">
      <div className="fd5-frame" data-lidclosed={lidClosed || undefined}>
        <div className="fd5-topbar">
          <Masthead now={now} cookRunning={cookRunning} />
          <div className="fd5-topbar-controls">
            <Paddles />
            <button
              type="button"
              className="fd5-control fd5-gear"
              onClick={() => setSettingsOpen(true)}
              aria-label="settings"
            >
              <span aria-hidden="true">{"⚙"}</span>
            </button>
          </div>
        </div>
        <LoopRail
          activeScreen={route.screen}
          onNavigate={navigate}
          suggestedStation={suggestedStation}
          cookRunning={cookRunning}
          lidClosed={lidClosed}
          onExitCook={() => navigate("today")}
        />
        <main id="fd5-scene" className="fd5-scene">
          <Scene route={route} />
        </main>
      </div>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
