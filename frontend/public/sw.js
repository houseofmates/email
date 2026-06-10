// offline app-shell service worker for the unified suite (and the capacitor
// webview wrapper). strategy:
//   - api/jmap/dav/identity: never cached (always live)
//   - navigations: network-first, fall back to the cached shell when offline
//   - hashed static assets (js/css/fonts/images): cache-first (immutable)
// bump CACHE to invalidate everything on a breaking release.

const CACHE = "email-shell-v1"
const SHELL = ["/", "/index.html", "/favicon.svg", "/manifest.webmanifest"]

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (e) => {
  const { request } = e
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (/^\/(api|jmap|dav|identity)\//.test(url.pathname)) return // live data — bypass cache

  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put("/index.html", cp)); return r })
        .catch(() => caches.match("/index.html"))
    )
    return
  }

  if (/\.(js|mjs|css|woff2?|ttf|png|svg|jpe?g|gif|webp|ico)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(request, cp)); return r })
      )
    )
  }
})
