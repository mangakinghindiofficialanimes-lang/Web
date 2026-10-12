const CACHE_NAME = "nitin-animes-shell-v1";
const SHELL = [
  "/",
  "/index.html",
  "/anime.html",
  "/watch.html",
  "/account.html",
  "/admin.html",
  "/privacy.html",
  "/media-policy.html",
  "/styles.css",
  "/app.js",
  "/anime.js",
  "/watch.js",
  "/account.js",
  "/admin.js",
  "/supabase-config.js",
  "/manifest.json",
  "/icon.svg",
  "/offline.html"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("nitin-animes-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
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
