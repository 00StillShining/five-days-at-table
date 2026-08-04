// CSS import order is load-bearing (INT-1): tokens.css holds the shared
// base rules (.fd5-control etc.) and MUST enter the bundle before every
// screen's own stylesheet (pulled in via ./app/App -> scenes.tsx), so that
// equal-specificity screen overrides (e.g. COOK's 72px done-edge, LIST's
// 56px rows) win the cascade. Fonts first, tokens second, App last.
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "./tokens.css";

import { createRoot } from "react-dom/client";
import { StoreProvider } from "./state/store";
import { App } from "./app/App";

createRoot(document.getElementById("root")!).render(
  <StoreProvider>
    <App />
  </StoreProvider>
);

// Offline delivery (PLAN §8 P2(f) / SOL-BRIEF): register the app-shell cache-first
// service worker (public/sw.js). Production builds only — `npm run dev` serves
// hundreds of unbundled ES modules with no stable "app shell" to cache, so a
// cache-first worker there would just fight Vite's own HMR. `?v=${__BUILD_ID__}`
// gives the browser's update check a fresh URL to fetch each deploy; updateViaCache:
// "none" means it never serves this registration (or module) from the HTTP cache
// either, so a stale sw.js can't linger behind a proxy/CDN cache. No skipWaiting
// prompt/UI on purpose — per the brief, an update finishing silently on the next
// visit is fine for a personal tool.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`./sw.js?v=${__BUILD_ID__}`, { updateViaCache: "none" })
      .catch((error) => {
        // Non-fatal: the app still works online without offline support.
        console.warn("fd-5: service worker registration failed", error);
      });
  });
}
