// Mode « Grande enquête », étape 3 : les rôles secrets et leurs pouvoirs (docs/GRANDE-ENQUETE.md).
import { describe, expect, it } from 'vitest';
import { simulerPartie } from '../src/bots/simulation';
import { CONFIG_GRANDE_ENQUETE, type ConfigPartie } from '../src/engine/config';
import type { EtatPartie } from '../src/engine/partie';
import { aGagne, categorieDe, elementsDuTriplet, type RoleEnquete, type Triplet } from '../src/shared/types';
import { CONFIG_TEST, Horloge, act, actif, autres, nouvellePartie, passerFalsification, vuePour } from './aide';

const GRANDE: Partial<ConfigPartie> = { ...CONFIG_TEST, ...CONFIG_GRANDE_ENQUETE, modeComplice: 'ruse' };
const partie = (n: number, seed = 1) => nouvellePartie(n, { seed, config: GRANDE });

/** Donne un rôle d'enquête à un joueur (pour tester un pouvoir sans dépendre du tirage). */
function donnerRole(etat: EtatPartie, joueur: string, role: RoleEnquete) {
  const j = etat.joueurs[joueur];
  j.role = 'enqueteur';
  j.roleEnquete = role;
  j.pouvoirs = { verifications: 2, expertises: 1, archivesGratuites: 2, verificationsDossier: 1, profilages: 1, rumeurs: 3 };
}

/** Termine des tours jusqu'à ce que `joueur` joue, à la manche `manche` au moins. */
function allerA(etat: EtatPartie, joueur: string, manche: number, h: Horloge) {
  for (let garde = 0; garde < 200 && !(etat.manche >= manche && actif(etat) === joueur); garde++) {
    const r = act(etat, actif(etat), { type: 'finTour' }, h.avance(1));
    if (!r.ok) throw new Error(r.erreur);
  }
  if (actif(etat) !== joueur) throw new Error('tour introuvable');
}

/** Un enquêteur qui n'est pas le complice. */
const unEnqueteur = (etat: EtatPartie) => etat.ordre.find((id) => id !== etat.complice)!;

describe('Tirage des rôles', () => {
  for (const n of [4, 5, 6]) {
    it(`${n} joueurs : un complice, ${n >= 5 ? 'un Maître chanteur, ' : ''}un Témoin, et des rôles tous différents`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const etat = partie(n, seed);
        const js = Object.values(etat.joueurs);
        expect(js.filter((j) => j.role === 'complice')).toHaveLength(1);
        expect(js.filter((j) => j.role === 'maitre_chanteur')).toHaveLength(n >= 5 ? 1 : 0);
        const enqueteurs = js.filter((j) => j.role === 'enqueteur');
        expect(enqueteurs).toHaveLength(n >= 5 ? n - 2 : n - 1);
        expect(enqueteurs.filter((j) => j.roleEnquete === 'temoin')).toHaveLength(1);
        const roles = enqueteurs.map((j) => j.roleEnquete);
        expect(new Set(roles).size).toBe(roles.length);
        for (const j of js) if (j.role !== 'enqueteur') expect(j.roleEnquete).toBeUndefined();
      }
    });
  }

  it("chacun ne voit que son rôle : le Témoin connaît le lieu, le Maître chanteur le mobile", () => {
    const etat = partie(6, 4);
    const { solution } = etat.affaire;
    for (const id of etat.ordre) {
      const j = etat.joueurs[id];
      const v = vuePour(etat, id);
      expect(v.moi.role).toBe(j.role);
      expect(v.moi.roleEnquete).toBe(j.roleEnquete);
      expect(v.moi.lieuConnu).toBe(j.roleEnquete === 'temoin' ? solution.lieu : undefined);
      expect(v.moi.mobileConnu).toBe(j.role === 'maitre_chanteur' ? solution.mobile : undefined);
      expect(v.regles.roles).toMatchObject({ maitreChanteur: true, possibles: expect.arrayContaining(['temoin', 'inspecteur']) });
      // Rien sur le rôle des autres : seul son propre rôle apparaît (fiche + journal), jamais celui d'un autre.
      const json = JSON.stringify(v);
      const vus = [...json.matchAll(/"roleEnquete":"([a-z]+)"/g)].map((m) => m[1]);
      expect(vus.every((r) => r === j.roleEnquete)).toBe(true);
      // Seul le Maître chanteur sait qu'il l'est.
      if (j.role !== 'maitre_chanteur') expect(json).not.toContain('"role":"maitre_chanteur"');
      expect(JSON.stringify(v.joueurs)).not.toMatch(/role/);
    }
  });

  it("une partie classique n'a ni rôles ni Maître chanteur", () => {
    const etat = nouvellePartie(6, { seed: 4 });
    for (const j of Object.values(etat.joueurs)) {
      expect(['enqueteur', 'complice']).toContain(j.role);
      expect(j.roleEnquete).toBeUndefined();
    }
    expect(vuePour(etat, etat.ordre[0]).regles.roles).toBeUndefined();
  });
});

describe('Pouvoirs des rôles', () => {
  it("un pouvoir n'est utilisable que par son rôle, pendant son tour", () => {
    const h = new Horloge();
    const etat = partie(4, 2);
    const moi = actif(etat) === etat.complice ? etat.ordre[1] : actif(etat);
    allerA(etat, moi, 6, h);
    donnerRole(etat, moi, 'archiviste');
    expect(act(etat, moi, { type: 'profiler', joueurs: autres(etat, moi).slice(0, 2) }, h.avance(1)).ok).toBe(false);
    donnerRole(etat, moi, 'profileur');
    const autre = autres(etat, moi)[0];
    expect(act(etat, autre, { type: 'profiler', joueurs: autres(etat, autre).slice(0, 2) }, h.avance(1)).ok).toBe(false);
    expect(act(etat, moi, { type: 'profiler', joueurs: autres(etat, moi).slice(0, 2) }, h.avance(1)).ok).toBe(true);
  });

  it("l'Inspecteur sait si les réponses reçues à son hypothèse étaient honnêtes", () => {
    for (const ruse of [false, true]) {
      const h = new Horloge();
      // Le complice répond le premier : il peut mentir s'il a une carte de l'hypothèse.
      for (let seed = 1; seed <= 60; seed++) {
        const etat = partie(4, seed);
        const moi = actif(etat);
        if (moi === etat.complice) continue;
        const c = etat.complice;
        const carte = etat.joueurs[c].main[0];
        const t: Triplet = { ...etat.affaire.solution, [categorieDe(carte)!]: carte } as Triplet;
        donnerRole(etat, moi, 'inspecteur');
        // Avant toute hypothèse : refusé.
        expect(act(etat, moi, { type: 'verifierReponses' }, h.avance(1)).ok).toBe(false);
        const autre = autres(etat, moi).find((x) => x !== c)!;
        expect(act(etat, moi, { type: 'hypothese', ...t, interroges: [c, autre] }, h.avance(1)).ok).toBe(true);
        passerFalsification(etat, h);
        if (ruse) expect(act(etat, c, { type: 'mentir' }, h.avance(1)).ok).toBe(true);
        else expect(act(etat, c, { type: 'repondre', carte }, h.avance(1)).ok).toBe(true);
        if (etat.etape === 'hypothese') {
          const r = etat.joueurs[autre];
          const cartes = elementsDuTriplet(t).filter((x) => r.main.includes(x));
          expect(act(etat, autre, { type: 'repondre', carte: cartes[0] ?? null }, h.avance(1)).ok).toBe(true);
        }
        expect(act(etat, moi, { type: 'verifierReponses' }, h.avance(1)).ok).toBe(true);
        const e = etat.joueurs[moi].journal.at(-1)!;
        expect(e).toMatchObject({ type: 'verification', honnete: !ruse });
        expect(etat.joueurs[moi].pouvoirs?.verifications).toBe(1);
        // Une seule vérification par hypothèse, et rien de visible pour les autres.
        expect(act(etat, moi, { type: 'verifierReponses' }, h.avance(1)).ok).toBe(false);
        expect(JSON.stringify(vuePour(etat, autre))).not.toContain('"verification"');
        // Au tour suivant, il est trop tard.
        act(etat, moi, { type: 'finTour' }, h.avance(1));
        allerA(etat, moi, etat.manche + 1, h);
        expect(act(etat, moi, { type: 'verifierReponses' }, h.avance(1)).ok).toBe(false);
        break;
      }
    }
  });

  it('le Légiste apprend deux éléments innocents, à partir de la manche 3, une seule fois', () => {
    const h = new Horloge();
    const etat = partie(5, 3);
    const moi = unEnqueteur(etat);
    donnerRole(etat, moi, 'legiste');
    allerA(etat, moi, 1, h);
    expect(act(etat, moi, { type: 'expertiser', categorie: 'arme' }, h.avance(1))).toMatchObject({ ok: false, erreur: expect.stringContaining('manche 3') });
    allerA(etat, moi, 3, h);
    expect(act(etat, moi, { type: 'expertiser', categorie: 'mobile' }, h.avance(1)).ok).toBe(true);
    const e = etat.joueurs[moi].journal.at(-1)!;
    expect(e.type).toBe('expertise');
    if (e.type !== 'expertise') return;
    expect(e.innocents).toHaveLength(2);
    expect(new Set(e.innocents).size).toBe(2);
    for (const x of e.innocents) {
      expect(categorieDe(x)).toBe('mobile');
      expect(x).not.toBe(etat.affaire.solution.mobile);
    }
    expect(act(etat, moi, { type: 'expertiser', categorie: 'arme' }, h.avance(1)).ok).toBe(false);
  });

  it("l'Archiviste consulte deux dossiers sans payer, et sait si un dossier a été trafiqué", () => {
    const h = new Horloge();
    for (let seed = 1; seed <= 30; seed++) {
      const etat = partie(4, seed);
      const c = etat.complice;
      const moi = etat.ordre.find((id) => id !== c && etat.ordre.indexOf(id) > etat.ordre.indexOf(c));
      if (!moi) continue;
      donnerRole(etat, moi, 'archiviste');
      // Le complice trafique le dossier 1 avant que l'Archiviste ne joue.
      allerA(etat, c, 1, h);
      expect(act(etat, c, { type: 'consulterArchive', dossier: 1, trafiquer: true }, h.avance(1)).ok).toBe(true);
      allerA(etat, moi, 1, h);
      const pa = etat.pointsAction;
      expect(act(etat, moi, { type: 'consulterArchive', dossier: 1, gratuit: true }, h.avance(1)).ok).toBe(true);
      expect(etat.pointsAction).toBe(pa);
      expect(act(etat, moi, { type: 'verifierDossier', dossier: 1 }, h.avance(1)).ok).toBe(true);
      expect(etat.joueurs[moi].journal.at(-1)).toMatchObject({ type: 'dossier_verifie', dossier: 1, trafique: true });
      expect(act(etat, moi, { type: 'verifierDossier', dossier: 1 }, h.avance(1)).ok).toBe(false);
      allerA(etat, moi, 2, h);
      expect(act(etat, moi, { type: 'consulterArchive', dossier: 2, gratuit: true }, h.avance(1)).ok).toBe(true);
      allerA(etat, moi, 3, h);
      expect(act(etat, moi, { type: 'consulterArchive', dossier: 3, gratuit: true }, h.avance(1)).ok).toBe(false);
      expect(act(etat, moi, { type: 'consulterArchive', dossier: 3 }, h.avance(1)).ok).toBe(true);
      // Un joueur sans ce rôle ne consulte jamais gratuitement.
      const autre = autres(etat, moi).find((x) => x !== c)!;
      donnerRole(etat, autre, 'legiste');
      allerA(etat, autre, 4, h);
      expect(act(etat, autre, { type: 'consulterArchive', dossier: 1, gratuit: true }, h.avance(1)).ok).toBe(false);
      return;
    }
    throw new Error('Aucune partie de test ne convenait.');
  });

  it('le Profileur sait si le complice est parmi deux joueurs, à partir de la manche 6', () => {
    const h = new Horloge();
    const etat = partie(5, 6);
    const moi = unEnqueteur(etat);
    donnerRole(etat, moi, 'profileur');
    allerA(etat, moi, 5, h);
    const deux = autres(etat, moi).slice(0, 2);
    expect(act(etat, moi, { type: 'profiler', joueurs: deux }, h.avance(1)).ok).toBe(false);
    allerA(etat, moi, 6, h);
    expect(act(etat, moi, { type: 'profiler', joueurs: [deux[0], deux[0]] }, h.avance(1)).ok).toBe(false);
    expect(act(etat, moi, { type: 'profiler', joueurs: [moi, deux[0]] }, h.avance(1)).ok).toBe(false);
    expect(act(etat, moi, { type: 'profiler', joueurs: deux }, h.avance(1)).ok).toBe(true);
    expect(etat.joueurs[moi].journal.at(-1)).toMatchObject({ type: 'profilage', joueurs: deux, complicePresent: deux.includes(etat.complice) });
    expect(act(etat, moi, { type: 'profiler', joueurs: deux }, h.avance(1)).ok).toBe(false);
  });
});

describe('Le Maître chanteur', () => {
  it('gagne seul en faisant lui-même la bonne accusation', () => {
    const h = new Horloge();
    const etat = partie(5, 9);
    const mc = etat.ordre.find((id) => etat.joueurs[id].role === 'maitre_chanteur')!;
    allerA(etat, mc, 1, h);
    expect(act(etat, mc, { type: 'accuser', ...etat.affaire.solution }, h.avance(1)).ok).toBe(true);
    expect(etat.resultat?.vainqueur).toBe('maitre_chanteur');
    expect(aGagne('maitre_chanteur', 'maitre_chanteur')).toBe(true);
    expect(aGagne('enqueteur', 'maitre_chanteur')).toBe(false);
    expect(aGagne('complice', 'maitre_chanteur')).toBe(false);
    const r = vuePour(etat, etat.ordre[0]).resultat!;
    expect(r.roles?.[mc]).toEqual({ role: 'maitre_chanteur' });
    expect(Object.values(r.roles!).filter((x) => x.roleEnquete === 'temoin')).toHaveLength(1);
  });

  it("perd si un enquêteur trouve avant lui ; le complice gagne si tous, lui compris, se trompent", () => {
    const h = new Horloge();
    const etat = partie(5, 10);
    const s = etat.affaire.solution;
    const faux: Triplet = { ...s, mobile: s.mobile === 'manoir_dette' ? 'manoir_chantage' : 'manoir_dette' };
    const accusateurs = etat.ordre.filter((id) => id !== etat.complice);
    for (const id of accusateurs) {
      allerA(etat, id, 1, h);
      expect(act(etat, id, { type: 'accuser', ...faux }, h.avance(1)).ok).toBe(true);
      if (id !== accusateurs.at(-1)) expect(etat.etape).not.toBe('terminee');
    }
    expect(etat.resultat).toMatchObject({ vainqueur: 'complice', raison: 'plus_d_accusateur' });

    const etat2 = partie(5, 10);
    const enqueteur = etat2.ordre.find((id) => etat2.joueurs[id].role === 'enqueteur')!;
    allerA(etat2, enqueteur, 1, h);
    act(etat2, enqueteur, { type: 'accuser', ...etat2.affaire.solution }, h.avance(1));
    expect(etat2.resultat?.vainqueur).toBe('enqueteurs');
  });

  it('le dénoncer comme complice est une erreur', () => {
    const h = new Horloge();
    const etat = partie(5, 11);
    const mc = etat.ordre.find((id) => etat.joueurs[id].role === 'maitre_chanteur')!;
    const moi = etat.ordre.find((id) => id !== mc && id !== etat.complice)!;
    allerA(etat, moi, 1, h);
    expect(act(etat, moi, { type: 'denoncer', joueur: mc }, h.avance(1)).ok).toBe(true);
    expect(etat.denonciations?.[0].correcte).toBe(false);
  });
});

describe('Parties complètes entre bots, avec les rôles', () => {
  it('se terminent sans action refusée, et révèlent les rôles', () => {
    const vainqueurs = new Set<string>();
    for (const n of [4, 5, 6]) {
      for (let seed = 1; seed <= 8; seed++) {
        const { etat, refus } = simulerPartie({ nbJoueurs: n, seed: seed * 13 + n, config: { ...CONFIG_GRANDE_ENQUETE, affaire: 'paquebot' } });
        expect(etat.etape).toBe('terminee');
        expect(refus).toEqual([]);
        vainqueurs.add(etat.resultat!.vainqueur);
        const r = vuePour(etat, etat.ordre[0]).resultat!;
        expect(Object.keys(r.roles!)).toHaveLength(n);
      }
    }
    expect(vainqueurs.size).toBeGreaterThanOrEqual(2);
  });
});
