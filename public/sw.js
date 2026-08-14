const CACHE_NAME = "french-cards-static-v3";
const PRECACHE = ["/offline", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache authenticated HTML, callbacks, API responses, or admin pages.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline")));
    return;
  }
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/admin")) return;

  // Next.js build assets are content-hashed and already receive immutable
  // browser caching headers. Let Next.js serve them directly so an old service
  // worker cannot keep a client pinned to chunks from a previous deployment.
  const cacheableStatic = url.pathname === "/manifest.webmanifest"
    || /^\/icon-(192|512)\.png$/.test(url.pathname);
  if (!cacheableStatic) return;

  const refreshed = fetch(request).then(async (response) => {
    if (response.ok && response.type === "basic") {
      // Clone before yielding: once the browser starts consuming the original
      // response body, cloning it throws "Response body is already used".
      const cacheCopy = response.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, cacheCopy);
    }
    return response;
  });

  event.waitUntil(refreshed.then(() => undefined).catch(() => undefined));
  event.respondWith(
    caches.match(request).then((cached) => cached ?? refreshed),
  );
});
