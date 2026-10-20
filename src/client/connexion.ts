// Connexion temps réel au serveur et mémorisation de la session.
//
// La session (code du salon + identifiant + jeton secret) est gardée dans le
// sessionStorage de l'onglet : un rafraîchissement de page reconnecte le joueur
// automatiquement, tout en permettant d'ouvrir plusieurs onglets = plusieurs
// joueurs pour tester en local. Une copie est gardée dans le localStorage pour
// proposer « Reprendre ma partie » après fermeture de l'onglet.

import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { EtatClient, EvenementsClient, EvenementsServeur, Reponse, Session } from '../shared/protocole';
import type { ActionJeu } from '../shared/types';

const CLE_SESSION = 'dossier-secret:session';
const CLE_DERNIERE = 'dossier-secret:derniere-session';

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
  };
  private local: MoteurLocal | null = null;

  constructor() {
    this.etat.reprise = this.etat.session !== null;
    this.socket = io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
    this.socket.on('connect', () => {
      this.maj({ statut: 'connecte' });
      // Reconnexion automatique (rafraîchissement, coupure réseau, mise en veille du téléphone).
      if (this.etat.session && !this.etat.expulsion && !this.local) void this.reprendre(this.etat.session);
    });
    this.socket.on('disconnect', () => this.maj({ statut: 'deconnecte' }));
    this.socket.on('connect_error', () => this.maj({ statut: 'deconnecte' }));
    this.socket.on('etat', (e) => {
      if (!this.local) this.maj({ etat: e, decalage: e.heureServeur - Date.now() });
    });
    this.socket.on('expulse', ({ raison }) => {
      this.maj({ expulsion: raison, etat: null });
    });
    this.socket.on('version', verifierVersion);
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
    if (this.local) return Promise.resolve(this.local.envoyer(ev, payload) as Reponse<T>);
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

  async rejoindre(code: string, nom: string) {
    const r = await this.envoyer<{ session: Session }>('salon:rejoindre', { code, nom });
    if (r.ok) this.memoriser(r.session);
    return r;
  }

  async reprendre(s: Session) {
    this.maj({ reprise: true });
    const r = await this.envoyer<{ session: Session }>('salon:reprendre', { code: s.code, jeton: s.jeton });
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

  /** Branche une partie locale (partie guidée) : rien n'est envoyé au serveur ni mémorisé. */
  demarrerLocal(moteur: MoteurLocal, etat: EtatClient) {
    this.local?.arreter();
    this.local = moteur;
    this.maj({ session: { code: etat.salon.code, joueurId: etat.moi, jeton: '' }, etat, decalage: 0, expulsion: null, tutoriel: true });
  }

  majLocale(etat: EtatClient) {
    if (this.local) this.maj({ etat });
  }

  arreterLocal() {
    this.local?.arreter();
    this.local = null;
    this.maj({ session: null, etat: null, tutoriel: false });
  }

  async quitter() {
    if (this.local) {
      this.arreterLocal();
      return { ok: true } as Reponse<{ ferme: boolean }>;
    }
    const r = await this.envoyer<{ ferme: boolean }>('salon:quitter', {});
    ecrire(sessionStorage, CLE_SESSION, null);
    ecrire(localStorage, CLE_DERNIERE, null);
    this.maj({ session: null, etat: null, expulsion: null });
    return r;
  }

  /** Abandonne l'onglet expulsé (la session continue ailleurs). */
  fermerSessionLocale() {
    ecrire(sessionStorage, CLE_SESSION, null);
    this.maj({ session: null, etat: null, expulsion: null });
  }

  demarrer = () => this.envoyer('salon:demarrer', {});
  rejouer = () => this.envoyer('salon:rejouer', {});
  ajouterBot = () => this.envoyer('salon:ajouterBot', {});
  retirer = (joueurId: string) => this.envoyer('salon:retirer', { joueurId });
  remplacerParBot = (joueurId: string) => this.envoyer('salon:remplacer', { joueurId });
  continuerSans = (joueurId: string) => this.envoyer('salon:continuerSans', { joueurId });
  message = (texte: string) => this.envoyer('salon:message', { texte });
  reglerDureeTour = (dureeTourS: number | null) => this.envoyer('salon:reglages', { dureeTourS });
  reglerModeComplice = (modeComplice: 'classique' | 'ruse') => this.envoyer('salon:reglages', { modeComplice });
  reglerHistoriqueCartes = (historiqueCartes: 'visibles' | 'anonymes') => this.envoyer('salon:reglages', { historiqueCartes });
  action = (a: ActionJeu) => this.envoyer('jeu:action', a);
}

export const connexion = new Connexion();

export function useConnexion(): Instantane {
  return useSyncExternalStore(connexion.abonner, connexion.instantane);
}
