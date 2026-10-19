import { describe, expect, it } from 'vitest';
import { avancer, cartesCorrespondantes, type EtatPartie } from '../src/engine/partie';
import { vuePour } from '../src/engine/vue';
import { INDICES_PAR_ID } from '../src/shared/data/indices';
import { indiceValide } from '../src/shared/logique';
import { categorieDe, elementsDuTriplet, type Triplet } from '../src/shared/types';
import { FALSIF_MS, Horloge, SOLUTION, act, actif, allerAuTourDe, autres, nouvellePartie, passerFalsification, tripletAvec } from './aide';

const RUSE = { modeComplice: 'ruse' as const };
const hyp = (t: Triplet, interroges: string[]) => ({ type: 'hypothese' as const, ...t, interroges });

/** Partie en mode rusé où le complice est le 1er joueur interrogé par le premier joueur actif. */
function scenario(n = 4, seed = 61) {
  const base = nouvellePartie(n, { seed, solution: SOLUTION, config: RUSE });
  const auteur = actif(base);
  const c = autres(base, auteur)[0];
  const etat = nouvellePartie(n, { seed, solution: SOLUTION, complice: c, config: RUSE });
  return { etat, auteur, c, h: new Horloge() };
}

/** Termine des tours jusqu'au début de la manche voulue. */
function allerALaManche(etat: EtatPartie, manche: number, h: Horloge) {
  while (etat.manche < manche && etat.etape !== 'terminee') {
    while (etat.hypothese) avancer(etat, h.avance(20_000));
    act(etat, actif(etat), { type: 'finTour' }, h.avance(1));
  }
}

describe('Mode « complice rusé » : réserve de ruses', () => {
  const attendu = { 3: 3, 4: 4, 5: 5, 6: 5 } as const;
  for (const n of [3, 4, 5, 6] as const) {
    it(`${n} joueurs : le complice a ${attendu[n]} ruses ; les enquêteurs ne voient aucun compteur`, () => {
      const etat = nouvellePartie(n, { seed: 3, config: RUSE });
      const vc = vuePour(etat, etat.complice);
      expect(vc.moi.rusesRestantes).toBe(attendu[n]);
      expect(vc.regles).toMatchObject({ modeComplice: 'ruse', ruses: attendu[n] });
      for (const id of autres(etat, etat.complice)) {
        const v = vuePour(etat, id);
        expect(v.moi.rusesRestantes).toBeUndefined();
        expect(v.moi.peutDenoncer).toBe(true);
        expect(v.compliceDemasque).toBeNull();
      }
    });
  }

  it('le Mensonge consomme une ruse', () => {
    const { etat, auteur, c, h } = scenario();
    act(etat, auteur, hyp(tripletAvec(etat, [etat.joueurs[c].main[0]]), autres(etat, auteur).slice(0, 2)), h.avance(1));
    passerFalsification(etat, h);
    expect(act(etat, c, { type: 'mentir' }, h.avance(1)).ok).toBe(true);
    expect(etat.joueurs[c].rusesRestantes).toBe(3);
  });

  it('une fois les ruses épuisées, plus aucun pouvoir n’est accepté', () => {
    const { etat, auteur, c, h } = scenario(3);
    etat.joueurs[c].rusesRestantes = 0;
    act(etat, auteur, hyp(tripletAvec(etat, [etat.joueurs[c].main[0]]), [c]), h.avance(1));
    expect(act(etat, c, { type: 'falsifier', champ: 'arme', valeur: 'poison' }, h.avance(1)).ok).toBe(false);
    passerFalsification(etat, h);
    expect(act(etat, c, { type: 'mentir' }, h.avance(1)).ok).toBe(false);
    expect(act(etat, c, { type: 'emprunter', carte: 'dague' }, h.avance(1)).ok).toBe(false);
    expect(vuePour(etat, c).hypotheseEnCours?.aRepondre).toMatchObject({ peutMentir: false, cartesEmpruntables: [] });
  });
});

describe('Ruse : la Carte empruntée', () => {
  it('le complice montre une carte qu’il n’a pas ; publiquement : « carte montrée »', () => {
    const { etat, auteur, c, h } = scenario(4, 62);
    // Hypothèse sans aucune carte du complice : sans ruse, il devrait répondre « aucune carte ».
    const autresCartes = autres(etat, c).flatMap((id) => etat.joueurs[id].main);
    const empruntee = autresCartes.find((x) => categorieDe(x) === 'lieu')!;
    const t = tripletAvec(etat, [empruntee]);
    expect(cartesCorrespondantes(etat, c, t)).toEqual([]);
    act(etat, auteur, hyp(t, autres(etat, auteur).slice(0, 2)), h.avance(1));
    passerFalsification(etat, h);
    const options = vuePour(etat, c).hypotheseEnCours!.aRepondre!.cartesEmpruntables;
    expect(options).toContain(empruntee);
    expect(options).not.toContain(SOLUTION.suspect); // jamais la carte du meurtrier
    expect(act(etat, c, { type: 'emprunter', carte: SOLUTION.suspect }, h.avance(1)).ok).toBe(false);
    const mainAvant = [...etat.joueurs[c].main];
    expect(act(etat, c, { type: 'emprunter', carte: empruntee }, h.avance(1)).ok).toBe(true);
    expect(etat.joueurs[c].main).toEqual(mainAvant);
    expect(etat.joueurs[c].rusesRestantes).toBe(4 - etat.config.coutRuses.emprunt); // la carte empruntée coûte 2 ruses
    // L'auteur voit la carte, comme une vraie ; les autres voient « carte montrée ».
    expect(vuePour(etat, auteur).moi.journal.at(-1)).toMatchObject({ type: 'carte_vue', de: c, carte: empruntee });
    expect(etat.historique.filter((e) => e.type === 'reponse').at(-1)).toMatchObject({ joueur: c, resultat: 'carte_montree' });
    for (const o of autres(etat, c)) expect(JSON.stringify(vuePour(etat, o).historique)).not.toMatch(/emprunt|ruse/);
  });

  it('un enquêteur ne peut jamais emprunter', () => {
    const { etat, auteur, c, h } = scenario(4, 63);
    const enq = autres(etat, auteur).find((x) => x !== c)!;
    act(etat, auteur, hyp(SOLUTION, [enq, c]), h.avance(1));
    passerFalsification(etat, h);
    expect(vuePour(etat, enq).hypotheseEnCours?.aRepondre?.cartesEmpruntables).toEqual([]);
    expect(act(etat, enq, { type: 'emprunter', carte: 'gabriel' }, h.avance(1)).ok).toBe(false);
  });
});

describe('Ruse : le Dossier trafiqué', () => {
  function trafic(seed = 64) {
    const { etat, c, h } = scenario(4, seed);
    for (const d of etat.affaire.archives) d.disponibleDesManche = 1;
    allerAuTourDe(etat, c, h);
    const dossier = etat.affaire.archives[0];
    return { etat, c, h, dossier };
  }

  it('le complice lit le vrai indice ; ceux qui lisent APRÈS lui lisent un faux indice', () => {
    const { etat, c, h, dossier } = trafic();
    const premierLecteur = autres(etat, c)[0];
    expect(act(etat, c, { type: 'consulterArchive', dossier: dossier.dossier, trafiquer: true }, h.avance(1)).ok).toBe(true);
    expect(etat.joueurs[c].rusesRestantes).toBe(3);
    expect(vuePour(etat, c).moi.indicesConsultes).toContainEqual({ dossier: dossier.dossier, indice: dossier.indice });
    const faux = etat.trafics![0].indiceFaux;
    expect(indiceValide(INDICES_PAR_ID[faux], etat.affaire.solution)).toBe(false); // le faux indice est bien faux
    const categorieDossier = INDICES_PAR_ID[dossier.indice].categorie;
    // Publiquement, la consultation est banale.
    expect(etat.historique.at(-1)).toMatchObject({ type: 'archive', joueur: c, categorie: categorieDossier });
    allerAuTourDe(etat, premierLecteur, h);
    act(etat, premierLecteur, { type: 'consulterArchive', dossier: dossier.dossier }, h.avance(1));
    const lu = vuePour(etat, premierLecteur).moi.indicesConsultes.find((x) => x.dossier === dossier.dossier)!;
    expect(lu.indice).toBe(faux);
    // Le lecteur voit la catégorie annoncée du dossier : rien ne trahit le trafic.
    expect(lu.categorie ?? INDICES_PAR_ID[lu.indice].categorie).toBe(categorieDossier);
    const vl = vuePour(etat, premierLecteur);
    expect(JSON.stringify([vl.historique, vl.moi])).not.toMatch(/trafi/);
  });

  it('impossible pour un enquêteur, sur une pièce à conviction, ou deux fois le même dossier', () => {
    const { etat, c, h, dossier } = trafic(65);
    const enq = autres(etat, c)[0];
    act(etat, c, { type: 'consulterArchive', dossier: dossier.dossier, trafiquer: true }, h.avance(1));
    const piece = etat.pieces![0];
    piece.disponibleDesManche = 1;
    expect(act(etat, c, { type: 'consulterArchive', dossier: piece.dossier, trafiquer: true }, h.avance(1)).ok).toBe(false);
    allerAuTourDe(etat, enq, h);
    expect(act(etat, enq, { type: 'consulterArchive', dossier: etat.affaire.archives[1].dossier, trafiquer: true }, h.avance(1)).ok).toBe(false);
    allerAuTourDe(etat, c, h);
    // Le complice a déjà consulté ce dossier ; un autre dossier déjà trafiqué n'existe pas : on vérifie le refus du double trafic.
    etat.trafics!.push({ dossier: etat.affaire.archives[2].dossier, par: enq, indiceFaux: 'IND-01', manche: 1 });
    expect(act(etat, c, { type: 'consulterArchive', dossier: etat.affaire.archives[2].dossier, trafiquer: true }, h.avance(1)).ok).toBe(false);
  });
});

describe('Empreintes', () => {
  it('une ruse laisse (souvent) une empreinte VRAIE et anonyme, publiée 1 à 2 manches plus tard', () => {
    for (let seed = 70; seed < 90; seed++) {
      const { etat, auteur, c, h } = scenario(5, seed);
      act(etat, auteur, hyp(tripletAvec(etat, [etat.joueurs[c].main[0]]), autres(etat, auteur).slice(0, 2)), h.avance(1));
      passerFalsification(etat, h);
      if (etat.hypothese?.interroges[0] !== c) continue;
      expect(act(etat, c, { type: 'mentir' }, h.avance(1)).ok).toBe(true);
      expect(etat.historique.some((e) => e.type === 'empreinte')).toBe(false); // jamais immédiatement
      allerALaManche(etat, 4, h);
      const empreintes = etat.historique.filter((e) => e.type === 'empreinte');
      if (empreintes.length === 0) continue; // toutes les ruses ne laissent pas d'empreinte
      expect(empreintes).toHaveLength(1);
      const e = empreintes[0] as Extract<(typeof empreintes)[number], { type: 'empreinte' }>;
      expect([2, 3]).toContain(e.manche);
      expect(e.innocente).not.toBe(c); // l'empreinte est vraie
      expect(etat.ordre).toContain(e.innocente);
      expect(Object.keys(e).sort()).toEqual(['innocente', 'manche', 't', 'type']); // aucune mention de la ruse utilisée
    }
  });

  it('pas d’empreinte en mode classique', () => {
    const etat = nouvellePartie(4, { seed: 5, solution: SOLUTION, config: { modeComplice: 'classique' } });
    expect(etat.joueurs[etat.complice].rusesRestantes).toBe(0);
    expect(vuePour(etat, etat.ordre[0]).moi.peutDenoncer).toBe(false);
  });
});

describe('Dénoncer le complice', () => {
  it('dénonciation juste : le complice est démasqué publiquement et perd ses ruses', () => {
    const { etat, auteur, c, h } = scenario(4, 66);
    expect(act(etat, auteur, { type: 'denoncer', joueur: c }, h.avance(1)).ok).toBe(true);
    expect(etat.pointsAction).toBe(1);
    expect(etat.joueurs[c].rusesRestantes).toBe(0);
    for (const id of etat.ordre) expect(vuePour(etat, id).compliceDemasque).toBe(c);
    expect(etat.historique.at(-1)).toMatchObject({ type: 'denonciation', joueur: auteur, cible: c, correcte: true });
    // Plus personne ne peut dénoncer, et le complice ne peut plus rien faire.
    expect(act(etat, auteur, { type: 'denoncer', joueur: c }, h.avance(1)).ok).toBe(false);
    const t = tripletAvec(etat, [etat.joueurs[c].main[0]]);
    act(etat, auteur, { type: 'finTour' }, h.avance(1));
    allerAuTourDe(etat, auteur, h);
    act(etat, auteur, hyp(t, autres(etat, auteur).slice(0, 2)), h.avance(1));
    expect(act(etat, c, { type: 'falsifier', champ: 'arme', valeur: 'poison' }, h.avance(1)).ok).toBe(false);
  });

  it('dénonciation fausse : le dénonciateur perd son prochain tour, et ne peut plus dénoncer', () => {
    const { etat, auteur, c, h } = scenario(4, 67);
    const innocent = autres(etat, auteur).find((x) => x !== c)!;
    expect(act(etat, auteur, { type: 'denoncer', joueur: innocent }, h.avance(1)).ok).toBe(true);
    expect(etat.historique.at(-1)).toMatchObject({ type: 'denonciation', correcte: false });
    expect(vuePour(etat, auteur).moi.peutDenoncer).toBe(false);
    expect(act(etat, auteur, { type: 'denoncer', joueur: c }, h.avance(1)).ok).toBe(false);
    // On fait le tour de table : le tour suivant de l'auteur est sauté.
    act(etat, auteur, { type: 'finTour' }, h.avance(1));
    for (let i = 0; i < etat.ordre.length - 1; i++) act(etat, actif(etat), { type: 'finTour' }, h.avance(1));
    expect(actif(etat)).not.toBe(auteur);
    expect(etat.historique.some((e) => e.type === 'fin_tour' && e.joueur === auteur && e.raison === 'tour_perdu')).toBe(true);
    expect(etat.compliceDemasque).toBeFalsy();
  });

  it('refusée hors de son tour, sur soi-même, ou en mode classique', () => {
    const { etat, auteur, c, h } = scenario(4, 68);
    expect(act(etat, c, { type: 'denoncer', joueur: auteur }, h.avance(1)).ok).toBe(false);
    expect(act(etat, auteur, { type: 'denoncer', joueur: auteur }, h.avance(1)).ok).toBe(false);
    const classique = nouvellePartie(4, { seed: 68, config: { modeComplice: 'classique' } });
    expect(act(classique, actif(classique), { type: 'denoncer', joueur: autres(classique, actif(classique))[0] }, h.avance(1)).ok).toBe(false);
  });
});

describe('Falsification en mode rusé', () => {
  it('consomme une ruse ; l’auteur n’est toujours pas prévenu', () => {
    const base = nouvellePartie(4, { seed: 69, solution: SOLUTION, config: RUSE });
    const auteur = actif(base);
    const c = autres(base, auteur)[1];
    const etat = nouvellePartie(4, { seed: 69, solution: SOLUTION, complice: c, config: RUSE });
    const h = new Horloge();
    act(etat, auteur, hyp(SOLUTION, autres(etat, auteur).slice(0, 2)), h.avance(1));
    expect(act(etat, c, { type: 'falsifier', champ: 'arme', valeur: 'poison' }, h.avance(1)).ok).toBe(true);
    expect(etat.joueurs[c].rusesRestantes).toBe(3);
    avancer(etat, h.avance(FALSIF_MS));
    expect(vuePour(etat, auteur).hypotheseEnCours?.triplet).toEqual(SOLUTION);
    expect(elementsDuTriplet(etat.hypotheses[0].publique)).toContain('poison');
  });
});
