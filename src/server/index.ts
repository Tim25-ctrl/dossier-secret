// Point d'entrée du serveur : lit la configuration (variables d'environnement)
// et démarre le serveur HTTP + WebSocket.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

await demarrerServeur({
  port: Number(env.PORT ?? 3001),
  dossierClient: path.join(racine, 'dist/client'),
  dossierDonnees,
  botsAutorises: (env.ENABLE_BOTS ?? 'true').toLowerCase() !== 'false',
  originesAutorisees: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  configPartie: {
    delaiFalsificationMs: secondes('FALSIFICATION_WINDOW_SECONDS', 8),
    delaiReponseMs: secondes('RESPONSE_TIMEOUT_SECONDS', 60),
    delaiTourMs: secondes('TURN_TIMEOUT_SECONDS', 180),
    delaiDeconnecteMs: secondes('DISCONNECTED_TURN_SECONDS', 25),
  },
});
