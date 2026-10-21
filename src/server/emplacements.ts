// Emplacements de sauvegarde (3 pour les parties solo, 3 pour les parties multijoueur).
//
// Ils sont rangés sous le « code joueur » de chacun : un code secret tiré au hasard par son appareil,
// qu'il peut recopier sur un autre appareil pour y retrouver ses sauvegardes. Le serveur n'en garde
// que l'empreinte (SHA-256) : il ne peut pas retrouver le code à partir de ce qu'il stocke.
//
// Deux dépôts : une base PostgreSQL (variable DATABASE_URL, par exemple chez Neon) pour le site en
// ligne, et un fichier JSON pour jouer en local. Le dépôt PostgreSQL garde aussi l'état des salons
// en cours, pour qu'un redémarrage du serveur ne coupe plus aucune partie.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ALPHABET_CODE,
  LONGUEUR_CODE_JOUEUR,
  NB_EMPLACEMENTS,
  type InfoEmplacement,
  type ResumeEmplacement,
  type TypePartie,
} from '../shared/protocole';
import { ErreurJeu, type Salon } from './salons';

/** Emplacement complet : le salon tel qu'il était au moment de l'enregistrement et la place de son auteur. */
export interface Emplacement extends InfoEmplacement {
  joueurId: string;
  salon: Salon;
}

export interface DepotEmplacements {
  /** « base » : base de données en ligne ; « fichier » : fichier local (développement). */
  readonly genre: 'base' | 'fichier' | 'memoire';
  lister(cle: string): Promise<InfoEmplacement[]>;
  lire(cle: string, type: TypePartie, numero: number): Promise<Emplacement | null>;
  ecrire(cle: string, e: Emplacement): Promise<void>;
  effacer(cle: string, type: TypePartie, numero: number): Promise<void>;
  /** État des salons en cours (sauvegarde automatique côté serveur), si le dépôt sait le garder. */
  lireEtat?(): Promise<string | null>;
  ecrireEtat?(json: string): Promise<void>;
  fermer?(): Promise<void>;
}

/** Code joueur saisi (avec ou sans tirets) -> clé de rangement. Refuse tout code mal formé. */
export function cleJoueur(brut: unknown): string {
  if (typeof brut !== 'string') throw new ErreurJeu('Code joueur invalide.');
  const code = brut.trim().toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== LONGUEUR_CODE_JOUEUR || [...code].some((c) => !ALPHABET_CODE.includes(c)))
    throw new ErreurJeu(`Le code joueur comporte ${LONGUEUR_CODE_JOUEUR} caractères (lettres et chiffres).`);
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

const tri = (a: InfoEmplacement, b: InfoEmplacement) => (a.type === b.type ? a.numero - b.numero : a.type < b.type ? 1 : -1);
const info = ({ type, numero, t, resume }: Emplacement): InfoEmplacement => ({ type, numero, t, resume });

// ---------------------------------------------------------------------------
// En mémoire (tests) et dans un fichier (jeu en local)
// ---------------------------------------------------------------------------

export class DepotMemoire implements DepotEmplacements {
  readonly genre: 'memoire' | 'fichier' = 'memoire';
  protected donnees = new Map<string, Emplacement>();
  private static cle = (cle: string, type: TypePartie, numero: number) => `${cle}|${type}|${numero}`;

  async lister(cle: string) {
    return [...this.donnees.entries()].filter(([k]) => k.startsWith(`${cle}|`)).map(([, e]) => info(e)).sort(tri);
  }
  async lire(cle: string, type: TypePartie, numero: number) {
    const e = this.donnees.get(DepotMemoire.cle(cle, type, numero));
    return e ? (JSON.parse(JSON.stringify(e)) as Emplacement) : null;
  }
  async ecrire(cle: string, e: Emplacement) {
    this.donnees.set(DepotMemoire.cle(cle, e.type, e.numero), JSON.parse(JSON.stringify(e)) as Emplacement);
    await this.persister();
  }
  async effacer(cle: string, type: TypePartie, numero: number) {
    this.donnees.delete(DepotMemoire.cle(cle, type, numero));
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
      const data = JSON.parse(await readFile(fichier, 'utf8')) as { version: number; emplacements: [string, Emplacement][] };
      if (data.version === 1) d.donnees = new Map(data.emplacements);
    }
    return d;
  }

  protected override async persister() {
    await mkdir(path.dirname(this.fichier), { recursive: true });
    await writeFile(`${this.fichier}.tmp`, JSON.stringify({ version: 1, emplacements: [...this.donnees] }));
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

export class DepotSql implements DepotEmplacements {
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
