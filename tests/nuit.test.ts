import { describe, expect, it } from 'vitest';
import { heureDeManche, minutesDeManche, phaseNuit } from '../src/client/nuit';

describe('La nuit qui avance', () => {
  it('chaque manche est une demi-heure : manoir de 23 h 30 à 5 h, train de 2 h à 7 h 30', () => {
    expect([1, 2, 3, 12].map((m) => heureDeManche('manoir', m))).toEqual(['23 h 30', 'minuit', '0 h 30', '5 h']);
    expect([1, 2, 12].map((m) => heureDeManche('train', m))).toEqual(['2 h', '2 h 30', '7 h 30']);
    expect(minutesDeManche('manoir', 2) % 60).toBe(0); // heure pile : l'horloge sonne trois coups
  });

  it("la nuit s'assombrit puis l'aube se lève dans les dernières manches", () => {
    const phases = Array.from({ length: 12 }, (_, i) => phaseNuit(i + 1, 12));
    expect(phases[0].aube).toBe(0);
    expect(Math.max(...phases.map((p) => p.obscurite))).toBeGreaterThan(phases[0].obscurite);
    expect(phases[11].obscurite).toBeLessThan(Math.max(...phases.map((p) => p.obscurite)));
    expect(phases[11].aube).toBe(1);
    expect(phases.slice(0, 8).every((p) => p.aube === 0)).toBe(true);
  });
});

describe('météo par averses', () => {
  it('alterne averses et temps sec, avec des durées raisonnables', async () => {
    const { intensiteMeteo } = await import('../src/client/meteo');
    const debut = Date.UTC(2026, 9, 21);
    const pluies: number[] = [];
    const secs: number[] = [];
    let etat = intensiteMeteo(debut) > 0;
    let duree = 0;
    for (let s = 0; s < 24 * 3600; s++) {
      const i = intensiteMeteo(debut + s * 1000);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThanOrEqual(1);
      const pleut = i > 0;
      if (pleut !== etat) {
        (etat ? pluies : secs).push(duree);
        etat = pleut;
        duree = 0;
      }
      duree++;
    }
    pluies.shift();
    secs.shift();
    expect(Math.min(...pluies)).toBeGreaterThanOrEqual(95);
    expect(Math.max(...pluies)).toBeLessThanOrEqual(175);
    expect(Math.min(...secs)).toBeGreaterThanOrEqual(25);
    expect(Math.max(...secs)).toBeLessThanOrEqual(185);
  });
});
