// Machine à états d'une partie de Dossier Secret.
//
// Le moteur est PUR : aucune entrée/sortie, aucun minuteur. Le temps est passé
// en paramètre (`now`, en millisecondes) et l'aléa est injecté. Le serveur
// appelle `avancer()` aux échéances renvoyées par `prochaineEcheance()`.
// Toutes les vérifications de règles sont faites ici ; le client n'est jamais cru.

import {
  ARMES,
  LIEUX,
  SANS_LIMITE,
  SUSPECTS,
  categorieDe,
  elementsDuTriplet,
  memeTriplet,
  type ActionJeu,
  type Carnet,
  type ChampTriplet,
  type ElementId,
  type EntreePrivee,
  type EvenementPublic,
  type Marque,
  type RaisonFin,
  type Role,
  type Triplet,
  type TypeRuse,
  type Vainqueur,
} from '../shared/types';
import { INDICES, INDICES_PAR_ID } from '../shared/data/indices';
import { indiceValide } from '../shared/logique';
import { CONFIG_PAR_DEFAUT, JOUEURS_MAX, JOUEURS_MIN, coutRuse, nbInterroges, pouvoirsPour, rusesPour, type ConfigPartie } from './config';
import {
  choisirComplice,
  distribuerCartes,
  genererAffaire,
  validerAffaire,
  validerDistribution,
  type Affaire,
} from './generateur';
import { pick, seededRng, shuffle, type Rng } from './rng';

export interface EtatJoueur {
  id: string;
  nom: string;
  bot: boolean;
  role: Role;
  main: ElementId[];
  peutAccuser: boolean;
  mensongesRestants: number;
  falsificationsRestantes: number;
  carnet: Carnet;
  journal: EntreePrivee[];
  dossiersConsultes: number[];
  connecte: boolean;
  /** A quitté volontairement la partie. */
  parti?: boolean;
  /** Mode « rusé » : ruses restantes (complice). */
  rusesRestantes?: number;
  /** Mode « rusé » : peut encore dénoncer le complice (une fois par partie). */
  peutDenoncer?: boolean;
  /** A dénoncé à tort : son prochain tour est passé. */
  tourPerdu?: boolean;
}

export interface ReponseInterne {
  joueur: string;
  resultat: 'aucune_carte' | 'carte_montree' | 'mensonge' | 'emprunt';
  carte?: ElementId;
  auto: boolean;
}

export interface HypotheseInterne {
  id: string;
  auteur: string;
  manche: number;
  /** Version originale : utilisée pour vérifier les cartes. Jamais modifiée. */
  original: Triplet;
  /** Version publique : diffusée aux autres joueurs (éventuellement falsifiée). */
  publique: Triplet;
  falsification?: { par: string; champ: ChampTriplet; de: ElementId; vers: ElementId };
  decisionFalsificationPrise: boolean;
  interroges: string[];
  index: number;
  reponses: ReponseInterne[];
  etape: 'falsification' | 'interrogation' | 'terminee';
  echeance: number;
  carteMontree?: { par: string; carte: ElementId };
}

export interface EntreeAudit {
  t: number;
  joueur: string | null;
  action: string;
  ok: boolean;
  detail?: string;
}

export interface EtatPartie {
  id: string;
  config: ConfigPartie;
  creeLe: number;
  affaire: Affaire;
  complice: string;
  ordre: string[];
  joueurs: Record<string, EtatJoueur>;
  cartesPubliques: ElementId[];
  /** Pièces à conviction : cartes non distribuées rangées dans les archives. */
  pieces?: { dossier: number; carte: ElementId; disponibleDesManche: number }[];
  indicesPublics: { indice: string; manche: number }[];
  manche: number;
  indexTour: number;
  pointsAction: number;
  hypothesesCeTour: number;
  echeanceTour: number;
  etape: 'tour' | 'hypothese' | 'terminee';
  hypothese?: HypotheseInterne;
  hypotheses: HypotheseInterne[];
  accusations: { joueur: string; triplet: Triplet; correcte: boolean; manche: number }[];
  historique: EvenementPublic[];
  audit: EntreeAudit[];
  resultat?: { vainqueur: Vainqueur; raison: RaisonFin; t: number };
  compteurHypotheses: number;
  /** Incrémenté à chaque changement d'état (utile pour la synchronisation). */
  version: number;
  /** Graine de l'aléa utilisé en cours de partie (empreintes, faux indices). */
  graine?: number;
  compteurAlea?: number;
  /** Mode « rusé » : empreintes à publier au début d'une manche. */
  empreintesPrevues?: { manche: number; innocente: string }[];
  /** Mode « rusé » : dossiers trafiqués par le complice. */
  trafics?: { dossier: number; par: string; indiceFaux: string; manche: number }[];
  denonciations?: { joueur: string; cible: string; correcte: boolean; manche: number }[];
  compliceDemasque?: boolean;
}

export type ResultatAction = { ok: true } | { ok: false; erreur: string };

export interface JoueurInitial {
  id: string;
  nom: string;
  bot?: boolean;
}

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

export function creerPartie(params: {
  id: string;
  joueurs: JoueurInitial[];
  rng: Rng;
  now: number;
  config?: Partial<ConfigPartie>;
  /** Uniquement pour les tests : imposer la solution ou le complice. */
  imposer?: { solution?: Triplet; complice?: string };
}): EtatPartie {
  const config: ConfigPartie = { ...CONFIG_PAR_DEFAUT, ...params.config };
  const { joueurs, rng, now } = params;
  if (joueurs.length < JOUEURS_MIN || joueurs.length > JOUEURS_MAX)
    throw new Error(`Une partie se joue de ${JOUEURS_MIN} à ${JOUEURS_MAX} joueurs.`);
  const ids = joueurs.map((j) => j.id);
  if (new Set(ids).size !== ids.length) throw new Error('Identifiants de joueurs en double.');

  // 1. Affaire cohérente et solution secrète (validée avant tout démarrage).
  const affaire = genererAffaire(rng, config, params.imposer?.solution);
  const erreursAffaire = validerAffaire(affaire, config);
  if (erreursAffaire.length) throw new Error(`Affaire invalide : ${erreursAffaire.join(' ; ')}`);

  // 2. Rôles : un seul complice, tiré au sort par le serveur.
  // Le tirage a toujours lieu (même si un test impose le complice) pour garder la même séquence aléatoire.
  const tire = choisirComplice(rng, ids);
  const complice = params.imposer?.complice ?? tire;
  if (!ids.includes(complice)) throw new Error('Complice imposé inconnu.');

  // 3. Distribution des cartes.
  const ordre = shuffle(rng, ids);
  const distribution = distribuerCartes(rng, affaire.solution, ordre);
  const erreursDistribution = validerDistribution(distribution, affaire.solution, ordre);
  if (erreursDistribution.length) throw new Error(`Distribution invalide : ${erreursDistribution.join(' ; ')}`);

  // Cartes non distribuées : publiques, ou pièces à conviction dans les archives.
  const enArchives = config.cartesRestantes === 'archives';
  const pieces = enArchives
    ? distribution.cartesPubliques.map((carte, i) => ({
        dossier: affaire.archives.length + i + 1,
        carte,
        disponibleDesManche: config.ouverturePieces[i] ?? 1,
      }))
    : [];
  const pouvoirs = pouvoirsPour(config, joueurs.length);
  const modeRuse = config.modeComplice === 'ruse';

  const etatJoueurs: Record<string, EtatJoueur> = {};
  for (const j of joueurs) {
    const role: Role = j.id === complice ? 'complice' : 'enqueteur';
    etatJoueurs[j.id] = {
      id: j.id,
      nom: j.nom,
      bot: !!j.bot,
      role,
      main: distribution.mains[j.id],
      peutAccuser: true,
      mensongesRestants: role === 'complice' && !modeRuse ? pouvoirs.mensonges : 0,
      falsificationsRestantes: role === 'complice' && !modeRuse ? pouvoirs.falsifications : 0,
      rusesRestantes: role === 'complice' && modeRuse ? rusesPour(config, joueurs.length) : 0,
      peutDenoncer: modeRuse,
      carnet: { marques: {}, notes: '' },
      journal: [
        role === 'complice'
          ? { t: now, type: 'role', role, meurtrier: affaire.solution.suspect }
          : { t: now, type: 'role', role },
        { t: now, type: 'main', cartes: [...distribution.mains[j.id]] },
      ],
      dossiersConsultes: [],
      connecte: true,
    };
  }

  const etat: EtatPartie = {
    id: params.id,
    config,
    creeLe: now,
    affaire,
    complice,
    ordre,
    joueurs: etatJoueurs,
    cartesPubliques: enArchives ? [] : distribution.cartesPubliques,
    pieces,
    indicesPublics: affaire.indicesPublicsDepart.map((indice) => ({ indice, manche: 1 })),
    manche: 1,
    indexTour: 0,
    pointsAction: config.pointsAction,
    hypothesesCeTour: 0,
    echeanceTour: config.delaiTourMs === null ? SANS_LIMITE : now + config.delaiTourMs,
    etape: 'tour',
    hypotheses: [],
    accusations: [],
    historique: [],
    audit: [],
    compteurHypotheses: 0,
    version: 1,
    // Tirée en dernier pour ne pas modifier la séquence aléatoire de la mise en place.
    graine: rng.int(2 ** 31),
    compteurAlea: 0,
    empreintesPrevues: [],
    trafics: [],
    denonciations: [],
  };
  publier(etat, { t: now, type: 'debut_partie', joueurs: [...ordre] });
  for (const indice of affaire.indicesPublicsDepart) publier(etat, { t: now, type: 'indice_public', indice, manche: 1 });
  publier(etat, { t: now, type: 'debut_manche', manche: 1 });
  publier(etat, { t: now, type: 'debut_tour', joueur: ordre[0], manche: 1 });
  auditer(etat, now, null, 'creation', true, `solution=${affaire.solution.suspect}/${affaire.solution.lieu}/${affaire.solution.arme} complice=${complice}`);
  return etat;
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function publier(etat: EtatPartie, ev: EvenementPublic) {
  etat.historique.push(ev);
}

function noter(etat: EtatPartie, joueur: string, entree: EntreePrivee) {
  etat.joueurs[joueur].journal.push(entree);
}

function auditer(etat: EtatPartie, t: number, joueur: string | null, action: string, ok: boolean, detail?: string) {
  etat.audit.push({ t, joueur, action, ok, detail });
}

export function joueurActif(etat: EtatPartie): string {
  return etat.ordre[etat.indexTour];
}

function refus(erreur: string): ResultatAction {
  return { ok: false, erreur };
}

/** Cartes de la main du joueur qui correspondent à un triplet. */
export function cartesCorrespondantes(etat: EtatPartie, joueur: string, t: Triplet): ElementId[] {
  const elements = elementsDuTriplet(t);
  return etat.joueurs[joueur].main.filter((c) => elements.includes(c));
}

function tripletValide(t: { suspect: unknown; lieu: unknown; arme: unknown }): t is Triplet {
  return (
    (SUSPECTS as readonly unknown[]).includes(t.suspect) &&
    (LIEUX as readonly unknown[]).includes(t.lieu) &&
    (ARMES as readonly unknown[]).includes(t.arme)
  );
}

/** Un joueur qui a quitté la partie voit ses tours et ses réponses passés presque immédiatement. */
const DELAI_PARTI_MS = 2_000;

function delaiPour(etat: EtatPartie, joueur: string, normal: number): number {
  const j = etat.joueurs[joueur];
  if (j.parti) return Math.min(normal, DELAI_PARTI_MS);
  return j.connecte ? normal : Math.min(normal, etat.config.delaiDeconnecteMs);
}

/** Échéance du tour qui commence à `t` pour ce joueur (tour sans limite : aucune échéance s'il est connecté). */
function echeanceDeTour(etat: EtatPartie, joueur: string, t: number): number {
  const delai = etat.config.delaiTourMs;
  if (etat.joueurs[joueur].parti) return t + DELAI_PARTI_MS;
  if (delai === null) return etat.joueurs[joueur].connecte ? SANS_LIMITE : t + etat.config.delaiDeconnecteMs;
  return t + delaiPour(etat, joueur, delai);
}

/** Aléa déterministe et reproductible en cours de partie (sauvegardé avec l'état). */
function alea(etat: EtatPartie, max: number): number {
  etat.compteurAlea = (etat.compteurAlea ?? 0) + 1;
  return seededRng(((etat.graine ?? 0) + etat.compteurAlea * 7919) >>> 0).int(max);
}

const modeRuse = (etat: EtatPartie) => etat.config.modeComplice === 'ruse';

/** Le complice peut-il utiliser cette ruse / ce pouvoir ? (décision 100 % serveur) */
export function rusePossible(etat: EtatPartie, joueur: string, ruse: TypeRuse): boolean {
  const j = etat.joueurs[joueur];
  if (!j || j.role !== 'complice' || etat.compliceDemasque) return false;
  if (modeRuse(etat)) return (j.rusesRestantes ?? 0) >= coutRuse(etat.config, ruse);
  if (ruse === 'mensonge') return j.mensongesRestants > 0;
  if (ruse === 'falsification') return j.falsificationsRestantes > 0;
  return false; // emprunt et trafic n'existent qu'en mode « rusé »
}

/** Consomme une ruse ; en mode « rusé », planifie l'empreinte correspondante. Retourne les ruses restantes. */
function consommerRuse(etat: EtatPartie, joueur: string, ruse: TypeRuse): number {
  const j = etat.joueurs[joueur];
  if (!modeRuse(etat)) {
    if (ruse === 'mensonge') return --j.mensongesRestants;
    return --j.falsificationsRestantes;
  }
  j.rusesRestantes = (j.rusesRestantes ?? 0) - coutRuse(etat.config, ruse);
  const proba = etat.config.probaEmpreinte?.[etat.ordre.length] ?? 0.6;
  if (alea(etat, 1000) < proba * 1000) planifierEmpreinte(etat, joueur);
  return j.rusesRestantes;
}

/**
 * Empreinte : un indice VRAI et anonyme sur l'identité du complice, publié 1 ou 2 manches
 * plus tard (le délai empêche de relier l'empreinte à une action précise).
 * Elle innocente un joueur tiré au hasard parmi ceux qui ne le sont pas encore :
 * une empreinte seule ne suffit pas, c'est en les recoupant qu'on démasque le complice.
 */
function planifierEmpreinte(etat: EtatPartie, complice: string) {
  const prevues = (etat.empreintesPrevues ??= []);
  const deja = new Set(prevues.map((e) => e.innocente));
  const innocentables = etat.ordre.filter((id) => id !== complice && !deja.has(id));
  if (innocentables.length === 0) return;
  prevues.push({ manche: etat.manche + 1 + alea(etat, 2), innocente: innocentables[alea(etat, innocentables.length)] });
}

/** Cartes que le complice peut « emprunter » : éléments de l'hypothèse originale qu'il n'a pas, hors meurtrier. */
export function cartesEmpruntables(etat: EtatPartie, joueur: string): ElementId[] {
  const h = etat.hypothese;
  if (!h || repondantActuel(etat) !== joueur || !modeRuse(etat) || !rusePossible(etat, joueur, 'emprunt')) return [];
  const main = etat.joueurs[joueur].main;
  return elementsDuTriplet(h.original).filter((e) => !main.includes(e) && e !== etat.affaire.solution.suspect);
}

export function enqueteursPouvantAccuser(etat: EtatPartie): string[] {
  return etat.ordre.filter((id) => etat.joueurs[id].role === 'enqueteur' && etat.joueurs[id].peutAccuser);
}

// ---------------------------------------------------------------------------
// Point d'entrée des actions
// ---------------------------------------------------------------------------

export function appliquerAction(etat: EtatPartie, joueur: string, action: ActionJeu, now: number): ResultatAction {
  avancer(etat, now);
  const res = traiter(etat, joueur, action, now);
  if (action.type !== 'carnet' || !res.ok) {
    auditer(etat, now, joueur, action.type, res.ok, res.ok ? resumeAction(action) : res.erreur);
  }
  if (res.ok) {
    etat.version++;
    avancer(etat, now);
  }
  return res;
}

function resumeAction(a: ActionJeu): string | undefined {
  switch (a.type) {
    case 'hypothese':
      return `${a.suspect}/${a.lieu}/${a.arme} -> ${a.interroges.join(',')}`;
    case 'accuser':
      return `${a.suspect}/${a.lieu}/${a.arme}`;
    case 'falsifier':
      return `${a.champ}=${a.valeur}`;
    case 'repondre':
      return a.carte ?? 'aucune';
    case 'consulterArchive':
      return `dossier ${a.dossier}`;
    default:
      return undefined;
  }
}

function traiter(etat: EtatPartie, joueur: string, action: ActionJeu, now: number): ResultatAction {
  if (!etat.joueurs[joueur]) return refus("Vous ne faites pas partie de cette partie.");
  if (action.type === 'carnet') return majCarnet(etat, joueur, action);
  if (etat.etape === 'terminee') return refus('La partie est terminée.');

  switch (action.type) {
    case 'hypothese':
      return formulerHypothese(etat, joueur, action, now);
    case 'falsifier':
    case 'passerFalsification':
      return decisionFalsification(etat, joueur, action, now);
    case 'repondre':
    case 'mentir':
    case 'emprunter':
      return repondre(etat, joueur, action, now);
    case 'consulterArchive':
      return consulterArchive(etat, joueur, action.dossier, now, !!action.trafiquer);
    case 'denoncer':
      return denoncer(etat, joueur, action.joueur, now);
    case 'accuser':
      return accuser(etat, joueur, action, now);
    case 'finTour':
      if (etat.etape !== 'tour') return refus('Attendez la fin de l\'hypothèse en cours.');
      if (joueurActif(etat) !== joueur) return refus("Ce n'est pas votre tour.");
      terminerTour(etat, now, 'volontaire');
      return { ok: true };
    default:
      return refus('Action inconnue.');
  }
}

function verifierTourActif(etat: EtatPartie, joueur: string): ResultatAction | null {
  if (etat.etape !== 'tour') return refus("Une hypothèse est en cours : attendez qu'elle soit résolue.");
  if (joueurActif(etat) !== joueur) return refus("Ce n'est pas votre tour.");
  return null;
}

// ---------------------------------------------------------------------------
// Hypothèse
// ---------------------------------------------------------------------------

function formulerHypothese(
  etat: EtatPartie,
  joueur: string,
  action: Extract<ActionJeu, { type: 'hypothese' }>,
  now: number,
): ResultatAction {
  const e = verifierTourActif(etat, joueur);
  if (e) return e;
  if (etat.pointsAction < etat.config.coutHypothese)
    return refus(`Une hypothèse coûte ${etat.config.coutHypothese} points d'action : il ne vous en reste que ${etat.pointsAction}.`);
  if (etat.hypothesesCeTour >= etat.config.hypothesesMaxParTour)
    return refus(`Vous ne pouvez formuler que ${etat.config.hypothesesMaxParTour} hypothèse(s) par tour.`);
  const triplet = { suspect: action.suspect, lieu: action.lieu, arme: action.arme };
  if (!tripletValide(triplet)) return refus('Hypothèse invalide : choisissez un suspect, un lieu et une arme.');

  const attendu = nbInterroges(etat.ordre.length);
  const interroges = action.interroges;
  if (!Array.isArray(interroges) || interroges.length !== attendu)
    return refus(`Vous devez interroger exactement ${attendu} joueur(s).`);
  if (new Set(interroges).size !== interroges.length) return refus('Un joueur ne peut pas être interrogé deux fois.');
  if (interroges.includes(joueur)) return refus('Vous ne pouvez pas vous interroger vous-même.');
  if (interroges.some((id) => !etat.joueurs[id])) return refus("Un joueur interrogé ne fait pas partie de la partie.");

  etat.pointsAction -= etat.config.coutHypothese;
  etat.hypothesesCeTour += 1;
  etat.compteurHypotheses += 1;
  const h: HypotheseInterne = {
    id: `H${etat.compteurHypotheses}`,
    auteur: joueur,
    manche: etat.manche,
    original: { ...triplet },
    publique: { ...triplet },
    decisionFalsificationPrise: false,
    interroges: [...interroges],
    index: 0,
    reponses: [],
    etape: 'falsification',
    // Durée FIXE, même si le complice n'a plus de pouvoir ou est l'auteur :
    // la longueur de cette étape ne doit rien révéler.
    echeance: now + etat.config.delaiFalsificationMs,
  };
  etat.hypothese = h;
  etat.hypotheses.push(h);
  etat.etape = 'hypothese';
  noter(etat, joueur, { t: now, type: 'hypothese_originale', hypothese: h.id, triplet: { ...triplet } });
  return { ok: true };
}

/** Le complice peut-il falsifier l'hypothèse en cours ? (décision 100 % serveur) */
export function peutFalsifier(etat: EtatPartie, joueur: string): boolean {
  const h = etat.hypothese;
  const j = etat.joueurs[joueur];
  return (
    !!h &&
    !!j &&
    etat.etape === 'hypothese' &&
    h.etape === 'falsification' &&
    j.role === 'complice' &&
    h.auteur !== joueur &&
    rusePossible(etat, joueur, 'falsification') &&
    !h.decisionFalsificationPrise
  );
}

function decisionFalsification(
  etat: EtatPartie,
  joueur: string,
  action: Extract<ActionJeu, { type: 'falsifier' } | { type: 'passerFalsification' }>,
  now: number,
): ResultatAction {
  const h = etat.hypothese;
  if (!h || etat.etape !== 'hypothese' || h.etape !== 'falsification') return refus("Aucune hypothèse ne peut être falsifiée en ce moment.");
  if (!peutFalsifier(etat, joueur)) return refus("Vous ne pouvez pas falsifier cette hypothèse.");
  h.decisionFalsificationPrise = true;
  if (action.type === 'passerFalsification') return { ok: true };

  const champ = action.champ;
  if (champ !== 'suspect' && champ !== 'lieu' && champ !== 'arme') {
    h.decisionFalsificationPrise = false;
    return refus('Élément à falsifier invalide.');
  }
  if (categorieDe(action.valeur) !== champ) {
    h.decisionFalsificationPrise = false;
    return refus('La nouvelle valeur doit être de la même catégorie.');
  }
  if (h.original[champ] === action.valeur) {
    h.decisionFalsificationPrise = false;
    return refus("La nouvelle valeur doit être différente de l'originale.");
  }
  const publique = { ...h.original, [champ]: action.valeur } as Triplet;
  h.publique = publique;
  h.falsification = { par: joueur, champ, de: h.original[champ], vers: action.valeur };
  const restants = consommerRuse(etat, joueur, 'falsification');
  noter(etat, joueur, { t: now, type: 'falsification', hypothese: h.id, champ, de: h.original[champ], vers: action.valeur });
  if (modeRuse(etat)) noter(etat, joueur, { t: now, type: 'ruse', ruse: 'falsification', restants, hypothese: h.id });
  return { ok: true };
}

/** Fin de l'étape de falsification : publication de la version publique. */
function publierHypothese(etat: EtatPartie, h: HypotheseInterne, t: number) {
  h.etape = 'interrogation';
  publier(etat, { t, type: 'hypothese', id: h.id, auteur: h.auteur, triplet: { ...h.publique }, interroges: [...h.interroges] });
  h.index = 0;
  h.echeance = t + delaiPour(etat, h.interroges[0], etat.config.delaiReponseMs);
}

export function repondantActuel(etat: EtatPartie): string | null {
  const h = etat.hypothese;
  if (!h || etat.etape !== 'hypothese' || h.etape !== 'interrogation') return null;
  return h.interroges[h.index] ?? null;
}

/** Le pouvoir « Mensonge » est-il autorisé pour ce joueur maintenant ? */
export function peutMentir(etat: EtatPartie, joueur: string): boolean {
  const h = etat.hypothese;
  const j = etat.joueurs[joueur];
  if (!h || !j || repondantActuel(etat) !== joueur) return false;
  return rusePossible(etat, joueur, 'mensonge') && cartesCorrespondantes(etat, joueur, h.original).length > 0;
}

function repondre(
  etat: EtatPartie,
  joueur: string,
  action: Extract<ActionJeu, { type: 'repondre' } | { type: 'mentir' } | { type: 'emprunter' }>,
  now: number,
): ResultatAction {
  const h = etat.hypothese;
  if (!h || repondantActuel(etat) === null) return refus("Aucune interrogation n'attend de réponse.");
  if (repondantActuel(etat) !== joueur) return refus("Ce n'est pas à vous de répondre.");
  // Les cartes sont TOUJOURS vérifiées sur la version originale de l'hypothèse.
  const correspondantes = cartesCorrespondantes(etat, joueur, h.original);

  if (action.type === 'mentir') {
    if (!peutMentir(etat, joueur)) return refus("Le pouvoir « Mensonge » n'est pas utilisable ici.");
    const restants = consommerRuse(etat, joueur, 'mensonge');
    noter(etat, joueur, { t: now, type: 'mensonge', hypothese: h.id, restants });
    enregistrerReponse(etat, h, { joueur, resultat: 'mensonge', auto: false }, now);
    return { ok: true };
  }

  if (action.type === 'emprunter') {
    // Carte empruntée : le complice montre une carte qu'il n'a PAS (mode « rusé »).
    if (!cartesEmpruntables(etat, joueur).includes(action.carte)) return refus('Vous ne pouvez pas montrer cette carte.');
    const restants = consommerRuse(etat, joueur, 'emprunt');
    noter(etat, joueur, { t: now, type: 'ruse', ruse: 'emprunt', restants, hypothese: h.id, carte: action.carte });
    enregistrerReponse(etat, h, { joueur, resultat: 'emprunt', carte: action.carte, auto: false }, now);
    return { ok: true };
  }

  if (action.carte === null) {
    if (correspondantes.length > 0) return refus('Vous possédez une carte correspondante : vous devez en montrer une.');
    enregistrerReponse(etat, h, { joueur, resultat: 'aucune_carte', auto: false }, now);
    return { ok: true };
  }
  if (!correspondantes.includes(action.carte)) return refus('Cette carte ne correspond pas à l\'hypothèse ou ne vous appartient pas.');
  enregistrerReponse(etat, h, { joueur, resultat: 'carte_montree', carte: action.carte, auto: false }, now);
  return { ok: true };
}

function enregistrerReponse(etat: EtatPartie, h: HypotheseInterne, r: ReponseInterne, t: number) {
  h.reponses.push(r);
  publier(etat, {
    t,
    type: 'reponse',
    hypothese: h.id,
    joueur: r.joueur,
    // Un mensonge apparaît comme une absence de carte ; un emprunt comme une carte montrée.
    resultat: r.resultat === 'carte_montree' || r.resultat === 'emprunt' ? 'carte_montree' : 'aucune_carte',
    auto: r.auto,
  });
  if ((r.resultat === 'carte_montree' || r.resultat === 'emprunt') && r.carte) {
    h.carteMontree = { par: r.joueur, carte: r.carte };
    noter(etat, h.auteur, { t, type: 'carte_vue', hypothese: h.id, de: r.joueur, carte: r.carte });
    noter(etat, r.joueur, { t, type: 'carte_montree', hypothese: h.id, a: h.auteur, carte: r.carte, auto: r.auto });
    cloturerHypothese(etat, h, t);
    return;
  }
  h.index += 1;
  if (h.index >= h.interroges.length) {
    noter(etat, h.auteur, { t, type: 'aucune_carte_vue', hypothese: h.id });
    cloturerHypothese(etat, h, t);
    return;
  }
  h.echeance = t + delaiPour(etat, h.interroges[h.index], etat.config.delaiReponseMs);
}

function cloturerHypothese(etat: EtatPartie, h: HypotheseInterne, t: number) {
  h.etape = 'terminee';
  publier(etat, { t, type: 'fin_hypothese', hypothese: h.id, montreePar: h.carteMontree?.par ?? null });
  etat.hypothese = undefined;
  etat.etape = 'tour';
  const actif = joueurActif(etat);
  etat.echeanceTour = Math.max(etat.echeanceTour, t + delaiPour(etat, actif, etat.config.delaiRepriseTourMs));
}

// ---------------------------------------------------------------------------
// Archives, accusation, fin de tour
// ---------------------------------------------------------------------------

/** Faux indice pour un dossier trafiqué : FAUX pour cette solution, absent de l'affaire, de la même catégorie si possible. */
function choisirFauxIndice(etat: EtatPartie, indiceVrai: string): string {
  const dansAffaire = new Set([
    ...etat.affaire.indicesPublicsDepart,
    ...etat.affaire.indicesPublicsDifferes.map((d) => d.indice),
    ...etat.affaire.archives.map((d) => d.indice),
    ...(etat.trafics ?? []).map((t) => t.indiceFaux),
  ]);
  const faux = INDICES.filter((c) => !dansAffaire.has(c.id) && !indiceValide(c, etat.affaire.solution));
  const memeCategorie = faux.filter((c) => c.categorie === INDICES_PAR_ID[indiceVrai].categorie);
  const choix = memeCategorie.length ? memeCategorie : faux;
  return choix[alea(etat, choix.length)].id;
}

function consulterArchive(etat: EtatPartie, joueur: string, dossier: number, now: number, trafiquer = false): ResultatAction {
  const e = verifierTourActif(etat, joueur);
  if (e) return e;
  if (etat.pointsAction < 1) return refus("Vous n'avez plus de point d'action.");
  const d = etat.affaire.archives.find((a) => a.dossier === dossier);
  const piece = (etat.pieces ?? []).find((p) => p.dossier === dossier);
  const ouverture = d?.disponibleDesManche ?? piece?.disponibleDesManche;
  if (ouverture === undefined) return refus("Ce dossier d'archives n'existe pas.");
  if (ouverture > etat.manche) return refus(`Ce dossier ne sera consultable qu'à partir de la manche ${ouverture}.`);
  const j = etat.joueurs[joueur];
  if (j.dossiersConsultes.includes(dossier)) return refus('Vous avez déjà consulté ce dossier.');
  const trafic = (etat.trafics ?? []).find((t) => t.dossier === dossier);
  if (trafiquer) {
    if (!d) return refus('Une pièce à conviction ne peut pas être trafiquée.');
    if (trafic) return refus('Ce dossier a déjà été trafiqué.');
    if (!modeRuse(etat) || !rusePossible(etat, joueur, 'trafic')) return refus('Vous ne pouvez pas trafiquer ce dossier.');
  }
  etat.pointsAction -= 1;
  j.dossiersConsultes.push(dossier);
  if (d) {
    // Un dossier trafiqué montre le faux indice à tous ceux qui le lisent APRÈS le trafic.
    const lu = trafic && trafic.par !== joueur ? trafic.indiceFaux : d.indice;
    // Le faux indice est présenté sous la catégorie annoncée du dossier : rien ne le distingue.
    const categorie = lu !== d.indice ? INDICES_PAR_ID[d.indice].categorie : undefined;
    noter(etat, joueur, { t: now, type: 'archive_lue', dossier, indice: lu, ...(categorie ? { categorie } : {}) });
    if (trafiquer) {
      const indiceFaux = choisirFauxIndice(etat, d.indice);
      (etat.trafics ??= []).push({ dossier, par: joueur, indiceFaux, manche: etat.manche });
      const restants = consommerRuse(etat, joueur, 'trafic');
      noter(etat, joueur, { t: now, type: 'ruse', ruse: 'trafic', restants, dossier, indiceFaux });
    }
    publier(etat, { t: now, type: 'archive', joueur, dossier, categorie: INDICES_PAR_ID[d.indice].categorie });
  } else {
    noter(etat, joueur, { t: now, type: 'piece_lue', dossier, carte: piece!.carte });
    publier(etat, { t: now, type: 'archive', joueur, dossier, categorie: 'piece' });
  }
  return { ok: true };
}

/**
 * Dénoncer le complice (mode « rusé », 1 PA, une fois par partie et par joueur).
 * Juste : le complice est démasqué publiquement et perd toutes ses ruses.
 * Fausse : le dénonciateur perd son prochain tour.
 */
function denoncer(etat: EtatPartie, joueur: string, cible: string, now: number): ResultatAction {
  const e = verifierTourActif(etat, joueur);
  if (e) return e;
  if (!modeRuse(etat)) return refus("La dénonciation n'existe que dans le mode « complice rusé ».");
  const j = etat.joueurs[joueur];
  if (!j.peutDenoncer) return refus('Vous avez déjà dénoncé quelqu’un.');
  if (etat.compliceDemasque) return refus('Le complice a déjà été démasqué.');
  if (etat.pointsAction < 1) return refus("Vous n'avez plus de point d'action.");
  if (!etat.joueurs[cible] || cible === joueur) return refus('Choisissez un autre joueur.');
  etat.pointsAction -= 1;
  j.peutDenoncer = false;
  const correcte = cible === etat.complice;
  (etat.denonciations ??= []).push({ joueur, cible, correcte, manche: etat.manche });
  publier(etat, { t: now, type: 'denonciation', joueur, cible, correcte });
  if (correcte) {
    etat.compliceDemasque = true;
    const c = etat.joueurs[etat.complice];
    c.rusesRestantes = 0;
    c.mensongesRestants = 0;
    c.falsificationsRestantes = 0;
  } else {
    j.tourPerdu = true;
  }
  return { ok: true };
}

function accuser(etat: EtatPartie, joueur: string, action: Extract<ActionJeu, { type: 'accuser' }>, now: number): ResultatAction {
  const e = verifierTourActif(etat, joueur);
  if (e) return e;
  const j = etat.joueurs[joueur];
  if (!j.peutAccuser) return refus('Vous avez déjà formulé une accusation finale.');
  const triplet = { suspect: action.suspect, lieu: action.lieu, arme: action.arme };
  if (!tripletValide(triplet)) return refus('Accusation invalide : choisissez un suspect, un lieu et une arme.');

  // Le serveur seul décide du résultat. L'accusation n'est jamais falsifiable.
  const correcte = memeTriplet(triplet, etat.affaire.solution);
  j.peutAccuser = false;
  etat.accusations.push({ joueur, triplet: { ...triplet }, correcte, manche: etat.manche });
  noter(etat, joueur, { t: now, type: 'accusation', triplet: { ...triplet }, correcte });
  publier(etat, { t: now, type: 'accusation', joueur, triplet: { ...triplet }, correcte });
  if (correcte) {
    terminerPartie(etat, now, 'enqueteurs', 'accusation_correcte');
  } else if (enqueteursPouvantAccuser(etat).length === 0) {
    terminerPartie(etat, now, 'complice', 'plus_d_accusateur');
  }
  return { ok: true };
}

/** Passe au siège suivant (et à la manche suivante si besoin). Retourne false si la partie est finie. */
function avancerSiege(etat: EtatPartie, now: number): boolean {
  etat.indexTour += 1;
  if (etat.indexTour >= etat.ordre.length) {
    etat.indexTour = 0;
    if (etat.manche >= etat.config.manchesMax) {
      terminerPartie(etat, now, 'complice', 'manches_ecoulees');
      return false;
    }
    etat.manche += 1;
    publier(etat, { t: now, type: 'debut_manche', manche: etat.manche });
    for (const d of etat.affaire.indicesPublicsDifferes) {
      if (d.manche === etat.manche) {
        etat.indicesPublics.push({ indice: d.indice, manche: d.manche });
        publier(etat, { t: now, type: 'indice_public', indice: d.indice, manche: d.manche });
      }
    }
    for (const e of etat.empreintesPrevues ?? []) {
      if (e.manche === etat.manche) publier(etat, { t: now, type: 'empreinte', innocente: e.innocente, manche: etat.manche });
    }
  }
  return true;
}

function terminerTour(etat: EtatPartie, now: number, raison: 'volontaire' | 'temps_ecoule') {
  publier(etat, { t: now, type: 'fin_tour', joueur: joueurActif(etat), raison });
  for (let garde = 0; garde <= etat.ordre.length * 2; garde++) {
    if (!avancerSiege(etat, now)) return;
    const suivant = etat.joueurs[joueurActif(etat)];
    if (!suivant.tourPerdu) break;
    // Dénonciation fausse : ce tour est perdu.
    suivant.tourPerdu = false;
    publier(etat, { t: now, type: 'debut_tour', joueur: suivant.id, manche: etat.manche });
    publier(etat, { t: now, type: 'fin_tour', joueur: suivant.id, raison: 'tour_perdu' });
  }
  etat.pointsAction = etat.config.pointsAction;
  etat.hypothesesCeTour = 0;
  const actif = joueurActif(etat);
  etat.echeanceTour = echeanceDeTour(etat, actif, now);
  publier(etat, { t: now, type: 'debut_tour', joueur: actif, manche: etat.manche });
}

function terminerPartie(etat: EtatPartie, now: number, vainqueur: Vainqueur, raison: RaisonFin) {
  etat.etape = 'terminee';
  etat.hypothese = undefined;
  etat.resultat = { vainqueur, raison, t: now };
  publier(etat, { t: now, type: 'fin_partie', vainqueur, raison });
  auditer(etat, now, null, 'fin_partie', true, `${vainqueur} (${raison})`);
}

// ---------------------------------------------------------------------------
// Carnet de déduction
// ---------------------------------------------------------------------------

const MARQUES: Marque[] = ['inconnu', 'ecarte', 'probable', 'certain'];
export const NOTES_MAX = 4000;

function majCarnet(etat: EtatPartie, joueur: string, action: Extract<ActionJeu, { type: 'carnet' }>): ResultatAction {
  const carnet = etat.joueurs[joueur].carnet;
  if (action.marques !== undefined) {
    if (typeof action.marques !== 'object' || action.marques === null) return refus('Carnet invalide.');
    for (const [cle, valeur] of Object.entries(action.marques)) {
      if (!categorieDe(cle)) return refus('Élément de carnet inconnu.');
      if (!MARQUES.includes(valeur as Marque)) return refus('Marque de carnet invalide.');
    }
  }
  if (action.notes !== undefined) {
    if (typeof action.notes !== 'string') return refus('Notes invalides.');
    if (action.notes.length > NOTES_MAX) return refus(`Les notes sont limitées à ${NOTES_MAX} caractères.`);
  }
  if (action.marques) {
    for (const [cle, valeur] of Object.entries(action.marques)) {
      if (valeur === 'inconnu') delete carnet.marques[cle as ElementId];
      else carnet.marques[cle as ElementId] = valeur as Marque;
    }
  }
  if (action.notes !== undefined) carnet.notes = action.notes;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Temps : échéances et réponses automatiques
// ---------------------------------------------------------------------------

export function prochaineEcheance(etat: EtatPartie): number | null {
  if (etat.etape === 'terminee') return null;
  if (etat.etape === 'hypothese' && etat.hypothese) return etat.hypothese.echeance;
  return etat.echeanceTour;
}

/**
 * Traite toutes les échéances dépassées. Retourne true si l'état a changé.
 * - fin de l'étape de falsification -> publication de l'hypothèse ;
 * - réponse non donnée à temps     -> réponse automatique HONNÊTE (jamais de mensonge) ;
 * - tour non terminé à temps       -> fin de tour automatique.
 */
export function avancer(etat: EtatPartie, now: number, rng?: Rng): boolean {
  let change = false;
  for (let garde = 0; garde < 500; garde++) {
    const echeance = prochaineEcheance(etat);
    if (echeance === null || echeance > now) break;
    change = true;
    const h = etat.hypothese;
    if (etat.etape === 'hypothese' && h) {
      if (h.etape === 'falsification') {
        publierHypothese(etat, h, h.echeance);
      } else if (h.etape === 'interrogation') {
        const repondant = h.interroges[h.index];
        const cartes = cartesCorrespondantes(etat, repondant, h.original);
        if (cartes.length > 0) {
          const carte = rng ? pick(rng, cartes) : cartes[0];
          enregistrerReponse(etat, h, { joueur: repondant, resultat: 'carte_montree', carte, auto: true }, h.echeance);
        } else {
          enregistrerReponse(etat, h, { joueur: repondant, resultat: 'aucune_carte', auto: true }, h.echeance);
        }
        auditer(etat, now, repondant, 'reponse_auto', true);
      }
    } else if (etat.etape === 'tour') {
      terminerTour(etat, etat.echeanceTour, 'temps_ecoule');
    }
  }
  if (change) etat.version++;
  return change;
}

/**
 * Après un redémarrage du serveur, les échéances passées pendant l'arrêt ne doivent
 * pas déclencher une cascade de tours automatiques : on les repousse.
 */
export function recalerEcheances(etat: EtatPartie, now: number) {
  if (etat.etape === 'terminee') return;
  // Tour sans limite : le joueur actif dispose de 2 minutes pour revenir, puis la partie continue.
  etat.echeanceTour =
    etat.config.delaiTourMs === null ? Math.min(etat.echeanceTour, now + 120_000) : Math.max(etat.echeanceTour, now + etat.config.delaiTourMs);
  if (etat.hypothese) {
    const delai = etat.hypothese.etape === 'falsification' ? etat.config.delaiFalsificationMs : etat.config.delaiReponseMs;
    etat.hypothese.echeance = Math.max(etat.hypothese.echeance, now + delai);
  }
}

// ---------------------------------------------------------------------------
// Présence
// ---------------------------------------------------------------------------

/** Le joueur quitte volontairement la partie : il est considéré absent et ses tours passent aussitôt. */
export function abandonner(etat: EtatPartie, joueur: string, now: number) {
  const j = etat.joueurs[joueur];
  if (!j || j.parti) return;
  j.parti = true;
  j.connecte = false;
  publier(etat, { t: now, type: 'depart', joueur });
  if (etat.etape !== 'terminee') {
    const limite = now + DELAI_PARTI_MS;
    if (etat.etape === 'tour' && joueurActif(etat) === joueur) etat.echeanceTour = Math.min(etat.echeanceTour, limite);
    if (etat.etape === 'hypothese' && etat.hypothese?.etape === 'interrogation' && repondantActuel(etat) === joueur)
      etat.hypothese.echeance = Math.min(etat.hypothese.echeance, limite);
  }
  etat.version++;
}

/** Met à jour l'état de connexion ; raccourcit les délais d'un joueur absent. */
export function definirConnexion(etat: EtatPartie, joueur: string, connecte: boolean, now: number) {
  const j = etat.joueurs[joueur];
  if (!j || j.connecte === connecte) return;
  j.connecte = connecte;
  if (connecte) j.parti = false; // revenu avec son jeton : il reprend sa place
  publier(etat, { t: now, type: 'connexion', joueur, connecte });
  if (etat.etape === 'terminee') {
    etat.version++;
    return;
  }
  const concerneTour = etat.etape === 'tour' && joueurActif(etat) === joueur;
  const concerneReponse = etat.etape === 'hypothese' && etat.hypothese?.etape === 'interrogation' && repondantActuel(etat) === joueur;
  if (!connecte) {
    const limite = now + etat.config.delaiDeconnecteMs;
    if (concerneTour) etat.echeanceTour = Math.min(etat.echeanceTour, limite);
    if (concerneReponse) etat.hypothese!.echeance = Math.min(etat.hypothese!.echeance, limite);
  } else {
    // De retour (page rechargée, réseau rétabli) : on lui rend un délai raisonnable.
    if (concerneTour)
      etat.echeanceTour =
        etat.config.delaiTourMs === null
          ? SANS_LIMITE
          : Math.max(etat.echeanceTour, now + Math.min(etat.config.delaiRepriseTourMs, etat.config.delaiTourMs));
    if (concerneReponse) etat.hypothese!.echeance = Math.max(etat.hypothese!.echeance, now + Math.min(etat.config.delaiRepriseTourMs, etat.config.delaiReponseMs));
  }
  etat.version++;
}
