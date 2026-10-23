// Comportements des bots propres à la « Grande enquête » (docs/GRANDE-ENQUETE.md) : pouvoirs de rôle,
// tableau d'enquête, Témoin qui se cache, objectif secret du complice, soupçons plus actifs.
// Rien de tout cela ne sert dans une partie classique : son comportement reste celui de bot.ts.

import { pick, shuffle, type Rng } from '../engine/rng';
import { elementsDe, type ActionJeu, type Categorie, type CibleEpingle, type ElementId, type Triplet, type VueJoueur } from '../shared/types';
import { candidatsComplice, deduire, retenu, type Connaissance } from './deduction';

/** La partie a-t-elle un tableau d'enquête (« Grande enquête ») ? */
export const avecTableau = (vue: VueJoueur) => !!vue.tableau && !!vue.regles.tableau;

/** Part des manches où un bot épingle quelque chose, et où le Journaliste publie une rumeur. */
const ENVIE_EPINGLE = 0.45;
const ENVIE_RUMEUR = 0.4;

// ---------------------------------------------------------------------------
// Tableau d'enquête (à tout moment, pas seulement pendant son tour)
// ---------------------------------------------------------------------------

/**
 * Épingle ou rumeur du bot pour cette manche. La décision d'épingler est déterministe (même bot,
 * même manche = même décision), car le serveur interroge les bots à chaque changement de la partie.
 */
export function actionTableau(vue: VueJoueur, rng: Rng): ActionJeu | null {
  if (!avecTableau(vue) || vue.pause || (vue.etape !== 'tour' && vue.etape !== 'hypothese')) return null;
  const moi = vue.moi.id;
  const tableau = vue.tableau!;
  // Rumeur anonyme du Journaliste.
  if (
    vue.moi.roleEnquete === 'journaliste' &&
    (vue.moi.pouvoirsRole?.rumeurs ?? 0) > 0 &&
    !tableau.some((e) => e.auteur === moi && e.rumeur && e.manche === vue.manche) &&
    retenu(`${moi}|rumeur|${vue.manche}`, ENVIE_RUMEUR)
  ) {
    const contenu = contenuEnqueteur(vue, rng);
    if (contenu) return { type: 'epingler', ...contenu, rumeur: true };
  }
  const reaction = reagirAuTableau(vue);
  if (reaction) return reaction;
  if (tableau.some((e) => e.auteur === moi && !e.rumeur && e.manche === vue.manche)) return null;
  if (!retenu(`${moi}|epingle|${vue.manche}`, ENVIE_EPINGLE)) return null;
  // Le Maître chanteur joue pour lui seul : il n'aide personne au tableau.
  if (vue.moi.role === 'maitre_chanteur') return null;
  const contenu = vue.moi.role === 'complice' ? contenuComplice(vue, rng) : contenuEnqueteur(vue, rng);
  return contenu ? { type: 'epingler', ...contenu } : null;
}

/** Part des épingles des autres auxquelles un bot réagit quand il a un avis. */
const ENVIE_REACTION = 0.6;

/**
 * Réactions 👍 / 👎 : un enquêteur approuve ce qu'il sait vrai et conteste ce qu'il sait faux
 * (ses cartes, celles qu'on lui a montrées, son propre rôle). Le complice soutient ses mensonges.
 */
function reagirAuTableau(vue: VueJoueur): ActionJeu | null {
  const moi = vue.moi.id;
  const innocents = new Set<string>([
    ...vue.moi.main,
    ...vue.moi.journal.flatMap((e) => (e.type === 'carte_vue' ? [e.carte] : e.type === 'expertise' ? e.innocents : [])),
  ]);
  const complice = vue.moi.role === 'complice';
  const bouc = vue.moi.objectif?.type === 'bouc_emissaire' ? vue.moi.objectif.suspect : undefined;
  for (const e of vue.tableau!) {
    if (e.auteur === moi || e.maReaction || !retenu(`${moi}|reaction|${e.id}`, ENVIE_REACTION)) continue;
    let avis: 'pour' | 'contre' | null = null;
    if (complice) {
      if (e.cible.type === 'element' && e.cible.id === bouc) avis = e.etiquette === 'coupable' ? 'pour' : 'contre';
      else if (e.cible.type === 'element' && e.cible.id === vue.moi.meurtrier) avis = e.etiquette === 'coupable' ? 'contre' : 'pour';
      else if (e.cible.type === 'joueur' && e.cible.id === moi) avis = e.etiquette === 'complice' ? 'contre' : 'pour';
    } else if (e.cible.type === 'joueur' && e.cible.id === moi) {
      // On sait qu'on n'est pas le complice.
      avis = e.etiquette === 'complice' ? 'contre' : 'pour';
    } else if (e.cible.type === 'element' && innocents.has(e.cible.id)) {
      avis = e.etiquette === 'coupable' ? 'contre' : 'pour';
    }
    if (avis) return { type: 'reagir', epingle: e.id, reaction: avis };
  }
  return null;
}

type Contenu = { cible: CibleEpingle; etiquette: 'innocent' | 'coupable' | 'complice' };

const dejaEpingle = (vue: VueJoueur, cible: CibleEpingle, etiquette: string) =>
  vue.tableau!.some((e) => e.auteur === vue.moi.id && e.cible.id === cible.id && e.etiquette === etiquette);

/** Un enquêteur partage ses soupçons sur le complice, sinon une carte de sa main (innocente). */
function contenuEnqueteur(vue: VueJoueur, rng: Rng): Contenu | null {
  const soupcons = candidatsComplice(vue).filter((id) => id !== vue.moi.id);
  if (soupcons.length >= 1 && soupcons.length <= 2) {
    const cible: CibleEpingle = { type: 'joueur', id: soupcons[0] };
    if (!dejaEpingle(vue, cible, 'complice')) return { cible, etiquette: 'complice' };
  }
  const dejaInnocents = new Set(vue.tableau!.filter((e) => e.etiquette === 'innocent').map((e) => e.cible.id));
  const cartes = vue.moi.main.filter((c) => !dejaInnocents.has(c));
  if (cartes.length === 0) return null;
  return { cible: { type: 'element', id: pick(rng, cartes) }, etiquette: 'innocent' };
}

/** Le complice brouille les pistes : il pousse son bouc émissaire, accuse un innocent ou blanchit le meurtrier. */
function contenuComplice(vue: VueJoueur, rng: Rng): Contenu | null {
  const o = vue.moi.objectif;
  if (o?.type === 'bouc_emissaire' && o.suspect) {
    const cible: CibleEpingle = { type: 'element', id: o.suspect };
    if (!dejaEpingle(vue, cible, 'coupable')) return { cible, etiquette: 'coupable' };
  }
  const autres = vue.joueurs.map((j) => j.id).filter((id) => id !== vue.moi.id);
  if (rng.int(2) === 0 && vue.moi.meurtrier) {
    const cible: CibleEpingle = { type: 'element', id: vue.moi.meurtrier };
    if (!dejaEpingle(vue, cible, 'innocent')) return { cible, etiquette: 'innocent' };
  }
  return { cible: { type: 'joueur', id: pick(rng, autres) }, etiquette: 'complice' };
}

/**
 * Dernière manche : parmi les combinaisons encore possibles, le bot tente celle que le tableau
 * soutient le plus (épingles « coupable » moins épingles « innocent », réactions comprises).
 * Le tableau peut mentir : c'est par là que le bouc émissaire du complice peut être accusé.
 */
export function choixSelonTableau(vue: VueJoueur, combinaisons: Triplet[], rng: Rng): Triplet {
  if (!avecTableau(vue)) return pick(rng, combinaisons);
  const poids = new Map<string, number>();
  for (const e of vue.tableau!) {
    if (e.cible.type !== 'element') continue;
    const force = 1 + Math.max(0, e.pour - e.contre);
    const signe = e.etiquette === 'coupable' ? 1 : e.etiquette === 'innocent' || e.etiquette === 'fausse_piste' ? -1 : 0;
    poids.set(e.cible.id, (poids.get(e.cible.id) ?? 0) + signe * force);
  }
  const score = (t: Triplet) => [t.suspect, t.lieu, t.arme, t.mobile].reduce((s, x) => s + (x ? (poids.get(x) ?? 0) : 0), 0);
  const melange = shuffle(rng, combinaisons);
  return melange.reduce((m, t) => (score(t) > score(m) ? t : m), melange[0]);
}

// ---------------------------------------------------------------------------
// Pouvoirs de rôle (pendant son tour)
// ---------------------------------------------------------------------------

/** Pouvoir que le bot utilise maintenant, s'il y en a un d'utile. */
export function pouvoirDuTour(vue: VueJoueur, k: Connaissance, rng: Rng): ActionJeu | null {
  const p = vue.moi.pouvoirsRole;
  const r = vue.regles.roles;
  if (!p || !r) return null;
  const moi = vue.moi.id;
  switch (vue.moi.roleEnquete) {
    case 'inspecteur': {
      if (!(p.verifications && p.verifications > 0) || vue.hypothesesCeTour === 0) return null;
      const h = maDerniereHypotheseDuTour(vue);
      if (!h) return null;
      const repondue = vue.historique.some((e) => e.type === 'reponse' && e.hypothese === h);
      const verifiee = vue.moi.journal.some((e) => e.type === 'verification' && e.hypothese === h);
      return repondue && !verifiee ? { type: 'verifierReponses' } : null;
    }
    case 'legiste': {
      if (!(p.expertises && p.expertises > 0) || vue.manche < r.mancheExpertise || k.combinaisons.length === 0) return null;
      // La catégorie où il reste le plus de possibilités.
      const categories: Categorie[] = ['suspect', 'lieu', 'arme', ...(vue.regles.mode === 'grande' ? (['mobile'] as const) : [])];
      const valeurs = (c: Categorie) => new Set(k.combinaisons.map((t) => (c === 'suspect' ? t.suspect : c === 'lieu' ? t.lieu : c === 'arme' ? t.arme : t.mobile))).size;
      const meilleure = categories.reduce((m, c) => (valeurs(c) > valeurs(m) ? c : m), categories[0]);
      return valeurs(meilleure) > 1 ? { type: 'expertiser', categorie: meilleure } : null;
    }
    case 'profileur': {
      if (!(p.profilages && p.profilages > 0) || vue.manche < r.mancheProfilage) return null;
      const soupcons = shuffle(
        rng,
        candidatsComplice(vue).filter((id) => id !== moi),
      );
      if (soupcons.length >= 3) return { type: 'profiler', joueurs: soupcons.slice(0, 2) };
      if (soupcons.length === 2) {
        // Deux soupçonnés : on en teste un avec un joueur blanchi, la réponse tranche.
        const blanchi = vue.joueurs.map((j) => j.id).find((id) => id !== moi && !soupcons.includes(id));
        if (blanchi) return { type: 'profiler', joueurs: [soupcons[0], blanchi] };
      }
      return null;
    }
    case 'archiviste': {
      if (!(p.verificationsDossier && p.verificationsDossier > 0)) return null;
      // Un dossier que quelqu'un d'autre a ouvert avant lui a pu être trafiqué.
      const lus = vue.moi.indicesConsultes.map((i) => i.dossier);
      const ouvertures = vue.historique.filter((e) => e.type === 'archive');
      const douteux = lus.find((d) => {
        const ordre = ouvertures.filter((e) => e.type === 'archive' && e.dossier === d).map((e) => (e.type === 'archive' ? e.joueur : ''));
        return ordre.indexOf(moi) > 0;
      });
      return douteux !== undefined ? { type: 'verifierDossier', dossier: douteux } : null;
    }
    default:
      return null;
  }
}

/** Identifiant de mon hypothèse de ce tour-ci, s'il y en a une. */
function maDerniereHypotheseDuTour(vue: VueJoueur): string | null {
  const moi = vue.moi.id;
  let debut = -1;
  vue.historique.forEach((e, i) => {
    if (e.type === 'debut_tour' && e.joueur === moi) debut = i;
  });
  for (let i = vue.historique.length - 1; i > debut; i--) {
    const e = vue.historique[i];
    if (e.type === 'hypothese' && e.auteur === moi) return e.id;
  }
  return null;
}

/** L'Archiviste consulte gratuitement tant qu'il le peut. */
export const consultationGratuite = (vue: VueJoueur) => vue.moi.roleEnquete === 'archiviste' && (vue.moi.pouvoirsRole?.archivesGratuites ?? 0) > 0;

// ---------------------------------------------------------------------------
// Témoin, soupçons, complice
// ---------------------------------------------------------------------------

/**
 * Le Témoin n'a pas besoin d'interroger sur le lieu, et viser toujours le bon lieu le trahirait :
 * il nomme un lieu au hasard (le vrai, une fois sur six seulement).
 */
export function cacherLeLieu(vue: VueJoueur, t: Triplet, rng: Rng): Triplet {
  if (!vue.moi.lieuConnu) return t;
  return { ...t, lieu: pick(rng, elementsDe(vue.affaire).lieux) };
}

/**
 * Soupçon par contradiction : si les informations reçues se contredisent et qu'en ignorant UN seul
 * joueur tout redevient cohérent, ce joueur a sans doute menti (c'est le complice).
 */
export function suspectParContradiction(vue: VueJoueur): string | null {
  if (deduire(vue).coherent) return null;
  const soupcons = candidatsComplice(vue).filter((id) => id !== vue.moi.id);
  const coupables = soupcons.filter((id) => deduire(vue, true, 1, { ignorer: new Set([id]) }).coherent);
  return coupables.length === 1 ? coupables[0] : null;
}

/** Bouc émissaire : le suspect innocent que le complice veut faire accuser. */
const boucEmissaire = (vue: VueJoueur) => (vue.moi.objectif?.type === 'bouc_emissaire' ? (vue.moi.objectif.suspect ?? null) : null);

/** Complice : falsifier une hypothèse pour y mettre son bouc émissaire (les « aucune carte » le feront paraître coupable). */
export function falsificationBouc(vue: VueJoueur, original: Triplet, rng: Rng): ActionJeu | null {
  const bouc = boucEmissaire(vue);
  if (!bouc || original.suspect === bouc) return null;
  if (original.suspect === vue.moi.meurtrier || rng.int(2) === 0) return { type: 'falsifier', champ: 'suspect', valeur: bouc };
  return null;
}

/** Complice : ne jamais montrer la carte de son bouc émissaire (il doit rester possible). */
export function reponseBouc(vue: VueJoueur, cartes: ElementId[], peutMentir: boolean): ActionJeu | null {
  const bouc = boucEmissaire(vue);
  if (!bouc || !cartes.includes(bouc)) return null;
  const autres = cartes.filter((c) => c !== bouc);
  if (autres.length) return { type: 'repondre', carte: autres[0] };
  return peutMentir ? { type: 'mentir' } : null;
}

