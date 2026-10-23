// Mode « Grande enquête », étape 4 : l'objectif secret du complice et la fin de partie (docs/GRANDE-ENQUETE.md).
import { describe, expect, it } from 'vitest';
import { simulerPartie } from '../src/bots/simulation';
import { CONFIG_GRANDE_ENQUETE, type ConfigPartie } from '../src/engine/config';
import { avancer, type EtatPartie } from '../src/engine/partie';
import { elementsDe, type ObjectifComplice, type Triplet } from '../src/shared/types';
import { CONFIG_TEST, Horloge, act, actif, nouvellePartie, vuePour } from './aide';

const GRANDE: Partial<ConfigPartie> = { ...CONFIG_TEST, ...CONFIG_GRANDE_ENQUETE, modeComplice: 'ruse' };
const partie = (n: number, seed = 1) => nouvellePartie(n, { seed, config: GRANDE });

function allerAuTour(etat: EtatPartie, joueur: string, h: Horloge) {
  for (let garde = 0; garde < 50 && actif(etat) !== joueur; garde++) {
    const r = act(etat, actif(etat), { type: 'finTour' }, h.avance(1));
    if (!r.ok) throw new Error(r.erreur);
  }
}

/** Partie dont le complice a l'objectif voulu (le tirage reste celui du moteur pour le reste). */
function avecObjectif(n: number, type: ObjectifComplice, seed = 1) {
  const etat = partie(n, seed);
  const innocent = elementsDe('manoir').suspects.find((s) => s !== etat.affaire.solution.suspect)!;
  etat.objectif = type === 'bouc_emissaire' ? { type, suspect: innocent } : { type };
  return etat;
}

const enqueteurs = (etat: EtatPartie) => etat.ordre.filter((id) => id !== etat.complice);
const temoin = (etat: EtatPartie) => etat.ordre.find((id) => etat.joueurs[id].roleEnquete === 'temoin')!;

/** Un enquêteur trouve la solution. */
function resoudre(etat: EtatPartie, h: Horloge, qui = enqueteurs(etat)[0]) {
  allerAuTour(etat, qui, h);
  expect(act(etat, qui, { type: 'accuser', ...etat.affaire.solution }, h.avance(1)).ok).toBe(true);
}

describe("Tirage de l'objectif", () => {
  it('les trois objectifs sortent ; le bouc émissaire est toujours innocent ; seul le complice le voit', () => {
    const vus = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const etat = partie(4 + (seed % 3), seed);
      const o = etat.objectif!;
      vus.add(o.type);
      if (o.type === 'bouc_emissaire') {
        expect(o.suspect).toBeTruthy();
        expect(o.suspect).not.toBe(etat.affaire.solution.suspect);
      }
      for (const id of etat.ordre) {
        const v = vuePour(etat, id);
        if (id === etat.complice) expect(v.moi.objectif?.type).toBe(o.type);
        else {
          expect(v.moi.objectif).toBeUndefined();
          expect(JSON.stringify(v)).not.toContain(o.type);
        }
      }
    }
    expect(vus).toEqual(new Set(['temoin_genant', 'bouc_emissaire', 'ombre']));
  });

  it('les seuils dépendent de la table, et une partie classique n’a pas d’objectif', () => {
    expect(vuePour(avecObjectif(4, 'bouc_emissaire'), avecObjectif(4, 'bouc_emissaire').complice).moi.objectif?.accusations).toBe(1);
    const six = avecObjectif(6, 'bouc_emissaire');
    expect(vuePour(six, six.complice).moi.objectif?.accusations).toBe(1);
    const ombre = avecObjectif(5, 'ombre');
    expect(vuePour(ombre, ombre.complice).moi.objectif?.ruses).toBe(3);
    const classique = nouvellePartie(4, { seed: 1 });
    expect(classique.objectif).toBeUndefined();
    expect(vuePour(classique, classique.complice).moi.objectif).toBeUndefined();
  });
});

describe('Le témoin gênant', () => {
  it("après la bonne accusation, le complice a 30 secondes pour désigner le Témoin ; s'il le trouve, il vole la victoire", () => {
    const h = new Horloge();
    const etat = avecObjectif(4, 'temoin_genant');
    resoudre(etat, h);
    expect(etat.etape).toBe('designation');
    expect(etat.resultat).toBeUndefined();
    expect(etat.historique.at(-1)).toMatchObject({ type: 'derniere_chance' });
    expect(vuePour(etat, etat.ordre[0]).echeanceDesignation).toBe(etat.designation!.echeance);
    // Plus rien d'autre ne se joue ; seul le complice désigne.
    const autre = enqueteurs(etat)[1];
    expect(act(etat, actif(etat), { type: 'finTour' }, h.avance(1)).ok).toBe(false);
    expect(act(etat, autre, { type: 'designerTemoin', joueur: temoin(etat) }, h.avance(1)).ok).toBe(false);
    expect(act(etat, etat.complice, { type: 'designerTemoin', joueur: etat.complice }, h.avance(1)).ok).toBe(false);
    expect(act(etat, etat.complice, { type: 'designerTemoin', joueur: temoin(etat) }, h.avance(1)).ok).toBe(true);
    expect(etat.resultat).toMatchObject({ vainqueur: 'complice', raison: 'objectif_complice' });
    const r = vuePour(etat, autre).resultat!;
    expect(r.objectifComplice).toMatchObject({ type: 'temoin_genant', reussi: true, designe: temoin(etat) });
  });

  it("s'il se trompe, ou laisse passer le temps, l'enquête garde sa victoire", () => {
    const h = new Horloge();
    const etat = avecObjectif(4, 'temoin_genant');
    resoudre(etat, h);
    const pasTemoin = enqueteurs(etat).find((id) => id !== temoin(etat))!;
    expect(act(etat, etat.complice, { type: 'designerTemoin', joueur: pasTemoin }, h.avance(1)).ok).toBe(true);
    expect(etat.resultat).toMatchObject({ vainqueur: 'enqueteurs', raison: 'accusation_correcte' });
    expect(vuePour(etat, etat.complice).resultat!.objectifComplice).toMatchObject({ reussi: false, designe: pasTemoin });

    const etat2 = avecObjectif(4, 'temoin_genant');
    resoudre(etat2, h);
    avancer(etat2, etat2.designation!.echeance + 1);
    expect(etat2.resultat).toMatchObject({ vainqueur: 'enqueteurs' });
    expect(etat2.historique.some((e) => e.type === 'temoin_designe' && e.joueur === null)).toBe(true);
  });

  it('la dernière chance existe aussi contre le Maître chanteur', () => {
    const h = new Horloge();
    const etat = avecObjectif(5, 'temoin_genant');
    const mc = etat.ordre.find((id) => etat.joueurs[id].role === 'maitre_chanteur')!;
    resoudre(etat, h, mc);
    expect(etat.etape).toBe('designation');
    expect(act(etat, etat.complice, { type: 'designerTemoin', joueur: mc }, h.avance(1)).ok).toBe(true);
    expect(etat.resultat?.vainqueur).toBe('maitre_chanteur');
  });

  it("pas de dernière chance quand le complice a déjà gagné", () => {
    const h = new Horloge();
    const etat = avecObjectif(4, 'temoin_genant');
    const faux: Triplet = { ...etat.affaire.solution, mobile: etat.affaire.solution.mobile === 'manoir_dette' ? 'manoir_chantage' : 'manoir_dette' };
    for (const id of enqueteurs(etat)) {
      allerAuTour(etat, id, h);
      act(etat, id, { type: 'accuser', ...faux }, h.avance(1));
    }
    expect(etat.resultat).toMatchObject({ vainqueur: 'complice', raison: 'plus_d_accusateur' });
    expect(etat.designation).toBeUndefined();
  });
});

describe('Le bouc émissaire et l’ombre', () => {
  it("le bouc émissaire : assez d'accusations contre l'innocent visé font gagner le complice", () => {
    const h = new Horloge();
    const etat = avecObjectif(4, 'bouc_emissaire');
    const [a, b] = enqueteurs(etat);
    allerAuTour(etat, a, h);
    act(etat, a, { type: 'accuser', ...etat.affaire.solution, suspect: etat.objectif!.suspect! }, h.avance(1));
    resoudre(etat, h, b);
    expect(etat.resultat).toMatchObject({ vainqueur: 'complice', raison: 'objectif_complice' });
    expect(vuePour(etat, a).resultat!.objectifComplice).toMatchObject({ type: 'bouc_emissaire', reussi: true });

    const etat2 = avecObjectif(4, 'bouc_emissaire');
    resoudre(etat2, h);
    expect(etat2.resultat).toMatchObject({ vainqueur: 'enqueteurs' });
    expect(etat2.objectifReussi).toBe(false);
  });

  it("l'ombre : 3 ruses sans jamais être dénoncé font gagner le complice", () => {
    const h = new Horloge();
    const ruses = (etat: EtatPartie) => {
      etat.trafics = [1, 2, 3].map((dossier) => ({ dossier, par: etat.complice, indiceFaux: 'FAUX-01', manche: 1 }));
    };
    const etat = avecObjectif(4, 'ombre');
    ruses(etat);
    resoudre(etat, h);
    expect(etat.resultat).toMatchObject({ vainqueur: 'complice', raison: 'objectif_complice' });

    // Dénoncé une fois : l'objectif est raté.
    const etat2 = avecObjectif(4, 'ombre');
    ruses(etat2);
    const [a, b] = enqueteurs(etat2);
    allerAuTour(etat2, a, h);
    expect(act(etat2, a, { type: 'denoncer', joueur: etat2.complice }, h.avance(1)).ok).toBe(true);
    resoudre(etat2, h, b);
    expect(etat2.resultat).toMatchObject({ vainqueur: 'enqueteurs' });

    // Pas assez de ruses : raté aussi.
    const etat3 = avecObjectif(4, 'ombre');
    resoudre(etat3, h);
    expect(etat3.resultat).toMatchObject({ vainqueur: 'enqueteurs' });
  });
});

describe('Parties complètes entre bots, avec les objectifs', () => {
  it("se terminent sans action refusée ; l'objectif est révélé à la fin", () => {
    const raisons = new Set<string>();
    for (const n of [4, 5, 6]) {
      for (let seed = 1; seed <= 20; seed++) {
        const { etat, refus } = simulerPartie({ nbJoueurs: n, seed: seed * 17 + n, config: { ...CONFIG_GRANDE_ENQUETE, affaire: 'train' } });
        expect(etat.etape).toBe('terminee');
        expect(refus).toEqual([]);
        raisons.add(etat.resultat!.raison);
        const r = vuePour(etat, etat.ordre[0]).resultat!;
        expect(r.objectifComplice?.type).toBe(etat.objectif!.type);
      }
    }
    expect(raisons.has('objectif_complice')).toBe(true);
  });
});
