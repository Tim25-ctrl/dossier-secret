// Serveur HTTP + WebSocket (Socket.IO). Le serveur est l'unique autorité :
// il reçoit des intentions, les valide, les applique au moteur, puis envoie à
// chaque joueur SA vue filtrée.

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import { decisionBot } from '../bots/bot';
import { prochaineEcheance } from '../engine/partie';
import { cryptoRng } from '../engine/rng';
import { vuePour } from '../engine/vue';
import type { ConfigPartie } from '../engine/config';
import type { EvenementsClient, EvenementsServeur, Reponse, Session } from '../shared/protocole';
import { ErreurJeu, GestionnaireSalons } from './salons';
import { lireAction, schemaMessage, schemaPseudo, schemaRejoindre, schemaReprendre, schemaReglages, schemaRetirer } from './validation';

export interface OptionsServeur {
  port?: number;
  dossierClient?: string;
  dossierDonnees?: string | null;
  botsAutorises?: boolean;
  configPartie?: Partial<ConfigPartie>;
  /** Délai de « réflexion » des bots [min, max] en ms. */
  delaiBotsMs?: [number, number];
  originesAutorisees?: string[];
  journaliser?: boolean;
}

interface DonneesSocket {
  code?: string;
  joueurId?: string;
  jetons: number;
  dernierRemplissage: number;
}

type S = Socket<EvenementsClient, EvenementsServeur, Record<string, never>, DonneesSocket>;

export async function demarrerServeur(o: OptionsServeur = {}) {
  const log = (...args: unknown[]) => {
    if (o.journaliser !== false) console.log(new Date().toISOString(), ...args);
  };
  const gestionnaire = new GestionnaireSalons({ botsAutorises: o.botsAutorises ?? true, configPartie: o.configPartie });
  const [botMin, botMax] = o.delaiBotsMs ?? [900, 2200];

  // ---------------------------------------------------------------------------
  // Sauvegarde sur disque (optionnelle)
  // ---------------------------------------------------------------------------
  const fichier = o.dossierDonnees ? path.join(o.dossierDonnees, 'salons.json') : null;
  if (fichier && existsSync(fichier)) {
    try {
      gestionnaire.charger(await readFile(fichier, 'utf8'));
      log(`Sauvegarde chargée : ${gestionnaire.salons.size} salon(s).`);
    } catch (e) {
      log('Sauvegarde illisible, ignorée :', (e as Error).message);
    }
  }
  let sauvegardePrevue: NodeJS.Timeout | null = null;
  const sauvegarder = () => {
    if (!fichier || sauvegardePrevue) return;
    sauvegardePrevue = setTimeout(async () => {
      sauvegardePrevue = null;
      try {
        await mkdir(path.dirname(fichier), { recursive: true });
        await writeFile(`${fichier}.tmp`, gestionnaire.serialiser());
        await rename(`${fichier}.tmp`, fichier);
      } catch (e) {
        log('Échec de la sauvegarde :', (e as Error).message);
      }
    }, 1500);
  };

  // ---------------------------------------------------------------------------
  // HTTP
  // ---------------------------------------------------------------------------
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'",
    );
    next();
  });
  app.get('/api/sante', (_req, res) => {
    res.json({ ok: true, salons: gestionnaire.salons.size });
  });
  const dossierClient = o.dossierClient;
  // Version du client servi (nom du script principal) : envoyée à chaque connexion pour qu'une page
  // ouverte avant une mise à jour se recharge, au lieu de faire tourner l'ancien code.
  const versionClient =
    dossierClient && existsSync(path.join(dossierClient, 'index.html'))
      ? (/index-[\w-]+\.js/.exec(readFileSync(path.join(dossierClient, 'index.html'), 'utf8'))?.[0] ?? null)
      : null;
  if (dossierClient && existsSync(path.join(dossierClient, 'index.html'))) {
    app.use(express.static(dossierClient, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
      res.sendFile(path.join(dossierClient, 'index.html'));
    });
  }

  const http: HttpServer = createServer(app);
  const io = new Server<EvenementsClient, EvenementsServeur, Record<string, never>, DonneesSocket>(http, {
    maxHttpBufferSize: 16_000,
    pingInterval: 10_000,
    pingTimeout: 8_000,
    cors: o.originesAutorisees?.length ? { origin: o.originesAutorisees } : undefined,
  });

  /** Socket active de chaque joueur : clé `${code}|${joueurId}`. */
  const sockets = new Map<string, S>();
  const minuteurs = new Map<string, NodeJS.Timeout>();
  const minuteursBots = new Map<string, NodeJS.Timeout>();

  // ---------------------------------------------------------------------------
  // Diffusion : chaque joueur reçoit uniquement SA vue.
  // ---------------------------------------------------------------------------
  const diffuser = (code: string) => {
    const s = gestionnaire.salons.get(code);
    if (!s) return;
    for (const j of s.joueurs) {
      const sock = sockets.get(`${code}|${j.id}`);
      if (sock) sock.emit('etat', gestionnaire.etatClient(s, j.id));
    }
    planifier(code);
    planifierBots(code);
    sauvegarder();
  };

  const planifier = (code: string) => {
    clearTimeout(minuteurs.get(code));
    minuteurs.delete(code);
    const s = gestionnaire.salons.get(code);
    if (!s?.partie || s.statut !== 'partie') return;
    const e = prochaineEcheance(s.partie);
    if (e === null) return;
    const delai = Math.max(0, e - Date.now()) + 25;
    minuteurs.set(
      code,
      setTimeout(() => {
        minuteurs.delete(code);
        if (gestionnaire.avancer(code)) diffuser(code);
        else planifier(code);
      }, Math.min(delai, 2_147_000_000)),
    );
  };

  /** Les bots jouent avec un léger délai, à partir de leur vue filtrée uniquement. */
  const planifierBots = (code: string) => {
    const s = gestionnaire.salons.get(code);
    // Partie en pause (joueur absent) : les bots attendent eux aussi.
    if (!s?.partie || s.statut !== 'partie' || s.partie.pause || minuteursBots.has(code)) return;
    const partie = s.partie;
    const bots = s.joueurs.filter((j) => j.bot);
    const prochaine = bots.map((b) => ({ id: b.id, action: decisionBot(vuePour(partie, b.id), cryptoRng) })).find((x) => x.action);
    if (!prochaine) return;
    const delai = botMin + cryptoRng.int(Math.max(1, botMax - botMin));
    minuteursBots.set(
      code,
      setTimeout(() => {
        minuteursBots.delete(code);
        const salon = gestionnaire.salons.get(code);
        if (!salon?.partie || salon.statut !== 'partie') return;
        const action = decisionBot(vuePour(salon.partie, prochaine.id), cryptoRng);
        if (action) {
          try {
            gestionnaire.action(code, prochaine.id, action);
          } catch (e) {
            log(`Bot ${prochaine.id} : action refusée (${(e as Error).message})`);
            try {
              gestionnaire.action(code, prochaine.id, { type: 'finTour' });
            } catch {
              /* ce n'était pas son tour */
            }
          }
        }
        diffuser(code);
      }, delai),
    );
  };

  const nettoyerSalon = (code: string) => {
    clearTimeout(minuteurs.get(code));
    clearTimeout(minuteursBots.get(code));
    minuteurs.delete(code);
    minuteursBots.delete(code);
  };

  // ---------------------------------------------------------------------------
  // WebSocket
  // ---------------------------------------------------------------------------
  const LIMITE = 40; // requêtes
  const FENETRE = 10_000; // par 10 secondes

  const attacher = (socket: S, code: string, joueurId: string) => {
    const cle = `${code}|${joueurId}`;
    const ancienne = sockets.get(cle);
    if (ancienne && ancienne.id !== socket.id) {
      // Doublon de connexion : la nouvelle session remplace l'ancienne.
      ancienne.data.code = undefined;
      ancienne.data.joueurId = undefined;
      ancienne.emit('expulse', { raison: 'Votre session a été ouverte dans un autre onglet ou sur un autre appareil.' });
      ancienne.disconnect(true);
    }
    if (socket.data.code && socket.data.joueurId && (socket.data.code !== code || socket.data.joueurId !== joueurId)) {
      detacher(socket);
    }
    socket.data.code = code;
    socket.data.joueurId = joueurId;
    sockets.set(cle, socket);
    gestionnaire.definirConnexion(code, joueurId, true);
  };

  const detacher = (socket: S) => {
    const { code, joueurId } = socket.data;
    if (!code || !joueurId) return;
    const cle = `${code}|${joueurId}`;
    if (sockets.get(cle)?.id === socket.id) {
      sockets.delete(cle);
      gestionnaire.definirConnexion(code, joueurId, false);
      diffuser(code);
    }
    socket.data.code = undefined;
    socket.data.joueurId = undefined;
  };

  io.on('connection', (socket: S) => {
    if (versionClient) socket.emit('version', versionClient);
    socket.data.jetons = LIMITE;
    socket.data.dernierRemplissage = Date.now();

    const limiter = () => {
      const t = Date.now();
      socket.data.jetons = Math.min(LIMITE, socket.data.jetons + ((t - socket.data.dernierRemplissage) / FENETRE) * LIMITE);
      socket.data.dernierRemplissage = t;
      if (socket.data.jetons < 1) throw new ErreurJeu('Trop de requêtes : patientez quelques secondes.');
      socket.data.jetons -= 1;
    };

    /** Enveloppe commune : limitation, validation, erreurs lisibles, accusé de réception. */
    const gerer = <P, R extends object>(nom: string, fn: (p: P) => R | void) => {
      return (p: P, ack: (r: Reponse<R>) => void) => {
        const repondre = typeof ack === 'function' ? ack : () => {};
        try {
          limiter();
          const r = fn(p) ?? ({} as R);
          repondre({ ok: true, ...r });
        } catch (e) {
          const message = e instanceof ErreurJeu ? e.message : nom === 'jeu:action' ? 'Action refusée.' : 'Requête invalide.';
          if (!(e instanceof ErreurJeu)) log(`Erreur ${nom}:`, (e as Error).message);
          repondre({ ok: false, erreur: message });
        }
      };
    };

    const session = (): { code: string; joueurId: string } => {
      const { code, joueurId } = socket.data;
      if (!code || !joueurId) throw new ErreurJeu("Vous n'êtes connecté à aucun salon.");
      return { code, joueurId };
    };

    socket.on(
      'salon:creer',
      gerer('salon:creer', (p: unknown) => {
        const { nom } = schemaPseudo.parse(p);
        const { salon, joueur, jeton } = gestionnaire.creer(nom);
        attacher(socket, salon.code, joueur.id);
        log(`Salon ${salon.code} créé.`);
        diffuser(salon.code);
        return { session: { code: salon.code, joueurId: joueur.id, jeton } satisfies Session };
      }),
    );

    socket.on(
      'salon:rejoindre',
      gerer('salon:rejoindre', (p: unknown) => {
        const { code, nom } = schemaRejoindre.parse(p);
        const { salon, joueur, jeton } = gestionnaire.rejoindre(code, nom);
        attacher(socket, salon.code, joueur.id);
        diffuser(salon.code);
        return { session: { code: salon.code, joueurId: joueur.id, jeton } satisfies Session };
      }),
    );

    socket.on(
      'salon:reprendre',
      gerer('salon:reprendre', (p: unknown) => {
        const { code, jeton } = schemaReprendre.parse(p);
        const { salon, joueur } = gestionnaire.reprendre(code, jeton);
        attacher(socket, salon.code, joueur.id);
        diffuser(salon.code);
        return { session: { code: salon.code, joueurId: joueur.id, jeton } satisfies Session };
      }),
    );

    socket.on(
      'salon:quitter',
      gerer('salon:quitter', () => {
        const { code, joueurId } = session();
        sockets.delete(`${code}|${joueurId}`);
        socket.data.code = undefined;
        socket.data.joueurId = undefined;
        const { ferme } = gestionnaire.quitter(code, joueurId);
        if (ferme) {
          log(`Salon ${code} fermé par le dernier joueur.`);
          nettoyerSalon(code);
        } else diffuser(code);
        return { ferme };
      }),
    );

    const actionSalon = (nom: keyof EvenementsClient, fn: (code: string, id: string, p: unknown) => void) =>
      socket.on(
        nom,
        gerer(nom, (p: unknown) => {
          const { code, joueurId } = session();
          fn(code, joueurId, p);
          diffuser(code);
        }) as never,
      );

    actionSalon('salon:demarrer', (code, id) => {
      gestionnaire.demarrer(code, id);
      log(`Salon ${code} : partie lancée.`);
    });
    actionSalon('salon:rejouer', (code, id) => gestionnaire.rejouer(code, id));
    actionSalon('salon:ajouterBot', (code, id) => gestionnaire.ajouterBot(code, id));
    actionSalon('salon:retirer', (code, id, p) => {
      const { joueurId } = schemaRetirer.parse(p);
      const cible = sockets.get(`${code}|${joueurId}`);
      gestionnaire.retirer(code, id, joueurId);
      if (cible) {
        cible.emit('expulse', { raison: "L'hôte vous a retiré du salon." });
        sockets.delete(`${code}|${joueurId}`);
        cible.data.code = undefined;
        cible.data.joueurId = undefined;
      }
    });
    actionSalon('salon:remplacer', (code, id, p) => {
      const { joueurId } = schemaRetirer.parse(p);
      gestionnaire.remplacerParBot(code, id, joueurId);
      log(`Salon ${code} : un joueur absent est remplacé par un bot.`);
    });
    actionSalon('salon:continuerSans', (code, id, p) => gestionnaire.continuerSans(code, id, schemaRetirer.parse(p).joueurId));
    actionSalon('salon:message', (code, id, p) => gestionnaire.message(code, id, schemaMessage.parse(p).texte));
    actionSalon('salon:reglages', (code, id, p) => {
      const r = schemaReglages.parse(p);
      if (r.dureeTourS !== undefined) gestionnaire.reglerDureeTour(code, id, r.dureeTourS);
      if (r.modeComplice !== undefined) gestionnaire.reglerModeComplice(code, id, r.modeComplice);
    });
    actionSalon('jeu:action', (code, id, p) => gestionnaire.action(code, id, lireAction(p)));

    socket.on('disconnect', () => detacher(socket));
  });

  // Entretien : hôte absent, joueurs partis du lobby, salons abandonnés.
  const entretien = setInterval(() => {
    for (const code of gestionnaire.entretien()) diffuser(code);
    for (const code of minuteurs.keys()) if (!gestionnaire.salons.has(code)) nettoyerSalon(code);
  }, 10_000);

  // Reprise des minuteurs des parties restaurées depuis la sauvegarde.
  for (const code of gestionnaire.salons.keys()) {
    planifier(code);
    planifierBots(code);
  }

  await new Promise<void>((resolve) => http.listen(o.port ?? 0, resolve));
  const port = (http.address() as AddressInfo).port;
  log(`Dossier Secret écoute sur le port ${port}.`);

  return {
    port,
    url: `http://localhost:${port}`,
    gestionnaire,
    io,
    async fermer() {
      clearInterval(entretien);
      for (const t of minuteurs.values()) clearTimeout(t);
      for (const t of minuteursBots.values()) clearTimeout(t);
      if (sauvegardePrevue) clearTimeout(sauvegardePrevue);
      io.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
