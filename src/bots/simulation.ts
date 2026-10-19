// Simulation de parties complètes entre bots, sans réseau et en temps virtuel.

import type { ConfigPartie } from '../engine/config';
import { appliquerAction, avancer, creerPartie, prochaineEcheance, type EtatPartie } from '../engine/partie';
import { seededRng, type Rng } from '../engine/rng';
import { vuePour } from '../engine/vue';
import { decisionBot, PROFIL_PAR_DEFAUT, type ProfilBot } from './bot';

export interface ResultatSimulation {
  etat: EtatPartie;
  actions: number;
  refus: string[];
}

export function simulerPartie(params: {
  nbJoueurs: number;
  seed: number;
  config?: Partial<ConfigPartie>;
  profil?: ProfilBot;
  /** Appelé après chaque action (pour des vérifications pendant la partie). */
  apresAction?: (etat: EtatPartie) => void;
}): ResultatSimulation {
  const rng: Rng = seededRng(params.seed);
  const joueurs = Array.from({ length: params.nbJoueurs }, (_, i) => ({ id: `b${i + 1}`, nom: `Bot ${i + 1}`, bot: true }));
  let now = 0;
  const etat = creerPartie({ id: `sim-${params.seed}`, joueurs, rng, now, config: params.config });
  const refus: string[] = [];
  let actions = 0;

  for (let garde = 0; garde < 20_000 && etat.etape !== 'terminee'; garde++) {
    let agi = false;
    for (const id of etat.ordre) {
      const action = decisionBot(vuePour(etat, id), rng, params.profil ?? PROFIL_PAR_DEFAUT);
      if (!action) continue;
      now += 1;
      const r = appliquerAction(etat, id, action, now);
      actions++;
      if (!r.ok) {
        refus.push(`${id} ${action.type}: ${r.erreur}`);
        // Un bot qui insiste sur une action refusée finit son tour pour ne pas boucler.
        if (etat.etape === 'tour' && etat.ordre[etat.indexTour] === id) appliquerAction(etat, id, { type: 'finTour' }, now);
      }
      params.apresAction?.(etat);
      agi = true;
      break;
    }
    if (!agi) {
      const e = prochaineEcheance(etat);
      if (e === null) break;
      now = Math.max(now, e);
      avancer(etat, now, rng);
      params.apresAction?.(etat);
    }
  }
  return { etat, actions, refus };
}
