/* Japanese Knowledge Base — offline-first SW (iOS Safari hardened) */
const CACHE_NAME = 'japanese-knowledge-base-pwa-v5';
const SHELL_URLS = [
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

function toAbsolute(path) {
  return new URL(path, self.location.href).href;
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  // Cache each asset individually so one failure does not wipe the rest.
  await Promise.all(SHELL_URLS.map(async (path) => {
    const url = toAbsolute(path);
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res && res.ok) {
        await cache.put(url, res.clone());
        // Also store under the relative key some browsers match against.
        try { await cache.put(path, res.clone()); } catch (_) {}
      }
    } catch (err) {
      console.warn('[sw] precache failed', path, err);
    }
  }));
  // Alias: directory URL → index.html (common for home-screen launches)
  try {
    const indexRes = await cache.match(toAbsolute('./index.html'));
    if (indexRes) {
      const base = toAbsolute('./');
      await cache.put(base, indexRes.clone());
      // Without trailing slash variants
      const originBase = self.location.origin + self.location.pathname.replace(/sw\.js$/, '');
      await cache.put(originBase, indexRes.clone());
      if (!originBase.endsWith('/')) {
        await cache.put(originBase + '/', indexRes.clone());
      }
    }
  } catch (err) {
    console.warn('[sw] alias cache failed', err);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheShell()
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => precacheShell()) // refresh shell on activate
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data.type === 'CACHE_URLS' && Array.isArray(data.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const u of data.urls) {
        try {
          const res = await fetch(u, { cache: 'no-cache' });
          if (res && res.ok) await cache.put(u, res);
        } catch (_) {}
      }
    })());
  }
});

async function matchShell(request) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);

  // Try exact request first (ignore search for HTML navigations)
  const candidates = [];
  candidates.push(request);
  candidates.push(url.href);
  candidates.push(url.origin + url.pathname);
  if (url.pathname.endsWith('/')) {
    candidates.push(url.origin + url.pathname + 'index.html');
  } else if (!url.pathname.endsWith('.html')) {
    candidates.push(url.origin + url.pathname + '/');
    candidates.push(url.origin + url.pathname + '/index.html');
  }
  candidates.push(toAbsolute('./index.html'));
  candidates.push(toAbsolute('./'));
  candidates.push('./index.html');
  candidates.push('./');

  for (const key of candidates) {
    try {
      const hit = await cache.match(key, { ignoreSearch: true });
      if (hit) return hit;
    } catch (_) {}
  }

  // Last resort: any cached HTML response
  const keys = await cache.keys();
  for (const req of keys) {
    if (String(req.url).includes('index.html') || req.url.endsWith('/')) {
      const hit = await cache.match(req);
      if (hit) return hit;
    }
  }
  return null;
}

function isHTMLRequest(request, url) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) return true;
  const p = url.pathname;
  if (p.endsWith('/') || p.endsWith('/index.html')) return true;
  // iOS sometimes requests the path without navigate mode
  if (!p.split('/').pop().includes('.')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase etc.

  if (isHTMLRequest(request, url)) {
    event.respondWith((async () => {
      // Offline or flaky: prefer cache immediately (fixes iOS blank screen)
      if (!self.navigator.onLine) {
        const cached = await matchShell(request);
        if (cached) return cached;
      }

      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          // Store under several keys so future offline matches succeed
          await cache.put(request, response.clone());
          await cache.put(toAbsolute('./index.html'), response.clone());
          await cache.put(toAbsolute('./'), response.clone());
          await cache.put(url.origin + url.pathname, response.clone());
        }
        return response;
      } catch (err) {
        const cached = await matchShell(request);
        if (cached) return cached;
        return new Response(
          '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>離線</title><body style="font-family:-apple-system,system-ui,sans-serif;padding:28px;background:#f5f3ee;color:#292b28;line-height:1.6"><h1 style="font-size:1.3rem">目前離線</h1><p>找不到已快取的日文知識庫頁面。</p><p>請先連線開啟一次本 App，並停留數秒讓離線版本完成安裝，然後再試。</p></body></html>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // Static assets: cache-first
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) await cache.put(request, response.clone());
      return response;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
