// Partie seul contre des bots, sans internet : elle se joue entièrement sur cet appareil, avec le
// même moteur de règles et les mêmes bots que sur le serveur. Elle est gardée sur l'appareil à
// chaque coup : si l'on ferme le jeu, on la reprend depuis l'accueil.
//
// La solution est donc présente sur l'appareil : sans importance ici, puisqu'on ne joue que
// contre des bots (on ne tricherait que contre soi-même).

import { decisionBot } from '../bots/bot';
import { appliquerAction, avancer, creerPartie, type EtatPartie } from '../engine/partie';
import { cryptoRng } from '../engine/rng';
import { vuePour } from '../engine/vue';
import type { EtatClient, EvenementsClient, MessageChat, Reponse } from '../shared/protocole';
import { AFFAIRES_IDS, SANS_LIMITE, type ActionJeu, type AffaireId, type ChoixAffaire, type HistoriqueCartes, type ModeComplice, type ModeJeu } from '../shared/types';
import { CONFIG_GRANDE_ENQUETE } from '../engine/config';
import { connexion, type MoteurLocal } from './connexion';

export const CODE_HORS_LIGNE = 'HORS-LIGNE';
const MOI = 'vous';
const NOMS_BOTS = ['Hercule', 'Marple', 'Maigret', 'Columbo', 'Lupin', 'Holmes', 'Dupin', 'Vidocq'];
const CLE = 'dossier-secret:partie-hors-ligne';

export interface ReglagesHorsLigne {
  nom: string;
  bots: number;
  dureeTourS: number | null;
  modeComplice: ModeComplice;
  affaire: ChoixAffaire;
  historiqueCartes: HistoriqueCartes;
  /** Partie classique ou « Grande enquête » (absent dans les sauvegardes d'avant : classique). */
  mode?: ModeJeu;
}

interface Sauvegarde {
  version: 1;
  reglages: ReglagesHorsLigne;
  etat: EtatPartie;
  messages: MessageChat[];
  /** Dernier enregistrement (ms) : à la reprise, les chronos sont décalés d'autant. */
  t: number;
}

function lireSauvegarde(): Sauvegarde | null {
  try {
    const s = JSON.parse(localStorage.getItem(CLE) ?? 'null') as Sauvegarde | null;
    return s?.version === 1 && s.etat && s.reglages ? s : null;
  } catch {
    return null;
  }
}

function ecrireSauvegarde(s: Sauvegarde | null) {
  try {
    if (s) localStorage.setItem(CLE, JSON.stringify(s));
    else localStorage.removeItem(CLE);
  } catch {
    /* stockage plein ou indisponible : la partie continue, sans reprise possible */
  }
}

/** Ce que montre la carte « Partie en cours » de l'accueil (null : aucune partie hors ligne). */
export function partieHorsLigneEnCours(): { affaire: AffaireId; manche: number; manchesMax: number; joueurs: number; t: number } | null {
  const s = lireSauvegarde();
  if (!s || s.etat.etape === 'terminee') return null;
  return { affaire: s.etat.config.affaire, manche: s.etat.manche, manchesMax: s.etat.config.manchesMax, joueurs: s.etat.ordre.length, t: s.t };
}

function nouvellePartie(r: ReglagesHorsLigne): EtatPartie {
  const affaire: AffaireId = r.affaire === 'aleatoire' ? AFFAIRES_IDS[cryptoRng.int(AFFAIRES_IDS.length)] : r.affaire;
  const joueurs = [
    { id: MOI, nom: r.nom },
    ...Array.from({ length: r.bots }, (_, i) => ({ id: `bot${i + 1}`, nom: `${NOMS_BOTS[i] ?? `Bot ${i + 1}`} (bot)`, bot: true })),
  ];
  return creerPartie({
    id: `horsligne-${Date.now().toString(36)}-${cryptoRng.int(1_000_000).toString(36)}`,
    joueurs,
    rng: cryptoRng,
    now: Date.now(),
    config: {
      ...(r.mode === 'grande' ? CONFIG_GRANDE_ENQUETE : {}),
      affaire,
      attenteDepartMs: 180_000,
      delaiTourMs: r.dureeTourS === null ? null : r.dureeTourS * 1000,
      modeComplice: r.modeComplice,
      historiqueCartes: r.historiqueCartes,
    },
  });
}

class PartieHorsLigne implements MoteurLocal {
  private boucle: ReturnType<typeof setInterval>;
  private minuteurBot: ReturnType<typeof setTimeout> | null = null;
  private enregistrement: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private reglages: ReglagesHorsLigne,
    public etat: EtatPartie,
    private messages: MessageChat[] = [],
  ) {
    this.boucle = setInterval(() => this.tic(), 250);
    this.enregistrer();
  }

  etatClient(): EtatClient {
    const e = this.etat;
    return {
      moi: MOI,
      salon: {
        code: CODE_HORS_LIGNE,
        solo: true,
        statut: e.etape === 'terminee' ? 'terminee' : 'partie',
        hote: MOI,
        joueurs: e.ordre.map((id) => ({ id, nom: e.joueurs[id].nom, connecte: true, bot: e.joueurs[id].bot, hote: id === MOI, parti: false })),
        messages: this.messages,
        botsAutorises: true,
        reglages: {
          affaire: this.reglages.affaire,
          dureeTourS: this.reglages.dureeTourS,
          modeComplice: this.reglages.modeComplice,
          historiqueCartes: this.reglages.historiqueCartes,
          mode: this.reglages.mode ?? 'classique',
        },
        min: this.reglages.mode === 'grande' ? 4 : 3,
        max: 6,
        reprise: false,
        demandes: [],
      },
      partie: vuePour(e, MOI),
      heureServeur: Date.now(),
    };
  }

  private publier() {
    connexion.majLocale(this.etatClient());
    this.enregistrer();
  }

  /** Garde la partie sur l'appareil (au plus une fois par seconde) ; finie, elle est effacée. */
  private enregistrer() {
    if (this.etat.etape === 'terminee') {
      if (this.enregistrement) clearTimeout(this.enregistrement);
      this.enregistrement = null;
      ecrireSauvegarde(null);
      return;
    }
    if (this.enregistrement) return;
    this.enregistrement = setTimeout(() => {
      this.enregistrement = null;
      if (this.etat.etape !== 'terminee') ecrireSauvegarde({ version: 1, reglages: this.reglages, etat: this.etat, messages: this.messages, t: Date.now() });
    }, 1000);
  }

  envoyer(ev: keyof EvenementsClient, payload: unknown): Reponse<object> {
    if (ev === 'jeu:action') {
      const r = appliquerAction(this.etat, MOI, payload as ActionJeu, Date.now());
      this.publier();
      return r.ok ? { ok: true } : { ok: false, erreur: r.erreur };
    }
    if (ev === 'salon:message') {
      const texte = String((payload as { texte?: unknown })?.texte ?? '').trim().slice(0, 300);
      if (!texte) return { ok: false, erreur: 'Message vide.' };
      this.messages = [...this.messages, { id: this.messages.length + 1, auteur: MOI, nom: this.reglages.nom, texte, t: Date.now() }].slice(-150);
      this.publier();
      return { ok: true };
    }
    if (ev === 'salon:rejouer') {
      // Nouvelle enquête avec les mêmes réglages (« au hasard » : une nouvelle histoire est tirée).
      this.etat = nouvellePartie(this.reglages);
      this.messages = [];
      this.publier();
      return { ok: true };
    }
    return { ok: false, erreur: 'Indisponible hors ligne : il faut une connexion internet.' };
  }

  /** On quitte la partie : elle est abandonnée (et effacée de l'appareil). */
  arreter() {
    clearInterval(this.boucle);
    if (this.minuteurBot) clearTimeout(this.minuteurBot);
    if (this.enregistrement) clearTimeout(this.enregistrement);
    ecrireSauvegarde(null);
  }

  private tic() {
    if (avancer(this.etat, Date.now(), cryptoRng)) this.publier();
    if (this.minuteurBot || this.etat.etape === 'terminee') return;
    // Comme sur le serveur : le premier bot qui a quelque chose à faire joue, après un court délai.
    const bot = this.etat.ordre.find((id) => this.etat.joueurs[id].bot && decisionBot(vuePour(this.etat, id), cryptoRng));
    if (!bot) return;
    this.minuteurBot = setTimeout(
      () => {
        this.minuteurBot = null;
        const action = decisionBot(vuePour(this.etat, bot), cryptoRng);
        if (!action) return;
        const r = appliquerAction(this.etat, bot, action, Date.now());
        if (!r.ok && this.etat.etape === 'tour' && this.etat.ordre[this.etat.indexTour] === bot) appliquerAction(this.etat, bot, { type: 'finTour' }, Date.now());
        this.publier();
      },
      900 + cryptoRng.int(1300),
    );
  }
}

/** Lance une nouvelle partie hors ligne. */
export function lancerPartieHorsLigne(reglages: ReglagesHorsLigne) {
  const p = new PartieHorsLigne(reglages, nouvellePartie(reglages));
  connexion.demarrerLocal(p, p.etatClient(), { tutoriel: false });
}

/** Reprend la partie hors ligne gardée sur l'appareil (false s'il n'y en a pas). */
export function reprendrePartieHorsLigne(): boolean {
  const s = lireSauvegarde();
  if (!s || s.etat.etape === 'terminee') return false;
  // Le temps passé jeu fermé ne compte pas : les chronos sont décalés d'autant.
  const ecoule = Math.max(0, Date.now() - s.t);
  if (s.etat.echeanceTour < SANS_LIMITE / 2) s.etat.echeanceTour += ecoule;
  if (s.etat.hypothese) s.etat.hypothese.echeance += ecoule;
  const p = new PartieHorsLigne(s.reglages, s.etat, s.messages);
  connexion.demarrerLocal(p, p.etatClient(), { tutoriel: false });
  return true;
}
