// Outils communs aux tests du moteur.
import { appliquerAction, avancer, creerPartie, type EtatPartie } from '../src/engine/partie';
import { seededRng } from '../src/engine/rng';
import { vuePour } from '../src/engine/vue';
import type { ConfigPartie } from '../src/engine/config';
import type { ActionJeu, ElementId, Triplet } from '../src/shared/types';
import { ARMES, LIEUX, SUSPECTS, categorieDe } from '../src/shared/types';

export const T0 = 1_000_000;
export const FALSIF_MS = 1_000;

export const CONFIG_TEST: Partial<ConfigPartie> = {
  delaiFalsificationMs: FALSIF_MS,
  delaiReponseMs: 10_000,
  delaiTourMs: 60_000,
  delaiDeconnecteMs: 5_000,
  delaiRepriseTourMs: 20_000,
};

export function nouvellePartie(n: number, opts: { seed?: number; solution?: Triplet; complice?: string; config?: Partial<ConfigPartie> } = {}) {
  const joueurs = Array.from({ length: n }, (_, i) => ({ id: `j${i + 1}`, nom: `Joueur ${i + 1}` }));
  return creerPartie({
    id: 'test',
    joueurs,
    rng: seededRng(opts.seed ?? 42),
    now: T0,
    config: { ...CONFIG_TEST, ...opts.config },
    imposer: { solution: opts.solution, complice: opts.complice },
  });
}

export const SOLUTION: Triplet = { suspect: 'victor', lieu: 'cave', arme: 'dague' };

/** Horloge simulée. */
export class Horloge {
  t = T0;
  avance(ms: number) {
    this.t += ms;
    return this.t;
  }
}

export function act(etat: EtatPartie, joueur: string, action: ActionJeu, t: number) {
  return appliquerAction(etat, joueur, action, t);
}

export function actif(etat: EtatPartie) {
  return etat.ordre[etat.indexTour];
}

/** Construit un triplet qui contient la carte donnée, complété par des éléments de la solution. */
export function tripletAvec(etat: EtatPartie, cartes: ElementId[]): Triplet {
  const t: Triplet = { ...etat.affaire.solution };
  for (const c of cartes) {
    const cat = categorieDe(c)!;
    (t as unknown as Record<string, ElementId>)[cat] = c;
  }
  return t;
}

/** Fait passer l'étape de falsification. */
export function passerFalsification(etat: EtatPartie, h: Horloge) {
  avancer(etat, h.avance(FALSIF_MS));
}

/** Rend `joueur` actif en terminant les tours précédents. */
export function allerAuTourDe(etat: EtatPartie, joueur: string, h: Horloge) {
  let garde = 0;
  while (actif(etat) !== joueur && garde++ < 20) {
    const r = act(etat, actif(etat), { type: 'finTour' }, h.avance(1));
    if (!r.ok) throw new Error(r.erreur);
  }
}

export function autres(etat: EtatPartie, joueur: string) {
  return etat.ordre.filter((id) => id !== joueur);
}

/** Recherche un élément qu'aucun joueur ne détient (élément de la solution). */
export function elementSolution(etat: EtatPartie, cat: 'suspect' | 'lieu' | 'arme') {
  return etat.affaire.solution[cat];
}

export { SUSPECTS, LIEUX, ARMES, vuePour };
