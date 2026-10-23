// Partie guidée : la partie arrangée (rôles qui changent, bots qui jouent d'un coup, final mis en scène).
import { describe, expect, it } from 'vitest';
import { PROFIL_OCCASIONNEL, decisionBot } from '../src/bots/bot';
import { appliquerAction, cartesCorrespondantes, joueurActif } from '../src/engine/partie';
import { seededRng } from '../src/engine/rng';
import { vuePour } from '../src/engine/vue';
import type { ActionJeu } from '../src/shared/types';
import {
  HERCULE,
  MAIGRET,
  MARPLE,
  MOI,
  ORDRE,
  SHERLOCK,
  SOLUTION,
  avanceRapide,
  creerPartieGuidee,
  hypotheseAvec,
  poserMonRole,
  tourSuivant,
} from '../src/client/tutoriel/scenario';
import type { EtatPartie } from '../src/engine/partie';

const T0 = 1_000_000;

/** Les bots du guide : ni accusation, ni dénonciation, et ils ne vous interrogent pas. */
function decideur(etat: EtatPartie, graine = 1) {
  const rng = seededRng(graine);
  return (id: string): ActionJeu | null => {
    const a = decisionBot(vuePour(etat, id), rng, PROFIL_OCCASIONNEL);
    if (!a) return null;
    if (a.type === 'accuser' || a.type === 'denoncer') return { type: 'finTour' };
    if (a.type === 'hypothese' && a.interroges.includes(MOI)) {
      const libres = ORDRE.filter((b) => b !== MOI && b !== id && !a.interroges.includes(b));
      return { ...a, interroges: a.interroges.map((x) => (x === MOI ? libres.shift()! : x)) };
    }
    return a;
  };
}

describe('Partie guidée', () => {
  it('se prépare : vous commencez, Marple complice, Sherlock Maître chanteur, objectif du témoin gênant', () => {
    const e = creerPartieGuidee('Vous', T0);
    expect(e.ordre).toEqual(ORDRE);
    expect(joueurActif(e)).toBe(MOI);
    expect(e.complice).toBe(MARPLE);
    expect(e.affaire.solution).toEqual(SOLUTION);
    expect(e.objectif).toEqual({ type: 'temoin_genant' });
    expect(e.attenteDepart).toBeTruthy();
    expect(e.joueurs[MOI]).toMatchObject({ role: 'enqueteur' });
    expect(e.joueurs[MOI].roleEnquete).toBeUndefined();
    expect(e.joueurs[SHERLOCK].role).toBe('maitre_chanteur');
    expect(e.joueurs[HERCULE].roleEnquete).toBe('inspecteur');
    expect(e.joueurs[MAIGRET].roleEnquete).toBe('journaliste');
    // La ligne « Votre rôle » des observations correspond au rôle donné par le guide.
    for (const id of ORDRE) {
      const r = e.joueurs[id].journal.find((x) => x.type === 'role');
      expect(r).toMatchObject({ role: e.joueurs[id].role });
      expect(r?.type === 'role' ? r.roleEnquete : null).toBe(e.joueurs[id].roleEnquete);
    }
  });

  it('change votre rôle (pouvoirs neufs) ; complice : Marple devient le Témoin', () => {
    const e = creerPartieGuidee('Vous', T0);
    poserMonRole(e, { role: 'enqueteur', roleEnquete: 'legiste' }, T0);
    expect(e.joueurs[MOI].pouvoirs).toEqual({ expertises: 1 });
    expect(vuePour(e, MOI).moi.journal.at(-1)).toMatchObject({ type: 'role', roleEnquete: 'legiste' });

    poserMonRole(e, { role: 'maitre_chanteur' }, T0);
    expect(e.joueurs[SHERLOCK].roleEnquete).toBe('profileur');
    expect(vuePour(e, MOI).moi.mobileConnu).toBe(SOLUTION.mobile);

    poserMonRole(e, { role: 'complice' }, T0);
    expect(e.complice).toBe(MOI);
    expect(e.joueurs[MOI].rusesRestantes).toBe(5);
    expect(e.joueurs[MARPLE]).toMatchObject({ role: 'enqueteur', roleEnquete: 'temoin', rusesRestantes: 0 });
    expect(e.joueurs[SHERLOCK].role).toBe('maitre_chanteur');
    const v = vuePour(e, MOI);
    expect(v.moi.meurtrier).toBe(SOLUTION.suspect);
    expect(v.moi.objectif).toEqual({ type: 'temoin_genant' });
    // La fenêtre de falsification attend désormais votre choix.
    expect(e.config.delaiFalsificationMs).toBeGreaterThan(60_000);
  });

  it('les bots jouent d’un coup jusqu’à votre tour, manche après manche, sans finir la partie', () => {
    const e = creerPartieGuidee('Vous', T0);
    const d = decideur(e);
    for (let manche = 2; manche <= 12; manche++) {
      tourSuivant(e, d, T0 + manche * 1000);
      expect(e.etape).toBe('tour');
      expect(joueurActif(e)).toBe(MOI);
      expect(e.manche).toBe(manche);
      expect(e.pointsAction).toBe(e.config.pointsAction);
    }
    // Personne ne vous a interrogé, personne n'a accusé.
    expect(e.hypotheses.every((h) => !h.interroges.includes(MOI))).toBe(true);
    expect(e.accusations).toHaveLength(0);
  });

  it("l'hypothèse conseillée ne laisse répondre que le détenteur choisi", () => {
    const e = creerPartieGuidee('Vous', T0);
    const t = hypotheseAvec(e, HERCULE, [SHERLOCK]);
    expect(cartesCorrespondantes(e, HERCULE, t).length).toBeGreaterThan(0);
    expect(cartesCorrespondantes(e, SHERLOCK, t)).toHaveLength(0);
    expect(cartesCorrespondantes(e, MOI, t)).toHaveLength(0);
    expect(t.mobile).toBeDefined();
  });

  it('le final : Hercule accuse juste, vous désignez le Témoin et volez la victoire', () => {
    const e = creerPartieGuidee('Vous', T0);
    const d = decideur(e);
    tourSuivant(e, d, T0);
    poserMonRole(e, { role: 'complice' }, T0);
    appliquerAction(e, MOI, { type: 'finTour' }, T0 + 1);
    avanceRapide(e, d, HERCULE, T0 + 2);
    expect(joueurActif(e)).toBe(HERCULE);
    expect(appliquerAction(e, HERCULE, { type: 'accuser', ...SOLUTION }, T0 + 3).ok).toBe(true);
    expect(e.etape).toBe('designation');
    expect(appliquerAction(e, MOI, { type: 'designerTemoin', joueur: MARPLE }, T0 + 4).ok).toBe(true);
    expect(e.resultat).toMatchObject({ vainqueur: 'complice', raison: 'objectif_complice' });
    // L'écran de fin révèle les rôles du guide.
    const roles = vuePour(e, MOI).resultat!.roles!;
    expect(roles[MARPLE]).toMatchObject({ role: 'enqueteur', roleEnquete: 'temoin' });
    expect(roles[MOI]).toMatchObject({ role: 'complice' });
  });
});
