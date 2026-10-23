// Connexion temps réel au serveur et mémorisation de la session.
//
// La session (code du salon + identifiant + jeton secret) est gardée dans le
// sessionStorage de l'onglet : un rafraîchissement de page reconnecte le joueur
// automatiquement, tout en permettant d'ouvrir plusieurs onglets = plusieurs
// joueurs pour tester en local. Une copie est gardée dans le localStorage pour
// proposer « Reprendre ma partie » après fermeture de l'onglet.

import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  type AttentePlace,
  type CompteVue,
  type ConnexionCompte,
  type EtatClient,
  type EvenementsClient,
  type EvenementsServeur,
  type InfoEmplacement,
  type Reponse,
  type Session,
  type TypePartie,
} from '../shared/protocole';
import type { ActionJeu, AffaireId, ChoixAffaire, ModeJeu } from '../shared/types';
import {
  CLE_SESSION_COMPTE,
  definirProfilCompte,
  effacerProfilInvite,
  lireProfil,
  marquerProfilAEnvoyer,
  profilAEnvoyer,
  normaliserProfil,
  profilInvite,
  surChangementProfilCompte,
  type Profil,
} from './profil';

const CLE_SESSION = 'dossier-secret:session';
const CLE_DERNIERE = 'dossier-secret:derniere-session';
/** Dernière sauvegarde chiffrée reçue du serveur (voir src/server/sauvegarde.ts). */
const CLE_SAUVEGARDE = 'dossier-secret:sauvegarde';
const SALON_INCONNU = 'Aucun salon ne correspond';
/** Résumé lisible de la dernière partie (histoire, manche, joueurs) pour l'accueil. */
const CLE_RESUME = 'dossier-secret:resume-partie';
/**
 * Ancien « code joueur » d'appareil (avant les comptes) : à la première connexion à un compte, ses
 * sauvegardes sont reprises par le compte, puis il est oublié.
 */
const CLE_CODE_JOUEUR = 'dossier-secret:code-joueur';
function ancienCodeJoueur(): string | undefined {
  try {
    return localStorage.getItem(CLE_CODE_JOUEUR) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Compte connecté sur cet appareil : pseudonyme et jeton de session. */
interface CompteLocal {
  nom: string;
  jeton: string;
}
function lireCompte(): CompteLocal | null {
  try {
    const c = JSON.parse(localStorage.getItem(CLE_SESSION_COMPTE) ?? 'null') as CompteLocal | null;
    return c && typeof c.nom === 'string' && typeof c.jeton === 'string' ? c : null;
  } catch {
    return null;
  }
}
function ecrireCompte(c: CompteLocal | null) {
  try {
    if (c) localStorage.setItem(CLE_SESSION_COMPTE, JSON.stringify(c));
    else localStorage.removeItem(CLE_SESSION_COMPTE);
  } catch {
    /* stockage indisponible : le compte reste connecté jusqu'à la fermeture de la page */
  }
}

export interface ResumePartie {
  code: string;
  statut: 'lobby' | 'partie';
  affaire: ChoixAffaire;
  manche: number;
  manchesMax: number;
  joueurs: number;
  /** Dernière mise à jour (ms). */
  t: number;
}

/** Résumé de la dernière partie de cet appareil (null si aucun ou illisible). */
export function lireResume(): ResumePartie | null {
  try {
    const r = JSON.parse(localStorage.getItem(CLE_RESUME) ?? 'null') as ResumePartie | null;
    return r && typeof r.code === 'string' && typeof r.t === 'number' ? r : null;
  } catch {
    return null;
  }
}

function ecrireResume(r: ResumePartie | null) {
  try {
    if (r) localStorage.setItem(CLE_RESUME, JSON.stringify(r));
    else localStorage.removeItem(CLE_RESUME);
  } catch {
    /* stockage indisponible */
  }
}

interface SauvegardeLocale {
  code: string;
  sauvegarde: string;
  t: number;
}

/** Fichier de sauvegarde téléchargé par un joueur : sa place (session) et la copie chiffrée du salon. */
interface FichierSauvegarde {
  format: 'dossier-secret';
  version: 1;
  session: Session;
  sauvegarde: string;
  t: number;
}

export type StatutConnexion = 'connexion' | 'connecte' | 'deconnecte';

export interface Instantane {
  statut: StatutConnexion;
  session: Session | null;
  etat: EtatClient | null;
  /** Décalage horloge serveur - horloge locale, en ms. */
  decalage: number;
  expulsion: string | null;
  reprise: boolean;
  /** Partie guidée en cours : la partie tourne sur cet appareil, sans serveur. */
  tutoriel: boolean;
  /** Partie seul contre des bots jouée hors ligne, sur cet appareil. */
  horsLigne: boolean;
  /** Demande de reprise d'une place (autre appareil) en attente d'un joueur présent, ou refusée. */
  demandePlace: (AttentePlace & { refus?: string }) | null;
  /** Le serveur propose les comptes et les emplacements de sauvegarde (null : pas encore connu). */
  comptes: boolean | null;
  /** Compte connecté sur cet appareil. */
  compte: { nom: string } | null;
}

/**
 * Moteur de partie local (partie guidée). Quand il est branché, les demandes de jeu ne partent
 * pas au serveur : il les traite lui-même et publie l'état avec `connexion.majLocale`.
 */
export interface MoteurLocal {
  envoyer(ev: keyof EvenementsClient, payload: unknown): Reponse<object>;
  arreter(): void;
}

function lire(stockage: Storage, cle: string): Session | null {
  try {
    const brut = stockage.getItem(cle);
    if (!brut) return null;
    const s = JSON.parse(brut) as Session;
    return typeof s.code === 'string' && typeof s.jeton === 'string' && typeof s.joueurId === 'string' ? s : null;
  } catch {
    return null;
  }
}

/** Au-delà, le serveur refuse la sauvegarde (voir DUREE_VALIDITE_MS côté serveur) : on l'efface. */
const VALIDITE_SAUVEGARDE_MS = 7 * 24 * 3600 * 1000;

/**
 * Une seule sauvegarde par appareil : chaque nouvelle copie remplace la précédente. Elle est effacée
 * quand on quitte la partie, quand la partie se termine, ou au bout de 7 jours.
 */
function lireSauvegarde(): SauvegardeLocale | null {
  try {
    const s = JSON.parse(localStorage.getItem(CLE_SAUVEGARDE) ?? 'null') as SauvegardeLocale | null;
    if (!s || typeof s.code !== 'string' || typeof s.sauvegarde !== 'string') return null;
    if (!(Date.now() - s.t < VALIDITE_SAUVEGARDE_MS)) {
      ecrireSauvegarde(null);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function ecrireSauvegarde(s: SauvegardeLocale | null) {
  try {
    if (s) localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(s));
    else localStorage.removeItem(CLE_SAUVEGARDE);
  } catch {
    /* stockage plein ou indisponible : pas de sauvegarde sur cet appareil */
  }
}

function ecrire(stockage: Storage, cle: string, s: Session | null) {
  try {
    if (s) stockage.setItem(cle, JSON.stringify(s));
    else stockage.removeItem(cle);
  } catch {
    /* stockage indisponible (navigation privée) : la session reste en mémoire */
  }
}

/**
 * Le serveur annonce la version du client qu'il sert. Si cette page est plus ancienne (ouverte avant
 * une mise à jour), on la recharge : la session est reprise automatiquement. Une seule tentative par
 * version, pour ne jamais boucler.
 */
function verifierVersion(versionServeur: string) {
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  const versionPage = /index-[\w-]+\.js/.exec(script?.src ?? '')?.[0];
  if (!versionPage || versionPage === versionServeur) return; // développement, ou déjà à jour
  try {
    if (sessionStorage.getItem('dossier-secret:version-rechargee') === versionServeur) return;
    sessionStorage.setItem('dossier-secret:version-rechargee', versionServeur);
  } catch {
    return; // sans stockage, on ne peut pas éviter une boucle : on ne recharge pas
  }
  location.reload();
}

class Connexion {
  private socket: Socket<EvenementsServeur, EvenementsClient>;
  private abonnes = new Set<() => void>();
  private etat: Instantane = {
    statut: 'connexion',
    session: typeof sessionStorage !== 'undefined' ? lire(sessionStorage, CLE_SESSION) : null,
    etat: null,
    decalage: 0,
    expulsion: null,
    reprise: false,
    tutoriel: false,
    horsLigne: false,
    demandePlace: null,
    comptes: null,
    compte: typeof localStorage !== 'undefined' && lireCompte() ? { nom: lireCompte()!.nom } : null,
  };
  private local: MoteurLocal | null = null;

  constructor() {
    if (typeof localStorage !== 'undefined') lireSauvegarde(); // efface une sauvegarde périmée
    this.etat.reprise = this.etat.session !== null;
    this.socket = io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
    this.socket.on('connect', () => {
      this.maj({ statut: 'connecte' });
      void this.reprendreCompte();
      // Reconnexion automatique (rafraîchissement, coupure réseau, mise en veille du téléphone).
      if (this.etat.session && !this.etat.expulsion && !this.local) void this.reprendre(this.etat.session);
    });
    this.socket.on('disconnect', () => {
      // Le serveur oublie la demande de place quand la connexion coupe : il faudra la renvoyer.
      const d = this.etat.demandePlace;
      this.maj({ statut: 'deconnecte', demandePlace: d && !d.refus ? { ...d, refus: 'La connexion au serveur a été coupée : renvoyez votre demande.' } : d });
    });
    this.socket.on('connect_error', () => this.maj({ statut: 'deconnecte' }));
    this.socket.on('etat', (e) => {
      if (this.local) return;
      // Partie terminée : la sauvegarde de cet appareil ne sert plus, on l'efface.
      if (e.salon.statut === 'terminee' && lireSauvegarde()?.code === e.salon.code) ecrireSauvegarde(null);
      // Résumé pour la carte « Partie en cours » de l'accueil (effacé quand la partie est finie).
      if (e.salon.statut === 'terminee') ecrireResume(null);
      else
        ecrireResume({
          code: e.salon.code,
          statut: e.salon.statut,
          affaire: e.partie?.affaire ?? e.salon.reglages.affaire,
          manche: e.partie?.manche ?? 0,
          manchesMax: e.partie?.regles.manchesMax ?? 12,
          joueurs: e.salon.joueurs.length,
          t: Date.now(),
        });
      this.maj({ etat: e, decalage: e.heureServeur - Date.now() });
    });
    this.socket.on('expulse', ({ raison }) => {
      this.maj({ expulsion: raison, etat: null });
    });
    this.socket.on('version', verifierVersion);
    this.socket.on('capacites', (c) => this.maj({ comptes: c.comptes }));
    // Profil du compte : chaque changement (partie terminée, remise à zéro) part au serveur.
    // Sans connexion (partie hors ligne), il partira à la prochaine connexion.
    surChangementProfilCompte((p) => void this.envoyer('compte:profil', { profil: p }).then((r) => marquerProfilAEnvoyer(!r.ok)));
    // Copie chiffrée du salon, gardée sur l'appareil : elle permet de le reprendre si le serveur redémarre.
    // Réponse à une demande de place : la session de ce joueur (nouveau jeton), ou un refus.
    this.socket.on('place', (p) => {
      const d = this.etat.demandePlace;
      if (!d) return;
      if ('session' in p) {
        this.maj({ demandePlace: null });
        void this.reprendre(p.session);
      } else this.maj({ demandePlace: { ...d, refus: p.refus } });
    });
    this.socket.on('sauvegarde', ({ code, sauvegarde }) => {
      if (!this.local && this.etat.session?.code === code) ecrireSauvegarde({ code, sauvegarde, t: Date.now() });
    });
  }

  /** Sauvegarde gardée sur cet appareil pour ce salon (ou le salon courant). */
  sauvegardeLocale(code = this.etat.session?.code): SauvegardeLocale | null {
    const s = lireSauvegarde();
    return s && s.code === code ? s : null;
  }

  /** Renvoie une sauvegarde au serveur pour qu'il recrée le salon (sans effet s'il existe encore). */
  private async restaurer(sauvegarde: string): Promise<Reponse<{ code: string; restaure: boolean }>> {
    try {
      const r = await fetch('/api/restaurer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sauvegarde }) });
      return (await r.json()) as Reponse<{ code: string; restaure: boolean }>;
    } catch {
      return { ok: false, erreur: 'Le serveur ne répond pas. Réessayez dans un instant.' };
    }
  }

  /** Télécharge un fichier de sauvegarde de la partie en cours (à garder pour la reprendre plus tard ou ailleurs). */
  telechargerSauvegarde(): boolean {
    const s = this.etat.session;
    const sauv = this.sauvegardeLocale();
    if (!s || !sauv || this.local) return false;
    const fichier: FichierSauvegarde = { format: 'dossier-secret', version: 1, session: s, sauvegarde: sauv.sauvegarde, t: sauv.t };
    const url = URL.createObjectURL(new Blob([JSON.stringify(fichier)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Nuit-Blanche-${s.code}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  }

  /** Reprend une partie depuis un fichier de sauvegarde (le salon est recréé s'il n'existe plus). */
  async reprendreFichier(texte: string): Promise<Reponse> {
    let f: FichierSauvegarde;
    try {
      f = JSON.parse(texte) as FichierSauvegarde;
    } catch {
      return { ok: false, erreur: "Ce fichier n'est pas une sauvegarde de Nuit Blanche." };
    }
    if (f?.format !== 'dossier-secret' || typeof f.sauvegarde !== 'string' || typeof f.session?.code !== 'string' || typeof f.session?.jeton !== 'string')
      return { ok: false, erreur: "Ce fichier n'est pas une sauvegarde de Nuit Blanche." };
    const r = await this.restaurer(f.sauvegarde);
    if (!r.ok) return r;
    ecrireSauvegarde({ code: f.session.code, sauvegarde: f.sauvegarde, t: f.t });
    return this.reprendre(f.session);
  }

  abonner = (f: () => void) => {
    this.abonnes.add(f);
    return () => this.abonnes.delete(f);
  };

  instantane = () => this.etat;

  private maj(partiel: Partial<Instantane>) {
    this.etat = { ...this.etat, ...partiel };
    for (const f of this.abonnes) f();
  }

  private envoyer<T extends object>(ev: keyof EvenementsClient, payload: unknown): Promise<Reponse<T>> {
    // Partie locale : le jeu est traité sur l'appareil ; le compte, lui, reste sur le serveur.
    if (this.local && !ev.startsWith('compte:')) return Promise.resolve(this.local.envoyer(ev, payload) as Reponse<T>);
    return new Promise((resolve) => {
      if (!this.socket.connected) {
        resolve({ ok: false, erreur: 'Connexion au serveur perdue. Nouvelle tentative en cours…' });
        return;
      }
      const minuteur = setTimeout(() => resolve({ ok: false, erreur: 'Le serveur ne répond pas. Réessayez.' }), 8000);
      (this.socket.emit as (...a: unknown[]) => void)(ev, payload, (r: Reponse<T>) => {
        clearTimeout(minuteur);
        resolve(r);
      });
    });
  }

  private memoriser(s: Session | null) {
    ecrire(sessionStorage, CLE_SESSION, s);
    if (s) ecrire(localStorage, CLE_DERNIERE, s);
    this.maj({ session: s, expulsion: null });
  }

  derniereSession(): Session | null {
    return typeof localStorage !== 'undefined' ? lire(localStorage, CLE_DERNIERE) : null;
  }

  oublierDerniereSession() {
    ecrire(localStorage, CLE_DERNIERE, null);
    this.maj({});
  }

  async creer(nom: string) {
    const r = await this.envoyer<{ session: Session }>('salon:creer', { nom });
    if (r.ok) this.memoriser(r.session);
    return r;
  }

  async solo(
    nom: string,
    bots: number,
    dureeTourS: number | null,
    modeComplice: 'classique' | 'ruse',
    affaire: ChoixAffaire,
    historiqueCartes: 'visibles' | 'anonymes' = 'visibles',
    mode: ModeJeu = 'classique',
  ) {
    const r = await this.envoyer<{ session: Session }>('salon:solo', { nom, bots, dureeTourS, modeComplice, affaire, historiqueCartes, mode });
    if (r.ok) this.memoriser(r.session);
    return r;
  }

  /** Rejoint un salon ; pendant une partie, demande à reprendre la place du joueur qui a ce pseudonyme. */
  async rejoindre(code: string, nom: string) {
    const r = await this.envoyer<{ session: Session } | { attente: AttentePlace }>('salon:rejoindre', { code, nom });
    if (r.ok && 'attente' in r) this.maj({ demandePlace: r.attente });
    else if (r.ok) this.memoriser(r.session);
    return r;
  }

  /** Abandonne la demande de place (ou ferme l'écran après un refus). */
  annulerDemande() {
    if (this.etat.demandePlace && !this.etat.demandePlace.refus) void this.envoyer('salon:annulerDemande', {});
    this.maj({ demandePlace: null });
  }

  async reprendre(s: Session) {
    this.maj({ reprise: true });
    let r = await this.envoyer<{ session: Session }>('salon:reprendre', { code: s.code, jeton: s.jeton });
    // Le salon n'existe plus (le serveur a redémarré) : on le recrée depuis la sauvegarde gardée ici.
    const sauv = !r.ok && r.erreur.startsWith(SALON_INCONNU) ? this.sauvegardeLocale(s.code) : null;
    if (sauv && (await this.restaurer(sauv.sauvegarde)).ok) r = await this.envoyer<{ session: Session }>('salon:reprendre', { code: s.code, jeton: s.jeton });
    if (r.ok) this.memoriser(r.session);
    else if (this.socket.connected) {
      // Session expirée (salon supprimé, joueur retiré…) : on l'oublie.
      ecrire(sessionStorage, CLE_SESSION, null);
      const derniere = this.derniereSession();
      if (derniere?.jeton === s.jeton) ecrire(localStorage, CLE_DERNIERE, null);
      this.maj({ session: null, etat: null });
    }
    this.maj({ reprise: false });
    return r;
  }

  /**
   * Branche une partie locale (partie guidée, ou partie hors ligne contre des bots) : rien n'est
   * envoyé au serveur, le moteur local traite tout.
   */
  demarrerLocal(moteur: MoteurLocal, etat: EtatClient, options: { tutoriel?: boolean } = {}) {
    const tutoriel = options.tutoriel ?? true;
    this.local?.arreter();
    this.local = moteur;
    this.maj({ session: { code: etat.salon.code, joueurId: etat.moi, jeton: '' }, etat, decalage: 0, expulsion: null, tutoriel, horsLigne: !tutoriel });
  }

  majLocale(etat: EtatClient) {
    if (this.local) this.maj({ etat });
  }

  arreterLocal() {
    this.local?.arreter();
    this.local = null;
    this.maj({ session: null, etat: null, tutoriel: false, horsLigne: false });
  }

  async quitter() {
    if (this.local) {
      this.arreterLocal();
      return { ok: true } as Reponse<{ ferme: boolean }>;
    }
    const r = await this.envoyer<{ ferme: boolean }>('salon:quitter', {});
    ecrire(sessionStorage, CLE_SESSION, null);
    ecrire(localStorage, CLE_DERNIERE, null);
    ecrireSauvegarde(null);
    ecrireResume(null);
    this.maj({ session: null, etat: null, expulsion: null });
    return r;
  }

  /** Abandonne l'onglet expulsé (la session continue ailleurs). */
  fermerSessionLocale() {
    ecrire(sessionStorage, CLE_SESSION, null);
    this.maj({ session: null, etat: null, expulsion: null });
  }

  // ---------------- Compte (pseudonyme + mot de passe) ----------------

  /** À chaque connexion au serveur, l'appareil présente son jeton de compte ; un jeton périmé est oublié. */
  private async reprendreCompte() {
    const c = lireCompte();
    if (!c) return;
    const r = await this.envoyer<{ compte: CompteVue | null }>('compte:reprendre', { jeton: c.jeton });
    if (!r.ok) return; // serveur momentanément sans base : on garde le compte pour la prochaine fois
    if (!r.compte) return this.oublierCompte();
    if (profilAEnvoyer()) {
      // Des parties ont été jouées hors ligne : la copie de l'appareil est la plus récente.
      const local = lireProfil();
      const envoi = await this.envoyer('compte:profil', { profil: local });
      marquerProfilAEnvoyer(!envoi.ok);
    } else definirProfilCompte(normaliserProfil(r.compte.profil));
    this.maj({ compte: { nom: r.compte.nom } });
  }

  private ouvrirCompte(r: ConnexionCompte, profil: Profil) {
    ecrireCompte({ nom: r.compte.nom, jeton: r.jeton });
    marquerProfilAEnvoyer(false);
    definirProfilCompte(profil);
    // Les sauvegardes de l'ancien code joueur ont été reprises par le compte.
    try {
      localStorage.removeItem(CLE_CODE_JOUEUR);
    } catch {
      /* rien */
    }
    this.maj({ compte: { nom: r.compte.nom } });
  }

  private oublierCompte() {
    marquerProfilAEnvoyer(false);
    ecrireCompte(null);
    definirProfilCompte(null);
    this.maj({ compte: null });
  }

  /** Création : le profil sans compte de l'appareil (grade, succès) devient celui du compte. */
  async creerCompte(nom: string, motDePasse: string) {
    const invite = profilInvite();
    const r = await this.envoyer<ConnexionCompte>('compte:creer', {
      nom,
      motDePasse,
      profil: invite.parties > 0 ? invite : undefined,
      codeJoueur: ancienCodeJoueur(),
    });
    if (r.ok) {
      this.ouvrirCompte(r, invite);
      effacerProfilInvite();
    }
    return r;
  }

  /** Connexion : le profil du compte remplace, sur cet appareil, le profil sans compte (qui revient à la déconnexion). */
  async connecterCompte(nom: string, motDePasse: string) {
    const r = await this.envoyer<ConnexionCompte>('compte:connecter', { nom, motDePasse, codeJoueur: ancienCodeJoueur() });
    if (r.ok) this.ouvrirCompte(r, normaliserProfil(r.compte.profil));
    return r;
  }

  /** Mot de passe oublié : code de secours + nouveau mot de passe (un nouveau code de secours est donné). */
  async recupererCompte(nom: string, codeSecours: string, motDePasse: string) {
    const r = await this.envoyer<ConnexionCompte>('compte:recuperer', { nom, codeSecours, motDePasse });
    if (r.ok) this.ouvrirCompte(r, normaliserProfil(r.compte.profil));
    return r;
  }

  async deconnecterCompte() {
    await this.envoyer('compte:deconnecter', {});
    this.oublierCompte();
  }

  changerMotDePasse = (ancien: string, nouveau: string) => this.envoyer('compte:motDePasse', { ancien, nouveau });

  /** Nouveau pseudonyme du compte : il sert désormais à se connecter et à jouer. */
  async renommerCompte(nom: string, motDePasse: string) {
    const r = await this.envoyer<{ compte: CompteVue }>('compte:renommer', { nom, motDePasse });
    const c = lireCompte();
    if (r.ok && c) {
      ecrireCompte({ ...c, nom: r.compte.nom });
      this.maj({ compte: { nom: r.compte.nom } });
    }
    return r;
  }

  async supprimerCompte(motDePasse: string) {
    const r = await this.envoyer('compte:supprimer', { motDePasse });
    if (r.ok) this.oublierCompte();
    return r;
  }

  // ---------------- Emplacements de sauvegarde du compte (3 solo + 3 multijoueur) ----------------
  listerEmplacements = () => this.envoyer<{ emplacements: InfoEmplacement[] }>('emplacements:lister', {});
  enregistrerEmplacement = (numero: number) => this.envoyer<{ emplacement: InfoEmplacement }>('emplacements:enregistrer', { numero });
  effacerEmplacement = (type: TypePartie, numero: number) => this.envoyer('emplacements:effacer', { type, numero });
  async chargerEmplacement(type: TypePartie, numero: number) {
    const r = await this.envoyer<{ session: Session }>('emplacements:charger', { type, numero });
    if (r.ok) this.memoriser(r.session);
    return r;
  }


  demarrer = () => this.envoyer('salon:demarrer', {});
  rejouer = () => this.envoyer('salon:rejouer', {});
  ajouterBot = () => this.envoyer('salon:ajouterBot', {});
  retirer = (joueurId: string) => this.envoyer('salon:retirer', { joueurId });
  remplacerParBot = (joueurId: string) => this.envoyer('salon:remplacer', { joueurId });
  continuerSans = (joueurId: string) => this.envoyer('salon:continuerSans', { joueurId });
  repondrePlace = (demandeId: string, accepter: boolean) => this.envoyer('salon:repondrePlace', { demandeId, accepter });
  message = (texte: string) => this.envoyer('salon:message', { texte });
  reglerDureeTour = (dureeTourS: number | null) => this.envoyer('salon:reglages', { dureeTourS });
  reglerModeComplice = (modeComplice: 'classique' | 'ruse') => this.envoyer('salon:reglages', { modeComplice });
  reglerHistoriqueCartes = (historiqueCartes: 'visibles' | 'anonymes') => this.envoyer('salon:reglages', { historiqueCartes });
  reglerAffaire = (affaire: ChoixAffaire) => this.envoyer('salon:reglages', { affaire });
  reglerMode = (mode: ModeJeu) => this.envoyer('salon:reglages', { mode });
  action = (a: ActionJeu) => this.envoyer('jeu:action', a);
}

export const connexion = new Connexion();

export function useConnexion(): Instantane {
  return useSyncExternalStore(connexion.abonner, connexion.instantane);
}
