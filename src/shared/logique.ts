// Logique pure des indices : évaluation des règles, faits chronologiques,
// énumération des combinaisons possibles. Utilisée par le moteur (génération,
// validation) et par le client (affichage de ce qu'un indice permet d'écarter).

import { AFFAIRE, nomElement } from './data/manoir';
import {
  ARMES,
  LIEUX,
  SUSPECTS,
  categorieDe,
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

const CRIME_DE = minutes(AFFAIRE.fenetreCrime.de);
const CRIME_A = minutes(AFFAIRE.fenetreCrime.a);

function estLieuDuCrimePossible(endroit: string): endroit is LieuId {
  return (LIEUX as readonly string[]).includes(endroit);
}

/** Un fait couvre-t-il toute la fenêtre du crime ? */
export function couvreFenetreCrime(fait: FaitChronologique): boolean {
  return minutes(fait.de) <= CRIME_DE && minutes(fait.a) >= CRIME_A;
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
  return t.suspect === e || t.lieu === e || t.arme === e;
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

export const TOUS_TRIPLETS: readonly Triplet[] = SUSPECTS.flatMap((suspect) =>
  LIEUX.flatMap((lieu) => ARMES.map((arme) => ({ suspect, lieu, arme }))),
);

/**
 * Combinaisons meurtrier / lieu / arme compatibles avec un ensemble d'indices
 * et un ensemble d'éléments connus comme n'étant pas dans la solution
 * (cartes détenues par des joueurs ou rendues publiques).
 */
export function combinaisonsPossibles(cartes: readonly CarteIndice[], elementsEcartes: Iterable<ElementId> = []): Triplet[] {
  const regles = cartes.flatMap(reglesEffectives);
  const ecartes = new Set(elementsEcartes);
  return TOUS_TRIPLETS.filter(
    (t) => !ecartes.has(t.suspect) && !ecartes.has(t.lieu) && !ecartes.has(t.arme) && regles.every((r) => regleVraie(r, t)),
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

/** Part des 216 combinaisons éliminées par l'indice seul. */
export function partEliminee(carte: CarteIndice): number {
  return 1 - combinaisonsPossibles([carte]).length / TOUS_TRIPLETS.length;
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
      const sujet = catSi === 'suspect' ? `${avecArticle(r.si)} est coupable` : catSi === 'arme' ? `l'arme est : ${avecArticle(r.si)}` : `le crime a eu lieu : ${avecArticle(r.si)}`;
      const consequence =
        catAlors === 'lieu' ? `le crime a eu lieu : ${avecArticle(r.alors)}` : catAlors === 'suspect' ? `le coupable est ${avecArticle(r.alors)}` : `l'arme est : ${avecArticle(r.alors)}`;
      return `Si ${sujet}, alors ${consequence}`;
    }
  }
}

export function ceQueLIndiceEcarte(carte: CarteIndice): string[] {
  return reglesEffectives(carte).map(descriptionRegle);
}
