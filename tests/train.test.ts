import { describe, expect, it } from 'vitest';
import { simulerPartie } from '../src/bots/simulation';
import { CONFIG_PAR_DEFAUT, type ConfigPartie } from '../src/engine/config';
import { distribuerCartes, genererAffaire, tousLesIndicesDeLAffaire, validerDistribution } from '../src/engine/generateur';
import { seededRng } from '../src/engine/rng';
import { vuePour } from '../src/engine/vue';
import { AFFAIRES, ARMES_FICHES, INDICES_PAR_ID, LIEUX_FICHES, PERSONNAGES, fauxIndicesDe, indicesDe, nomElement } from '../src/shared/data/catalogue';
import { jourDuJournal } from '../src/shared/data/indices';
import { ceQueLIndiceEcarte, combinaisonsPossibles, estRelationnel, reglesEffectives, tripletsDe } from '../src/shared/logique';
import { AFFAIRES_IDS, affaireDe, elementsDe } from '../src/shared/types';

const TRAIN = elementsDe('train');
const CONFIG_TRAIN: ConfigPartie = { ...CONFIG_PAR_DEFAUT, affaire: 'train' };
const indices = indicesDe('train');

describe("Catalogue des affaires", () => {
  it('chaque élément et chaque indice a un identifiant unique, toutes affaires confondues', () => {
    const elements = AFFAIRES_IDS.flatMap((a) => elementsDe(a).tous);
    expect(new Set(elements).size).toBe(elements.length);
    const tous = AFFAIRES_IDS.flatMap((a) => [...indicesDe(a), ...fauxIndicesDe(a)]);
    expect(Object.keys(INDICES_PAR_ID)).toHaveLength(tous.length);
    for (const a of AFFAIRES_IDS) for (const e of elementsDe(a).tous) expect(affaireDe(e)).toBe(a);
  });

  it('chaque affaire a ses 6 + 6 + 6 fiches complètes', () => {
    for (const a of AFFAIRES_IDS) {
      const e = elementsDe(a);
      expect(e.suspects).toHaveLength(6);
      expect(e.lieux).toHaveLength(6);
      expect(e.armes).toHaveLength(6);
      for (const s of e.suspects) expect(PERSONNAGES[s]?.aveu, s).toBeTruthy();
      for (const l of e.lieux) expect(LIEUX_FICHES[l]?.article, l).toMatch(/^(dans|au|sur) /);
      for (const x of e.armes) expect(ARMES_FICHES[x]?.article, x).toMatch(/^avec /);
      expect(e.lieux).toContain(AFFAIRES[a].lieuDecouverte);
    }
  });
});

describe("L'affaire du train de nuit", () => {
  it("compte des indices relationnels variés, qui ne parlent que du train", () => {
    expect(indices.length).toBeGreaterThanOrEqual(40);
    expect(new Set(indices.map((c) => c.categorie)).size).toBeGreaterThanOrEqual(5);
    for (const c of indices) {
      expect(estRelationnel(c), c.id).toBe(true);
      expect(reglesEffectives(c).length, c.id).toBeGreaterThan(0);
      for (const e of c.concerne) expect(affaireDe(e), `${c.id} : ${e}`).toBe('train');
      for (const r of reglesEffectives(c)) if (r.type === 'pasEnsemble') expect([affaireDe(r.a), affaireDe(r.b)]).toEqual(['train', 'train']);
    }
  });

  it('chaque suspect, lieu et arme apparaît dans au moins trois indices', () => {
    for (const e of TRAIN.tous) {
      const n = indices.filter((c) => reglesEffectives(c).some((r) => r.type === 'pasEnsemble' && (r.a === e || r.b === e))).length;
      expect(n, nomElement(e)).toBeGreaterThanOrEqual(3);
    }
  });

  it('les témoignages partiels se résument en une phrase « … le coupable est A ou B »', () => {
    const partiels = indices.filter((c) => reglesEffectives(c).length === 4);
    expect(partiels).toHaveLength(6);
    for (const c of partiels) {
      expect(ceQueLIndiceEcarte(c)).toHaveLength(1);
      expect(ceQueLIndiceEcarte(c)[0]).toMatch(/^Si (le crime a eu lieu|le crime a été commis) .+, le coupable est .+ ou .+$/);
    }
  });

  it('le carnet de la victime compte sept pages, du 3 au 9 mars', () => {
    const pages = indices.filter((c) => c.categorie === 'journal');
    expect(pages.map(jourDuJournal).sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(fauxIndicesDe('train')).toHaveLength(216);
  });

  it('une affaire cohérente se génère pour chacune des 216 solutions', () => {
    const solutions = tripletsDe('train');
    expect(solutions).toHaveLength(216);
    for (const [i, solution] of solutions.entries()) {
      const a = genererAffaire(seededRng(i + 1), CONFIG_TRAIN, solution);
      expect(a.solution).toEqual(solution);
      const cartes = tousLesIndicesDeLAffaire(a);
      expect(cartes.every((c) => c.id.startsWith('TR-'))).toBe(true);
      expect(combinaisonsPossibles(cartes, [], 'train').length).toBeGreaterThanOrEqual(CONFIG_TRAIN.minCombinaisonsIndices);
    }
  });

  it('les cartes distribuées sont celles du train, et elles désignent la solution', () => {
    for (const n of [3, 4, 5, 6]) {
      const rng = seededRng(n * 17);
      const a = genererAffaire(rng, CONFIG_TRAIN);
      const joueurs = Array.from({ length: n }, (_, i) => `j${i}`);
      const d = distribuerCartes(rng, a.solution, joueurs, 'train');
      expect(validerDistribution(d, a.solution, joueurs, 'train')).toEqual([]);
      const connues = [...Object.values(d.mains).flat(), ...d.cartesPubliques];
      expect(connues.every((c) => affaireDe(c) === 'train')).toBe(true);
      expect(combinaisonsPossibles(tousLesIndicesDeLAffaire(a), connues, 'train')).toEqual([a.solution]);
    }
  });

  it('des parties complètes entre bots se jouent jusqu’au bout, sans action refusée', () => {
    for (const n of [3, 4, 5, 6]) {
      for (let seed = 1; seed <= 6; seed++) {
        const { etat, refus } = simulerPartie({ nbJoueurs: n, seed: seed * 101 + n, config: { affaire: 'train' } });
        expect(etat.etape).toBe('terminee');
        expect(refus).toEqual([]);
        const v = vuePour(etat, etat.ordre[0]);
        expect(v.affaire).toBe('train');
        expect(v.resultat!.explication[0]).toContain('Octave de Saint-Aubin');
      }
    }
  });
});
