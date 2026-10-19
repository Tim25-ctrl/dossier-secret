// Joueur automatique. Décide d'UNE action à partir de sa vue filtrée.
// Utilisé : 1) pour compléter une table et tester seul, 2) pour les simulations
// d'équilibrage. Ses décisions sont une approximation grossière d'un humain.

import { pick, shuffle, type Rng } from '../engine/rng';
import { SUSPECTS, elementsDuTriplet, type ActionJeu, type SuspectId, type Triplet, type VueJoueur } from '../shared/types';
import { candidatsComplice, deduireRobuste, deduireSimple, type Connaissance } from './deduction';

export interface ProfilBot {
  /** Probabilité de mentir quand c'est possible et utile. */
  mensonge: number;
  /** Probabilité de falsifier une hypothèse qui ne vise pas le meurtrier. */
  falsificationOpportuniste: number;
  /** Le complice utilise-t-il ses pouvoirs ? (désactivable pour mesurer leur effet) */
  pouvoirs: boolean;
  /** Part des réponses aux hypothèses des autres dont le bot tient compte (1 = mémoire parfaite). */
  attention: number;
  /** 'expert' : propagation logique complète ; 'simple' : éliminations directes seulement. */
  deduction: 'expert' | 'simple';
  /** Mode « rusé » : probabilité d'emprunter une carte quand on n'en a aucune à montrer. */
  emprunt: number;
  /** Mode « rusé » : probabilité de trafiquer un dossier lu. */
  trafic: number;
  /** Mode « rusé » : l'enquêteur dénonce-t-il quand un seul suspect reste possible ? */
  denonce: boolean;
}

/** Profil « expert » : mémoire et déduction parfaites (borne haute de la force des enquêteurs). */
export const PROFIL_PAR_DEFAUT: ProfilBot = {
  mensonge: 0.6,
  falsificationOpportuniste: 0.25,
  pouvoirs: true,
  attention: 1,
  deduction: 'expert',
  emprunt: 0.35,
  trafic: 0.5,
  denonce: true,
};
/** Profil « joueur attentif » : propagation complète mais ne retient qu'une partie des réponses des autres. */
export const PROFIL_ATTENTIF: ProfilBot = { ...PROFIL_PAR_DEFAUT, attention: 0.35 };
/** Profil « joueur occasionnel » : coche son carnet avec ce qu'il voit directement, sans plus. */
export const PROFIL_OCCASIONNEL: ProfilBot = { ...PROFIL_PAR_DEFAUT, deduction: 'simple' };

export function decisionBot(vue: VueJoueur, rng: Rng, profil: ProfilBot = PROFIL_PAR_DEFAUT): ActionJeu | null {
  if (vue.etape === 'terminee') return null;
  const moi = vue.moi.id;
  const h = vue.hypotheseEnCours;

  // 1. Falsification (complice uniquement, pendant la fenêtre prévue).
  if (h?.falsification && !h.falsification.decide) return decisionFalsification(vue, h.falsification.original, rng, profil);

  // 2. Réponse à une interrogation.
  if (h?.aRepondre && h.repondantActuel === moi) {
    const cartes = h.aRepondre.cartesCorrespondantes;
    const empruntables = h.aRepondre.cartesEmpruntables ?? [];
    // Carte empruntée : faire croire qu'on détient une carte (mode « rusé »).
    if (cartes.length === 0 && empruntables.length > 0 && profil.pouvoirs && rng.int(1000) < profil.emprunt * 1000)
      return { type: 'emprunter', carte: pick(rng, empruntables) };
    if (cartes.length === 0) return { type: 'repondre', carte: null };
    if (h.aRepondre.peutMentir && profil.pouvoirs && vue.moi.meurtrier) {
      const t = h.triplet!;
      if (t.suspect !== vue.moi.meurtrier && rng.int(1000) < profil.mensonge * 1000) return { type: 'mentir' };
    }
    // Préférer une carte déjà montrée à ce même enquêteur (ne lui apprend rien de nouveau).
    const dejaMontrees = vue.moi.journal.flatMap((e) => (e.type === 'carte_montree' && e.a === h.auteur ? [e.carte] : []));
    const deja = cartes.find((c) => dejaMontrees.includes(c));
    return { type: 'repondre', carte: deja ?? pick(rng, cartes) };
  }

  // 3. Mon tour.
  if (vue.etape !== 'tour' || vue.joueurActif !== moi) return null;
  return vue.moi.role === 'complice' ? tourComplice(vue, rng, profil) : tourEnqueteur(vue, rng, profil);
}

function decisionFalsification(vue: VueJoueur, original: Triplet, rng: Rng, profil: ProfilBot): ActionJeu {
  const meurtrier = vue.moi.meurtrier!;
  if (!profil.pouvoirs) return { type: 'passerFalsification' };
  const innocents = SUSPECTS.filter((s) => s !== meurtrier && s !== original.suspect);
  if (original.suspect === meurtrier) return { type: 'falsifier', champ: 'suspect', valeur: pick(rng, innocents) };
  if (rng.int(1000) < profil.falsificationOpportuniste * 1000)
    return { type: 'falsifier', champ: 'suspect', valeur: pick(rng, innocents.length ? innocents : SUSPECTS.filter((s) => s !== original.suspect)) };
  return { type: 'passerFalsification' };
}

function choisirInterroges(vue: VueJoueur, t: Triplet, k: Connaissance | null, rng: Rng): string[] {
  const autres = vue.joueurs.filter((j) => j.id !== vue.moi.id).map((j) => j.id);
  const elements = elementsDuTriplet(t);
  // On privilégie les joueurs dont on ignore s'ils détiennent un élément de l'hypothèse.
  const score = (j: string) => (k ? elements.filter((c) => k.possession.get(c)!.get(j) === undefined).length : 0);
  const ordonnes = shuffle(rng, autres).sort((a, b) => score(b) - score(a));
  return ordonnes.slice(0, vue.regles.nbInterroges);
}

/**
 * Quand une hypothèse coûte tout le tour, le bot choisit parfois de lire les archives à la place
 * (un tour sur trois environ, s'il reste des dossiers à lire).
 */
function preferArchives(vue: VueJoueur, rng: Rng): boolean {
  if (vue.regles.coutHypothese < vue.regles.pointsAction) return false;
  return dossierDisponible(vue) !== null && rng.int(100) < 35;
}

function dossierDisponible(vue: VueJoueur): number | null {
  const d = vue.archives.find((a) => a.disponible && !a.consulte);
  return d ? d.dossier : null;
}

function tourEnqueteur(vue: VueJoueur, rng: Rng, profil: ProfilBot): ActionJeu {
  const k = deduireRobuste(vue, profil.attention);
  if (profil.deduction === 'simple') k.combinaisons = deduireSimple(vue);
  const derniereManche = vue.manche >= vue.regles.manchesMax;

  if (vue.moi.peutAccuser && k.combinaisons.length === 1) return { type: 'accuser', ...k.combinaisons[0] };
  // Mode « rusé » : dénoncer dès qu'un seul joueur peut être le complice.
  if (profil.denonce && vue.moi.peutDenoncer && vue.pointsAction >= 1 && !vue.compliceDemasque) {
    const suspects = candidatsComplice(vue);
    if (suspects.length === 1) return { type: 'denoncer', joueur: suspects[0] };
  }

  const peutHypothese = vue.pointsAction >= vue.regles.coutHypothese && vue.hypothesesCeTour < vue.regles.hypothesesMaxParTour;
  if (peutHypothese && k.combinaisons.length > 0 && !preferArchives(vue, rng)) {
    const t = choisirHypothese(k, rng);
    return { type: 'hypothese', ...t, interroges: choisirInterroges(vue, t, k, rng) };
  }
  const dossier = dossierDisponible(vue);
  if (vue.pointsAction >= 1 && dossier !== null) return { type: 'consulterArchive', dossier };
  // Dernière manche : rien à perdre, on tente sa meilleure piste avant de passer.
  if (vue.moi.peutAccuser && derniereManche && k.combinaisons.length > 0) return { type: 'accuser', ...pick(rng, k.combinaisons) };
  return { type: 'finTour' };
}

/** Choisit une hypothèse parmi les combinaisons possibles, en favorisant les éléments les plus incertains. */
function choisirHypothese(k: Connaissance, rng: Rng): Triplet {
  return pick(rng, k.combinaisons);
}

function tourComplice(vue: VueJoueur, rng: Rng, profil: ProfilBot): ActionJeu {
  const meurtrier = vue.moi.meurtrier as SuspectId;
  const peutHypothese = vue.pointsAction >= vue.regles.coutHypothese && vue.hypothesesCeTour < vue.regles.hypothesesMaxParTour;
  if (peutHypothese && !preferArchives(vue, rng)) {
    // Hypothèse « crédible » qui détourne l'attention du meurtrier.
    const k = deduireRobuste(vue);
    const suspects = SUSPECTS.filter((s) => s !== meurtrier) as SuspectId[];
    const base = k.combinaisons.length ? pick(rng, k.combinaisons) : { suspect: meurtrier, lieu: 'bureau', arme: 'chandelier' } as Triplet;
    const t: Triplet = { ...base, suspect: pick(rng, suspects) };
    return { type: 'hypothese', ...t, interroges: choisirInterroges(vue, t, null, rng) };
  }
  const dossier = dossierDisponible(vue);
  if (vue.pointsAction >= 1 && dossier !== null) {
    // Dossier trafiqué : les prochains lecteurs liront un faux indice (mode « rusé »).
    const estIndice = vue.archives.find((a) => a.dossier === dossier)?.categorie !== 'piece';
    const trafiquer = profil.pouvoirs && estIndice && (vue.moi.rusesRestantes ?? 0) > 0 && rng.int(1000) < profil.trafic * 1000;
    return { type: 'consulterArchive', dossier, ...(trafiquer ? { trafiquer: true } : {}) };
  }
  return { type: 'finTour' };
}

