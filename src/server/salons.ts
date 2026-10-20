// Gestion des salons privés : création, codes d'invitation, identités, hôte,
// démarrage des parties, reconnexion. Aucune dépendance réseau : testable seul.

import { createHash, randomBytes } from 'node:crypto';
import { CONFIG_PAR_DEFAUT, JOUEURS_MAX, JOUEURS_MIN, REGLES_INITIALES, type ConfigPartie } from '../engine/config';
import {
  abandonner,
  appliquerAction,
  avancer,
  continuerSans,
  creerPartie,
  definirConnexion,
  majPause,
  recalerEcheances,
  remplacerParBot,
  reprendreSiege,
  type EtatPartie,
} from '../engine/partie';
import { cryptoRng, type Rng } from '../engine/rng';
import { vuePour } from '../engine/vue';
import { ALPHABET_CODE, LONGUEUR_CODE, MESSAGE_MAX, PSEUDO_MAX, type EtatClient, type MessageChat, type ReglagesSalon, type SalonVue } from '../shared/protocole';
import type { ActionJeu } from '../shared/types';

export class ErreurJeu extends Error {}

export interface JoueurSalon {
  id: string;
  nom: string;
  jetonHash: string;
  bot: boolean;
  connecte: boolean;
  rejointLe: number;
  deconnecteLe: number | null;
  /** A quitté volontairement la partie en cours. */
  parti?: boolean;
  /** Humain absent remplacé par un bot : il retrouve sa place s'il revient avec son jeton. */
  remplaceParBot?: boolean;
}

export interface Salon {
  code: string;
  hote: string;
  joueurs: JoueurSalon[];
  statut: 'lobby' | 'partie' | 'terminee';
  partie: EtatPartie | null;
  numeroPartie: number;
  reglages: ReglagesSalon;
  messages: MessageChat[];
  compteurMessages: number;
  creeLe: number;
  majLe: number;
}

export interface OptionsGestionnaire {
  now?: () => number;
  rng?: Rng;
  configPartie?: Partial<ConfigPartie>;
  botsAutorises?: boolean;
  /** Délai avant de transférer le rôle d'hôte si l'hôte reste déconnecté. */
  graceHoteMs?: number;
  /** Un joueur déconnecté depuis ce délai dans le lobby est retiré du salon. */
  expulsionLobbyMs?: number;
  /** Un salon sans aucun humain connecté depuis ce délai est supprimé. */
  suppressionSalonMs?: number;
}

const NOMS_BOTS = ['Hercule', 'Marple', 'Maigret', 'Rouletabille', 'Lupin', 'Holmes', 'Dupin', 'Vidocq'];

export function hacher(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

/** Caractères de contrôle et caractères invisibles ou de mise en page interdits dans un pseudonyme. */
const CARACTERES_INVISIBLES = new RegExp('[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e]', 'g');

export function normaliserPseudo(brut: unknown): string {
  if (typeof brut !== 'string') throw new ErreurJeu('Pseudonyme invalide.');
  // Supprime les caractères de contrôle et les espaces superflus.
  const nom = brut.replace(CARACTERES_INVISIBLES, '').replace(/\s+/g, ' ').trim();
  if (nom.length === 0) throw new ErreurJeu('Choisissez un pseudonyme.');
  if (nom.length > PSEUDO_MAX) throw new ErreurJeu(`Le pseudonyme est limité à ${PSEUDO_MAX} caractères.`);
  return nom;
}

export function normaliserCode(brut: unknown): string {
  if (typeof brut !== 'string') throw new ErreurJeu("Code d'invitation invalide.");
  const code = brut.trim().toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== LONGUEUR_CODE || [...code].some((c) => !ALPHABET_CODE.includes(c)))
    throw new ErreurJeu(`Le code d'invitation comporte ${LONGUEUR_CODE} caractères (lettres et chiffres).`);
  return code;
}

export class GestionnaireSalons {
  readonly salons = new Map<string, Salon>();
  private readonly now: () => number;
  private readonly rng: Rng;
  readonly botsAutorises: boolean;
  private readonly opts: Required<Pick<OptionsGestionnaire, 'graceHoteMs' | 'expulsionLobbyMs' | 'suppressionSalonMs'>>;
  configPartie: Partial<ConfigPartie>;

  constructor(o: OptionsGestionnaire = {}) {
    this.now = o.now ?? Date.now;
    this.rng = o.rng ?? cryptoRng;
    this.configPartie = o.configPartie ?? {};
    this.botsAutorises = o.botsAutorises ?? true;
    this.opts = {
      graceHoteMs: o.graceHoteMs ?? 30_000,
      expulsionLobbyMs: o.expulsionLobbyMs ?? 120_000,
      suppressionSalonMs: o.suppressionSalonMs ?? 2 * 60 * 60_000,
    };
  }

  // -------------------------------------------------------------------------
  // Identité
  // -------------------------------------------------------------------------

  private nouvelId(): string {
    return randomBytes(9).toString('base64url');
  }

  private nouveauJeton(): { jeton: string; hash: string } {
    const jeton = randomBytes(24).toString('base64url');
    return { jeton, hash: hacher(jeton) };
  }

  private nouveauCode(): string {
    for (let i = 0; i < 1000; i++) {
      let code = '';
      for (let k = 0; k < LONGUEUR_CODE; k++) code += ALPHABET_CODE[this.rng.int(ALPHABET_CODE.length)];
      if (!this.salons.has(code)) return code;
    }
    throw new ErreurJeu('Impossible de créer un salon pour le moment.');
  }

  private reglagesParDefaut(): ReglagesSalon {
    const ms = this.configPartie.delaiTourMs;
    return { dureeTourS: ms === null ? null : Math.round((ms ?? 180_000) / 1000), modeComplice: this.configPartie.modeComplice ?? 'ruse' };
  }

  salon(code: string): Salon {
    const s = this.salons.get(normaliserCode(code));
    if (!s) throw new ErreurJeu("Aucun salon ne correspond à ce code.");
    return s;
  }

  private joueur(s: Salon, id: string): JoueurSalon {
    const j = s.joueurs.find((x) => x.id === id);
    if (!j) throw new ErreurJeu("Vous ne faites pas partie de ce salon.");
    return j;
  }

  private toucher(s: Salon) {
    s.majLe = this.now();
  }

  // -------------------------------------------------------------------------
  // Création, arrivée, reconnexion, départ
  // -------------------------------------------------------------------------

  creer(nomBrut: unknown) {
    const nom = normaliserPseudo(nomBrut);
    const code = this.nouveauCode();
    const t = this.now();
    const { jeton, hash } = this.nouveauJeton();
    const joueur: JoueurSalon = { id: this.nouvelId(), nom, jetonHash: hash, bot: false, connecte: true, rejointLe: t, deconnecteLe: null };
    const salon: Salon = {
      code,
      hote: joueur.id,
      joueurs: [joueur],
      statut: 'lobby',
      partie: null,
      numeroPartie: 0,
      reglages: this.reglagesParDefaut(),
      messages: [],
      compteurMessages: 0,
      creeLe: t,
      majLe: t,
    };
    this.salons.set(code, salon);
    return { salon, joueur, jeton };
  }

  rejoindre(codeBrut: unknown, nomBrut: unknown) {
    const s = this.salon(codeBrut as string);
    const nom = normaliserPseudo(nomBrut);
    if (s.statut !== 'lobby') throw new ErreurJeu('La partie a déjà commencé : ce salon n\'accepte plus de nouveaux joueurs.');
    if (s.joueurs.length >= JOUEURS_MAX) throw new ErreurJeu(`Ce salon est complet (${JOUEURS_MAX} joueurs maximum).`);
    if (s.joueurs.some((j) => j.nom.toLocaleLowerCase('fr') === nom.toLocaleLowerCase('fr')))
      throw new ErreurJeu('Ce pseudonyme est déjà utilisé dans ce salon.');
    const { jeton, hash } = this.nouveauJeton();
    const joueur: JoueurSalon = { id: this.nouvelId(), nom, jetonHash: hash, bot: false, connecte: true, rejointLe: this.now(), deconnecteLe: null };
    s.joueurs.push(joueur);
    this.toucher(s);
    return { salon: s, joueur, jeton };
  }

  /** Reconnexion avec le jeton secret remis lors de l'arrivée dans le salon. */
  reprendre(codeBrut: unknown, jeton: unknown) {
    const s = this.salon(codeBrut as string);
    if (typeof jeton !== 'string' || jeton.length < 10 || jeton.length > 100) throw new ErreurJeu('Session invalide.');
    const h = hacher(jeton);
    const joueur = s.joueurs.find((j) => (!j.bot || j.remplaceParBot) && j.jetonHash === h);
    if (!joueur) throw new ErreurJeu('Session expirée ou invalide : rejoignez le salon à nouveau.');
    if (joueur.remplaceParBot) {
      // Remplacé par un bot pendant son absence : il reprend sa place, le bot s'efface.
      joueur.bot = false;
      joueur.remplaceParBot = false;
      joueur.connecte = false; // la connexion du joueur la rétablit juste après
      joueur.deconnecteLe = this.now();
      // Côté partie, il reste « connecté » : pas de second message « est de retour » dans l'historique.
      if (s.partie) reprendreSiege(s.partie, joueur.id, this.now());
      this.toucher(s);
    }
    return { salon: s, joueur };
  }

  definirConnexion(code: string, id: string, connecte: boolean) {
    const s = this.salons.get(code);
    if (!s) return;
    const j = s.joueurs.find((x) => x.id === id);
    if (!j || j.connecte === connecte) return;
    j.connecte = connecte;
    j.deconnecteLe = connecte ? null : this.now();
    if (connecte) j.parti = false;
    if (s.partie) definirConnexion(s.partie, id, connecte, this.now());
    this.toucher(s);
  }

  /** Humains encore présents dans le salon (connectés et pas partis), hors `sauf`. */
  humainsPresents(s: Salon, sauf?: string): JoueurSalon[] {
    return s.joueurs.filter((j) => !j.bot && !j.parti && j.connecte && j.id !== sauf);
  }

  /**
   * Le joueur quitte le salon. Retourne `{ ferme: true }` si c'était le dernier joueur
   * présent : le salon est alors fermé (et la partie éventuelle terminée).
   */
  quitter(code: string, id: string): { ferme: boolean } {
    const s = this.salon(code);
    const j = this.joueur(s, id);
    const dernier = this.humainsPresents(s, id).length === 0;
    if (dernier) {
      this.salons.delete(s.code);
      return { ferme: true };
    }
    if (s.statut === 'lobby') {
      s.joueurs = s.joueurs.filter((x) => x.id !== id);
    } else {
      // En cours de partie, la place est conservée (cartes et rôle intacts),
      // mais ses tours et ses réponses passent automatiquement.
      j.connecte = false;
      j.parti = true;
      j.deconnecteLe = this.now();
      if (s.partie) abandonner(s.partie, id, this.now());
    }
    if (s.hote === id) this.transfererHote(s);
    this.toucher(s);
    return { ferme: false };
  }

  /** Un joueur présent remplace un joueur absent par un bot (partie en cours). */
  remplacerParBot(code: string, id: string, cible: string) {
    const s = this.salon(code);
    this.joueur(s, id);
    if (!this.botsAutorises) throw new ErreurJeu('Les joueurs automatiques sont désactivés sur ce serveur.');
    const j = this.absentRemplacable(s, id, cible);
    const r = remplacerParBot(s.partie!, cible, this.now());
    if (!r.ok) throw new ErreurJeu(r.erreur);
    j.bot = true;
    j.remplaceParBot = true;
    j.connecte = true;
    j.parti = false;
    j.deconnecteLe = null;
    if (s.hote === cible) this.transfererHote(s);
    this.toucher(s);
  }

  /** Les joueurs présents continuent sans l'absent (ses tours passent automatiquement). */
  continuerSans(code: string, id: string, cible: string) {
    const s = this.salon(code);
    this.joueur(s, id);
    this.absentRemplacable(s, id, cible);
    const r = continuerSans(s.partie!, cible, this.now());
    if (!r.ok) throw new ErreurJeu(r.erreur);
    this.toucher(s);
  }

  private absentRemplacable(s: Salon, id: string, cible: string): JoueurSalon {
    if (s.statut !== 'partie' || !s.partie) throw new ErreurJeu("Aucune partie n'est en cours.");
    if (cible === id) throw new ErreurJeu('Vous ne pouvez pas vous remplacer vous-même.');
    const j = this.joueur(s, cible);
    if (j.bot) throw new ErreurJeu('Ce joueur est déjà un bot.');
    if (j.connecte) throw new ErreurJeu('Ce joueur est connecté.');
    return j;
  }

  private transfererHote(s: Salon) {
    const candidats = s.joueurs.filter((j) => !j.bot && !j.parti && j.id !== s.hote);
    const suivant = candidats.find((j) => j.connecte) ?? candidats[0];
    if (suivant) s.hote = suivant.id;
  }

  // -------------------------------------------------------------------------
  // Lobby
  // -------------------------------------------------------------------------

  ajouterBot(code: string, id: string) {
    const s = this.salon(code);
    if (!this.botsAutorises) throw new ErreurJeu('Les joueurs automatiques sont désactivés sur ce serveur.');
    if (s.hote !== id) throw new ErreurJeu("Seul l'hôte peut ajouter un joueur automatique.");
    if (s.statut !== 'lobby') throw new ErreurJeu('La partie a déjà commencé.');
    if (s.joueurs.length >= JOUEURS_MAX) throw new ErreurJeu('Le salon est complet.');
    const pris = new Set(s.joueurs.map((j) => j.nom));
    const nom = NOMS_BOTS.map((n) => `${n} (bot)`).find((n) => !pris.has(n)) ?? `Bot ${s.joueurs.length + 1}`;
    s.joueurs.push({ id: this.nouvelId(), nom, jetonHash: '', bot: true, connecte: true, rejointLe: this.now(), deconnecteLe: null });
    this.toucher(s);
  }

  retirer(code: string, id: string, cible: string) {
    const s = this.salon(code);
    if (s.hote !== id) throw new ErreurJeu("Seul l'hôte peut retirer un joueur.");
    if (s.statut !== 'lobby') throw new ErreurJeu('Impossible de retirer un joueur pendant une partie.');
    if (cible === id) throw new ErreurJeu('Utilisez « Quitter le salon ».');
    this.joueur(s, cible);
    s.joueurs = s.joueurs.filter((j) => j.id !== cible);
    this.toucher(s);
  }

  /** L'hôte choisit les pouvoirs du complice (dans le salon d'attente uniquement). */
  reglerModeComplice(code: string, id: string, valeur: unknown) {
    const s = this.salon(code);
    if (s.hote !== id) throw new ErreurJeu("Seul l'hôte peut modifier les réglages.");
    if (s.statut !== 'lobby') throw new ErreurJeu('Les réglages ne peuvent plus changer une fois la partie lancée.');
    if (valeur !== 'classique' && valeur !== 'ruse') throw new ErreurJeu('Mode de complice invalide.');
    s.reglages = { ...s.reglages, modeComplice: valeur };
    this.toucher(s);
  }

  /** L'hôte règle la durée d'un tour (dans le salon d'attente uniquement). */
  reglerDureeTour(code: string, id: string, valeur: unknown) {
    const s = this.salon(code);
    if (s.hote !== id) throw new ErreurJeu("Seul l'hôte peut modifier les réglages.");
    if (s.statut !== 'lobby') throw new ErreurJeu('Les réglages ne peuvent plus changer une fois la partie lancée.');
    const ok = valeur === null || (typeof valeur === 'number' && Number.isInteger(valeur) && valeur >= 30 && valeur <= 3600);
    if (!ok) throw new ErreurJeu('Durée de tour invalide.');
    s.reglages = { ...s.reglages, dureeTourS: valeur as number | null };
    this.toucher(s);
  }

  demarrer(code: string, id: string) {
    const s = this.salon(code);
    if (s.hote !== id) throw new ErreurJeu("Seul l'hôte peut lancer la partie.");
    if (s.statut !== 'lobby') throw new ErreurJeu('La partie a déjà commencé.');
    if (s.joueurs.length < JOUEURS_MIN) throw new ErreurJeu(`Il faut au moins ${JOUEURS_MIN} joueurs pour commencer.`);
    if (s.joueurs.length > JOUEURS_MAX) throw new ErreurJeu(`${JOUEURS_MAX} joueurs maximum.`);
    const absents = s.joueurs.filter((j) => !j.connecte);
    if (absents.length) throw new ErreurJeu(`Joueur(s) déconnecté(s) : ${absents.map((j) => j.nom).join(', ')}.`);
    s.numeroPartie += 1;
    s.partie = creerPartie({
      id: `${s.code}-${s.numeroPartie}`,
      joueurs: s.joueurs.map((j) => ({ id: j.id, nom: j.nom, bot: j.bot })),
      rng: this.rng,
      now: this.now(),
      config: {
        ...this.configPartie,
        delaiTourMs: s.reglages.dureeTourS === null ? null : s.reglages.dureeTourS * 1000,
        modeComplice: s.reglages.modeComplice ?? 'ruse',
      },
    });
    s.statut = 'partie';
    this.toucher(s);
  }

  rejouer(code: string, id: string) {
    const s = this.salon(code);
    if (s.hote !== id) throw new ErreurJeu("Seul l'hôte peut relancer une partie.");
    if (s.statut !== 'terminee') throw new ErreurJeu("La partie en cours n'est pas terminée.");
    s.statut = 'lobby';
    s.partie = null;
    this.toucher(s);
  }

  message(code: string, id: string, texteBrut: unknown) {
    const s = this.salon(code);
    const j = this.joueur(s, id);
    if (typeof texteBrut !== 'string') throw new ErreurJeu('Message invalide.');
    const texte = texteBrut.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim();
    if (!texte) throw new ErreurJeu('Message vide.');
    if (texte.length > MESSAGE_MAX) throw new ErreurJeu(`Les messages sont limités à ${MESSAGE_MAX} caractères.`);
    s.compteurMessages += 1;
    s.messages.push({ id: s.compteurMessages, auteur: j.id, nom: j.nom, texte, t: this.now() });
    if (s.messages.length > 150) s.messages.splice(0, s.messages.length - 150);
    this.toucher(s);
  }

  // -------------------------------------------------------------------------
  // Partie
  // -------------------------------------------------------------------------

  action(code: string, id: string, action: ActionJeu) {
    const s = this.salon(code);
    this.joueur(s, id);
    if (!s.partie) throw new ErreurJeu("Aucune partie n'est en cours.");
    const r = appliquerAction(s.partie, id, action, this.now());
    if (!r.ok) throw new ErreurJeu(r.erreur);
    this.apresChangement(s);
  }

  /** Traite les échéances (fin de falsification, délais de réponse, fin de tour). */
  avancer(code: string): boolean {
    const s = this.salons.get(code);
    if (!s?.partie) return false;
    const change = avancer(s.partie, this.now(), this.rng);
    if (change) this.apresChangement(s);
    return change;
  }

  private apresChangement(s: Salon) {
    if (s.partie?.etape === 'terminee') s.statut = 'terminee';
    this.toucher(s);
  }

  // -------------------------------------------------------------------------
  // Vues
  // -------------------------------------------------------------------------

  vueSalon(s: Salon): SalonVue {
    return {
      code: s.code,
      statut: s.statut,
      hote: s.hote,
      joueurs: s.joueurs.map((j) => ({ id: j.id, nom: j.nom, connecte: j.connecte, bot: j.bot, hote: j.id === s.hote, parti: !!j.parti })),
      messages: s.messages.slice(-80),
      botsAutorises: this.botsAutorises,
      reglages: { ...s.reglages },
      min: JOUEURS_MIN,
      max: JOUEURS_MAX,
    };
  }

  /** Données filtrées pour UN joueur : la seule chose envoyée à son navigateur. */
  etatClient(s: Salon, id: string): EtatClient {
    return {
      moi: id,
      salon: this.vueSalon(s),
      partie: s.partie && s.partie.joueurs[id] ? vuePour(s.partie, id) : null,
      heureServeur: this.now(),
    };
  }

  // -------------------------------------------------------------------------
  // Entretien périodique
  // -------------------------------------------------------------------------

  /** Retourne les codes des salons modifiés. */
  entretien(): string[] {
    const t = this.now();
    const modifies: string[] = [];
    for (const s of [...this.salons.values()]) {
      let change = false;
      const humains = s.joueurs.filter((j) => !j.bot && !j.parti);
      if (humains.every((j) => !j.connecte && j.deconnecteLe !== null && t - j.deconnecteLe > this.opts.suppressionSalonMs) || humains.length === 0) {
        this.salons.delete(s.code);
        continue;
      }
      if (s.statut === 'lobby') {
        const avant = s.joueurs.length;
        s.joueurs = s.joueurs.filter((j) => j.connecte || j.deconnecteLe === null || t - j.deconnecteLe < this.opts.expulsionLobbyMs);
        if (s.joueurs.length !== avant) change = true;
      }
      const hote = s.joueurs.find((j) => j.id === s.hote);
      if (!hote || (!hote.connecte && hote.deconnecteLe !== null && t - hote.deconnecteLe > this.opts.graceHoteMs)) {
        const avantHote = s.hote;
        const suivant = s.joueurs.find((j) => !j.bot && !j.parti && j.connecte);
        if (suivant && suivant.id !== avantHote) {
          s.hote = suivant.id;
          change = true;
        }
      }
      if (change) {
        this.toucher(s);
        modifies.push(s.code);
      }
    }
    return modifies;
  }

  // -------------------------------------------------------------------------
  // Sauvegarde
  // -------------------------------------------------------------------------

  serialiser(): string {
    return JSON.stringify({ version: 1, salons: [...this.salons.values()] });
  }

  charger(json: string) {
    const data = JSON.parse(json) as { version: number; salons: Salon[] };
    if (data.version !== 1) return;
    const t = this.now();
    for (const s of data.salons) {
      // Après un redémarrage, tous les humains sont considérés comme déconnectés
      // jusqu'à leur retour ; leurs rôles, cartes et compteurs sont intacts.
      for (const j of s.joueurs) {
        if (!j.bot) {
          j.connecte = false;
          j.deconnecteLe = t;
          if (s.partie?.joueurs[j.id]) s.partie.joueurs[j.id].connecte = false;
        }
      }
      s.reglages = { ...this.reglagesParDefaut(), ...s.reglages }; // sauvegardes antérieures aux réglages
      if (s.partie) {
        // Parties sauvegardées par une version antérieure : elles gardent les règles avec lesquelles elles ont commencé.
        s.partie.config = { ...CONFIG_PAR_DEFAUT, ...REGLES_INITIALES, ...s.partie.config };
        if (!s.partie.graine) s.partie.config.modeComplice = 'classique';
        recalerEcheances(s.partie, t);
        majPause(s.partie, t); // en attente du retour des joueurs
      }
      this.salons.set(s.code, s);
    }
  }
}
