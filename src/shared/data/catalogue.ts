// Catalogue des affaires : toutes les fiches et tous les indices, réunis.
// Les identifiants (éléments et indices) sont uniques toutes affaires confondues,
// ce qui permet de retrouver une fiche ou un indice sans savoir de quelle affaire il vient.

import { affaireDe, AFFAIRE_PAR_DEFAUT, type AffaireId, type CarteIndice, type ElementId } from '../types';
import { FAUX_INDICES, INDICES } from './indices';
import { FAUX_INDICES_TRAIN, INDICES_TRAIN } from './indicesTrain';
import { AFFAIRE, ARMES_FICHES as ARMES_MANOIR, LIEUX_FICHES as LIEUX_MANOIR, PERSONNAGES as PERSONNAGES_MANOIR } from './manoir';
import type { DonneesAffaire, FicheArme, FicheLieu, FichePersonnage, InfosAffaire } from './modeles';
import { AFFAIRE_TRAIN, ARMES_TRAIN, LIEUX_TRAIN, PERSONNAGES_TRAIN } from './train';

export type { FicheArme, FicheLieu, FichePersonnage, InfosAffaire } from './modeles';

export const DONNEES_AFFAIRES: Record<AffaireId, DonneesAffaire> = {
  manoir: { infos: AFFAIRE, personnages: PERSONNAGES_MANOIR, lieux: LIEUX_MANOIR, armes: ARMES_MANOIR, indices: INDICES, fauxIndices: FAUX_INDICES },
  train: { infos: AFFAIRE_TRAIN, personnages: PERSONNAGES_TRAIN, lieux: LIEUX_TRAIN, armes: ARMES_TRAIN, indices: INDICES_TRAIN, fauxIndices: FAUX_INDICES_TRAIN },
};

/** Présentation de chaque affaire. */
export const AFFAIRES: Record<AffaireId, InfosAffaire> = { manoir: AFFAIRE, train: AFFAIRE_TRAIN };

const tous = <K extends 'personnages' | 'lieux' | 'armes'>(k: K) =>
  Object.assign({}, ...Object.values(DONNEES_AFFAIRES).map((d) => d[k])) as DonneesAffaire[K];

/** Fiches de toutes les affaires, par identifiant. */
export const PERSONNAGES: Record<string, FichePersonnage> = tous('personnages');
export const LIEUX_FICHES: Record<string, FicheLieu> = tous('lieux');
export const ARMES_FICHES: Record<string, FicheArme> = tous('armes');

/** Indices rédigés d'une affaire (ceux que le générateur peut tirer). */
export const indicesDe = (affaire: AffaireId): CarteIndice[] => DONNEES_AFFAIRES[affaire].indices;
/** Modèles de faux indices d'une affaire (ruse « Dossier trafiqué »). */
export const fauxIndicesDe = (affaire: AffaireId): CarteIndice[] => DONNEES_AFFAIRES[affaire].fauxIndices;

/** Tous les indices, vrais et faux, de toutes les affaires. */
export const INDICES_PAR_ID: Record<string, CarteIndice> = Object.fromEntries(
  Object.values(DONNEES_AFFAIRES).flatMap((d) => [...d.indices, ...d.fauxIndices].map((c) => [c.id, c] as const)),
);

/** Affaire d'un indice (d'après les éléments qu'il concerne). */
export function affaireDeCarte(c: CarteIndice): AffaireId {
  return affaireDe(c.concerne[0]) ?? AFFAIRE_PAR_DEFAUT;
}

export function nomElement(id: ElementId | string): string {
  return PERSONNAGES[id]?.nom ?? LIEUX_FICHES[id]?.nom ?? ARMES_FICHES[id]?.nom ?? id;
}

/** Nom court (prénom pour les personnages, sans article pour les lieux). */
export function nomCourt(id: ElementId | string): string {
  const p = PERSONNAGES[id];
  if (p) return p.court ?? p.nom.split(' ')[0];
  if (LIEUX_FICHES[id]) return LIEUX_FICHES[id].nom.replace(/^(Le |La |L')/, '');
  return nomElement(id);
}

const LIBELLES_CATEGORIE: Record<Exclude<CarteIndice['categorie'], 'journal'>, string> = {
  temoignage: 'Témoignage',
  objet: 'Objet',
  horaire: 'Horaire',
  deplacement: 'Déplacement',
  document: 'Document',
  trace: 'Trace',
  contradiction: 'Contradiction',
};

/** Libellé d'une catégorie d'indice ou de dossier d'archives (« Journal d'Armand », « Carnet d'Octave »…). */
export function libelleCategorie(categorie: CarteIndice['categorie'] | 'piece', affaire: AffaireId): string {
  if (categorie === 'piece') return 'Pièce à conviction';
  if (categorie === 'journal') return AFFAIRES[affaire].journal.libelle;
  return LIBELLES_CATEGORIE[categorie];
}
