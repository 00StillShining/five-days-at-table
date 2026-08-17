/**
 * src/cd/spike/main.tsx — the spike's own entry.
 *
 * Deliberately NOT wired into src/main.tsx or index.html: this is a throwaway
 * harness with its own route (`/src/cd/spike/index.html` under the dev server),
 * so the product's bundle, its chassis and its router are untouched by it. The
 * only shared code is the FOUNDATION it is here to test — tokens, material,
 * physics, shed, sound, freshness — plus the frozen data and reducer.
 *
 * No StoreProvider, on purpose: the real provider persists every slice to
 * localStorage, and a perf harness has no business writing over a person's
 * actual pantry. The spike runs the same frozen `reducer` against its own ref,
 * which is the identical work minus the disk.
 */

import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "../tokens/index.css";

import { createRoot } from "react-dom/client";
import { Spike } from "./Spike";

createRoot(document.getElementById("spike-root")!).render(<Spike />);
