// Validation stricte de tout ce qui arrive du navigateur. Les données non
// conformes sont rejetées avant même d'atteindre le moteur de règles.

import { z } from 'zod';
import { AFFAIRES_IDS, ARMES, LIEUX, SUSPECTS, TOUS_ELEMENTS, type ActionJeu, type AffaireId } from '../shared/types';

const suspect = z.enum(SUSPECTS);
const lieu = z.enum(LIEUX);
const arme = z.enum(ARMES);
const element = z.enum(TOUS_ELEMENTS as [string, ...string[]]);
const idJoueur = z.string().min(1).max(40);
const marque = z.enum(['inconnu', 'ecarte', 'probable', 'certain']);

export const schemaAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hypothese'), suspect, lieu, arme, interroges: z.array(idJoueur).min(1).max(5) }).strict(),
  z.object({ type: z.literal('falsifier'), champ: z.enum(['suspect', 'lieu', 'arme']), valeur: element }).strict(),
  z.object({ type: z.literal('passerFalsification') }).strict(),
  z.object({ type: z.literal('repondre'), carte: element.nullable() }).strict(),
  z.object({ type: z.literal('mentir') }).strict(),
  z.object({ type: z.literal('consulterArchive'), dossier: z.number().int().min(1).max(20), trafiquer: z.boolean().optional() }).strict(),
  z.object({ type: z.literal('emprunter'), carte: element }).strict(),
  z.object({ type: z.literal('denoncer'), joueur: idJoueur }).strict(),
  z.object({ type: z.literal('accuser'), suspect, lieu, arme }).strict(),
  z.object({ type: z.literal('finTour') }).strict(),
  z
    .object({
      type: z.literal('carnet'),
      // partialRecord : seuls les éléments modifiés sont envoyés (z.record exigerait les 18 clés).
      marques: z.partialRecord(element, marque).optional(),
      notes: z.string().max(4000).optional(),
    })
    .strict(),
]);

export const schemaPseudo = z.object({ nom: z.string().max(60) });
export const schemaSolo = z
  .object({
    nom: z.string().max(60),
    bots: z.number().int().min(1).max(10),
    dureeTourS: z.number().int().min(30).max(3600).nullable(),
    modeComplice: z.enum(['classique', 'ruse']),
    affaire: z.enum(AFFAIRES_IDS as [AffaireId, ...AffaireId[]]),
    historiqueCartes: z.enum(['visibles', 'anonymes']).optional(),
  })
  .strict();
export const schemaRejoindre = z.object({ code: z.string().max(20), nom: z.string().max(60) });
export const schemaReprendre = z.object({ code: z.string().max(20), jeton: z.string().max(100) });
export const schemaMessage = z.object({ texte: z.string().max(1000) });
export const schemaRetirer = z.object({ joueurId: idJoueur });
export const schemaRepondrePlace = z.object({ demandeId: z.string().min(1).max(40), accepter: z.boolean() });
export const schemaEmplacement = z
  .object({
    numero: z.number().int().optional(),
    type: z.enum(['solo', 'multi']).optional(),
  })
  .strict();
const motDePasse = z.string().max(200);
const profil = z
  .object({
    parties: z.number().int().min(0).max(1e7),
    victoires: z.number().int().min(0).max(1e7),
    enqueteur: z.object({ parties: z.number().int().min(0).max(1e7), victoires: z.number().int().min(0).max(1e7) }).strict(),
    complice: z.object({ parties: z.number().int().min(0).max(1e7), victoires: z.number().int().min(0).max(1e7) }).strict(),
    serie: z.number().int().min(0).max(1e7),
    meilleureSerie: z.number().int().min(0).max(1e7),
    succes: z.record(z.string().max(40), z.number()).refine((s) => Object.keys(s).length <= 100),
    comptees: z.array(z.string().max(60)).max(100),
  })
  .strict();
export const schemaProfil = z.object({ profil }).strict();
export const schemaCreerCompte = z
  .object({ nom: z.string().max(60), motDePasse, profil: profil.optional(), codeJoueur: z.string().max(40).optional() })
  .strict();
export const schemaConnecterCompte = z.object({ nom: z.string().max(60), motDePasse, codeJoueur: z.string().max(40).optional() }).strict();
export const schemaReprendreCompte = z.object({ jeton: z.string().max(200) }).strict();
export const schemaRecupererCompte = z.object({ nom: z.string().max(60), codeSecours: z.string().max(40), motDePasse }).strict();
export const schemaChangerMotDePasse = z.object({ ancien: motDePasse, nouveau: motDePasse }).strict();
export const schemaSupprimerCompte = z.object({ motDePasse }).strict();
export const schemaRenommerCompte = z.object({ nom: z.string().max(60), motDePasse }).strict();
export const schemaReglages = z
  .object({
    dureeTourS: z.number().int().min(30).max(3600).nullable().optional(),
    modeComplice: z.enum(['classique', 'ruse']).optional(),
    historiqueCartes: z.enum(['visibles', 'anonymes']).optional(),
    affaire: z.enum(AFFAIRES_IDS as [AffaireId, ...AffaireId[]]).optional(),
  })
  .strict();

export function lireAction(brut: unknown): ActionJeu {
  const r = schemaAction.safeParse(brut);
  if (!r.success) throw new Error('Action mal formée.');
  return r.data as ActionJeu;
}
