// Préférences locales du joueur (stockées dans ce navigateur uniquement).
import { useState } from 'react';
import { reglerAmbiance } from './ambianceSonore';
import { reglerStyleHistorique } from './components/jeu/Roman';
import { reglerSons, reglerVibrations, type CanalSon, type ReglageCanal } from './sons';

export interface Preferences {
  taille: 'normal' | 'grand';
  animations: 'normales' | 'reduites';
  pseudo: string;
  tutorielVu: boolean;
  /** Interrupteur général de tous les sons. */
  son: boolean;
  /** Volume général, de 0 à 1 (multiplie celui de chaque sorte de son). */
  volumeGeneral: number;
  /** Chaque sorte de son : activée ou non, et son volume (réglages avancés). */
  canaux: Record<CanalSon, ReglageCanal>;
  /** Vibrations du téléphone (mon tour, interrogation). */
  vibrations: boolean;
  /** Style de l'historique de la partie. */
  historique: 'roman' | 'simple';
  /** Conseils pendant les premières parties. */
  conseils: boolean;
  /** Conseils déjà lus (« Compris »). */
  conseilsVus: string[];
  /** Chapitres de la partie guidée terminés (identifiants de tutoriel/chapitres.tsx). */
  chapitresGuide: string[];
}

const CLE = 'dossier-secret:preferences';
export const CANAUX_PAR_DEFAUT: Record<CanalSon, ReglageCanal> = {
  bruitages: { actif: true, volume: 0.75 },
  tictac: { actif: true, volume: 0.75 },
  messages: { actif: true, volume: 0.75 },
  ambiance: { actif: true, volume: 0.5 },
  horloge: { actif: true, volume: 0.5 },
  musique: { actif: true, volume: 0.5 },
};
const DEFAUT: Preferences = {
  taille: 'normal',
  animations: 'normales',
  pseudo: '',
  tutorielVu: false,
  son: true,
  volumeGeneral: 0.8,
  canaux: CANAUX_PAR_DEFAUT,
  vibrations: true,
  historique: 'roman',
  conseils: true,
  conseilsVus: [],
  chapitresGuide: [],
};

const borne = (x: number) => Math.min(1, Math.max(0, x));

/** Préférences enregistrées par une version plus ancienne (un seul volume de bruitages, un pour l'ambiance). */
interface Anciennes {
  volume?: number;
  ambiance?: boolean;
  musique?: boolean;
  volumeAmbiance?: number;
}

export function lire(): Preferences {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? '{}') as Partial<Preferences> & Anciennes;
    const { volume, ambiance, musique, volumeAmbiance, ...reste } = brut;
    const p: Preferences = { ...DEFAUT, ...reste };
    if (brut.canaux) p.canaux = { ...CANAUX_PAR_DEFAUT, ...brut.canaux };
    else if (volume !== undefined || ambiance !== undefined || musique !== undefined || volumeAmbiance !== undefined) {
      // Reprise des anciens réglages : mêmes volumes qu'avant, sous un volume général de 80 %.
      const g = DEFAUT.volumeGeneral;
      const amb = borne((volumeAmbiance ?? 0.4) / g);
      p.canaux = {
        ...CANAUX_PAR_DEFAUT,
        bruitages: { actif: true, volume: borne((volume ?? 0.6) / g) },
        ambiance: { actif: ambiance ?? true, volume: amb },
        horloge: { actif: ambiance ?? true, volume: amb },
        musique: { actif: musique ?? true, volume: amb },
      };
    }
    return p;
  } catch {
    return DEFAUT;
  }
}

export function appliquer(p: Preferences) {
  document.documentElement.dataset.taille = p.taille;
  document.documentElement.dataset.animations = p.animations;
  reglerSons(p.son, p.volumeGeneral, p.canaux);
  reglerAmbiance({ sons: p.son, general: p.volumeGeneral, ambiance: p.canaux.ambiance, horloge: p.canaux.horloge, musique: p.canaux.musique });
  reglerVibrations(p.vibrations);
  reglerStyleHistorique(p.historique);
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
