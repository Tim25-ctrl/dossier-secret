// Logique pure des indices : évaluation des règles, faits chronologiques,
// énumération des combinaisons possibles. Utilisée par le moteur (génération,
// validation) et par le client (affichage de ce qu'un indice permet d'écarter).

import { AFFAIRES, ARMES_FICHES, LIEUX_FICHES, MOBILES_FICHES, affaireDeCarte, nomElement } from './data/catalogue';
import {
  AFFAIRE_PAR_DEFAUT,
  LIEUX,
  affaireDe,
  categorieDe,
  elementsDe,
  type AffaireId,
  type ArmeId,
  type Categorie,
  type CarteIndice,
  type ElementId,
  type FaitChronologique,
  type LieuId,
  type Precision,
  type RegleIndice,
  type Triplet,
} from './types';

export function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}


function estLieuDuCrimePossible(endroit: string): endroit is LieuId {
  return (LIEUX as readonly string[]).includes(endroit);
}

/** Un fait couvre-t-il toute la fenêtre du crime (celle de l'affaire de la personne ou de l'objet) ? */
export function couvreFenetreCrime(fait: FaitChronologique): boolean {
  const { de, a } = AFFAIRES[affaireDe(fait.entite) ?? AFFAIRE_PAR_DEFAUT].fenetreCrime;
  return minutes(fait.de) <= minutes(de) && minutes(fait.a) >= minutes(a);
}

/** Règles qui découlent mécaniquement d'un fait chronologique. */
export function reglesDuFait(fait: FaitChronologique): RegleIndice[] {
  if (!couvreFenetreCrime(fait)) return [];
  if (estLieuDuCrimePossible(fait.endroit)) return [{ type: 'siAlors', si: fait.entite, alors: fait.endroit }];
  return [{ type: 'pas', element: fait.entite }];
}

export function reglesEffectives(carte: CarteIndice): RegleIndice[] {
  return [...carte.regles, ...(carte.faits ?? []).flatMap(reglesDuFait)];
}

function contient(t: Triplet, e: ElementId): boolean {
  return t.suspect === e || t.lieu === e || t.arme === e || t.mobile === e;
}

export function regleVraie(regle: RegleIndice, t: Triplet): boolean {
  switch (regle.type) {
    case 'pas':
      return !contient(t, regle.element);
    case 'pasEnsemble':
      return !(contient(t, regle.a) && contient(t, regle.b));
    case 'parmi':
      return regle.elements.some((e) => contient(t, e));
    case 'siAlors':
      return !contient(t, regle.si) || contient(t, regle.alors);
  }
}

/** Condition de validité : toutes les règles de l'indice sont vraies pour cette solution. */
export function indiceValide(carte: CarteIndice, solution: Triplet): boolean {
  return reglesEffectives(carte).every((r) => regleVraie(r, solution));
}

const TRIPLETS = new Map<string, readonly Triplet[]>();

/**
 * Les 216 combinaisons meurtrier / lieu / arme d'une affaire, ou les 1 296 combinaisons
 * meurtrier / lieu / arme / mobile en « Grande enquête ».
 */
export function tripletsDe(affaire: AffaireId, avecMobile = false): readonly Triplet[] {
  const cle = avecMobile ? `${affaire}+mobile` : affaire;
  let t = TRIPLETS.get(cle);
  if (!t) {
    const e = elementsDe(affaire);
    const sansMobile = e.suspects.flatMap((suspect) => e.lieux.flatMap((lieu) => e.armes.map((arme) => ({ suspect, lieu, arme }))));
    t = avecMobile ? sansMobile.flatMap((s) => e.mobiles.map((mobile) => ({ ...s, mobile }))) : sansMobile;
    TRIPLETS.set(cle, t);
  }
  return t;
}

/** Combinaisons de l'affaire du Manoir (affaire par défaut). */
export const TOUS_TRIPLETS: readonly Triplet[] = tripletsDe(AFFAIRE_PAR_DEFAUT);

/** Affaire déduite des indices ou des éléments écartés (affaire par défaut si rien ne l'indique). */
function affaireDeduite(cartes: readonly CarteIndice[], ecartes: readonly ElementId[]): AffaireId {
  if (cartes.length) return affaireDeCarte(cartes[0]);
  for (const e of ecartes) {
    const a = affaireDe(e);
    if (a) return a;
  }
  return AFFAIRE_PAR_DEFAUT;
}

/**
 * Combinaisons meurtrier / lieu / arme compatibles avec un ensemble d'indices
 * et un ensemble d'éléments connus comme n'étant pas dans la solution
 * (cartes détenues par des joueurs ou rendues publiques).
 */
export function combinaisonsPossibles(
  cartes: readonly CarteIndice[],
  elementsEcartes: Iterable<ElementId> = [],
  affaire?: AffaireId,
  avecMobile = false,
): Triplet[] {
  const regles = cartes.flatMap(reglesEffectives);
  const liste = [...elementsEcartes];
  const ecartes = new Set(liste);
  return tripletsDe(affaire ?? affaireDeduite(cartes, liste), avecMobile).filter(
    (t) =>
      !ecartes.has(t.suspect) &&
      !ecartes.has(t.lieu) &&
      !ecartes.has(t.arme) &&
      !(t.mobile && ecartes.has(t.mobile)) &&
      regles.every((r) => regleVraie(r, t)),
  );
}

/** Deux faits se contredisent : même personne / arme, endroits différents, horaires qui se chevauchent. */
export function faitsEnConflit(a: FaitChronologique, b: FaitChronologique): boolean {
  if (a.entite !== b.entite || a.endroit === b.endroit) return false;
  return minutes(a.de) < minutes(b.a) && minutes(b.de) < minutes(a.a);
}

/** Conditions de contradiction entre deux indices. */
export function indicesIncompatibles(a: CarteIndice, b: CarteIndice): boolean {
  if (a.id === b.id) return false;
  if (a.incompatibleAvec?.includes(b.id) || b.incompatibleAvec?.includes(a.id)) return true;
  for (const fa of a.faits ?? []) for (const fb of b.faits ?? []) if (faitsEnConflit(fa, fb)) return true;
  return false;
}

/**
 * Indice « relationnel » : uniquement des règles « pas X avec Y ». Il n'écarte jamais un
 * élément à lui seul (il ne remplace la carte de personne) et ne déduit jamais un élément
 * d'un autre (contrairement à « si X alors Y », qui donnerait le lieu dès qu'on tient le
 * coupable). Il ne devient décisif qu'en le combinant avec les cartes des joueurs.
 */
export function estRelationnel(carte: CarteIndice): boolean {
  return reglesEffectives(carte).every((r) => r.type === 'pasEnsemble');
}

/** Part des 216 combinaisons éliminées par l'indice seul. */
export function partEliminee(carte: CarteIndice): number {
  const affaire = affaireDeCarte(carte);
  return 1 - combinaisonsPossibles([carte], [], affaire).length / tripletsDe(affaire).length;
}

export function precision(carte: CarteIndice): Precision {
  const p = partEliminee(carte);
  if (p < 0.12) return 'faible';
  if (p < 0.25) return 'moyenne';
  return 'forte';
}

const avecArticle = (e: ElementId) => nomElement(e);

/** Phrases lisibles décrivant ce que l'indice permet d'écarter. */
export function descriptionRegle(r: RegleIndice): string {
  switch (r.type) {
    case 'pas':
      return `Écarte : ${avecArticle(r.element)}`;
    case 'pasEnsemble':
      return `Écarte la combinaison : ${avecArticle(r.a)} + ${avecArticle(r.b)}`;
    case 'parmi':
      return `Seuls possibles : ${r.elements.map(avecArticle).join(', ')}`;
    case 'siAlors': {
      const catSi = categorieDe(r.si);
      const catAlors = categorieDe(r.alors);
      const sujet =
        catSi === 'suspect'
          ? `${avecArticle(r.si)} est coupable`
          : catSi === 'arme'
            ? `l'arme est : ${avecArticle(r.si)}`
            : catSi === 'mobile'
              ? `le mobile est : ${avecArticle(r.si)}`
              : `le crime a eu lieu : ${avecArticle(r.si)}`;
      const consequence =
        catAlors === 'lieu'
          ? `le crime a eu lieu : ${avecArticle(r.alors)}`
          : catAlors === 'suspect'
            ? `le coupable est ${avecArticle(r.alors)}`
            : catAlors === 'mobile'
              ? `le mobile est : ${avecArticle(r.alors)}`
              : `l'arme est : ${avecArticle(r.alors)}`;
      return `Si ${sujet}, alors ${consequence}`;
    }
  }
}

function parCategorie(affaire: AffaireId): Record<Categorie, readonly ElementId[]> {
  const e = elementsDe(affaire);
  return { suspect: e.suspects, lieu: e.lieux, arme: e.armes, mobile: e.mobiles };
}

/** « si le crime a eu lieu dans la serre » / « si l'arme est le chandelier en bronze » / « si Victor Delorme est coupable ». */
function conditionSur(e: ElementId): string {
  const cat = categorieDe(e);
  if (cat === 'lieu') return `si le crime a eu lieu ${LIEUX_FICHES[e as LieuId].article}`;
  if (cat === 'arme') return `si le crime a été commis ${ARMES_FICHES[e as ArmeId].article}`;
  if (cat === 'mobile') return `si le crime a été commis ${MOBILES_FICHES[e].article}`;
  return `si ${nomElement(e)} est coupable`;
}

/** « le coupable est X ou Y » / « le crime a eu lieu dans X ou dans Y » / « l'arme est X ou Y ». */
function seulsPossibles(cat: Categorie, elements: ElementId[]): string {
  if (cat === 'lieu') return `le crime a eu lieu ${elements.map((e) => LIEUX_FICHES[e as LieuId].article).join(' ou ')}`;
  if (cat === 'arme') return `le crime a été commis ${elements.map((e) => ARMES_FICHES[e as ArmeId].article).join(' ou ')}`;
  if (cat === 'mobile') return `le crime a été commis ${elements.map((e) => MOBILES_FICHES[e].article).join(' ou ')}`;
  return `le coupable est ${elements.map(nomElement).join(' ou ')}`;
}

/**
 * Phrases lisibles décrivant ce que l'indice permet d'écarter. Plusieurs « pas X avec Y »
 * autour d'un même élément (témoignage partiel) sont résumés en une seule phrase :
 * « Si le crime a eu lieu dans la serre, le coupable est Victor Delorme ou Gabriel Roche ».
 */
export function ceQueLIndiceEcarte(carte: CarteIndice): string[] {
  const regles = reglesEffectives(carte);
  const resumees = new Set<RegleIndice>();
  const phrases: string[] = [];
  const affaire = affaireDeCarte(carte);
  const categories = parCategorie(affaire);
  for (const pivot of elementsDe(affaire, true).tous) {
    for (const cat of ['suspect', 'lieu', 'arme', 'mobile'] as const) {
      if (categorieDe(pivot) === cat) continue;
      const groupe = regles.filter(
        (r): r is Extract<RegleIndice, { type: 'pasEnsemble' }> =>
          r.type === 'pasEnsemble' && !resumees.has(r) && (r.a === pivot || r.b === pivot) && categorieDe(r.a === pivot ? r.b : r.a) === cat,
      );
      if (groupe.length < 3) continue;
      const exclus = new Set(groupe.map((r) => (r.a === pivot ? r.b : r.a)));
      const restants = categories[cat].filter((e) => !exclus.has(e));
      const phrase = `${conditionSur(pivot)}, ${seulsPossibles(cat, restants)}`;
      phrases.push(phrase.charAt(0).toUpperCase() + phrase.slice(1));
      for (const r of groupe) resumees.add(r);
    }
  }
  return [...phrases, ...regles.filter((r) => !resumees.has(r)).map(descriptionRegle)];
}
