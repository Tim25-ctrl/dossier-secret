// Profil du joueur : statistiques, grade et succès, gardés sur cet appareil uniquement.
// Une partie est comptée une seule fois (identifiant de partie), à l'écran de fin.

import { aGagne, type VueJoueur } from '../shared/types';

export interface Profil {
  parties: number;
  victoires: number;
  enqueteur: { parties: number; victoires: number };
  complice: { parties: number; victoires: number };
  /** Victoires d'affilée en cours, et meilleure série. */
  serie: number;
  meilleureSerie: number;
  /** Succès débloqués : identifiant → date (ms). */
  succes: Record<string, number>;
  /** Dernières parties comptées (pour ne jamais compter deux fois la même). */
  comptees: string[];
}

/** Profil sans compte (gardé sur l'appareil). */
const CLE = 'dossier-secret:profil';
/** Copie du profil du compte connecté (la référence est sur le serveur). */
const CLE_COMPTE = 'dossier-secret:profil-compte';
/** Compte connecté sur cet appareil (voir connexion.ts) : sa présence fait utiliser le profil du compte. */
export const CLE_SESSION_COMPTE = 'dossier-secret:compte';

const surCompte = () => {
  try {
    return !!localStorage.getItem(CLE_SESSION_COMPTE);
  } catch {
    return false;
  }
};

/** Le profil du compte a changé sans pouvoir partir au serveur (partie hors ligne) : à renvoyer. */
const CLE_A_ENVOYER = 'dossier-secret:profil-a-envoyer';
export function profilAEnvoyer(): boolean {
  try {
    return localStorage.getItem(CLE_A_ENVOYER) === '1';
  } catch {
    return false;
  }
}
export function marquerProfilAEnvoyer(oui: boolean) {
  try {
    if (oui) localStorage.setItem(CLE_A_ENVOYER, '1');
    else localStorage.removeItem(CLE_A_ENVOYER);
  } catch {
    /* stockage indisponible */
  }
}

/** Prévenu à chaque changement du profil du compte (pour l'envoyer au serveur). */
let auChangementCompte: ((p: Profil) => void) | null = null;
export function surChangementProfilCompte(fn: (p: Profil) => void) {
  auChangementCompte = fn;
}

const VIDE: Profil = {
  parties: 0,
  victoires: 0,
  enqueteur: { parties: 0, victoires: 0 },
  complice: { parties: 0, victoires: 0 },
  serie: 0,
  meilleureSerie: 0,
  succes: {},
  comptees: [],
};

/** Profil complet à partir de données partielles ou inconnues (ancien format, serveur). */
export function normaliserProfil(brut: unknown): Profil {
  if (!brut || typeof brut !== 'object') return VIDE;
  const p = brut as Partial<Profil>;
  return {
    ...VIDE,
    ...p,
    enqueteur: { ...VIDE.enqueteur, ...p.enqueteur },
    complice: { ...VIDE.complice, ...p.complice },
    succes: { ...p.succes },
    comptees: Array.isArray(p.comptees) ? p.comptees.slice(-50) : [],
  };
}

function lireCle(cle: string): Profil {
  try {
    return normaliserProfil(JSON.parse(localStorage.getItem(cle) ?? 'null'));
  } catch {
    return VIDE;
  }
}

function ecrireCle(cle: string, p: Profil | null) {
  try {
    if (p) localStorage.setItem(cle, JSON.stringify(p));
    else localStorage.removeItem(cle);
  } catch {
    /* stockage indisponible : le profil n'est pas gardé */
  }
}

/** Profil affiché : celui du compte connecté, sinon celui de l'appareil. */
export function lireProfil(): Profil {
  return lireCle(surCompte() ? CLE_COMPTE : CLE);
}

function ecrireProfil(p: Profil) {
  if (surCompte()) {
    ecrireCle(CLE_COMPTE, p);
    auChangementCompte?.(p);
  } else ecrireCle(CLE, p);
}

/** Profil sans compte de cet appareil. */
export const profilInvite = (): Profil => lireCle(CLE);
export const effacerProfilInvite = () => ecrireCle(CLE, null);
/** Copie locale du profil du compte (à la connexion) ; null à la déconnexion. */
export const definirProfilCompte = (p: Profil | null) => ecrireCle(CLE_COMPTE, p);

/** Ajoute à un profil les parties d'un autre (profil sans compte repris par un compte). */
export function fusionnerProfils(a: Profil, b: Profil): Profil {
  const succes = { ...b.succes };
  for (const [id, t] of Object.entries(a.succes)) succes[id] = Math.min(t, succes[id] ?? t);
  return {
    parties: a.parties + b.parties,
    victoires: a.victoires + b.victoires,
    enqueteur: { parties: a.enqueteur.parties + b.enqueteur.parties, victoires: a.enqueteur.victoires + b.enqueteur.victoires },
    complice: { parties: a.complice.parties + b.complice.parties, victoires: a.complice.victoires + b.complice.victoires },
    serie: a.serie,
    meilleureSerie: Math.max(a.meilleureSerie, b.meilleureSerie),
    succes,
    comptees: [...new Set([...a.comptees, ...b.comptees])].slice(-50),
  };
}

// ---------------------------------------------------------------------------
// Grades (selon le nombre de victoires)
// ---------------------------------------------------------------------------

export const GRADES: { victoires: number; titre: string }[] = [
  { victoires: 0, titre: 'Agent stagiaire' },
  { victoires: 1, titre: 'Agent' },
  { victoires: 3, titre: 'Inspecteur' },
  { victoires: 8, titre: 'Inspecteur principal' },
  { victoires: 15, titre: 'Commissaire' },
  { victoires: 30, titre: 'Commissaire divisionnaire' },
  { victoires: 60, titre: 'Légende de la brigade criminelle' },
];

export function grade(victoires: number) {
  const i = GRADES.findLastIndex((g) => victoires >= g.victoires);
  return { actuel: GRADES[i], suivant: GRADES[i + 1] ?? null };
}

// ---------------------------------------------------------------------------
// Succès
// ---------------------------------------------------------------------------

interface Contexte {
  vue: VueJoueur;
  gagne: boolean;
  profil: Profil; // après prise en compte de la partie
}

export interface Succes {
  id: string;
  icone: string;
  titre: string;
  description: string;
  test: (c: Contexte) => boolean;
}

const estComplice = (c: Contexte) => c.vue.moi.role === 'complice';
const monAccusationJuste = (c: Contexte) => !!c.vue.resultat?.accusations.some((a) => a.joueur === c.vue.moi.id && a.correcte);

export const SUCCES: Succes[] = [
  { id: 'premiere', icone: '🗂️', titre: 'Première enquête', description: 'Terminer une partie.', test: () => true },
  { id: 'resolue', icone: '⚖️', titre: 'Affaire classée', description: 'Gagner en tant qu’enquêteur.', test: (c) => c.vue.moi.role === 'enqueteur' && c.gagne },
  { id: 'limier', icone: '🔎', titre: 'Fin limier', description: 'Résoudre soi-même l’affaire par une accusation juste.', test: monAccusationJuste },
  {
    id: 'eclair',
    icone: '⚡',
    titre: 'Enquête éclair',
    description: 'Accusation juste avant la 6ᵉ manche.',
    test: (c) => monAccusationJuste(c) && (c.vue.resultat?.manchesJouees ?? 99) <= 5,
  },
  {
    id: 'demasque',
    icone: '🎭',
    titre: 'Bas les masques',
    description: 'Dénoncer le complice avec succès.',
    test: (c) => !!c.vue.resultat?.denonciations.some((d) => d.joueur === c.vue.moi.id && d.correcte),
  },
  { id: 'ombre', icone: '🕯️', titre: 'Maître de l’ombre', description: 'Gagner en tant que complice.', test: (c) => estComplice(c) && c.gagne },
  {
    id: 'intouchable',
    icone: '🧤',
    titre: 'Intouchable',
    description: 'Gagner en tant que complice sans jamais être démasqué.',
    test: (c) => estComplice(c) && c.gagne && !c.vue.resultat?.denonciations.some((d) => d.correcte),
  },
  {
    id: 'ruses',
    icone: '🃏',
    titre: 'Sac à malices',
    description: 'En complice rusé, utiliser trois sortes de ruses différentes dans une même partie.',
    test: (c) => {
      const u = c.vue.resultat?.usagesPouvoirs;
      return estComplice(c) && !!u && [u.mensonges, u.emprunts, u.falsifications, u.trafics].filter((x) => x.length > 0).length >= 3;
    },
  },
  {
    id: 'archives',
    icone: '📚',
    titre: 'Rat de bibliothèque',
    description: 'Lire 5 dossiers d’archives dans une même partie.',
    test: (c) => c.vue.moi.indicesConsultes.length + c.vue.moi.piecesConsultees.length >= 5,
  },
  { id: 'serie3', icone: '🔥', titre: 'Sur une lancée', description: 'Gagner 3 parties d’affilée.', test: (c) => c.profil.serie >= 3 },
  {
    id: 'terminus',
    icone: '🚂',
    titre: 'Terminus',
    description: 'Gagner une partie dans le train de nuit.',
    test: (c) => c.vue.affaire === 'train' && c.gagne,
  },
  {
    id: 'bon_port',
    icone: '🚢',
    titre: 'Bon port',
    description: 'Gagner une partie à bord du paquebot.',
    test: (c) => c.vue.affaire === 'paquebot' && c.gagne,
  },
  // « Grande enquête »
  { id: 'nuit_entiere', icone: '🌕', titre: 'Nuit entière', description: 'Gagner une Grande enquête.', test: (c) => c.vue.regles?.mode === 'grande' && c.gagne },
  {
    id: 'temoin_invisible',
    icone: '👁️',
    titre: 'Témoin invisible',
    description: 'Gagner en tant que Témoin sans être démasqué par le complice.',
    test: (c) => c.vue.moi.roleEnquete === 'temoin' && c.gagne && c.vue.resultat?.objectifComplice?.designe !== c.vue.moi.id,
  },
  { id: 'coup_de_maitre', icone: '💼', titre: 'Coup de maître', description: 'Gagner en tant que Maître chanteur.', test: (c) => c.vue.moi.role === 'maitre_chanteur' && c.gagne },
  {
    id: 'dernier_mot',
    icone: '🗝️',
    titre: 'Le dernier mot',
    description: 'En complice, voler la victoire grâce à son objectif secret.',
    test: (c) => estComplice(c) && c.vue.resultat?.raison === 'objectif_complice',
  },
  { id: 'habitue', icone: '🎩', titre: 'Habitué des lieux', description: 'Terminer 10 parties.', test: (c) => c.profil.parties >= 10 },
  { id: 'veteran', icone: '🏛️', titre: 'Vétéran', description: 'Terminer 50 parties.', test: (c) => c.profil.parties >= 50 },
];

/**
 * Compte une partie terminée (une seule fois) et retourne les succès débloqués à cette occasion,
 * ainsi que le profil à jour. Sans effet si la partie a déjà été comptée.
 */
export function enregistrerPartie(vue: VueJoueur): { profil: Profil; nouveaux: Succes[]; compteeIci: boolean } {
  const avant = lireProfil();
  if (!vue.resultat || avant.comptees.includes(vue.partieId)) return { profil: avant, nouveaux: [], compteeIci: false };
  const role = vue.moi.role === 'complice' ? 'complice' : 'enqueteur';
  const gagne = aGagne(vue.moi.role, vue.resultat.vainqueur);
  const serie = gagne ? avant.serie + 1 : 0;
  const profil: Profil = {
    ...avant,
    parties: avant.parties + 1,
    victoires: avant.victoires + (gagne ? 1 : 0),
    [role]: { parties: avant[role].parties + 1, victoires: avant[role].victoires + (gagne ? 1 : 0) },
    serie,
    meilleureSerie: Math.max(avant.meilleureSerie, serie),
    succes: { ...avant.succes },
    comptees: [...avant.comptees, vue.partieId].slice(-50),
  };
  const nouveaux = SUCCES.filter((s) => !profil.succes[s.id] && s.test({ vue, gagne, profil }));
  for (const s of nouveaux) profil.succes[s.id] = Date.now();
  ecrireProfil(profil);
  return { profil, nouveaux, compteeIci: true };
}

/** Bilan de la partie, calculé une seule fois par page (l'écran de fin peut s'afficher plusieurs fois). */
const bilans = new Map<string, ReturnType<typeof enregistrerPartie>>();
export function bilanPartie(vue: VueJoueur) {
  if (!bilans.has(vue.partieId)) bilans.set(vue.partieId, enregistrerPartie(vue));
  return bilans.get(vue.partieId)!;
}

export function effacerProfil() {
  ecrireProfil(VIDE);
}
