// Conseils pendant les premières vraies parties : une petite bulle la première fois que
// chaque situation se présente, avec « Compris ». Ce qui a déjà été vu ne revient pas.

import type { ReactNode } from 'react';
import { nomElement } from '../../../shared/data/catalogue';
import type { VueJoueur } from '../../../shared/types';
import type { Preferences } from '../../preferences';

interface Conseil {
  id: string;
  quand: (v: VueJoueur, c: { monTour: boolean; doitRepondre: boolean }) => boolean;
  texte: (v: VueJoueur) => ReactNode;
}

/** Conseils déjà couverts par la partie guidée, selon le chapitre terminé (ils sont alors marqués « vus »). */
export const CONSEILS_DU_TUTORIEL: Record<string, string[]> = {
  bases: ['premier-tour', 'interroge', 'resultat', 'archives', 'accusation'],
  complice: ['empreinte'],
};

const CONSEILS: Conseil[] = [
  {
    id: 'complice',
    quand: (v) => v.moi.role === 'complice',
    texte: (v) => (
      <>
        <strong>Vous êtes le complice !</strong> Le meurtrier est {v.moi.meurtrier ? nomElement(v.moi.meurtrier) : '…'} ; vous ignorez le lieu{v.regles.mode === 'grande' ? ", l'arme et le mobile" : " et l'arme"}.
        Empêchez les enquêteurs de trouver. Vos ruses sont dans « Mon rôle » : utilisez-les avec parcimonie, elles peuvent laisser des empreintes.
      </>
    ),
  },
  {
    id: 'interroge',
    quand: (_v, c) => c.doitRepondre,
    texte: () => (
      <>
        <strong>On vous interroge.</strong> Si vous avez une des cartes annoncées, montrez-en une : seul l'auteur de l'hypothèse la verra.
      </>
    ),
  },
  {
    id: 'resultat',
    quand: (v, c) => c.monTour && v.moi.journal.some((e) => e.type === 'carte_vue'),
    texte: () => <>La carte qu'on vous a montrée est <strong>innocente</strong> : marquez-la ✗ dans votre carnet.</>,
  },
  {
    id: 'premier-tour',
    quand: (_v, c) => c.monTour,
    texte: (v) => (
      <>
        <strong>C'est votre tour</strong> : {v.regles.pointsAction} points d'action. Une hypothèse coûte {v.regles.coutHypothese} PA, un dossier d'archives 1 PA. Quand vous avez fini, « Terminer mon tour ».
      </>
    ),
  },
  {
    id: 'archives',
    quand: (v, c) => c.monTour && v.manche >= 2 && v.archives.some((a) => a.disponible && !a.consulte),
    texte: () => <>Des <strong>dossiers d'archives</strong> sont ouverts : chacun cache un indice que vous seul lirez (1 PA).</>,
  },
  {
    id: 'empreinte',
    quand: (v) => v.historique.some((e) => e.type === 'empreinte'),
    texte: () => (
      <>
        Une <strong>empreinte</strong> a été relevée (voir l'historique) : elle innocente un joueur, ou date une ruse du complice. Recoupez-les pour le démasquer.
      </>
    ),
  },
  {
    id: 'accusation',
    quand: (v) => v.manche >= 6 && v.moi.role === 'enqueteur' && v.moi.peutAccuser,
    texte: () => (
      <>
        Déjà la manche {6} ! Quand vous êtes sûr de vous, tentez l'<strong>accusation finale</strong> : une seule par partie.
      </>
    ),
  },
];

export function ConseilsEnPartie({
  vue,
  monTour,
  doitRepondre,
  prefs,
  majPrefs,
}: {
  vue: VueJoueur;
  monTour: boolean;
  doitRepondre: boolean;
  prefs: Preferences;
  majPrefs: (p: Partial<Preferences>) => void;
}) {
  if (!prefs.conseils || vue.etape === 'terminee' || vue.pause) return null;
  const vus = new Set(prefs.conseilsVus);
  const conseil = CONSEILS.find((c) => !vus.has(c.id) && c.quand(vue, { monTour, doitRepondre }));
  if (!conseil) return null;
  const modaleOuverte = typeof document !== 'undefined' && !!document.querySelector('.voile');
  return (
    <aside className={`guide conseil${modaleOuverte ? ' guide-haut' : ''}`} role="status" aria-live="polite">
      <div className="guide-entete">
        <span>💡 Conseil</span>
      </div>
      <p className="guide-texte">{conseil.texte(vue)}</p>
      <div className="guide-pied">
        <button type="button" className="btn btn-discret btn-petit" onClick={() => majPrefs({ conseils: false })}>
          Ne plus afficher de conseils
        </button>
        <button type="button" className="btn btn-or btn-petit" onClick={() => majPrefs({ conseilsVus: [...prefs.conseilsVus, conseil.id] })}>
          Compris
        </button>
      </div>
    </aside>
  );
}
