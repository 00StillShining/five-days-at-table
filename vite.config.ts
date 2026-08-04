import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// One id per build, shared by two things that both need to agree on "which deploy is
// this": the SW registration URL in src/main.tsx (?v=<id>, so the browser's periodic
// update check always has a fresh URL to compare) and CACHE_NAME inside sw.js itself
// (so the cache is byte-different every deploy, which is what actually drives the
// service-worker spec's own update-then-purge-old-caches behavior — see sw.js and
// swVersionPlugin below). Deterministic per build, not per request: computed once here
// at config-eval time, not inside a hook that could run more than once.
const buildId = Date.now().toString(36);

/**
 * public/sw.js ships a literal "__BUILD_ID__" placeholder (vite's own `define` only
 * rewrites identifiers inside JS/TS modules that go through esbuild/rollup — files
 * copied verbatim out of publicDir are untouched by it). This plugin patches the
 * placeholder into the real build id after Vite has finished writing dist/, so the
 * cache name embedded in the worker's source changes on every build without a
 * template/bundler step for a two-line file.
 */
function swVersionPlugin(id: string): Plugin {
  return {
    name: "fd5-sw-version",
    apply: "build",
    closeBundle() {
      const swPath = resolve(import.meta.dirname, "dist/sw.js");
      if (!existsSync(swPath)) return; // dev/preview-only invocations, or sw.js absent
      const content = readFileSync(swPath, "utf8");
      writeFileSync(swPath, content.replaceAll("__BUILD_ID__", id));
    },
  };
}

export default defineConfig({
  plugins: [react(), viteSingleFile(), swVersionPlugin(buildId)],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  build: { target: "es2020", assetsInlineLimit: 100000000, chunkSizeWarningLimit: 5000 },
});
