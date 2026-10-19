// Génération des affaires, distribution des cartes et attribution des rôles.
//
// Ordre imposé : 1) la solution est tirée, 2) seuls les indices compatibles avec
// cette solution sont candidats, 3) une sélection est construite puis VALIDÉE.
// Si la validation échoue, on régénère : une partie incohérente ne démarre jamais.

import { INDICES, INDICES_PAR_ID } from '../shared/data/indices';
import { combinaisonsPossibles, indiceValide, indicesIncompatibles } from '../shared/logique';
import {
  ARMES,
  LIEUX,
  SUSPECTS,
  TOUS_ELEMENTS,
  elementsDuTriplet,
  type CarteIndice,
  type ElementId,
  type SuspectId,
  type Triplet,
} from '../shared/types';
import { JOUEURS_MAX, JOUEURS_MIN, type ConfigPartie } from './config';
import { pick, shuffle, type Rng } from './rng';

export interface DossierArchive {
  dossier: number;
  indice: string;
  disponibleDesManche: number;
}

export interface Affaire {
  solution: Triplet;
  indicesPublicsDepart: string[];
  indicesPublicsDifferes: { indice: string; manche: number }[];
  archives: DossierArchive[];
}

export interface Distribution {
  mains: Record<string, ElementId[]>;
  cartesPubliques: ElementId[];
}

export function tousLesIndicesDeLAffaire(a: Affaire): CarteIndice[] {
  return [...a.indicesPublicsDepart, ...a.indicesPublicsDifferes.map((d) => d.indice), ...a.archives.map((d) => d.indice)].map(
    (id) => INDICES_PAR_ID[id],
  );
}

export function tirerSolution(rng: Rng): Triplet {
  return { suspect: pick(rng, SUSPECTS), lieu: pick(rng, LIEUX), arme: pick(rng, ARMES) };
}

function distincts<T>(items: T[]): number {
  return new Set(items).size;
}

/** Les indices donnés laissent-ils au moins deux possibilités dans chaque catégorie ? */
function laisseDuDoutePartout(cartes: CarteIndice[]): boolean {
  const c = combinaisonsPossibles(cartes);
  return distincts(c.map((t) => t.suspect)) >= 2 && distincts(c.map((t) => t.lieu)) >= 2 && distincts(c.map((t) => t.arme)) >= 2;
}

/** Une tentative de sélection d'indices pour une solution donnée. */
function tenterSelection(rng: Rng, solution: Triplet, config: ConfigPartie): Affaire | null {
  const nbDifferes = config.manchesIndicesPublics.length;
  const total = config.nbIndicesPublicsDepart + nbDifferes + config.nbDossiersArchives;
  const compatibles = shuffle(
    rng,
    INDICES.filter((c) => indiceValide(c, solution)),
  );

  const choisis: CarteIndice[] = [];
  for (const carte of compatibles) {
    if (choisis.length >= total) break;
    if (choisis.some((c) => indicesIncompatibles(c, carte))) continue;
    const essai = [...choisis, carte];
    if (combinaisonsPossibles(essai).length < config.minCombinaisonsIndices) continue;
    choisis.push(carte);
  }
  if (choisis.length < total) return null;

  // Indices publics de départ : disponibles dès la manche 1 et peu révélateurs.
  const departPossibles = choisis.filter((c) => c.disponibleDesManche <= 1);
  let depart: CarteIndice[] | null = null;
  for (let essai = 0; essai < 20 && !depart; essai++) {
    const tirage = shuffle(rng, departPossibles).slice(0, config.nbIndicesPublicsDepart);
    if (tirage.length === config.nbIndicesPublicsDepart && laisseDuDoutePartout(tirage)) depart = tirage;
  }
  if (!depart) return null;
  let reste = choisis.filter((c) => !depart!.includes(c));

  // Indices publics différés : un par manche prévue, disponible à cette manche.
  const differes: { indice: string; manche: number }[] = [];
  for (const manche of config.manchesIndicesPublics) {
    const possibles = reste.filter((c) => c.disponibleDesManche <= manche);
    if (possibles.length === 0) return null;
    const carte = pick(rng, possibles);
    differes.push({ indice: carte.id, manche });
    reste = reste.filter((c) => c !== carte);
  }

  // Archives : triées par disponibilité, chaque dossier s'ouvre à la manche la plus tardive
  // entre son ouverture programmée et la disponibilité propre de l'indice.
  const ordonnes = [...reste].sort((a, b) => a.disponibleDesManche - b.disponibleDesManche);
  const archives = ordonnes.map((carte, i) => ({
    dossier: i + 1,
    indice: carte.id,
    disponibleDesManche: Math.max(config.ouvertureDossiers[i] ?? 1, carte.disponibleDesManche),
  }));

  return { solution, indicesPublicsDepart: depart.map((c) => c.id), indicesPublicsDifferes: differes, archives };
}

export function genererAffaire(rng: Rng, config: ConfigPartie, solutionImposee?: Triplet): Affaire {
  for (let tentative = 0; tentative < 50; tentative++) {
    const solution = solutionImposee ?? tirerSolution(rng);
    for (let essai = 0; essai < 40; essai++) {
      const affaire = tenterSelection(rng, solution, config);
      if (affaire && validerAffaire(affaire, config).length === 0) return affaire;
    }
    if (solutionImposee) break;
  }
  throw new Error("Impossible de générer une affaire cohérente : vérifiez les cartes d'indice.");
}

/**
 * Validation automatique d'une affaire. Retourne la liste des problèmes détectés
 * (liste vide = affaire valide). Utilisée avant chaque démarrage de partie.
 */
export function validerAffaire(affaire: Affaire, config: ConfigPartie): string[] {
  const erreurs: string[] = [];
  const { solution } = affaire;
  if (!SUSPECTS.includes(solution.suspect) || !LIEUX.includes(solution.lieu) || !ARMES.includes(solution.arme)) {
    erreurs.push('Solution invalide.');
    return erreurs;
  }

  const ids = [...affaire.indicesPublicsDepart, ...affaire.indicesPublicsDifferes.map((d) => d.indice), ...affaire.archives.map((d) => d.indice)];
  if (new Set(ids).size !== ids.length) erreurs.push('Un indice apparaît deux fois dans l\'affaire.');
  const inconnus = ids.filter((id) => !INDICES_PAR_ID[id]);
  if (inconnus.length) {
    erreurs.push(`Indices inconnus : ${inconnus.join(', ')}`);
    return erreurs;
  }
  const cartes = ids.map((id) => INDICES_PAR_ID[id]);

  for (const c of cartes) if (!indiceValide(c, solution)) erreurs.push(`L'indice ${c.id} exclut la vraie solution.`);
  for (let i = 0; i < cartes.length; i++)
    for (let j = i + 1; j < cartes.length; j++)
      if (indicesIncompatibles(cartes[i], cartes[j])) erreurs.push(`Les indices ${cartes[i].id} et ${cartes[j].id} se contredisent.`);

  const possibles = combinaisonsPossibles(cartes);
  if (!possibles.some((t) => t.suspect === solution.suspect && t.lieu === solution.lieu && t.arme === solution.arme))
    erreurs.push('La solution ne fait pas partie des combinaisons possibles.');
  if (possibles.length < config.minCombinaisonsIndices)
    erreurs.push(`Les indices seuls révèlent trop la solution (${possibles.length} combinaison(s) restante(s)).`);

  const depart = affaire.indicesPublicsDepart.map((id) => INDICES_PAR_ID[id]);
  if (depart.length !== config.nbIndicesPublicsDepart) erreurs.push("Nombre d'indices publics de départ incorrect.");
  if (depart.some((c) => c.disponibleDesManche > 1)) erreurs.push("Un indice public de départ n'est pas disponible en manche 1.");
  if (!laisseDuDoutePartout(depart)) erreurs.push('Les indices publics de départ révèlent un élément de la solution.');

  for (const d of affaire.indicesPublicsDifferes)
    if (INDICES_PAR_ID[d.indice].disponibleDesManche > d.manche) erreurs.push(`L'indice ${d.indice} est publié avant sa disponibilité.`);
  if (affaire.archives.length !== config.nbDossiersArchives) erreurs.push("Nombre de dossiers d'archives incorrect.");
  for (const d of affaire.archives)
    if (INDICES_PAR_ID[d.indice].disponibleDesManche > d.disponibleDesManche) erreurs.push(`Le dossier ${d.dossier} s'ouvre avant sa disponibilité.`);

  return erreurs;
}

// ---------------------------------------------------------------------------
// Distribution des cartes
// ---------------------------------------------------------------------------

/**
 * Règle de distribution : les 15 cartes qui ne font pas partie de la solution
 * sont mélangées. Chaque joueur reçoit floor(15 / N) cartes ; le reste est posé
 * face visible (cartes publiques).
 *   3 joueurs : 5 cartes chacun, 0 publique
 *   4 joueurs : 3 cartes chacun, 3 publiques
 *   5 joueurs : 3 cartes chacun, 0 publique
 *   6 joueurs : 2 cartes chacun, 3 publiques
 */
export function distribuerCartes(rng: Rng, solution: Triplet, joueurs: string[]): Distribution {
  if (joueurs.length < JOUEURS_MIN || joueurs.length > JOUEURS_MAX) throw new Error('Nombre de joueurs invalide.');
  const secretes = new Set<ElementId>(elementsDuTriplet(solution));
  const paquet = shuffle(
    rng,
    TOUS_ELEMENTS.filter((e) => !secretes.has(e)),
  );
  const parJoueur = Math.floor(paquet.length / joueurs.length);
  const mains: Record<string, ElementId[]> = {};
  joueurs.forEach((id, i) => {
    mains[id] = paquet.slice(i * parJoueur, (i + 1) * parJoueur);
  });
  return { mains, cartesPubliques: paquet.slice(parJoueur * joueurs.length) };
}

export function validerDistribution(d: Distribution, solution: Triplet, joueurs: string[]): string[] {
  const erreurs: string[] = [];
  const toutes = [...Object.values(d.mains).flat(), ...d.cartesPubliques];
  if (new Set(toutes).size !== toutes.length) erreurs.push('Une carte est distribuée deux fois.');
  for (const e of elementsDuTriplet(solution)) if (toutes.includes(e)) erreurs.push('Une carte de la solution a été distribuée.');
  if (toutes.length !== TOUS_ELEMENTS.length - 3) erreurs.push('Toutes les cartes hors solution ne sont pas distribuées.');
  const tailles = joueurs.map((j) => d.mains[j]?.length ?? -1);
  if (new Set(tailles).size !== 1) erreurs.push('Les mains ne sont pas de même taille.');
  if (Object.keys(d.mains).length !== joueurs.length) erreurs.push('Mains et joueurs ne correspondent pas.');
  return erreurs;
}

// ---------------------------------------------------------------------------
// Rôles
// ---------------------------------------------------------------------------

export function choisirComplice(rng: Rng, joueurs: string[]): string {
  return pick(rng, joueurs);
}

export function meurtrierDe(affaire: Affaire): SuspectId {
  return affaire.solution.suspect;
}
