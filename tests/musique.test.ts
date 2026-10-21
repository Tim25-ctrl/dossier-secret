import { describe, expect, it } from 'vitest';
import { composer, midi, MORCEAUX, verifierMorceau } from '../src/client/musique';

const tous = Object.values(MORCEAUX).flat();

describe('musique', () => {
  it('lit les noms de notes', () => {
    expect(midi('A4')).toBe(69);
    expect(midi('C4')).toBe(60);
    expect(midi('Bb3')).toBe(58);
    expect(midi('C#5')).toBe(73);
  });

  it('chaque section tombe juste (mélodie = accords, mesures entières)', () => {
    for (const m of tous) expect(verifierMorceau(m)).toEqual([]);
  });

  it('chaque morceau dure entre une et deux minutes, notes dans leur section', () => {
    for (const m of tous) {
      const sections = composer(m);
      const duree = sections.reduce((x, s) => x + s.duree, 0);
      expect(duree).toBeGreaterThan(60);
      expect(duree).toBeLessThan(120);
      for (const s of sections) {
        for (const n of s.notes) {
          expect(n.t).toBeGreaterThanOrEqual(0);
          expect(n.t).toBeLessThan(s.duree);
          expect(n.duree).toBeGreaterThan(0);
          expect(n.force).toBeGreaterThan(0);
        }
      }
    }
  });

  it('pas de notes trop aiguës', () => {
    for (const m of tous) for (const s of composer(m)) for (const n of s.notes) if (n.instr === 'piano' || n.instr === 'violoncelle') expect(n.midi).toBeLessThanOrEqual(midi('A4'));
  });

  it('le swing décale la deuxième croche du temps aux deux tiers', () => {
    const m = MORCEAUX.train[0];
    const notes = composer(m, () => 0)[1].notes.filter((n) => n.instr === 'piano' && n.midi === midi('A4') + (m.transposition ?? 0));
    const b = 60 / m.tempo;
    // Première mesure : silence d'un temps, puis La sur le temps 2 et Do sur le « et » (aux deux tiers).
    expect(notes[0].t / b).toBeCloseTo(1, 5);
    const do5 = composer(m, () => 0)[1].notes.find((n) => n.instr === 'piano' && n.midi === midi('C5') + (m.transposition ?? 0))!;
    expect(do5.t / b).toBeCloseTo(1 + 2 / 3, 5);
  });
});
