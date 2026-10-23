// Outils communs aux chapitres des parties guidées (classique et Grande enquête).

import type { ReactNode } from 'react';
import { joueurActif, type EtatPartie } from '../../engine/partie';
import { nomElement } from '../../shared/data/catalogue';
import type { ActionJeu, ElementId, EntreePrivee, Triplet, VueJoueur } from '../../shared/types';
import { InfosRoleGrande } from '../components/jeu/GrandeEnquete';
import type { Contexte, Etape } from './Guide';
import { MOI } from './scenario';

// ---------------------------------------------------------------------------
// Petits outils
// ---------------------------------------------------------------------------

/** Nom d'un joueur sans « (bot) ». */
export const court = (v: VueJoueur, id: string) => (v.joueurs.find((j) => j.id === id)?.nom ?? id).replace(/\s*\(bot\)$/, '');
/** « A », « B » et « C ». */
export const liste = (ids: ElementId[]) => {
  const n = ids.map((e) => `« ${nomElement(e)} »`);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} et ${n.at(-1)}` : (n[0] ?? '');
};
export const monTour = (v: VueJoueur) => v.joueurActif === MOI && v.etape === 'tour';
export const tourFini = ({ vue }: Contexte) => vue.joueurActif !== MOI;
/** Ce que vous avez appris depuis le début du chapitre. */
export const depuis = (c: Contexte): EntreePrivee[] => c.vue.moi.journal.slice(c.p.journalDebut);
export const aFait = (c: Contexte, type: EntreePrivee['type']) => depuis(c).some((e) => e.type === type);
/** La réponse reçue à votre dernière hypothèse du chapitre (null tant qu'elle n'est pas arrivée). */
export function reponseRecue(c: Contexte) {
  const j = [...depuis(c)].reverse();
  const origine = j.find((e) => e.type === 'hypothese_originale');
  const r = j.find((e) => e.type === 'carte_vue' || e.type === 'aucune_carte_vue');
  return origine?.type === 'hypothese_originale' && r && 'hypothese' in r && r.hypothese === origine.hypothese ? r : null;
}
/** Les joueurs que vous avez interrogés à votre dernière hypothèse. */
export const interrogesDeMaDerniereHypothese = (v: VueJoueur) => {
  const h = [...v.historique].reverse().find((e) => e.type === 'hypothese' && e.auteur === MOI);
  return h?.type === 'hypothese' ? h.interroges : [];
};
export const ligneCarnet = (e: ElementId) => `.carnet-ligne[data-element="${e}"]`;
export const PANNEAU_ROLE = ['.colonne-gauche .prive', '.bande-cartes'];
export const POUVOIR = ['.modale', '.pouvoirs-role'];
export const hypothese = (t: Triplet, interroges: string[]): ActionJeu => ({ type: 'hypothese', ...t, interroges });
export const sonTour = (e: EtatPartie, id: string) => e.etape === 'tour' && joueurActif(e) === id && !e.hypothese;
export const tripletTexte = (t: Triplet) => [t.suspect, t.lieu, t.arme, t.mobile].filter(Boolean).map((x) => nomElement(x as ElementId));
export const Fort = ({ children }: { children: ReactNode }) => <strong>{children}</strong>;

/** L'hypothèse conseillée, en toutes lettres. */
export function Conseil({ t, interroges, v }: { t: Triplet; interroges: string[]; v: VueJoueur }) {
  // Trois éléments (partie classique) ou quatre (avec le mobile).
  const elements = tripletTexte(t);
  return (
    <>
      {' '}
      Essayez par exemple{' '}
      {elements.map((x, i) => (
        <span key={x}>
          <Fort>{x}</Fort>
          {i < elements.length - 1 ? ', ' : ''}
        </span>
      ))}
      , et interrogez <Fort>{court(v, interroges[0])}</Fort> puis <Fort>{court(v, interroges[1])}</Fort>.
    </>
  );
}

/** Fenêtre « Nouveau rôle » : ce que dit le panneau privé, puis l'explication du guide. */
export function NouveauRole({ c, children }: { c: Contexte; children: ReactNode }) {
  return (
    <>
      <div className="prive guide-role">
        <InfosRoleGrande vue={c.vue} nom={(id) => court(c.vue, id)} />
      </div>
      {children}
    </>
  );
}

/** Terminer son tour (fin de chapitre). */
export const terminerTour = (texte: ReactNode = <>Revenez sur <Fort>Enquête</Fort> et touchez <Fort>Terminer mon tour</Fort>.</>): Etape => ({
  onglet: 'Enquête',
  cible: ['.btn-fin-tour'],
  texte: () => texte,
  attendre: tourFini,
});

// ---------------------------------------------------------------------------
// 1. Les bases
// ---------------------------------------------------------------------------

// Carnet : ce que le joueur sait innocent à ce moment (ses cartes et celles qu'on lui a montrées).
export const cartesVues = (v: VueJoueur) => [...new Set(v.moi.journal.flatMap((e) => (e.type === 'carte_vue' ? [e.carte] : [])))];
export const aEcarter = (v: VueJoueur) => [...new Set([...v.moi.main, ...cartesVues(v)])];
export const manquants = (v: VueJoueur) => aEcarter(v).filter((e) => v.moi.carnet.marques[e] !== 'ecarte');
export const enTrop = (v: VueJoueur) =>
  (Object.entries(v.moi.carnet.marques) as [ElementId, string][]).filter(([e, m]) => m === 'ecarte' && !aEcarter(v).includes(e)).map(([e]) => e);

export const aTrafique = (c: Contexte) => depuis(c).some((e) => e.type === 'ruse' && e.ruse === 'trafic');
export const aFalsifie = (c: Contexte) => aFait(c, 'falsification');
export const maReponse = (c: Contexte) =>
  [...depuis(c)].reverse().find((e) => e.type === 'carte_montree' || e.type === 'mensonge' || (e.type === 'ruse' && e.ruse === 'emprunt'));
export const ruses = (v: VueJoueur) => `${v.moi.rusesRestantes ?? 0} ruse${(v.moi.rusesRestantes ?? 0) > 1 ? 's' : ''}`;
