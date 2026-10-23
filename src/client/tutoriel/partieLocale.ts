// Partie guidée : la partie arrangée de scenario.ts, jouée entièrement sur cet appareil (moteur et
// bots du jeu), sans serveur ni salon. Le guide la pilote : il change votre rôle, fait jouer les
// bots d'un coup (avance rapide) ou leur impose un coup précis (coups « scénarisés »).

import { PROFIL_OCCASIONNEL, decisionBot } from '../../bots/bot';
import { appliquerAction, avancer, joueurActif, peutFalsifier, type EtatPartie } from '../../engine/partie';
import { cryptoRng } from '../../engine/rng';
import { vuePour } from '../../engine/vue';
import type { EtatClient, EvenementsClient, MessageChat, Reponse } from '../../shared/protocole';
import type { ActionJeu } from '../../shared/types';
import { connexion, type MoteurLocal } from '../connexion';
import { BOTS, MOI, avanceRapide, creerPartieGuidee, poserMonRole, tourSuivant, type RoleGuide } from './scenario';

export { MOI } from './scenario';

/** Coup imposé à un bot : l'action à jouer maintenant, ou null si le moment n'est pas venu. */
export type CoupScenarise = (etat: EtatPartie) => ActionJeu | null;

/** Où commence la partie guidée : au chapitre donné ; `seul` : ce chapitre uniquement. */
export interface DepartGuide {
  chapitre: number;
  seul: boolean;
}

/** Actions qui « entament » votre tour (après elles, le guide ne garde plus ce tour pour un nouveau chapitre). */
const ACTIONS_DU_TOUR = new Set<ActionJeu['type']>(['hypothese', 'consulterArchive', 'verifierReponses', 'expertiser', 'verifierDossier', 'profiler', 'denoncer']);

export class PartieLocale implements MoteurLocal {
  etat: EtatPartie;
  /** Change à chaque nouvelle partie (le guide relance alors la préparation du chapitre). */
  generation = 0;
  /** Nombre d'observations privées au début du chapitre : le guide regarde ce qui s'est passé depuis. */
  journalDebut = 0;
  /** Ce que le guide retient pour ses textes (dossier trafiqué…). */
  memo: Record<string, number> = {};
  private messages: MessageChat[] = [];
  private boucle: ReturnType<typeof setInterval>;
  private minuteurBot: ReturnType<typeof setTimeout> | null = null;
  private coups = new Map<string, CoupScenarise>();
  /** Votre tour où vous avez déjà agi (numéro du tour). */
  private agiAuTour = -1;
  /** Partie figée par le guide pendant une explication : bots arrêtés, chronos décalés. */
  private gelee = false;
  private dernierTic = Date.now();

  constructor(
    private nom: string,
    readonly depart: DepartGuide,
  ) {
    this.etat = creerPartieGuidee(nom);
    this.boucle = setInterval(() => this.tic(), 250);
  }

  /** Nouvelle partie (pour rejouer un chapitre seul). */
  recommencer() {
    if (this.minuteurBot) clearTimeout(this.minuteurBot);
    this.minuteurBot = null;
    this.etat = creerPartieGuidee(this.nom);
    this.coups.clear();
    this.agiAuTour = -1;
    this.journalDebut = 0;
    this.memo = {};
    this.generation++;
    this.publier();
  }

  // ------------------------------------------------------------------
  // Outils du guide
  // ------------------------------------------------------------------

  /** Le prochain coup de ce bot sera celui-ci (dès que `coup` renvoie une action). */
  scenariser(id: string, coup: CoupScenarise) {
    this.coups.set(id, coup);
  }

  /** Les bots jouent d'un coup jusqu'au tour de `jusqua` (vous par défaut). */
  avanceRapide(jusqua = MOI) {
    avanceRapide(this.etat, (id) => this.decision(id, true), jusqua);
    this.publier();
  }

  /** Votre tour est-il encore intact (aucun point dépensé, aucun pouvoir utilisé) ? */
  tourNeuf(): boolean {
    const e = this.etat;
    return (
      !e.attenteDepart &&
      e.etape === 'tour' &&
      joueurActif(e) === MOI &&
      e.pointsAction === e.config.pointsAction &&
      e.hypothesesCeTour === 0 &&
      this.agiAuTour !== this.numeroTour()
    );
  }

  /**
   * Début d'un chapitre : coups scénarisés oubliés, un tour neuf pour vous (les bots jouent d'abord
   * si le vôtre est entamé ; toujours si `nouveauTour`), puis votre rôle pour ce chapitre.
   * `avant` : réglages à faire avant que les bots jouent (coups scénarisés…) ; `apres` : une fois votre rôle posé.
   */
  preparer(o: { role?: RoleGuide; nouveauTour?: boolean; avant?: (p: PartieLocale) => void; apres?: (p: PartieLocale) => void } = {}) {
    this.coups.clear();
    if (this.etat.etape === 'terminee') this.recommencer();
    if (this.etat.attenteDepart) appliquerAction(this.etat, MOI, { type: 'pret' }, Date.now());
    o.avant?.(this);
    if (o.nouveauTour || !this.tourNeuf()) tourSuivant(this.etat, (id) => this.decision(id, true));
    if (o.role) poserMonRole(this.etat, o.role);
    o.apres?.(this);
    this.journalDebut = this.etat.joueurs[MOI].journal.length;
    this.publier();
  }

  private numeroTour(): number {
    return this.etat.historique.filter((ev) => ev.type === 'debut_tour' && ev.joueur === MOI).length;
  }

  // ------------------------------------------------------------------
  // Moteur local
  // ------------------------------------------------------------------

  etatClient(): EtatClient {
    const e = this.etat;
    return {
      moi: MOI,
      salon: {
        code: 'GUIDE',
        solo: true,
        statut: e.etape === 'terminee' ? 'terminee' : 'partie',
        hote: MOI,
        joueurs: e.ordre.map((id) => ({ id, nom: e.joueurs[id].nom, connecte: true, bot: e.joueurs[id].bot, hote: id === MOI, parti: false })),
        messages: this.messages,
        botsAutorises: true,
        reglages: { affaire: 'manoir', dureeTourS: null, modeComplice: 'ruse', historiqueCartes: 'visibles', mode: 'grande' },
        min: 4,
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
      const action = payload as ActionJeu;
      const r = appliquerAction(this.etat, MOI, action, Date.now());
      if (r.ok && ACTIONS_DU_TOUR.has(action.type)) this.agiAuTour = this.numeroTour();
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
    return { ok: false, erreur: 'Indisponible pendant la partie guidée.' };
  }

  arreter() {
    clearInterval(this.boucle);
    if (this.minuteurBot) clearTimeout(this.minuteurBot);
    if (courante === this) courante = null;
  }

  /**
   * Décision d'un bot : son coup scénarisé s'il y en a un, sinon celle du bot du jeu. Dans la partie
   * guidée, les bots n'accusent pas, ne dénoncent pas, et ne vous interrogent que si le guide le prévoit.
   * `jouer` : la décision sera appliquée (le coup scénarisé est alors consommé).
   */
  private decision(id: string, jouer: boolean): ActionJeu | null {
    const e = this.etat;
    const coup = this.coups.get(id);
    const impose = coup?.(e);
    if (impose) {
      if (jouer) this.coups.delete(id);
      return impose;
    }
    const a = decisionBot(vuePour(e, id), cryptoRng, PROFIL_OCCASIONNEL);
    if (!a) return null;
    const sonTour = e.etape === 'tour' && joueurActif(e) === id;
    if (a.type === 'accuser' || a.type === 'denoncer') return sonTour ? { type: 'finTour' } : null;
    if (a.type === 'hypothese' && a.interroges.includes(MOI)) {
      const libres = BOTS.filter((b) => b !== id && !a.interroges.includes(b));
      return { ...a, interroges: a.interroges.map((x) => (x === MOI ? libres.shift()! : x)) };
    }
    return a;
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
    const e = this.etat;
    if (this.gelee) {
      // Le temps ne compte pas pendant la pause : on repousse les échéances d'autant.
      e.echeanceTour += ecoule;
      if (e.designation) e.designation.echeance += ecoule;
      if (e.hypothese) {
        e.hypothese.echeance += ecoule;
        this.publier();
      }
      return;
    }
    // Complice : la fenêtre de falsification se referme dès que vous avez choisi (ou si vous ne pouvez pas falsifier).
    const h = e.hypothese;
    if (e.complice === MOI && h?.etape === 'falsification' && !peutFalsifier(e, MOI)) h.echeance = Math.min(h.echeance, maintenant + 1_200);
    if (avancer(e, maintenant, cryptoRng)) this.publier();
    if (this.minuteurBot || e.etape === 'terminee') return;
    const bot = BOTS.find((id) => this.decision(id, false));
    if (!bot) return;
    // Les bots prennent un peu leur temps : on suit ce qu'ils font.
    this.minuteurBot = setTimeout(
      () => {
        this.minuteurBot = null;
        const action = this.decision(bot, true);
        if (!action) return;
        const r = appliquerAction(this.etat, bot, action, Date.now());
        if (!r.ok && this.etat.etape === 'tour' && joueurActif(this.etat) === bot) appliquerAction(this.etat, bot, { type: 'finTour' }, Date.now());
        this.publier();
      },
      1_300 + Math.floor(Math.random() * 700),
    );
  }
}

let courante: PartieLocale | null = null;

/** Lance la partie guidée (remplace l'écran courant). */
export function lancerPartieGuidee(nom: string, depart: DepartGuide = { chapitre: 0, seul: false }) {
  const p = new PartieLocale(nom || 'Vous', depart);
  courante = p;
  connexion.demarrerLocal(p, p.etatClient());
}

/** La partie guidée en cours (pour le guide). */
export function partieGuidee(): PartieLocale | null {
  return courante;
}

/** Fige ou relance la partie guidée (le guide la fige pendant ses explications). */
export function figerPartieGuidee(gel: boolean) {
  courante?.figer(gel);
}
