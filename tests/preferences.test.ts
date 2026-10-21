import { beforeEach, describe, expect, it } from 'vitest';

describe('Préférences : reprise des anciens réglages de son', () => {
  let donnees: Map<string, string>;
  beforeEach(() => {
    donnees = new Map();
    globalThis.localStorage = {
      getItem: (k: string) => donnees.get(k) ?? null,
      setItem: (k: string, v: string) => void donnees.set(k, v),
      removeItem: (k: string) => void donnees.delete(k),
    } as Storage;
  });

  it('garde les mêmes volumes, sous un volume général de 80 %', async () => {
    donnees.set('dossier-secret:preferences', JSON.stringify({ son: true, volume: 0.4, ambiance: false, musique: true, volumeAmbiance: 0.6, pseudo: 'Léa' }));
    const { lire } = await import('../src/client/preferences');
    const p = lire();
    expect(p.pseudo).toBe('Léa');
    expect(p.volumeGeneral).toBe(0.8);
    expect(p.canaux.bruitages.volume * p.volumeGeneral).toBeCloseTo(0.4);
    expect(p.canaux.ambiance.actif).toBe(false);
    expect(p.canaux.ambiance.volume * p.volumeGeneral).toBeCloseTo(0.6);
    expect(p.canaux.musique.actif).toBe(true);
    expect(p.canaux.tictac).toEqual({ actif: true, volume: 0.75 });
    expect('volume' in p).toBe(false);
  });

  it('sans réglages enregistrés : tout est activé', async () => {
    const { lire } = await import('../src/client/preferences');
    const p = lire();
    expect(p.son).toBe(true);
    expect(Object.values(p.canaux).every((c) => c.actif)).toBe(true);
    expect(p.historique).toBe('roman');
  });
});
