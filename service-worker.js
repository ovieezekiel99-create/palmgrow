const CACHE_NAME = "palmgrow-app-v7";

const HOME_URL = self.registration.scope;
const OFFLINE_URL = new URL(
  "offline.html",
  self.registration.scope
).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Cache the offline page first.
    const offlineResponse = await fetch(OFFLINE_URL, {
      cache: "reload"
    });

    if (!offlineResponse.ok) {
      throw new Error("PalmGrow offline page could not be cached.");
    }

    await cache.put(OFFLINE_URL, offlineResponse);

    // Cache the main website separately.
    try {
      const homeResponse = await fetch(HOME_URL, {
        cache: "reload"
      });

      if (homeResponse.ok) {
        await cache.put(HOME_URL, homeResponse);
      }
    } catch (error) {
      console.log("Main page cache will retry later.");
    }

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key =>
          key.startsWith("palmgrow-app-") &&
          key !== CACHE_NAME
        )
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (
    event.request.method !== "GET" ||
    event.request.mode !== "navigate"
  ) {
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);

      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }

      return response;

    } catch (error) {
      const cache = await caches.open(CACHE_NAME);

      // Show the branded offline page first.
      const offlinePage = await cache.match(OFFLINE_URL);

      if (offlinePage) {
        return offlinePage;
      }

      const cachedPage = await cache.match(event.request);

      if (cachedPage) {
        return cachedPage;
      }

      return new Response(
        "PalmGrow is offline. Please reconnect to the internet.",
        {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        }
      );
    }
  })());
});
