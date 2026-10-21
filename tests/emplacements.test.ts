import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { cleJoueur, DepotMemoire, DepotSql, resumer, type ClientSql } from '../src/server/emplacements';
import { GestionnaireSalons, hacher } from '../src/server/salons';
import { demarrerServeur } from '../src/server/serveur';
import type { EtatClient, EvenementsClient, EvenementsServeur, InfoEmplacement, Reponse, Session } from '../src/shared/protocole';

const CODE_JOUEUR = 'ABCD-EFGH-JK23';
const AUTRE_CODE = 'ZZZZ-ZZZZ-ZZZZ';

describe('Emplacements : gestionnaire de salons', () => {
  it('copie une partie solo, puis la recharge avec un nouveau jeton une fois le salon fermé', () => {
    const g = new GestionnaireSalons();
    const { salon, joueur } = g.creerSolo('Moi', 3, { dureeTourS: null });
    const { type, salon: copie } = g.instantane(salon.code, joueur.id);
    expect(type).toBe('solo');
    expect(resumer(copie, joueur.id)).toMatchObject({ manche: 1, manchesMax: 12, autres: [], bots: 3, nom: 'Moi' });

    g.quitter(salon.code, joueur.id); // dernier humain : le salon est fermé
    expect(g.salons.size).toBe(0);
    const r = g.chargerSauvegarde(copie, joueur.id);
    expect(r.salon.code).toBe(salon.code);
    expect(r.joueur.jetonHash).toBe(hacher(r.jeton));
    expect(r.salon.partie!.id).toBe(copie.partie!.id);
    expect(g.reprendre(r.salon.code, r.jeton).joueur.id).toBe(joueur.id);
  });

  it("en multijoueur, seul l'hôte enregistre ; une partie encore jouée ne peut pas être rechargée par-dessus", () => {
    const g = new GestionnaireSalons();
    const { salon, joueur: hote } = g.creer('Hôte');
    const { joueur: eva } = g.rejoindre(salon.code, 'Eva');
    g.ajouterBot(salon.code, hote.id);
    g.demarrer(salon.code, hote.id);
    expect(() => g.instantane(salon.code, eva.id)).toThrow("Seul l'hôte");
    const { type, salon: copie } = g.instantane(salon.code, hote.id);
    expect(type).toBe('multi');
    expect(resumer(copie, hote.id).autres).toEqual(['Eva']);

    // Eva joue encore : refus.
    expect(() => g.chargerSauvegarde(copie, hote.id)).toThrow('encore en cours');
    // Plus personne : la sauvegarde remplace la partie abandonnée, salle d'attente pour Eva.
    g.definirConnexion(salon.code, hote.id, false);
    g.definirConnexion(salon.code, eva.id, false);
    const r = g.chargerSauvegarde(copie, hote.id);
    expect(r.salon.code).toBe(salon.code);
    expect(r.salon.reprise).toBe(true);
    expect(r.salon.hote).toBe(hote.id);
  });

  it("prend un autre code si le sien est occupé par une autre partie, et refuse l'enregistrement hors partie", () => {
    const g = new GestionnaireSalons();
    const a = g.creerSolo('Moi', 2);
    const { salon: copie } = g.instantane(a.salon.code, a.joueur.id);
    copie.partie!.id = 'une-autre-partie';
    const r = g.chargerSauvegarde(copie, a.joueur.id);
    expect(r.salon.code).not.toBe(a.salon.code);
    expect(g.salons.size).toBe(2);

    const lobby = g.creer('Lobby');
    expect(() => g.instantane(lobby.salon.code, lobby.joueur.id)).toThrow('partie en cours');
  });
});

describe('Emplacements : stockage', () => {
  it('refuse les codes joueur mal formés et range chaque code à part', () => {
    expect(() => cleJoueur('ABC')).toThrow();
    expect(() => cleJoueur('ABCD-EFGH-JK1O')).toThrow(); // 1 et O n'existent pas dans l'alphabet
    expect(cleJoueur('abcd efgh jk23')).toBe(cleJoueur(CODE_JOUEUR));
    expect(cleJoueur(CODE_JOUEUR)).not.toBe(cleJoueur(AUTRE_CODE));
  });

  it('base PostgreSQL : écrire, lister, remplacer, effacer, et garder l’état des salons', async () => {
    const pg = new PGlite();
    const depot = await DepotSql.ouvrir(pg as unknown as ClientSql);
    await DepotSql.ouvrir(pg as unknown as ClientSql); // une seconde ouverture ne casse rien
    const g = new GestionnaireSalons();
    const { salon, joueur } = g.creerSolo('Moi', 3);
    const { salon: copie } = g.instantane(salon.code, joueur.id);
    const cle = cleJoueur(CODE_JOUEUR);
    const e = { type: 'solo' as const, numero: 2, t: 1_700_000_000_000, resume: resumer(copie, joueur.id), joueurId: joueur.id, salon: copie };
    await depot.ecrire(cle, e);
    await depot.ecrire(cle, { ...e, type: 'multi', numero: 1 });
    await depot.ecrire(cle, { ...e, t: e.t + 5 }); // remplace l'emplacement solo 2
    expect((await depot.lister(cle)).map((x) => [x.type, x.numero, x.t])).toEqual([
      ['solo', 2, e.t + 5],
      ['multi', 1, e.t],
    ]);
    expect(await depot.lister(cleJoueur(AUTRE_CODE))).toEqual([]);
    const lu = await depot.lire(cle, 'solo', 2);
    expect(lu?.salon.partie?.id).toBe(copie.partie!.id);
    expect(lu?.joueurId).toBe(joueur.id);
    await depot.effacer(cle, 'solo', 2);
    expect(await depot.lire(cle, 'solo', 2)).toBeNull();

    expect(await depot.lireEtat()).toBeNull();
    await depot.ecrireEtat(g.serialiser());
    const g2 = new GestionnaireSalons();
    g2.charger((await depot.lireEtat())!);
    expect(g2.salons.get(salon.code)?.partie?.id).toBe(salon.partie!.id);
    await pg.close();
  });
});

// ---------------------------------------------------------------------------
// De bout en bout, par le réseau
// ---------------------------------------------------------------------------

type Client = Socket<EvenementsServeur, EvenementsClient>;
type R = Reponse<{ session?: Session; emplacements?: InfoEmplacement[]; emplacement?: InfoEmplacement }>;

const attendre = async (cond: () => boolean, ms = 4000, msg = 'condition') => {
  const fin = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > fin) throw new Error(`Délai dépassé : ${msg}`);
    await new Promise((r) => setTimeout(r, 10));
  }
};
async function client(url: string) {
  const socket: Client = ioClient(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  const c = { socket, etat: null as EtatClient | null, capacites: null as { emplacements: boolean } | null };
  socket.on('etat', (e) => (c.etat = e));
  socket.on('capacites', (p) => (c.capacites = p));
  await new Promise<void>((r) => socket.once('connect', () => r()));
  return c;
}
const emettre = (s: Client, ev: keyof EvenementsClient, p: unknown) => new Promise<R>((r) => (s.emit as (...a: unknown[]) => void)(ev, p, r));
const options = (emplacements: DepotMemoire | DepotSql | null) => ({
  port: 0,
  dossierDonnees: null,
  journaliser: false,
  cleSauvegarde: 'secret-test',
  delaiBotsMs: [60_000, 60_000] as [number, number],
  emplacements,
});

describe('Emplacements : par le réseau', () => {
  it('enregistre une partie solo, la recharge après avoir quitté, et sépare solo et multijoueur', async () => {
    const serveur = await demarrerServeur(options(new DepotMemoire()));
    const moi = await client(serveur.url);
    await attendre(() => moi.capacites !== null, 2000, 'capacités');
    expect(moi.capacites).toEqual({ emplacements: true });

    const solo = (await emettre(moi.socket, 'salon:solo', { nom: 'Moi', bots: 3, dureeTourS: null, modeComplice: 'ruse', affaire: 'train' })) as { session: Session };
    await attendre(() => !!moi.etat?.partie, 2000, 'partie solo');
    expect(moi.etat!.salon.solo).toBe(true);
    const main = moi.etat!.partie!.moi.main;

    expect(await emettre(moi.socket, 'emplacements:enregistrer', { codeJoueur: CODE_JOUEUR, numero: 4 })).toMatchObject({ ok: false });
    const enr = await emettre(moi.socket, 'emplacements:enregistrer', { codeJoueur: CODE_JOUEUR, numero: 3 });
    expect(enr).toMatchObject({ ok: true, emplacement: { type: 'solo', numero: 3, resume: { affaire: 'train', bots: 3, manche: 1 } } });
    expect(await emettre(moi.socket, 'salon:quitter', {})).toMatchObject({ ok: true, ferme: true });

    // Un autre code joueur ne voit rien ; le bon code retrouve l'emplacement et recharge la partie.
    expect(await emettre(moi.socket, 'emplacements:lister', { codeJoueur: AUTRE_CODE })).toEqual({ ok: true, emplacements: [] });
    const liste = await emettre(moi.socket, 'emplacements:lister', { codeJoueur: CODE_JOUEUR });
    expect(liste.ok && liste.emplacements?.map((e) => [e.type, e.numero])).toEqual([['solo', 3]]);
    expect(await emettre(moi.socket, 'emplacements:charger', { codeJoueur: CODE_JOUEUR, type: 'multi', numero: 3 })).toMatchObject({ ok: false });
    moi.etat = null;
    const charge = await emettre(moi.socket, 'emplacements:charger', { codeJoueur: CODE_JOUEUR, type: 'solo', numero: 3 });
    expect(charge.ok).toBe(true);
    await attendre(() => !!moi.etat?.partie, 2000, 'partie rechargée');
    expect(moi.etat!.partie!.moi.main).toEqual(main);
    expect(moi.etat!.partie!.pause).toBeFalsy(); // seul humain : la partie repart aussitôt
    expect(moi.etat!.salon.reprise).toBe(false);

    // La session rendue fonctionne depuis une nouvelle connexion.
    const ailleurs = await client(serveur.url);
    const session = (charge as { session: Session }).session;
    expect(session.code).toBe(solo.session.code);
    expect((await emettre(ailleurs.socket, 'salon:reprendre', { code: session.code, jeton: session.jeton })).ok).toBe(true);

    // (la nouvelle connexion a pris la place de l'ancienne, qui est déconnectée)
    expect((await emettre(ailleurs.socket, 'emplacements:effacer', { codeJoueur: CODE_JOUEUR, type: 'solo', numero: 3 })).ok).toBe(true);
    expect(await emettre(ailleurs.socket, 'emplacements:lister', { codeJoueur: CODE_JOUEUR })).toEqual({ ok: true, emplacements: [] });
    moi.socket.disconnect();
    ailleurs.socket.disconnect();
    await serveur.fermer();
  });

  it("multijoueur : refus pour un invité, salle d'attente après rechargement par l'hôte", async () => {
    const serveur = await demarrerServeur(options(new DepotMemoire()));
    const hote = await client(serveur.url);
    const eva = await client(serveur.url);
    const sHote = (await emettre(hote.socket, 'salon:creer', { nom: 'Hôte' })) as { session: Session };
    await emettre(eva.socket, 'salon:rejoindre', { code: sHote.session.code, nom: 'Eva' });
    await emettre(hote.socket, 'salon:ajouterBot', {});
    await emettre(hote.socket, 'salon:demarrer', {});
    await attendre(() => !!hote.etat?.partie && !!eva.etat?.partie, 2000, 'partie lancée');

    const refus = await emettre(eva.socket, 'emplacements:enregistrer', { codeJoueur: AUTRE_CODE, numero: 1 });
    expect(!refus.ok && refus.erreur).toContain("Seul l'hôte");
    expect(await emettre(hote.socket, 'emplacements:enregistrer', { codeJoueur: CODE_JOUEUR, numero: 1 })).toMatchObject({
      ok: true,
      emplacement: { type: 'multi', resume: { autres: ['Eva'], bots: 1 } },
    });
    await emettre(eva.socket, 'salon:quitter', {});
    await emettre(hote.socket, 'salon:quitter', {});
    expect(serveur.gestionnaire.salons.size).toBe(0);

    hote.etat = null;
    expect((await emettre(hote.socket, 'emplacements:charger', { codeJoueur: CODE_JOUEUR, type: 'multi', numero: 1 })).ok).toBe(true);
    await attendre(() => !!hote.etat?.partie, 2000, 'partie rechargée');
    expect(hote.etat!.salon.reprise).toBe(true); // Eva doit revenir avec le code
    hote.socket.disconnect();
    eva.socket.disconnect();
    await serveur.fermer();
  });

  it('sans dépôt, les emplacements sont annoncés indisponibles', async () => {
    const serveur = await demarrerServeur(options(null));
    const moi = await client(serveur.url);
    await attendre(() => moi.capacites !== null, 2000, 'capacités');
    expect(moi.capacites).toEqual({ emplacements: false });
    const r = await emettre(moi.socket, 'emplacements:lister', { codeJoueur: CODE_JOUEUR });
    expect(!r.ok && r.erreur).toContain('pas disponibles');
    moi.socket.disconnect();
    await serveur.fermer();
  });

  it('avec une base de données, les salons en cours survivent à un redémarrage du serveur', async () => {
    const pg = new PGlite();
    const depot = await DepotSql.ouvrir(pg as unknown as ClientSql);
    const a = await demarrerServeur(options(depot));
    const moi = await client(a.url);
    const s = (await emettre(moi.socket, 'salon:solo', { nom: 'Moi', bots: 2, dureeTourS: null, modeComplice: 'ruse', affaire: 'manoir' })) as { session: Session };
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
