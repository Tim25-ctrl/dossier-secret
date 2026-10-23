// Avant le premier tour, chacun lit son rôle : la partie commence quand tous les joueurs humains sont prêts.
import { describe, expect, it } from 'vitest';
import { decisionBot } from '../src/bots/bot';
import { abandonner, avancer, creerPartie, definirConnexion, majPause, prochaineEcheance, remplacerParBot } from '../src/engine/partie';
import { seededRng } from '../src/engine/rng';
import { vuePour } from '../src/engine/vue';
import { CONFIG_TEST, T0, act, actif } from './aide';

const ATTENTE = 180_000;

/** Deux humains (h1, h2) et deux bots. */
function partie() {
  return creerPartie({
    id: 'd',
    joueurs: [
      { id: 'h1', nom: 'Humain 1' },
      { id: 'h2', nom: 'Humain 2' },
      { id: 'b1', nom: 'Bot 1', bot: true },
      { id: 'b2', nom: 'Bot 2', bot: true },
    ],
    rng: seededRng(3),
    now: T0,
    config: { ...CONFIG_TEST, attenteDepartMs: ATTENTE },
  });
}

describe('Départ de la partie', () => {
  it('rien ne se joue tant que tous les humains ne sont pas prêts ; ensuite le premier tour commence', () => {
    const etat = partie();
    expect(prochaineEcheance(etat)).toBe(T0 + ATTENTE);
    const v = vuePour(etat, 'h1');
    expect(v.attenteDepart?.enAttente.sort()).toEqual(['h1', 'h2']);
    expect(v.moi.pret).toBe(false);
    expect(vuePour(etat, 'b1').moi.pret).toBe(true);
    // Personne ne peut agir, et les bots attendent.
    expect(act(etat, actif(etat), { type: 'finTour' }, T0 + 10).ok).toBe(false);
    for (const b of ['b1', 'b2']) expect(decisionBot(vuePour(etat, b), seededRng(1))).toBeNull();

    expect(act(etat, 'h1', { type: 'pret' }, T0 + 1000).ok).toBe(true);
    expect(vuePour(etat, 'h2').attenteDepart?.enAttente).toEqual(['h2']);
    expect(vuePour(etat, 'h1').moi.pret).toBe(true);
    expect(act(etat, 'h2', { type: 'pret' }, T0 + 5000).ok).toBe(true);
    expect(etat.attenteDepart).toBeUndefined();
    expect(etat.historique.at(-1)).toMatchObject({ type: 'debut_enquete' });
    // Le chrono du premier tour part maintenant, pas à la création.
    expect(etat.echeanceTour).toBe(T0 + 5000 + CONFIG_TEST.delaiTourMs!);
    expect(vuePour(etat, 'h1').attenteDepart).toBeUndefined();
    // « Prêt » une seconde fois ne gêne pas.
    expect(act(etat, 'h1', { type: 'pret' }, T0 + 6000).ok).toBe(true);
    expect(act(etat, actif(etat), { type: 'finTour' }, T0 + 7000).ok).toBe(true);
  });

  it('au bout du temps d’attente, la partie commence sans les retardataires', () => {
    const etat = partie();
    act(etat, 'h1', { type: 'pret' }, T0 + 1000);
    avancer(etat, T0 + ATTENTE + 1);
    expect(etat.attenteDepart).toBeUndefined();
    expect(etat.historique.some((e) => e.type === 'debut_enquete')).toBe(true);
  });

  it("un joueur qui part ou qu'un bot remplace n'est plus attendu", () => {
    const etat = partie();
    act(etat, 'h1', { type: 'pret' }, T0 + 1000);
    abandonner(etat, 'h2', T0 + 2000);
    expect(etat.attenteDepart).toBeUndefined();

    const etat2 = partie();
    act(etat2, 'h1', { type: 'pret' }, T0 + 1000);
    definirConnexion(etat2, 'h2', false, T0 + 2000);
    expect(remplacerParBot(etat2, 'h2', T0 + 3000).ok).toBe(true);
    expect(etat2.attenteDepart).toBeUndefined();
  });

  it("une pause pendant l'attente repousse la limite d'autant", () => {
    const etat = partie();
    definirConnexion(etat, 'h2', false, T0 + 1000);
    expect(etat.pause).toBeTruthy();
    definirConnexion(etat, 'h2', true, T0 + 61_000);
    majPause(etat, T0 + 61_000);
    expect(etat.attenteDepart?.limite).toBe(T0 + ATTENTE + 60_000);
  });

  it("pas d'attente sans le réglage, ni dans une partie entre bots", () => {
    const sans = creerPartie({ id: 's', joueurs: [{ id: 'a', nom: 'A' }, { id: 'b', nom: 'B' }, { id: 'c', nom: 'C' }], rng: seededRng(1), now: T0, config: CONFIG_TEST });
    expect(sans.attenteDepart).toBeUndefined();
    const bots = creerPartie({
      id: 'b',
      joueurs: ['a', 'b', 'c'].map((id) => ({ id, nom: id, bot: true })),
      rng: seededRng(1),
      now: T0,
      config: { ...CONFIG_TEST, attenteDepartMs: ATTENTE },
    });
    expect(bots.attenteDepart).toBeUndefined();
  });
});
