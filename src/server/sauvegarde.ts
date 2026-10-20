// Sauvegardes gardées sur les appareils des joueurs.
//
// L'offre gratuite de l'hébergeur efface la mémoire et le disque du serveur à chaque redémarrage.
// Le serveur envoie donc régulièrement à chaque joueur une copie de son salon, que l'appareil garde.
// Après un redémarrage, le premier joueur qui revient la renvoie et le salon reprend.
//
// La copie contient TOUT le salon (solution, mains, complice) : elle est chiffrée (AES-256-GCM)
// avec une clé que seul le serveur connaît (variable d'environnement CLE_SAUVEGARDE). Un joueur ne
// peut ni la lire, ni la modifier : le chiffrement authentifié refuse toute copie altérée.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import type { Salon } from './salons';

const FORMAT = 1;
/** Une sauvegarde plus ancienne n'est plus acceptée. */
export const DUREE_VALIDITE_MS = 7 * 24 * 3600 * 1000;

export class Coffre {
  private cle: Buffer;
  /** Clé tirée au hasard au démarrage : les sauvegardes ne survivent pas à un redémarrage. */
  readonly provisoire: boolean;

  constructor(secret?: string | null) {
    this.provisoire = !secret;
    this.cle = secret ? createHash('sha256').update(secret).digest() : randomBytes(32);
  }

  /** Salon -> texte opaque (base64url) : compressé, chiffré et authentifié. */
  sceller(salon: Salon, now = Date.now()): string {
    const clair = deflateRawSync(Buffer.from(JSON.stringify({ format: FORMAT, t: now, salon }), 'utf8'));
    const iv = randomBytes(12);
    const chiffreur = createCipheriv('aes-256-gcm', this.cle, iv);
    const chiffre = Buffer.concat([chiffreur.update(clair), chiffreur.final()]);
    return Buffer.concat([iv, chiffreur.getAuthTag(), chiffre]).toString('base64url');
  }

  /** Texte opaque -> salon, ou null si la sauvegarde est illisible, altérée, d'un autre format ou trop ancienne. */
  ouvrir(texte: unknown, now = Date.now()): { salon: Salon; t: number } | null {
    if (typeof texte !== 'string' || texte.length < 40 || texte.length > 3_000_000) return null;
    try {
      const brut = Buffer.from(texte, 'base64url');
      const dechiffreur = createDecipheriv('aes-256-gcm', this.cle, brut.subarray(0, 12));
      dechiffreur.setAuthTag(brut.subarray(12, 28));
      const clair = Buffer.concat([dechiffreur.update(brut.subarray(28)), dechiffreur.final()]);
      const data = JSON.parse(inflateRawSync(clair, { maxOutputLength: 20_000_000 }).toString('utf8')) as { format: number; t: number; salon: Salon };
      if (data.format !== FORMAT || typeof data.t !== 'number' || now - data.t > DUREE_VALIDITE_MS) return null;
      if (!data.salon || typeof data.salon.code !== 'string' || !Array.isArray(data.salon.joueurs)) return null;
      return { salon: data.salon, t: data.t };
    } catch {
      return null;
    }
  }
}
