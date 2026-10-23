// Les chapitres de la partie guidée classique. Une seule partie (vous et trois bots, complice rusé),
// où vous êtes enquêteur, puis le complice, puis de nouveau enquêteur pour l'accusation finale.

import type { ReactNode } from 'react';
import { CONFIG_PAR_DEFAUT } from '../../engine/config';
import type { EtatPartie } from '../../engine/partie';
import { nomElement } from '../../shared/data/catalogue';
import { categorieDe, type ActionJeu, type VueJoueur } from '../../shared/types';
import type { Chapitre, Etape } from './Guide';
import {
  Conseil,
  Fort,
  PANNEAU_ROLE,
  aEcarter,
  aFait,
  aFalsifie,
  aTrafique,
  cartesVues,
  court,
  depuis,
  enTrop,
  hypothese,
  ligneCarnet,
  liste,
  maReponse,
  manquants,
  monTour,
  reponseRecue,
  ruses,
  sonTour,
  terminerTour,
  tripletTexte,
} from './outils';
import { HERCULE, MARPLE, MOI, SHERLOCK, hypotheseAvec } from './scenario';

const C = CONFIG_PAR_DEFAUT;
const NB = 4; // joueurs de la partie guidée
const HYP = C.coutHypothese;
const etapesListe = (manches: number[]) => `${manches.slice(0, -1).join(', ')} et ${manches.at(-1)}`;

/** Le panneau d'interrogation, quand c'est à vous de répondre. */
const interroge = (v: VueJoueur) => v.hypotheseEnCours?.aRepondre !== undefined && v.hypotheseEnCours.repondantActuel === MOI;

// ---------------------------------------------------------------------------
// 1. Les bases
// ---------------------------------------------------------------------------

const BASES: Etape[] = [
  {
    texte: () => (
      <>
        <Fort>Bienvenue au Manoir des Brumes !</Fort> Armand de Valombre a été assassiné cette nuit. Pour résoudre l'affaire, il faut trouver <Fort>qui</Fort> l'a
        tué, <Fort>où</Fort>, et avec <Fort>quelle arme</Fort>. Vous jouez contre trois bots : Marple, Hercule et Sherlock. L'un d'eux est le{' '}
        <Fort>complice</Fort> du meurtrier : il connaît le coupable et va tout faire pour vous égarer.
        <span className="guide-progres">
          Cette partie guidée compte 5 chapitres. Le bouton « Chapitres » permet à tout moment d'en refaire un ou d'en sauter.
        </span>
      </>
    ),
    bouton: 'Commencer',
  },
  {
    cible: ['.modale'],
    texte: () => (
      <>
        Au début de chaque partie, cette fenêtre vous montre <Fort>votre rôle secret</Fort> : enquêteur, ou complice. Vous seul le voyez. Ici, vous êtes enquêteur.
        Touchez <Fort>J'ai compris : je suis prêt</Fort> : la partie commence quand tous les joueurs ont confirmé (au plus tard au bout de 3 minutes).
      </>
    ),
    attendre: ({ vue }) => !vue.attenteDepart,
  },
  {
    cible: PANNEAU_ROLE,
    texte: ({ vue }) => (
      <>
        Voici <Fort>vos cartes</Fort> : {vue.moi.main.map((c) => nomElement(c)).join(', ')}. Elles sont <Fort>innocentes</Fort> : aucune ne fait partie de la
        solution. Elles servent aussi à répondre quand on vous interroge. À {NB} joueurs, chacun en reçoit {vue.moi.main.length} ; les cartes restantes,
        que personne n'a reçues, sont rangées dans les archives (chapitre 2).
      </>
    ),
    bouton: 'Suivant',
  },
  {
    cible: ['.barre-jeu .indicateurs'],
    texte: () => (
      <>
        En haut : la <Fort>manche</Fort> (1 sur {C.manchesMax}), le joueur dont c'est le <Fort>tour</Fort>, vos <Fort>points d'action</Fort> et le temps qu'il
        reste pour jouer (sans limite dans la partie guidée ; dans une vraie partie, le salon choisit la durée d'un tour). Si personne n'a trouvé à la fin de la{' '}
        {C.manchesMax}ᵉ manche, le complice gagne.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    cible: ['.bandeau-tour'],
    texte: () => (
      <>
        C'est <Fort>votre tour</Fort>. Vous avez <Fort>{C.pointsAction} points d'action (PA)</Fort> :
        <span className="guide-progres">
          Hypothèse : {HYP} PA (tout votre tour) · Consulter un dossier d'archives : 1 PA · Dénoncer le complice : 1 PA. Le carnet est gratuit. Rien ne vous oblige à
          tout dépenser.
        </span>
      </>
    ),
    bouton: 'Suivant',
  },
  {
    cible: ['.actions .btn-or', '.modale'],
    texte: ({ p, vue }) => (
      <>
        Formulez une <Fort>hypothèse</Fort> : un suspect, un lieu, une arme, puis deux joueurs à interroger, dans l'ordre. Ce n'est pas une accusation : c'est une
        question, pour obtenir des informations.
        <Conseil t={hypotheseAvec(p.etat, HERCULE, [SHERLOCK])} interroges={[HERCULE, SHERLOCK]} v={vue} />
      </>
    ),
    attendre: (c) => aFait(c, 'hypothese_originale'),
  },
  {
    cible: ['.suivi-hypothese'],
    texte: () => (
      <>
        Avant d'être annoncée à tous, votre hypothèse reste quelques secondes chez le <Fort>greffier</Fort> : c'est le moment où le complice peut la{' '}
        <Fort>falsifier</Fort> en secret (changer un élément de la version que les autres verront). Vous, vous voyez toujours la vôtre, et les réponses sont
        toujours calculées sur elle. Ensuite, les joueurs interrogés répondent dans l'ordre : le premier qui a une des cartes doit en montrer une, et l'interrogation
        s'arrête là.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    quand: (c) => reponseRecue(c) !== null,
    attente: () => <>Les joueurs interrogés répondent…</>,
    cible: ['.resultat-hypothese'],
    texte: (c) => {
      const r = reponseRecue(c);
      return r?.type === 'carte_vue' ? (
        <>
          {court(c.vue, r.de)} vous montre <Fort>{nomElement(r.carte)}</Fort>, en secret : vous seul l'avez vue ; les autres savent seulement qu'une carte vous a
          été montrée. Cette carte est donc <Fort>innocente</Fort>.
        </>
      ) : (
        <>
          Personne ne vous a montré de carte. Soit aucun des joueurs interrogés n'en avait, soit… le <Fort>complice a menti</Fort> ! Les éléments que personne n'a
          pu montrer (et que vous n'avez pas) font peut-être partie de la solution.
        </>
      );
    },
    bouton: 'Suivant',
  },
  {
    onglet: 'Carnet',
    texte: () => (
      <>
        Notez ce que vous savez dans votre <Fort>carnet</Fort> : ouvrez l'onglet <Fort>Carnet</Fort>.
      </>
    ),
    attendre: () => [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].some((t) => t.textContent?.includes('Carnet')),
  },
  {
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
          Chaque élément a sa ligne : <Fort>?</Fort> inconnu, <Fort>✗</Fort> écarté, <Fort>~</Fort> probable, <Fort>✓</Fort> certain. Marquez ✗ ce que vous savez
          innocent : <Fort>vos {vue.moi.main.length} cartes</Fort>
          {vues.length > 0 && (
            <>
              {' '}
              et <Fort>{liste(vues)}</Fort>, qu'on vous a montrée
            </>
          )}
          . Touchez une icône pour voir la carte en grand.
          <span className="guide-progres">
            Écartées : {total - reste.length}/{total}
          </span>
          {faux.length > 0 && (
            <span className="guide-alerte">
              ⚠️ Vous avez aussi écarté {liste(faux)}, mais rien ne prouve encore {faux.length > 1 ? 'leur' : 'son'} innocence. Remettez{' '}
              {faux.length > 1 ? 'ces lignes' : 'cette ligne'} sur <Fort>?</Fort>.
            </span>
          )}
          {aide && faux.length === 0 && reste.length > 0 && (
            <span className="guide-alerte">
              💡 Il vous reste à écarter : <Fort>{liste(reste)}</Fort>. Touchez le <Fort>✗</Fort> de la ligne mise en lumière.
            </span>
          )}
        </>
      );
    },
    attendre: ({ vue }) => manquants(vue).length === 0 && enTrop(vue).length === 0,
    progres: (vue) => `${manquants(vue).join()}|${enTrop(vue).join()}`,
  },
  {
    cible: ['.carnet-page .journal'],
    texte: () => (
      <>
        Plus bas, <Fort>Mes observations</Fort> garde tout ce que vous seul avez appris : votre rôle, les cartes vues, les dossiers lus. Le carnet a aussi un champ
        de notes libres. Personne d'autre ne voit votre carnet.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    onglet: 'Enquête',
    cible: ['.panneau-historique'],
    texte: () => (
      <>
        L'<Fort>historique</Fort> raconte tout ce qui est public : les hypothèses telles qu'elles ont été annoncées (donc peut-être falsifiées !), qui a répondu, qui
        a ouvert quel dossier… Le bouton « Tout l'historique » montre la partie entière : c'est là qu'on repère les comportements étranges.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    cible: ['.colonne-droite .panneau', '.onglet-chat'],
    texte: () => (
      <>
        La <Fort>discussion</Fort> sert à échanger avec les autres joueurs : partager vos soupçons, poser des questions… ou bluffer. Tout le monde lit tout, et rien
        n'y est vérifié.
      </>
    ),
    bouton: 'Suivant',
  },
  terminerTour(
    <>
      Votre hypothèse a utilisé vos {C.pointsAction} PA : revenez sur <Fort>Enquête</Fort> et touchez <Fort>Terminer mon tour</Fort>.
    </>,
  ),
  {
    // Marple joue d'un coup ; puis Hercule vous interroge (coup prévu par le guide).
    auDebut: (p) => {
      p.avanceRapide(HERCULE);
      p.scenariser(HERCULE, (e) => (sonTour(e, HERCULE) && e.hypothesesCeTour === 0 ? hypothese(hypotheseAvec(e, MOI, [SHERLOCK]), [MOI, SHERLOCK]) : null));
    },
    cible: ['.panneau-historique'],
    texte: () => <>Place aux bots, chacun son tour. Marple vient de jouer : lisez ce qu'elle a fait dans l'historique. C'est maintenant à Hercule… et il va vous interroger.</>,
    bouton: 'Suivant',
  },
  {
    quand: ({ vue }) => interroge(vue) || vue.moi.journal.some((e) => e.type === 'carte_montree'),
    attente: () => <>Hercule joue… suivez l'historique.</>,
    cible: ['.modale'],
    texte: () => (
      <>
        <Fort>On vous interroge !</Fort> Si vous avez une des cartes annoncées, vous devez en montrer une (au choix) : seul Hercule la verra. Si vous n'en avez
        aucune, répondez « aucune carte ».
      </>
    ),
    attendre: ({ vue }) => vue.moi.journal.some((e) => e.type === 'carte_montree'),
  },
  {
    cible: ['.panneau-historique'],
    texte: () => (
      <>
        Bien joué : seul Hercule a vu votre carte. Astuce : si vous avez plusieurs cartes demandées, montrer à quelqu'un une carte qu'il a <Fort>déjà vue</Fort> ne
        lui apprend rien de plus.
      </>
    ),
    bouton: 'Suivant',
  },
];

// ---------------------------------------------------------------------------
// 2. Les archives
// ---------------------------------------------------------------------------

const ARCHIVES: Etape[] = [
  {
    auDebut: (p) => p.preparer({ role: { role: 'enqueteur' } }),
    modale: '🗂️ Les archives',
    texte: () => (
      <>
        <p>
          Les <Fort>archives</Fort> sont des dossiers scellés, qui s'ouvrent au fil des manches. Il y en a deux sortes :
        </p>
        <ul>
          <li>
            des <Fort>indices</Fort> (manches {etapesListe(C.ouvertureDossiers)}) : un témoignage, une page du journal d'Armand…
          </li>
          <li>
            les <Fort>pièces à conviction</Fort> (manches {etapesListe(C.ouverturePieces)}) : les cartes que personne n'a reçues.
          </li>
        </ul>
        <p style={{ marginBottom: 0 }}>Consulter un dossier coûte 1 PA. Vous seul lisez son contenu ; les autres voient seulement que vous l'avez ouvert.</p>
      </>
    ),
    bouton: 'Ouvrir les archives',
  },
  {
    onglet: 'Archives',
    cible: ['.btn-consulter.btn-or:not(.piece)'],
    texte: () => (
      <>
        Consultez <Fort>ce dossier d'indice</Fort> (1 PA).
      </>
    ),
    attendre: (c) => aFait(c, 'archive_lue'),
  },
  {
    cible: ['.indices .prive .indice', '.indices .prive'],
    texte: () => (
      <>
        Un indice relie deux éléments (« si c'est ici, ce n'était pas avec cela »), ou réduit les possibilités (« ce sont deux suspects »). Il n'innocente rien à
        lui seul : il devient décisif en le croisant avec ce que vous savez déjà. Notez-le dans les notes du carnet, ou retenez-le.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    onglet: 'Archives',
    cible: ['.btn-consulter.piece'],
    quand: ({ vue }) => vue.archives.some((a) => a.categorie === 'piece' && a.disponible),
    texte: () => (
      <>
        Il vous reste 1 PA : ouvrez la <Fort>pièce à conviction</Fort>.
      </>
    ),
    attendre: (c) => aFait(c, 'piece_lue'),
  },
  {
    cible: ['.indices .prive'],
    texte: () => (
      <>
        Une pièce à conviction est une carte que <Fort>personne n'a reçue</Fort> : elle ne fait donc pas partie de la solution. C'est une information sûre, que le
        complice ne peut pas trafiquer.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    onglet: 'Carnet',
    cible: (c) => {
      const piece = depuis(c).find((e) => e.type === 'piece_lue');
      return piece?.type === 'piece_lue' ? [ligneCarnet(piece.carte)] : ['.carnet-grille'];
    },
    texte: (c) => {
      const piece = depuis(c).find((e) => e.type === 'piece_lue');
      return (
        <>
          Écartez-la dans le carnet : touchez le <Fort>✗</Fort> de {piece?.type === 'piece_lue' ? <Fort>{nomElement(piece.carte)}</Fort> : 'sa ligne'}.
        </>
      );
    },
    attendre: (c) => {
      const piece = depuis(c).find((e) => e.type === 'piece_lue');
      return piece?.type === 'piece_lue' && c.vue.moi.carnet.marques[piece.carte] === 'ecarte';
    },
  },
  terminerTour(),
];

// ---------------------------------------------------------------------------
// 3. Démasquer le complice
// ---------------------------------------------------------------------------

/** Deux empreintes, vraies : Hercule et Sherlock ne sont pas le complice. */
function poserEmpreintes(e: EtatPartie) {
  for (const innocente of [SHERLOCK, HERCULE]) e.historique.push({ t: Date.now(), type: 'empreinte', innocente, manche: e.manche });
}
const maDenonciation = (v: VueJoueur) => v.historique.find((e) => e.type === 'denonciation' && e.joueur === MOI);

const TRAQUE: Etape[] = [
  {
    auDebut: (p) => p.preparer({ role: { role: 'enqueteur' }, apres: (q) => poserEmpreintes(q.etat) }),
    modale: '🎭 Démasquer le complice',
    texte: () => (
      <>
        <p>
          Le complice a des <Fort>ruses</Fort> ({C.ruses[NB]} dans une partie à {NB} joueurs) : mentir quand on l'interroge, montrer une carte qu'il n'a pas, falsifier
          l'hypothèse d'un autre, trafiquer un dossier d'archives.
        </p>
        <p style={{ marginBottom: 0 }}>
          Chaque ruse peut laisser une <Fort>empreinte</Fort> dans l'historique, {C.delaiEmpreinte[0]} ou {C.delaiEmpreinte[1]} manches plus tard (jamais avant la
          manche {C.premiereMancheEmpreinte}) : un indice <Fort>vrai</Fort> et anonyme qui innocente un joueur. Ici, le guide en fait apparaître deux tout de suite.
        </p>
      </>
    ),
    bouton: "Voir l'historique",
  },
  {
    onglet: 'Enquête',
    cible: ['.panneau-historique'],
    texte: () => (
      <>
        Deux empreintes viennent d'apparaître : <Fort>Sherlock</Fort> et <Fort>Hercule</Fort> ne sont pas le complice. Vous non plus, bien sûr. Alors… qui reste ?
      </>
    ),
    bouton: 'Suivant',
  },
  {
    cible: ['.modale', '.btn-denoncer'],
    texte: () => (
      <>
        Touchez <Fort>Dénoncer le complice</Fort> (1 PA, une seule fois par partie) et désignez le joueur qui reste.
      </>
    ),
    attendre: ({ vue }) => !!maDenonciation(vue),
  },
  {
    cible: ['.bandeau-demasque', '.panneau-historique'],
    texte: ({ vue }) => {
      const d = maDenonciation(vue);
      return d?.type === 'denonciation' && d.correcte ? (
        <>
          <Fort>Démasquée !</Fort> Tout le monde sait maintenant que Marple est le complice. Ses ruses sont suspendues {C.suspensionDemasque} manches : d'ici là,
          ses réponses sont honnêtes. Attention : démasquer le complice ne fait pas gagner. Il faut encore trouver la solution !
        </>
      ) : (
        <>
          <Fort>Raté :</Fort> ce n'était pas le complice. Une dénonciation fausse vous fait perdre votre prochain tour. Les empreintes ne mentent jamais : relisez-les
          avant de dénoncer.
        </>
      );
    },
    bouton: 'Suivant',
  },
  {
    cible: ['.actions .btn-danger'],
    texte: () => (
      <>
        Pour gagner : l'<Fort>accusation finale</Fort>, avec les trois éléments. <Fort>Une seule par partie !</Fort> Juste, vous gagnez avec les autres enquêteurs.
        Fausse, vous ne pouvez plus accuser, mais vous continuez à jouer et à répondre. Si plus personne ne peut accuser, le complice gagne.
        <span className="guide-progres">Vous la ferez au dernier chapitre.</span>
      </>
    ),
    bouton: 'Suivant',
  },
  terminerTour(),
];

// ---------------------------------------------------------------------------
// 4. Le complice
// ---------------------------------------------------------------------------

/** L'hypothèse de Marple (redevenue enquêtrice) : elle cite une de vos cartes et vous interroge. */
function hypotheseDeMarple(e: EtatPartie): ActionJeu {
  const carte = e.joueurs[MOI].main.find((x) => categorieDe(x) !== 'suspect') ?? e.joueurs[MOI].main[0];
  return hypothese(hypotheseAvec(e, MOI, [HERCULE], carte), [MOI, HERCULE]);
}

const COMPLICE: Etape[] = [
  {
    auDebut: (p) =>
      p.preparer({
        role: { role: 'complice' },
        apres: (q) => q.scenariser(MARPLE, (e) => (sonTour(e, MARPLE) && e.hypothesesCeTour === 0 && e.pointsAction >= HYP ? hypotheseDeMarple(e) : null)),
      }),
    modale: '🔄 Changement de camp : vous êtes le complice !',
    texte: ({ vue }) => (
      <>
        <p>
          Vous êtes le <Fort>complice</Fort> du meurtrier : <Fort>{nomElement(vue.moi.meurtrier!)}</Fort>. Vous ignorez le lieu et l'arme. Votre rôle est secret :
          pour les autres, vous êtes un joueur comme eux.
        </p>
        <p style={{ marginBottom: 0 }}>
          <Fort>Vous gagnez</Fort> si personne ne trouve la solution avant la fin de la {C.manchesMax}ᵉ manche, ou si plus personne ne peut accuser. Vous ne
          pouvez jamais faire d'accusation finale, mais vous avez des <Fort>ruses</Fort>.
        </p>
      </>
    ),
    bouton: "C'est parti",
  },
  {
    cible: PANNEAU_ROLE,
    texte: ({ vue }) => (
      <>
        Vos ruses sont dans le panneau privé : <Fort>{ruses(vue)}</Fort> dans une partie à {NB} joueurs (dans une partie à 3 : {C.ruses[3]} ; à 5 ou 6 : {C.ruses[5]}).
        <span className="guide-progres">
          Mensonge ({C.coutRuses.mensonge}) : dire « aucune carte » alors que vous en avez une · Carte empruntée ({C.coutRuses.emprunt}) : montrer une carte que vous
          n'avez pas · Hypothèse falsifiée ({C.coutRuses.falsification}) : changer un élément de l'hypothèse d'un autre · Dossier trafiqué ({C.coutRuses.trafic}) :
          remplacer l'indice d'un dossier par un faux.
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
        Première ruse : <Fort>trafiquer un dossier</Fort>. Dans les <Fort>Archives</Fort>, touchez <Fort>Consulter et trafiquer</Fort> (1 PA + 1 ruse). Vous lirez
        le vrai indice ; ceux qui ouvriront ce dossier après vous liront un <Fort>faux</Fort>, présenté comme un vrai.
      </>
    ),
    attendre: (c) => aTrafique(c) || aFait(c, 'archive_lue'),
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
  terminerTour(
    <>
      Il vous reste 1 PA : pas assez pour une hypothèse ({HYP} PA). Revenez sur <Fort>Enquête</Fort> et touchez <Fort>Terminer mon tour</Fort>. Restez attentif :
      quand un joueur formule une hypothèse, <Fort>vous la voyez avant tout le monde</Fort>…
    </>,
  ),
  {
    quand: (c) => (!!c.vue.hypotheseEnCours?.falsification && c.vue.hypotheseEnCours.auteur !== MOI) || aFalsifie(c) || !!maReponse(c) || monTour(c.vue),
    attente: () => <>Marple réfléchit à son hypothèse…</>,
    cible: ['.modale'],
    texte: () => (
      <>
        Marple formule une hypothèse, et vous la voyez en premier. Deuxième ruse : la <Fort>falsifier</Fort> (1 ruse). Choisissez l'élément à changer, puis ce que
        les autres verront à la place. Marple garde sa version et <Fort>n'est jamais prévenue</Fort>. Vous pouvez aussi choisir « Ne rien changer ».
      </>
    ),
    attendre: (c) => {
      const h = c.vue.hypotheseEnCours;
      return aFalsifie(c) || !h || h.etape !== 'falsification' || !h.falsification || h.falsification.decide;
    },
  },
  {
    quand: (c) => interroge(c.vue) || !!maReponse(c) || monTour(c.vue),
    attente: () => <>Le greffier enregistre l'hypothèse, puis Marple vous interroge…</>,
    cible: ['.modale'],
    texte: ({ vue }) => {
      const a = vue.hypotheseEnCours?.repondantActuel === MOI ? vue.hypotheseEnCours.aRepondre : undefined;
      if (!a || a.cartesCorrespondantes.length === 0) return <>Marple vous interroge : répondez.</>;
      return (
        <>
          Marple vous interroge, et vous avez <Fort>{liste(a.cartesCorrespondantes)}</Fort>. Un enquêteur devrait la montrer. Vous, vous pouvez{' '}
          <Fort>mentir</Fort> : répondez « aucune carte » (1 ruse), et Marple croira que vous n'avez rien.
          <span className="guide-progres">
            Autre ruse : montrer une carte que vous n'avez pas ({C.coutRuses.emprunt} ruses). Redoutable si c'est le vrai lieu ou la vraie arme : l'enquêteur
            l'écartera à tort.
          </span>
        </>
      );
    },
    attendre: (c) => !!maReponse(c) || monTour(c.vue),
  },
  {
    cible: ['.panneau-historique'],
    texte: (c) => {
      const r = maReponse(c);
      const debut: ReactNode =
        r?.type === 'mensonge' ? (
          <>
            Vous avez <Fort>menti</Fort> : Marple pense que vous n'avez aucune de ces cartes ; elle risque d'en soupçonner une à tort.
          </>
        ) : r?.type === 'ruse' ? (
          <>
            Vous avez montré une carte <Fort>empruntée</Fort> : Marple la croit innocente.
          </>
        ) : (
          <>
            Vous avez répondu <Fort>honnêtement</Fort>. C'est parfois le meilleur moyen de passer inaperçu : gardez vos ruses pour les moments décisifs.
          </>
        );
      return <>{debut} Dans l'historique, personne ne voit que vous avez rusé.</>;
    },
    bouton: 'Suivant',
  },
  {
    auDebut: (p) => p.avanceRapide(),
    quand: ({ vue }) => monTour(vue),
    attente: () => <>Les bots terminent leur tour…</>,
    texte: () => (
      <>
        Attention aux <Fort>empreintes</Fort> : chaque ruse a {Math.round((C.probaEmpreinte[NB] ?? 0.4) * 100)} chances sur 100 (à {NB} joueurs) d'en laisser une,
        quelques manches plus tard. Elle innocente un autre joueur, et à force, il ne reste que vous… Dénoncé, vos ruses sont suspendues {C.suspensionDemasque}{' '}
        manches (vous les retrouvez ensuite). Rusez au bon moment, pas à chaque occasion.
        <span className="guide-progres">À 3 joueurs, une empreinte ne nomme personne : elle dit seulement à quelle manche une ruse a eu lieu.</span>
      </>
    ),
    bouton: 'Suivant',
  },
  {
    texte: () => (
      <>
        <Fort>Bluffez !</Fort> Dans la discussion, jouez l'enquêteur : partagez de vraies découvertes de temps en temps, soupçonnez quelqu'un d'autre, défendez une
        fausse piste… Le meilleur complice est celui qu'on ne soupçonne pas.
      </>
    ),
    bouton: 'Suivant',
  },
];

// ---------------------------------------------------------------------------
// 5. L'accusation finale
// ---------------------------------------------------------------------------

const FINAL: Etape[] = [
  {
    auDebut: (p) => p.preparer({ role: { role: 'enqueteur' } }),
    modale: "⚖️ L'accusation finale",
    texte: (c) => (
      <>
        <p>
          Vous redevenez <Fort>enquêteur</Fort>. Pour ce dernier chapitre, le guide vous souffle la solution (dans une vraie partie, c'est à vous de la trouver !) :{' '}
          <Fort>{tripletTexte(c.p.etat.affaire.solution).join(', ')}</Fort>.
        </p>
        <p style={{ marginBottom: 0 }}>Faites l'accusation finale : si elle est juste, la partie s'arrête et les enquêteurs gagnent.</p>
      </>
    ),
    bouton: "J'accuse",
  },
  {
    cible: ['.modale', '.actions .btn-danger'],
    texte: (c) => (
      <>
        Touchez <Fort>Accusation finale</Fort>, choisissez <Fort>{tripletTexte(c.p.etat.affaire.solution).join(', ')}</Fort>, puis confirmez.
      </>
    ),
    attendre: ({ vue }) => vue.etape === 'terminee',
  },
];

export const CHAPITRES_CLASSIQUE: Chapitre[] = [
  { id: 'c_bases', titre: "Les bases de l'enquête", resume: 'Rôle, cartes, points d’action, hypothèse, carnet, historique, être interrogé.', etapes: BASES },
  { id: 'c_archives', titre: 'Les archives', resume: 'Dossiers d’indices et pièces à conviction.', etapes: ARCHIVES },
  { id: 'c_traque', titre: 'Démasquer le complice', resume: 'Ruses, empreintes, dénonciation, accusation finale.', etapes: TRAQUE },
  { id: 'c_complice', titre: 'Le complice', resume: 'Changer de camp : trafiquer, falsifier, mentir, bluffer.', etapes: COMPLICE },
  {
    id: 'c_final',
    titre: "L'accusation finale",
    resume: 'Accuser, gagner, et lire l’écran de fin.',
    etapes: FINAL,
    fin: [
      ({ vue }) =>
        vue.resultat?.vainqueur === 'enqueteurs' ? (
          <>
            <Fort>Affaire résolue !</Fort> Voici l'<Fort>écran de fin</Fort> : la solution et son récit, le complice, les ruses qu'il a utilisées et les mains de
            chacun. Prenez le temps de le parcourir.
          </>
        ) : (
          <>
            La partie est terminée. Voici l'<Fort>écran de fin</Fort> : la solution et son récit, le complice, ses ruses et les mains de chacun.
          </>
        ),
      () => (
        <>
          <Fort>Pour aller plus loin : la Grande enquête</Fort> (de 4 à 6 joueurs). Elle ajoute un 4ᵉ élément à trouver (le mobile), des rôles secrets à pouvoirs, le
          Maître chanteur, un objectif secret pour le complice et un tableau d'enquête commun. Elle a sa propre partie guidée, dans « Apprendre à jouer ».{' '}
          <Fort>Bonne enquête !</Fort>
        </>
      ),
    ],
  },
];
