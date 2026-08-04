// FD-5 service worker — minimal cache-first app shell for offline use.
//
// The whole app is one self-contained HTML file (vite-plugin-singlefile: JS, CSS,
// and fonts all inlined — PLAN/SOL-BRIEF D1/R3), so "the app shell" is just that one
// document. Registered from src/main.tsx with { updateViaCache: "none" } so this file
// itself is never served from the HTTP cache — the browser always checks the network
// for a fresh copy on the periodic update check / next registration call.
//
// CACHE_NAME embeds __BUILD_ID__, a token vite.config.ts computes once per build and
// substitutes here via a small closeBundle step (see vite.config.ts) — every deploy
// therefore ships a byte-different sw.js, which is what makes the browser's own
// service-worker update algorithm notice there's a new version at all. No skipWaiting
// call here on purpose: the new worker installs in the background and only takes over
// once every tab running the old one has closed or navigated away, so an update is
// silent and never interrupts a session already in progress (per the brief — no
// "reload to update" prompt UI for this personal tool).
const CACHE_NAME = "fd5-shell-__BUILD_ID__";

// Relative, not absolute ("/…") — the build is hosting-agnostic (R3) and may end up
// served from a sub-path (e.g. GitHub Pages project pages); relative URLs resolve
// against this script's own location either way.
const SHELL_URLS = ["./", "./index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      // Start controlling any already-open, not-yet-controlled clients (e.g. the very
      // first load, before install finished) right away. This does NOT hijack a page
      // that's already controlled by a previous service worker mid-session — by the
      // time "activate" fires naturally (no skipWaiting), those are already gone.
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Only cache well-formed same-origin responses; opaque/error responses
          // aren't useful offline and shouldn't overwrite a good cached copy.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // Offline and nothing cached for this exact URL: for a navigation request
          // (e.g. the bare origin, or a deep link Safari re-resolves on relaunch),
          // fall back to the cached shell itself — it's a hash-routed SPA, so the one
          // document can render any in-app route once JS boots.
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return Response.error();
        });
    }),
  );
});
