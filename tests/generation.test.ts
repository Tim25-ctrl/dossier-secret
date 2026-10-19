import { describe, expect, it } from 'vitest';
import { INDICES, INDICES_PAR_ID } from '../src/shared/data/indices';
import { ARMES_FICHES, LIEUX_FICHES, PERSONNAGES } from '../src/shared/data/manoir';
import {
  TOUS_TRIPLETS,
  combinaisonsPossibles,
  couvreFenetreCrime,
  indiceValide,
  indicesIncompatibles,
  precision,
  reglesEffectives,
  regleVraie,
} from '../src/shared/logique';
import { CONFIG_PAR_DEFAUT } from '../src/engine/config';
import {
  distribuerCartes,
  genererAffaire,
  tousLesIndicesDeLAffaire,
  validerAffaire,
  validerDistribution,
  type Affaire,
} from '../src/engine/generateur';
import { seededRng } from '../src/engine/rng';
import { TOUS_ELEMENTS, categorieDe, elementsDuTriplet } from '../src/shared/types';

describe('Données de l\'affaire', () => {
  it('contient 6 personnages, 6 lieux et 6 armes avec des fiches complètes', () => {
    expect(Object.keys(PERSONNAGES)).toHaveLength(6);
    expect(Object.keys(LIEUX_FICHES)).toHaveLength(6);
    expect(Object.keys(ARMES_FICHES)).toHaveLength(6);
    for (const p of Object.values(PERSONNAGES)) {
      for (const champ of ['nom', 'description', 'histoire', 'relation', 'mobile', 'secret', 'alibi', 'connaissances'] as const)
        expect(p[champ].length, `${p.id}.${champ}`).toBeGreaterThan(10);
    }
  });

  it('possède au moins 30 cartes d\'indice, d\'identifiants uniques, dans les 7 catégories', () => {
    expect(INDICES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(INDICES.map((c) => c.id)).size).toBe(INDICES.length);
    const categories = new Set(INDICES.map((c) => c.categorie));
    for (const cat of ['temoignage', 'objet', 'horaire', 'deplacement', 'document', 'trace', 'contradiction'])
      expect(categories.has(cat as never), cat).toBe(true);
  });

  it('chaque carte a un titre, un texte, des éléments concernés et au moins une règle effective', () => {
    for (const c of INDICES) {
      expect(c.titre.length).toBeGreaterThan(3);
      expect(c.texte.length).toBeGreaterThan(40);
      expect(c.concerne.length).toBeGreaterThan(0);
      for (const e of c.concerne) expect(categorieDe(e), `${c.id} concerne ${e}`).not.toBeNull();
      expect(reglesEffectives(c).length, `${c.id} n'apporte aucune information`).toBeGreaterThan(0);
      expect(['faible', 'moyenne', 'forte']).toContain(precision(c));
      expect(c.disponibleDesManche).toBeGreaterThanOrEqual(1);
      for (const id of c.incompatibleAvec ?? []) expect(INDICES_PAR_ID[id], `${c.id} -> ${id}`).toBeDefined();
    }
  });

  it('les faits chronologiques produisent bien des règles quand ils couvrent la fenêtre du crime', () => {
    const avecFaitsCouvrants = INDICES.filter((c) => c.faits?.some(couvreFenetreCrime));
    expect(avecFaitsCouvrants.length).toBeGreaterThan(5);
    for (const c of avecFaitsCouvrants) expect(reglesEffectives(c).length).toBeGreaterThan(c.regles.length);
  });

  it('aucune carte, seule, n\'est contradictoire avec toutes les solutions, ni ne révèle la solution', () => {
    for (const c of INDICES) {
      const n = combinaisonsPossibles([c]).length;
      expect(n, c.id).toBeGreaterThan(0);
      expect(n, c.id).toBeGreaterThan(1);
    }
  });

  it('les textes du poison restent fictifs (aucune dose, recette ou méthode)', () => {
    const textes = [...INDICES.map((c) => c.texte), ARMES_FICHES.poison.description, ARMES_FICHES.poison.recit].join(' ').toLowerCase();
    for (const mot of ['dose', 'milligramme', 'recette', 'arsenic', 'cyanure', 'strychnine', 'mg'])
      expect(textes.includes(` ${mot}`), mot).toBe(false);
  });
});

describe('Génération des affaires', () => {
  it('génère une affaire valide pour CHACUNE des 216 solutions possibles', () => {
    for (const [i, solution] of TOUS_TRIPLETS.entries()) {
      const affaire = genererAffaire(seededRng(i + 1), CONFIG_PAR_DEFAUT, solution);
      expect(validerAffaire(affaire, CONFIG_PAR_DEFAUT)).toEqual([]);
      expect(affaire.solution).toEqual(solution);
    }
  });

  it('tous les indices sélectionnés sont compatibles avec la solution et entre eux', () => {
    for (let seed = 0; seed < 100; seed++) {
      const a = genererAffaire(seededRng(seed), CONFIG_PAR_DEFAUT);
      const cartes = tousLesIndicesDeLAffaire(a);
      expect(cartes).toHaveLength(CONFIG_PAR_DEFAUT.nbIndicesPublicsDepart + CONFIG_PAR_DEFAUT.manchesIndicesPublics.length + CONFIG_PAR_DEFAUT.nbDossiersArchives);
      for (const c of cartes) expect(indiceValide(c, a.solution)).toBe(true);
      for (const x of cartes) for (const y of cartes) expect(indicesIncompatibles(x, y)).toBe(false);
    }
  });

  it('les indices seuls ne révèlent jamais immédiatement les trois éléments', () => {
    for (let seed = 0; seed < 200; seed++) {
      const a = genererAffaire(seededRng(seed), CONFIG_PAR_DEFAUT);
      const possibles = combinaisonsPossibles(tousLesIndicesDeLAffaire(a));
      expect(possibles.length).toBeGreaterThanOrEqual(CONFIG_PAR_DEFAUT.minCombinaisonsIndices);
      expect(possibles).toContainEqual(a.solution);
    }
  });

  it("avec toutes les informations de la partie (indices + cartes), une seule combinaison reste possible", () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = seededRng(seed);
      const a = genererAffaire(rng, CONFIG_PAR_DEFAUT);
      for (const n of [3, 4, 5, 6]) {
        const joueurs = Array.from({ length: n }, (_, i) => `p${i}`);
        const d = distribuerCartes(rng, a.solution, joueurs);
        const connues = [...Object.values(d.mains).flat(), ...d.cartesPubliques];
        expect(combinaisonsPossibles(tousLesIndicesDeLAffaire(a), connues)).toEqual([a.solution]);
      }
    }
  });

  it('les dossiers ne s\'ouvrent jamais avant la disponibilité de leur indice', () => {
    for (let seed = 0; seed < 100; seed++) {
      const a = genererAffaire(seededRng(seed), CONFIG_PAR_DEFAUT);
      for (const d of a.archives) expect(d.disponibleDesManche).toBeGreaterThanOrEqual(INDICES_PAR_ID[d.indice].disponibleDesManche);
      for (const d of a.indicesPublicsDifferes) expect(d.manche).toBeGreaterThanOrEqual(INDICES_PAR_ID[d.indice].disponibleDesManche);
    }
  });

  it('la solution varie d\'une partie à l\'autre', () => {
    const solutions = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const s = genererAffaire(seededRng(seed), CONFIG_PAR_DEFAUT).solution;
      solutions.add(`${s.suspect}/${s.lieu}/${s.arme}`);
    }
    expect(solutions.size).toBeGreaterThan(30);
    const lieux = new Set([...solutions].map((s) => s.split('/')[1]));
    expect(lieux.size).toBe(6); // le bureau n'est pas systématiquement la réponse
  });
});

describe('Validation : détection des affaires incohérentes', () => {
  const base = () => genererAffaire(seededRng(7), CONFIG_PAR_DEFAUT);

  it('détecte un indice qui exclut la vraie solution', () => {
    const a: Affaire = base();
    const fautif = INDICES.find((c) => !indiceValide(c, a.solution))!;
    a.archives[0] = { ...a.archives[0], indice: fautif.id, disponibleDesManche: 8 };
    expect(validerAffaire(a, CONFIG_PAR_DEFAUT).join(' ')).toMatch(/exclut la vraie solution/);
  });

  it('détecte deux indices contradictoires (horaires incompatibles)', () => {
    const a: Affaire = { ...base(), solution: { suspect: 'victor', lieu: 'bureau', arme: 'dague' } };
    // IND-01 (Éléonore au hall) et IND-13 (Éléonore à la bibliothèque) se chevauchent.
    a.archives = a.archives.map((d, i) => (i === 0 ? { ...d, indice: 'IND-01' } : i === 1 ? { ...d, indice: 'IND-13' } : d));
    expect(validerAffaire(a, CONFIG_PAR_DEFAUT).join(' ')).toMatch(/se contredisent/);
  });

  it('détecte une contradiction narrative déclarée (scellé de la cave / présence dans la cave)', () => {
    expect(indicesIncompatibles(INDICES_PAR_ID['IND-08'], INDICES_PAR_ID['IND-14'])).toBe(true);
    expect(indicesIncompatibles(INDICES_PAR_ID['IND-08'], INDICES_PAR_ID['IND-18'])).toBe(true);
  });

  it('détecte une affaire qui révèle trop la solution', () => {
    const a = base();
    const strict = { ...CONFIG_PAR_DEFAUT, minCombinaisonsIndices: 500 };
    expect(validerAffaire(a, strict).join(' ')).toMatch(/révèlent trop/);
  });

  it('détecte un indice en double et un indice inconnu', () => {
    const a = base();
    a.archives[1] = { ...a.archives[1], indice: a.archives[0].indice };
    expect(validerAffaire(a, CONFIG_PAR_DEFAUT).join(' ')).toMatch(/deux fois/);
    a.archives[1] = { ...a.archives[1], indice: 'IND-999' };
    expect(validerAffaire(a, CONFIG_PAR_DEFAUT).join(' ')).toMatch(/inconnus/);
  });

  it('les règles évaluent correctement les combinaisons', () => {
    const t = { suspect: 'morel', lieu: 'serre', arme: 'chandelier' } as const;
    expect(regleVraie({ type: 'pas', element: 'morel' }, t)).toBe(false);
    expect(regleVraie({ type: 'pasEnsemble', a: 'serre', b: 'chandelier' }, t)).toBe(false);
    expect(regleVraie({ type: 'pasEnsemble', a: 'cave', b: 'chandelier' }, t)).toBe(true);
    expect(regleVraie({ type: 'parmi', elements: ['cave', 'serre'] }, t)).toBe(true);
    expect(regleVraie({ type: 'siAlors', si: 'morel', alors: 'cave' }, t)).toBe(false);
    expect(regleVraie({ type: 'siAlors', si: 'victor', alors: 'cave' }, t)).toBe(true);
    // 216 combinaisons au total ; « pas X » en élimine 36.
    expect(TOUS_TRIPLETS).toHaveLength(216);
    expect(combinaisonsPossibles([{ ...INDICES[0], regles: [{ type: 'pas', element: 'cave' }], faits: [] }])).toHaveLength(180);
  });
});

describe('Distribution des cartes', () => {
  const attendu: Record<number, { parJoueur: number; publiques: number }> = {
    3: { parJoueur: 5, publiques: 0 },
    4: { parJoueur: 3, publiques: 3 },
    5: { parJoueur: 3, publiques: 0 },
    6: { parJoueur: 2, publiques: 3 },
  };

  for (const n of [3, 4, 5, 6]) {
    it(`${n} joueurs : ${attendu[n].parJoueur} cartes chacun, ${attendu[n].publiques} publiques, sans doublon ni carte de la solution`, () => {
      for (let seed = 0; seed < 50; seed++) {
        const rng = seededRng(seed);
        const a = genererAffaire(rng, CONFIG_PAR_DEFAUT);
        const joueurs = Array.from({ length: n }, (_, i) => `p${i}`);
        const d = distribuerCartes(rng, a.solution, joueurs);
        expect(validerDistribution(d, a.solution, joueurs)).toEqual([]);
        for (const j of joueurs) expect(d.mains[j]).toHaveLength(attendu[n].parJoueur);
        expect(d.cartesPubliques).toHaveLength(attendu[n].publiques);
        const toutes = [...Object.values(d.mains).flat(), ...d.cartesPubliques];
        expect(toutes.length).toBeLessThanOrEqual(TOUS_ELEMENTS.length);
        for (const e of elementsDuTriplet(a.solution)) expect(toutes).not.toContain(e);
      }
    });
  }

  it('refuse un nombre de joueurs hors limites', () => {
    const a = genererAffaire(seededRng(1), CONFIG_PAR_DEFAUT);
    expect(() => distribuerCartes(seededRng(1), a.solution, ['a', 'b'])).toThrow();
    expect(() => distribuerCartes(seededRng(1), a.solution, ['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toThrow();
  });
});
