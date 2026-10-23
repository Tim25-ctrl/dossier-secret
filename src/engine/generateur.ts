// Génération des affaires, distribution des cartes et attribution des rôles.
//
// Ordre imposé : 1) la solution est tirée, 2) seuls les indices compatibles avec
// cette solution sont candidats, 3) une sélection est construite puis VALIDÉE.
// Si la validation échoue, on régénère : une partie incohérente ne démarre jamais.

import { INDICES_PAR_ID, indicesDuMode, indicesMobilesDe } from '../shared/data/catalogue';
import { combinaisonsPossibles, estRelationnel, indiceValide, indicesIncompatibles } from '../shared/logique';
import {
  AFFAIRE_PAR_DEFAUT,
  elementsDe,
  elementsDuTriplet,
  memeTriplet,
  type AffaireId,
  type CarteIndice,
  type ElementId,
  type SuspectId,
  type Triplet,
} from '../shared/types';
import { JOUEURS_MAX, JOUEURS_MIN, avecMobile, type ConfigPartie } from './config';
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

export function tirerSolution(rng: Rng, affaire: AffaireId = AFFAIRE_PAR_DEFAUT, mobile = false): Triplet {
  const e = elementsDe(affaire);
  const solution: Triplet = { suspect: pick(rng, e.suspects), lieu: pick(rng, e.lieux), arme: pick(rng, e.armes) };
  // Le mobile est tiré APRÈS les trois autres : une partie classique garde exactement le même tirage.
  if (mobile) solution.mobile = pick(rng, e.mobiles);
  return solution;
}

function distincts<T>(items: T[]): number {
  return new Set(items).size;
}

/** Les indices donnés laissent-ils au moins deux possibilités dans chaque catégorie ? */
function laisseDuDoutePartout(cartes: CarteIndice[], affaire: AffaireId, mobile = false): boolean {
  const c = combinaisonsPossibles(cartes, [], affaire, mobile);
  return (
    distincts(c.map((t) => t.suspect)) >= 2 &&
    distincts(c.map((t) => t.lieu)) >= 2 &&
    distincts(c.map((t) => t.arme)) >= 2 &&
    (!mobile || distincts(c.map((t) => t.mobile)) >= 2)
  );
}

/** Une tentative de sélection d'indices pour une solution donnée. */
function tenterSelection(rng: Rng, solution: Triplet, config: ConfigPartie): Affaire | null {
  const nbDifferes = config.manchesIndicesPublics.length;
  const total = config.nbIndicesPublicsDepart + nbDifferes + config.nbDossiersArchives;
  const mobile = avecMobile(config);
  const utilisable = (c: CarteIndice) => indiceValide(c, solution) && (!config.indicesRelationnels || estRelationnel(c));
  // « Grande enquête » : quelques indices sur les mobiles passent en tête, pour en garantir dans les archives.
  const quota = mobile ? (config.nbIndicesMobiles ?? 0) : 0;
  const surMobiles = quota ? shuffle(rng, indicesMobilesDe(config.affaire).filter(utilisable)).slice(0, quota) : [];
  const compatibles = [
    ...surMobiles,
    ...shuffle(
      rng,
      indicesDuMode(config.affaire, mobile).filter((c) => utilisable(c) && !surMobiles.includes(c)),
    ),
  ];

  const choisis: CarteIndice[] = [];
  for (const carte of compatibles) {
    if (choisis.length >= total) break;
    if (choisis.some((c) => indicesIncompatibles(c, carte))) continue;
    const essai = [...choisis, carte];
    if (combinaisonsPossibles(essai, [], config.affaire, mobile).length < config.minCombinaisonsIndices) continue;
    choisis.push(carte);
  }
  if (choisis.length < total) return null;

  // Indices publics de départ : disponibles dès la manche 1 et peu révélateurs.
  const departPossibles = choisis.filter((c) => c.disponibleDesManche <= 1);
  let depart: CarteIndice[] | null = null;
  for (let essai = 0; essai < 20 && !depart; essai++) {
    const tirage = shuffle(rng, departPossibles).slice(0, config.nbIndicesPublicsDepart);
    if (tirage.length === config.nbIndicesPublicsDepart && laisseDuDoutePartout(tirage, config.affaire, avecMobile(config))) depart = tirage;
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
    const solution = solutionImposee ?? tirerSolution(rng, config.affaire, avecMobile(config));
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
  const e = elementsDe(config.affaire);
  const mobileAttendu = avecMobile(config);
  if (
    !e.suspects.includes(solution.suspect) ||
    !e.lieux.includes(solution.lieu) ||
    !e.armes.includes(solution.arme) ||
    (mobileAttendu ? !solution.mobile || !e.mobiles.includes(solution.mobile) : solution.mobile !== undefined)
  ) {
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

  const autreAffaire = new Set(indicesDuMode(config.affaire, mobileAttendu).map((c) => c.id));
  for (const c of cartes) if (!autreAffaire.has(c.id)) erreurs.push(`L'indice ${c.id} n'appartient pas à cette affaire.`);
  for (const c of cartes) if (!indiceValide(c, solution)) erreurs.push(`L'indice ${c.id} exclut la vraie solution.`);
  if (config.indicesRelationnels)
    for (const c of cartes) if (!estRelationnel(c)) erreurs.push(`L'indice ${c.id} écarte directement un élément (il doit être relationnel).`);
  for (let i = 0; i < cartes.length; i++)
    for (let j = i + 1; j < cartes.length; j++)
      if (indicesIncompatibles(cartes[i], cartes[j])) erreurs.push(`Les indices ${cartes[i].id} et ${cartes[j].id} se contredisent.`);

  const possibles = combinaisonsPossibles(cartes, [], config.affaire, mobileAttendu);
  if (!possibles.some((t) => memeTriplet(t, solution)))
    erreurs.push('La solution ne fait pas partie des combinaisons possibles.');
  if (possibles.length < config.minCombinaisonsIndices)
    erreurs.push(`Les indices seuls révèlent trop la solution (${possibles.length} combinaison(s) restante(s)).`);

  const depart = affaire.indicesPublicsDepart.map((id) => INDICES_PAR_ID[id]);
  if (depart.length !== config.nbIndicesPublicsDepart) erreurs.push("Nombre d'indices publics de départ incorrect.");
  if (depart.some((c) => c.disponibleDesManche > 1)) erreurs.push("Un indice public de départ n'est pas disponible en manche 1.");
  if (!laisseDuDoutePartout(depart, config.affaire, mobileAttendu)) erreurs.push('Les indices publics de départ révèlent un élément de la solution.');

  for (const d of affaire.indicesPublicsDifferes)
    if (INDICES_PAR_ID[d.indice].disponibleDesManche > d.manche) erreurs.push(`L'indice ${d.indice} est publié avant sa disponibilité.`);
  if (affaire.archives.length !== config.nbDossiersArchives) erreurs.push("Nombre de dossiers d'archives incorrect.");
  const mobilesUtiles = new Set(indicesMobilesDe(config.affaire).map((c) => c.id));
  if (mobileAttendu && affaire.archives.filter((d) => mobilesUtiles.has(d.indice)).length < (config.nbIndicesMobiles ?? 0))
    erreurs.push('Pas assez de dossiers sur les mobiles.');
  for (const d of affaire.archives)
    if (INDICES_PAR_ID[d.indice].disponibleDesManche > d.disponibleDesManche) erreurs.push(`Le dossier ${d.dossier} s'ouvre avant sa disponibilité.`);

  return erreurs;
}

// ---------------------------------------------------------------------------
// Distribution des cartes
// ---------------------------------------------------------------------------

/**
 * Règle de distribution (partie classique) : les 15 cartes qui ne font pas partie de la solution
 * sont mélangées. Chaque joueur reçoit floor(15 / N) cartes ; le reste devient des
 * pièces à conviction rangées dans les archives (ou des cartes publiques, selon la config).
 *   3 joueurs : 5 cartes chacun, 0 restante
 *   4 joueurs : 3 cartes chacun, 3 restantes
 *   5 joueurs : 3 cartes chacun, 0 restante
 *   6 joueurs : 2 cartes chacun, 3 restantes
 * En « Grande enquête », les mobiles s'ajoutent : 20 cartes hors solution.
 *   4 joueurs : 5 cartes chacun · 5 joueurs : 4 chacun · 6 joueurs : 3 chacun, 2 restantes
 */
export function distribuerCartes(rng: Rng, solution: Triplet, joueurs: string[], affaire: AffaireId = AFFAIRE_PAR_DEFAUT): Distribution {
  if (joueurs.length < JOUEURS_MIN || joueurs.length > JOUEURS_MAX) throw new Error('Nombre de joueurs invalide.');
  const secretes = new Set<ElementId>(elementsDuTriplet(solution));
  const paquet = shuffle(
    rng,
    elementsDe(affaire, !!solution.mobile).tous.filter((e) => !secretes.has(e)),
  );
  const parJoueur = Math.floor(paquet.length / joueurs.length);
  const mains: Record<string, ElementId[]> = {};
  joueurs.forEach((id, i) => {
    mains[id] = paquet.slice(i * parJoueur, (i + 1) * parJoueur);
  });
  return { mains, cartesPubliques: paquet.slice(parJoueur * joueurs.length) };
}

export function validerDistribution(d: Distribution, solution: Triplet, joueurs: string[], affaire: AffaireId = AFFAIRE_PAR_DEFAUT): string[] {
  const erreurs: string[] = [];
  const toutes = [...Object.values(d.mains).flat(), ...d.cartesPubliques];
  if (new Set(toutes).size !== toutes.length) erreurs.push('Une carte est distribuée deux fois.');
  for (const e of elementsDuTriplet(solution)) if (toutes.includes(e)) erreurs.push('Une carte de la solution a été distribuée.');
  const elements = elementsDe(affaire, !!solution.mobile).tous;
  if (toutes.length !== elements.length - elementsDuTriplet(solution).length || toutes.some((c) => !elements.includes(c))) erreurs.push('Toutes les cartes hors solution ne sont pas distribuées.');
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
