// Formes des fiches d'une affaire (personnages, lieux, armes) et de sa présentation.
// Types uniquement : chaque affaire remplit ces modèles dans son propre fichier.

import type { AffaireId, ArmeId, CarteIndice, ELEMENTS_PAR_AFFAIRE, LieuId, SuspectId } from '../types';

export type SuspectsDe<A extends AffaireId> = (typeof ELEMENTS_PAR_AFFAIRE)[A]['suspects'][number];
export type LieuxDe<A extends AffaireId> = (typeof ELEMENTS_PAR_AFFAIRE)[A]['lieux'][number];
export type ArmesDe<A extends AffaireId> = (typeof ELEMENTS_PAR_AFFAIRE)[A]['armes'][number];

export interface FichePersonnage {
  id: SuspectId;
  nom: string;
  /** Nom court affiché dans les listes (par défaut : le prénom). */
  court?: string;
  titre: string;
  description: string;
  histoire: string;
  relation: string;
  mobile: string;
  secret: string;
  alibi: string;
  connaissances: string;
  /** Phrase utilisée dans l'explication finale lorsque ce personnage est coupable. */
  aveu: string;
  couleur: string;
}

export interface FicheLieu {
  id: LieuId;
  nom: string;
  article: string; // « dans le bureau »
  description: string;
  details: string[];
  recit: string;
  icone: string;
}

export interface FicheArme {
  id: ArmeId;
  nom: string;
  article: string; // « avec le chandelier en bronze »
  description: string;
  caracteristiques: string[];
  recit: string;
  icone: string;
}

/** Présentation d'une affaire et textes qui lui sont propres. */
export interface InfosAffaire {
  id: AffaireId;
  titre: string;
  /** Titre court (choix de l'affaire dans le salon). */
  court: string;
  /** Une phrase d'accroche (accueil, salon). */
  accroche: string;
  victime: string;
  /** Prénom ou nom d'usage de la victime dans les phrases (« a tué Armand »). */
  victimeCourt: string;
  resume: string[];
  fenetreCrime: { de: string; a: string };
  /** Texte de l'heure du crime dans l'explication finale (« entre 22 h 50 et 23 h 10 »). */
  heureCrime: string;
  /** Lieu où le corps a été découvert. */
  lieuDecouverte: LieuId;
  corpsNonDeplace: string;
  corpsDeplace: string;
  /** Pages du carnet intime de la victime glissées dans les archives. */
  journal: {
    /** Libellé de la catégorie (« Journal d'Armand »). */
    libelle: string;
    /** Présentation dans les règles. */
    presentation: string;
    /** Phrase d'introduction en fin de partie. */
    fin: string;
  };
}

/** Tout ce qui constitue une affaire jouable. */
export interface DonneesAffaire {
  infos: InfosAffaire;
  personnages: Record<string, FichePersonnage>;
  lieux: Record<string, FicheLieu>;
  armes: Record<string, FicheArme>;
  indices: CarteIndice[];
  fauxIndices: CarteIndice[];
}
