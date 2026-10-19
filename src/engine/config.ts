// Paramètres de règles. Les valeurs « validées » de la première version
// (1 complice, 2 mensonges, 1 falsification, 12 manches, 2 PA) ne doivent pas
// être modifiées sans décision explicite.

export interface ConfigPartie {
  manchesMax: number;
  pointsAction: number;
  /** Nombre maximal d'hypothèses par tour (une hypothèse coûte 1 PA). */
  hypothesesMaxParTour: number;
  mensonges: number;
  falsifications: number;

  /** Durée fixe de l'étape de falsification (identique pour chaque hypothèse, pour ne rien trahir). */
  delaiFalsificationMs: number;
  delaiReponseMs: number;
  delaiTourMs: number;
  /** Délai de tour réduit lorsque le joueur concerné est déconnecté. */
  delaiDeconnecteMs: number;
  /** Temps minimal laissé au joueur actif après la résolution de son hypothèse. */
  delaiRepriseTourMs: number;

  nbDossiersArchives: number;
  nbIndicesPublicsDepart: number;
  /** Manches au début desquelles un nouvel indice est versé au dossier public. */
  manchesIndicesPublics: number[];
  /** Manches à partir desquelles chaque dossier d'archives devient consultable. */
  ouvertureDossiers: number[];
  /** Nombre minimal de combinaisons restantes si l'on ne connaît QUE les indices. */
  minCombinaisonsIndices: number;
}

export const CONFIG_PAR_DEFAUT: ConfigPartie = {
  manchesMax: 12,
  pointsAction: 2,
  hypothesesMaxParTour: 1,
  mensonges: 2,
  falsifications: 1,

  delaiFalsificationMs: 8_000,
  delaiReponseMs: 60_000,
  delaiTourMs: 180_000,
  delaiDeconnecteMs: 25_000,
  delaiRepriseTourMs: 45_000,

  // Volume d'indices choisi d'après les simulations (voir docs/EQUILIBRAGE.md) :
  // assez pour enquêter, sans rendre l'affaire triviale.
  nbDossiersArchives: 6,
  nbIndicesPublicsDepart: 1,
  manchesIndicesPublics: [6],
  ouvertureDossiers: [1, 2, 3, 5, 7, 9],
  minCombinaisonsIndices: 4,
};

/** Nombre de joueurs interrogés selon le nombre total de joueurs. */
export const NB_INTERROGES: Record<number, number> = { 3: 1, 4: 2, 5: 2, 6: 3 };

export const JOUEURS_MIN = 3;
export const JOUEURS_MAX = 6;

export function nbInterroges(nbJoueurs: number): number {
  const n = NB_INTERROGES[nbJoueurs];
  if (!n) throw new Error(`Nombre de joueurs invalide : ${nbJoueurs}`);
  return n;
}
