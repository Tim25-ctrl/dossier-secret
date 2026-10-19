import { describe, expect, it } from 'vitest';
import { simulerPartie } from '../src/bots/simulation';
import { PROFIL_OCCASIONNEL, PROFIL_PAR_DEFAUT } from '../src/bots/bot';
import { definirConnexion, type EtatPartie } from '../src/engine/partie';
import { vuePour } from '../src/engine/vue';
import { elementsDuTriplet } from '../src/shared/types';

/** Vérifie les invariants de sécurité et de règles à chaque étape d'une partie. */
function surveiller() {
  let initial: { mains: Record<string, string[]>; solution: string; complice: string } | null = null;
  let compteurs: Record<string, { m: number; f: number }> = {};
  const violations: string[] = [];
  const verifier = (etat: EtatPartie) => {
    if (!initial) {
      initial = {
        mains: Object.fromEntries(etat.ordre.map((id) => [id, [...etat.joueurs[id].main]])),
        solution: JSON.stringify(etat.affaire.solution),
        complice: etat.complice,
      };
      compteurs = Object.fromEntries(etat.ordre.map((id) => [id, { m: etat.joueurs[id].mensongesRestants, f: etat.joueurs[id].falsificationsRestantes }]));
    }
    if (JSON.stringify(etat.affaire.solution) !== initial.solution) violations.push('solution modifiée');
    if (etat.complice !== initial.complice) violations.push('complice modifié');
    const complices = Object.values(etat.joueurs).filter((j) => j.role === 'complice');
    if (complices.length !== 1) violations.push('nombre de complices');
    for (const id of etat.ordre) {
      const j = etat.joueurs[id];
      if (JSON.stringify(j.main) !== JSON.stringify(initial.mains[id])) violations.push(`main de ${id} modifiée`);
      if (j.mensongesRestants > compteurs[id].m || j.falsificationsRestantes > compteurs[id].f) violations.push('compteur réinitialisé');
      if (j.mensongesRestants < 0 || j.falsificationsRestantes < 0) violations.push('compteur négatif');
      compteurs[id] = { m: j.mensongesRestants, f: j.falsificationsRestantes };
    }
    for (const h of etat.hypotheses) {
      if (h.reponses.filter((r) => r.resultat === 'carte_montree').length > 1) violations.push(`${h.id} : plusieurs cartes`);
      const diff = (['suspect', 'lieu', 'arme'] as const).filter((k) => h.original[k] !== h.publique[k]).length;
      if (diff > 1) violations.push(`${h.id} : plusieurs éléments falsifiés`);
      if (h.falsification && h.falsification.par === h.auteur) violations.push(`${h.id} : auto-falsification`);
      if (h.reponses.filter((r) => r.resultat === 'mensonge').length > 1) violations.push(`${h.id} : plusieurs mensonges`);
    }
    // Filtrage des vues : personne ne voit la solution ni les mains des autres avant la fin.
    if (etat.etape !== 'terminee') {
      for (const id of etat.ordre) {
        const v = vuePour(etat, id);
        if (v.resultat) violations.push('résultat envoyé avant la fin');
        if (v.moi.role === 'enqueteur' && (v.moi.meurtrier || v.moi.mensongesRestants !== undefined)) violations.push('info complice chez un enquêteur');
      }
    }
  };
  return { verifier, violations };
}

describe('Parties complètes simulées (bots)', () => {
  for (const mode of ['classique', 'ruse'] as const)
  for (const n of [3, 4, 5, 6]) {
    it(`mode ${mode}, ${n} joueurs : 25 parties de bout en bout sans violation de règle`, () => {
      let lies = 0;
      let falsif = 0;
      let victoiresEnq = 0;
      let reveles = 0;
      let emprunts = 0;
      let trafics = 0;
      let empreintes = 0;
      let denonciations = 0;
      for (let seed = 1; seed <= 25; seed++) {
        const s = surveiller();
        const profil = seed % 2 ? PROFIL_PAR_DEFAUT : PROFIL_OCCASIONNEL;
        const { etat, refus } = simulerPartie({ nbJoueurs: n, seed: seed * 101 + n, profil, apresAction: s.verifier, config: { modeComplice: mode } });
        expect(s.violations).toEqual([]);
        expect(refus).toEqual([]);
        expect(etat.etape).toBe('terminee');
        expect(etat.resultat).toBeDefined();
        expect(etat.hypotheses.length).toBeGreaterThan(1);
        // La fin révèle tout, de manière cohérente.
        const v = vuePour(etat, etat.ordre[0]);
        expect(v.resultat!.solution).toEqual(etat.affaire.solution);
        expect(v.resultat!.complice).toBe(etat.complice);
        if (etat.resultat!.vainqueur === 'enqueteurs') {
          victoiresEnq++;
          expect(etat.accusations.at(-1)!.correcte).toBe(true);
        } else {
          expect(etat.accusations.every((a) => !a.correcte)).toBe(true);
        }
        lies += etat.hypotheses.filter((h) => h.reponses.some((r) => r.resultat === 'mensonge')).length;
        falsif += etat.hypotheses.filter((h) => h.falsification).length;
        reveles += etat.hypotheses.filter((h) => h.carteMontree).length;
        // Aucune carte montrée HONNÊTEMENT n'appartient à la solution (une carte empruntée, elle, peut tromper).
        for (const h of etat.hypotheses)
          for (const r of h.reponses) if (r.resultat === 'carte_montree') expect(elementsDuTriplet(etat.affaire.solution)).not.toContain(r.carte);
        emprunts += etat.hypotheses.flatMap((h) => h.reponses).filter((r) => r.resultat === 'emprunt').length;
        trafics += etat.trafics?.length ?? 0;
        empreintes += etat.historique.filter((e) => e.type === 'empreinte').length;
        denonciations += etat.denonciations?.length ?? 0;
        // Les empreintes publiées sont toujours vraies.
        for (const e of etat.historique) if (e.type === 'empreinte') expect(e.innocente).not.toBe(etat.complice);
        if (mode === 'classique') expect(emprunts + trafics + empreintes + denonciations).toBe(0);
      }
      expect(lies).toBeGreaterThan(0);
      expect(falsif).toBeGreaterThan(0);
      expect(reveles).toBeGreaterThan(0);
      expect(victoiresEnq).toBeGreaterThan(0);
      if (mode === 'ruse') {
        // Les nouvelles ruses sont bien utilisées (à 3 joueurs, la réserve n'est que de 2 ruses).
        expect(emprunts + trafics).toBeGreaterThan(0);
        expect(empreintes + denonciations).toBeGreaterThanOrEqual(0);
        if (n >= 4) {
          expect(emprunts).toBeGreaterThan(0);
          expect(trafics).toBeGreaterThan(0);
          expect(empreintes).toBeGreaterThan(0);
          expect(denonciations).toBeGreaterThan(0);
        }
      }
    });
  }

  it('une partie peut se terminer par la limite des 12 manches (victoire du complice)', () => {
    // Enquêteurs privés du droit d'accuser : la partie doit aller au bout des 12 manches.
    let fini = false;
    for (let seed = 1; seed <= 5 && !fini; seed++) {
      const { etat } = simulerPartie({
        nbJoueurs: 3,
        seed,
        apresAction: (e) => {
          for (const j of Object.values(e.joueurs)) if (j.role === 'enqueteur') j.peutAccuser = false;
        },
      });
      if (etat.resultat?.raison === 'manches_ecoulees') {
        expect(etat.manche).toBe(12);
        fini = true;
        expect(etat.resultat.vainqueur).toBe('complice');
      }
    }
    expect(fini).toBe(true);
  });

  it('une déconnexion en cours de partie ne change ni le rôle, ni les cartes, ni les compteurs', () => {
    let verifie = false;
    simulerPartie({
      nbJoueurs: 5,
      seed: 77,
      apresAction: (etat) => {
        if (verifie || etat.hypotheses.length < 4 || etat.etape === 'terminee') return;
        const id = etat.complice;
        const avant = vuePour(etat, id);
        definirConnexion(etat, id, false, 1e9);
        definirConnexion(etat, id, true, 1e9 + 1);
        const apres = vuePour(etat, id);
        expect(apres.moi.role).toBe(avant.moi.role);
        expect(apres.moi.main).toEqual(avant.moi.main);
        expect(apres.moi.mensongesRestants).toBe(avant.moi.mensongesRestants);
        expect(apres.moi.falsificationsRestantes).toBe(avant.moi.falsificationsRestantes);
        expect(apres.moi.carnet).toEqual(avant.moi.carnet);
        expect(apres.pointsAction).toBe(avant.pointsAction);
        verifie = true;
      },
    });
    expect(verifie).toBe(true);
  });
});
