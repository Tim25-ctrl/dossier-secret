// Service worker minimal : il rend le jeu installable sur l'écran d'accueil.
// Aucune mise en cache : le jeu se joue en ligne et doit toujours charger sa dernière version.
// Sans réseau, une petite page explique qu'il faut une connexion.

const HORS_LIGNE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dossier Secret</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1020;color:#efe6d2;font-family:Georgia,serif;text-align:center;padding:24px">
<div><h1 style="color:#c9a45c">Dossier Secret</h1><p>Pas de connexion Internet : le jeu se joue en ligne.</p>
<p>Vérifiez votre connexion, puis <a href="/" style="color:#c9a45c">réessayez</a>.</p></div></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(HORS_LIGNE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
