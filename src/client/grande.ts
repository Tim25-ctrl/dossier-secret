// Textes de la « Grande enquête » partagés par les écrans : noms et pouvoirs des rôles, objectifs du complice.

import { nomElement } from '../shared/data/catalogue';
import type { EtiquetteEpingle, ObjectifVu, Role, RoleEnquete, VueJoueur } from '../shared/types';

export const estGrande = (vue: VueJoueur) => vue.regles.mode === 'grande';

export const NOMS_ROLES: Record<RoleEnquete, string> = {
  temoin: 'Témoin',
  inspecteur: 'Inspecteur',
  legiste: 'Légiste',
  archiviste: 'Archiviste',
  journaliste: 'Journaliste',
  profileur: 'Profileur',
};

/** Ce que fait chaque rôle (règles, panneau du rôle, fin de partie). */
export const POUVOIRS_ROLES: Record<RoleEnquete, string> = {
  temoin: 'Vous connaissez le lieu du crime depuis le début. Guidez les autres sans vous trahir : si le complice vous démasque à la fin, il peut voler la victoire.',
  inspecteur: 'Deux fois par partie, juste après votre hypothèse (pendant le même tour), vous apprenez si les réponses reçues étaient honnêtes ou si le complice a triché.',
  legiste: 'Une fois, à partir de la manche 3 : choisissez une catégorie, vous apprenez deux éléments innocents.',
  archiviste: "Deux consultations d'archives gratuites (sans point d'action), et une fois, savoir si un dossier a été trafiqué.",
  journaliste: "Trois rumeurs anonymes à publier sur le tableau d'enquête (une par manche au plus) : personne ne sait qui les a écrites.",
  profileur: 'Une fois, à partir de la manche 6 : désignez deux joueurs, vous apprenez si le complice est l’un des deux.',
};

/** Nom du rôle secret affiché au joueur (« Témoin », « Complice », « Maître chanteur »…). */
export function libelleRole(role: Role, roleEnquete?: RoleEnquete): string {
  if (role === 'complice') return 'Complice';
  if (role === 'maitre_chanteur') return 'Maître chanteur';
  return roleEnquete ? NOMS_ROLES[roleEnquete] : 'Enquêteur';
}

export const NOMS_OBJECTIFS = {
  temoin_genant: 'Le témoin gênant',
  bouc_emissaire: 'Le bouc émissaire',
  ombre: "L'ombre",
} as const;

/** L'objectif secret du complice, en une phrase : adressée au complice, ou racontée à tous en fin de partie. */
export function texteObjectif(o: ObjectifVu, raconte = false): string {
  const n = o.accusations ?? 1;
  if (raconte)
    switch (o.type) {
      case 'temoin_genant':
        return "si l'enquête aboutissait, il avait une dernière chance de désigner le Témoin pour voler la victoire.";
      case 'bouc_emissaire':
        return `faire accuser ${o.suspect ? nomElement(o.suspect) : 'un innocent'} (${n} accusation${n > 1 ? 's' : ''} finale${n > 1 ? 's' : ''}) pour gagner, même si l'enquête aboutissait.`;
      case 'ombre':
        return `n'être jamais dénoncé et utiliser au moins ${o.ruses ?? 3} ruses, pour gagner même si l'enquête aboutissait.`;
    }
  switch (o.type) {
    case 'temoin_genant':
      return "Si l'enquête aboutit, vous aurez une dernière chance : désigner le Témoin. Si c'est lui, vous volez la victoire.";
    case 'bouc_emissaire':
      return `Faites accuser ${o.suspect ? nomElement(o.suspect) : 'un innocent'} : si ${o.accusations ?? 1} accusation${(o.accusations ?? 1) > 1 ? 's' : ''} finale${(o.accusations ?? 1) > 1 ? 's le visent' : ' le vise'}, vous gagnez, même si l'enquête aboutit.`;
    case 'ombre':
      return `Ne soyez jamais dénoncé et utilisez au moins ${o.ruses ?? 3} ruses : vous gagnez, même si l'enquête aboutit.`;
  }
}

export const LIBELLES_ETIQUETTES: Record<EtiquetteEpingle, string> = {
  innocent: 'Innocent ?',
  coupable: 'Coupable ?',
  fausse_piste: 'Fausse piste ?',
  complice: 'Complice ?',
};
