import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { demarrerServeur } from '../src/server/serveur';
import { decisionBot } from '../src/bots/bot';
import { seededRng } from '../src/engine/rng';
import type { EtatClient, EvenementsClient, EvenementsServeur, Reponse, Session } from '../src/shared/protocole';
import type { ActionJeu } from '../src/shared/types';

type Client = Socket<EvenementsServeur, EvenementsClient>;

let serveur: Awaited<ReturnType<typeof demarrerServeur>>;

beforeAll(async () => {
  serveur = await demarrerServeur({
    port: 0,
    dossierDonnees: null,
    journaliser: false,
    delaiBotsMs: [5, 15],
    configPartie: { delaiFalsificationMs: 40, delaiReponseMs: 3000, delaiTourMs: 8000, delaiDeconnecteMs: 300, delaiRepriseTourMs: 3000 },
  });
});
afterAll(async () => {
  await serveur.fermer();
});

/** Petit client de test : garde le dernier état reçu. */
class Joueur {
  socket: Client;
  etat: EtatClient | null = null;
  session: Session | null = null;
  expulse: string | null = null;
  recus: string[] = [];
  constructor() {
    this.socket = ioClient(serveur.url, { transports: ['websocket'], forceNew: true, reconnection: false });
    this.socket.on('etat', (e) => {
      this.etat = e;
      this.recus.push(JSON.stringify(e));
    });
    this.socket.on('expulse', (p) => (this.expulse = p.raison));
  }
  async pret() {
    if (!this.socket.connected) await new Promise<void>((r) => this.socket.once('connect', () => r()));
    return this;
  }
  emit<K extends keyof EvenementsClient>(ev: K, payload: unknown): Promise<Reponse<{ session?: Session }>> {
    return new Promise((resolve) => (this.socket.emit as (...a: unknown[]) => void)(ev, payload, resolve));
  }
  async creer(nom: string) {
    const r = await this.emit('salon:creer', { nom });
    if (r.ok) this.session = r.session!;
    return r;
  }
  async rejoindre(code: string, nom: string) {
    const r = await this.emit('salon:rejoindre', { code, nom });
    if (r.ok) this.session = r.session!;
    return r;
  }
  action(a: ActionJeu) {
    return this.emit('jeu:action', a);
  }
  fermer() {
    this.socket.disconnect();
  }
}

const attendre = async (cond: () => boolean, ms = 4000, msg = 'condition') => {
  const fin = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > fin) throw new Error(`Délai dépassé : ${msg}`);
    await new Promise((r) => setTimeout(r, 10));
  }
};

async function salonAvec(n: number) {
  const hote = await new Joueur().pret();
  const r = await hote.creer('Hôte');
  expect(r.ok).toBe(true);
  const code = hote.session!.code;
  const autres: Joueur[] = [];
  for (let i = 1; i < n; i++) {
    const j = await new Joueur().pret();
    expect((await j.rejoindre(code, `Joueur ${i}`)).ok).toBe(true);
    autres.push(j);
  }
  const tous = [hote, ...autres];
  await attendre(() => tous.every((j) => j.etat?.salon.joueurs.length === n), 4000, 'lobby synchronisé');
  return { code, hote, autres, tous };
}

describe('Salons', () => {
  it('création, code d\'invitation et lobby synchronisé', async () => {
    const { code, hote, tous } = await salonAvec(3);
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(hote.etat!.salon.hote).toBe(hote.session!.joueurId);
    for (const j of tous) expect(j.etat!.salon.joueurs.map((x) => x.nom)).toEqual(['Hôte', 'Joueur 1', 'Joueur 2']);
    // L'identité secrète (jeton) n'est jamais diffusée aux autres.
    for (const j of tous.slice(1)) expect(j.recus.join('')).not.toContain(hote.session!.jeton);
    tous.forEach((j) => j.fermer());
  });

  it('refuse codes invalides, pseudonymes vides ou en double, et requêtes mal formées', async () => {
    const { code, tous } = await salonAvec(1);
    const j = await new Joueur().pret();
    expect(await j.rejoindre('ZZZZZZ', 'Alice')).toMatchObject({ ok: false, erreur: 'Aucun salon ne correspond à ce code.' });
    expect((await j.rejoindre('abc', 'Alice')).ok).toBe(false);
    expect(await j.rejoindre(code, '   ')).toMatchObject({ ok: false, erreur: 'Choisissez un pseudonyme.' });
    expect(await j.rejoindre(code, 'hôte')).toMatchObject({ ok: false, erreur: 'Ce pseudonyme est déjà utilisé dans ce salon.' });
    expect((await j.emit('salon:rejoindre', { code: 42 })).ok).toBe(false);
    expect((await j.emit('jeu:action', { type: 'finTour' })).ok).toBe(false); // pas de session
    expect(await j.rejoindre(code.toLowerCase(), 'Alice')).toMatchObject({ ok: true });
    [...tous, j].forEach((x) => x.fermer());
  });

  it('un salon ne dépasse jamais 6 joueurs, et refuse les arrivées après le début', async () => {
    const { code, hote, tous } = await salonAvec(6);
    const septieme = await new Joueur().pret();
    expect(await septieme.rejoindre(code, 'Septième')).toMatchObject({ ok: false, erreur: expect.stringContaining('complet') });
    expect((await hote.emit('salon:demarrer', {})).ok).toBe(true);
    await attendre(() => tous.every((j) => j.etat?.partie !== null));
    expect(await septieme.rejoindre(code, 'Retardataire')).toMatchObject({ ok: false, erreur: expect.stringContaining('déjà commencé') });
    [...tous, septieme].forEach((x) => x.fermer());
  });

  it('seul l\'hôte lance la partie, et seulement à partir de 3 joueurs', async () => {
    const { hote, autres, tous, code } = await salonAvec(2);
    expect(await hote.emit('salon:demarrer', {})).toMatchObject({ ok: false, erreur: expect.stringContaining('au moins 3') });
    const j3 = await new Joueur().pret();
    await j3.rejoindre(code, 'Troisième');
    expect(await autres[0].emit('salon:demarrer', {})).toMatchObject({ ok: false, erreur: expect.stringContaining("l'hôte") });
    expect((await hote.emit('salon:demarrer', {})).ok).toBe(true);
    [...tous, j3].forEach((x) => x.fermer());
  });

  it('l\'hôte peut ajouter des bots ; les autres non', async () => {
    const { hote, autres, tous } = await salonAvec(2);
    expect((await autres[0].emit('salon:ajouterBot', {})).ok).toBe(false);
    expect((await hote.emit('salon:ajouterBot', {})).ok).toBe(true);
    await attendre(() => hote.etat!.salon.joueurs.length === 3);
    expect(hote.etat!.salon.joueurs[2].bot).toBe(true);
    tous.forEach((x) => x.fermer());
  });

  it('chat public : diffusé à tous, longueur limitée', async () => {
    const { hote, autres, tous } = await salonAvec(3);
    expect((await autres[0].emit('salon:message', { texte: 'Je soupçonne le majordome.' })).ok).toBe(true);
    await attendre(() => tous.every((j) => j.etat!.salon.messages.length === 1));
    expect(hote.etat!.salon.messages[0]).toMatchObject({ nom: 'Joueur 1', texte: 'Je soupçonne le majordome.' });
    expect((await hote.emit('salon:message', { texte: 'x'.repeat(400) })).ok).toBe(false);
    tous.forEach((x) => x.fermer());
  });
});

describe('Partie en ligne : sécurité et synchronisation', () => {
  async function partieLancee(n: number) {
    const s = await salonAvec(n);
    expect((await s.hote.emit('salon:demarrer', {})).ok).toBe(true);
    await attendre(() => s.tous.every((j) => j.etat?.partie?.etape === 'tour'));
    const etatServeur = serveur.gestionnaire.salons.get(s.code)!.partie!;
    return { ...s, etatServeur };
  }

  it('chaque navigateur ne reçoit que SES informations privées', async () => {
    const { tous, etatServeur } = await partieLancee(5);
    for (const j of tous) {
      const id = j.session!.joueurId;
      const brut = j.recus.join('\n');
      const v = j.etat!.partie!;
      expect(v.moi.main).toEqual(etatServeur.joueurs[id].main);
      expect(brut).not.toContain('"solution"');
      expect(brut).not.toContain('"audit"');
      expect(brut).not.toContain('"affaire"');
      expect(brut).not.toContain('jetonHash');
      if (id === etatServeur.complice) {
        expect(v.moi.role).toBe('complice');
        expect(v.moi.meurtrier).toBe(etatServeur.affaire.solution.suspect);
      } else {
        expect(brut).not.toContain('"role":"complice"');
        expect(brut).not.toContain('"meurtrier"');
        expect(brut).not.toContain('mensongesRestants');
      }
      // Aucune trace des mains des autres joueurs.
      expect(brut.match(/"main":\[[^\]]*\]/g)!.every((m) => m === `"main":${JSON.stringify(etatServeur.joueurs[id].main)}`)).toBe(true);
    }
    tous.forEach((x) => x.fermer());
  });

  it('impossible d\'agir hors de son tour, ou d\'usurper un autre joueur', async () => {
    const { tous, etatServeur } = await partieLancee(4);
    const actif = etatServeur.ordre[etatServeur.indexTour];
    const passif = tous.find((j) => j.session!.joueurId !== actif)!;
    expect(await passif.action({ type: 'finTour' })).toMatchObject({ ok: false, erreur: "Ce n'est pas votre tour." });
    // Un champ « joueur » ajouté par un client malveillant est rejeté.
    expect((await passif.emit('jeu:action', { type: 'finTour', joueur: actif })).ok).toBe(false);
    expect((await passif.emit('jeu:action', { type: 'accuser', suspect: 'victor' })).ok).toBe(false);
    tous.forEach((x) => x.fermer());
  });

  it('deux requêtes simultanées ne consomment pas deux fois les points d\'action', async () => {
    const { tous, etatServeur } = await partieLancee(4);
    const actifId = etatServeur.ordre[etatServeur.indexTour];
    const actif = tous.find((j) => j.session!.joueurId === actifId)!;
    const cibles = etatServeur.ordre.filter((id) => id !== actifId).slice(0, 2);
    const h: ActionJeu = { type: 'hypothese', suspect: 'victor', lieu: 'cave', arme: 'dague', interroges: cibles };
    const res = await Promise.all([actif.action(h), actif.action(h), actif.action({ type: 'consulterArchive', dossier: 1 })]);
    expect(res.filter((r) => r.ok)).toHaveLength(1);
    expect(etatServeur.pointsAction).toBe(2 - etatServeur.config.coutHypothese);
    expect(etatServeur.hypotheses).toHaveLength(1);
    tous.forEach((x) => x.fermer());
  });

  it('reconnexion : même rôle, mêmes cartes, mêmes compteurs ; l\'ancienne session est expulsée', async () => {
    const { tous, code, etatServeur } = await partieLancee(3);
    const cible = tous.find((j) => j.session!.joueurId === etatServeur.complice)!;
    const avant = cible.etat!.partie!;
    await cible.action({ type: 'carnet', notes: 'Le docteur ment.' });
    // Nouvel onglet avec le même jeton (rafraîchissement de page).
    const nouveau = await new Joueur().pret();
    const r = await nouveau.emit('salon:reprendre', { code, jeton: cible.session!.jeton });
    expect(r.ok).toBe(true);
    await attendre(() => nouveau.etat?.partie != null);
    await attendre(() => cible.expulse !== null, 2000, 'expulsion de l’ancienne session');
    const apres = nouveau.etat!.partie!;
    expect(apres.moi.role).toBe(avant.moi.role);
    expect(apres.moi.main).toEqual(avant.moi.main);
    expect(apres.moi.meurtrier).toBe(avant.moi.meurtrier);
    expect(apres.moi.mensongesRestants).toBe(avant.moi.mensongesRestants);
    expect(apres.moi.rusesRestantes).toBe(avant.moi.rusesRestantes);
    expect(apres.moi.rusesRestantes).toBe(apres.regles.ruses); // mode rusé par défaut : réserve intacte
    expect(apres.moi.falsificationsRestantes).toBe(avant.moi.falsificationsRestantes);
    expect(apres.moi.carnet.notes).toBe('Le docteur ment.');
    // Un jeton forgé ne permet pas de prendre la place de quelqu'un.
    const pirate = await new Joueur().pret();
    expect((await pirate.emit('salon:reprendre', { code, jeton: 'faux-jeton-0123456789' })).ok).toBe(false);
    [...tous, nouveau, pirate].forEach((x) => x.fermer());
  });

  it('un joueur déconnecté met la partie en pause ; remplacé par un bot, la partie reprend ; revenu, il reprend sa place', async () => {
    const { code, tous, etatServeur } = await partieLancee(3);
    const actifId = etatServeur.ordre[etatServeur.indexTour];
    const actif = tous.find((j) => j.session!.joueurId === actifId)!;
    const jeton = actif.session!.jeton;
    const autres = tous.filter((j) => j !== actif);
    actif.fermer();
    await attendre(() => autres.every((j) => j.etat!.partie!.pause?.absents.some((a) => a.id === actifId && !a.parti)), 4000, 'pause visible');
    // En pause, le tour ne passe pas, même après le délai « déconnecté » (300 ms ici).
    await new Promise((r) => setTimeout(r, 600));
    expect(autres[0].etat!.partie!.joueurActif).toBe(actifId);
    // Remplacement par un bot : la partie reprend et le bot joue à sa place.
    expect((await autres[0].emit('salon:remplacer', { joueurId: actifId })).ok).toBe(true);
    await attendre(() => autres.every((j) => j.etat!.partie!.pause === null), 4000, 'fin de pause');
    expect(autres[1].etat!.salon.joueurs.find((j) => j.id === actifId)).toMatchObject({ bot: true });
    expect(autres[1].etat!.partie!.historique.some((e) => e.type === 'remplacement' && e.joueur === actifId)).toBe(true);
    await attendre(() => autres.every((j) => j.etat!.partie!.joueurActif !== actifId), 8000, 'le bot a joué');
    // Le joueur revient avec son jeton : il retrouve sa place, ses cartes et son rôle.
    const retour = await new Joueur().pret();
    expect((await retour.emit('salon:reprendre', { code, jeton })).ok).toBe(true);
    await attendre(() => retour.etat?.partie?.moi.id === actifId, 4000, 'retour');
    expect(retour.etat!.salon.joueurs.find((j) => j.id === actifId)).toMatchObject({ bot: false, connecte: true });
    expect(retour.etat!.partie!.moi.main).toEqual(etatServeur.joueurs[actifId].main);
    expect(serveur.gestionnaire.salons.get(code)!.partie!.joueurs[actifId].bot).toBe(false);
    [...autres, retour].forEach((x) => x.fermer());
  });

  it('on ne peut pas remplacer un joueur connecté, ni soi-même', async () => {
    const { tous } = await partieLancee(3);
    const [a, b] = tous;
    expect(await a.emit('salon:remplacer', { joueurId: b.session!.joueurId })).toMatchObject({ ok: false, erreur: 'Ce joueur est connecté.' });
    expect((await a.emit('salon:remplacer', { joueurId: a.session!.joueurId })).ok).toBe(false);
    expect((await a.emit('salon:remplacer', { joueurId: 42 })).ok).toBe(false);
    tous.forEach((x) => x.fermer());
  });

  it('partie complète en ligne : 3 navigateurs pilotés par des bots, état final identique pour tous', async () => {
    const { tous, etatServeur, hote } = await partieLancee(3);
    const rng = seededRng(5);
    let actif = true;
    const boucle = async (j: Joueur) => {
      while (actif) {
        const v = j.etat?.partie;
        if (v?.etape === 'terminee') return;
        const a = v ? decisionBot(v, rng) : null;
        if (a) await j.action(a);
        await new Promise((r) => setTimeout(r, 15));
      }
    };
    const fin = Promise.all(tous.map(boucle));
    await attendre(() => tous.every((j) => j.etat?.partie?.etape === 'terminee'), 60_000, 'fin de partie');
    actif = false;
    await fin;
    const resultats = tous.map((j) => JSON.stringify(j.etat!.partie!.resultat));
    expect(new Set(resultats).size).toBe(1);
    expect(tous.map((j) => j.etat!.partie!.historique.length)).toEqual(tous.map(() => etatServeur.historique.length));
    expect(hote.etat!.salon.statut).toBe('terminee');
    // Rejouer : retour au lobby avec les mêmes joueurs.
    expect((await hote.emit('salon:rejouer', {})).ok).toBe(true);
    await attendre(() => tous.every((j) => j.etat?.salon.statut === 'lobby' && j.etat.partie === null));
    tous.forEach((x) => x.fermer());
  }, 70_000);

  it('partie complète avec 1 humain et 2 bots du serveur', async () => {
    const humain = await new Joueur().pret();
    await humain.creer('Solo');
    await humain.emit('salon:ajouterBot', {});
    await humain.emit('salon:ajouterBot', {});
    expect((await humain.emit('salon:demarrer', {})).ok).toBe(true);
    const rng = seededRng(9);
    await attendre(() => humain.etat?.partie != null);
    const fin = Date.now() + 60_000;
    while (humain.etat!.partie!.etape !== 'terminee' && Date.now() < fin) {
      const a = decisionBot(humain.etat!.partie!, rng);
      if (a) await humain.action(a);
      await new Promise((r) => setTimeout(r, 15));
    }
    expect(humain.etat!.partie!.etape).toBe('terminee');
    humain.fermer();
  }, 70_000);
});

describe('Serveur HTTP', () => {
  it('répond sur /api/sante avec des en-têtes de sécurité', async () => {
    const r = await fetch(`${serveur.url}/api/sante`);
    expect(r.status).toBe(200);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(await r.json()).toMatchObject({ ok: true });
  });
});

describe('Quitter une partie en ligne', () => {
  it('un joueur quitte (visible par tous), puis le dernier joueur présent ferme le salon', async () => {
    const hote = await new Joueur().pret();
    await hote.creer('Hôte');
    const code = hote.session!.code;
    const b = await new Joueur().pret();
    await b.rejoindre(code, 'B');
    await hote.emit('salon:ajouterBot', {});
    expect((await hote.emit('salon:demarrer', {})).ok).toBe(true);
    await attendre(() => b.etat?.partie != null);
    const r = (await b.emit('salon:quitter', {})) as { ok: boolean; ferme?: boolean };
    expect(r).toMatchObject({ ok: true, ferme: false });
    await attendre(() => hote.etat!.partie!.joueurs.find((j) => j.id === b.session!.joueurId)?.parti === true);
    expect(hote.etat!.partie!.historique.some((e) => e.type === 'depart')).toBe(true);
    const r2 = (await hote.emit('salon:quitter', {})) as { ok: boolean; ferme?: boolean };
    expect(r2).toMatchObject({ ok: true, ferme: true });
    expect(serveur.gestionnaire.salons.has(code)).toBe(false);
    const c = await new Joueur().pret();
    expect((await c.rejoindre(code, 'Retard')).ok).toBe(false);
    [hote, b, c].forEach((x) => x.fermer());
  });
});

describe('Carnet en ligne', () => {
  it('cocher un seul élément du carnet est accepté ; une clé inconnue est refusée', async () => {
    const { hote, tous } = await salonAvec(3);
    expect((await hote.emit('salon:demarrer', {})).ok).toBe(true);
    await attendre(() => hote.etat?.partie != null);
    expect(await hote.action({ type: 'carnet', marques: { victor: 'ecarte' } })).toMatchObject({ ok: true });
    expect(await hote.action({ type: 'carnet', marques: { cave: 'probable', poison: 'certain' }, notes: 'à vérifier' })).toMatchObject({ ok: true });
    await attendre(() => hote.etat!.partie!.moi.carnet.marques.poison === 'certain');
    expect(hote.etat!.partie!.moi.carnet).toEqual({ marques: { victor: 'ecarte', cave: 'probable', poison: 'certain' }, notes: 'à vérifier' });
    expect((await hote.emit('jeu:action', { type: 'carnet', marques: { intrus: 'ecarte' } })).ok).toBe(false);
    tous.forEach((x) => x.fermer());
  });
});

describe('Mode du complice dans le salon', () => {
  it("l'hôte choisit le mode ; la partie démarre dans ce mode", async () => {
    const { hote, autres, tous, code } = await salonAvec(3);
    expect(hote.etat!.salon.reglages.modeComplice).toBe('ruse');
    expect((await autres[0].emit('salon:reglages', { modeComplice: 'classique' })).ok).toBe(false);
    expect((await hote.emit('salon:reglages', { modeComplice: 'n-importe-quoi' })).ok).toBe(false);
    expect((await hote.emit('salon:reglages', { modeComplice: 'classique' })).ok).toBe(true);
    await attendre(() => tous.every((j) => j.etat!.salon.reglages.modeComplice === 'classique'));
    expect((await hote.emit('salon:demarrer', {})).ok).toBe(true);
    await attendre(() => hote.etat?.partie != null);
    expect(hote.etat!.partie!.regles.modeComplice).toBe('classique');
    expect(serveur.gestionnaire.salons.get(code)!.partie!.config.modeComplice).toBe('classique');
    tous.forEach((x) => x.fermer());
  });
});

describe('Cartes montrées anonymes (mode difficile)', () => {
  it("l'hôte seul choisit, dans le salon d'attente ; la partie démarre dans ce mode", async () => {
    const { hote, autres, tous, code } = await salonAvec(3);
    expect(hote.etat!.salon.reglages.historiqueCartes).toBe('visibles');
    expect((await autres[0].emit('salon:reglages', { historiqueCartes: 'anonymes' })).ok).toBe(false);
    expect((await hote.emit('salon:reglages', { historiqueCartes: 'oui' })).ok).toBe(false);
    expect((await hote.emit('salon:reglages', { historiqueCartes: 'anonymes' })).ok).toBe(true);
    await attendre(() => tous.every((j) => j.etat!.salon.reglages.historiqueCartes === 'anonymes'));
    expect((await hote.emit('salon:demarrer', {})).ok).toBe(true);
    await attendre(() => hote.etat?.partie != null);
    expect(hote.etat!.partie!.regles.historiqueCartes).toBe('anonymes');
    expect(serveur.gestionnaire.salons.get(code)!.partie!.config.historiqueCartes).toBe('anonymes');
    expect((await hote.emit('salon:reglages', { historiqueCartes: 'visibles' })).ok).toBe(false); // partie lancée
    tous.forEach((x) => x.fermer());
  });
});
