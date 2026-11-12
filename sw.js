/* GELATMIX · service worker (v2.7)
   Guarda el programa en el equipo para que abra sin conexión.
   - Páginas (index.html): primero la red, para recibir siempre la última versión;
     si no hay conexión o tarda más de 4 s, se sirve la copia guardada.
   - Librería y demás archivos propios: copia guardada, y si no existe, la red.
   - Las peticiones a otros dominios (la nube, Supabase) no se tocan. */
const CACHE = 'gelatmix-v2.7.0';
const CORE = ['./', './index.html', './supabase.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(CORE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('gelatmix-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function claveDocumento(url) {
  // La raíz y index.html (con o sin ?v=…) se guardan como la misma página
  const scope = new URL(self.registration.scope);
  if (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html') {
    return new URL('./index.html', scope).href;
  }
  return url.origin + url.pathname;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const esDocumento = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');

  if (esDocumento) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const clave = claveDocumento(url);
      const red = fetch(req).then((r) => {
        if (r && r.ok) cache.put(clave, r.clone());
        return r;
      });
      const limite = new Promise((resolve) => setTimeout(() => resolve(null), 4000));
      try {
        const r = await Promise.race([red, limite]);
        if (r) return r;
      } catch (err) { /* sin conexión */ }
      const guardada = await cache.match(clave);
      if (guardada) return guardada;
      try { return await red; } catch (err) { return Response.error(); }
    })());
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => {
      if (r && r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return r;
    }))
  );
});
