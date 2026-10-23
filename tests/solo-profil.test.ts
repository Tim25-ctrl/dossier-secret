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

  it('« Au hasard » : chaque partie tire une histoire au sort, le choix reste « au hasard »', () => {
    const g = new GestionnaireSalons();
    const tirees = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const { salon } = g.creerSolo(`Moi${i}`, 2, { affaire: 'aleatoire' });
      expect(salon.reglages.affaire).toBe('aleatoire');
      expect(['manoir', 'train', 'paquebot']).toContain(salon.partie!.config.affaire);
      tirees.add(salon.partie!.config.affaire);
    }
    expect(tirees.size).toBe(3);
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

  it('succès des histoires, de l’intuition, de la dernière manche et du complice qui a tout misé', async () => {
    const { enregistrerPartie, debloquerSucces, lireProfil } = await import('../src/client/profil');
    const partie = (id: string, affaire: string, plus: Record<string, unknown> = {}) => {
      const v = vue(id, 'enqueteur', 'enqueteurs', true) as unknown as Record<string, any>;
      return { ...v, affaire, regles: { manchesMax: 12, modeComplice: 'ruse' }, moi: { ...v.moi, journal: [] }, ...plus } as unknown as VueJoueur;
    };
    const ids = (r: { nouveaux: { id: string }[] }) => r.nouveaux.map((s) => s.id);
    expect(ids(enregistrerPartie(partie('m1', 'manoir')))).toEqual(expect.arrayContaining(['manoir', 'intuition']));
    expect(ids(enregistrerPartie(partie('t1', 'train')))).toContain('terminus');
    expect(ids(enregistrerPartie(partie('t2', 'train')))).not.toContain('grand_voyageur');
    // Accusation juste à la 12ᵉ manche, sur le paquebot : la troisième histoire.
    const derniere = partie('b1', 'paquebot');
    (derniere as any).resultat = { ...(derniere as any).resultat, manchesJouees: 12 };
    expect(ids(enregistrerPartie(derniere))).toEqual(expect.arrayContaining(['bon_port', 'grand_voyageur', 'in_extremis']));

    // Complice gagnant sans ruse restante : « Tapis ! », et « Double jeu ».
    const complice = vue('c1', 'complice', 'complice') as unknown as Record<string, any>;
    const v = { ...complice, affaire: 'train', regles: { manchesMax: 12, modeComplice: 'ruse' }, moi: { ...complice.moi, journal: [], rusesRestantes: 0 } };
    expect(ids(enregistrerPartie(v as unknown as VueJoueur))).toEqual(expect.arrayContaining(['tapis', 'double_jeu']));

    // La partie guidée débloque « Diplômé » une seule fois.
    expect(debloquerSucces('diplome')).toBe(true);
    expect(debloquerSucces('diplome')).toBe(false);
    expect(lireProfil().succes.diplome).toBeTruthy();
  });
});
