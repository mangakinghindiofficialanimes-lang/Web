const CACHE_NAME = "nitin-animes-shell-v3";
const SHELL = [
  "/", "/index.html", "/anime.html", "/watch.html", "/offline-library.html", "/account.html",
  "/admin.html", "/privacy.html", "/media-policy.html", "/styles.css", "/app.js", "/anime.js",
  "/watch.js", "/offline-library.js", "/account.js", "/admin.js", "/supabase-config.js",
  "/drm-config.js", "/manifest.json", "/icon.svg", "/offline.html"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("nitin-animes-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET") return;
  if (url.hostname === "cdn.jsdelivr.net" && url.pathname.includes("/shaka-player/")) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
      return response;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match(request)) || (await caches.match("/offline.html"))));
    return;
  }
  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, copy)); }
      return response;
    })));
  }
});