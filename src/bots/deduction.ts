// Moteur de déduction utilisé par les joueurs automatiques (bots).
// Il ne lit QUE la vue filtrée d'un joueur (VueJoueur), exactement comme un
// humain : il n'a jamais accès à la solution ni aux cartes des autres.

import { INDICES_PAR_ID } from '../shared/data/catalogue';
import { combinaisonsPossibles } from '../shared/logique';
import {
  elementsDe,
  elementsDuTriplet,
  memeTriplet,
  type ElementId,
  type Triplet,
  type VueJoueur,
} from '../shared/types';

type Possession = Map<string, boolean | undefined>;

/** « Grande enquête » : hypothèses dont l'Inspecteur sait qu'une réponse était une ruse. */
function hypothesesDouteuses(vue: VueJoueur): Set<string> {
  return new Set(vue.moi.journal.flatMap((e) => (e.type === 'verification' && !e.honnete ? [e.hypothese] : [])));
}

/** « Grande enquête » : éléments innocents appris par le pouvoir du Légiste. */
function innocentsConnus(vue: VueJoueur): ElementId[] {
  return vue.moi.journal.flatMap((e) => (e.type === 'expertise' ? e.innocents : []));
}

/** « Grande enquête » : ce que le rôle apprend de la solution (lieu du Témoin, mobile du Maître chanteur). */
function filtrerParRole(vue: VueJoueur, combinaisons: Triplet[]): Triplet[] {
  let c = combinaisons;
  if (vue.moi.lieuConnu) c = c.filter((t) => t.lieu === vue.moi.lieuConnu);
  if (vue.moi.mobileConnu) c = c.filter((t) => t.mobile === vue.moi.mobileConnu);
  return c;
}

/** « Grande enquête » : dossiers dont l'Archiviste sait qu'ils ont été trafiqués. */
function dossiersTrafiquesConnus(vue: VueJoueur): Set<string> {
  const trafiques = new Set(vue.moi.journal.flatMap((e) => (e.type === 'dossier_verifie' && e.trafique ? [e.dossier] : [])));
  return new Set(vue.moi.indicesConsultes.filter((i) => trafiques.has(i.dossier)).map((i) => i.indice));
}

/** La partie vue par ce joueur a-t-elle un mobile (« Grande enquête ») ? */
export function avecMobileVue(vue: VueJoueur): boolean {
  return vue.regles.mode === 'grande';
}

export interface Connaissance {
  /** possession.get(carte).get(joueur) : true = détient, false = ne détient pas, undefined = inconnu */
  possession: Map<ElementId, Possession>;
  /** Cartes dont on sait qu'elles ne font pas partie de la solution. */
  horsSolution: Set<ElementId>;
  /** Combinaisons encore possibles selon ce joueur. */
  combinaisons: Triplet[];
  coherent: boolean;
}

interface Contrainte {
  joueur: string;
  cartes: ElementId[];
}


/**
 * @param confianceAucuneCarte si false, les réponses « aucune carte » des autres
 *        sont ignorées (utile quand un mensonge a rendu les déductions incohérentes).
 */
/** Hachage déterministe : la même information est toujours « retenue » ou « oubliée » par un bot donné. */
export function retenu(cle: string, attention: number): boolean {
  if (attention >= 1) return true;
  let h = 2166136261;
  for (let i = 0; i < cle.length; i++) h = Math.imul(h ^ cle.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000 < attention;
}

/**
 * @param attention part des réponses aux hypothèses DES AUTRES dont le joueur tient compte
 *        (1 = mémoire parfaite ; un humain réel retient bien moins que tout).
 */
export interface OptionsDeduction {
  /** Ignorer les réponses « aucune carte » des autres (un mensonge les rend douteuses). */
  sansAucuneCarte?: boolean;
  /** Joueurs dont on ignore toutes les réponses et les cartes montrées (complice soupçonné). */
  ignorer?: Set<string>;
  /** Indices lus écartés (soupçonnés d'être faux). */
  indicesExclus?: Set<string>;
}

/**
 * Qui peut être le complice, d'après les informations publiques du mode « rusé » :
 * démasquage, empreintes (« pas X », « à côté de X ») et dénonciations fausses.
 */
export function candidatsComplice(vue: VueJoueur): string[] {
  const ordre = vue.joueurs.map((j) => j.id);
  if (vue.compliceDemasque) return [vue.compliceDemasque];
  let candidats = ordre.filter((id) => id !== vue.moi.id);
  if (vue.moi.role === 'complice') return candidats;
  for (const e of vue.historique) {
    if (e.type === 'empreinte' && e.innocente) candidats = candidats.filter((c) => c !== e.innocente);
    if (e.type === 'denonciation' && !e.correcte) candidats = candidats.filter((c) => c !== e.cible);
  }
  // « Grande enquête » : ce que les pouvoirs ont appris.
  for (const e of vue.moi.journal) {
    // Inspecteur : une réponse malhonnête vient forcément d'un des joueurs qui ont répondu.
    if (e.type === 'verification' && !e.honnete) {
      const repondants = new Set(vue.historique.flatMap((x) => (x.type === 'reponse' && x.hypothese === e.hypothese ? [x.joueur] : [])));
      const restent = candidats.filter((c) => repondants.has(c));
      if (restent.length) candidats = restent;
    }
    // Profileur : le complice est (ou n'est pas) l'un des deux joueurs désignés.
    if (e.type === 'profilage') {
      const restent = candidats.filter((c) => e.joueurs.includes(c) === e.complicePresent);
      if (restent.length) candidats = restent;
    }
  }
  return candidats;
}

export function deduire(vue: VueJoueur, confianceAucuneCarte = true, attention = 1, options: OptionsDeduction = {}): Connaissance {
  const ignorer = options.ignorer ?? new Set<string>();
  if (options.sansAucuneCarte) confianceAucuneCarte = false;
  const moi = vue.moi.id;
  const joueurs = vue.joueurs.map((j) => j.id);
  const tailles = new Map(vue.joueurs.map((j) => [j.id, j.nbCartes]));
  // Seules les cartes de l'affaire jouée existent dans cette partie (mobiles compris en « Grande enquête »).
  const mobile = avecMobileVue(vue);
  const e = elementsDe(vue.affaire, mobile);
  const TOUS_ELEMENTS = e.tous;
  const CATEGORIES: (readonly ElementId[])[] = mobile ? [e.suspects, e.lieux, e.armes, e.mobiles] : [e.suspects, e.lieux, e.armes];
  const possession = new Map<ElementId, Possession>();
  for (const c of TOUS_ELEMENTS) possession.set(c, new Map(joueurs.map((j) => [j, undefined])));
  let coherent = true;

  const fixer = (carte: ElementId, joueur: string, valeur: boolean) => {
    const p = possession.get(carte)!;
    const actuel = p.get(joueur);
    if (actuel === valeur) return false;
    if (actuel !== undefined) {
      coherent = false;
      return false;
    }
    p.set(joueur, valeur);
    return true;
  };

  // Ma main : certitude totale sur mes propres cartes.
  for (const c of TOUS_ELEMENTS) fixer(c, moi, vue.moi.main.includes(c));
  // Cartes publiques : personne ne les détient, et elles ne sont pas la solution.
  // Pièces à conviction lues : personne ne les détient et elles ne sont pas la solution.
  const piecesLues = vue.moi.piecesConsultees.map((p) => p.carte);
  const nonDistribuees = [...vue.cartesPubliques, ...piecesLues];
  for (const c of nonDistribuees) for (const j of joueurs) fixer(c, j, false);
  // Tant que des pièces restent inconnues, une carte détenue par personne peut être l'une d'elles.
  const piecesInconnues = vue.archives.filter((a) => a.categorie === 'piece').length - piecesLues.length;

  const auMoinsUne: Contrainte[] = [];
  const douteuses = hypothesesDouteuses(vue);
  // Cartes vues directement.
  for (const e of vue.moi.journal) {
    if (e.type === 'carte_vue' && !ignorer.has(e.de) && !douteuses.has(e.hypothese)) fixer(e.carte, e.de, true);
  }
  // Hypothèses publiques et leurs réponses (pour mes propres hypothèses, je vois l'original).
  const hypotheses = new Map<string, Triplet>();
  for (const ev of vue.historique) if (ev.type === 'hypothese') hypotheses.set(ev.id, ev.triplet);
  // Le complice connaît l'original des hypothèses qu'il a falsifiées.
  for (const e of vue.moi.journal) {
    if (e.type === 'falsification') {
      const t = hypotheses.get(e.hypothese);
      if (t) hypotheses.set(e.hypothese, { ...t, [e.champ]: e.de } as Triplet);
    }
  }
  for (const ev of vue.historique) {
    if (ev.type !== 'reponse' || ev.joueur === moi || ignorer.has(ev.joueur) || douteuses.has(ev.hypothese)) continue;
    const t = hypotheses.get(ev.hypothese);
    if (!t) continue;
    const auteur = vue.historique.find((x) => x.type === 'hypothese' && x.id === ev.hypothese);
    if (auteur?.type === 'hypothese' && auteur.auteur !== moi && !retenu(`${moi}|${ev.hypothese}|${ev.joueur}`, attention)) continue;
    const cartes = elementsDuTriplet(t);
    if (ev.resultat === 'aucune_carte') {
      if (confianceAucuneCarte) for (const c of cartes) fixer(c, ev.joueur, false);
    } else {
      auMoinsUne.push({ joueur: ev.joueur, cartes });
    }
  }

  // Propagation jusqu'à stabilité.
  const horsSolution = new Set<ElementId>([...nonDistribuees, ...innocentsConnus(vue)]);
  for (let tour = 0; tour < 50 && coherent; tour++) {
    let change = false;
    for (const c of TOUS_ELEMENTS) {
      const p = possession.get(c)!;
      const detenteurs = joueurs.filter((j) => p.get(j) === true);
      if (detenteurs.length > 1) coherent = false;
      if (detenteurs.length === 1) {
        horsSolution.add(c);
        for (const j of joueurs) if (j !== detenteurs[0]) change = fixer(c, j, false) || change;
      }
    }
    for (const j of joueurs) {
      const taille = tailles.get(j)!;
      const vrais = TOUS_ELEMENTS.filter((c) => possession.get(c)!.get(j) === true);
      const inconnus = TOUS_ELEMENTS.filter((c) => possession.get(c)!.get(j) === undefined);
      if (vrais.length > taille) coherent = false;
      if (vrais.length === taille) for (const c of inconnus) change = fixer(c, j, false) || change;
      else if (vrais.length + inconnus.length === taille) for (const c of inconnus) change = fixer(c, j, true) || change;
      else if (vrais.length + inconnus.length < taille) coherent = false;
    }
    for (const k of auMoinsUne) {
      const p = (c: ElementId) => possession.get(c)!.get(k.joueur);
      if (k.cartes.some((c) => p(c) === true)) continue;
      const possibles = k.cartes.filter((c) => p(c) !== false);
      if (possibles.length === 0) coherent = false;
      if (possibles.length === 1) change = fixer(possibles[0], k.joueur, true) || change;
    }
    // Par catégorie : si toutes les cartes sauf une sont hors solution, la dernière EST la solution.
    for (const cat of CATEGORIES) {
      const restantes = cat.filter((c) => !horsSolution.has(c));
      if (restantes.length === 0) coherent = false;
      if (restantes.length === 1) for (const j of joueurs) change = fixer(restantes[0], j, false) || change;
      // Une carte que personne ne détient et qui n'est pas publique est la solution.
      const solution =
        piecesInconnues > 0 ? [] : cat.filter((c) => !nonDistribuees.includes(c) && joueurs.every((j) => possession.get(c)!.get(j) === false));
      if (solution.length > 1) coherent = false;
      if (solution.length === 1) {
        for (const c of cat) {
          if (c === solution[0] || horsSolution.has(c)) continue;
          horsSolution.add(c);
          change = true;
          // Hors solution et un seul détenteur possible -> il la détient.
          const possibles = joueurs.filter((j) => possession.get(c)!.get(j) !== false);
          if (possibles.length === 1) fixer(c, possibles[0], true);
        }
      }
    }
    if (!change) break;
  }

  const trafiques = dossiersTrafiquesConnus(vue);
  const indices = [
    ...vue.indicesPublics.map((i) => INDICES_PAR_ID[i.indice]),
    ...vue.moi.indicesConsultes.filter((i) => !options.indicesExclus?.has(i.indice) && !trafiques.has(i.indice)).map((i) => INDICES_PAR_ID[i.indice]),
  ];
  // Une accusation publique incorrecte élimine sa combinaison.
  const faussesAccusations = vue.historique.flatMap((e) => (e.type === 'accusation' && !e.correcte ? [e.triplet] : []));
  let combinaisons = combinaisonsPossibles(indices, horsSolution, vue.affaire, mobile).filter(
    (t) => !faussesAccusations.some((f) => memeTriplet(f, t)),
  );
  if (vue.moi.meurtrier) combinaisons = combinaisons.filter((t) => t.suspect === vue.moi.meurtrier);
  combinaisons = filtrerParRole(vue, combinaisons);
  if (combinaisons.length === 0) coherent = false;
  return { possession, horsSolution, combinaisons, coherent };
}

/**
 * Déduction « simple » : ce qu'un joueur fait naturellement avec son carnet.
 * Seules les éliminations directes sont utilisées : sa main, les cartes publiques,
 * les cartes qu'on lui a montrées, les indices lus et les accusations ratées.
 * Aucun raisonnement sur les mains des autres.
 */
/**
 * Méfiance envers le complice identifié : ignorer ses réponses et ses cartes montrées,
 * et soupçonner les dossiers qu'il a ouverts AVANT nous (il a pu les trafiquer).
 */
export function optionsMefiance(vue: VueJoueur): OptionsDeduction {
  const suspects = candidatsComplice(vue);
  if (vue.moi.role === 'complice' || suspects.length !== 1) return {};
  const complice = suspects[0];
  const exclus = new Set<string>();
  for (const lu of vue.moi.indicesConsultes) {
    const ouvertures = vue.historique.filter((e) => e.type === 'archive' && e.dossier === lu.dossier);
    const premierComplice = ouvertures.findIndex((e) => e.type === 'archive' && e.joueur === complice);
    const moi = ouvertures.findIndex((e) => e.type === 'archive' && e.joueur === vue.moi.id);
    if (premierComplice >= 0 && premierComplice < moi) exclus.add(lu.indice);
  }
  return { ignorer: new Set([complice]), indicesExclus: exclus };
}

export function deduireSimple(vue: VueJoueur): Triplet[] {
  const base: OptionsDeduction = {};
  const essai = (o: OptionsDeduction) => {
    const connues = new Set<ElementId>([
      ...vue.moi.main,
      ...vue.cartesPubliques,
      ...vue.moi.piecesConsultees.map((p) => p.carte),
      ...innocentsConnus(vue),
    ]);
    const trafiques = dossiersTrafiquesConnus(vue);
    const douteuses = hypothesesDouteuses(vue);
    for (const e of vue.moi.journal) if (e.type === 'carte_vue' && !o.ignorer?.has(e.de) && !douteuses.has(e.hypothese)) connues.add(e.carte);
    const indices = [
      ...vue.indicesPublics.map((i) => INDICES_PAR_ID[i.indice]),
      ...vue.moi.indicesConsultes.filter((i) => !o.indicesExclus?.has(i.indice) && !trafiques.has(i.indice)).map((i) => INDICES_PAR_ID[i.indice]),
    ];
    const faussesAccusations = vue.historique.flatMap((e) => (e.type === 'accusation' && !e.correcte ? [e.triplet] : []));
    return filtrerParRole(
      vue,
      combinaisonsPossibles(indices, connues, vue.affaire, avecMobileVue(vue)).filter((t) => !faussesAccusations.some((f) => memeTriplet(f, t))),
    );
  };
  // Si les informations se contredisent (ruse du complice), on écarte la source douteuse.
  for (const o of variantes(vue, base)) {
    const c = essai(o);
    if (c.length > 0) return c;
  }
  return [];
}

/** Hypothèses de « méfiance » successives quand les informations se contredisent. */
function variantes(vue: VueJoueur, base: OptionsDeduction): OptionsDeduction[] {
  const autres = vue.joueurs.map((j) => j.id).filter((id) => id !== vue.moi.id);
  // On fait confiance à tout le monde tant que rien ne se contredit ; en cas de contradiction,
  // on soupçonne d'abord le complice identifié (ses réponses et les dossiers ouverts avant nous).
  const mefiance = optionsMefiance(vue);
  return [
    base,
    ...(mefiance.ignorer ? [mefiance] : []),
    { ...base, sansAucuneCarte: true },
    ...autres.map((p) => ({ ...base, sansAucuneCarte: true, ignorer: new Set([...(base.ignorer ?? []), p]) })),
    ...vue.moi.indicesConsultes.map((i) => ({ ...base, sansAucuneCarte: true, indicesExclus: new Set([...(base.indicesExclus ?? []), i.indice]) })),
  ];
}

/** Déduction robuste : si un mensonge a rendu la base incohérente, on retire les « aucune carte ». */
export function deduireRobuste(vue: VueJoueur, attention = 1): Connaissance {
  const base: OptionsDeduction = {};
  let dernier: Connaissance | null = null;
  for (const o of variantes(vue, base)) {
    const k = deduire(vue, true, attention, o);
    if (k.coherent && k.combinaisons.length > 0) return k;
    if (k.combinaisons.length > 0 && !dernier) dernier = k;
  }
  return dernier ?? deduire(vue, false, attention, base);
}
