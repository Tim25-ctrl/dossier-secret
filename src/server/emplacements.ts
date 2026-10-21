// Données gardées par le serveur : comptes joueurs, emplacements de sauvegarde (3 solo + 3 multijoueur
// par compte) et, avec une base de données, l'état des salons en cours.
//
// Trois dépôts : une base PostgreSQL (variable DATABASE_URL, par exemple chez Neon) pour le site en
// ligne, un fichier JSON pour jouer en local, et la mémoire pour les tests. Le dépôt PostgreSQL garde
// aussi l'état des salons en cours, pour qu'un redémarrage du serveur ne coupe plus aucune partie.
//
// Les emplacements sont rangés sous une clé : « compte:<id> » pour un compte. Les clés plus anciennes
// (empreinte d'un « code joueur » d'appareil, avant les comptes) sont reprises par le compte à la connexion.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ALPHABET_CODE, NB_EMPLACEMENTS, type InfoEmplacement, type ResumeEmplacement, type TypePartie } from '../shared/protocole';
import { ErreurJeu, type Salon } from './salons';

/** Emplacement complet : le salon tel qu'il était au moment de l'enregistrement et la place de son auteur. */
export interface Emplacement extends InfoEmplacement {
  joueurId: string;
  salon: Salon;
}

export interface Compte {
  id: string;
  /** Pseudonyme tel qu'il a été choisi (affiché). */
  nom: string;
  /** Pseudonyme en minuscules : deux comptes ne peuvent pas avoir le même. */
  nomCle: string;
  /** Empreinte du mot de passe (voir comptes.ts). */
  mdp: string;
  /** Empreinte du code de secours. */
  secours: string;
  /** Profil du joueur (grades, succès) en JSON, ou null. */
  profil: string | null;
  creeLe: number;
}

export type ChampsCompte = Partial<Pick<Compte, 'mdp' | 'secours' | 'profil'>>;

export interface Depot {
  /** « base » : base de données en ligne ; « fichier » : fichier local (développement). */
  readonly genre: 'base' | 'fichier' | 'memoire';
  // Emplacements
  lister(cle: string): Promise<InfoEmplacement[]>;
  lire(cle: string, type: TypePartie, numero: number): Promise<Emplacement | null>;
  ecrire(cle: string, e: Emplacement): Promise<void>;
  effacer(cle: string, type: TypePartie, numero: number): Promise<void>;
  // Comptes
  /** Retourne false si le pseudonyme est déjà pris. */
  creerCompte(c: Compte): Promise<boolean>;
  compteParNom(nomCle: string): Promise<Compte | null>;
  compteParId(id: string): Promise<Compte | null>;
  majCompte(id: string, champs: ChampsCompte): Promise<void>;
  /** Supprime le compte, ses sessions et ses emplacements. */
  supprimerCompte(id: string): Promise<void>;
  // Sessions (empreinte du jeton remis à l'appareil -> compte)
  ajouterSession(jetonHash: string, compteId: string, t: number): Promise<void>;
  sessionCompte(jetonHash: string): Promise<{ compteId: string; t: number } | null>;
  supprimerSession(jetonHash: string): Promise<void>;
  /** Toutes les sessions du compte (mot de passe réinitialisé), sauf éventuellement une. */
  supprimerSessions(compteId: string, sauf?: string): Promise<void>;
  /** État des salons en cours (sauvegarde automatique côté serveur), si le dépôt sait le garder. */
  lireEtat?(): Promise<string | null>;
  ecrireEtat?(json: string): Promise<void>;
  fermer?(): Promise<void>;
}
/** Ancien nom. */
export type DepotEmplacements = Depot;

export const cleCompte = (id: string) => `compte:${id}`;

/** Ancien « code joueur » d'appareil (12 caractères) -> clé de ses emplacements, ou null s'il est mal formé. */
export function cleCodeJoueur(brut: unknown): string | null {
  if (typeof brut !== 'string') return null;
  const code = brut.trim().toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== 12 || [...code].some((c) => !ALPHABET_CODE.includes(c))) return null;
  return createHash('sha256').update(`emplacements:${code}`).digest('hex');
}

export function verifierNumero(numero: unknown): number {
  if (!Number.isInteger(numero) || (numero as number) < 1 || (numero as number) > NB_EMPLACEMENTS)
    throw new ErreurJeu(`Choisissez un emplacement de 1 à ${NB_EMPLACEMENTS}.`);
  return numero as number;
}

/** Ce que l'on montre d'une sauvegarde sans l'ouvrir : histoire, manche, joueurs. */
export function resumer(s: Salon, auteur: string): ResumeEmplacement {
  const p = s.partie!;
  return {
    affaire: p.config.affaire ?? 'manoir',
    manche: p.manche,
    manchesMax: p.config.manchesMax,
    autres: s.joueurs.filter((j) => j.id !== auteur && !j.bot).map((j) => j.nom),
    bots: s.joueurs.filter((j) => j.bot).length,
    nom: s.joueurs.find((j) => j.id === auteur)?.nom ?? '',
  };
}

/**
 * Reprend les emplacements rangés sous une autre clé (ancien code joueur) dans les places libres du
 * compte. Un emplacement déjà occupé côté compte est gardé ; celui de l'ancienne clé est alors laissé.
 */
export async function reprendreEmplacements(depot: Depot, de: string, vers: string): Promise<number> {
  const libres = new Set((await depot.lister(vers)).map((e) => `${e.type}|${e.numero}`));
  let repris = 0;
  for (const e of await depot.lister(de)) {
    if (libres.has(`${e.type}|${e.numero}`)) continue;
    const complet = await depot.lire(de, e.type, e.numero);
    if (!complet) continue;
    await depot.ecrire(vers, complet);
    await depot.effacer(de, e.type, e.numero);
    repris++;
  }
  return repris;
}

const tri = (a: InfoEmplacement, b: InfoEmplacement) => (a.type === b.type ? a.numero - b.numero : a.type < b.type ? 1 : -1);
const info = ({ type, numero, t, resume }: Emplacement): InfoEmplacement => ({ type, numero, t, resume });
const copie = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

// ---------------------------------------------------------------------------
// En mémoire (tests) et dans un fichier (jeu en local)
// ---------------------------------------------------------------------------

export class DepotMemoire implements Depot {
  readonly genre: 'memoire' | 'fichier' = 'memoire';
  protected donnees = new Map<string, Emplacement>();
  protected comptes = new Map<string, Compte>();
  protected sessions = new Map<string, { compteId: string; t: number }>();
  private static cle = (cle: string, type: TypePartie, numero: number) => `${cle}|${type}|${numero}`;

  async lister(cle: string) {
    return [...this.donnees.entries()].filter(([k]) => k.startsWith(`${cle}|`)).map(([, e]) => info(e)).sort(tri);
  }
  async lire(cle: string, type: TypePartie, numero: number) {
    const e = this.donnees.get(DepotMemoire.cle(cle, type, numero));
    return e ? copie(e) : null;
  }
  async ecrire(cle: string, e: Emplacement) {
    this.donnees.set(DepotMemoire.cle(cle, e.type, e.numero), copie(e));
    await this.persister();
  }
  async effacer(cle: string, type: TypePartie, numero: number) {
    this.donnees.delete(DepotMemoire.cle(cle, type, numero));
    await this.persister();
  }

  async creerCompte(c: Compte) {
    if ([...this.comptes.values()].some((x) => x.nomCle === c.nomCle)) return false;
    this.comptes.set(c.id, copie(c));
    await this.persister();
    return true;
  }
  async compteParNom(nomCle: string) {
    const c = [...this.comptes.values()].find((x) => x.nomCle === nomCle);
    return c ? copie(c) : null;
  }
  async compteParId(id: string) {
    const c = this.comptes.get(id);
    return c ? copie(c) : null;
  }
  async majCompte(id: string, champs: ChampsCompte) {
    const c = this.comptes.get(id);
    if (!c) return;
    this.comptes.set(id, { ...c, ...champs });
    await this.persister();
  }
  async supprimerCompte(id: string) {
    this.comptes.delete(id);
    for (const [k, s] of this.sessions) if (s.compteId === id) this.sessions.delete(k);
    for (const k of [...this.donnees.keys()]) if (k.startsWith(`${cleCompte(id)}|`)) this.donnees.delete(k);
    await this.persister();
  }

  async ajouterSession(jetonHash: string, compteId: string, t: number) {
    this.sessions.set(jetonHash, { compteId, t });
    await this.persister();
  }
  async sessionCompte(jetonHash: string) {
    return this.sessions.get(jetonHash) ?? null;
  }
  async supprimerSession(jetonHash: string) {
    this.sessions.delete(jetonHash);
    await this.persister();
  }
  async supprimerSessions(compteId: string, sauf?: string) {
    for (const [k, s] of this.sessions) if (s.compteId === compteId && k !== sauf) this.sessions.delete(k);
    await this.persister();
  }
  protected async persister() {}
}

export class DepotFichier extends DepotMemoire {
  // L'état des salons en cours reste dans le fichier salons.json du serveur.
  override readonly genre = 'fichier' as const;

  private constructor(private fichier: string) {
    super();
  }

  static async ouvrir(fichier: string) {
    const d = new DepotFichier(fichier);
    if (existsSync(fichier)) {
      const data = JSON.parse(await readFile(fichier, 'utf8')) as {
        version: number;
        emplacements: [string, Emplacement][];
        comptes?: [string, Compte][];
        sessions?: [string, { compteId: string; t: number }][];
      };
      if (data.version === 1 || data.version === 2) {
        d.donnees = new Map(data.emplacements);
        d.comptes = new Map(data.comptes ?? []);
        d.sessions = new Map(data.sessions ?? []);
      }
    }
    return d;
  }

  protected override async persister() {
    await mkdir(path.dirname(this.fichier), { recursive: true });
    const json = JSON.stringify({ version: 2, emplacements: [...this.donnees], comptes: [...this.comptes], sessions: [...this.sessions] });
    await writeFile(`${this.fichier}.tmp`, json);
    await rename(`${this.fichier}.tmp`, this.fichier);
  }
}

// ---------------------------------------------------------------------------
// Base PostgreSQL
// ---------------------------------------------------------------------------

/** Ce dont le dépôt a besoin d'un client PostgreSQL (pg.Pool ou PGlite pour les tests). */
export interface ClientSql {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  end?(): Promise<void>;
  close?(): Promise<void>;
}

const ligneCompte = (l: Record<string, unknown>): Compte => ({
  id: String(l.id),
  nom: String(l.nom),
  nomCle: String(l.nom_cle),
  mdp: String(l.mdp),
  secours: String(l.secours),
  profil: l.profil === null || l.profil === undefined ? null : String(l.profil),
  creeLe: Number(l.cree_le),
});

export class DepotSql implements Depot {
  readonly genre = 'base' as const;
  private constructor(private sql: ClientSql) {}

  /** Prépare les tables (sans effet si elles existent déjà). */
  static async ouvrir(sql: ClientSql) {
    await sql.query(`CREATE TABLE IF NOT EXISTS emplacements (
      cle TEXT NOT NULL,
      type TEXT NOT NULL,
      numero INTEGER NOT NULL,
      t BIGINT NOT NULL,
      joueur_id TEXT NOT NULL,
      resume TEXT NOT NULL,
      salon TEXT NOT NULL,
      PRIMARY KEY (cle, type, numero)
    )`);
    await sql.query(`CREATE TABLE IF NOT EXISTS etat_serveur (
      id INTEGER PRIMARY KEY,
      t BIGINT NOT NULL,
      donnees TEXT NOT NULL
    )`);
    await sql.query(`CREATE TABLE IF NOT EXISTS comptes (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      nom_cle TEXT NOT NULL UNIQUE,
      mdp TEXT NOT NULL,
      secours TEXT NOT NULL,
      profil TEXT,
      cree_le BIGINT NOT NULL
    )`);
    await sql.query(`CREATE TABLE IF NOT EXISTS sessions_comptes (
      jeton_hash TEXT PRIMARY KEY,
      compte_id TEXT NOT NULL,
      t BIGINT NOT NULL
    )`);
    return new DepotSql(sql);
  }

  /** Connexion à une base PostgreSQL en ligne (Neon, Render…) à partir de son adresse. */
  static async connecter(adresse: string, journal: (...a: unknown[]) => void) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: adresse, max: 4, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 15_000 });
    // La base gratuite se met en veille et coupe les connexions inactives : on en ouvrira d'autres.
    pool.on('error', (e) => journal('Base de données : connexion fermée', e.message));
    return DepotSql.ouvrir(pool);
  }

  async lister(cle: string) {
    const r = await this.sql.query('SELECT type, numero, t, resume FROM emplacements WHERE cle = $1', [cle]);
    return r.rows
      .map((l) => ({ type: l.type as TypePartie, numero: Number(l.numero), t: Number(l.t), resume: JSON.parse(String(l.resume)) as ResumeEmplacement }))
      .sort(tri);
  }

  async lire(cle: string, type: TypePartie, numero: number) {
    const r = await this.sql.query('SELECT t, joueur_id, resume, salon FROM emplacements WHERE cle = $1 AND type = $2 AND numero = $3', [cle, type, numero]);
    const l = r.rows[0];
    if (!l) return null;
    return {
      type,
      numero,
      t: Number(l.t),
      joueurId: String(l.joueur_id),
      resume: JSON.parse(String(l.resume)) as ResumeEmplacement,
      salon: JSON.parse(String(l.salon)) as Salon,
    };
  }

  async ecrire(cle: string, e: Emplacement) {
    await this.sql.query(
      `INSERT INTO emplacements (cle, type, numero, t, joueur_id, resume, salon) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (cle, type, numero) DO UPDATE SET t = EXCLUDED.t, joueur_id = EXCLUDED.joueur_id, resume = EXCLUDED.resume, salon = EXCLUDED.salon`,
      [cle, e.type, e.numero, e.t, e.joueurId, JSON.stringify(e.resume), JSON.stringify(e.salon)],
    );
  }

  async effacer(cle: string, type: TypePartie, numero: number) {
    await this.sql.query('DELETE FROM emplacements WHERE cle = $1 AND type = $2 AND numero = $3', [cle, type, numero]);
  }

  async creerCompte(c: Compte) {
    const r = await this.sql.query(
      `INSERT INTO comptes (id, nom, nom_cle, mdp, secours, profil, cree_le) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (nom_cle) DO NOTHING RETURNING id`,
      [c.id, c.nom, c.nomCle, c.mdp, c.secours, c.profil, c.creeLe],
    );
    return r.rows.length === 1;
  }

  async compteParNom(nomCle: string) {
    const r = await this.sql.query('SELECT * FROM comptes WHERE nom_cle = $1', [nomCle]);
    return r.rows[0] ? ligneCompte(r.rows[0]) : null;
  }

  async compteParId(id: string) {
    const r = await this.sql.query('SELECT * FROM comptes WHERE id = $1', [id]);
    return r.rows[0] ? ligneCompte(r.rows[0]) : null;
  }

  async majCompte(id: string, champs: ChampsCompte) {
    const colonnes = (['mdp', 'secours', 'profil'] as const).filter((k) => champs[k] !== undefined);
    if (colonnes.length === 0) return;
    await this.sql.query(`UPDATE comptes SET ${colonnes.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [id, ...colonnes.map((k) => champs[k])]);
  }

  async supprimerCompte(id: string) {
    await this.sql.query('DELETE FROM sessions_comptes WHERE compte_id = $1', [id]);
    await this.sql.query('DELETE FROM emplacements WHERE cle = $1', [cleCompte(id)]);
    await this.sql.query('DELETE FROM comptes WHERE id = $1', [id]);
  }

  async ajouterSession(jetonHash: string, compteId: string, t: number) {
    await this.sql.query('INSERT INTO sessions_comptes (jeton_hash, compte_id, t) VALUES ($1, $2, $3)', [jetonHash, compteId, t]);
  }

  async sessionCompte(jetonHash: string) {
    const r = await this.sql.query('SELECT compte_id, t FROM sessions_comptes WHERE jeton_hash = $1', [jetonHash]);
    return r.rows[0] ? { compteId: String(r.rows[0].compte_id), t: Number(r.rows[0].t) } : null;
  }

  async supprimerSession(jetonHash: string) {
    await this.sql.query('DELETE FROM sessions_comptes WHERE jeton_hash = $1', [jetonHash]);
  }

  async supprimerSessions(compteId: string, sauf?: string) {
    await this.sql.query('DELETE FROM sessions_comptes WHERE compte_id = $1 AND jeton_hash <> $2', [compteId, sauf ?? '']);
  }

  async lireEtat() {
    const r = await this.sql.query('SELECT donnees FROM etat_serveur WHERE id = 1');
    return r.rows[0] ? String(r.rows[0].donnees) : null;
  }

  async ecrireEtat(json: string) {
    await this.sql.query(
      'INSERT INTO etat_serveur (id, t, donnees) VALUES (1, $1, $2) ON CONFLICT (id) DO UPDATE SET t = EXCLUDED.t, donnees = EXCLUDED.donnees',
      [Date.now(), json],
    );
  }

  async fermer() {
    await (this.sql.end?.() ?? this.sql.close?.());
  }
}
