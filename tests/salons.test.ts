import { describe, expect, it } from 'vitest';
import { ErreurJeu, GestionnaireSalons, normaliserCode, normaliserPseudo } from '../src/server/salons';
import { seededRng } from '../src/engine/rng';

function gestionnaire() {
  let t = 1_000_000;
  const g = new GestionnaireSalons({ now: () => t, rng: seededRng(3), graceHoteMs: 30_000, expulsionLobbyMs: 120_000, suppressionSalonMs: 3_600_000 });
  return { g, avance: (ms: number) => (t += ms) };
}

describe('Gestionnaire de salons', () => {
  it('normalise et valide pseudonymes et codes', () => {
    expect(normaliserPseudo('  Jean   Dupont ')).toBe('Jean Dupont');
    expect(normaliserPseudo('Zoé​\u0007')).toBe('Zoé');
    expect(() => normaliserPseudo('​')).toThrow(ErreurJeu);
    expect(() => normaliserPseudo('x'.repeat(21))).toThrow(/20 caractères/);
    expect(normaliserCode(' abc-def ')).toBe('ABCDEF');
    expect(() => normaliserCode('ABCDE0')).toThrow(); // 0 exclu de l'alphabet (confusion avec O)
  });

  it("transfère le rôle d'hôte si l'hôte reste déconnecté, pas pendant un simple rafraîchissement", () => {
    const { g, avance } = gestionnaire();
    const { salon, joueur: hote } = g.creer('Hôte');
    const { joueur: b } = g.rejoindre(salon.code, 'B');
    g.definirConnexion(salon.code, hote.id, false);
    avance(10_000);
    g.entretien();
    expect(salon.hote).toBe(hote.id); // délai de grâce
    avance(25_000);
    g.entretien();
    expect(salon.hote).toBe(b.id);
  });

  it("transfère immédiatement le rôle d'hôte si l'hôte quitte le salon", () => {
    const { g } = gestionnaire();
    const { salon, joueur: hote } = g.creer('Hôte');
    const { joueur: b } = g.rejoindre(salon.code, 'B');
    g.quitter(salon.code, hote.id);
    expect(salon.hote).toBe(b.id);
    expect(salon.joueurs.map((j) => j.nom)).toEqual(['B']);
    g.quitter(salon.code, b.id);
    expect(g.salons.has(salon.code)).toBe(false);
  });

  it('retire du lobby les joueurs déconnectés depuis longtemps', () => {
    const { g, avance } = gestionnaire();
    const { salon } = g.creer('Hôte');
    const { joueur: b } = g.rejoindre(salon.code, 'B');
    g.definirConnexion(salon.code, b.id, false);
    avance(121_000);
    g.entretien();
    expect(salon.joueurs.map((j) => j.nom)).toEqual(['Hôte']);
  });

  it('refuse le démarrage si un joueur est déconnecté', () => {
    const { g } = gestionnaire();
    const { salon, joueur: hote } = g.creer('Hôte');
    const { joueur: b } = g.rejoindre(salon.code, 'B');
    g.rejoindre(salon.code, 'C');
    g.definirConnexion(salon.code, b.id, false);
    expect(() => g.demarrer(salon.code, hote.id)).toThrow(/déconnecté/);
  });

  it('sauvegarde et restauration après redémarrage : rôles, cartes, compteurs et jetons intacts', () => {
    const { g, avance } = gestionnaire();
    const { salon, joueur: hote, jeton } = g.creer('Hôte');
    g.rejoindre(salon.code, 'B');
    g.rejoindre(salon.code, 'C');
    g.demarrer(salon.code, hote.id);
    const avant = JSON.stringify(salon.partie!.joueurs);
    const json = g.serialiser();
    expect(json).not.toContain(jeton); // seul le hash du jeton est conservé

    avance(10 * 60_000); // le serveur est resté arrêté 10 minutes
    const { g: g2 } = gestionnaire();
    g2.charger(json);
    const restaure = g2.salons.get(salon.code)!;
    const joueursRestaures = restaure.partie!.joueurs;
    for (const id of Object.keys(joueursRestaures)) {
      const a = JSON.parse(avant)[id];
      expect(joueursRestaures[id].role).toBe(a.role);
      expect(joueursRestaures[id].main).toEqual(a.main);
      expect(joueursRestaures[id].mensongesRestants).toBe(a.mensongesRestants);
    }
    // Pas de cascade de tours automatiques après la reprise.
    expect(g2.avancer(salon.code)).toBe(false);
    // Le jeton d'origine permet toujours de reprendre sa place.
    expect(g2.reprendre(salon.code, jeton).joueur.id).toBe(hote.id);
  });
});
