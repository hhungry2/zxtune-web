// Service worker for the whole Pages site: the engine at the root and the main
// site that sits in a folder under it.
//
// Network first: every request goes out as usual and the answer is kept, so a
// deploy shows up on the next load. The cache only answers when the network
// does not, which is what lets a visited page play offline.

const CACHE = 'zxtune-web-v1';

// Enough to start the engine without a network. Pages add what they loaded
// themselves (see the message handler), tunes included.
const ENGINE = ['./', 'index.html', 'player.mjs', 'zxtune-engine.mjs', 'zxtune-processor.js', 'zxtune.mjs', 'zxtune.wasm'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ENGINE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

function ours(url) {
  return url.origin === self.location.origin && url.href.startsWith(self.registration.scope);
}

// Whatever a page fetched before this worker controlled it never passed
// through here, so the page lists it and it is fetched once more into the cache.
self.addEventListener('message', event => {
  if (event.data?.type !== 'cache' || !Array.isArray(event.data.urls)) return;
  const urls = [...new Set(event.data.urls)].filter(url => {
    try { return ours(new URL(url)); } catch { return false; }
  });
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(urls.map(url => cache.add(url).catch(() => {})));
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || !ours(new URL(request.url))) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      // partial and failed answers are not worth keeping
      if (response.status === 200) event.waitUntil(cache.put(request, response.clone()));
      return response;
    } catch (error) {
      // a shared link (player.html?url=…) should still open the page offline
      const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
      if (cached) return cached;
      throw error;
    }
  })());
});
