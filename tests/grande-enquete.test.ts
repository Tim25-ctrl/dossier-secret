// Mode « Grande enquête », étape 1 : le mobile dans le moteur (docs/GRANDE-ENQUETE.md).
import { describe, expect, it } from 'vitest';
import { simulerPartie } from '../src/bots/simulation';
import { CONFIG_GRANDE_ENQUETE, CONFIG_PAR_DEFAUT, type ConfigPartie } from '../src/engine/config';
import { distribuerCartes, genererAffaire, validerAffaire, validerDistribution } from '../src/engine/generateur';
import { cartesCorrespondantes, creerPartie, type EtatPartie } from '../src/engine/partie';
import { seededRng } from '../src/engine/rng';
import { INDICES_PAR_ID, MOBILES_FICHES, PERSONNAGES, indicesMobilesDe, nomElement } from '../src/shared/data/catalogue';
import { combinaisonsPossibles, estRelationnel, reglesEffectives, tripletsDe } from '../src/shared/logique';
import { AFFAIRES_IDS, MOBILES, affaireDe, categorieDe, elementsDe, elementsDuTriplet, type Triplet } from '../src/shared/types';
import { CONFIG_TEST, Horloge, act, actif, allerAuTourDe, autres, nouvellePartie, passerFalsification, vuePour } from './aide';

const GRANDE: Partial<ConfigPartie> = { ...CONFIG_TEST, ...CONFIG_GRANDE_ENQUETE };

function partieGrande(n: number, opts: { seed?: number; solution?: Triplet; complice?: string; affaire?: ConfigPartie['affaire'] } = {}) {
  return nouvellePartie(n, { seed: opts.seed, solution: opts.solution, complice: opts.complice, config: { ...GRANDE, affaire: opts.affaire ?? 'manoir' } });
}

/** Un mobile innocent (pas celui de la solution). */
function autreMobile(etat: EtatPartie) {
  return elementsDe(etat.config.affaire).mobiles.find((m) => m !== etat.affaire.solution.mobile)!;
}

describe('Les mobiles', () => {
  it('chaque histoire a 6 mobiles, avec une fiche, propres à cette histoire', () => {
    for (const a of AFFAIRES_IDS) {
      const { mobiles } = elementsDe(a);
      expect(mobiles).toHaveLength(6);
      for (const m of mobiles) {
        expect(affaireDe(m)).toBe(a);
        expect(categorieDe(m)).toBe('mobile');
        expect(MOBILES_FICHES[m]?.nom).toBeTruthy();
        expect(MOBILES_FICHES[m].article).toBeTruthy();
        expect(nomElement(m)).toBe(MOBILES_FICHES[m].nom);
      }
    }
    expect(new Set(MOBILES).size).toBe(18);
  });

  it("une partie classique ne voit jamais les mobiles", () => {
    expect(elementsDe('manoir').tous).toHaveLength(18);
    expect(elementsDe('manoir', true).tous).toHaveLength(24);
    expect(tripletsDe('manoir')).toHaveLength(216);
    expect(tripletsDe('manoir', true)).toHaveLength(1296);
    const etat = nouvellePartie(4, { seed: 3 });
    expect(etat.affaire.solution.mobile).toBeUndefined();
    const cartes = [...Object.values(etat.joueurs).flatMap((j) => j.main), ...(etat.pieces ?? []).map((p) => p.carte)];
    expect(cartes.some((c) => categorieDe(c) === 'mobile')).toBe(false);
    expect(vuePour(etat, etat.ordre[0]).regles.mode).toBe('classique');
  });
});

describe('Génération et distribution', () => {
  it('la solution comprend un mobile de la bonne histoire, et chaque mobile peut sortir', () => {
    for (const affaire of AFFAIRES_IDS) {
      const config: ConfigPartie = { ...CONFIG_PAR_DEFAUT, ...CONFIG_GRANDE_ENQUETE, affaire };
      const vus = new Set<string>();
      for (let seed = 1; seed <= 60; seed++) {
        const a = genererAffaire(seededRng(seed), config);
        expect(validerAffaire(a, config)).toEqual([]);
        expect(elementsDe(affaire).mobiles).toContain(a.solution.mobile);
        vus.add(a.solution.mobile!);
      }
      expect(vus.size).toBe(6);
    }
  });

  it('une solution sans mobile (ou un mobile dans une partie classique) est refusée', () => {
    const config: ConfigPartie = { ...CONFIG_PAR_DEFAUT, ...CONFIG_GRANDE_ENQUETE };
    const a = genererAffaire(seededRng(1), config);
    expect(validerAffaire({ ...a, solution: { ...a.solution, mobile: undefined } }, config)).toContain('Solution invalide.');
    expect(validerAffaire(a, CONFIG_PAR_DEFAUT)).toContain('Solution invalide.');
  });

  it('20 cartes hors solution : 5 par joueur à 4, 4 à 5, 3 à 6 avec 2 pièces à conviction', () => {
    const attendu: Record<number, [number, number]> = { 4: [5, 0], 5: [4, 0], 6: [3, 2] };
    for (const n of [4, 5, 6]) {
      for (let seed = 1; seed <= 20; seed++) {
        const solution: Triplet = { suspect: 'victor', lieu: 'cave', arme: 'dague', mobile: 'manoir_jalousie' };
        const joueurs = Array.from({ length: n }, (_, i) => `j${i}`);
        const d = distribuerCartes(seededRng(seed), solution, joueurs, 'manoir');
        expect(validerDistribution(d, solution, joueurs, 'manoir')).toEqual([]);
        for (const j of joueurs) expect(d.mains[j]).toHaveLength(attendu[n][0]);
        expect(d.cartesPubliques).toHaveLength(attendu[n][1]);
        const toutes = [...Object.values(d.mains).flat(), ...d.cartesPubliques];
        expect(toutes).not.toContain('manoir_jalousie');
        expect(toutes.filter((c) => categorieDe(c) === 'mobile')).toHaveLength(5);
      }
    }
  });

  it('la partie se joue à 4 joueurs au moins', () => {
    expect(() => partieGrande(3)).toThrow(/de 4 à 6 joueurs/);
    for (const n of [4, 5, 6]) {
      const etat = partieGrande(n, { seed: n });
      expect(etat.config.manchesMax).toBe(14);
      expect(vuePour(etat, etat.ordre[0]).regles.mode).toBe('grande');
      // Les pièces à conviction (6 joueurs) sont rangées dans les archives.
      expect(etat.pieces ?? []).toHaveLength(n === 6 ? 2 : 0);
    }
  });

  it('les combinaisons possibles comptent le mobile', () => {
    const toutes = combinaisonsPossibles([], ['manoir_jalousie', 'manoir_dette'], 'manoir', true);
    expect(toutes).toHaveLength(216 * 4);
    expect(toutes.every((t) => t.mobile !== 'manoir_jalousie' && t.mobile !== 'manoir_dette')).toBe(true);
  });
});

describe('Hypothèses et accusations avec le mobile', () => {
  it("l'hypothèse doit nommer un mobile de l'histoire ; une partie classique n'en accepte pas", () => {
    const h = new Horloge();
    const etat = partieGrande(4, { seed: 5 });
    const moi = actif(etat);
    const interroges = autres(etat, moi).slice(0, 2);
    const { suspect, lieu, arme } = etat.affaire.solution;
    expect(act(etat, moi, { type: 'hypothese', suspect, lieu, arme, interroges }, h.avance(1))).toMatchObject({
      ok: false,
      erreur: expect.stringContaining('un mobile'),
    });
    expect(act(etat, moi, { type: 'hypothese', suspect, lieu, arme, mobile: 'train_amour', interroges }, h.avance(1)).ok).toBe(false);
    expect(act(etat, moi, { type: 'hypothese', suspect, lieu, arme, mobile: autreMobile(etat), interroges }, h.avance(1)).ok).toBe(true);

    const classique = nouvellePartie(4, { seed: 5 });
    const c = actif(classique);
    const s = classique.affaire.solution;
    const r = act(classique, c, { type: 'hypothese', ...s, mobile: 'manoir_dette', interroges: autres(classique, c).slice(0, 2) }, h.avance(1));
    expect(r.ok).toBe(false);
  });

  it('une carte mobile se montre comme les autres', () => {
    const h = new Horloge();
    for (let seed = 1; seed <= 40; seed++) {
      const etat = partieGrande(4, { seed });
      const moi = actif(etat);
      // Un autre joueur qui détient un mobile, et dont c'est la seule carte correspondante.
      const detenteur = autres(etat, moi).find((id) => etat.joueurs[id].main.some((c) => categorieDe(c) === 'mobile'));
      if (!detenteur) continue;
      const mobile = etat.joueurs[detenteur].main.find((c) => categorieDe(c) === 'mobile') as Triplet['mobile'];
      const t: Triplet = { ...etat.affaire.solution, mobile };
      expect(cartesCorrespondantes(etat, detenteur, t)).toEqual([mobile]);
      const autresInterroges = autres(etat, moi).filter((id) => id !== detenteur);
      expect(act(etat, moi, { type: 'hypothese', ...t, interroges: [detenteur, autresInterroges[0]] }, h.avance(1)).ok).toBe(true);
      passerFalsification(etat, h);
      // Le détenteur ne peut pas prétendre n'avoir aucune carte (sauf ruse du complice).
      if (detenteur !== etat.complice) expect(act(etat, detenteur, { type: 'repondre', carte: null }, h.avance(1)).ok).toBe(false);
      expect(act(etat, detenteur, { type: 'repondre', carte: mobile! }, h.avance(1)).ok).toBe(true);
      const vue = vuePour(etat, moi);
      expect(vue.moi.journal.some((e) => e.type === 'carte_vue' && e.carte === mobile)).toBe(true);
      return;
    }
    throw new Error('Aucune partie de test ne convenait.');
  });

  it("l'accusation n'est juste que si le mobile l'est aussi", () => {
    const h = new Horloge();
    const etat = partieGrande(4, { seed: 8 });
    const accusateurs = etat.ordre.filter((id) => id !== etat.complice);
    allerAuTourDe(etat, accusateurs[0], h);
    const s = etat.affaire.solution;
    expect(act(etat, accusateurs[0], { type: 'accuser', suspect: s.suspect, lieu: s.lieu, arme: s.arme }, h.avance(1)).ok).toBe(false);
    expect(act(etat, accusateurs[0], { type: 'accuser', ...s, mobile: autreMobile(etat) }, h.avance(1)).ok).toBe(true);
    expect(etat.accusations[0].correcte).toBe(false);
    expect(etat.etape).not.toBe('terminee');
    allerAuTourDe(etat, accusateurs[1], h);
    expect(act(etat, accusateurs[1], { type: 'accuser', ...s }, h.avance(1)).ok).toBe(true);
    // Objectif « Le témoin gênant » : dernière chance du complice (ici, il se trompe de joueur).
    if (etat.etape === 'designation') {
      const pasTemoin = etat.ordre.find((id) => id !== etat.complice && etat.joueurs[id].roleEnquete !== 'temoin')!;
      expect(act(etat, etat.complice, { type: 'designerTemoin', joueur: pasTemoin }, h.avance(1)).ok).toBe(true);
    }
    expect(etat.resultat?.vainqueur).toBe('enqueteurs');
    expect(vuePour(etat, accusateurs[1]).resultat!.solution.mobile).toBe(s.mobile);
  });

  it('le complice peut falsifier le mobile', () => {
    const h = new Horloge();
    for (let seed = 1; seed <= 20; seed++) {
      const etat = partieGrande(4, { seed });
      const moi = actif(etat);
      if (moi === etat.complice) continue;
      const t: Triplet = { ...etat.affaire.solution, mobile: autreMobile(etat) };
      expect(act(etat, moi, { type: 'hypothese', ...t, interroges: autres(etat, moi).slice(0, 2) }, h.avance(1)).ok).toBe(true);
      const nouveau = elementsDe('manoir').mobiles.find((m) => m !== t.mobile)!;
      expect(act(etat, etat.complice, { type: 'falsifier', champ: 'mobile', valeur: 'manoir_cave' as never }, h.avance(1)).ok).toBe(false);
      expect(act(etat, etat.complice, { type: 'falsifier', champ: 'mobile', valeur: nouveau }, h.avance(1)).ok).toBe(true);
      passerFalsification(etat, h);
      const publique = etat.historique.find((e) => e.type === 'hypothese');
      expect(publique?.type === 'hypothese' && publique.triplet.mobile).toBe(nouveau);
      expect(etat.hypotheses[0].original.mobile).toBe(t.mobile);
      return;
    }
    throw new Error('Aucune partie de test ne convenait.');
  });
});

describe('Parties complètes entre bots', () => {
  it('se terminent sans action refusée, dans les trois histoires et de 4 à 6 joueurs', () => {
    for (const affaire of AFFAIRES_IDS) {
      for (const n of [4, 5, 6]) {
        for (let seed = 1; seed <= 4; seed++) {
          const { etat, refus } = simulerPartie({ nbJoueurs: n, seed: seed * 31 + n, config: { ...CONFIG_GRANDE_ENQUETE, affaire } });
          expect(etat.etape).toBe('terminee');
          expect(refus).toEqual([]);
          expect(etat.affaire.solution.mobile).toBeTruthy();
          for (const a of etat.accusations) expect(a.triplet.mobile).toBeTruthy();
          // Toutes les cartes hors solution sont distribuées une seule fois.
          const cartes = [...Object.values(etat.joueurs).flatMap((j) => j.main), ...(etat.pieces ?? []).map((p) => p.carte)];
          expect(new Set(cartes).size).toBe(20);
          expect(cartes.some((c) => elementsDuTriplet(etat.affaire.solution).includes(c))).toBe(false);
        }
      }
    }
  });
});

it('le complice ne reçoit que le meurtrier, pas le mobile', () => {
  const etat = creerPartie({
    id: 'g',
    joueurs: Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, nom: `P${i}` })),
    rng: seededRng(4),
    now: 0,
    config: { ...CONFIG_GRANDE_ENQUETE },
  });
  const vue = vuePour(etat, etat.complice);
  expect(vue.moi.meurtrier).toBe(etat.affaire.solution.suspect);
  expect(JSON.stringify({ ...vue, historique: [] })).not.toContain(etat.affaire.solution.mobile!);
});

describe('Étape 2 : le contenu des mobiles', () => {
  it('chaque histoire a 12 indices sur ses mobiles, relationnels, qui ne parlent que de cette histoire', () => {
    const ids = new Set<string>();
    for (const affaire of AFFAIRES_IDS) {
      const cartes = indicesMobilesDe(affaire);
      expect(cartes).toHaveLength(12);
      for (const c of cartes) {
        expect(ids.has(c.id)).toBe(false);
        ids.add(c.id);
        expect(INDICES_PAR_ID[c.id]).toBe(c);
        expect(estRelationnel(c)).toBe(true);
        expect(c.concerne.every((e) => affaireDe(e) === affaire)).toBe(true);
        // Chaque règle relie un suspect et un mobile.
        for (const r of reglesEffectives(c)) {
          expect(r.type).toBe('pasEnsemble');
          if (r.type !== 'pasEnsemble') continue;
          expect([categorieDe(r.a), categorieDe(r.b)].sort()).toEqual(['mobile', 'suspect']);
        }
        if (c.categorie !== 'journal') expect(c.texte).toMatch(/Si .+(coupable|mobile)/);
      }
      // Les trois témoignages partiels laissent exactement deux coupables pour leur mobile.
      const partiels = cartes.filter((c) => c.regles.length > 1);
      expect(partiels).toHaveLength(3);
      for (const c of partiels) expect(c.regles).toHaveLength(4);
    }
  });

  it("une partie classique ne tire jamais d'indice sur les mobiles", () => {
    for (const affaire of AFFAIRES_IDS) {
      const surMobiles = new Set(indicesMobilesDe(affaire).map((c) => c.id));
      for (let seed = 1; seed <= 40; seed++) {
        const a = genererAffaire(seededRng(seed), { ...CONFIG_PAR_DEFAUT, affaire });
        expect(a.archives.some((d) => surMobiles.has(d.indice))).toBe(false);
      }
    }
  });

  it('une Grande enquête cohérente se génère pour chacune des 1 296 solutions, avec 8 dossiers dont 2 sur les mobiles au moins', () => {
    for (const affaire of AFFAIRES_IDS) {
      const config: ConfigPartie = { ...CONFIG_PAR_DEFAUT, ...CONFIG_GRANDE_ENQUETE, affaire };
      const surMobiles = new Set(indicesMobilesDe(affaire).map((c) => c.id));
      const rng = seededRng(7);
      for (const solution of tripletsDe(affaire, true)) {
        const a = genererAffaire(rng, config, solution);
        expect(validerAffaire(a, config)).toEqual([]);
        expect(a.archives).toHaveLength(8);
        expect(a.archives.filter((d) => surMobiles.has(d.indice)).length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('chaque mobile a son dessin et son récit de fin', () => {
    for (const m of MOBILES) {
      const f = MOBILES_FICHES[m];
      expect(f.icone).toBeTruthy();
      expect(f.recit).toContain('{coupable}');
      expect(f.recit.startsWith('Le mobile était')).toBe(true);
    }
  });

  it('la révélation finale raconte le pourquoi du crime', () => {
    const { etat } = simulerPartie({ nbJoueurs: 4, seed: 12, config: { ...CONFIG_GRANDE_ENQUETE, affaire: 'train' } });
    const r = vuePour(etat, etat.ordre[0]).resultat!;
    const mobile = MOBILES_FICHES[etat.affaire.solution.mobile!];
    const coupable = PERSONNAGES[etat.affaire.solution.suspect];
    expect(r.explication[0]).toContain(mobile.article);
    expect(r.explication[1]).toBe(mobile.recit.replace('{coupable}', coupable.nom));
    // L'aveu de la fiche (qui raconte un autre mobile) n'apparaît pas.
    expect(r.explication).not.toContain(coupable.aveu);
    expect(r.explication.at(-1)).toContain("l'arme et le mobile");
  });
});

it("réglage d'équilibre de la Grande enquête : 3 points d'action, ruses 3 / 5 / 6 ; la partie classique ne change pas", () => {
  for (const [n, ruses] of [[4, 3], [5, 5], [6, 6]] as const) {
    const etat = partieGrande(n, { seed: n });
    expect(etat.pointsAction).toBe(3);
    expect(vuePour(etat, etat.complice).moi.rusesRestantes ?? etat.joueurs[etat.complice].rusesRestantes).toBe(etat.config.modeComplice === 'ruse' ? ruses : 0);
    expect(etat.config.ruses[n]).toBe(ruses);
  }
  const classique = nouvellePartie(4, { seed: 1 });
  expect(classique.pointsAction).toBe(2);
  expect(CONFIG_PAR_DEFAUT.pointsAction).toBe(2);
  expect(CONFIG_PAR_DEFAUT.ruses).toEqual({ 3: 2, 4: 4, 5: 5, 6: 5 });
});
