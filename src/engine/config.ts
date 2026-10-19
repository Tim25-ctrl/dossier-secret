// Paramètres de règles. Valeurs validées : 1 complice, 12 manches, 2 PA par tour.
// Corrections d'équilibrage décidées après simulations (voir docs/EQUILIBRAGE.md) :
//  - les cartes restantes (4 et 6 joueurs) deviennent des pièces à conviction dans les archives ;
//  - une hypothèse coûte 2 PA ;
//  - les pouvoirs du complice dépendent du nombre de joueurs.

export interface ConfigPartie {
  manchesMax: number;
  pointsAction: number;
  /** Nombre maximal d'hypothèses par tour. */
  hypothesesMaxParTour: number;
  /** Coût d'une hypothèse en points d'action. */
  coutHypothese: number;
  /** Utilisations des pouvoirs selon le nombre de joueurs. */
  pouvoirs: Record<number, { mensonges: number; falsifications: number }>;
  /** Cartes non distribuées : posées face visible, ou rangées dans les archives (pièces à conviction). */
  cartesRestantes: 'publiques' | 'archives';
  /** Manches d'ouverture des pièces à conviction (une par carte restante). */
  ouverturePieces: number[];

  /** Durée fixe de l'étape de falsification (identique pour chaque hypothèse, pour ne rien trahir). */
  delaiFalsificationMs: number;
  delaiReponseMs: number;
  /** Durée maximale d'un tour ; null = sans limite (un joueur déconnecté reste limité). */
  delaiTourMs: number | null;
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
  coutHypothese: 2,
  pouvoirs: {
    3: { mensonges: 2, falsifications: 1 },
    4: { mensonges: 2, falsifications: 1 },
    5: { mensonges: 3, falsifications: 2 },
    6: { mensonges: 3, falsifications: 2 },
  },
  cartesRestantes: 'archives',
  ouverturePieces: [2, 4, 6],

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

/** Pouvoirs du complice pour une table de cette taille. */
export function pouvoirsPour(config: ConfigPartie, nbJoueurs: number) {
  return config.pouvoirs?.[nbJoueurs] ?? { mensonges: 2, falsifications: 1 };
}

/** Règles d'avant les corrections d'équilibrage (pour comparaison dans les simulations). */
export const REGLES_INITIALES: Partial<ConfigPartie> = {
  coutHypothese: 1,
  cartesRestantes: 'publiques',
  pouvoirs: {
    3: { mensonges: 2, falsifications: 1 },
    4: { mensonges: 2, falsifications: 1 },
    5: { mensonges: 2, falsifications: 1 },
    6: { mensonges: 2, falsifications: 1 },
  },
};

export function nbInterroges(nbJoueurs: number): number {
  const n = NB_INTERROGES[nbJoueurs];
  if (!n) throw new Error(`Nombre de joueurs invalide : ${nbJoueurs}`);
  return n;
}
