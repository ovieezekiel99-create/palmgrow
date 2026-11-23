const CACHE_NAME = "palmgrow-app-v8";

const HOME_URL = self.registration.scope;
const OFFLINE_URL = new URL("offline.html", self.registration.scope).href;

const ICONS = [
  "palmgrow-icon-192.png",
  "palmgrow-icon-512.png",
  "palmgrow-splash-icon-192.png",
  "palmgrow-splash-icon-512.png",
  "manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const offlineResponse = await fetch(OFFLINE_URL, { cache: "reload" });
    if (!offlineResponse.ok) throw new Error("PalmGrow offline page could not be cached.");
    await cache.put(OFFLINE_URL, offlineResponse);

    try {
      const homeResponse = await fetch(HOME_URL, { cache: "reload" });
      if (homeResponse.ok) await cache.put(HOME_URL, homeResponse);
    } catch (e) { console.log("Main page cache will retry later."); }

    // Cache icons too
    for (const file of ICONS) {
      try {
        const url = new URL(file, self.registration.scope).href;
        const res = await fetch(url, { cache: "reload" });
        if (res.ok) await cache.put(url, res);
      } catch (e) {}
    }

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(key => key.startsWith("palmgrow-app-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  // For pages: network first, then cached page, then offline.html
  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        // 1. Try last cached dashboard first
        const cachedPage = await cache.match(event.request);
        if (cachedPage) return cachedPage;
        // 2. Then offline page
        const offlinePage = await cache.match(OFFLINE_URL);
        if (offlinePage) return offlinePage;
        return new Response("PalmGrow is offline.", { status: 503 });
      }
    })());
    return;
  }

  // For icons / images / other files: cache-first
  if (!event.request.url.includes("supabase.co")) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          }
          return res;
        });
      })
    );
  }
});
