// Bulle de la partie guidée : explique chaque étape, montre où cliquer (élément surligné)
// et avance toute seule quand l'action demandée est faite.

import { useEffect, useState, type ReactNode } from 'react';
import { nomElement } from '../../shared/data/manoir';
import type { VueJoueur } from '../../shared/types';
import { connexion, useConnexion } from '../connexion';
import { MOI, suggestionPartieGuidee } from './partieLocale';

interface Contexte {
  vue: VueJoueur;
}

interface Etape {
  /** Élément à surligner : sélecteurs CSS (le premier visible gagne) ou onglet désigné par son nom. */
  cible?: string[];
  onglet?: string;
  texte: (c: Contexte) => ReactNode;
  /** Condition qui fait passer à l'étape suivante ; sans condition, un bouton « Suivant ». */
  attendre?: (c: Contexte) => boolean;
  bouton?: string;
}

const nom = (v: VueJoueur, id: string) => v.joueurs.find((j) => j.id === id)?.nom ?? id;
const ongletActif = (texte: string) => [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].some((t) => t.textContent?.includes(texte));
const reponseMonHypothese = (v: VueJoueur) => {
  const journal = [...v.moi.journal].reverse();
  const origine = journal.find((e) => e.type === 'hypothese_originale');
  const reponse = journal.find((e) => e.type === 'carte_vue' || e.type === 'aucune_carte_vue');
  return origine && reponse && 'hypothese' in reponse && origine.type === 'hypothese_originale' && reponse.hypothese === origine.hypothese ? reponse : null;
};
const aMontreUneCarte = (v: VueJoueur) => v.moi.journal.some((e) => e.type === 'carte_montree');
const monTour = (v: VueJoueur) => v.joueurActif === MOI && v.etape === 'tour';

const ETAPES: Etape[] = [
  {
    texte: () => (
      <>
        <strong>Bienvenue au Manoir des Brumes !</strong> Armand de Valombre a été assassiné. Votre but : découvrir <strong>qui</strong>,{' '}
        <strong>où</strong> et <strong>avec quelle arme</strong>. Vous jouez contre deux bots, Hercule et Marple. L'un des deux est le{' '}
        <strong>complice</strong> : il connaît le meurtrier et va essayer de vous tromper.
      </>
    ),
    bouton: 'Commencer',
  },
  {
    cible: ['.colonne-gauche .prive', '.bande-cartes'],
    texte: ({ vue }) => (
      <>
        Voici <strong>vos cartes</strong> : {vue.moi.main.map((c) => nomElement(c)).join(', ')}. Elles sont <strong>innocentes</strong> : aucune ne fait partie de
        la solution. Elles servent aussi à répondre quand on vous interroge.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    cible: ['.bandeau-tour'],
    texte: () => (
      <>
        C'est <strong>votre tour</strong>. Vous avez <strong>2 points d'action (PA)</strong> : une hypothèse coûte 2 PA, consulter un dossier d'archives 1 PA.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    cible: ['.actions .btn-or', '.modale'],
    texte: () => {
      const s = suggestionPartieGuidee();
      return (
        <>
          Formulez une <strong>hypothèse</strong> : un suspect, un lieu, une arme, puis le joueur à interroger.
          {s && (
            <>
              {' '}
              Essayez par exemple <strong>{nomElement(s.suspect)}</strong>, <strong>{nomElement(s.lieu)}</strong>, <strong>{nomElement(s.arme)}</strong>, et interrogez{' '}
              <strong>Hercule</strong>.
            </>
          )}
        </>
      );
    },
    attendre: ({ vue }) => vue.moi.journal.some((e) => e.type === 'hypothese_originale'),
  },
  {
    cible: ['.suivi-hypothese'],
    texte: () => (
      <>
        Le greffier enregistre votre hypothèse quelques secondes (c'est à ce moment que le complice peut la falsifier en secret), puis le joueur interrogé répond…
      </>
    ),
    attendre: ({ vue }) => reponseMonHypothese(vue) !== null,
  },
  {
    cible: ['.resultat-hypothese'],
    texte: ({ vue }) => {
      const r = reponseMonHypothese(vue);
      return r?.type === 'carte_vue' ? (
        <>
          {nom(vue, r.de)} vous montre <strong>{nomElement(r.carte)}</strong>, en secret : vous seul l'avez vue. Cette carte est donc <strong>innocente</strong>.
        </>
      ) : (
        <>
          Personne ne vous a montré de carte. Attention : soit personne n'en avait, soit… le <strong>complice a menti</strong> !
        </>
      );
    },
    bouton: 'Suivant',
  },
  {
    onglet: 'Carnet',
    texte: () => (
      <>
        Notez ce que vous savez dans votre <strong>carnet</strong> : ouvrez l'onglet <strong>Carnet</strong>.
      </>
    ),
    attendre: () => ongletActif('Carnet'),
  },
  {
    cible: ['.carnet-grille'],
    texte: () => (
      <>
        Marquez <strong>✗</strong> (écarté) vos cartes et celle qu'on vous a montrée. Touchez une icône pour voir la carte en grand. Personne d'autre ne voit votre
        carnet.
      </>
    ),
    attendre: ({ vue }) => Object.values(vue.moi.carnet.marques).filter((m) => m === 'ecarte').length >= 2,
  },
  {
    onglet: 'Enquête',
    cible: ['.btn-fin-tour'],
    texte: () => (
      <>
        Revenez sur <strong>Enquête</strong> et touchez <strong>Terminer mon tour</strong>.
      </>
    ),
    attendre: ({ vue }) => vue.joueurActif !== MOI,
  },
  {
    texte: () => <>Au tour des bots. Observez l'historique : chaque hypothèse et chaque réponse y apparaissent. Hercule va bientôt vous interroger…</>,
    attendre: ({ vue }) => (vue.hypotheseEnCours?.aRepondre !== undefined && vue.hypotheseEnCours.repondantActuel === MOI) || aMontreUneCarte(vue),
  },
  {
    cible: ['.modale'],
    texte: () => (
      <>
        <strong>On vous interroge !</strong> Si vous avez une des trois cartes, vous devez en montrer une (au choix). Seul celui qui demande la verra.
      </>
    ),
    attendre: ({ vue }) => aMontreUneCarte(vue),
  },
  {
    texte: () => (
      <>
        Bien joué. Marple joue maintenant son tour ; si elle vous interroge à son tour, répondez de la même façon. Le vôtre revient ensuite…
      </>
    ),
    attendre: ({ vue }) => monTour(vue),
  },
  {
    onglet: 'Archives',
    texte: () => (
      <>
        Les <strong>archives</strong> cachent des indices. Ouvrez l'onglet <strong>Archives</strong> et consultez un dossier (1 PA) : vous seul lirez son contenu.
      </>
    ),
    attendre: ({ vue }) => vue.moi.indicesConsultes.length > 0 || vue.moi.piecesConsultees.length > 0,
  },
  {
    cible: ['.prive .indice', '.prive'],
    texte: () => (
      <>
        Comme celui-ci, un indice relie deux éléments (« si c'est ici, ce n'était pas avec cela »). Il n'innocente rien à lui seul : il devient décisif en le
        croisant avec les cartes que vous connaissez.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    onglet: 'Enquête',
    cible: ['.btn-denoncer'],
    texte: () => (
      <>
        <strong>Le complice</strong> a des ruses : mentir, montrer une carte qu'il n'a pas, falsifier une hypothèse, trafiquer un dossier. Elles laissent parfois
        des <strong>empreintes</strong> dans l'historique. Si vous pensez l'avoir trouvé, <strong>dénoncez-le</strong> (1 PA, une seule fois) : si vous vous
        trompez, vous perdez votre prochain tour.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    onglet: 'Enquête',
    cible: ['.actions .btn-danger'],
    texte: () => (
      <>
        Quand vous êtes sûr de vous : <strong>Accusation finale</strong>. Une seule par partie ! Juste, vous gagnez ; fausse, vous ne pouvez plus accuser.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    texte: () => (
      <>
        <strong>Vous savez tout !</strong> Continuez cette partie pour démasquer le coupable, ou quittez la partie guidée. Pendant vos premières vraies parties,
        quelques conseils apparaîtront encore.
      </>
    ),
    bouton: 'Continuer à jouer',
  },
];

/** Premier élément visible parmi des sélecteurs, ou l'onglet portant ce nom. */
function trouverCible(e: Etape): HTMLElement | null {
  if (e.onglet) {
    const tab = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent?.includes(e.onglet!) && t.offsetParent !== null);
    if (tab && t_estPasActif(tab)) return tab;
  }
  for (const s of e.cible ?? []) {
    const el = [...document.querySelectorAll<HTMLElement>(s)].find((x) => x.offsetParent !== null);
    if (el) return el;
  }
  return null;
}
function t_estPasActif(tab: HTMLElement) {
  return tab.getAttribute('aria-selected') !== 'true';
}

export function GuideTutoriel({ onTermine }: { onTermine: () => void }) {
  const etat = useConnexion().etat;
  const vue = etat?.partie ?? null;
  const [i, setI] = useState(0);
  const [reduit, setReduit] = useState(false);
  const [, setTic] = useState(0);
  const etape = ETAPES[i];

  // Re-vérifie régulièrement (actions des bots, onglet ouvert, élément à surligner).
  useEffect(() => {
    const t = setInterval(() => setTic((x) => x + 1), 400);
    return () => clearInterval(t);
  }, []);

  const termine = i >= ETAPES.length;
  const cible = !termine && !reduit ? trouverCible(etape) : null;
  useEffect(() => {
    if (!cible) return;
    cible.classList.add('tuto-cible');
    return () => cible.classList.remove('tuto-cible');
  });
  const [defile, setDefile] = useState(-1);
  useEffect(() => {
    if (cible && defile !== i) {
      cible.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setDefile(i);
    }
  });
  // De la place sous la page, pour que la bulle ne cache jamais le bas du jeu.
  useEffect(() => {
    document.body.classList.add('avec-guide');
    return () => document.body.classList.remove('avec-guide');
  }, []);

  // Passage automatique quand l'action demandée est faite.
  useEffect(() => {
    if (!vue || termine || !etape.attendre) return;
    if (etape.attendre({ vue })) setI((x) => x + 1);
  });

  useEffect(() => {
    if (termine) onTermine();
  }, [termine]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!vue || termine || vue.etape === 'terminee') return null;
  const modaleOuverte = !!document.querySelector('.voile');

  if (reduit)
    return (
      <button type="button" className="guide-reduit" onClick={() => setReduit(false)}>
        🎓 Guide ({i + 1}/{ETAPES.length})
      </button>
    );

  return (
    <aside className={`guide${modaleOuverte ? ' guide-haut' : ''}`} role="status" aria-live="polite">
      <div className="guide-entete">
        <span>
          🎓 Partie guidée · {i + 1}/{ETAPES.length}
        </span>
        <button type="button" className="btn btn-discret btn-petit" onClick={() => setReduit(true)} aria-label="Réduire le guide">
          ▾
        </button>
      </div>
      <p className="guide-texte">{etape.texte({ vue })}</p>
      <div className="guide-pied">
        <button type="button" className="btn btn-discret btn-petit" onClick={() => connexion.arreterLocal()}>
          Quitter la partie guidée
        </button>
        {etape.bouton ? (
          <button type="button" className="btn btn-or btn-petit" onClick={() => setI((x) => x + 1)}>
            {etape.bouton}
          </button>
        ) : (
          <span className="petit muet">À vous de jouer…</span>
        )}
      </div>
    </aside>
  );
}
