// Types partagés entre le moteur, le serveur et le client.
// Ce fichier ne contient AUCUNE donnée secrète : uniquement des formes de données.

// ---------------------------------------------------------------------------
// Affaires : chaque histoire a ses six suspects, six lieux et six armes.
// Les identifiants sont uniques toutes affaires confondues : un élément suffit
// donc à retrouver son affaire.
// ---------------------------------------------------------------------------

export const ELEMENTS_PAR_AFFAIRE = {
  manoir: {
    suspects: ['eleonore', 'victor', 'morel', 'marchand', 'camille', 'gabriel'],
    lieux: ['bureau', 'bibliotheque', 'serre', 'cave', 'salle_a_manger', 'salon_musique'],
    armes: ['chandelier', 'coupe_papier', 'revolver', 'dague', 'presse_papier', 'poison'],
  },
  train: {
    suspects: ['irina', 'hector', 'mathilde', 'lucas', 'margaret', 'paul'],
    lieux: ['compartiment', 'couloir', 'wagon_restaurant', 'voiture_salon', 'fourgon', 'plateforme'],
    armes: ['cordelette', 'stylet', 'pistolet', 'somnifere', 'cle_molette', 'canne'],
  },
  paquebot: {
    suspects: ['helene', 'legoff', 'isabella', 'breval', 'rose', 'max'],
    lieux: ['suite', 'poste_radio', 'piscine', 'fumoir', 'salle_machines', 'pont'],
    armes: ['sextant', 'statuette', 'lance_fusees', 'champagne', 'tisonnier', 'gaffe'],
  },
} as const;

/**
 * Mobiles du crime (mode « Grande enquête » seulement : la solution y répond aussi à « pourquoi ? »).
 * Ils restent à part des suspects, lieux et armes : une partie classique ne les voit jamais.
 */
export const MOBILES_PAR_AFFAIRE = {
  manoir: ['manoir_heritage', 'manoir_jalousie', 'manoir_vengeance', 'manoir_dette', 'manoir_chantage', 'manoir_secret'],
  train: ['train_espionnage', 'train_argent', 'train_amour', 'train_vengeance', 'train_chantage', 'train_faillite'],
  paquebot: ['paquebot_assurance', 'paquebot_jalousie', 'paquebot_chantage', 'paquebot_vengeance', 'paquebot_contrebande', 'paquebot_heritage'],
} as const;

export type AffaireId = keyof typeof ELEMENTS_PAR_AFFAIRE;
export const AFFAIRES_IDS = Object.keys(ELEMENTS_PAR_AFFAIRE) as AffaireId[];
/** Affaire jouée quand rien n'est précisé (et pour les parties sauvegardées avant l'arrivée des autres affaires). */
export const AFFAIRE_PAR_DEFAUT: AffaireId = 'manoir';

type Elements<C extends 'suspects' | 'lieux' | 'armes'> = (typeof ELEMENTS_PAR_AFFAIRE)[AffaireId][C][number];

/** Tous les suspects, lieux et armes de toutes les affaires (validation des messages, catégories). */
export const SUSPECTS = AFFAIRES_IDS.flatMap((a) => ELEMENTS_PAR_AFFAIRE[a].suspects) as readonly Elements<'suspects'>[];
export const LIEUX = AFFAIRES_IDS.flatMap((a) => ELEMENTS_PAR_AFFAIRE[a].lieux) as readonly Elements<'lieux'>[];
export const ARMES = AFFAIRES_IDS.flatMap((a) => ELEMENTS_PAR_AFFAIRE[a].armes) as readonly Elements<'armes'>[];

export type SuspectId = Elements<'suspects'>;
export type LieuId = Elements<'lieux'>;
export type ArmeId = Elements<'armes'>;
export type MobileId = (typeof MOBILES_PAR_AFFAIRE)[AffaireId][number];
export const MOBILES = AFFAIRES_IDS.flatMap((a) => MOBILES_PAR_AFFAIRE[a]) as readonly MobileId[];
export type ElementId = SuspectId | LieuId | ArmeId | MobileId;
export type Categorie = 'suspect' | 'lieu' | 'arme' | 'mobile';

/** Mode de jeu : la partie classique, ou la « Grande enquête » (mobile, rôles, tableau d'enquête). */
export type ModeJeu = 'classique' | 'grande';
export const MODES_JEU: readonly ModeJeu[] = ['classique', 'grande'];

/** Échéance « infinie » (tour sans limite de temps). Valeur sûre en JSON. */
export const SANS_LIMITE = Number.MAX_SAFE_INTEGER;

/** Tous les éléments de toutes les affaires, mobiles compris (validation des messages). */
export const TOUS_ELEMENTS: readonly ElementId[] = [...SUSPECTS, ...LIEUX, ...ARMES, ...MOBILES];

/**
 * Les éléments d'une affaire, par catégorie et tous ensemble. `tous` ne contient les mobiles
 * que si la partie en a (mode « Grande enquête ») ; `mobiles` est toujours rempli.
 */
export function elementsDe(affaire: AffaireId, avecMobile = false) {
  const e = ELEMENTS_PAR_AFFAIRE[affaire];
  const suspects = e.suspects as readonly SuspectId[];
  const lieux = e.lieux as readonly LieuId[];
  const armes = e.armes as readonly ArmeId[];
  const mobiles = MOBILES_PAR_AFFAIRE[affaire] as readonly MobileId[];
  const tous = (avecMobile ? [...suspects, ...lieux, ...armes, ...mobiles] : [...suspects, ...lieux, ...armes]) as readonly ElementId[];
  return { suspects, lieux, armes, mobiles, tous };
}

const AFFAIRE_DE_ELEMENT = new Map<string, AffaireId>(AFFAIRES_IDS.flatMap((a) => elementsDe(a, true).tous.map((e) => [e, a] as const)));

/** Affaire à laquelle appartient un élément (null s'il n'existe pas). */
export function affaireDe(id: string): AffaireId | null {
  return AFFAIRE_DE_ELEMENT.get(id) ?? null;
}

export function estAffaire(x: unknown): x is AffaireId {
  return typeof x === 'string' && (AFFAIRES_IDS as string[]).includes(x);
}

/** Choix de l'histoire avant la partie : une affaire précise, ou « aléatoire » (tirée au sort au lancement). */
export type ChoixAffaire = AffaireId | 'aleatoire';
export const CHOIX_AFFAIRES: readonly ChoixAffaire[] = [...AFFAIRES_IDS, 'aleatoire'];

export function estChoixAffaire(x: unknown): x is ChoixAffaire {
  return x === 'aleatoire' || estAffaire(x);
}

export function categorieDe(id: string): Categorie | null {
  if ((SUSPECTS as readonly string[]).includes(id)) return 'suspect';
  if ((LIEUX as readonly string[]).includes(id)) return 'lieu';
  if ((ARMES as readonly string[]).includes(id)) return 'arme';
  if ((MOBILES as readonly string[]).includes(id)) return 'mobile';
  return null;
}

/**
 * Meurtrier / lieu / arme (et mobile en « Grande enquête ») : solution, hypothèse ou accusation.
 * Le nom « triplet » date d'avant le mobile ; `mobile` est absent dans une partie classique.
 */
export interface Triplet {
  suspect: SuspectId;
  lieu: LieuId;
  arme: ArmeId;
  mobile?: MobileId;
}

export type ChampTriplet = keyof Triplet;

export function elementsDuTriplet(t: Triplet): ElementId[] {
  return t.mobile ? [t.suspect, t.lieu, t.arme, t.mobile] : [t.suspect, t.lieu, t.arme];
}

export function memeTriplet(a: Triplet, b: Triplet): boolean {
  return a.suspect === b.suspect && a.lieu === b.lieu && a.arme === b.arme && a.mobile === b.mobile;
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
  | 'contradiction'
  /** Pages du journal intime d'Armand (affichage « papier jauni »). */
  | 'journal';

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

/**
 * Rôle secret. Le Maître chanteur n'existe qu'en « Grande enquête » à 5 et 6 joueurs : il connaît
 * le mobile et gagne seul s'il fait lui-même l'accusation juste.
 */
export type Role = 'enqueteur' | 'complice' | 'maitre_chanteur';

/** « Grande enquête » : rôle secret de chaque enquêteur (le Témoin est toujours en jeu). */
export type RoleEnquete = 'temoin' | 'inspecteur' | 'legiste' | 'archiviste' | 'journaliste' | 'profileur';
export const ROLES_ENQUETE: readonly RoleEnquete[] = ['temoin', 'inspecteur', 'legiste', 'archiviste', 'journaliste', 'profileur'];

/**
 * « Grande enquête » : objectif secret du complice, tiré au sort. S'il le réussit, il gagne, même
 * si l'enquête a abouti (il « vole » la victoire).
 *   - temoin_genant : à la fin, il désigne le Témoin ;
 *   - bouc_emissaire : un suspect innocent est visé par assez d'accusations finales ;
 *   - ombre : personne ne le dénonce de toute la partie, et il a utilisé assez de ruses.
 */
export type ObjectifComplice = 'temoin_genant' | 'bouc_emissaire' | 'ombre';
export const OBJECTIFS_COMPLICE: readonly ObjectifComplice[] = ['temoin_genant', 'bouc_emissaire', 'ombre'];

/** L'objectif du complice tel qu'il le voit (et tel qu'il est révélé à la fin). */
export interface ObjectifVu {
  type: ObjectifComplice;
  /** Bouc émissaire : le suspect innocent à faire accuser. */
  suspect?: SuspectId;
  /** Bouc émissaire : nombre d'accusations finales nécessaires. */
  accusations?: number;
  /** L'ombre : nombre de ruses à utiliser. */
  ruses?: number;
}

// ---------------------------------------------------------------------------
// « Grande enquête » : tableau d'enquête commun
// ---------------------------------------------------------------------------

/** Étiquette d'une épingle. Sur un élément : innocent, coupable, fausse piste ; sur un joueur : complice, innocent. */
export type EtiquetteEpingle = 'innocent' | 'coupable' | 'fausse_piste' | 'complice';
export const ETIQUETTES_EPINGLE: readonly EtiquetteEpingle[] = ['innocent', 'coupable', 'fausse_piste', 'complice'];
/** Ce que vise une épingle : un élément de l'affaire (suspect, lieu, arme, mobile) ou un joueur. */
export type CibleEpingle = { type: 'element'; id: ElementId } | { type: 'joueur'; id: string };
export type ReactionEpingle = 'pour' | 'contre';

/** Une épingle telle qu'un joueur la voit. Rien n'est vérifié par le jeu : le tableau peut mentir. */
export interface EpingleVue {
  id: string;
  /** Auteur ; null pour une rumeur du Journaliste (sauf pour lui-même, et à la fin de la partie). */
  auteur: string | null;
  rumeur: boolean;
  cible: CibleEpingle;
  etiquette: EtiquetteEpingle;
  note?: string;
  manche: number;
  pour: number;
  contre: number;
  /** Ma réaction à cette épingle. */
  maReaction?: ReactionEpingle;
}

/** Utilisations restantes des pouvoirs de rôle (« Grande enquête »). */
export interface PouvoirsRole {
  /** Inspecteur : vérifier si les réponses reçues étaient honnêtes. */
  verifications?: number;
  /** Légiste : apprendre deux éléments innocents d'une catégorie. */
  expertises?: number;
  /** Archiviste : consultations d'archives sans payer de point d'action. */
  archivesGratuites?: number;
  /** Archiviste : savoir si un dossier a été trafiqué. */
  verificationsDossier?: number;
  /** Profileur : savoir si le complice est l'un de deux joueurs. */
  profilages?: number;
  /** Journaliste : rumeurs anonymes sur le tableau d'enquête. */
  rumeurs?: number;
}

/** Cartes montrées dans l'historique : visibles (pour les deux joueurs concernés) ou anonymes (mode difficile). */
export type HistoriqueCartes = 'visibles' | 'anonymes';

/** Mode du complice : pouvoirs historiques, ou réserve de ruses + empreintes + dénonciation. */
export type ModeComplice = 'classique' | 'ruse';
/** Les ruses du complice (mode « rusé »). Chacune coûte 1 ruse et laisse une empreinte. */
export type TypeRuse = 'mensonge' | 'falsification' | 'emprunt' | 'trafic';
export type Marque = 'inconnu' | 'ecarte' | 'probable' | 'certain';

export interface Carnet {
  marques: Partial<Record<ElementId, Marque>>;
  notes: string;
}

export type ActionJeu =
  | { type: 'hypothese'; suspect: SuspectId; lieu: LieuId; arme: ArmeId; mobile?: MobileId; interroges: string[] }
  | { type: 'falsifier'; champ: ChampTriplet; valeur: ElementId }
  | { type: 'passerFalsification' }
  | { type: 'repondre'; carte: ElementId | null }
  | { type: 'mentir' }
  | { type: 'consulterArchive'; dossier: number; trafiquer?: boolean; gratuit?: boolean }
  | { type: 'emprunter'; carte: ElementId }
  | { type: 'denoncer'; joueur: string }
  | { type: 'accuser'; suspect: SuspectId; lieu: LieuId; arme: ArmeId; mobile?: MobileId }
  | { type: 'finTour' }
  /** Avant le départ : « j'ai pris connaissance de mon rôle, je suis prêt ». */
  | { type: 'pret' }
  /** « Grande enquête » : pouvoirs de rôle, tous secrets et utilisables pendant son tour. */
  | { type: 'verifierReponses' }
  | { type: 'expertiser'; categorie: Categorie }
  | { type: 'verifierDossier'; dossier: number }
  | { type: 'profiler'; joueurs: string[] }
  /** Complice (objectif « Le témoin gênant ») : à la fin, désigner le joueur qu'il croit être le Témoin. */
  | { type: 'designerTemoin'; joueur: string }
  /** Tableau d'enquête : épingler (rumeur anonyme pour le Journaliste), réagir, retirer son épingle. */
  | { type: 'epingler'; cible: CibleEpingle; etiquette: EtiquetteEpingle; note?: string; rumeur?: boolean }
  | { type: 'reagir'; epingle: string; reaction: ReactionEpingle | null }
  | { type: 'retirerEpingle'; epingle: string }
  | { type: 'carnet'; marques?: Partial<Record<ElementId, Marque>>; notes?: string };

export type Vainqueur = 'enqueteurs' | 'complice' | 'maitre_chanteur';

/** Ce joueur a-t-il gagné ? */
export function aGagne(role: Role, vainqueur: Vainqueur): boolean {
  if (role === 'complice') return vainqueur === 'complice';
  if (role === 'maitre_chanteur') return vainqueur === 'maitre_chanteur';
  return vainqueur === 'enqueteurs';
}
export type RaisonFin = 'accusation_correcte' | 'manches_ecoulees' | 'plus_d_accusateur' | 'objectif_complice';

/** Événement public : visible par tous les joueurs du salon. */
export type EvenementPublic = { t: number } & (
  | { type: 'debut_partie'; joueurs: string[] }
  /** Tout le monde a pris connaissance de son rôle (ou le temps d'attente est écoulé) : le premier tour commence. */
  | { type: 'debut_enquete' }
  | { type: 'debut_manche'; manche: number }
  | { type: 'debut_tour'; joueur: string; manche: number }
  | { type: 'fin_tour'; joueur: string; raison: 'volontaire' | 'temps_ecoule' | 'tour_perdu' }
  | { type: 'hypothese'; id: string; auteur: string; triplet: Triplet; interroges: string[] }
  /** `carte` : ajoutée seulement dans la vue de l'auteur de l'hypothèse et de celui qui l'a montrée. */
  | { type: 'reponse'; hypothese: string; joueur: string; resultat: 'aucune_carte' | 'carte_montree'; auto: boolean; carte?: ElementId }
  | { type: 'fin_hypothese'; hypothese: string; montreePar: string | null }
  | { type: 'archive'; joueur: string; dossier: number; categorie: CategorieDossier }
  | { type: 'indice_public'; indice: string; manche: number }
  | { type: 'accusation'; joueur: string; triplet: Triplet; correcte: boolean }
  | { type: 'connexion'; joueur: string; connecte: boolean }
  | { type: 'depart'; joueur: string }
  | { type: 'remplacement'; joueur: string }
  | { type: 'reprise_siege'; joueur: string }
  /** Empreinte laissée par une ruse : elle innocente un joueur (indice VRAI et anonyme). */
  /** Empreinte : innocente un joueur, ou (petite table) date seulement la ruse (`mancheRuse`). */
  | { type: 'empreinte'; manche: number; innocente?: string; mancheRuse?: number }
  | { type: 'denonciation'; joueur: string; cible: string; correcte: boolean }
  /** « Grande enquête » : l'enquête a abouti, mais le complice a une dernière chance de désigner le Témoin. */
  | { type: 'derniere_chance'; echeance: number }
  | { type: 'temoin_designe'; joueur: string | null; correct: boolean }
  | { type: 'fin_partie'; vainqueur: Vainqueur; raison: RaisonFin }
);

/** Entrée du journal privé d'un joueur : jamais envoyée aux autres. */
export type EntreePrivee = { t: number } & (
  | { type: 'role'; role: Role; meurtrier?: SuspectId; roleEnquete?: RoleEnquete; lieu?: LieuId; mobile?: MobileId }
  /** Inspecteur : les réponses reçues à son hypothèse étaient-elles toutes honnêtes ? */
  | { type: 'verification'; hypothese: string; honnete: boolean }
  /** Légiste : deux éléments innocents d'une catégorie. */
  | { type: 'expertise'; categorie: Categorie; innocents: ElementId[] }
  /** Archiviste : ce dossier a-t-il été trafiqué ? */
  | { type: 'dossier_verifie'; dossier: number; trafique: boolean }
  /** Profileur : le complice est-il l'un de ces deux joueurs ? */
  | { type: 'profilage'; joueurs: string[]; complicePresent: boolean }
  | { type: 'main'; cartes: ElementId[] }
  | { type: 'hypothese_originale'; hypothese: string; triplet: Triplet }
  | { type: 'carte_vue'; hypothese: string; de: string; carte: ElementId }
  | { type: 'aucune_carte_vue'; hypothese: string }
  | { type: 'carte_montree'; hypothese: string; a: string; carte: ElementId; auto: boolean }
  | { type: 'archive_lue'; dossier: number; indice: string; categorie?: CategorieIndice }
  | { type: 'piece_lue'; dossier: number; carte: ElementId }
  | { type: 'mensonge'; hypothese: string; restants: number }
  | { type: 'falsification'; hypothese: string; champ: ChampTriplet; de: ElementId; vers: ElementId }
  | { type: 'accusation'; triplet: Triplet; correcte: boolean }
  | { type: 'ruse'; ruse: TypeRuse; restants: number; hypothese?: string; dossier?: number; carte?: ElementId; indiceFaux?: string }
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
  aRepondre?: { cartesCorrespondantes: ElementId[]; peutMentir: boolean; cartesEmpruntables: ElementId[] };
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
    emprunts: { hypothese: string; carte: ElementId; manche: number }[];
    trafics: { dossier: number; indiceFaux: string; manche: number }[];
  };
  denonciations: { joueur: string; cible: string; correcte: boolean }[];
  accusations: { joueur: string; triplet: Triplet; correcte: boolean }[];
  /** « Grande enquête » : le rôle secret de chacun, révélé à la fin. */
  roles?: Record<string, { role: Role; roleEnquete?: RoleEnquete }>;
  /** « Grande enquête » : le tableau d'enquête, avec le vrai auteur de chaque épingle (rumeurs comprises). */
  tableau?: EpingleVue[];
  /** « Grande enquête » : l'objectif secret du complice, et s'il l'a réussi. */
  objectifComplice?: ObjectifVu & { reussi: boolean; designe?: string | null };
  manchesJouees: number;
  nbHypotheses: number;
}

export interface VueJoueur {
  partieId: string;
  /** Histoire jouée. */
  affaire: AffaireId;
  moi: {
    id: string;
    nom: string;
    role: Role;
    main: ElementId[];
    peutAccuser: boolean;
    meurtrier?: SuspectId;
    mensongesRestants?: number;
    falsificationsRestantes?: number;
    /** Mode « rusé » : ruses restantes (complice uniquement). */
    rusesRestantes?: number;
    /** Mode « rusé » : ce joueur peut encore dénoncer le complice. */
    peutDenoncer: boolean;
    /** « Grande enquête » : rôle d'enquête, ce qu'il permet de savoir et pouvoirs restants. */
    roleEnquete?: RoleEnquete;
    /** Le Témoin connaît le lieu du crime. */
    lieuConnu?: LieuId;
    /** Le Maître chanteur connaît le mobile. */
    mobileConnu?: MobileId;
    pouvoirsRole?: PouvoirsRole;
    /** Avant le départ : ce joueur a confirmé avoir lu son rôle. */
    pret?: boolean;
    /** Complice en « Grande enquête » : son objectif secret. */
    objectif?: ObjectifVu;
    carnet: Carnet;
    journal: EntreePrivee[];
    /** `categorie` : catégorie affichée (celle annoncée pour le dossier). */
    indicesConsultes: { dossier: number; indice: string; categorie?: CategorieIndice }[];
    piecesConsultees: { dossier: number; carte: ElementId }[];
  };
  regles: {
    /** Partie classique ou « Grande enquête » (avec le mobile). */
    mode: ModeJeu;
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
    modeComplice: ModeComplice;
    /** Mode « rusé » : nombre total de ruses du complice. */
    ruses: number;
    coutRuses: Record<TypeRuse, number>;
    /** « anonymes » : après le tour, les cartes montrées et reçues ne sont plus rappelées nulle part. */
    historiqueCartes: HistoriqueCartes;
    /** Mode « rusé » : aucune empreinte publiée avant cette manche. */
    premiereMancheEmpreinte: number;
    /** Mode « rusé » : manches de suspension des ruses d'un complice démasqué. */
    suspensionDemasque: number;
    /** « Grande enquête » : rôles qui peuvent être en jeu, et à partir de quelle manche certains pouvoirs servent. */
    roles?: { possibles: RoleEnquete[]; maitreChanteur: boolean; mancheExpertise: number; mancheProfilage: number };
    /** « Grande enquête » : règles du tableau d'enquête. */
    tableau?: { epinglesParManche: number; maxAffichees: number; noteMax: number };
  };
  manche: number;
  joueurActif: string;
  pointsAction: number;
  hypothesesCeTour: number;
  /** « designation » : la dernière chance du complice (objectif « Le témoin gênant »). */
  etape: 'tour' | 'hypothese' | 'designation' | 'terminee';
  echeanceTour: number;
  /** Étape « designation » : fin du temps laissé au complice. */
  echeanceDesignation?: number;
  /** « Grande enquête » : le tableau d'enquête commun. */
  tableau?: EpingleVue[];
  /** Avant le départ : joueurs qui n'ont pas encore confirmé avoir lu leur rôle, et départ forcé au plus tard. */
  attenteDepart?: { enAttente: string[]; limite: number };
  joueurs: JoueurPublic[];
  cartesPubliques: ElementId[];
  indicesPublics: { indice: string; manche: number }[];
  archives: { dossier: number; categorie: CategorieDossier; disponibleDesManche: number; disponible: boolean; consulte: boolean }[];
  historique: EvenementPublic[];
  hypotheseEnCours?: HypotheseEnCoursVue;
  /** Le complice a été démasqué par une dénonciation : son identité est publique. */
  compliceDemasque: string | null;
  /** Complice démasqué : manche à laquelle ses ruses reviennent (null : pas de suspension en cours). */
  retourRuses: number | null;
  /** Partie en pause : joueurs humains absents (déconnectés ou partis) et début de la pause. */
  pause: { depuis: number; absents: { id: string; parti: boolean }[] } | null;
  resultat?: ResultatPartie;
}
