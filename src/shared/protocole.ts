// Protocole WebSocket entre le navigateur et le serveur (types uniquement).

import type { ActionJeu, HistoriqueCartes, ModeComplice, VueJoueur } from './types';

export const LONGUEUR_CODE = 6;
export const ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PSEUDO_MAX = 20;
export const MESSAGE_MAX = 280;

export interface JoueurSalonVue {
  id: string;
  nom: string;
  connecte: boolean;
  bot: boolean;
  hote: boolean;
  parti: boolean;
}

export interface MessageChat {
  id: number;
  auteur: string;
  nom: string;
  texte: string;
  t: number;
}

/** Durées de tour proposées dans le salon (en secondes) ; null = sans limite. */
export const DUREES_TOUR: (number | null)[] = [60, 120, 180, 300, 600, null];

export interface ReglagesSalon {
  /** Durée d'un tour en secondes ; null = sans limite. */
  dureeTourS: number | null;
  /** Pouvoirs du complice. */
  modeComplice: ModeComplice;
  /** Cartes montrées et reçues : rappelées dans l'historique, ou anonymes (difficile). */
  historiqueCartes: HistoriqueCartes;
}

export interface SalonVue {
  code: string;
  statut: 'lobby' | 'partie' | 'terminee';
  hote: string;
  joueurs: JoueurSalonVue[];
  messages: MessageChat[];
  botsAutorises: boolean;
  reglages: ReglagesSalon;
  min: number;
  max: number;
}

export interface EtatClient {
  moi: string;
  salon: SalonVue;
  partie: VueJoueur | null;
  /** Heure du serveur, pour corriger le décalage d'horloge des comptes à rebours. */
  heureServeur: number;
}

export interface Session {
  code: string;
  joueurId: string;
  jeton: string;
}

export type Reponse<T = object> = ({ ok: true } & T) | { ok: false; erreur: string };

/** Événements envoyés par le client (avec accusé de réception). */
export interface EvenementsClient {
  'salon:creer': (p: { nom: string }, ack: (r: Reponse<{ session: Session }>) => void) => void;
  'salon:rejoindre': (p: { code: string; nom: string }, ack: (r: Reponse<{ session: Session }>) => void) => void;
  'salon:reprendre': (p: { code: string; jeton: string }, ack: (r: Reponse<{ session: Session }>) => void) => void;
  'salon:quitter': (p: object, ack: (r: Reponse<{ ferme: boolean }>) => void) => void;
  'salon:demarrer': (p: object, ack: (r: Reponse) => void) => void;
  'salon:rejouer': (p: object, ack: (r: Reponse) => void) => void;
  'salon:ajouterBot': (p: object, ack: (r: Reponse) => void) => void;
  'salon:retirer': (p: { joueurId: string }, ack: (r: Reponse) => void) => void;
  /** Partie en pause : remplacer un joueur absent par un bot, ou continuer sans lui. */
  'salon:remplacer': (p: { joueurId: string }, ack: (r: Reponse) => void) => void;
  'salon:continuerSans': (p: { joueurId: string }, ack: (r: Reponse) => void) => void;
  'salon:message': (p: { texte: string }, ack: (r: Reponse) => void) => void;
  'salon:reglages': (p: Partial<ReglagesSalon>, ack: (r: Reponse) => void) => void;
  'jeu:action': (p: ActionJeu, ack: (r: Reponse) => void) => void;
}

/** Événements envoyés par le serveur. */
export interface EvenementsServeur {
  etat: (e: EtatClient) => void;
  /** La session a été ouverte ailleurs ou le joueur a été retiré. */
  expulse: (p: { raison: string }) => void;
  /** Script principal servi par le serveur (ex. « index-B7lvQ1Cs.js ») : une page plus ancienne se recharge. */
  version: (v: string) => void;
}
