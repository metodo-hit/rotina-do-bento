/* Rotina do Bento: service worker
 * Guarda os arquivos do app para abrir sem internet.
 * Ao publicar uma versão nova, aumente o número em VERSAO.
 */
const VERSAO = 'rotina-bento-v2';
const ARQUIVOS = [
  './',
  './index.html',
  './app.css?v=2',
  './app.js?v=2',
  './sono.js?v=2',
  './agenda.js?v=2',
  './marcos.js?v=2',
  './extras.js?v=2',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Arquivos do app: responde com o que está guardado e atualiza em segundo plano.
// Chamadas à planilha (outro domínio) passam direto, sem cache.
self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  ev.respondWith(
    caches.open(VERSAO).then(async (cache) => {
      const guardado = await cache.match(req, { ignoreSearch: true });
      const daRede = fetch(req)
        .then((resp) => {
          if (resp && resp.ok) cache.put(req, resp.clone());
          return resp;
        })
        .catch(() => null);
      if (guardado) {
        ev.waitUntil(daRede);
        return guardado;
      }
      const resp = await daRede;
      if (resp) return resp;
      if (req.mode === 'navigate') return cache.match('./index.html');
      return new Response('', { status: 504 });
    })
  );
});
