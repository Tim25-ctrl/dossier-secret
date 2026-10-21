import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { empreinte, ServiceComptes, verifier } from '../src/server/comptes';
import { cleCodeJoueur, cleCompte, DepotMemoire, DepotSql, type ClientSql, type Depot } from '../src/server/emplacements';
import { demarrerServeur } from '../src/server/serveur';
import type { ConnexionCompte, CompteVue, EtatClient, EvenementsClient, EvenementsServeur, InfoEmplacement, Reponse, Session } from '../src/shared/protocole';

const PROFIL = {
  parties: 4,
  victoires: 3,
  enqueteur: { parties: 3, victoires: 2 },
  complice: { parties: 1, victoires: 1 },
  serie: 2,
  meilleureSerie: 2,
  succes: { premiere: 1 },
  comptees: ['p1', 'p2', 'p3', 'p4'],
};

/** Les mêmes vérifications sur la base PostgreSQL (PGlite) et en mémoire. */
async function avecDepots(test: (depot: Depot) => Promise<void>) {
  await test(new DepotMemoire());
  const pg = new PGlite();
  await test(await DepotSql.ouvrir(pg as unknown as ClientSql));
  await pg.close();
}

describe('Comptes', () => {
  it("le mot de passe n'est gardé que sous forme d'empreinte salée", async () => {
    const a = await empreinte('secret123');
    const b = await empreinte('secret123');
    expect(a).not.toContain('secret123');
    expect(a).not.toBe(b); // sel différent
    expect(await verifier('secret123', a)).toBe(true);
    expect(await verifier('secret124', a)).toBe(false);
  });

  it('création, pseudonyme unique (sans tenir compte des majuscules), connexion, reprise et déconnexion', async () => {
    await avecDepots(async (depot) => {
      const s = new ServiceComptes(depot);
      await expect(s.creer('Léa', '123', null)).rejects.toThrow('au moins 6');
      const c = await s.creer('Léa', 'motdepasse', PROFIL);
      expect(c.codeSecours).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      await expect(s.creer('LÉA', 'autre-mdp', null)).rejects.toThrow('déjà pris');

      await expect(s.connecter('léa', 'mauvais')).rejects.toThrow('incorrect');
      await expect(s.connecter('Personne', 'motdepasse')).rejects.toThrow('incorrect');
      const r = await s.connecter('léa', 'motdepasse');
      expect(r.compte.nom).toBe('Léa');
      expect(JSON.parse(r.compte.profil!)).toEqual(PROFIL);
      expect((await s.reprendre(r.jeton))?.id).toBe(c.compte.id);
      expect(await s.reprendre('jeton-inventé-de-trente-caractères')).toBeNull();
      await s.deconnecter(r.jeton);
      expect(await s.reprendre(r.jeton)).toBeNull();
      expect((await s.reprendre(c.jeton))?.id).toBe(c.compte.id); // l'autre appareil reste connecté
    });
  });

  it('bloque les essais après 5 mots de passe faux, quelques minutes', async () => {
    let t = 1_000_000;
    const s = new ServiceComptes(new DepotMemoire(), () => t);
    await s.creer('Max', 'motdepasse', null);
    for (let i = 0; i < 5; i++) await expect(s.connecter('Max', 'faux')).rejects.toThrow('incorrect');
    await expect(s.connecter('Max', 'motdepasse')).rejects.toThrow("Trop d'essais");
    t += 5 * 60_000 + 1;
    expect((await s.connecter('Max', 'motdepasse')).compte.nom).toBe('Max');
  });

  it('mot de passe oublié : le code de secours donne un nouveau mot de passe et déconnecte les autres appareils', async () => {
    await avecDepots(async (depot) => {
      const s = new ServiceComptes(depot);
      const c = await s.creer('Zoé', 'ancien-mdp', null);
      await expect(s.recuperer('Zoé', 'AAAA-AAAA-AAAA', 'nouveau-mdp')).rejects.toThrow('code de secours incorrect');
      const r = await s.recuperer('zoé', c.codeSecours.toLowerCase().replace(/-/g, ' '), 'nouveau-mdp');
      expect(r.codeSecours).not.toBe(c.codeSecours);
      expect(await s.reprendre(c.jeton)).toBeNull();
      await expect(s.connecter('Zoé', 'ancien-mdp')).rejects.toThrow();
      expect((await s.connecter('Zoé', 'nouveau-mdp')).compte.id).toBe(c.compte.id);
      // L'ancien code de secours ne sert plus.
      await expect(s.recuperer('Zoé', c.codeSecours, 'encore-autre')).rejects.toThrow();
    });
  });

  it('changer le mot de passe, enregistrer le profil, supprimer le compte et ses sauvegardes', async () => {
    await avecDepots(async (depot) => {
      const s = new ServiceComptes(depot);
      const c = await s.creer('Tom', 'motdepasse', null);
      const autre = await s.connecter('Tom', 'motdepasse');
      await expect(s.changerMotDePasse(c.compte.id, 'faux', 'nouveau-mdp', c.jeton)).rejects.toThrow('incorrect');
      await s.changerMotDePasse(c.compte.id, 'motdepasse', 'nouveau-mdp', c.jeton);
      expect(await s.reprendre(c.jeton)).not.toBeNull(); // cet appareil reste connecté
      expect(await s.reprendre(autre.jeton)).toBeNull(); // les autres non

      await s.enregistrerProfil(c.compte.id, PROFIL);
      expect(JSON.parse((await depot.compteParId(c.compte.id))!.profil!)).toEqual(PROFIL);

      await depot.ecrire(cleCompte(c.compte.id), { type: 'solo', numero: 1, t: 1, joueurId: 'x', resume: {} as never, salon: {} as never });
      await expect(s.supprimer(c.compte.id, 'motdepasse')).rejects.toThrow('incorrect');
      await s.supprimer(c.compte.id, 'nouveau-mdp');
      expect(await depot.compteParId(c.compte.id)).toBeNull();
      expect(await depot.lister(cleCompte(c.compte.id))).toEqual([]);
      expect(await s.reprendre(c.jeton)).toBeNull();
      await s.creer('Tom', 'motdepasse', null); // le pseudonyme est de nouveau libre
    });
  });
});

// ---------------------------------------------------------------------------
// De bout en bout, par le réseau
// ---------------------------------------------------------------------------

type Client = Socket<EvenementsServeur, EvenementsClient>;
type R = Reponse<
  Partial<ConnexionCompte> & { session?: Session; emplacements?: InfoEmplacement[]; emplacement?: InfoEmplacement; compte?: CompteVue | null }
>;

const attendre = async (cond: () => boolean, ms = 4000, msg = 'condition') => {
  const fin = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > fin) throw new Error(`Délai dépassé : ${msg}`);
    await new Promise((r) => setTimeout(r, 10));
  }
};
async function client(url: string) {
  const socket: Client = ioClient(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  const c = { socket, etat: null as EtatClient | null, capacites: null as { comptes: boolean } | null };
  socket.on('etat', (e) => (c.etat = e));
  socket.on('capacites', (p) => (c.capacites = p));
  await new Promise<void>((r) => socket.once('connect', () => r()));
  return c;
}
const emettre = (s: Client, ev: keyof EvenementsClient, p: unknown) => new Promise<R>((r) => (s.emit as (...a: unknown[]) => void)(ev, p, r));
const options = (emplacements: Depot | null) => ({
  port: 0,
  dossierDonnees: null,
  journaliser: false,
  cleSauvegarde: 'secret-test',
  delaiBotsMs: [60_000, 60_000] as [number, number],
  emplacements,
});
const solo = { nom: 'Moi', bots: 3, dureeTourS: null, modeComplice: 'ruse', affaire: 'train' };

describe('Comptes et sauvegardes : par le réseau', () => {
  it('sans compte on joue mais on ne sauvegarde pas ; avec un compte : enregistrer, quitter, recharger ailleurs', async () => {
    const depot = new DepotMemoire();
    const serveur = await demarrerServeur(options(depot));
    const moi = await client(serveur.url);
    await attendre(() => moi.capacites !== null, 2000, 'capacités');
    expect(moi.capacites).toEqual({ comptes: true });

    expect((await emettre(moi.socket, 'salon:solo', solo)).ok).toBe(true);
    await attendre(() => !!moi.etat?.partie, 2000, 'partie solo');
    const main = moi.etat!.partie!.moi.main;
    const refus = await emettre(moi.socket, 'emplacements:enregistrer', { numero: 1 });
    expect(!refus.ok && refus.erreur).toContain('Connectez-vous');
    expect(!(await emettre(moi.socket, 'emplacements:lister', {})).ok).toBe(true);

    // Création du compte en pleine partie, avec reprise d'une sauvegarde de l'ancien code joueur.
    const ancienne = cleCodeJoueur('ABCD-EFGH-JK23')!;
    await depot.ecrire(ancienne, { type: 'multi', numero: 3, t: 5, joueurId: 'x', resume: { affaire: 'manoir', manche: 2, manchesMax: 12, autres: [], bots: 2, nom: 'Moi' }, salon: {} as never });
    const cree = await emettre(moi.socket, 'compte:creer', { nom: 'Moi', motDePasse: 'motdepasse', codeJoueur: 'ABCD-EFGH-JK23' });
    expect(cree).toMatchObject({ ok: true, compte: { nom: 'Moi', profil: null }, repris: 1 });
    const jeton = (cree as ConnexionCompte).jeton;

    expect(await emettre(moi.socket, 'emplacements:enregistrer', { numero: 2 })).toMatchObject({ ok: true, emplacement: { type: 'solo', numero: 2 } });
    expect((await emettre(moi.socket, 'compte:profil', { profil: { parties: -1 } })).ok).toBe(false);
    expect((await emettre(moi.socket, 'compte:profil', { profil: PROFIL })).ok).toBe(true);
    expect(await emettre(moi.socket, 'salon:quitter', {})).toMatchObject({ ok: true, ferme: true });

    // Un autre appareil : sans compte rien ; avec le jeton (session gardée), les sauvegardes et le profil.
    const ailleurs = await client(serveur.url);
    expect(await emettre(ailleurs.socket, 'compte:reprendre', { jeton: 'faux-jeton-de-plus-de-vingt-caracteres' })).toEqual({ ok: true, compte: null });
    const repris = await emettre(ailleurs.socket, 'compte:reprendre', { jeton });
    expect(repris).toMatchObject({ ok: true, compte: { nom: 'Moi', profil: PROFIL } });
    const liste = await emettre(ailleurs.socket, 'emplacements:lister', {});
    expect(liste.ok && liste.emplacements?.map((e) => [e.type, e.numero])).toEqual([
      ['solo', 2],
      ['multi', 3],
    ]);
    expect((await emettre(ailleurs.socket, 'emplacements:charger', { type: 'solo', numero: 2 })).ok).toBe(true);
    await attendre(() => !!ailleurs.etat?.partie, 2000, 'partie rechargée');
    expect(ailleurs.etat!.partie!.moi.main).toEqual(main);

    // Déconnexion : plus d'accès aux sauvegardes.
    expect((await emettre(ailleurs.socket, 'compte:deconnecter', {})).ok).toBe(true);
    expect((await emettre(ailleurs.socket, 'emplacements:lister', {})).ok).toBe(false);
    expect(await emettre(ailleurs.socket, 'compte:reprendre', { jeton })).toEqual({ ok: true, compte: null });
    // Connexion par mot de passe.
    expect(await emettre(ailleurs.socket, 'compte:connecter', { nom: 'moi', motDePasse: 'motdepasse' })).toMatchObject({ ok: true, compte: { nom: 'Moi' } });
    expect((await emettre(ailleurs.socket, 'emplacements:lister', {})).ok).toBe(true);
    moi.socket.disconnect();
    ailleurs.socket.disconnect();
    await serveur.fermer();
  });

  it("multijoueur : seul l'hôte enregistre ; salle d'attente après rechargement", async () => {
    const serveur = await demarrerServeur(options(new DepotMemoire()));
    const hote = await client(serveur.url);
    const eva = await client(serveur.url);
    await emettre(hote.socket, 'compte:creer', { nom: 'Hôte', motDePasse: 'motdepasse' });
    await emettre(eva.socket, 'compte:creer', { nom: 'Eva', motDePasse: 'motdepasse' });
    const sHote = (await emettre(hote.socket, 'salon:creer', { nom: 'Hôte' })) as { session: Session };
    await emettre(eva.socket, 'salon:rejoindre', { code: sHote.session.code, nom: 'Eva' });
    await emettre(hote.socket, 'salon:ajouterBot', {});
    await emettre(hote.socket, 'salon:demarrer', {});
    await attendre(() => !!hote.etat?.partie && !!eva.etat?.partie, 2000, 'partie lancée');

    const refus = await emettre(eva.socket, 'emplacements:enregistrer', { numero: 1 });
    expect(!refus.ok && refus.erreur).toContain("Seul l'hôte");
    expect(await emettre(hote.socket, 'emplacements:enregistrer', { numero: 1 })).toMatchObject({
      ok: true,
      emplacement: { type: 'multi', resume: { autres: ['Eva'], bots: 1 } },
    });
    await emettre(eva.socket, 'salon:quitter', {});
    await emettre(hote.socket, 'salon:quitter', {});
    hote.etat = null;
    expect((await emettre(hote.socket, 'emplacements:charger', { type: 'multi', numero: 1 })).ok).toBe(true);
    await attendre(() => !!hote.etat?.partie, 2000, 'partie rechargée');
    expect(hote.etat!.salon.reprise).toBe(true); // Eva doit revenir avec le code
    hote.socket.disconnect();
    eva.socket.disconnect();
    await serveur.fermer();
  });

  it('sans base de données : comptes indisponibles, on joue quand même', async () => {
    const serveur = await demarrerServeur(options(null));
    const moi = await client(serveur.url);
    await attendre(() => moi.capacites !== null, 2000, 'capacités');
    expect(moi.capacites).toEqual({ comptes: false });
    const r = await emettre(moi.socket, 'compte:creer', { nom: 'Moi', motDePasse: 'motdepasse' });
    expect(!r.ok && r.erreur).toContain('pas disponibles');
    expect((await emettre(moi.socket, 'salon:solo', solo)).ok).toBe(true);
    moi.socket.disconnect();
    await serveur.fermer();
  });

  it('avec une base de données, les salons en cours survivent à un redémarrage du serveur', async () => {
    const pg = new PGlite();
    const depot = await DepotSql.ouvrir(pg as unknown as ClientSql);
    const a = await demarrerServeur(options(depot));
    const moi = await client(a.url);
    const s = (await emettre(moi.socket, 'salon:solo', { ...solo, bots: 2, affaire: 'manoir' })) as { session: Session };
    await attendre(() => !!moi.etat?.partie, 2000, 'partie solo');
    moi.socket.disconnect();
    await a.fermer(); // écrit l'état dans la base

    const b = await demarrerServeur(options(depot));
    expect(b.gestionnaire.salons.has(s.session.code)).toBe(true);
    const retour = await client(b.url);
    expect((await emettre(retour.socket, 'salon:reprendre', { code: s.session.code, jeton: s.session.jeton })).ok).toBe(true);
    retour.socket.disconnect();
    await b.fermer();
    await pg.close();
  });
});
