// Mode « Grande enquête », étape 5 : le tableau d'enquête commun (docs/GRANDE-ENQUETE.md, section 8).
import { describe, expect, it } from 'vitest';
import { CONFIG_GRANDE_ENQUETE, type ConfigPartie } from '../src/engine/config';
import type { EtatPartie } from '../src/engine/partie';
import type { ActionJeu, CibleEpingle } from '../src/shared/types';
import { CONFIG_TEST, Horloge, act, actif, nouvellePartie, vuePour } from './aide';

const GRANDE: Partial<ConfigPartie> = { ...CONFIG_TEST, ...CONFIG_GRANDE_ENQUETE, modeComplice: 'ruse' };
const partie = (n = 4, seed = 1) => nouvellePartie(n, { seed, config: GRANDE });

const element = (id: string): CibleEpingle => ({ type: 'element', id: id as never });
const joueur = (id: string): CibleEpingle => ({ type: 'joueur', id });
const epingle = (cible: CibleEpingle, etiquette: 'innocent' | 'coupable' | 'fausse_piste' | 'complice', extra: Partial<Extract<ActionJeu, { type: 'epingler' }>> = {}) =>
  ({ type: 'epingler', cible, etiquette, ...extra }) as const;

/** Passe à la manche suivante (tous les joueurs finissent leur tour). */
function mancheSuivante(etat: EtatPartie, h: Horloge) {
  const m = etat.manche;
  for (let garde = 0; garde < 20 && etat.manche === m; garde++) act(etat, actif(etat), { type: 'finTour' }, h.avance(1));
}

function journaliste(etat: EtatPartie) {
  const id = etat.ordre.find((x) => x !== etat.complice)!;
  const j = etat.joueurs[id];
  j.roleEnquete = 'journaliste';
  j.pouvoirs = { rumeurs: 3 };
  return id;
}

describe("Le tableau d'enquête", () => {
  it("n'existe pas dans une partie classique", () => {
    const etat = nouvellePartie(4, { seed: 1 });
    expect(vuePour(etat, etat.ordre[0]).tableau).toBeUndefined();
    expect(act(etat, etat.ordre[0], epingle(element('victor'), 'coupable'), 1).ok).toBe(false);
  });

  it('chacun épingle à tout moment, une fois par manche ; les épingles sont anonymes et sans mot', () => {
    const h = new Horloge();
    const etat = partie();
    const [a, b, c] = etat.ordre.filter((id) => id !== actif(etat));
    expect(act(etat, a, epingle(element('victor'), 'coupable'), h.avance(1)).ok).toBe(true);
    expect(act(etat, a, epingle(element('cave'), 'innocent'), h.avance(1))).toMatchObject({ ok: false, erreur: expect.stringContaining('cette manche') });
    expect(act(etat, b, epingle(joueur(a), 'complice'), h.avance(1)).ok).toBe(true);
    // Chacun ne voit que l'auteur de sa propre épingle.
    expect(vuePour(etat, a).tableau!.map((e) => e.auteur)).toEqual([a, null]);
    expect(vuePour(etat, b).tableau!.map((e) => e.auteur)).toEqual([null, b]);
    const t = vuePour(etat, c).tableau!;
    expect(t[0]).toMatchObject({ auteur: null, rumeur: false, cible: element('victor'), etiquette: 'coupable', manche: 1, pour: 0, contre: 0 });
    expect(t[1]).toMatchObject({ auteur: null, cible: joueur(a), etiquette: 'complice' });
    expect(t.every((e) => !('note' in e))).toBe(true);
    for (const e of t) expect([JSON.stringify(e).includes(`"auteur":"${a}"`), JSON.stringify(e).includes(`"auteur":"${b}"`)]).toEqual([false, false]);
    mancheSuivante(etat, h);
    expect(act(etat, a, epingle(element('cave'), 'innocent'), h.avance(1)).ok).toBe(true);
  });

  it("refuse les épingles incohérentes", () => {
    const etat = partie();
    const [a, b] = etat.ordre;
    expect(act(etat, a, epingle(element('irina'), 'coupable'), 1).ok).toBe(false); // autre histoire
    expect(act(etat, a, epingle(element('victor'), 'complice'), 1).ok).toBe(false); // « complice » vise un joueur
    expect(act(etat, a, epingle(joueur(b), 'coupable'), 1).ok).toBe(false);
    expect(act(etat, a, epingle(joueur(a), 'innocent'), 1).ok).toBe(false); // soi-même
    expect(act(etat, a, epingle(joueur('inconnu'), 'complice'), 1).ok).toBe(false);
    expect(act(etat, a, epingle(element('manoir_dette'), 'fausse_piste'), 1).ok).toBe(true); // un mobile
  });

  it('une seule épingle par joueur au tableau : la nouvelle remplace l’ancienne ; seul son auteur la retire', () => {
    const h = new Horloge();
    const etat = partie();
    const [a, b] = etat.ordre;
    for (const id of ['victor', 'morel', 'cave']) {
      expect(act(etat, a, epingle(element(id), 'innocent'), h.avance(1)).ok).toBe(true);
      mancheSuivante(etat, h);
    }
    const t = vuePour(etat, b).tableau!;
    expect(t.map((e) => (e.cible.type === 'element' ? e.cible.id : ''))).toEqual(['cave']);
    expect(act(etat, b, { type: 'retirerEpingle', epingle: t[0].id }, h.avance(1)).ok).toBe(false);
    expect(act(etat, a, { type: 'retirerEpingle', epingle: t[0].id }, h.avance(1)).ok).toBe(true);
    expect(vuePour(etat, b).tableau).toHaveLength(0);
  });

  it('les réactions 👍 / 👎 sont comptées ; on peut changer d’avis, et réagir à sa propre épingle', () => {
    const etat = partie();
    const [a, b, c] = etat.ordre;
    act(etat, a, epingle(element('victor'), 'coupable'), 1);
    const id = vuePour(etat, a).tableau![0].id;
    // S'abstenir de réagir à sa propre épingle trahirait son auteur.
    expect(act(etat, a, { type: 'reagir', epingle: id, reaction: 'pour' }, 2).ok).toBe(true);
    expect(act(etat, b, { type: 'reagir', epingle: id, reaction: 'pour' }, 2).ok).toBe(true);
    expect(act(etat, c, { type: 'reagir', epingle: id, reaction: 'contre' }, 3).ok).toBe(true);
    expect(vuePour(etat, c).tableau![0]).toMatchObject({ pour: 2, contre: 1 });
    expect(vuePour(etat, b).tableau![0].maReaction).toBe('pour');
    act(etat, b, { type: 'reagir', epingle: id, reaction: null }, 4);
    act(etat, c, { type: 'reagir', epingle: id, reaction: 'pour' }, 5);
    expect(vuePour(etat, b).tableau![0]).toMatchObject({ pour: 2, contre: 0 });
    expect(act(etat, b, { type: 'reagir', epingle: 'E99', reaction: 'pour' }, 6).ok).toBe(false);
  });
});

describe('Les épingles en plus du Journaliste', () => {
  it('ressemblent aux autres, comptent à part (elles restent au tableau), 3 en tout et une par manche', () => {
    const h = new Horloge();
    const etat = partie();
    const j = journaliste(etat);
    const autre = etat.ordre.find((x) => x !== j)!;
    // Aucun autre Journaliste dans cette partie de test.
    for (const x of etat.ordre) if (x !== j && etat.joueurs[x].roleEnquete === 'journaliste') etat.joueurs[x].roleEnquete = 'inspecteur';
    expect(act(etat, autre, epingle(element('victor'), 'coupable', { rumeur: true }), h.avance(1)).ok).toBe(false);
    expect(act(etat, j, epingle(joueur(autre), 'complice', { rumeur: true }), h.avance(1)).ok).toBe(true);
    // Elle ne compte pas dans l'épingle habituelle de la manche, qui ne la remplace pas.
    expect(act(etat, j, epingle(element('cave'), 'innocent'), h.avance(1)).ok).toBe(true);
    expect(act(etat, j, epingle(element('serre'), 'innocent', { rumeur: true }), h.avance(1)).ok).toBe(false);
    const vueAutre = vuePour(etat, autre).tableau!;
    expect(vueAutre).toHaveLength(2);
    // Pour les autres, rien ne la distingue d'une épingle ordinaire.
    expect(vueAutre[0]).toMatchObject({ auteur: null, rumeur: false, etiquette: 'complice' });
    expect(vuePour(etat, j).tableau![0]).toMatchObject({ auteur: j, rumeur: true });
    expect(JSON.stringify(vueAutre[0])).not.toContain(`"${j}"`);
    expect(act(etat, j, { type: 'reagir', epingle: vueAutre[0].id, reaction: 'pour' }, h.avance(1)).ok).toBe(true);
    mancheSuivante(etat, h);
    expect(act(etat, j, epingle(element('serre'), 'innocent', { rumeur: true }), h.avance(1)).ok).toBe(true);
    mancheSuivante(etat, h);
    expect(act(etat, j, epingle(element('dague'), 'innocent', { rumeur: true }), h.avance(1)).ok).toBe(true);
    mancheSuivante(etat, h);
    expect(act(etat, j, epingle(element('bureau'), 'innocent', { rumeur: true }), h.avance(1))).toMatchObject({ ok: false, erreur: expect.stringContaining("plus d'épingle en plus") });
    expect(vuePour(etat, j).moi.pouvoirsRole?.rumeurs).toBe(0);
  });

  it('sont révélées à la fin de la partie, avec leur auteur (comme toutes les épingles)', () => {
    const h = new Horloge();
    const etat = partie();
    const j = journaliste(etat);
    act(etat, j, epingle(element('victor'), 'innocent', { rumeur: true }), h.avance(1));
    const accusateur = etat.ordre.find((x) => x !== etat.complice)!;
    for (let garde = 0; garde < 10 && actif(etat) !== accusateur; garde++) act(etat, actif(etat), { type: 'finTour' }, h.avance(1));
    act(etat, accusateur, { type: 'accuser', ...etat.affaire.solution }, h.avance(1));
    if (etat.etape === 'designation') act(etat, etat.complice, { type: 'designerTemoin', joueur: accusateur === j ? etat.ordre.find((x) => x !== j && x !== etat.complice)! : j }, h.avance(1));
    expect(etat.etape).toBe('terminee');
    // Plus d'épingle une fois la partie finie.
    expect(act(etat, j, epingle(element('cave'), 'innocent'), h.avance(1)).ok).toBe(false);
    const r = vuePour(etat, etat.complice).resultat!;
    expect(r.tableau![0]).toMatchObject({ auteur: j, rumeur: true });
  });

  it('le Journaliste fait maintenant partie des rôles tirés au sort', () => {
    const tires = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) for (const j of Object.values(partie(6, seed).joueurs)) if (j.roleEnquete) tires.add(j.roleEnquete);
    expect(tires).toEqual(new Set(['temoin', 'inspecteur', 'legiste', 'archiviste', 'journaliste', 'profileur']));
  });
});
