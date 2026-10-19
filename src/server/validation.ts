// Validation stricte de tout ce qui arrive du navigateur. Les données non
// conformes sont rejetées avant même d'atteindre le moteur de règles.

import { z } from 'zod';
import { ARMES, LIEUX, SUSPECTS, TOUS_ELEMENTS, type ActionJeu } from '../shared/types';

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
export const schemaRejoindre = z.object({ code: z.string().max(20), nom: z.string().max(60) });
export const schemaReprendre = z.object({ code: z.string().max(20), jeton: z.string().max(100) });
export const schemaMessage = z.object({ texte: z.string().max(1000) });
export const schemaRetirer = z.object({ joueurId: idJoueur });
export const schemaReglages = z
  .object({ dureeTourS: z.number().int().min(30).max(3600).nullable().optional(), modeComplice: z.enum(['classique', 'ruse']).optional() })
  .strict();

export function lireAction(brut: unknown): ActionJeu {
  const r = schemaAction.safeParse(brut);
  if (!r.success) throw new Error('Action mal formée.');
  return r.data as ActionJeu;
}
