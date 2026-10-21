// Point d'entrée du serveur : lit la configuration (variables d'environnement)
// et démarre le serveur HTTP + WebSocket.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DepotFichier, DepotSql, type DepotEmplacements } from './emplacements';
import { demarrerServeur } from './serveur';

// Chargement minimal d'un fichier .env (sans dépendance supplémentaire).
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fichierEnv = path.join(racine, '.env');
if (existsSync(fichierEnv)) {
  for (const ligne of readFileSync(fichierEnv, 'utf8').split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const env = process.env;
const secondes = (nom: string, defaut: number) => {
  const v = Number(env[nom]);
  return (Number.isFinite(v) && v > 0 ? v : defaut) * 1000;
};

const dossierDonnees = env.DATA_DIR === undefined ? path.join(racine, 'data') : env.DATA_DIR.trim() === '' ? null : path.resolve(racine, env.DATA_DIR);

const journal = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

// Emplacements de sauvegarde : base PostgreSQL en ligne (DATABASE_URL), sinon fichier local.
// Sur Render sans base, le disque est effacé à chaque redémarrage : pas d'emplacements plutôt que
// des sauvegardes qui disparaîtraient.
let emplacements: DepotEmplacements | null = null;
const adresseBase = env.DATABASE_URL?.trim();
try {
  if (adresseBase) {
    emplacements = await DepotSql.connecter(adresseBase, journal);
    journal('Base de données connectée : emplacements de sauvegarde et salons en cours y sont gardés.');
  } else if (dossierDonnees && !env.RENDER) {
    emplacements = await DepotFichier.ouvrir(path.join(dossierDonnees, 'emplacements.json'));
  }
} catch (e) {
  journal('Base de données injoignable : emplacements de sauvegarde désactivés.', (e as Error).message);
}

const serveur = await demarrerServeur({
  port: Number(env.PORT ?? 3001),
  dossierClient: path.join(racine, 'dist/client'),
  dossierDonnees,
  botsAutorises: (env.ENABLE_BOTS ?? 'true').toLowerCase() !== 'false',
  cleSauvegarde: env.CLE_SAUVEGARDE?.trim() || null,
  emplacements,
  originesAutorisees: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  configPartie: {
    delaiFalsificationMs: secondes('FALSIFICATION_WINDOW_SECONDS', 8),
    delaiReponseMs: secondes('RESPONSE_TIMEOUT_SECONDS', 60),
    delaiTourMs: secondes('TURN_TIMEOUT_SECONDS', 180),
    delaiDeconnecteMs: secondes('DISCONNECTED_TURN_SECONDS', 25),
  },
});

// Arrêt demandé par l'hébergeur (mise à jour, mise en veille) : dernière sauvegarde, puis sortie.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    const delai = setTimeout(() => process.exit(0), 5000);
    void serveur
      .fermer()
      .then(() => emplacements?.fermer?.())
      .catch(() => {})
      .finally(() => {
        clearTimeout(delai);
        process.exit(0);
      });
  });
}
