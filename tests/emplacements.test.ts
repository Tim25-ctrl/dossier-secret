import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { cleCodeJoueur, cleCompte, DepotMemoire, DepotSql, reprendreEmplacements, resumer, type ClientSql } from '../src/server/emplacements';
import { GestionnaireSalons, hacher } from '../src/server/salons';

const CODE_JOUEUR = 'ABCD-EFGH-JK23';

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
  it("reprend dans un compte les sauvegardes d'un ancien code joueur, sans écraser celles du compte", async () => {
    expect(cleCodeJoueur('ABC')).toBeNull();
    expect(cleCodeJoueur('ABCD-EFGH-JK1O')).toBeNull(); // 1 et O n'existent pas dans l'alphabet
    expect(cleCodeJoueur('abcd efgh jk23')).toBe(cleCodeJoueur(CODE_JOUEUR));
    const depot = new DepotMemoire();
    const g = new GestionnaireSalons();
    const { salon, joueur } = g.creerSolo('Moi', 2);
    const { salon: copie } = g.instantane(salon.code, joueur.id);
    const e = { type: 'solo' as const, numero: 1, t: 1, resume: resumer(copie, joueur.id), joueurId: joueur.id, salon: copie };
    const ancienne = cleCodeJoueur(CODE_JOUEUR)!;
    await depot.ecrire(ancienne, e);
    await depot.ecrire(ancienne, { ...e, numero: 2, t: 2 });
    await depot.ecrire(cleCompte('c1'), { ...e, numero: 2, t: 99 }); // place déjà prise côté compte
    expect(await reprendreEmplacements(depot, ancienne, cleCompte('c1'))).toBe(1);
    expect((await depot.lister(cleCompte('c1'))).map((x) => [x.numero, x.t])).toEqual([
      [1, 1],
      [2, 99],
    ]);
    expect((await depot.lister(ancienne)).map((x) => x.numero)).toEqual([2]);
  });

  it('base PostgreSQL : écrire, lister, remplacer, effacer, et garder l’état des salons', async () => {
    const pg = new PGlite();
    const depot = await DepotSql.ouvrir(pg as unknown as ClientSql);
    await DepotSql.ouvrir(pg as unknown as ClientSql); // une seconde ouverture ne casse rien
    const g = new GestionnaireSalons();
    const { salon, joueur } = g.creerSolo('Moi', 3);
    const { salon: copie } = g.instantane(salon.code, joueur.id);
    const cle = cleCompte('c1');
    const e = { type: 'solo' as const, numero: 2, t: 1_700_000_000_000, resume: resumer(copie, joueur.id), joueurId: joueur.id, salon: copie };
    await depot.ecrire(cle, e);
    await depot.ecrire(cle, { ...e, type: 'multi', numero: 1 });
    await depot.ecrire(cle, { ...e, t: e.t + 5 }); // remplace l'emplacement solo 2
    expect((await depot.lister(cle)).map((x) => [x.type, x.numero, x.t])).toEqual([
      ['solo', 2, e.t + 5],
      ['multi', 1, e.t],
    ]);
    expect(await depot.lister(cleCompte('c2'))).toEqual([]);
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

