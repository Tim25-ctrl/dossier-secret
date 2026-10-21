// Préférences locales du joueur (stockées dans ce navigateur uniquement).
import { useState } from 'react';
import { reglerAmbiance } from './ambianceSonore';
import { reglerSons, reglerVibrations } from './sons';

export interface Preferences {
  taille: 'normal' | 'grand';
  animations: 'normales' | 'reduites';
  pseudo: string;
  tutorielVu: boolean;
  /** Bruitages activés. */
  son: boolean;
  /** Volume des bruitages, de 0 à 1. */
  volume: number;
  /** Ambiance sonore de la partie (pluie, vent, horloge…). */
  ambiance: boolean;
  /** Musique pendant la partie. */
  musique: boolean;
  /** Volume commun de l'ambiance et de la musique, de 0 à 1. */
  volumeAmbiance: number;
  /** Vibrations du téléphone (mon tour, interrogation). */
  vibrations: boolean;
  /** Conseils pendant les premières parties. */
  conseils: boolean;
  /** Conseils déjà lus (« Compris »). */
  conseilsVus: string[];
  /** Parties guidées terminées jusqu'au bout (rôle appris). */
  guidesTermines: ('enqueteur' | 'complice')[];
}

const CLE = 'dossier-secret:preferences';
const DEFAUT: Preferences = { taille: 'normal', animations: 'normales', pseudo: '', tutorielVu: false, son: true, volume: 0.6, ambiance: true, musique: true, volumeAmbiance: 0.4, vibrations: true, conseils: true, conseilsVus: [], guidesTermines: [] };

function lire(): Preferences {
  try {
    return { ...DEFAUT, ...(JSON.parse(localStorage.getItem(CLE) ?? '{}') as Partial<Preferences>) };
  } catch {
    return DEFAUT;
  }
}

export function appliquer(p: Preferences) {
  document.documentElement.dataset.taille = p.taille;
  document.documentElement.dataset.animations = p.animations;
  reglerSons(p.son, p.volume);
  reglerAmbiance({ sons: p.son, ambiance: p.ambiance, musique: p.musique, volume: p.volumeAmbiance });
  reglerVibrations(p.vibrations);
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(() => {
    const p = lire();
    appliquer(p);
    return p;
  });
  const maj = (partiel: Partial<Preferences>) => {
    setPrefs((avant) => {
      const p = { ...avant, ...partiel };
      try {
        localStorage.setItem(CLE, JSON.stringify(p));
      } catch {
        /* stockage indisponible */
      }
      appliquer(p);
      return p;
    });
  };
  return [prefs, maj] as const;
}
