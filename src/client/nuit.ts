// La nuit qui avance : chaque manche correspond à une demi-heure de la nuit du crime.
// Manoir : de 23 h 30 à 5 h ; train : de 2 h à 7 h 30 ; paquebot : de 1 h à 6 h 30. Purement décoratif (aucun effet sur le jeu).

import { useEffect, useRef } from 'react';
import type { AffaireId } from '../shared/types';
import { arreterAmbiance, definirAube, definirTension, demarrerAmbiance, sonnerManche } from './ambianceSonore';

const DEBUT_MINUTES: Record<AffaireId, number> = { manoir: 23 * 60 + 30, train: 2 * 60, paquebot: 60 };

export function minutesDeManche(affaire: AffaireId, manche: number): number {
  return ((DEBUT_MINUTES[affaire] ?? DEBUT_MINUTES.manoir) + (Math.max(1, manche) - 1) * 30) % (24 * 60);
}

/** « 23 h 30 », « minuit », « 1 h », « 0 h 30 ». */
export function heureDeManche(affaire: AffaireId, manche: number): string {
  const m = minutesDeManche(affaire, manche);
  const h = Math.floor(m / 60);
  const mn = m % 60;
  if (h === 0 && mn === 0) return 'minuit';
  return mn ? `${h} h ${String(mn).padStart(2, '0')}` : `${h} h`;
}

/**
 * Obscurité (voile sombre, de 0 à ~0,4) et aube (lueur à l'horizon, de 0 à 1) pour une manche :
 * la nuit s'épaissit jusqu'aux deux tiers de la partie, puis l'aube se lève.
 */
export function phaseNuit(manche: number, manchesMax: number): { obscurite: number; aube: number } {
  const p = manchesMax > 1 ? Math.min(1, Math.max(0, (manche - 1) / (manchesMax - 1))) : 0;
  const obscurite = p < 0.6 ? 0.08 + 0.3 * (p / 0.6) : 0.38 - 0.26 * ((p - 0.6) / 0.4);
  const aube = p < 0.7 ? 0 : Math.min(1, (p - 0.7) / 0.3);
  return { obscurite, aube };
}

/**
 * Ambiance sonore de la partie : démarrée à l'ouverture, arrêtée en la quittant ; l'horloge (ou la
 * cloche du train) sonne à chaque nouvelle manche, la musique se tend dans les deux dernières.
 */
export function useAmbianceSonore(affaire: AffaireId, manche: number, manchesMax: number, terminee: boolean) {
  useEffect(() => {
    demarrerAmbiance(affaire);
    return () => arreterAmbiance();
  }, [affaire]);

  const precedente = useRef(manche);
  useEffect(() => {
    definirAube(phaseNuit(manche, manchesMax).aube);
    definirTension(!terminee && manche >= manchesMax - 1);
    if (manche > precedente.current) sonnerManche(minutesDeManche(affaire, manche));
    precedente.current = manche;
  }, [affaire, manche, manchesMax, terminee]);
}
