// Types partagés entre le moteur, le serveur et le client.
// Ce fichier ne contient AUCUNE donnée secrète : uniquement des formes de données.

export const SUSPECTS = ['eleonore', 'victor', 'morel', 'marchand', 'camille', 'gabriel'] as const;
export const LIEUX = ['bureau', 'bibliotheque', 'serre', 'cave', 'salle_a_manger', 'salon_musique'] as const;
export const ARMES = ['chandelier', 'coupe_papier', 'revolver', 'dague', 'presse_papier', 'poison'] as const;

export type SuspectId = (typeof SUSPECTS)[number];
export type LieuId = (typeof LIEUX)[number];
export type ArmeId = (typeof ARMES)[number];
export type ElementId = SuspectId | LieuId | ArmeId;
export type Categorie = 'suspect' | 'lieu' | 'arme';

/** Échéance « infinie » (tour sans limite de temps). Valeur sûre en JSON. */
export const SANS_LIMITE = Number.MAX_SAFE_INTEGER;

export const TOUS_ELEMENTS: readonly ElementId[] = [...SUSPECTS, ...LIEUX, ...ARMES];

export function categorieDe(id: string): Categorie | null {
  if ((SUSPECTS as readonly string[]).includes(id)) return 'suspect';
  if ((LIEUX as readonly string[]).includes(id)) return 'lieu';
  if ((ARMES as readonly string[]).includes(id)) return 'arme';
  return null;
}

/** Un triplet meurtrier / lieu / arme : solution, hypothèse ou accusation. */
export interface Triplet {
  suspect: SuspectId;
  lieu: LieuId;
  arme: ArmeId;
}

export type ChampTriplet = keyof Triplet;

export function elementsDuTriplet(t: Triplet): ElementId[] {
  return [t.suspect, t.lieu, t.arme];
}

export function memeTriplet(a: Triplet, b: Triplet): boolean {
  return a.suspect === b.suspect && a.lieu === b.lieu && a.arme === b.arme;
}

// ---------------------------------------------------------------------------
// Indices
// ---------------------------------------------------------------------------

export type CategorieIndice =
  | 'temoignage'
  | 'objet'
  | 'horaire'
  | 'deplacement'
  | 'document'
  | 'trace'
  | 'contradiction';

/**
 * Règle logique portée par un indice. Toutes les règles d'un indice doivent être
 * vraies pour la solution de la partie, sinon l'indice ne peut pas être utilisé.
 */
export type RegleIndice =
  /** L'élément ne fait pas partie de la solution. */
  | { type: 'pas'; element: ElementId }
  /** Les deux éléments ne font pas partie de la solution en même temps. */
  | { type: 'pasEnsemble'; a: ElementId; b: ElementId }
  /** L'élément de la solution (d'une même catégorie) fait partie de cette liste. */
  | { type: 'parmi'; elements: ElementId[] }
  /** Si « si » fait partie de la solution, alors « alors » aussi. */
  | { type: 'siAlors'; si: ElementId; alors: ElementId };

/** Endroits du manoir qui ne sont pas des lieux possibles du crime. */
export const AUTRES_ENDROITS = {
  hall: 'le hall',
  petit_salon: 'le petit salon',
  cuisine: 'la cuisine',
  chambres: "l'étage des chambres",
  grenier: 'le grenier des archives',
  vitrine: 'la vitrine verrouillée du hall',
  gue: 'la maison du passeur, hors du domaine',
} as const;
export type AutreEndroit = keyof typeof AUTRES_ENDROITS;
export type Endroit = LieuId | AutreEndroit;

/**
 * Fait chronologique : une personne ou une arme se trouvait à un endroit
 * pendant tout un intervalle (heures « HH:MM »).
 */
export interface FaitChronologique {
  entite: SuspectId | ArmeId;
  endroit: Endroit;
  de: string;
  a: string;
}

export type Precision = 'faible' | 'moyenne' | 'forte';

/** Catégorie d'un dossier d'archives : un indice, ou une pièce à conviction (carte non distribuée). */
export type CategorieDossier = CategorieIndice | 'piece';

export interface CarteIndice {
  id: string;
  titre: string;
  texte: string;
  categorie: CategorieIndice;
  /** Éléments de solution auxquels l'indice se rapporte. */
  concerne: ElementId[];
  /** Règles déclarées ; les règles déduites des faits s'y ajoutent automatiquement. */
  regles: RegleIndice[];
  faits?: FaitChronologique[];
  /** Indices qui ne peuvent pas figurer dans la même affaire (contradiction narrative). */
  incompatibleAvec?: string[];
  /** Condition de disponibilité : l'indice ne peut être consulté qu'à partir de cette manche. */
  disponibleDesManche: number;
}

// ---------------------------------------------------------------------------
// Partie : rôles, actions, vues
// ---------------------------------------------------------------------------

export type Role = 'enqueteur' | 'complice';
export type Marque = 'inconnu' | 'ecarte' | 'probable' | 'certain';

export interface Carnet {
  marques: Partial<Record<ElementId, Marque>>;
  notes: string;
}

export type ActionJeu =
  | { type: 'hypothese'; suspect: SuspectId; lieu: LieuId; arme: ArmeId; interroges: string[] }
  | { type: 'falsifier'; champ: ChampTriplet; valeur: ElementId }
  | { type: 'passerFalsification' }
  | { type: 'repondre'; carte: ElementId | null }
  | { type: 'mentir' }
  | { type: 'consulterArchive'; dossier: number }
  | { type: 'accuser'; suspect: SuspectId; lieu: LieuId; arme: ArmeId }
  | { type: 'finTour' }
  | { type: 'carnet'; marques?: Partial<Record<ElementId, Marque>>; notes?: string };

export type Vainqueur = 'enqueteurs' | 'complice';
export type RaisonFin = 'accusation_correcte' | 'manches_ecoulees' | 'plus_d_accusateur';

/** Événement public : visible par tous les joueurs du salon. */
export type EvenementPublic = { t: number } & (
  | { type: 'debut_partie'; joueurs: string[] }
  | { type: 'debut_manche'; manche: number }
  | { type: 'debut_tour'; joueur: string; manche: number }
  | { type: 'fin_tour'; joueur: string; raison: 'volontaire' | 'temps_ecoule' }
  | { type: 'hypothese'; id: string; auteur: string; triplet: Triplet; interroges: string[] }
  | { type: 'reponse'; hypothese: string; joueur: string; resultat: 'aucune_carte' | 'carte_montree'; auto: boolean }
  | { type: 'fin_hypothese'; hypothese: string; montreePar: string | null }
  | { type: 'archive'; joueur: string; dossier: number; categorie: CategorieDossier }
  | { type: 'indice_public'; indice: string; manche: number }
  | { type: 'accusation'; joueur: string; triplet: Triplet; correcte: boolean }
  | { type: 'connexion'; joueur: string; connecte: boolean }
  | { type: 'depart'; joueur: string }
  | { type: 'fin_partie'; vainqueur: Vainqueur; raison: RaisonFin }
);

/** Entrée du journal privé d'un joueur : jamais envoyée aux autres. */
export type EntreePrivee = { t: number } & (
  | { type: 'role'; role: Role; meurtrier?: SuspectId }
  | { type: 'main'; cartes: ElementId[] }
  | { type: 'hypothese_originale'; hypothese: string; triplet: Triplet }
  | { type: 'carte_vue'; hypothese: string; de: string; carte: ElementId }
  | { type: 'aucune_carte_vue'; hypothese: string }
  | { type: 'carte_montree'; hypothese: string; a: string; carte: ElementId; auto: boolean }
  | { type: 'archive_lue'; dossier: number; indice: string }
  | { type: 'piece_lue'; dossier: number; carte: ElementId }
  | { type: 'mensonge'; hypothese: string; restants: number }
  | { type: 'falsification'; hypothese: string; champ: ChampTriplet; de: ElementId; vers: ElementId }
  | { type: 'accusation'; triplet: Triplet; correcte: boolean }
);

export interface JoueurPublic {
  id: string;
  nom: string;
  connecte: boolean;
  peutAccuser: boolean;
  nbCartes: number;
  bot: boolean;
  /** Le joueur a quitté la partie : ses tours sont passés automatiquement. */
  parti: boolean;
}

export type StatutReponse = 'attente' | 'aucune_carte' | 'carte_montree' | 'non_interroge';

export interface HypotheseEnCoursVue {
  id: string;
  auteur: string;
  interroges: string[];
  etape: 'falsification' | 'interrogation';
  echeance: number;
  /** Version publique ; absente pendant l'étape de falsification. */
  triplet?: Triplet;
  reponses: { joueur: string; statut: StatutReponse }[];
  repondantActuel?: string;
  /** Uniquement pour l'auteur. */
  auteurPrive?: { original: Triplet };
  /** Uniquement pour la personne qui doit répondre maintenant. */
  aRepondre?: { cartesCorrespondantes: ElementId[]; peutMentir: boolean };
  /** Uniquement pour le complice, s'il peut encore falsifier cette hypothèse. */
  falsification?: { original: Triplet; decide: boolean };
}

export interface ResultatPartie {
  vainqueur: Vainqueur;
  raison: RaisonFin;
  solution: Triplet;
  complice: string;
  mains: Record<string, ElementId[]>;
  /** Cartes non distribuées (publiques ou pièces à conviction). */
  cartesRestantes: ElementId[];
  explication: string[];
  indicesDecisifs: { indice: string; explication: string }[];
  usagesPouvoirs: {
    mensonges: { hypothese: string; manche: number }[];
    falsifications: { hypothese: string; champ: ChampTriplet; de: ElementId; vers: ElementId; manche: number }[];
  };
  accusations: { joueur: string; triplet: Triplet; correcte: boolean }[];
  manchesJouees: number;
  nbHypotheses: number;
}

export interface VueJoueur {
  partieId: string;
  moi: {
    id: string;
    nom: string;
    role: Role;
    main: ElementId[];
    peutAccuser: boolean;
    meurtrier?: SuspectId;
    mensongesRestants?: number;
    falsificationsRestantes?: number;
    carnet: Carnet;
    journal: EntreePrivee[];
    indicesConsultes: { dossier: number; indice: string }[];
    piecesConsultees: { dossier: number; carte: ElementId }[];
  };
  regles: {
    manchesMax: number;
    pointsAction: number;
    nbInterroges: number;
    hypothesesMaxParTour: number;
    delaiFalsificationMs: number;
    /** Durée d'un tour en ms ; null = sans limite. */
    dureeTourMs: number | null;
    coutHypothese: number;
    mensonges: number;
    falsifications: number;
  };
  manche: number;
  joueurActif: string;
  pointsAction: number;
  hypothesesCeTour: number;
  etape: 'tour' | 'hypothese' | 'terminee';
  echeanceTour: number;
  joueurs: JoueurPublic[];
  cartesPubliques: ElementId[];
  indicesPublics: { indice: string; manche: number }[];
  archives: { dossier: number; categorie: CategorieDossier; disponibleDesManche: number; disponible: boolean; consulte: boolean }[];
  historique: EvenementPublic[];
  hypotheseEnCours?: HypotheseEnCoursVue;
  resultat?: ResultatPartie;
}
