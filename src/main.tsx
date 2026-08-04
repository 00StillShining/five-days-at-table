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
