import { beforeEach, describe, expect, it } from 'vitest';
import { GestionnaireSalons } from '../src/server/salons';
import type { VueJoueur } from '../src/shared/types';

describe('Partie seul contre des bots', () => {
  it('crée le salon, ajoute les bots et lance la partie avec les réglages choisis', () => {
    const g = new GestionnaireSalons();
    const { salon, joueur } = g.creerSolo('Moi', 3, { dureeTourS: null, modeComplice: 'classique', historiqueCartes: 'anonymes', affaire: 'train' });
    expect(salon.statut).toBe('partie');
    expect(salon.joueurs.filter((j) => j.bot)).toHaveLength(3);
    expect(salon.hote).toBe(joueur.id);
    expect(salon.partie!.config.modeComplice).toBe('classique');
    expect(salon.partie!.config.delaiTourMs).toBeNull();
    expect(salon.partie!.config.historiqueCartes).toBe('anonymes');
    expect(salon.partie!.config.affaire).toBe('train');
  });

  it('refuse un nombre de bots hors limites sans laisser de salon derrière', () => {
    const g = new GestionnaireSalons();
    expect(() => g.creerSolo('Moi', 1)).toThrow();
    expect(() => g.creerSolo('Moi', 6)).toThrow();
    expect(g.salons.size).toBe(0);
    expect(() => new GestionnaireSalons({ botsAutorises: false }).creerSolo('Moi', 3)).toThrow();
  });
});

describe('Profil et succès', () => {
  beforeEach(() => {
    const donnees = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => donnees.get(k) ?? null,
      setItem: (k: string, v: string) => void donnees.set(k, v),
      removeItem: (k: string) => void donnees.delete(k),
    } as Storage;
  });

  const vue = (id: string, role: 'enqueteur' | 'complice', vainqueur: 'enqueteurs' | 'complice', accusationJuste = false) =>
    ({
      partieId: id,
      moi: { id: 'moi', role, indicesConsultes: [], piecesConsultees: [] },
      resultat: {
        vainqueur,
        manchesJouees: 4,
        accusations: accusationJuste ? [{ joueur: 'moi', correcte: true }] : [],
        denonciations: [],
        usagesPouvoirs: { mensonges: [], emprunts: [], falsifications: [], trafics: [] },
      },
    }) as unknown as VueJoueur;

  it('compte chaque partie une seule fois, suit la série et débloque les succès', async () => {
    const { enregistrerPartie, grade } = await import('../src/client/profil');
    const a = enregistrerPartie(vue('p1', 'enqueteur', 'enqueteurs', true));
    expect(a.compteeIci).toBe(true);
    expect(a.nouveaux.map((s) => s.id)).toEqual(expect.arrayContaining(['premiere', 'resolue', 'limier', 'eclair']));
    expect(enregistrerPartie(vue('p1', 'enqueteur', 'enqueteurs', true)).compteeIci).toBe(false);

    enregistrerPartie(vue('p2', 'complice', 'complice'));
    const c = enregistrerPartie(vue('p3', 'enqueteur', 'enqueteurs'));
    expect(c.profil).toMatchObject({ parties: 3, victoires: 3, serie: 3, complice: { parties: 1, victoires: 1 } });
    expect(c.nouveaux.map((s) => s.id)).toContain('serie3');
    expect(grade(c.profil.victoires).actuel.titre).toBe('Inspecteur');

    const d = enregistrerPartie(vue('p4', 'complice', 'enqueteurs'));
    expect(d.profil.serie).toBe(0);
    expect(d.profil.meilleureSerie).toBe(3);
  });
});
