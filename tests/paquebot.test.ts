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

const PAQUEBOT = elementsDe('paquebot');
const CONFIG_PAQUEBOT: ConfigPartie = { ...CONFIG_PAR_DEFAUT, affaire: 'paquebot' };
const indices = indicesDe('paquebot');

describe("L'affaire de l'Aurélia (paquebot)", () => {
  it("compte des indices relationnels variés, qui ne parlent que du paquebot", () => {
    expect(indices.length).toBeGreaterThanOrEqual(40);
    expect(new Set(indices.map((c) => c.categorie)).size).toBeGreaterThanOrEqual(5);
    for (const c of indices) {
      expect(estRelationnel(c), c.id).toBe(true);
      expect(reglesEffectives(c).length, c.id).toBeGreaterThan(0);
      for (const e of c.concerne) expect(affaireDe(e), `${c.id} : ${e}`).toBe('paquebot');
      for (const r of reglesEffectives(c)) if (r.type === 'pasEnsemble') expect([affaireDe(r.a), affaireDe(r.b)]).toEqual(['paquebot', 'paquebot']);
    }
  });

  it('chaque suspect, lieu et arme apparaît dans au moins trois indices', () => {
    for (const e of PAQUEBOT.tous) {
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

  it('le journal de la victime compte sept pages, du 3 au 9 juin', () => {
    const pages = indices.filter((c) => c.categorie === 'journal');
    expect(pages.map(jourDuJournal).sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(fauxIndicesDe('paquebot')).toHaveLength(216);
  });

  it('une affaire cohérente se génère pour chacune des 216 solutions', () => {
    const solutions = tripletsDe('paquebot');
    expect(solutions).toHaveLength(216);
    for (const [i, solution] of solutions.entries()) {
      const a = genererAffaire(seededRng(i + 1), CONFIG_PAQUEBOT, solution);
      expect(a.solution).toEqual(solution);
      const cartes = tousLesIndicesDeLAffaire(a);
      expect(cartes.every((c) => c.id.startsWith('PQ-'))).toBe(true);
      expect(combinaisonsPossibles(cartes, [], 'paquebot').length).toBeGreaterThanOrEqual(CONFIG_PAQUEBOT.minCombinaisonsIndices);
    }
  });

  it('les cartes distribuées sont celles du paquebot, et elles désignent la solution', () => {
    for (const n of [3, 4, 5, 6]) {
      const rng = seededRng(n * 17);
      const a = genererAffaire(rng, CONFIG_PAQUEBOT);
      const joueurs = Array.from({ length: n }, (_, i) => `j${i}`);
      const d = distribuerCartes(rng, a.solution, joueurs, 'paquebot');
      expect(validerDistribution(d, a.solution, joueurs, 'paquebot')).toEqual([]);
      const connues = [...Object.values(d.mains).flat(), ...d.cartesPubliques];
      expect(connues.every((c) => affaireDe(c) === 'paquebot')).toBe(true);
      expect(combinaisonsPossibles(tousLesIndicesDeLAffaire(a), connues, 'paquebot')).toEqual([a.solution]);
    }
  });

  it('des parties complètes entre bots se jouent jusqu’au bout, sans action refusée', () => {
    for (const n of [3, 4, 5, 6]) {
      for (let seed = 1; seed <= 6; seed++) {
        const { etat, refus } = simulerPartie({ nbJoueurs: n, seed: seed * 101 + n, config: { affaire: 'paquebot' } });
        expect(etat.etape).toBe('terminee');
        expect(refus).toEqual([]);
        const v = vuePour(etat, etat.ordre[0]);
        expect(v.affaire).toBe('paquebot');
        expect(v.resultat!.explication[0]).toContain('Édouard Lancret');
      }
    }
  });
});
