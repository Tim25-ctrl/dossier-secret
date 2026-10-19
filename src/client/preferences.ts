// Préférences locales du joueur (stockées dans ce navigateur uniquement).
import { useState } from 'react';

export interface Preferences {
  taille: 'normal' | 'grand';
  animations: 'normales' | 'reduites';
  pseudo: string;
  tutorielVu: boolean;
}

const CLE = 'dossier-secret:preferences';
const DEFAUT: Preferences = { taille: 'normal', animations: 'normales', pseudo: '', tutorielVu: false };

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
