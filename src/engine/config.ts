// Paramètres de règles. Valeurs validées : 1 complice, 12 manches, 2 PA par tour.
// Corrections d'équilibrage décidées après simulations (voir docs/EQUILIBRAGE.md) :
//  - les cartes restantes (4 et 6 joueurs) deviennent des pièces à conviction dans les archives ;
//  - une hypothèse coûte 2 PA ;
//  - les pouvoirs du complice dépendent du nombre de joueurs.

import type { AffaireId, ModeComplice, HistoriqueCartes, TypeRuse } from '../shared/types';

export interface ConfigPartie {
  /** Histoire jouée (suspects, lieux, armes et indices). */
  affaire: AffaireId;
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
  /** « classique » : mensonges + falsifications ; « ruse » : réserve de ruses, empreintes, dénonciation. */
  modeComplice: ModeComplice;
  /** Mode « rusé » : nombre de ruses selon le nombre de joueurs. */
  ruses: Record<number, number>;
  /** Mode « rusé » : coût de chaque ruse (en ruses). */
  coutRuses: Record<TypeRuse, number>;
  /** Cartes montrées et reçues : rappelées dans l'historique (« visibles ») ou non (« anonymes », difficile). */
  historiqueCartes: HistoriqueCartes;
  /** Mode « rusé » : probabilité qu'une ruse laisse une empreinte, selon la taille de la table. */
  probaEmpreinte: Record<number, number>;
  /** Mode « rusé » : une empreinte est publiée entre [min, max] manches après la ruse… */
  delaiEmpreinte: [number, number];
  /** … et jamais avant cette manche. */
  premiereMancheEmpreinte: number;
  /** Mode « rusé » : jusqu'à cette taille de table, l'empreinte ne nomme personne (seulement la manche de la ruse). */
  empreinteAnonymeJusqua: number;
  /** Mode « rusé » : nombre de manches pendant lesquelles les ruses d'un complice démasqué sont suspendues. */
  suspensionDemasque: number;


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
  /** N'utiliser que des indices relationnels (aucun indice n'écarte directement un élément détenu par un joueur). */
  indicesRelationnels: boolean;
}

export const CONFIG_PAR_DEFAUT: ConfigPartie = {
  affaire: 'manoir',
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
  modeComplice: 'ruse',
  ruses: { 3: 2, 4: 4, 5: 5, 6: 5 },
  coutRuses: { mensonge: 1, falsification: 1, emprunt: 2, trafic: 1 },
  // Peu de suspects à 3 ou 4 joueurs : une seule empreinte y pèse lourd, elles y sont donc plus rares.
  historiqueCartes: 'visibles',
  probaEmpreinte: { 3: 0.35, 4: 0.4, 5: 0.5, 6: 0.6 },
  // Empreintes tardives (décision du 20/10/2026) : le complice peut ruser en début de partie sans se griller.
  delaiEmpreinte: [2, 3],
  premiereMancheEmpreinte: 4,
  // À 3 joueurs, « n'appartient pas à X » désignerait directement le complice : l'empreinte y est anonyme.
  empreinteAnonymeJusqua: 3,
  // Démasqué, le complice ne perd plus ses ruses : elles sont suspendues 3 manches.
  suspensionDemasque: 3,

  delaiFalsificationMs: 8_000,
  delaiReponseMs: 60_000,
  delaiTourMs: 180_000,
  delaiDeconnecteMs: 25_000,
  delaiRepriseTourMs: 45_000,

  // Volume d'indices choisi d'après les simulations (voir docs/EQUILIBRAGE.md) :
  // assez pour enquêter, sans rendre l'affaire triviale.
  nbDossiersArchives: 6,
  // Plus d'indice public gratuit (décision du 20/10/2026) : toute l'information passe par les
  // cartes, les hypothèses et les archives. Le moteur sait toujours en publier si on le règle.
  nbIndicesPublicsDepart: 0,
  manchesIndicesPublics: [],
  ouvertureDossiers: [1, 2, 3, 5, 7, 9],
  minCombinaisonsIndices: 4,
  indicesRelationnels: true,
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
  modeComplice: 'classique',
  coutHypothese: 1,
  cartesRestantes: 'publiques',
  nbIndicesPublicsDepart: 1,
  manchesIndicesPublics: [6],
  pouvoirs: {
    3: { mensonges: 2, falsifications: 1 },
    4: { mensonges: 2, falsifications: 1 },
    5: { mensonges: 2, falsifications: 1 },
    6: { mensonges: 2, falsifications: 1 },
  },
};

/** Nombre de ruses du complice pour une table de cette taille (mode « rusé »). */
export function rusesPour(config: ConfigPartie, nbJoueurs: number): number {
  return config.ruses?.[nbJoueurs] ?? 3;
}

/** Coût d'une ruse (mode « rusé »). */
export function coutRuse(config: ConfigPartie, ruse: TypeRuse): number {
  return config.coutRuses?.[ruse] ?? 1;
}

export function nbInterroges(nbJoueurs: number): number {
  const n = NB_INTERROGES[nbJoueurs];
  if (!n) throw new Error(`Nombre de joueurs invalide : ${nbJoueurs}`);
  return n;
}
