const CACHE_NAME = "palmgrow-app-v5";

const HOME_URL = self.registration.scope;
const OFFLINE_URL = new URL(
  "offline.html",
  self.registration.scope
).href;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([HOME_URL, OFFLINE_URL])
    )
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            key.startsWith("palmgrow-app-") &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (
    event.request.method !== "GET" ||
    event.request.mode !== "navigate"
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(async response => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }

        return response;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);

        return (
          await cache.match(OFFLINE_URL) ||
          await cache.match(event.request) ||
          Response.error()
        );
      })
  );
});
