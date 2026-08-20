const CACHE_NAME = 'eutaktos-static-v3';
const STATIC_DESTINATIONS = new Set(['script', 'style', 'font', 'image', 'manifest']);

function isSafeStaticRequest(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return false;
  return STATIC_DESTINATIONS.has(request.destination);
}

function offlineDocument() {
  return new Response(
    '<!doctype html><html lang="pt-PT"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#FAFAFA"><title>Eutaktos offline</title><style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#FAFAFA;color:#1A1A1A}main{max-width:34rem;padding:2rem}p{color:#6B6B6B;line-height:1.5}</style><main><h1>Sem ligação</h1><p>Volte a ligar-se para aceder aos dados da congregação. O Eutaktos não guarda páginas com dados sensíveis no cache geral.</p></main></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.destination === 'document') {
    event.respondWith((async () => {
      try {
        return await fetch(request, { cache: 'no-store' });
      } catch {
        return offlineDocument();
      }
    })());
    return;
  }

  if (!isSafeStaticRequest(request)) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
