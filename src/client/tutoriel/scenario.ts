// Partie guidée : la « fausse partie » arrangée pour le tutoriel. Une vraie partie de Grande enquête
// à 5 joueurs (vous et quatre bots), que le guide fait avancer à sa façon : il change votre rôle
// d'un chapitre à l'autre, fait jouer les bots d'un coup ou leur dicte un coup précis.
// Ce fichier ne dépend pas de l'interface : il est testé à part (tests/tutoriel.test.ts).

import { CONFIG_GRANDE_ENQUETE, type ConfigPartie } from '../../engine/config';
import { appliquerAction, avancer, creerPartie, joueurActif, peutFalsifier, pouvoirsInitiaux, repondantActuel, type EtatPartie } from '../../engine/partie';
import { seededRng } from '../../engine/rng';
import { categorieDe, elementsDe, type ActionJeu, type Categorie, type ElementId, type EntreePrivee, type Role, type RoleEnquete, type Triplet } from '../../shared/types';

export const MOI = 'vous';
export const MARPLE = 'marple';
export const HERCULE = 'hercule';
export const SHERLOCK = 'sherlock';
export const MAIGRET = 'maigret';
/** Ordre du tour : vous commencez, Marple joue juste après vous. */
export const ORDRE = [MOI, MARPLE, HERCULE, SHERLOCK, MAIGRET];
export const BOTS = ORDRE.slice(1);

export const SOLUTION: Triplet = { suspect: 'gabriel', lieu: 'cave', arme: 'chandelier', mobile: 'manoir_heritage' };
const MANOIR = elementsDe('manoir');

/** Règles de la Grande enquête, sans limite de temps, et pouvoirs utilisables dès la manche 1. */
const R = CONFIG_GRANDE_ENQUETE;
export const CONFIG_GUIDE: Partial<ConfigPartie> = {
  ...R,
  delaiTourMs: null,
  delaiReponseMs: 600_000,
  // Courte quand un bot est le complice ; allongée quand c'est vous (voir poserMonRole).
  delaiFalsificationMs: 2_000,
  // La fenêtre « Votre rôle » reste ouverte tant que vous ne l'avez pas fermée.
  attenteDepartMs: 3_600_000,
  roles: { ...R.roles!, mancheExpertise: 1, mancheProfilage: 1 },
  objectifs: { ...R.objectifs!, delaiDesignationMs: 120_000 },
};
/** Fenêtre de falsification quand vous êtes le complice : elle attend votre choix. */
const FALSIFICATION_COMPLICE_MS = 600_000;

export function creerPartieGuidee(nom: string, now = Date.now()): EtatPartie {
  // Première graine où vous jouez en premier ; l'ordre des autres est ensuite fixé.
  for (let graine = 1; graine < 500; graine++) {
    const etat = creerPartie({
      id: `guide-${graine}`,
      joueurs: [
        { id: MOI, nom },
        { id: MARPLE, nom: 'Marple (bot)', bot: true },
        { id: HERCULE, nom: 'Hercule (bot)', bot: true },
        { id: SHERLOCK, nom: 'Sherlock (bot)', bot: true },
        { id: MAIGRET, nom: 'Maigret (bot)', bot: true },
      ],
      rng: seededRng(graine),
      now,
      config: CONFIG_GUIDE,
      imposer: { solution: SOLUTION, complice: MARPLE },
    });
    if (etat.ordre[0] !== MOI) continue;
    etat.ordre = [...ORDRE];
    for (const ev of etat.historique) if (ev.type === 'debut_partie') ev.joueurs = [...ORDRE];
    // Objectif secret du complice : le témoin gênant (le final du guide le met en scène).
    etat.objectif = { type: 'temoin_genant' };
    poserMonRole(etat, { role: 'enqueteur' }, now, false);
    // Les rôles tirés à la création sont remplacés : la première ligne des observations aussi.
    for (const id of ORDRE) {
      const j = etat.joueurs[id];
      const i = j.journal.findIndex((e) => e.type === 'role');
      j.journal[i] = entreeRole(etat, id, now);
    }
    return etat;
  }
  throw new Error('Partie guidée : aucune graine ne convient.');
}

// ---------------------------------------------------------------------------
// Rôles : le vôtre change d'un chapitre à l'autre, ceux des bots suivent
// ---------------------------------------------------------------------------

export type RoleGuide = { role: 'enqueteur'; roleEnquete?: RoleEnquete } | { role: 'complice' } | { role: 'maitre_chanteur' };

/**
 * Donne un rôle à un joueur (pouvoirs neufs, ruses s'il devient complice). Rien ne change s'il l'a déjà.
 * `annoncer` : une ligne « Votre rôle… » s'ajoute à ses observations.
 */
function poserRole(etat: EtatPartie, id: string, r: RoleGuide, now: number, annoncer: boolean) {
  const j = etat.joueurs[id];
  const roleEnquete = r.role === 'enqueteur' ? r.roleEnquete : undefined;
  if (j.role === r.role && j.roleEnquete === roleEnquete) return;
  j.role = r.role as Role;
  if (roleEnquete) {
    j.roleEnquete = roleEnquete;
    j.pouvoirs = pouvoirsInitiaux(etat.config, roleEnquete);
  } else {
    delete j.roleEnquete;
    delete j.pouvoirs;
  }
  if (r.role === 'complice') {
    etat.complice = id;
    j.rusesRestantes = etat.config.ruses[etat.ordre.length] ?? 5;
    // Un nouveau complice : les empreintes de l'ancien n'ont plus de sens.
    etat.empreintesPrevues = [];
    etat.compliceDemasque = false;
    delete etat.retourRuses;
  } else j.rusesRestantes = 0;
  if (annoncer) j.journal.push(entreeRole(etat, id, now));
}

/** La ligne « Votre rôle… » des observations, pour le rôle actuel du joueur. */
function entreeRole(etat: EtatPartie, id: string, now: number): EntreePrivee {
  const j = etat.joueurs[id];
  const s = etat.affaire.solution;
  return {
    t: now,
    type: 'role',
    role: j.role,
    ...(j.role === 'complice' ? { meurtrier: s.suspect } : {}),
    ...(j.role === 'maitre_chanteur' ? { mobile: s.mobile } : {}),
    ...(j.roleEnquete ? { roleEnquete: j.roleEnquete } : {}),
    ...(j.roleEnquete === 'temoin' ? { lieu: s.lieu } : {}),
  };
}

/**
 * Votre rôle pour ce chapitre ; ceux des bots en découlent. Marple est la complice, sauf quand vous
 * l'êtes (elle devient alors le Témoin) ; Sherlock est le Maître chanteur, sauf quand vous l'êtes.
 */
export function poserMonRole(etat: EtatPartie, r: RoleGuide, now = Date.now(), annoncer = true) {
  // Le complice d'abord (il n'y en a qu'un) : l'ancien quitte son rôle avant que le nouveau le prenne.
  if (r.role === 'complice') {
    poserRole(etat, MARPLE, { role: 'enqueteur', roleEnquete: 'temoin' }, now, annoncer);
    poserRole(etat, MOI, r, now, annoncer);
  } else {
    poserRole(etat, MOI, r, now, annoncer);
    poserRole(etat, MARPLE, { role: 'complice' }, now, annoncer);
  }
  poserRole(etat, SHERLOCK, r.role === 'maitre_chanteur' ? { role: 'enqueteur', roleEnquete: 'profileur' } : { role: 'maitre_chanteur' }, now, annoncer);
  poserRole(etat, HERCULE, { role: 'enqueteur', roleEnquete: 'inspecteur' }, now, annoncer);
  poserRole(etat, MAIGRET, { role: 'enqueteur', roleEnquete: 'journaliste' }, now, annoncer);
  // Complice : la fenêtre de falsification attend votre choix ; sinon, elle passe vite.
  etat.config.delaiFalsificationMs = etat.complice === MOI ? FALSIFICATION_COMPLICE_MS : (CONFIG_GUIDE.delaiFalsificationMs ?? 2_000);
}

// ---------------------------------------------------------------------------
// Faire avancer la partie
// ---------------------------------------------------------------------------

/** Décision d'un bot à un moment donné (le guide y ajoute ses coups imposés et ses interdits). */
export type Decideur = (id: string) => ActionJeu | null;

/**
 * Les bots jouent d'un coup, jusqu'au tour de `jusqua` (vous, par défaut). Les réponses qu'on vous
 * demanderait sont données automatiquement (honnêtement). Retourne l'heure atteinte.
 */
export function avanceRapide(etat: EtatPartie, decider: Decideur, jusqua = MOI, t0 = Date.now()): number {
  let t = t0;
  let tour = '';
  let coups = 0;
  for (let garde = 0; garde < 800; garde++) {
    if (etat.etape === 'terminee' || etat.etape === 'designation') break;
    if (etat.attenteDepart) appliquerAction(etat, MOI, { type: 'pret' }, t);
    const h = etat.hypothese;
    if (!h && etat.etape === 'tour' && joueurActif(etat) === jusqua) break;
    if (h) {
      if (h.etape === 'falsification') {
        const c = etat.complice;
        if (c !== MOI && peutFalsifier(etat, c)) {
          const a = decider(c);
          if (a && (a.type === 'falsifier' || a.type === 'passerFalsification')) appliquerAction(etat, c, a, t);
        }
      } else {
        const r = repondantActuel(etat);
        if (r && r !== MOI) {
          const a = decider(r);
          if (a && (a.type === 'repondre' || a.type === 'mentir' || a.type === 'emprunter') && appliquerAction(etat, r, a, t).ok) continue;
        }
      }
      // On n'attend pas l'échéance : publication de l'hypothèse, ou réponse automatique (honnête).
      if (etat.hypothese === h) {
        h.echeance = Math.min(h.echeance, t);
        avancer(etat, t);
      }
      continue;
    }
    const actif = joueurActif(etat);
    const cle = `${etat.manche}|${actif}`;
    if (cle !== tour) {
      tour = cle;
      coups = 0;
    }
    t += 1;
    // Vous (si l'on avance jusqu'à un bot) passez votre tour ; un bot ne joue pas plus de 8 coups.
    const a = actif === MOI || ++coups > 8 ? null : decider(actif);
    if (!a || a.type === 'finTour' || !appliquerAction(etat, actif, a, t).ok) appliquerAction(etat, actif, { type: 'finTour' }, t);
  }
  return t;
}

/** Vous terminez votre tour (s'il est en cours), puis les bots jouent jusqu'à votre tour suivant. */
export function tourSuivant(etat: EtatPartie, decider: Decideur, now = Date.now()): number {
  if (etat.attenteDepart) appliquerAction(etat, MOI, { type: 'pret' }, now);
  if (etat.etape === 'tour' && joueurActif(etat) === MOI) appliquerAction(etat, MOI, { type: 'finTour' }, now);
  return avanceRapide(etat, decider, MOI, now);
}

// ---------------------------------------------------------------------------
// Hypothèses conseillées par le guide
// ---------------------------------------------------------------------------

const PAR_CATEGORIE: [Categorie, readonly ElementId[]][] = [
  ['suspect', MANOIR.suspects],
  ['lieu', MANOIR.lieux],
  ['arme', MANOIR.armes],
  ['mobile', MANOIR.mobiles],
];

/**
 * Une hypothèse qui contient une carte de `detenteur` et, pour le reste, des éléments que
 * ni vous ni les `eviter` ne détenez : le détenteur sera le seul à pouvoir répondre. Ces éléments
 * sont pris de préférence dans la main des autres joueurs, pour ne pas souffler la solution.
 */
export function hypotheseAvec(etat: EtatPartie, detenteur: string, eviter: string[] = [], carte?: ElementId): Triplet {
  const choisie = carte ?? etat.joueurs[detenteur].main[0];
  const tenues = new Set([MOI, detenteur, ...eviter].flatMap((id) => etat.joueurs[id].main));
  const ailleurs = new Set(etat.ordre.filter((id) => id !== MOI && id !== detenteur && !eviter.includes(id)).flatMap((id) => etat.joueurs[id].main));
  const t: Partial<Record<Categorie, ElementId>> = { [categorieDe(choisie)!]: choisie };
  for (const [cat, ids] of PAR_CATEGORIE)
    t[cat] ??= ids.find((x) => ailleurs.has(x)) ?? ids.find((x) => !tenues.has(x)) ?? ids.find((x) => !etat.joueurs[MOI].main.includes(x))!;
  return t as unknown as Triplet;
}

/** Les joueurs (autres que l'auteur) qui ont cité ce lieu dans leurs hypothèses publiques, dans l'ordre. */
export function ontCiteLeLieu(etat: EtatPartie, lieu: ElementId, sauf: string): string[] {
  const ids: string[] = [];
  for (const ev of etat.historique) if (ev.type === 'hypothese' && ev.triplet.lieu === lieu && ev.auteur !== sauf && !ids.includes(ev.auteur)) ids.push(ev.auteur);
  return ids;
}
