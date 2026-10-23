// Paramètres de règles. Valeurs validées : 1 complice, 12 manches, 2 PA par tour.
// Corrections d'équilibrage décidées après simulations (voir docs/EQUILIBRAGE.md) :
//  - les cartes restantes (4 et 6 joueurs) deviennent des pièces à conviction dans les archives ;
//  - une hypothèse coûte 2 PA ;
//  - les pouvoirs du complice dépendent du nombre de joueurs.

import type { AffaireId, ModeComplice, ModeJeu, HistoriqueCartes, ObjectifComplice, RoleEnquete, TypeRuse } from '../shared/types';

/** « Grande enquête » : objectifs secrets du complice (docs/GRANDE-ENQUETE.md, section 6). */
export interface ConfigObjectifs {
  tirables: ObjectifComplice[];
  /** Le témoin gênant : temps laissé au complice pour désigner le Témoin. */
  delaiDesignationMs: number;
  /** Le bouc émissaire : accusations finales nécessaires, selon le nombre de joueurs. */
  accusationsBouc: Record<number, number>;
  /** L'ombre : nombre de ruses à utiliser. */
  rusesOmbre: number;
}

/** « Grande enquête » : rôles secrets et pouvoirs (docs/GRANDE-ENQUETE.md, sections 5 et 7). */
export interface ConfigRoles {
  /** Rôles tirés au sort pour les enquêteurs autres que le Témoin (toujours en jeu). */
  tirables: RoleEnquete[];
  /** Nombre d'utilisations de chaque pouvoir. */
  utilisations: {
    inspecteur: number;
    legiste: number;
    archivesGratuites: number;
    verificationsDossier: number;
    profileur: number;
    journaliste: number;
  };
  /** Le Légiste ne peut pas servir avant cette manche. */
  mancheExpertise: number;
  /** Le Profileur ne peut pas servir avant cette manche. */
  mancheProfilage: number;
  /** Un Maître chanteur à partir de ce nombre de joueurs. */
  maitreChanteurDes: number;
}

export interface ConfigPartie {
  /** Histoire jouée (suspects, lieux, armes et indices). */
  affaire: AffaireId;
  /** Partie classique, ou « Grande enquête » (le mobile s'ajoute à la solution ; 4 joueurs au moins). */
  mode: ModeJeu;
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


  /**
   * Avant le premier tour, chacun lit son rôle et confirme qu'il est prêt ; la partie commence quand
   * tous les joueurs humains l'ont fait, ou au plus tard après ce délai. Absent ou null : pas d'attente.
   */
  attenteDepartMs?: number | null;

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
  /** « Grande enquête » : nombre minimal de dossiers d'archives consacrés aux mobiles. */
  nbIndicesMobiles?: number;
  /** « Grande enquête » : rôles secrets des joueurs (absent = pas de rôles). */
  roles?: ConfigRoles;
  /** « Grande enquête » : objectif secret du complice (absent = pas d'objectif). */
  objectifs?: ConfigObjectifs;
  /** « Grande enquête » : tableau d'enquête commun (absent = pas de tableau). */
  tableau?: {
    /** Épingles signées par joueur et par manche (une rumeur compte à part). */
    epinglesParManche: number;
    /** Épingles signées affichées par joueur : au-delà, la plus ancienne disparaît. */
    maxAffichees: number;
    /** Longueur maximale du petit mot. */
    noteMax: number;
  };
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
  mode: 'classique',
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

/**
 * Réglages propres à la « Grande enquête » (docs/GRANDE-ENQUETE.md), appliqués par-dessus la config.
 * Premiers chiffres, à régler par simulation.
 */
export const CONFIG_GRANDE_ENQUETE: Partial<ConfigPartie> = {
  mode: 'grande',
  manchesMax: 14,
  // Réglage K de l'étape 7 (choisi par l'auteur le 23/10/2026, docs/GRANDE-ENQUETE.md) : une question
  // de plus demande plus d'actions — 3 points d'action par tour (une hypothèse ET un dossier) — et le
  // complice a 3 ruses à 4 joueurs, 5 à 5 joueurs, 6 à 6 joueurs.
  pointsAction: 3,
  ruses: { 3: 2, 4: 3, 5: 5, 6: 6 },
  // Avec le mobile, il y a 6 fois plus de combinaisons : même exigence que la partie classique
  // (au moins 4 meurtrier / lieu / arme possibles avec les seuls indices), multipliée par les 6 mobiles.
  minCombinaisonsIndices: 24,
  // Une question de plus, donc plus d'archives : 8 dossiers, dont au moins 2 sur les mobiles.
  nbDossiersArchives: 8,
  nbIndicesMobiles: 2,
  ouvertureDossiers: [1, 2, 3, 4, 5, 7, 9, 11],
  roles: {
    tirables: ['inspecteur', 'legiste', 'archiviste', 'journaliste', 'profileur'],
    utilisations: { inspecteur: 2, legiste: 1, archivesGratuites: 2, verificationsDossier: 1, profileur: 1, journaliste: 3 },
    mancheExpertise: 3,
    mancheProfilage: 6,
    maitreChanteurDes: 5,
  },
  objectifs: {
    tirables: ['temoin_genant', 'bouc_emissaire', 'ombre'],
    delaiDesignationMs: 30_000,
    // Une seule accusation suffit, quelle que soit la table (décision de l'auteur, 23/10/2026).
    accusationsBouc: { 4: 1, 5: 1, 6: 1 },
    rusesOmbre: 3,
  },
  tableau: { epinglesParManche: 1, maxAffichees: 4, noteMax: 80 },
};

/** La solution de cette partie comprend-elle un mobile ? */
export function avecMobile(config: Pick<ConfigPartie, 'mode'>): boolean {
  return config.mode === 'grande';
}

/** Nombre de joueurs interrogés selon le nombre total de joueurs. */
export const NB_INTERROGES: Record<number, number> = { 3: 1, 4: 2, 5: 2, 6: 3 };

export const JOUEURS_MIN = 3;
export const JOUEURS_MAX = 6;
/** La « Grande enquête » se joue à 4 joueurs au moins. */
export const JOUEURS_MIN_GRANDE = 4;

/** Nombre minimal de joueurs pour ce mode. */
export function joueursMin(config: Pick<ConfigPartie, 'mode'>): number {
  return config.mode === 'grande' ? JOUEURS_MIN_GRANDE : JOUEURS_MIN;
}

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
