import { describe, expect, it } from 'vitest';
import { avancer, cartesCorrespondantes, definirConnexion, type EtatPartie } from '../src/engine/partie';
import { vuePour } from '../src/engine/vue';
import { categorieDe, elementsDuTriplet, type ElementId, type Triplet } from '../src/shared/types';
import {
  FALSIF_MS,
  Horloge,
  SOLUTION,
  T0,
  act,
  actif,
  allerAuTourDe,
  autres,
  nouvellePartie,
  passerFalsification,
  tripletAvec,
} from './aide';

/** Hypothèse « neutre » : la solution elle-même (personne ne détient de carte correspondante). */
const hyp = (t: Triplet, interroges: string[]) => ({ type: 'hypothese' as const, ...t, interroges });

function complice(etat: EtatPartie) {
  return etat.complice;
}
function enqueteurs(etat: EtatPartie) {
  return etat.ordre.filter((id) => id !== etat.complice);
}

describe('Attribution des rôles', () => {
  for (const n of [3, 4, 5, 6]) {
    it(`${n} joueurs : exactement un complice, qui connaît le meurtrier et rien d'autre`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const etat = nouvellePartie(n, { seed });
        const complices = Object.values(etat.joueurs).filter((j) => j.role === 'complice');
        expect(complices).toHaveLength(1);
        const vueC = vuePour(etat, etat.complice);
        expect(vueC.moi.role).toBe('complice');
        expect(vueC.moi.meurtrier).toBe(etat.affaire.solution.suspect);
        expect(vueC.moi.mensongesRestants).toBe(2);
        expect(vueC.moi.falsificationsRestantes).toBe(1);
        // Le complice ne reçoit ni le lieu ni l'arme.
        const json = JSON.stringify({ ...vueC, historique: [], indicesPublics: [] });
        expect(json).not.toContain('"solution"');
        expect(json).not.toMatch(/"lieu":"[a-z_]+","arme"/);
        for (const id of enqueteurs(etat)) {
          const v = vuePour(etat, id);
          expect(v.moi.role).toBe('enqueteur');
          expect(v.moi.meurtrier).toBeUndefined();
          expect(v.moi.mensongesRestants).toBeUndefined();
          expect(v.moi.falsificationsRestantes).toBeUndefined();
          expect(JSON.stringify(v)).not.toContain('complice"');
        }
      }
    });
  }

  it('le complice est tiré au hasard (tous les sièges peuvent être complices)', () => {
    const vus = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) vus.add(nouvellePartie(4, { seed }).complice);
    expect(vus.size).toBe(4);
  });

  it('aucune vue ne contient les cartes des autres joueurs', () => {
    const etat = nouvellePartie(6, { seed: 3 });
    for (const id of etat.ordre) {
      const v = vuePour(etat, id);
      const autresCartes = autres(etat, id).flatMap((o) => etat.joueurs[o].main);
      expect(v.moi.main).toEqual(etat.joueurs[id].main);
      expect(JSON.stringify(v.moi)).not.toMatch(new RegExp(autresCartes.map((c) => `"${c}"`).join('|')));
      for (const j of v.joueurs) expect(Object.keys(j).sort()).toEqual(['bot', 'connecte', 'id', 'nbCartes', 'nom', 'peutAccuser']);
    }
  });

  it('la vue reste identique après un « rafraîchissement » (nouvel appel)', () => {
    const etat = nouvellePartie(4, { seed: 9 });
    for (const id of etat.ordre) expect(vuePour(etat, id)).toEqual(vuePour(etat, id));
  });
});

describe('Tours et points d\'action', () => {
  it('refuse toute action hors de son tour', () => {
    const etat = nouvellePartie(4);
    const h = new Horloge();
    const pasActif = autres(etat, actif(etat))[0];
    const cibles = autres(etat, pasActif).slice(0, 2);
    expect(act(etat, pasActif, hyp(SOLUTION, cibles), h.avance(1))).toMatchObject({ ok: false, erreur: "Ce n'est pas votre tour." });
    expect(act(etat, pasActif, { type: 'consulterArchive', dossier: 1 }, h.t).ok).toBe(false);
    expect(act(etat, pasActif, { type: 'accuser', ...SOLUTION }, h.t).ok).toBe(false);
    expect(act(etat, pasActif, { type: 'finTour' }, h.t).ok).toBe(false);
  });

  it('2 points d\'action par tour, une consultation coûte 1 PA, impossible de dépasser', () => {
    const etat = nouvellePartie(3);
    const h = new Horloge();
    const a = actif(etat);
    // On rend tous les dossiers consultables pour ce test.
    for (const d of etat.affaire.archives) d.disponibleDesManche = 1;
    expect(etat.pointsAction).toBe(2);
    expect(act(etat, a, { type: 'consulterArchive', dossier: 1 }, h.avance(1)).ok).toBe(true);
    expect(etat.pointsAction).toBe(1);
    expect(act(etat, a, { type: 'consulterArchive', dossier: 1 }, h.avance(1))).toMatchObject({ ok: false, erreur: 'Vous avez déjà consulté ce dossier.' });
    expect(act(etat, a, { type: 'consulterArchive', dossier: 2 }, h.avance(1)).ok).toBe(true);
    expect(etat.pointsAction).toBe(0);
    expect(act(etat, a, { type: 'consulterArchive', dossier: 3 }, h.avance(1)).ok).toBe(false);
    expect(etat.pointsAction).toBe(0);
  });

  it('des requêtes « simultanées » ne consomment pas deux fois les mêmes points', () => {
    const etat = nouvellePartie(4);
    const a = actif(etat);
    const cibles = autres(etat, a).slice(0, 2);
    const t = T0 + 5;
    const r1 = act(etat, a, hyp(SOLUTION, cibles), t);
    const r2 = act(etat, a, hyp(SOLUTION, cibles), t);
    const r3 = act(etat, a, { type: 'consulterArchive', dossier: 1 }, t);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(false);
    expect(r3.ok).toBe(false);
    expect(etat.pointsAction).toBe(1);
    expect(etat.hypotheses).toHaveLength(1);
  });

  it('le dossier d\'archive n\'est consultable qu\'à partir de sa manche d\'ouverture', () => {
    const etat = nouvellePartie(3);
    const ferme = etat.affaire.archives.find((d) => d.disponibleDesManche > 1)!;
    expect(act(etat, actif(etat), { type: 'consulterArchive', dossier: ferme.dossier }, T0 + 1).ok).toBe(false);
    expect(act(etat, actif(etat), { type: 'consulterArchive', dossier: 99 }, T0 + 1).ok).toBe(false);
  });

  it('la consultation n\'est visible que par son auteur (le public ne voit que la catégorie)', () => {
    const etat = nouvellePartie(3);
    const a = actif(etat);
    act(etat, a, { type: 'consulterArchive', dossier: 1 }, T0 + 1);
    const indice = etat.affaire.archives[0].indice;
    expect(vuePour(etat, a).moi.indicesConsultes).toEqual([{ dossier: 1, indice }]);
    for (const o of autres(etat, a)) expect(JSON.stringify(vuePour(etat, o))).not.toContain(indice);
  });

  it('les manches avancent, les PA sont remis à 2, et la partie s\'arrête après la 12e manche', () => {
    const etat = nouvellePartie(3);
    const h = new Horloge();
    for (let m = 1; m <= 12; m++) {
      expect(etat.manche).toBe(m);
      for (let i = 0; i < 3; i++) {
        expect(etat.pointsAction).toBe(2);
        expect(act(etat, actif(etat), { type: 'finTour' }, h.avance(1)).ok).toBe(true);
      }
    }
    expect(etat.etape).toBe('terminee');
    expect(etat.resultat).toMatchObject({ vainqueur: 'complice', raison: 'manches_ecoulees' });
  });

  it('un tour non terminé expire automatiquement (aucun blocage)', () => {
    const etat = nouvellePartie(3);
    const premier = actif(etat);
    avancer(etat, T0 + 60_001);
    expect(actif(etat)).not.toBe(premier);
    expect(etat.historique.some((e) => e.type === 'fin_tour' && e.raison === 'temps_ecoule')).toBe(true);
  });

  it('un joueur actif déconnecté voit son tour raccourci', () => {
    const etat = nouvellePartie(3);
    const premier = actif(etat);
    definirConnexion(etat, premier, false, T0 + 10);
    avancer(etat, T0 + 10 + 5_001);
    expect(actif(etat)).not.toBe(premier);
  });

  it('un joueur qui revient (page rechargée) récupère un délai de tour raisonnable', () => {
    const etat = nouvellePartie(3);
    const premier = actif(etat);
    definirConnexion(etat, premier, false, T0 + 10);
    definirConnexion(etat, premier, true, T0 + 20);
    avancer(etat, T0 + 10 + 5_001); // l'ancien délai « déconnecté » ne s'applique plus
    expect(actif(etat)).toBe(premier);
    expect(etat.echeanceTour).toBeGreaterThanOrEqual(T0 + 20 + 20_000);
  });

  it('les indices publics différés sont publiés aux manches prévues', () => {
    const etat = nouvellePartie(3);
    const h = new Horloge();
    const { nbIndicesPublicsDepart, manchesIndicesPublics } = etat.config;
    expect(etat.indicesPublics).toHaveLength(nbIndicesPublicsDepart);
    manchesIndicesPublics.forEach((manche, i) => {
      while (etat.manche < manche - 1) act(etat, actif(etat), { type: 'finTour' }, h.avance(1));
      expect(etat.indicesPublics).toHaveLength(nbIndicesPublicsDepart + i);
      while (etat.manche < manche) act(etat, actif(etat), { type: 'finTour' }, h.avance(1));
      expect(etat.indicesPublics).toHaveLength(nbIndicesPublicsDepart + i + 1);
      expect(etat.historique.at(-2)).toMatchObject({ type: 'indice_public', manche });
    });
  });
});

describe('Hypothèses : validation', () => {
  const nb = { 3: 1, 4: 2, 5: 2, 6: 3 } as const;
  for (const n of [3, 4, 5, 6] as const) {
    it(`${n} joueurs : exactement ${nb[n]} joueur(s) interrogé(s)`, () => {
      const etat = nouvellePartie(n);
      const a = actif(etat);
      const others = autres(etat, a);
      expect(vuePour(etat, a).regles.nbInterroges).toBe(nb[n]);
      expect(act(etat, a, hyp(SOLUTION, others.slice(0, nb[n] + 1)), T0 + 1).ok).toBe(false);
      if (nb[n] > 1) expect(act(etat, a, hyp(SOLUTION, others.slice(0, nb[n] - 1)), T0 + 1).ok).toBe(false);
      expect(act(etat, a, hyp(SOLUTION, others.slice(0, nb[n])), T0 + 1).ok).toBe(true);
    });
  }

  it('refuse doublons, auto-interrogation, joueurs inconnus et éléments invalides', () => {
    const etat = nouvellePartie(4);
    const a = actif(etat);
    const [b] = autres(etat, a);
    expect(act(etat, a, hyp(SOLUTION, [b, b]), T0 + 1).ok).toBe(false);
    expect(act(etat, a, hyp(SOLUTION, [a, b]), T0 + 1).ok).toBe(false);
    expect(act(etat, a, hyp(SOLUTION, [b, 'intrus']), T0 + 1).ok).toBe(false);
    expect(act(etat, a, { type: 'hypothese', suspect: 'cave' as never, lieu: 'cave', arme: 'dague', interroges: autres(etat, a).slice(0, 2) }, T0 + 1).ok).toBe(false);
    expect(etat.pointsAction).toBe(2);
  });

  it('l\'hypothèse n\'est pas diffusée avant la fin de l\'étape de falsification', () => {
    const etat = nouvellePartie(4);
    const a = actif(etat);
    act(etat, a, hyp(SOLUTION, autres(etat, a).slice(0, 2)), T0 + 1);
    expect(etat.historique.some((e) => e.type === 'hypothese')).toBe(false);
    for (const o of autres(etat, a)) expect(vuePour(etat, o).hypotheseEnCours?.triplet).toBeUndefined();
    avancer(etat, T0 + 1 + FALSIF_MS);
    expect(etat.historique.some((e) => e.type === 'hypothese')).toBe(true);
  });

  it('l\'étape de falsification a la même durée que le complice ait encore son pouvoir ou non', () => {
    const e1 = nouvellePartie(4, { seed: 5 });
    const e2 = nouvellePartie(4, { seed: 5 });
    e2.joueurs[e2.complice].falsificationsRestantes = 0;
    for (const e of [e1, e2]) act(e, actif(e), hyp(SOLUTION, autres(e, actif(e)).slice(0, 2)), T0 + 1);
    expect(e1.hypothese!.echeance).toBe(e2.hypothese!.echeance);
  });
});

/** Prépare une partie où l'auteur interroge des joueurs précis avec une hypothèse construite. */
function preparer(n: number, seed: number, opts: { complice?: string } = {}) {
  const etat = nouvellePartie(n, { seed, solution: SOLUTION, complice: opts.complice });
  const h = new Horloge();
  return { etat, h };
}

describe('Interrogation : une seule carte révélée', () => {
  it("l'ordre choisi est respecté et seul le premier joueur possédant une carte la montre", () => {
    const { etat, h } = preparer(6, 11);
    const auteur = actif(etat);
    const [b, c, d] = autres(etat, auteur);
    // Hypothèse contenant une carte de c et une carte de d ; b n'a rien.
    const t = tripletAvec(etat, [etat.joueurs[c].main[0], etat.joueurs[d].main.find((x) => x !== etat.joueurs[c].main[0])!]);
    // Garantit que b n'a aucune carte correspondante (sinon on change b de place).
    const ordre = [b, c, d].sort((x, y) => cartesCorrespondantes(etat, x, t).length - cartesCorrespondantes(etat, y, t).length);
    const premierSans = ordre[0];
    expect(cartesCorrespondantes(etat, premierSans, t)).toHaveLength(0);
    const [, avec1, avec2] = ordre;
    expect(act(etat, auteur, hyp(t, [premierSans, avec1, avec2]), h.avance(1)).ok).toBe(true);
    passerFalsification(etat, h);

    // Seul le répondant actuel peut répondre.
    expect(act(etat, avec1, { type: 'repondre', carte: cartesCorrespondantes(etat, avec1, t)[0] }, h.avance(1)).ok).toBe(false);
    // Impossible de prétendre n'avoir aucune carte quand on en a une (et réciproquement).
    expect(act(etat, premierSans, { type: 'repondre', carte: etat.joueurs[premierSans].main[0] }, h.avance(1)).ok).toBe(false);
    expect(act(etat, premierSans, { type: 'repondre', carte: null }, h.avance(1)).ok).toBe(true);
    expect(act(etat, avec1, { type: 'repondre', carte: null }, h.avance(1))).toMatchObject({ ok: false });
    // Il ne peut pas montrer une carte qui n'est pas à lui.
    expect(act(etat, avec1, { type: 'repondre', carte: cartesCorrespondantes(etat, avec2, t)[0] }, h.avance(1)).ok).toBe(
      cartesCorrespondantes(etat, avec1, t).includes(cartesCorrespondantes(etat, avec2, t)[0]),
    );
    if (etat.hypothese) {
      const carte = cartesCorrespondantes(etat, avec1, t)[0];
      expect(act(etat, avec1, { type: 'repondre', carte }, h.avance(1)).ok).toBe(true);
    }
    // L'hypothèse est close : le troisième joueur n'a rien eu à révéler.
    expect(etat.hypothese).toBeUndefined();
    const hyps = etat.hypotheses[0];
    expect(hyps.reponses.filter((r) => r.resultat === 'carte_montree')).toHaveLength(1);
    expect(hyps.reponses.map((r) => r.joueur)).toEqual([premierSans, avec1]);
    expect(act(etat, avec2, { type: 'repondre', carte: null }, h.avance(1)).ok).toBe(false);
  });

  it("l'auteur seul voit la carte ; les autres voient seulement qui l'a montrée", () => {
    const { etat, h } = preparer(4, 12);
    const auteur = actif(etat);
    const [b, c] = autres(etat, auteur);
    const carte = etat.joueurs[b].main[0];
    const t = tripletAvec(etat, [carte]);
    act(etat, auteur, hyp(t, [b, c]), h.avance(1));
    passerFalsification(etat, h);
    // b est complice ? Il pourrait mentir, on répond honnêtement de toute façon.
    expect(act(etat, b, { type: 'repondre', carte }, h.avance(1)).ok).toBe(true);
    const vueAuteur = vuePour(etat, auteur);
    expect(vueAuteur.moi.journal).toContainEqual(expect.objectContaining({ type: 'carte_vue', de: b, carte }));
    const finH = etat.historique.find((e) => e.type === 'fin_hypothese');
    expect(finH).toMatchObject({ montreePar: b });
    for (const o of autres(etat, auteur).filter((x) => x !== b)) {
      const v = vuePour(etat, o);
      expect(v.moi.journal.some((e) => e.type === 'carte_vue')).toBe(false);
      // La carte montrée n'apparaît nulle part dans la vue d'un tiers (sauf s'il la détient ou si elle est publique).
      if (!etat.joueurs[o].main.includes(carte) && !etat.cartesPubliques.includes(carte))
        expect(JSON.stringify(v.historique)).not.toContain(`"${carte}"`.replace(/^/, '"carte":'));
      expect(JSON.stringify(v.moi.journal)).not.toContain(`"carte":"${carte}"`);
    }
  });

  it('si personne n\'a de carte correspondante, aucune carte n\'est révélée', () => {
    const { etat, h } = preparer(6, 13);
    const auteur = actif(etat);
    const cibles = autres(etat, auteur).slice(0, 3);
    act(etat, auteur, hyp(SOLUTION, cibles), h.avance(1)); // la solution n'est détenue par personne
    passerFalsification(etat, h);
    for (const c of cibles) {
      expect(vuePour(etat, c).hypotheseEnCours?.aRepondre).toEqual({ cartesCorrespondantes: [], peutMentir: false });
      expect(act(etat, c, { type: 'repondre', carte: null }, h.avance(1)).ok).toBe(true);
    }
    expect(etat.hypothese).toBeUndefined();
    expect(etat.hypotheses[0].carteMontree).toBeUndefined();
    expect(vuePour(etat, auteur).moi.journal.at(-1)).toMatchObject({ type: 'aucune_carte_vue' });
  });

  it('une réponse non donnée à temps est automatique et honnête', () => {
    const { etat, h } = preparer(3, 14);
    const auteur = actif(etat);
    const [b] = autres(etat, auteur);
    const carte = etat.joueurs[b].main[0];
    act(etat, auteur, hyp(tripletAvec(etat, [carte]), [b]), h.avance(1));
    passerFalsification(etat, h);
    avancer(etat, h.avance(10_001));
    expect(etat.hypotheses[0].carteMontree).toEqual({ par: b, carte });
    expect(etat.hypotheses[0].reponses[0]).toMatchObject({ auto: true, resultat: 'carte_montree' });
  });
});

describe('Pouvoir du complice : le Mensonge', () => {
  /** Partie où le complice (c) est interrogé en premier avec une hypothèse qui correspond à sa main. */
  function scenario(seed = 21, n = 4) {
    const base = nouvellePartie(n, { seed, solution: SOLUTION });
    const auteur = actif(base);
    const c = autres(base, auteur)[0];
    const etat = nouvellePartie(n, { seed, solution: SOLUTION, complice: c });
    expect(actif(etat)).toBe(auteur);
    return { etat, auteur, c, h: new Horloge() };
  }

  it('le complice peut cacher sa carte ; l\'interrogation continue avec le suivant', () => {
    const { etat, auteur, c, h } = scenario();
    const suivant = autres(etat, auteur).find((x) => x !== c)!;
    // Une carte du complice et une carte du suivant, de catégories différentes.
    const carteC = etat.joueurs[c].main[0];
    const carteS = etat.joueurs[suivant].main.find((x) => categorieDe(x) !== categorieDe(carteC))!;
    expect(carteS).toBeDefined();
    const t = tripletAvec(etat, [carteC, carteS]);
    act(etat, auteur, hyp(t, [c, suivant]), h.avance(1));
    passerFalsification(etat, h);
    const v = vuePour(etat, c);
    expect(v.hypotheseEnCours?.aRepondre?.peutMentir).toBe(true);
    const mainAvant = [...etat.joueurs[c].main];
    expect(act(etat, c, { type: 'mentir' }, h.avance(1)).ok).toBe(true);
    expect(etat.joueurs[c].mensongesRestants).toBe(1);
    expect(etat.joueurs[c].main).toEqual(mainAvant); // cartes réelles inchangées
    expect(etat.affaire.solution).toEqual(SOLUTION); // solution inchangée
    // Publiquement : « aucune carte », exactement comme un joueur honnête sans carte.
    const rep = etat.historique.filter((e) => e.type === 'reponse');
    expect(rep.at(-1)).toMatchObject({ joueur: c, resultat: 'aucune_carte', auto: false });
    for (const o of autres(etat, c)) expect(JSON.stringify(vuePour(etat, o))).not.toContain('mensonge');
    // L'interrogation passe au suivant, qui peut révéler normalement.
    expect(vuePour(etat, suivant).hypotheseEnCours?.repondantActuel).toBe(suivant);
  });

  it('impossible sans carte correspondante, et refusé pour un enquêteur', () => {
    const { etat, auteur, c, h } = scenario(22);
    act(etat, auteur, hyp(SOLUTION, autres(etat, auteur).slice(0, 2)), h.avance(1));
    passerFalsification(etat, h);
    const premier = etat.hypothese!.interroges[0];
    expect(premier).toBe(c);
    expect(vuePour(etat, c).hypotheseEnCours?.aRepondre?.peutMentir).toBe(false);
    expect(act(etat, c, { type: 'mentir' }, h.avance(1)).ok).toBe(false);
    expect(etat.joueurs[c].mensongesRestants).toBe(2);
    act(etat, c, { type: 'repondre', carte: null }, h.avance(1));
    const enq = etat.hypothese!.interroges[1];
    expect(act(etat, enq, { type: 'mentir' }, h.avance(1)).ok).toBe(false);
  });

  it('deux utilisations au maximum, une seule consommée par hypothèse', () => {
    const { etat, auteur, c, h } = scenario(23, 3);
    const carteC = etat.joueurs[c].main[0];
    for (let i = 0; i < 3; i++) {
      allerAuTourDe(etat, auteur, h);
      const t = tripletAvec(etat, etat.joueurs[c].main.slice(0, 1).concat(etat.joueurs[c].main.filter((x) => x !== carteC).slice(0, 0)));
      expect(act(etat, auteur, hyp(t, [c]), h.avance(1)).ok).toBe(true);
      passerFalsification(etat, h);
      const r = act(etat, c, { type: 'mentir' }, h.avance(1));
      if (i < 2) {
        expect(r.ok).toBe(true);
        expect(etat.joueurs[c].mensongesRestants).toBe(1 - i);
      } else {
        expect(r.ok).toBe(false);
        expect(act(etat, c, { type: 'repondre', carte: carteC }, h.avance(1)).ok).toBe(true);
      }
      act(etat, auteur, { type: 'finTour' }, h.avance(1));
    }
    expect(etat.joueurs[c].mensongesRestants).toBe(0);
    expect(etat.hypotheses.flatMap((x) => x.reponses).filter((r) => r.resultat === 'mensonge')).toHaveLength(2);
  });

  it('la réponse automatique (délai dépassé) ne ment jamais', () => {
    const { etat, auteur, c, h } = scenario(24, 3);
    const carteC = etat.joueurs[c].main[0];
    act(etat, auteur, hyp(tripletAvec(etat, [carteC]), [c]), h.avance(1));
    passerFalsification(etat, h);
    avancer(etat, h.avance(10_001));
    expect(etat.hypotheses[0].carteMontree?.par).toBe(c);
    expect(etat.joueurs[c].mensongesRestants).toBe(2);
  });
});

describe('Pouvoir du complice : l\'Hypothèse falsifiée', () => {
  function scenario(seed = 31, n = 4) {
    const base = nouvellePartie(n, { seed, solution: SOLUTION });
    const auteur = actif(base);
    const c = autres(base, auteur)[1];
    const etat = nouvellePartie(n, { seed, solution: SOLUTION, complice: c });
    return { etat, auteur, c, h: new Horloge() };
  }

  it('modifie exactement un élément ; l\'auteur voit l\'original, les autres la version publique', () => {
    const { etat, auteur, c, h } = scenario();
    const original: Triplet = { suspect: 'eleonore', lieu: 'serre', arme: 'poison' };
    act(etat, auteur, hyp(original, autres(etat, auteur).slice(0, 2)), h.avance(1));
    expect(vuePour(etat, c).hypotheseEnCours?.falsification).toEqual({ original, decide: false });
    for (const o of autres(etat, c)) expect(vuePour(etat, o).hypotheseEnCours?.falsification).toBeUndefined();
    expect(act(etat, c, { type: 'falsifier', champ: 'lieu', valeur: 'cave' }, h.avance(1)).ok).toBe(true);
    expect(etat.joueurs[c].falsificationsRestantes).toBe(0);
    passerFalsification(etat, h);
    const publique = { ...original, lieu: 'cave' };
    const ev = etat.historique.find((e) => e.type === 'hypothese')!;
    expect(ev).toMatchObject({ triplet: publique });
    expect(etat.hypotheses[0].original).toEqual(original);
    // Auteur : version originale + avertissement privé.
    const vA = vuePour(etat, auteur);
    expect(vA.historique.find((e) => e.type === 'hypothese')).toMatchObject({ triplet: original });
    expect(vA.mesHypothesesFalsifiees).toEqual({ H1: publique });
    expect(vA.hypotheseEnCours?.triplet).toEqual(original);
    // Autres joueurs : version publique, aucune trace de l'original.
    for (const o of autres(etat, auteur)) {
      const v = vuePour(etat, o);
      expect(v.historique.find((e) => e.type === 'hypothese')).toMatchObject({ triplet: publique });
      expect(v.mesHypothesesFalsifiees).toEqual({});
      // (le répondant peut voir « serre » parmi SES cartes correspondantes : elles sont calculées sur l'original)
      if (o !== c) expect(JSON.stringify([v.historique, v.hypotheseEnCours?.triplet])).not.toContain('"serre"');
    }
    expect(etat.affaire.solution).toEqual(SOLUTION);
  });

  it('les réponses sont calculées sur la version ORIGINALE', () => {
    const { etat, auteur, c, h } = scenario(32);
    const premier = autres(etat, auteur).find((x) => x !== c)!;
    const carte = etat.joueurs[premier].main[0];
    const original = tripletAvec(etat, [carte]);
    const cat = (['suspect', 'lieu', 'arme'] as const).find((k) => original[k] === carte)!;
    act(etat, auteur, hyp(original, [premier, c]), h.avance(1));
    // Le complice remplace la carte détenue par un autre élément : la version publique ne la contient plus.
    const remplacement = (cat === 'suspect' ? 'gabriel' : cat === 'lieu' ? 'bureau' : 'poison') as ElementId;
    const valeur = remplacement === carte ? ((cat === 'suspect' ? 'camille' : cat === 'lieu' ? 'serre' : 'revolver') as ElementId) : remplacement;
    expect(act(etat, c, { type: 'falsifier', champ: cat, valeur }, h.avance(1)).ok).toBe(true);
    passerFalsification(etat, h);
    expect(elementsDuTriplet(etat.hypotheses[0].publique)).not.toContain(carte);
    // Le premier interrogé doit tout de même montrer sa carte, qui correspond à l'original.
    expect(vuePour(etat, premier).hypotheseEnCours?.aRepondre?.cartesCorrespondantes).toContain(carte);
    expect(act(etat, premier, { type: 'repondre', carte: null }, h.avance(1)).ok).toBe(false);
    expect(act(etat, premier, { type: 'repondre', carte }, h.avance(1)).ok).toBe(true);
  });

  it('une seule utilisation, un seul élément, valeur valide et différente', () => {
    const { etat, auteur, c, h } = scenario(33);
    act(etat, auteur, hyp(SOLUTION, autres(etat, auteur).slice(0, 2)), h.avance(1));
    expect(act(etat, c, { type: 'falsifier', champ: 'lieu', valeur: 'dague' }, h.avance(1)).ok).toBe(false); // mauvaise catégorie
    expect(act(etat, c, { type: 'falsifier', champ: 'lieu', valeur: SOLUTION.lieu }, h.avance(1)).ok).toBe(false); // identique
    expect(act(etat, c, { type: 'falsifier', champ: 'heure' as never, valeur: 'cave' }, h.avance(1)).ok).toBe(false);
    expect(etat.joueurs[c].falsificationsRestantes).toBe(1);
    expect(act(etat, c, { type: 'falsifier', champ: 'arme', valeur: 'poison' }, h.avance(1)).ok).toBe(true);
    // Deuxième tentative sur la même hypothèse ou une suivante : refusée.
    expect(act(etat, c, { type: 'falsifier', champ: 'suspect', valeur: 'gabriel' }, h.avance(1)).ok).toBe(false);
    passerFalsification(etat, h);
    const pub = etat.hypotheses[0].publique;
    const diff = (['suspect', 'lieu', 'arme'] as const).filter((k) => pub[k] !== SOLUTION[k]);
    expect(diff).toEqual(['arme']);
    // Terminer l'interrogation puis tenter sur une nouvelle hypothèse.
    while (etat.hypothese) avancer(etat, h.avance(10_001));
    act(etat, auteur, { type: 'finTour' }, h.avance(1));
    allerAuTourDe(etat, auteur, h);
    act(etat, auteur, hyp(SOLUTION, autres(etat, auteur).slice(0, 2)), h.avance(1));
    expect(vuePour(etat, c).hypotheseEnCours?.falsification).toBeUndefined();
    expect(act(etat, c, { type: 'falsifier', champ: 'arme', valeur: 'poison' }, h.avance(1)).ok).toBe(false);
  });

  it('le complice ne peut pas falsifier sa propre hypothèse', () => {
    const base = nouvellePartie(4, { seed: 34, solution: SOLUTION });
    const auteur = actif(base);
    const etat = nouvellePartie(4, { seed: 34, solution: SOLUTION, complice: auteur });
    act(etat, auteur, hyp(SOLUTION, autres(etat, auteur).slice(0, 2)), T0 + 1);
    expect(vuePour(etat, auteur).hypotheseEnCours?.falsification).toBeUndefined();
    expect(act(etat, auteur, { type: 'falsifier', champ: 'arme', valeur: 'poison' }, T0 + 2).ok).toBe(false);
  });

  it('un enquêteur ne peut pas falsifier', () => {
    const { etat, auteur, c, h } = scenario(35);
    act(etat, auteur, hyp(SOLUTION, autres(etat, auteur).slice(0, 2)), h.avance(1));
    const enq = autres(etat, auteur).find((x) => x !== c)!;
    expect(act(etat, enq, { type: 'falsifier', champ: 'arme', valeur: 'poison' }, h.avance(1)).ok).toBe(false);
    expect(act(etat, enq, { type: 'passerFalsification' }, h.avance(1)).ok).toBe(false);
  });

  it('ne s\'applique jamais à une accusation finale', () => {
    const { etat, auteur, c, h } = scenario(36);
    const mauvaise = { suspect: 'gabriel', lieu: 'bureau', arme: 'poison' } as const;
    expect(act(etat, auteur, { type: 'accuser', ...mauvaise }, h.avance(1)).ok).toBe(true);
    expect(act(etat, c, { type: 'falsifier', champ: 'suspect', valeur: 'victor' }, h.avance(1)).ok).toBe(false);
    expect(etat.accusations[0]).toMatchObject({ triplet: mauvaise, correcte: false });
  });

  it('la falsification ne bloque pas la partie si le complice ne répond pas', () => {
    const { etat, auteur, h } = scenario(37);
    act(etat, auteur, hyp(SOLUTION, autres(etat, auteur).slice(0, 2)), h.avance(1));
    passerFalsification(etat, h);
    expect(etat.hypothese?.etape).toBe('interrogation');
  });
});

describe('Accusations et victoire', () => {
  it('une accusation correcte fait gagner les enquêteurs immédiatement', () => {
    const etat = nouvellePartie(4, { solution: SOLUTION });
    const a = actif(etat);
    expect(act(etat, a, { type: 'accuser', ...SOLUTION }, T0 + 1).ok).toBe(true);
    expect(etat.etape).toBe('terminee');
    expect(etat.resultat).toMatchObject({ vainqueur: 'enqueteurs', raison: 'accusation_correcte' });
    const v = vuePour(etat, a);
    expect(v.resultat?.solution).toEqual(SOLUTION);
    expect(v.resultat?.complice).toBe(etat.complice);
    expect(v.resultat?.explication.length).toBeGreaterThan(3);
    expect(v.resultat?.indicesDecisifs.length).toBeGreaterThan(0);
    expect(act(etat, a, { type: 'finTour' }, T0 + 2).ok).toBe(false);
  });

  it('une accusation incorrecte interdit une nouvelle accusation mais le joueur continue à jouer', () => {
    const etat = nouvellePartie(4, { solution: SOLUTION });
    const h = new Horloge();
    const a = actif(etat);
    const faux = { suspect: 'victor', lieu: 'cave', arme: 'poison' } as const; // deux éléments justes sur trois
    expect(act(etat, a, { type: 'accuser', ...faux }, h.avance(1)).ok).toBe(true);
    expect(etat.etape).toBe('tour');
    expect(etat.joueurs[a].peutAccuser).toBe(false);
    // Aucune information sur les éléments erronés.
    const ev = etat.historique.find((e) => e.type === 'accusation')!;
    expect(Object.keys(ev).sort()).toEqual(['correcte', 'joueur', 't', 'triplet', 'type']);
    expect(Object.keys(vuePour(etat, a).moi.journal.at(-1)!).sort()).toEqual(['correcte', 't', 'triplet', 'type']);
    expect(act(etat, a, { type: 'accuser', ...SOLUTION }, h.avance(1))).toMatchObject({ ok: false });
    // Il peut encore formuler une hypothèse et consulter les archives.
    expect(act(etat, a, hyp(SOLUTION, autres(etat, a).slice(0, 2)), h.avance(1)).ok).toBe(true);
  });

  it('le complice gagne si tous les enquêteurs ont échoué leur accusation', () => {
    const etat = nouvellePartie(3, { solution: SOLUTION });
    const h = new Horloge();
    const faux = { suspect: 'gabriel', lieu: 'serre', arme: 'poison' } as const;
    for (const id of enqueteurs(etat)) {
      allerAuTourDe(etat, id, h);
      act(etat, id, { type: 'accuser', ...faux }, h.avance(1));
    }
    expect(etat.resultat).toMatchObject({ vainqueur: 'complice', raison: 'plus_d_accusateur' });
  });

  it('le résultat est décidé par le serveur (la solution n\'est pas envoyée avant la fin)', () => {
    const etat = nouvellePartie(5, { solution: SOLUTION });
    for (const id of etat.ordre) {
      const v = vuePour(etat, id);
      expect(v.resultat).toBeUndefined();
      expect(JSON.stringify(v)).not.toContain('"solution"');
    }
  });
});

describe('Carnet de déduction', () => {
  it('est privé, validé et conservé', () => {
    const etat = nouvellePartie(3);
    const [a, b] = etat.ordre;
    expect(act(etat, b, { type: 'carnet', marques: { eleonore: 'ecarte', cave: 'probable' }, notes: 'Victor ment' }, T0 + 1).ok).toBe(true);
    expect(vuePour(etat, b).moi.carnet).toEqual({ marques: { eleonore: 'ecarte', cave: 'probable' }, notes: 'Victor ment' });
    expect(JSON.stringify(vuePour(etat, a))).not.toContain('Victor ment');
    expect(act(etat, b, { type: 'carnet', marques: { eleonore: 'inconnu' } }, T0 + 2).ok).toBe(true);
    expect(vuePour(etat, b).moi.carnet.marques).toEqual({ cave: 'probable' });
    expect(act(etat, b, { type: 'carnet', marques: { intrus: 'ecarte' } as never }, T0 + 3).ok).toBe(false);
    expect(act(etat, b, { type: 'carnet', marques: { cave: 'peut-etre' as never } }, T0 + 3).ok).toBe(false);
    expect(act(etat, b, { type: 'carnet', notes: 'x'.repeat(5000) }, T0 + 3).ok).toBe(false);
    // Le carnet ne coûte aucun point d'action et n'influence pas la solution.
    expect(etat.pointsAction).toBe(2);
  });
});
