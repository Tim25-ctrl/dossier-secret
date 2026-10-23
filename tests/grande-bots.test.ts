// Mode « Grande enquête », étape 6 : les bots jouent tout le mode (docs/GRANDE-ENQUETE.md).
import { describe, expect, it } from 'vitest';
import { decisionBot } from '../src/bots/bot';
import { candidatsComplice } from '../src/bots/deduction';
import { simulerPartie } from '../src/bots/simulation';
import { CONFIG_GRANDE_ENQUETE, type ConfigPartie } from '../src/engine/config';
import { seededRng } from '../src/engine/rng';
import { AFFAIRES_IDS, categorieDe, type Triplet } from '../src/shared/types';
import { CONFIG_TEST, Horloge, act, actif, autres, nouvellePartie, passerFalsification, vuePour } from './aide';

const ACTIONS_GRANDE = ['verifierReponses', 'expertiser', 'verifierDossier', 'profiler', 'epingler', 'reagir', 'designerTemoin'];

describe('Les bots en Grande enquête', () => {
  it('jouent des parties complètes sans action refusée, avec pouvoirs, épingles, réactions et rumeurs', () => {
    const vus = new Set<string>();
    for (const affaire of AFFAIRES_IDS) {
      for (const n of [4, 5, 6]) {
        for (let seed = 1; seed <= 5; seed++) {
          const { etat, refus } = simulerPartie({ nbJoueurs: n, seed: seed * 37 + n, config: { ...CONFIG_GRANDE_ENQUETE, affaire } });
          expect(etat.etape).toBe('terminee');
          expect(refus).toEqual([]);
          for (const a of etat.audit) if (a.ok) vus.add(a.action);
          if ((etat.tableau ?? []).some((e) => e.rumeur)) vus.add('rumeur');
        }
      }
    }
    for (const a of ['verifierReponses', 'expertiser', 'verifierDossier', 'profiler', 'epingler', 'reagir', 'denoncer', 'rumeur']) expect(vus, a).toContain(a);
  });

  it("n'utilisent jamais ces actions dans une partie classique", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { etat, refus } = simulerPartie({ nbJoueurs: 4 + (seed % 3), seed });
      expect(refus).toEqual([]);
      expect(etat.audit.filter((a) => ACTIONS_GRANDE.includes(a.action))).toEqual([]);
    }
  });

  it('le Témoin cache le lieu : ses hypothèses ne visent pas toujours le vrai lieu', () => {
    let total = 0;
    let vraiLieu = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { etat } = simulerPartie({ nbJoueurs: 4, seed, config: CONFIG_GRANDE_ENQUETE });
      const temoin = etat.ordre.find((id) => etat.joueurs[id].roleEnquete === 'temoin')!;
      for (const h of etat.hypotheses.filter((x) => x.auteur === temoin)) {
        total++;
        if (h.original.lieu === etat.affaire.solution.lieu) vraiLieu++;
      }
    }
    expect(total).toBeGreaterThan(20);
    expect(vraiLieu / total).toBeLessThan(0.4);
  });

  it('la décision d’épingler est stable : interrogé deux fois, le bot fait le même choix', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const etat = nouvellePartie(5, { seed, config: { ...CONFIG_TEST, ...CONFIG_GRANDE_ENQUETE, modeComplice: 'ruse' } });
      for (const id of etat.ordre) {
        if (id === actif(etat)) continue;
        const a = decisionBot(vuePour(etat, id), seededRng(1));
        const b = decisionBot(vuePour(etat, id), seededRng(2));
        expect(a?.type ?? null).toBe(b?.type ?? null);
      }
    }
  });
});

describe('Ce que les pouvoirs apprennent aux bots', () => {
  const GRANDE: Partial<ConfigPartie> = { ...CONFIG_TEST, ...CONFIG_GRANDE_ENQUETE, modeComplice: 'ruse' };

  it("après une réponse malhonnête vérifiée par l'Inspecteur, le complice est l'un des joueurs qui ont répondu", () => {
    const h = new Horloge();
    for (let seed = 1; seed <= 60; seed++) {
      const etat = nouvellePartie(5, { seed, config: GRANDE });
      const moi = actif(etat);
      const c = etat.complice;
      if (moi === c || etat.joueurs[moi].role === 'maitre_chanteur') continue;
      const carte = etat.joueurs[c].main[0];
      const t = { ...etat.affaire.solution, [categorieDe(carte)!]: carte } as Triplet;
      const j = etat.joueurs[moi];
      j.roleEnquete = 'inspecteur';
      j.pouvoirs = { verifications: 2 };
      const autre = autres(etat, moi).find((x) => x !== c)!;
      act(etat, moi, { type: 'hypothese', ...t, interroges: [c, autre] }, h.avance(1));
      passerFalsification(etat, h);
      if (!act(etat, c, { type: 'mentir' }, h.avance(1)).ok) continue;
      if (etat.etape === 'hypothese') act(etat, autre, { type: 'repondre', carte: etat.joueurs[autre].main.find((x) => Object.values(t).includes(x)) ?? null }, h.avance(1));
      expect(act(etat, moi, { type: 'verifierReponses' }, h.avance(1)).ok).toBe(true);
      const cands = candidatsComplice(vuePour(etat, moi));
      expect(cands).toContain(c);
      expect(cands.every((x) => x === c || x === autre)).toBe(true);
      return;
    }
    throw new Error('Aucune partie de test ne convenait.');
  });

  it('le profilage resserre les soupçons', () => {
    const h = new Horloge();
    const etat = nouvellePartie(6, { seed: 3, config: GRANDE });
    const moi = etat.ordre.find((id) => id !== etat.complice && etat.joueurs[id].role === 'enqueteur')!;
    const j = etat.joueurs[moi];
    j.roleEnquete = 'profileur';
    j.pouvoirs = { profilages: 1 };
    for (let garde = 0; garde < 100 && !(etat.manche >= 6 && actif(etat) === moi); garde++) act(etat, actif(etat), { type: 'finTour' }, h.avance(1));
    const paire = [etat.complice, autres(etat, moi).find((x) => x !== etat.complice)!];
    expect(act(etat, moi, { type: 'profiler', joueurs: paire }, h.avance(1)).ok).toBe(true);
    expect(candidatsComplice(vuePour(etat, moi)).sort()).toEqual([...paire].sort());
  });
});
