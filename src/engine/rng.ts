// Générateur pseudo-aléatoire déterministe (mulberry32) pour les tests et les
// simulations, et générateur cryptographique pour les vraies parties.

import { randomInt } from 'node:crypto';

export interface Rng {
  /** Entier dans [0, max[ */
  int(max: number): number;
}

export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (max) => Math.floor(next() * max) };
}

/** Aléa cryptographique : utilisé par le serveur pour tirer la solution et les rôles. */
export const cryptoRng: Rng = { int: (max) => (max <= 1 ? 0 : randomInt(max)) };

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: liste vide');
  return items[rng.int(items.length)];
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
