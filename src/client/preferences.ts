// Préférences locales du joueur (stockées dans ce navigateur uniquement).
import { useState } from 'react';
import { reglerSons } from './sons';

export interface Preferences {
  taille: 'normal' | 'grand';
  animations: 'normales' | 'reduites';
  pseudo: string;
  tutorielVu: boolean;
  /** Bruitages activés. */
  son: boolean;
  /** Volume des bruitages, de 0 à 1. */
  volume: number;
  /** Conseils pendant les premières parties. */
  conseils: boolean;
  /** Conseils déjà lus (« Compris »). */
  conseilsVus: string[];
}

const CLE = 'dossier-secret:preferences';
const DEFAUT: Preferences = { taille: 'normal', animations: 'normales', pseudo: '', tutorielVu: false, son: true, volume: 0.6, conseils: true, conseilsVus: [] };

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
