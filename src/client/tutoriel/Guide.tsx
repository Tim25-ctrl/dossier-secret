// Bulle de la partie guidée : explique chaque étape, met en lumière l'élément à utiliser
// (le reste de l'écran est assombri et bloqué) et avance toute seule quand l'action est faite.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { nomElement } from '../../shared/data/manoir';
import type { ElementId, VueJoueur } from '../../shared/types';
import { connexion, useConnexion } from '../connexion';
import { CONFIG_PAR_DEFAUT } from '../../engine/config';
import { MOI, figerPartieGuidee, suggestionPartieGuidee } from './partieLocale';

interface Contexte {
  vue: VueJoueur;
  /** Vrai quand le joueur n'avance plus depuis un moment : le guide l'aide davantage. */
  aide: boolean;
}

interface Etape {
  /**
   * Élément mis en lumière (le reste de l'écran est assombri) : sélecteurs CSS, le premier visible gagne.
   * Un onglet à ouvrir passe avant (désigné par son nom).
   */
  cible?: string[] | ((c: Contexte) => string[]);
  onglet?: string;
  texte: (c: Contexte) => ReactNode;
  /** Condition qui fait passer à l'étape suivante ; sans condition, un bouton « Suivant ». */
  attendre?: (c: Contexte) => boolean;
  /**
   * Bouton « Suivant » : tant qu'il est affiché, la partie est en pause (bots et chronos arrêtés),
   * pour lire tranquillement.
   */
  bouton?: string;
  /**
   * Événement attendu avant d'afficher l'étape (coup d'un bot, réponse…) : en attendant, la partie
   * continue et la bulle affiche `attente`. Une fois arrivé, l'étape s'affiche (et fige la partie si
   * elle a un bouton).
   */
  quand?: (c: Contexte) => boolean;
  attente?: (c: Contexte) => ReactNode;
  /** Avancement de l'étape : s'il ne change plus pendant DELAI_AIDE_MS, le guide passe en mode aide. */
  progres?: (vue: VueJoueur) => string;
}

/** Délai sans progrès avant que le guide montre précisément quoi faire. */
const DELAI_AIDE_MS = 15_000;

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
const liste = (ids: ElementId[]) => ids.map((e) => `« ${nomElement(e)} »`).join(', ');

// Carnet : ce que le joueur sait innocent à ce moment du tutoriel (ses cartes et celles qu'on lui a montrées).
const cartesVues = (v: VueJoueur) => [...new Set(v.moi.journal.flatMap((e) => (e.type === 'carte_vue' ? [e.carte] : [])))];
const aEcarter = (v: VueJoueur) => [...new Set([...v.moi.main, ...cartesVues(v)])];
const manquants = (v: VueJoueur) => aEcarter(v).filter((e) => v.moi.carnet.marques[e] !== 'ecarte');
const enTrop = (v: VueJoueur) =>
  (Object.entries(v.moi.carnet.marques) as [ElementId, string][]).filter(([e, m]) => m === 'ecarte' && !aEcarter(v).includes(e)).map(([e]) => e);
const ligneCarnet = (e: ElementId) => `.carnet-ligne[data-element="${e}"]`;

const ETAPES_ENQUETEUR: Etape[] = [
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
        Le greffier enregistre votre hypothèse quelques secondes : c'est à ce moment que le complice peut la falsifier en secret. Ensuite, le joueur interrogé
        répond.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    quand: ({ vue }) => reponseMonHypothese(vue) !== null,
    attente: () => <>Le joueur interrogé répond…</>,
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
    // En mode aide, seule la ligne à corriger ou à cocher reste accessible.
    cible: ({ vue, aide }) => {
      const faux = enTrop(vue);
      const reste = manquants(vue);
      if (aide && faux.length) return [ligneCarnet(faux[0]), '.carnet-grille'];
      if (aide && reste.length) return [ligneCarnet(reste[0]), '.carnet-grille'];
      return ['.carnet-grille'];
    },
    texte: ({ vue, aide }) => {
      const vues = cartesVues(vue);
      const total = aEcarter(vue).length;
      const reste = manquants(vue);
      const faux = enTrop(vue);
      return (
        <>
          Marquez <strong>✗</strong> (écarté) les cartes que vous savez innocentes : <strong>vos {vue.moi.main.length} cartes</strong>
          {vues.length > 0 && (
            <>
              {' '}
              et <strong>{liste(vues)}</strong>, qu'on vous a montrée
            </>
          )}
          . Touchez une icône pour voir la carte en grand.
          <span className="guide-progres">
            Écartées : {total - reste.length}/{total}
          </span>
          {faux.length > 0 && (
            <span className="guide-alerte">
              ⚠️ Vous avez aussi écarté {liste(faux)}, mais rien ne prouve encore {faux.length > 1 ? 'leur' : 'son'} innocence. Remettez{' '}
              {faux.length > 1 ? 'ces lignes' : 'cette ligne'} sur <strong>?</strong>.
            </span>
          )}
          {aide && faux.length === 0 && reste.length > 0 && (
            <span className="guide-alerte">
              💡 Il vous reste à écarter : <strong>{liste(reste)}</strong>. Touchez le <strong>✗</strong> de la ligne mise en lumière.
            </span>
          )}
        </>
      );
    },
    attendre: ({ vue }) => manquants(vue).length === 0 && enTrop(vue).length === 0,
    progres: (vue) => `${manquants(vue).join()}|${enTrop(vue).join()}`,
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
    cible: ['.panneau-historique'],
    texte: () => (
      <>
        Votre tour est fini : place aux bots. Suivez l'<strong>historique</strong> : chaque hypothèse et chaque réponse y apparaissent. Hercule va bientôt vous
        interroger.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    quand: ({ vue }) => (vue.hypotheseEnCours?.aRepondre !== undefined && vue.hypotheseEnCours.repondantActuel === MOI) || aMontreUneCarte(vue),
    attente: () => <>Hercule joue… suivez l'historique.</>,
    cible: ['.modale'],
    texte: () => (
      <>
        <strong>On vous interroge !</strong> Si vous avez une des trois cartes, vous devez en montrer une (au choix). Seul celui qui demande la verra.
      </>
    ),
    attendre: ({ vue }) => aMontreUneCarte(vue),
  },
  {
    cible: ['.panneau-historique'],
    texte: () => (
      <>
        Bien joué : seul Hercule a vu votre carte. C'est ensuite au tour de Marple ; si elle vous interroge, répondez de la même façon. Puis votre tour reviendra.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    quand: ({ vue }) => monTour(vue),
    attente: () => <>Les bots jouent… Si l'on vous interroge, répondez. Votre tour revient ensuite.</>,
    onglet: 'Archives',
    cible: ['.btn-consulter:not(.piece)', '.btn-consulter'],
    texte: () => (
      <>
        Les <strong>archives</strong> cachent des indices. Ouvrez l'onglet <strong>Archives</strong> et consultez <strong>ce dossier</strong> (1 PA) : vous seul
        lirez son contenu.
      </>
    ),
    attendre: ({ vue }) => vue.moi.indicesConsultes.length > 0 || vue.moi.piecesConsultees.length > 0,
  },
  {
    cible: ['.indices .prive .indice', '.indices .prive'],
    texte: ({ vue }) =>
      vue.moi.indicesConsultes.length === 0 && vue.moi.piecesConsultees.length > 0 ? (
        <>
          C'est une <strong>pièce à conviction</strong> : une carte que personne n'a reçue. Elle est donc <strong>innocente</strong> ; pensez à l'écarter dans
          votre carnet.
        </>
      ) : (
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
        <span className="guide-progres">Pas maintenant : rien ne vous permet encore de soupçonner Hercule ou Marple.</span>
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
        <span className="guide-progres">Pas maintenant non plus : il vous faut d'abord rassembler des preuves.</span>
      </>
    ),
    bouton: 'Suivant',
  },
  {
    texte: ({ vue }) => (
      <>
        <strong>Vous savez tout !</strong> Continuez cette partie pour démasquer le coupable, ou quittez la partie guidée. Pendant vos premières vraies parties,
        quelques conseils apparaîtront encore. Pour découvrir l'autre camp, lancez ensuite la partie guidée <strong>du complice</strong> depuis l'accueil.
        {monTour(vue) && vue.pointsAction > 0 && (
          <span className="guide-progres">Il vous reste {vue.pointsAction} PA : consultez un autre dossier ou terminez votre tour.</span>
        )}
      </>
    ),
    bouton: 'Continuer à jouer',
  },
];

// ---------------------------------------------------------------------------
// Partie guidée du complice : vous protégez le meurtrier contre Hercule et Marple.
// ---------------------------------------------------------------------------

const aTrafique = (v: VueJoueur) => v.moi.journal.some((e) => e.type === 'ruse' && e.ruse === 'trafic');
const aFalsifie = (v: VueJoueur) => v.moi.journal.some((e) => e.type === 'falsification');
const maReponse = (v: VueJoueur) =>
  [...v.moi.journal].reverse().find((e) => e.type === 'carte_montree' || e.type === 'mensonge' || (e.type === 'ruse' && e.ruse === 'emprunt'));
const mesHypotheses = (v: VueJoueur) => v.moi.journal.filter((e) => e.type === 'hypothese_originale').length;
const ruses = (v: VueJoueur) => `${v.moi.rusesRestantes ?? 0} ruse${(v.moi.rusesRestantes ?? 0) > 1 ? 's' : ''}`;

const ETAPES_COMPLICE: Etape[] = [
  {
    texte: ({ vue }) => (
      <>
        <strong>Cette fois, vous êtes le complice !</strong> Vous savez que le meurtrier est <strong>{nomElement(vue.moi.meurtrier!)}</strong>, mais vous ignorez le
        lieu et l'arme. Hercule et Marple enquêtent : vous gagnez si <strong>personne ne trouve la solution</strong> avant la fin de la 12ᵉ manche.
      </>
    ),
    bouton: 'Commencer',
  },
  {
    cible: ['.colonne-gauche .prive', '.bande-cartes'],
    texte: ({ vue }) => (
      <>
        Votre rôle reste <strong>secret</strong>. Comme tout le monde, vous avez des cartes et vous répondez quand on vous interroge. Mais vous avez aussi{' '}
        <strong>{ruses(vue)}</strong> en réserve : des tricheries que personne ne voit. Essayons-les une par une.
        <span className="guide-progres">
          {ruses(vue)}, c'est seulement pour cette partie guidée, afin de tout essayer. En vraie partie, le complice en a {CONFIG_PAR_DEFAUT.ruses[3]} à 3 joueurs,{' '}
          {CONFIG_PAR_DEFAUT.ruses[4]} à 4 et {CONFIG_PAR_DEFAUT.ruses[5]} à 5 ou 6.
        </span>
      </>
    ),
    bouton: 'Suivant',
  },
  {
    onglet: 'Archives',
    cible: ['.btn-trafiquer'],
    texte: () => (
      <>
        Première ruse : <strong>trafiquer un dossier</strong>. Ouvrez l'onglet <strong>Archives</strong> et touchez <strong>Consulter et trafiquer</strong> (1 PA + 1
        ruse). Vous lirez le vrai indice ; ceux qui ouvriront ce dossier après vous liront un <strong>faux</strong>.
      </>
    ),
    attendre: ({ vue }) => aTrafique(vue) || vue.moi.indicesConsultes.length > 0,
  },
  {
    cible: ['.indices .prive'],
    texte: () => (
      <>
        Voici le vrai indice et, en rouge, le titre du faux que liront les suivants. Il les enverra sur une fausse piste… sans que personne sache qui a trafiqué le
        dossier.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    onglet: 'Enquête',
    cible: ['.btn-fin-tour'],
    texte: () => (
      <>
        Il vous reste 1 PA : pas assez pour une hypothèse (2 PA). Revenez sur <strong>Enquête</strong> et touchez <strong>Terminer mon tour</strong>.
      </>
    ),
    attendre: ({ vue }) => vue.joueurActif !== MOI,
  },
  {
    cible: ['.panneau-historique'],
    texte: () => (
      <>
        Au tour d'Hercule. Quand un joueur formule une hypothèse, <strong>vous la voyez avant tout le monde</strong> : c'est le moment d'une autre ruse…
      </>
    ),
    bouton: 'Suivant',
  },
  {
    quand: ({ vue }) => (!!vue.hypotheseEnCours && vue.hypotheseEnCours.auteur !== MOI) || aFalsifie(vue) || !!maReponse(vue) || monTour(vue),
    attente: () => <>Hercule réfléchit à son hypothèse…</>,
    cible: ['.modale'],
    texte: ({ vue }) => (
      <>
        Deuxième ruse : <strong>falsifier l'hypothèse</strong> d'Hercule (1 ruse). Choisissez l'élément à changer, puis ce que
        les autres verront à la place. Marple verra la version modifiée ; Hercule garde la sienne et <strong>n'est jamais prévenu</strong>.
      </>
    ),
    attendre: ({ vue }) => {
      const h = vue.hypotheseEnCours;
      return aFalsifie(vue) || !h || h.etape !== 'falsification' || !h.falsification || h.falsification.decide;
    },
  },
  {
    quand: ({ vue }) => (vue.hypotheseEnCours?.repondantActuel === MOI && !!vue.hypotheseEnCours.aRepondre) || !!maReponse(vue) || monTour(vue),
    attente: () => <>Le greffier enregistre l'hypothèse, puis Hercule vous interroge…</>,
    cible: ['.modale'],
    texte: ({ vue }) => {
      const a = vue.hypotheseEnCours?.repondantActuel === MOI ? vue.hypotheseEnCours.aRepondre : undefined;
      if (!a || a.cartesCorrespondantes.length === 0) return <>Hercule vous interroge : répondez.</>;
      return (
        <>
          Hercule vous interroge, et vous avez <strong>{liste(a.cartesCorrespondantes)}</strong>. Un enquêteur devrait la montrer. Vous, vous pouvez{' '}
          <strong>mentir</strong> : répondez « aucune carte » (1 ruse), et Hercule croira que vous n'avez rien.
          <span className="guide-progres">
            Autre ruse : montrer une carte que vous n'avez pas (2 ruses). Idéale si c'est le vrai lieu ou la vraie arme : l'enquêteur l'écartera à tort.
          </span>
        </>
      );
    },
    attendre: ({ vue }) => !!maReponse(vue) || monTour(vue),
  },
  {
    cible: ['.panneau-historique'],
    texte: ({ vue }) => {
      const r = maReponse(vue);
      const debut =
        r?.type === 'mensonge' ? (
          <>
            Vous avez <strong>menti</strong> : Hercule pense que vous n'avez aucune de ces cartes, il risque d'en soupçonner une à tort.
          </>
        ) : r?.type === 'ruse' ? (
          <>
            Vous avez montré une carte <strong>empruntée</strong> : Hercule la croit innocente.
          </>
        ) : (
          <>
            Vous avez répondu <strong>honnêtement</strong>. C'est parfois le meilleur moyen de passer inaperçu : gardez vos ruses pour les moments décisifs.
          </>
        );
      return (
        <>
          {debut} Dans l'historique, personne ne voit que vous avez rusé.
        </>
      );
    },
    bouton: 'Suivant',
  },
  {
    cible: ['.panneau-historique'],
    texte: ({ vue }) => (
      <>
        C'est ensuite au tour de Marple. Si elle formule une hypothèse, la fenêtre de falsification s'ouvrira : il vous reste <strong>{ruses(vue)}</strong>. Vous
        pouvez aussi choisir <strong>Ne rien changer</strong> : gardez vos ruses pour plus tard !
      </>
    ),
    bouton: 'Suivant',
  },
  {
    quand: ({ vue }) => monTour(vue),
    attente: () => <>Les bots jouent… Si la fenêtre de falsification s'ouvre, à vous de choisir ; si l'on vous interroge, répondez.</>,
    cible: ['.actions .btn-or', '.modale'],
    texte: ({ vue }) => (
      <>
        À vous. Pour ne pas attirer l'attention, <strong>jouez comme un enquêteur</strong> : formulez une hypothèse. Vous connaissez le meurtrier (
        {nomElement(vue.moi.meurtrier!)}), mais pas le lieu ni l'arme : les découvrir vous dira quelle carte « emprunter » pour égarer les enquêteurs.
      </>
    ),
    attendre: ({ vue }) => mesHypotheses(vue) > 0,
  },
  {
    quand: ({ vue }) => reponseMonHypothese(vue) !== null,
    attente: () => <>Le joueur interrogé vous répond…</>,
    cible: ['.resultat-hypothese'],
    texte: ({ vue }) => {
      const r = reponseMonHypothese(vue);
      return r?.type === 'carte_vue' ? (
        <>
          {nom(vue, r.de)} vous montre <strong>{nomElement(r.carte)}</strong> : elle ne fait donc pas partie de la solution. Hypothèse après hypothèse, vous
          découvrirez le lieu et l'arme… et saurez mieux mentir.
        </>
      ) : (
        <>
          Personne n'a de carte à vous montrer : le lieu ou l'arme de votre hypothèse fait peut-être partie de la solution. Bonne piste pour vos ruses !
        </>
      );
    },
    bouton: 'Suivant',
  },
  {
    texte: () => (
      <>
        Attention aux <strong>empreintes</strong> : chaque ruse a une chance d'en laisser une dans l'historique, quelques manches plus tard (jamais avant la
        manche 4). À 3 joueurs, elle ne nomme personne mais indique la manche de la ruse. En les recoupant, les enquêteurs peuvent vous{' '}
        <strong>dénoncer</strong> : vos ruses sont alors suspendues 3 manches. Rusez au bon moment, pas à chaque occasion.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    texte: ({ vue }) => (
      <>
        <strong>Vous savez jouer le complice !</strong> Continuez cette partie pour tenir jusqu'à la manche 12, ou quittez la partie guidée.
        {monTour(vue) && <span className="guide-progres">Pensez à terminer votre tour.</span>}
      </>
    ),
    bouton: 'Continuer à jouer',
  },
];

/** L'onglet à ouvrir s'il ne l'est pas encore, sinon le premier élément visible parmi les sélecteurs. */
function trouverCible(e: Etape, c: Contexte): HTMLElement | null {
  if (e.onglet) {
    const tab = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent?.includes(e.onglet!) && t.offsetParent !== null);
    if (tab && tab.getAttribute('aria-selected') !== 'true') return tab;
  }
  const selecteurs = typeof e.cible === 'function' ? e.cible(c) : (e.cible ?? []);
  for (const s of selecteurs) {
    const el = [...document.querySelectorAll<HTMLElement>(s)].find((x) => x.offsetParent !== null);
    if (el) return el;
  }
  return null;
}

interface Zone {
  haut: number;
  bas: number;
}

/**
 * Partie de l'écran où le jeu défile : sous l'en-tête collant (barre du haut et cartes) et, sur
 * téléphone, au-dessus de la barre d'onglets fixe. Un élément qui passe sous ces barres est caché par elles.
 */
function zoneVisible(cible: HTMLElement): Zone {
  let haut = 0;
  let bas = window.innerHeight;
  const barre = document.querySelector<HTMLElement>('.barre-jeu');
  if (barre && !barre.contains(cible)) haut = Math.max(haut, barre.getBoundingClientRect().bottom);
  const onglets = document.querySelector<HTMLElement>('.onglets');
  if (onglets && !onglets.contains(cible) && getComputedStyle(onglets).position === 'fixed') bas = Math.min(bas, onglets.getBoundingClientRect().top);
  return { haut, bas };
}

/** L'élément est-il dans une barre qui ne défile pas (en-tête, onglets) ? */
const dansUneBarre = (el: HTMLElement) => !!el.closest('.barre-jeu, .onglets');

/**
 * Voile sombre sur tout l'écran sauf l'élément mis en lumière, qu'il suit pendant le défilement.
 * Il bloque les clics ailleurs : on ne peut faire que ce que l'étape demande. Quand l'étape
 * n'est qu'une explication, l'élément lui-même est bloqué (on passe à la suite avec la bulle).
 */
function VoileGuide({ cible, trouActif }: { cible: HTMLElement | null; trouActif: boolean }) {
  // Trou du voile : l'élément (avec une petite marge), coupé par les barres fixes qui passent devant.
  const [r, setR] = useState<{ haut: number; bas: number; gauche: number; droite: number } | null>(null);
  useLayoutEffect(() => {
    if (!cible) {
      setR(null);
      return;
    }
    let id = 0;
    const suivre = () => {
      const b = cible.getBoundingClientRect();
      const z = zoneVisible(cible);
      const marge = 7;
      const haut = Math.max(z.haut, b.top - marge);
      const n = { haut, bas: Math.max(haut, Math.min(z.bas, b.bottom + marge)), gauche: Math.max(0, b.left - marge), droite: Math.max(0, b.right + marge) };
      setR((p) => (p && p.haut === n.haut && p.bas === n.bas && p.gauche === n.gauche && p.droite === n.droite ? p : n));
      id = requestAnimationFrame(suivre);
    };
    suivre();
    return () => cancelAnimationFrame(id);
  }, [cible]);

  if (!cible || !r) return <div className="guide-voile" style={{ inset: 0 }} aria-hidden="true" />;
  const { haut, bas, gauche } = r;
  const droite = Math.max(gauche, r.droite);
  return (
    <div aria-hidden="true">
      <div className="guide-voile" style={{ top: 0, left: 0, right: 0, height: haut }} />
      <div className="guide-voile" style={{ top: bas, left: 0, right: 0, bottom: 0 }} />
      <div className="guide-voile" style={{ top: haut, height: bas - haut, left: 0, width: gauche }} />
      <div className="guide-voile" style={{ top: haut, height: bas - haut, left: droite, right: 0 }} />
      <div className={`guide-trou${trouActif ? '' : ' bloque'}`} style={{ top: haut, left: gauche, width: droite - gauche, height: bas - haut }} />
    </div>
  );
}

export function GuideTutoriel({ onTermine }: { onTermine: () => void }) {
  const etat = useConnexion().etat;
  const vue = etat?.partie ?? null;
  const [i, setI] = useState(0);
  const [reduit, setReduit] = useState(false);
  const [, setTic] = useState(0);
  const etapes = vue?.moi.role === 'complice' ? ETAPES_COMPLICE : ETAPES_ENQUETEUR;
  const etape = etapes[i];

  // Re-vérifie régulièrement (actions des bots, onglet ouvert, élément à surligner).
  useEffect(() => {
    const t = setInterval(() => setTic((x) => x + 1), 400);
    return () => clearInterval(t);
  }, []);

  const termine = i >= etapes.length;

  // Mode aide : l'étape n'avance plus depuis DELAI_AIDE_MS.
  // Une fois déclenchée, l'aide reste active jusqu'à la fin de l'étape.
  const avancement = useRef({ cle: '', depuis: Date.now(), aideEtape: -1 });
  const cle = !vue || termine ? '' : `${i}|${etape.progres?.(vue) ?? ''}`;
  if (avancement.current.cle !== cle) avancement.current = { ...avancement.current, cle, depuis: Date.now() };
  if (!termine && etape.progres && Date.now() - avancement.current.depuis >= DELAI_AIDE_MS) avancement.current.aideEtape = i;
  const aide = avancement.current.aideEtape === i;
  const contexte: Contexte | null = vue ? { vue, aide } : null;

  // Étape « prête » : l'événement qu'elle attend est arrivé (une fois arrivé, il le reste).
  const pretPour = useRef(-1);
  if (contexte && !termine && (!etape.quand || etape.quand(contexte))) pretPour.current = i;
  const pret = pretPour.current === i;

  // Pendant une explication (bouton « Suivant »), la partie est figée : rien ne se passe sans vous.
  const gel = !!contexte && !termine && !reduit && pret && !!etape.bouton && contexte.vue.etape !== 'terminee';
  useEffect(() => figerPartieGuidee(gel), [gel]);
  useEffect(() => () => figerPartieGuidee(false), []);

  const cible = !termine && !reduit && pret && contexte ? trouverCible(etape, contexte) : null;
  useEffect(() => {
    if (!cible) return;
    cible.classList.add('tuto-cible');
    return () => cible.classList.remove('tuto-cible');
  });
  // Amène l'élément mis en lumière juste sous l'en-tête (une fois par élément), pour que la bulle,
  // en bas de l'écran, ne le cache pas. Rien à faire pour un élément des barres fixes ou d'une fenêtre.
  const defile = useRef<HTMLElement | null>(null);
  const bulle = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!cible || defile.current === cible) return;
    defile.current = cible;
    if (dansUneBarre(cible) || cible.closest('.voile')) return;
    const b = cible.getBoundingClientRect();
    const z = zoneVisible(cible);
    const basLibre = z.bas - (bulle.current?.offsetHeight ?? 0) - 12;
    if (b.top >= z.haut + 4 && b.bottom <= basLibre) return;
    window.scrollBy({ top: b.top - z.haut - 14, behavior: 'smooth' });
  });
  // De la place sous la page, pour que la bulle ne cache jamais le bas du jeu.
  useEffect(() => {
    document.body.classList.add('avec-guide');
    return () => document.body.classList.remove('avec-guide');
  }, []);

  // Passage automatique quand l'action demandée est faite.
  useEffect(() => {
    if (!contexte || termine || !etape.attendre) return;
    if (etape.attendre(contexte)) setI((x) => x + 1);
  });

  useEffect(() => {
    if (termine) onTermine();
  }, [termine]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!contexte || termine || contexte.vue.etape === 'terminee') return null;
  const modaleOuverte = !!document.querySelector('.voile');
  const enPause = gel && (contexte.vue.joueurActif !== MOI || contexte.vue.etape === 'hypothese');
  const rc = cible?.getBoundingClientRect();
  const enHaut = modaleOuverte || (!!rc && rc.height < window.innerHeight * 0.45 && (rc.top + rc.bottom) / 2 > window.innerHeight * 0.55);

  if (reduit)
    return (
      <button type="button" className="guide-reduit" onClick={() => setReduit(false)}>
        🎓 Guide ({i + 1}/{etapes.length})
      </button>
    );

  // Onglet à ouvrir d'abord : le bouton « Suivant » attend que ce soit fait.
  const ongletAOuvrir = etape.onglet && cible?.getAttribute('role') === 'tab' ? etape.onglet : null;
  // Une fenêtre ouverte (interrogation, hypothèse…) passe au premier plan : pas de voile par-dessus.
  // Sans élément à montrer, le voile ne couvre tout que sur une étape d'explication (rien à cliquer).
  const voile = pret && !modaleOuverte && (cible || etape.bouton) ? <VoileGuide cible={cible} trouActif={!etape.bouton || !!ongletAOuvrir} /> : null;

  return (
    <>
      {voile}
      <aside ref={bulle} className={`guide${enHaut ? ' guide-haut' : ''}`} role="status" aria-live="polite">
        <div className="guide-entete">
          <span>
            🎓 Partie guidée · {i + 1}/{etapes.length}
            {enPause && <span className="guide-pause"> · ⏸ pause</span>}
          </span>
          <button type="button" className="btn btn-discret btn-petit" onClick={() => setReduit(true)} aria-label="Réduire le guide">
            ▾
          </button>
        </div>
        <p className="guide-texte">{pret ? etape.texte(contexte) : (etape.attente?.(contexte) ?? 'La partie continue…')}</p>
        <div className="guide-pied">
          <button type="button" className="btn btn-discret btn-petit" onClick={() => connexion.arreterLocal()}>
            <span className="libelle-long">Quitter la partie guidée</span>
            <span className="libelle-court">Quitter</span>
          </button>
          {!pret ? (
            <span className="petit muet">⏳ La partie continue…</span>
          ) : ongletAOuvrir ? (
            <span className="petit muet">👉 Ouvrez l'onglet « {ongletAOuvrir} »</span>
          ) : etape.bouton ? (
            <button type="button" className="btn btn-or btn-petit" onClick={() => setI((x) => x + 1)}>
              {etape.bouton}
            </button>
          ) : (
            <span className="petit muet">À vous de jouer…</span>
          )}
        </div>
      </aside>
    </>
  );
}
