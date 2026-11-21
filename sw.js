// Service worker: permite abrir la app sin internet y mostrar avisos.
const CACHE = 'pendientes-v2';
const ICS_CACHE = 'pendientes-ics'; // evento listo para abrir en el Calendario
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== ICS_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero la red (para recibir actualizaciones); si no hay internet, la copia guardada.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // calendario.ics lo arma la app en el teléfono; nunca se pide a internet.
  if (url.pathname.endsWith('/calendario.ics')) {
    event.respondWith(
      caches.open(ICS_CACHE)
        .then((c) => c.match('./calendario.ics', { ignoreSearch: true }))
        .then((res) => res || new Response('<script>history.back()</script>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});

// La app pregunta si este service worker ya sabe entregar calendario.ics.
self.addEventListener('message', (event) => {
  if (event.data === 'puedes-calendario' && event.ports[0]) event.ports[0].postMessage(true);
});

// Al tocar un aviso, abre (o enfoca) la app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('./');
    })
  );
});
