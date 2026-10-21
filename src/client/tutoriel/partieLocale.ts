// Partie guidée : une vraie partie, jouée entièrement sur cet appareil (moteur et bots du jeu),
// sans serveur ni salon. Le scénario est préparé pour que chaque situation du tutoriel arrive :
// vous commencez, et Hercule vous interroge à son premier tour.
// Deux rôles : enquêteur (Marple est alors le complice) ou complice (vous, avec plus de ruses
// que dans une vraie partie à 3 pour pouvoir toutes les essayer).

import { PROFIL_OCCASIONNEL, decisionBot } from '../../bots/bot';
import { appliquerAction, avancer, creerPartie, peutFalsifier, type EtatPartie } from '../../engine/partie';
import { CONFIG_PAR_DEFAUT } from '../../engine/config';
import { cryptoRng, seededRng } from '../../engine/rng';
import { vuePour } from '../../engine/vue';
import type { EtatClient, EvenementsClient, MessageChat, Reponse } from '../../shared/protocole';
import { categorieDe, elementsDe, type ActionJeu, type ElementId, type Triplet } from '../../shared/types';

const MANOIR = elementsDe('manoir');
import { connexion, type MoteurLocal } from '../connexion';

export const MOI = 'vous';
const HERCULE = 'hercule';
const MARPLE = 'marple';
const BOTS = [HERCULE, MARPLE];
const SOLUTION: Triplet = { suspect: 'gabriel', lieu: 'cave', arme: 'chandelier' };

export type RoleGuide = 'enqueteur' | 'complice';

function nouvelleAffaire(nom: string, role: RoleGuide): EtatPartie {
  const complice = role === 'complice';
  // Première graine où vous jouez en premier (l'ordre du tour est tiré au sort).
  for (let graine = 1; graine < 500; graine++) {
    const etat = creerPartie({
      id: `guide-${graine}`,
      joueurs: [
        { id: MOI, nom },
        { id: HERCULE, nom: 'Hercule (bot)', bot: true },
        { id: MARPLE, nom: 'Marple (bot)', bot: true },
      ],
      rng: seededRng(graine),
      now: Date.now(),
      // Pas de limite de temps : on lit les explications tranquillement. Complice : la fenêtre de
      // falsification reste ouverte jusqu'à votre choix (elle se referme dès qu'il est fait, voir tic).
      config: {
        delaiTourMs: null,
        delaiReponseMs: 600_000,
        delaiFalsificationMs: complice ? 600_000 : 3_000,
        modeComplice: 'ruse',
        ...(complice ? { ruses: { ...CONFIG_PAR_DEFAUT.ruses, 3: 4 } } : {}),
      },
      imposer: { solution: SOLUTION, complice: complice ? MOI : MARPLE },
    });
    if (etat.ordre[0] === MOI) return etat;
  }
  throw new Error('Partie guidée : aucune graine ne convient.');
}

class PartieLocale implements MoteurLocal {
  etat: EtatPartie;
  private messages: MessageChat[] = [];
  private boucle: ReturnType<typeof setInterval>;
  private minuteurBot: ReturnType<typeof setTimeout> | null = null;
  private herculeAInterroge = false;
  /** Partie figée par le guide pendant une explication : bots arrêtés, chronos décalés. */
  private gelee = false;
  private dernierTic = Date.now();

  constructor(
    private nom: string,
    private role: RoleGuide,
  ) {
    this.etat = nouvelleAffaire(nom, role);
    this.boucle = setInterval(() => this.tic(), 250);
  }

  /** Hypothèse conseillée à votre premier tour : Hercule (honnête) aura une carte à vous montrer. */
  suggestion(): Triplet {
    const sienne = this.etat.joueurs[HERCULE].main[0];
    const miennes = new Set(this.etat.joueurs[MOI].main);
    const t: Record<string, ElementId> = {};
    t[categorieDe(sienne)!] = sienne;
    for (const [cat, ids] of [
      ['suspect', MANOIR.suspects],
      ['lieu', MANOIR.lieux],
      ['arme', MANOIR.armes],
    ] as const)
      t[cat] ??= ids.find((e) => !miennes.has(e) && !this.etat.joueurs[HERCULE].main.includes(e))!;
    return t as unknown as Triplet;
  }

  etatClient(): EtatClient {
    const e = this.etat;
    return {
      moi: MOI,
      salon: {
        code: 'GUIDE',
        statut: e.etape === 'terminee' ? 'terminee' : 'partie',
        hote: MOI,
        joueurs: e.ordre.map((id) => ({ id, nom: e.joueurs[id].nom, connecte: true, bot: e.joueurs[id].bot, hote: id === MOI, parti: false })),
        messages: this.messages,
        botsAutorises: true,
        reglages: { affaire: 'manoir', dureeTourS: null, modeComplice: 'ruse', historiqueCartes: 'visibles' },
        min: 3,
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
      this.messages = [...this.messages, { id: this.messages.length + 1, auteur: MOI, nom: this.nom, texte, t: Date.now() }];
      this.publier();
      return { ok: true };
    }
    if (ev === 'salon:rejouer') {
      this.etat = nouvelleAffaire(this.nom, this.role);
      this.herculeAInterroge = false;
      this.publier();
      return { ok: true };
    }
    return { ok: false, erreur: 'Indisponible pendant la partie guidée.' };
  }

  arreter() {
    clearInterval(this.boucle);
    if (this.minuteurBot) clearTimeout(this.minuteurBot);
    if (courante === this) courante = null;
  }

  /** Décision d'un bot, avec le coup scénarisé : à son premier tour, Hercule vous interroge. */
  private decision(id: string): ActionJeu | null {
    const e = this.etat;
    if (id === HERCULE && !this.herculeAInterroge && e.etape === 'tour' && e.ordre[e.indexTour] === HERCULE && e.hypothesesCeTour === 0) {
      const mienne = e.joueurs[MOI].main[0];
      const autres = e.joueurs[MARPLE].main;
      const t: Record<string, ElementId> = { [categorieDe(mienne)!]: mienne };
      for (const [cat, ids] of [
        ['suspect', MANOIR.suspects],
        ['lieu', MANOIR.lieux],
        ['arme', MANOIR.armes],
      ] as const)
        t[cat] ??= autres.find((x) => categorieDe(x) === cat) ?? ids.find((x) => !e.joueurs[MOI].main.includes(x))!;
      return { type: 'hypothese', suspect: t.suspect, lieu: t.lieu, arme: t.arme, interroges: [MOI] } as ActionJeu;
    }
    return decisionBot(vuePour(e, id), cryptoRng, PROFIL_OCCASIONNEL);
  }

  figer(gel: boolean) {
    if (gel && this.minuteurBot) {
      clearTimeout(this.minuteurBot);
      this.minuteurBot = null;
    }
    this.gelee = gel;
  }

  private tic() {
    const maintenant = Date.now();
    const ecoule = maintenant - this.dernierTic;
    this.dernierTic = maintenant;
    if (this.gelee) {
      // Le temps ne compte pas pendant la pause : on repousse les échéances d'autant.
      this.etat.echeanceTour += ecoule;
      if (this.etat.hypothese) {
        this.etat.hypothese.echeance += ecoule;
        this.publier();
      }
      return;
    }
    // Complice : la fenêtre de falsification se referme dès que vous avez choisi (ou si vous ne pouvez pas falsifier).
    const h = this.etat.hypothese;
    if (this.role === 'complice' && h?.etape === 'falsification' && !peutFalsifier(this.etat, MOI)) h.echeance = Math.min(h.echeance, Date.now() + 1_500);
    if (avancer(this.etat, Date.now(), cryptoRng)) this.publier();
    if (this.minuteurBot || this.etat.etape === 'terminee') return;
    const bot = BOTS.find((id) => this.decision(id));
    if (!bot) return;
    // Les bots prennent leur temps : on suit ce qu'ils font.
    this.minuteurBot = setTimeout(() => {
      this.minuteurBot = null;
      const action = this.decision(bot);
      if (!action) return;
      const r = appliquerAction(this.etat, bot, action, Date.now());
      if (r.ok && action.type === 'hypothese' && bot === HERCULE) this.herculeAInterroge = true;
      if (!r.ok && this.etat.etape === 'tour' && this.etat.ordre[this.etat.indexTour] === bot) appliquerAction(this.etat, bot, { type: 'finTour' }, Date.now());
      this.publier();
    }, 2_000 + Math.floor(Math.random() * 1_000));
  }
}

let courante: PartieLocale | null = null;

/** Lance la partie guidée (remplace l'écran courant). */
export function lancerPartieGuidee(nom: string, role: RoleGuide = 'enqueteur') {
  const p = new PartieLocale(nom || 'Vous', role);
  courante = p;
  connexion.demarrerLocal(p, p.etatClient());
}

/** Fige ou relance la partie guidée (le guide la fige pendant ses explications). */
export function figerPartieGuidee(gel: boolean) {
  courante?.figer(gel);
}

/** Hypothèse conseillée au premier tour (Hercule aura une carte à montrer). */
export function suggestionPartieGuidee(): Triplet | null {
  return courante?.suggestion() ?? null;
}
