const CACHE_NAME = 'eutaktos-public-shell-v2';
const SAFE_DESTINATIONS = new Set(['style', 'script', 'font', 'image', 'manifest']);

self.addEventListener('install', () => {
  // Do not automatically take over an active session. The app can explicitly
  // activate a waiting worker after warning the user about an available update.
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('eutaktos-') && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

function canCache(request, response) {
  if (request.method !== 'GET') return false;
  if (new URL(request.url).origin !== self.location.origin) return false;
  if (!SAFE_DESTINATIONS.has(request.destination)) return false;
  return response.ok && response.type === 'basic';
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Sensitive congregation/API/navigation responses are deliberately never
  // written to Cache Storage. Only public static application assets are cached.
  if (!SAFE_DESTINATIONS.has(request.destination)) {
    if (request.mode === 'navigate') {
      event.respondWith(fetch(request).catch(() => new Response(
        '<!doctype html><html lang="pt-PT"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Eutaktos offline</title><style>body{font:16px system-ui;margin:0;background:#FAFAFA;color:#1A1A1A}main{max-width:36rem;margin:12vh auto;padding:2rem}a{color:#3B82F6}</style><main><h1>Sem ligação</h1><p>Por segurança, os dados da congregação não são guardados automaticamente para uso offline. Volte a ligar-se para continuar.</p></main></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
      )));
    }
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (canCache(request, response)) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
