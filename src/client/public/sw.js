// Service worker : il rend le jeu installable et lui permet de s'ouvrir sans internet.
//
// - Pages : toujours la dernière version quand le réseau répond ; sinon, la copie gardée sur
//   l'appareil (on peut alors jouer seul contre des bots, hors ligne).
// - Fichiers du jeu (/assets/, nommés d'après leur contenu) : gardés sur l'appareil. À chaque
//   ouverture en ligne, la copie est mise à jour et les fichiers d'une ancienne version sont effacés.
// - Le serveur de jeu (/socket.io, /api) n'est jamais mis en cache.

const CACHE = 'dossier-secret-v1';
const FICHIERS_FIXES = ['/manifest.webmanifest', '/favicon.svg', '/apple-touch-icon.png', '/icone-192.png', '/icone-512.png', '/icone-maskable-512.png'];

const HORS_LIGNE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nuit Blanche</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1020;color:#efe6d2;font-family:Georgia,serif;text-align:center;padding:24px">
<div><h1 style="color:#c9a45c">Nuit Blanche</h1><p>Pas de connexion internet, et le jeu n'est pas encore enregistré sur cet appareil.</p>
<p>Ouvrez-le une fois avec une connexion : ensuite, vous pourrez jouer seul contre des bots même hors ligne.</p>
<p><a href="/" style="color:#c9a45c">Réessayer</a></p></div></body></html>`;

/** Fichiers nécessaires à une page : scripts, styles, et les polices latines citées par les styles. */
async function fichiersDe(html) {
  const urls = new Set(FICHIERS_FIXES);
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) urls.add(m[1]);
  for (const u of [...urls]) {
    if (!u.endsWith('.css')) continue;
    try {
      const css = await (await fetch(u)).text();
      for (const m of css.matchAll(/url\((\/assets\/[^)]*-latin-[^)]*\.woff2)\)/g)) urls.add(m[1]);
    } catch {
      /* hors ligne : on garde ce qu'on a */
    }
  }
  return urls;
}

/** Garde la page d'accueil et tous ses fichiers ; efface ceux d'une ancienne version. */
async function mettreEnCache(html) {
  const cache = await caches.open(CACHE);
  if (!html) {
    const r = await fetch('/', { cache: 'no-store' });
    if (!r.ok) return;
    html = await r.text();
  }
  await cache.put('/', new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
  const urls = await fichiersDe(html);
  await Promise.all(
    [...urls].map(async (u) => {
      if (u.startsWith('/assets/') && (await cache.match(u))) return;
      try {
        const r = await fetch(u);
        if (r.ok) await cache.put(u, r);
      } catch {
        /* ce fichier sera repris à la prochaine ouverture en ligne */
      }
    }),
  );
  for (const req of await cache.keys()) {
    const chemin = new URL(req.url).pathname;
    if (chemin.startsWith('/assets/') && !urls.has(chemin)) await cache.delete(req);
  }
}

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(mettreEnCache().catch(() => undefined));
});

self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      for (const cle of await caches.keys()) if (cle !== CACHE) await caches.delete(cle);
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/api')) return;

  // Page : réseau d'abord (dernière version), copie de l'appareil sinon.
  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          const r = await fetch(req);
          if (r.ok && url.pathname === '/') {
            const html = await r.clone().text();
            e.waitUntil(mettreEnCache(html).catch(() => undefined));
          }
          return r;
        } catch {
          const copie = await caches.match('/');
          return copie ?? new Response(HORS_LIGNE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
      })(),
    );
    return;
  }

  // Fichiers du jeu : la copie de l'appareil d'abord (leur nom change à chaque version).
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      (async () => {
        const copie = await caches.match(req);
        if (copie) return copie;
        const r = await fetch(req);
        if (r.ok && /\.(js|css)$|-latin-.*\.woff2$/.test(url.pathname)) {
          const cache = await caches.open(CACHE);
          e.waitUntil(cache.put(req, r.clone()));
        }
        return r;
      })(),
    );
    return;
  }

  // Icônes, manifeste : réseau d'abord, copie sinon.
  if (FICHIERS_FIXES.includes(url.pathname)) {
    e.respondWith(fetch(req).catch(async () => (await caches.match(url.pathname)) ?? Response.error()));
  }
});
