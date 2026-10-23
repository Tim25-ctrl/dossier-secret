// Les chapitres de la partie guidée de la Grande enquête. Une seule partie (vous et quatre bots), où
// votre rôle change d'un chapitre à l'autre pour tout essayer : les bases, chaque rôle à pouvoir,
// le Maître chanteur, le complice, puis le final (la dernière chance du complice).

import type { ReactNode } from 'react';
import { CONFIG_GRANDE_ENQUETE, CONFIG_PAR_DEFAUT } from '../../engine/config';
import { appliquerAction, joueurActif, peutMentir, repondantActuel, type EtatPartie } from '../../engine/partie';
import { nomElement } from '../../shared/data/catalogue';
import { categorieDe, type ActionJeu, type ElementId, type EntreePrivee, type Triplet, type VueJoueur } from '../../shared/types';
import { LIBELLES_ETIQUETTES } from '../grande';
import type { Chapitre, Contexte, Etape } from './Guide';
import {
  Conseil,
  Fort,
  NouveauRole,
  PANNEAU_ROLE,
  POUVOIR,
  aEcarter,
  aFait,
  aFalsifie,
  aTrafique,
  cartesVues,
  court,
  depuis,
  enTrop,
  hypothese,
  interrogesDeMaDerniereHypothese,
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
import { HERCULE, MAIGRET, MARPLE, MOI, SHERLOCK, SOLUTION, hypotheseAvec, ontCiteLeLieu } from './scenario';

// Les chiffres des vraies parties (la partie guidée assouplit certains délais).
const G = CONFIG_GRANDE_ENQUETE;
const C = CONFIG_PAR_DEFAUT;
const U = G.roles!.utilisations;
const MANCHES = G.manchesMax!;
const PA = G.pointsAction!;
const HYP = C.coutHypothese;

// ---------------------------------------------------------------------------
// 1. Les bases
// ---------------------------------------------------------------------------


const BASES: Etape[] = [
  {
    texte: () => (
      <>
        <Fort>Bienvenue au Manoir des Brumes !</Fort> Armand de Valombre a été assassiné cette nuit. Pour résoudre l'affaire, il faut trouver <Fort>qui</Fort> l'a
        tué, <Fort>où</Fort>, avec <Fort>quelle arme</Fort>, et <Fort>pourquoi</Fort> (le mobile). Vous jouez contre quatre bots : Marple, Hercule, Sherlock et
        Maigret. L'un d'eux est le <Fort>complice</Fort> du meurtrier : il connaît le coupable et va tout faire pour vous égarer.
        <span className="guide-progres">
          Cette partie guidée compte 11 chapitres. Le bouton « Chapitres » permet à tout moment d'en refaire un ou d'en sauter.
        </span>
      </>
    ),
    bouton: 'Commencer',
  },
  {
    cible: ['.modale'],
    texte: () => (
      <>
        Au début de chaque partie, cette fenêtre vous montre <Fort>votre rôle secret</Fort> : vous seul le voyez. Ici, vous êtes un simple enquêteur ; les rôles à
        pouvoirs viendront un par un dans les chapitres suivants. Touchez <Fort>J'ai compris : je suis prêt</Fort> : la partie commence quand tous les joueurs ont
        confirmé (au plus tard au bout de 3 minutes).
      </>
    ),
    attendre: ({ vue }) => !vue.attenteDepart,
  },
  {
    cible: ['.colonne-gauche .prive', '.bande-cartes'],
    texte: ({ vue }) => (
      <>
        Voici <Fort>vos cartes</Fort> : {vue.moi.main.map((c) => nomElement(c)).join(', ')}. Elles sont <Fort>innocentes</Fort> : aucune ne fait partie de la
        solution. Toutes les cartes hors solution ont été distribuées aux joueurs : chacun en a {vue.moi.main.length} ici. Elles servent aussi à répondre quand on
        vous interroge.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    cible: ['.barre-jeu .indicateurs'],
    texte: () => (
      <>
        En haut : la <Fort>manche</Fort> (1 sur {MANCHES}), le joueur dont c'est le <Fort>tour</Fort>, vos <Fort>points d'action</Fort> et le temps qu'il reste
        pour jouer (sans limite dans la partie guidée ; dans une vraie partie, le salon choisit la durée d'un tour). Si personne n'a trouvé à la fin de la{' '}
        {MANCHES}ᵉ manche, le complice gagne.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    cible: ['.bandeau-tour'],
    texte: () => (
      <>
        C'est <Fort>votre tour</Fort>. Vous avez <Fort>{PA} points d'action (PA)</Fort> à dépenser comme vous voulez :
        <span className="guide-progres">
          Hypothèse : {HYP} PA (une par tour) · Consulter les archives : 1 PA · Dénoncer le complice : 1 PA. Le carnet, le tableau d'enquête et les pouvoirs des rôles
          sont gratuits. Rien ne vous oblige à tout dépenser.
        </span>
      </>
    ),
    bouton: 'Suivant',
  },
  {
    cible: ['.actions .btn-or', '.modale'],
    texte: ({ p, vue }) => (
      <>
        Formulez une <Fort>hypothèse</Fort> : un suspect, un lieu, une arme et un mobile, puis deux joueurs à interroger, dans l'ordre. Ce n'est pas une
        accusation : c'est une question, pour obtenir des informations.
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
        Plus bas, <Fort>Mes observations</Fort> garde tout ce que vous seul avez appris : votre rôle, les cartes vues, les dossiers lus, les découvertes de vos
        pouvoirs. Le carnet a aussi un champ de notes libres. Personne d'autre ne voit votre carnet.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    onglet: 'Archives',
    cible: ['.btn-consulter.btn-or:not(.piece)', '.btn-consulter.btn-or'],
    texte: () => (
      <>
        Il vous reste 1 PA : ouvrez l'onglet <Fort>Archives</Fort> et consultez <Fort>ce dossier</Fort>. Les dossiers s'ouvrent au fil des manches ; vous seul lisez
        leur contenu, les autres voient seulement que vous en avez ouvert un.
      </>
    ),
    attendre: (c) => aFait(c, 'archive_lue') || aFait(c, 'piece_lue'),
  },
  {
    cible: ['.indices .prive .indice', '.indices .prive'],
    texte: (c) =>
      aFait(c, 'piece_lue') && !aFait(c, 'archive_lue') ? (
        <>
          C'est une <Fort>pièce à conviction</Fort> : une carte que personne n'a reçue. Elle est donc <Fort>innocente</Fort> ; pensez à l'écarter dans votre carnet.
        </>
      ) : (
        <>
          Un indice relie deux éléments (« si c'est ici, ce n'était pas avec cela »), ou réduit les possibilités (« ce sont deux suspects »). Il n'innocente rien à
          lui seul : il devient décisif en le croisant avec ce que vous savez déjà. Dans la Grande enquête, des dossiers parlent aussi du mobile.
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
      Votre tour est bien rempli. Revenez sur <Fort>Enquête</Fort> et touchez <Fort>Terminer mon tour</Fort>.
    </>,
  ),
  {
    // Marple joue d'un coup ; puis Hercule vous interroge (coup prévu par le guide).
    auDebut: (p) => {
      p.avanceRapide(HERCULE);
      p.scenariser(HERCULE, (e) =>
        sonTour(e, HERCULE) && e.hypothesesCeTour === 0 ? hypothese(hypotheseAvec(e, MOI, [SHERLOCK]), [MOI, SHERLOCK]) : null,
      );
    },
    cible: ['.panneau-historique'],
    texte: () => (
      <>
        Place aux bots, chacun son tour. Marple vient de jouer : lisez ce qu'elle a fait dans l'historique. C'est maintenant à Hercule… et il va vous interroger.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    quand: ({ vue }) => (vue.hypotheseEnCours?.aRepondre !== undefined && vue.hypotheseEnCours.repondantActuel === MOI) || vue.moi.journal.some((e) => e.type === 'carte_montree'),
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
  {
    // Les autres bots jouent d'un coup : votre tour revient.
    auDebut: (p) => p.avanceRapide(),
    quand: ({ vue }) => monTour(vue),
    attente: () => <>Les bots terminent leur tour…</>,
    onglet: 'Enquête',
    cible: ['.btn-denoncer'],
    texte: () => (
      <>
        Votre tour revient. Parlons du <Fort>complice</Fort> : il a des <Fort>ruses</Fort> (mentir, montrer une carte qu'il n'a pas, falsifier une hypothèse,
        trafiquer un dossier). Chaque ruse peut laisser une <Fort>empreinte</Fort> dans l'historique, quelques manches plus tard (jamais avant la manche{' '}
        {C.premiereMancheEmpreinte}) : un indice vrai et anonyme du genre « Hercule n'est pas le complice ». En les recoupant, vous pouvez le{' '}
        <Fort>dénoncer</Fort> (1 PA, une seule fois par partie).
        <span className="guide-progres">
          Juste : il est démasqué devant tous et ses ruses sont suspendues {C.suspensionDemasque} manches. Faux : vous perdez votre prochain tour. Pas maintenant : rien
          ne vous permet encore de soupçonner quelqu'un.
        </span>
      </>
    ),
    bouton: 'Suivant',
  },
  {
    onglet: 'Enquête',
    cible: ['.actions .btn-danger'],
    texte: () => (
      <>
        Quand vous êtes sûr de vous : l'<Fort>accusation finale</Fort>, avec les quatre éléments. <Fort>Une seule par partie !</Fort> Juste, vous gagnez avec les
        autres enquêteurs. Fausse, vous ne pouvez plus accuser, mais vous continuez à jouer et à répondre. Si plus personne ne peut accuser, le complice gagne.
        <span className="guide-progres">Pas maintenant non plus : il vous faut d'abord rassembler des preuves.</span>
      </>
    ),
    bouton: 'Suivant',
  },
];

// ---------------------------------------------------------------------------
// 2. Le Témoin — 3. Le tableau d'enquête
// ---------------------------------------------------------------------------

const ROLES_EXPLIQUES = (
  <p>
    Dans la Grande enquête, chaque enquêteur reçoit un <Fort>rôle secret</Fort> avec un pouvoir. Il y a toujours un Témoin ; les autres rôles sont tirés au sort
    (Inspecteur, Légiste, Archiviste, Journaliste, Profileur), sans doublon. En vraie partie, on garde son rôle du début à la fin ; ici, vous allez en changer à
    chaque chapitre pour tous les essayer.
  </p>
);

const TEMOIN: Etape[] = [
  {
    auDebut: (p) => p.preparer({ role: { role: 'enqueteur', roleEnquete: 'temoin' } }),
    modale: '🔄 Nouveau rôle : le Témoin',
    texte: (c) => (
      <NouveauRole c={c}>
        {ROLES_EXPLIQUES}
        <p style={{ marginBottom: 0 }}>
          Le <Fort>Témoin</Fort> a vu où le crime a eu lieu : il connaît le lieu dès le début. Il lui reste à trouver le meurtrier, l'arme et le mobile.
        </p>
      </NouveauRole>
    ),
    bouton: 'Je suis le Témoin',
  },
  {
    cible: PANNEAU_ROLE,
    texte: () => (
      <>
        Votre rôle est rappelé ici, dans le <Fort>panneau privé</Fort> (sur téléphone : dans la barre du haut, et dans « Mon rôle et les joueurs »). Il n'est visible
        que par vous.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    onglet: 'Carnet',
    cible: [ligneCarnet(SOLUTION.lieu)],
    texte: () => (
      <>
        Notez-le : dans le carnet, marquez <Fort>{nomElement(SOLUTION.lieu)}</Fort> comme <Fort>certain (✓)</Fort>.
      </>
    ),
    attendre: ({ vue }) => vue.moi.carnet.marques[SOLUTION.lieu] === 'certain',
  },
  {
    texte: () => (
      <>
        <Fort>Le danger :</Fort> le complice a un <Fort>objectif secret</Fort>. L'un d'eux s'appelle « le témoin gênant » : si l'enquête aboutit, le complice a{' '}
        {(G.objectifs!.delaiDesignationMs / 1000).toFixed(0)} secondes pour <Fort>désigner le Témoin</Fort>. S'il le trouve, il vole la victoire à tout le monde.
        Vous devez donc aider les autres à trouver le lieu… sans vous faire repérer.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    texte: () => (
      <>
        <Fort>Comment jouer le Témoin :</Fort>
        <span className="guide-progres">
          • Ne mettez pas toujours le vrai lieu dans vos hypothèses : le complice les voit toutes. Glissez-le de temps en temps, au milieu d'autres.
          <br />• Orientez les autres en douceur, par la discussion ou le tableau, sans insister.
          <br />• Vous gagnez avec les enquêteurs : c'est eux qu'il faut mettre sur la bonne piste.
        </span>
      </>
    ),
    bouton: 'Suivant',
  },
];

/** Un bot épingle une de ses cartes « Innocent ? » (s'il n'y a pas encore d'épingle d'un bot). */
function epingleDeBot(e: EtatPartie) {
  if ((e.tableau ?? []).some((x) => x.auteur !== MOI && !x.rumeur)) return;
  for (const id of [HERCULE, MAIGRET, SHERLOCK]) {
    const carte = e.joueurs[id].main[0];
    const r = appliquerAction(e, id, { type: 'epingler', cible: { type: 'element', id: carte }, etiquette: 'innocent' }, Date.now());
    if (r.ok) return;
  }
}
// L'épingle d'un autre joueur la plus récente : c'est la première affichée sur le tableau.
const epingleBot = (v: VueJoueur) => [...(v.tableau ?? [])].reverse().find((x) => x.auteur !== MOI);

const TABLEAU: Etape[] = [
  {
    auDebut: (p) => p.preparer({ apres: (q) => epingleDeBot(q.etat) }),
    modale: "📌 Le tableau d'enquête",
    texte: () => (
      <>
        <p>
          Dans la Grande enquête, un grand <Fort>tableau en liège</Fort> est visible par tous. Chacun peut y épingler un soupçon : c'est <Fort>gratuit</Fort> et possible{' '}
          <Fort>à tout moment</Fort> (même pendant le tour des autres). Chacun n'a <Fort>qu'une épingle</Fort> au tableau : en poser une nouvelle (une fois par
          manche) remplace l'ancienne.
        </p>
        <p style={{ marginBottom: 0 }}>
          Les épingles sont <Fort>anonymes</Fort>, sans aucun mot : on ne sait jamais qui les a posées. Et <Fort>rien n'y est vérifié</Fort> : le complice et le
          Maître chanteur épinglent comme tout le monde. Un tableau peut mentir !
        </p>
      </>
    ),
    bouton: 'Voir le tableau',
  },
  {
    onglet: 'Tableau',
    cible: ['.tableau-liege .epingle:not(.epingle-rumeur)', '.tableau-liege'],
    texte: ({ vue }) => {
      const e = epingleBot(vue);
      return (
        <>
          {e ? (
            <>
              Quelqu'un a épinglé <Fort>{e.cible.type === 'element' ? nomElement(e.cible.id) : court(vue, e.cible.id)}</Fort> avec l'étiquette «{' '}
              {LIBELLES_ETIQUETTES[e.etiquette]} ». Qui ? Impossible à savoir : peut-être un enquêteur sincère… ou le complice.
            </>
          ) : (
            <>Voici le tableau.</>
          )}{' '}
          Donnez votre avis : <Fort>👍</Fort> (d'accord) ou <Fort>👎</Fort> (pas d'accord). Les autres voient combien de joueurs sont d'accord, pas qui.
        </>
      );
    },
    attendre: ({ vue }) => (vue.tableau ?? []).some((x) => !!x.maReaction),
  },
  {
    onglet: 'Tableau',
    cible: ['.formulaire-epingle'],
    texte: ({ vue }) => (
      <>
        À vous : choisissez un élément ou un joueur, une étiquette (pour un élément : Coupable ?, Innocent ?, Fausse piste ? ; pour un joueur : Complice ? ou Innocent
        ?), puis <Fort>Épingler</Fort>. Par exemple : une de vos cartes, avec « Innocent ? ».
        {vue.moi.roleEnquete === 'temoin' && (
          <span className="guide-progres">En Témoin, vous pouvez aussi marquer un faux lieu « Fausse piste ? » : une façon discrète d'aider les autres.</span>
        )}
      </>
    ),
    attendre: ({ vue }) => (vue.tableau ?? []).some((x) => x.auteur === MOI && !x.rumeur),
  },
  {
    cible: ['.tableau-liege'],
    texte: () => (
      <>
        Votre épingle est au tableau : vous seul savez qu'elle est de vous (« Votre épingle »). À la manche suivante, une nouvelle épingle la remplacera ; vous
        pouvez aussi la retirer. À la <Fort>fin de la partie</Fort>, le tableau est montré avec le vrai auteur de chaque épingle : on découvre qui a menti !
      </>
    ),
    bouton: 'Suivant',
  },
  terminerTour(
    <>
      Ce chapitre est fini : revenez sur <Fort>Enquête</Fort> et touchez <Fort>Terminer mon tour</Fort> (rien ne vous oblige à dépenser vos points).
    </>,
  ),
];

// ---------------------------------------------------------------------------
// 4. L'Inspecteur — 5. Le Légiste — 6. L'Archiviste — 7. Le Journaliste — 8. Le Profileur
// ---------------------------------------------------------------------------

const INSPECTEUR: Etape[] = [
  {
    // Marple (la complice) mentira si vous l'interrogez sur une de ses cartes : de quoi tester le pouvoir.
    auDebut: (p) =>
      p.preparer({
        role: { role: 'enqueteur', roleEnquete: 'inspecteur' },
        apres: (q) => {
          const m = q.etat.joueurs[MARPLE];
          if (q.etat.complice === MARPLE) m.rusesRestantes = Math.max(m.rusesRestantes ?? 0, 2);
          q.scenariser(MARPLE, (e) => (repondantActuel(e) === MARPLE && e.hypothese?.auteur === MOI && peutMentir(e, MARPLE) ? { type: 'mentir' } : null));
        },
      }),
    modale: "🔄 Nouveau rôle : l'Inspecteur",
    texte: (c) => (
      <NouveauRole c={c}>
        <p style={{ marginBottom: 0 }}>
          L'<Fort>Inspecteur</Fort> démasque les mensonges : {U.inspecteur} fois par partie, juste après son hypothèse, il apprend si toutes les réponses reçues
          étaient honnêtes.
        </p>
      </NouveauRole>
    ),
    bouton: "Je suis l'Inspecteur",
  },
  {
    cible: ['.actions .btn-or', '.modale'],
    texte: ({ p, vue }) => (
      <>
        Commencez par une <Fort>hypothèse</Fort>.
        <Conseil t={hypotheseAvec(p.etat, MARPLE, [SHERLOCK])} interroges={[MARPLE, SHERLOCK]} v={vue} />
      </>
    ),
    attendre: (c) => aFait(c, 'hypothese_originale'),
  },
  {
    quand: (c) => reponseRecue(c) !== null,
    attente: () => <>Les joueurs interrogés répondent…</>,
    cible: ['.resultat-hypothese'],
    texte: (c) => {
      const r = reponseRecue(c);
      return r?.type === 'carte_vue' ? (
        <>
          {court(c.vue, r.de)} vous montre <Fort>{nomElement(r.carte)}</Fort>. Mais était-ce honnête ? Le complice peut montrer une carte qu'il n'a pas…
        </>
      ) : (
        <>
          Personne ne vous a montré de carte. Est-ce bien vrai ? Le complice peut prétendre n'avoir aucune carte…
        </>
      );
    },
    bouton: 'Suivant',
  },
  {
    cible: POUVOIR,
    texte: () => (
      <>
        Touchez <Fort>Vérifier les réponses</Fort> : vous saurez si toutes les réponses à cette hypothèse étaient honnêtes. Ce pouvoir ne sert que juste après votre
        hypothèse, pendant le même tour, et ne coûte aucun point d'action.
      </>
    ),
    attendre: (c) => aFait(c, 'verification'),
  },
  {
    cible: PANNEAU_ROLE,
    texte: (c) => {
      const v = depuis(c).find((e) => e.type === 'verification');
      const honnete = v?.type === 'verification' && v.honnete;
      return honnete ? (
        <>
          <Fort>Toutes les réponses étaient honnêtes</Fort> (c'est noté dans « Ce que votre rôle vous a appris ») : vous pouvez vous fier à ce que vous avez appris.
          C'est utile aussi : les joueurs interrogés ont joué franc jeu, cette fois.
        </>
      ) : (
        <>
          <Fort>Une ruse !</Fort> L'un des joueurs interrogés a menti (ou montré une carte qu'il n'a pas) : c'est noté dans « Ce que votre rôle vous a appris ».
          {interrogesDeMaDerniereHypothese(c.vue).length === 2 ? (
            <>
              Vous avez interrogé {interrogesDeMaDerniereHypothese(c.vue).map((id) => court(c.vue, id)).join(' et ')} : la ruse vient de l'un des deux, qui est donc le
              complice.{' '}
            </>
          ) : null}
          Une piste précieuse avant de dénoncer !
          <span className="guide-progres">Une falsification de votre hypothèse ne compte pas ici : les réponses sont toujours calculées sur votre vraie hypothèse.</span>
        </>
      );
    },
    bouton: 'Suivant',
  },
  terminerTour(),
];

const LEGISTE: Etape[] = [
  {
    auDebut: (p) => p.preparer({ role: { role: 'enqueteur', roleEnquete: 'legiste' } }),
    modale: '🔄 Nouveau rôle : le Légiste',
    texte: (c) => (
      <NouveauRole c={c}>
        <p style={{ marginBottom: 0 }}>
          Le <Fort>Légiste</Fort> examine les preuves : une fois par partie, il choisit une catégorie et apprend <Fort>deux éléments innocents</Fort>.
          <span className="guide-progres">
            En vraie partie, l'expertise n'est possible qu'à partir de la manche {G.roles!.mancheExpertise}. Ici, tout de suite.
          </span>
        </p>
      </NouveauRole>
    ),
    bouton: 'Je suis le Légiste',
  },
  {
    cible: POUVOIR,
    texte: () => (
      <>
        Touchez <Fort>Expertise</Fort>, puis choisissez une catégorie. Conseil : celle où il vous reste le plus d'inconnus dans le carnet.
      </>
    ),
    attendre: (c) => aFait(c, 'expertise'),
  },
  {
    cible: PANNEAU_ROLE,
    texte: (c) => {
      const x = depuis(c).find((e) => e.type === 'expertise');
      return (
        <>
          Résultat : <Fort>{x?.type === 'expertise' ? liste(x.innocents) : '…'}</Fort> {x?.type === 'expertise' && x.innocents.length > 1 ? 'sont innocents' : 'est innocent'}.
          Vous seul le savez. Dans les fenêtres d'hypothèse, ils portent la mention « innocent (Légiste) ».
        </>
      );
    },
    bouton: 'Suivant',
  },
  {
    onglet: 'Carnet',
    cible: (c) => {
      const x = depuis(c).find((e) => e.type === 'expertise');
      const reste = x?.type === 'expertise' ? x.innocents.filter((e) => c.vue.moi.carnet.marques[e] !== 'ecarte') : [];
      return reste.length ? [ligneCarnet(reste[0])] : ['.carnet-grille'];
    },
    texte: () => (
      <>
        Écartez-les dans le carnet : touchez le <Fort>✗</Fort> de chacun.
      </>
    ),
    attendre: (c) => {
      const x = depuis(c).find((e) => e.type === 'expertise');
      return x?.type === 'expertise' && x.innocents.every((e) => c.vue.moi.carnet.marques[e] === 'ecarte');
    },
  },
  terminerTour(),
];

/** Dossier d'indice ouvert que ni vous ni Marple n'avez lu, et pas encore trafiqué. */
function dossierATrafiquer(e: EtatPartie): number | undefined {
  return e.affaire.archives.find(
    (d) =>
      d.disponibleDesManche <= e.manche &&
      !e.joueurs[MOI].dossiersConsultes.includes(d.dossier) &&
      !e.joueurs[MARPLE].dossiersConsultes.includes(d.dossier) &&
      !(e.trafics ?? []).some((t) => t.dossier === d.dossier),
  )?.dossier;
}
const dossierTrafique = (c: Contexte) => c.p.memo.dossier as number | undefined;

const ARCHIVISTE: Etape[] = [
  {
    // Marple (la complice) trafique un dossier pendant son tour : l'Archiviste pourra le découvrir.
    auDebut: (p) =>
      p.preparer({
        role: { role: 'enqueteur', roleEnquete: 'archiviste' },
        nouveauTour: true,
        avant: (q) => {
          const m = q.etat.joueurs[MARPLE];
          if (q.etat.complice === MARPLE) m.rusesRestantes = Math.max(m.rusesRestantes ?? 0, 2);
          q.scenariser(MARPLE, (e) => {
            const d = sonTour(e, MARPLE) && e.pointsAction >= 1 ? dossierATrafiquer(e) : undefined;
            if (d === undefined) return null;
            q.memo.dossier = d;
            return { type: 'consulterArchive', dossier: d, trafiquer: true };
          });
        },
      }),
    modale: "🔄 Nouveau rôle : l'Archiviste",
    texte: (c) => (
      <NouveauRole c={c}>
        <p style={{ marginBottom: 0 }}>
          L'<Fort>Archiviste</Fort> connaît les archives par cœur : {U.archivesGratuites} consultations <Fort>gratuites</Fort> (sans point d'action) et, une fois
          par partie, il peut savoir si un dossier a été <Fort>trafiqué</Fort> par le complice.
        </p>
      </NouveauRole>
    ),
    bouton: "Je suis l'Archiviste",
  },
  {
    onglet: 'Archives',
    cible: (c) => {
      const d = dossierTrafique(c);
      return [...(d ? [`[data-dossier="${d}"] .btn-consulter:not(.btn-or)`] : []), '.btn-consulter:not(.btn-or)'];
    },
    texte: (c) => {
      const d = dossierTrafique(c);
      return (
        <>
          Consultez {d ? <Fort>le dossier n° {d}</Fort> : 'un dossier'} avec <Fort>Consulter gratuitement</Fort> : vous lisez son contenu sans dépenser de point
          d'action.
        </>
      );
    },
    attendre: ({ vue }) => (vue.moi.pouvoirsRole?.archivesGratuites ?? 0) < U.archivesGratuites,
  },
  {
    cible: (c) => {
      const d = dossierTrafique(c);
      return [...(d ? [`[data-dossier="${d}"]`] : []), '.indices .prive'];
    },
    texte: (c) => {
      const d = dossierTrafique(c);
      return (
        <>
          Vous lisez l'indice. Mais un doute :{' '}
          {d ? <>l'historique montre que Marple a ouvert ce dossier juste avant vous.</> : <>quelqu'un a peut-être ouvert ce dossier avant vous.</>} Et si c'était le
          complice ? En lisant un dossier, il peut le <Fort>trafiquer</Fort> : tous ceux qui l'ouvrent ensuite lisent un faux indice, présenté exactement comme un
          vrai.
        </>
      );
    },
    bouton: 'Suivant',
  },
  {
    onglet: 'Enquête',
    cible: POUVOIR,
    texte: (c) => {
      const d = dossierTrafique(c);
      return (
        <>
          Touchez <Fort>Vérifier un dossier</Fort> et choisissez {d ? <Fort>le dossier n° {d}</Fort> : 'le dossier que vous venez de lire'}.
        </>
      );
    },
    attendre: (c) => aFait(c, 'dossier_verifie'),
  },
  {
    cible: PANNEAU_ROLE,
    texte: (c) => {
      const x = depuis(c).find((e) => e.type === 'dossier_verifie');
      return x?.type === 'dossier_verifie' && x.trafique ? (
        <>
          <Fort>Trafiqué !</Fort> L'indice que vous avez lu dans le dossier n° {x.dossier} est <Fort>faux</Fort> : ne vous y fiez pas. Et celui qui l'a trafiqué l'a
          forcément ouvert avant vous : l'historique dit qui. Un sérieux suspect…
        </>
      ) : (
        <>
          <Fort>Pas trafiqué</Fort> : vous pouvez vous fier à cet indice. Une vérification qui rassure est aussi une information.
        </>
      );
    },
    bouton: 'Suivant',
  },
  terminerTour(
    <>
      Il vous reste une consultation gratuite pour plus tard. Revenez sur <Fort>Enquête</Fort> et touchez <Fort>Terminer mon tour</Fort>.
    </>,
  ),
];

const JOURNALISTE: Etape[] = [
  {
    auDebut: (p) => p.preparer({ role: { role: 'enqueteur', roleEnquete: 'journaliste' } }),
    modale: '🔄 Nouveau rôle : le Journaliste',
    texte: (c) => (
      <NouveauRole c={c}>
        <p style={{ marginBottom: 0 }}>
          Le <Fort>Journaliste</Fort> a <Fort>{U.journaliste} épingles en plus</Fort> à poser sur le tableau d'enquête (une par manche au plus). Elles
          s'ajoutent à son épingle habituelle, restent au tableau et sont anonymes comme les autres : il peut lancer plus de pistes que tout le monde.
        </p>
      </NouveauRole>
    ),
    bouton: 'Je suis le Journaliste',
  },
  {
    onglet: 'Tableau',
    cible: ['.formulaire-epingle'],
    texte: () => (
      <>
        Cochez <Fort>Épingle en plus</Fort>, choisissez une cible et une étiquette, puis <Fort>Épingler</Fort>. Elle ne remplace pas votre épingle habituelle :
        vous pouvez poser les deux dans la même manche.
      </>
    ),
    attendre: ({ vue }) => (vue.tableau ?? []).some((x) => x.auteur === MOI && x.rumeur),
  },
  {
    cible: ['.tableau-liege .epingle-rumeur', '.tableau-liege'],
    texte: () => (
      <>
        La voilà : vous voyez « Votre épingle en plus », les autres voient une épingle anonyme comme les autres. Personne ne peut savoir qu'elle vient du
        Journaliste. Avec vos épingles en plus, vous pouvez soutenir une piste plusieurs fois… ou brouiller les cartes si vous pensez que le complice lit le
        tableau.
      </>
    ),
    bouton: 'Suivant',
  },
  terminerTour(),
];

const PROFILEUR: Etape[] = [
  {
    auDebut: (p) => p.preparer({ role: { role: 'enqueteur', roleEnquete: 'profileur' } }),
    modale: '🔄 Nouveau rôle : le Profileur',
    texte: (c) => (
      <NouveauRole c={c}>
        <p style={{ marginBottom: 0 }}>
          Le <Fort>Profileur</Fort> lit dans les esprits : une fois par partie, il désigne deux joueurs et apprend si le complice est l'un des deux (sans savoir
          lequel).
          <span className="guide-progres">En vraie partie, à partir de la manche {G.roles!.mancheProfilage} seulement. Ici, tout de suite.</span>
        </p>
      </NouveauRole>
    ),
    bouton: 'Je suis le Profileur',
  },
  {
    cible: POUVOIR,
    texte: () => (
      <>
        Touchez <Fort>Profilage</Fort> et désignez deux joueurs : par exemple les deux qui vous semblent les plus suspects.
      </>
    ),
    attendre: (c) => aFait(c, 'profilage'),
  },
  {
    cible: PANNEAU_ROLE,
    texte: (c) => {
      const x = depuis(c).find((e) => e.type === 'profilage');
      if (x?.type !== 'profilage') return null;
      const [a, b] = x.joueurs.map((id) => court(c.vue, id));
      return (
        <>
          {x.complicePresent ? (
            <>
              <Fort>Oui :</Fort> le complice est {a} ou {b}. Lequel ? À vous de le découvrir, avec les empreintes, les réponses étranges, le tableau…
            </>
          ) : (
            <>
              <Fort>Non :</Fort> ni {a} ni {b} n'est le complice. Il se cache parmi les deux autres joueurs.
            </>
          )}{' '}
          Un profilage coupe les suspects en deux : croisez-le avec vos autres indices avant de dénoncer.
        </>
      );
    },
    bouton: 'Suivant',
  },
  terminerTour(),
];

// ---------------------------------------------------------------------------
// 9. Le Maître chanteur — 10. Le complice — 11. Le final
// ---------------------------------------------------------------------------

const MAITRE: Etape[] = [
  {
    auDebut: (p) => p.preparer({ role: { role: 'maitre_chanteur' } }),
    modale: '🔄 Nouveau rôle : le Maître chanteur',
    texte: (c) => (
      <NouveauRole c={c}>
        <p style={{ marginBottom: 0 }}>
          Un rôle trouble, seulement à 5 et 6 joueurs : vous n'êtes ni enquêteur ni complice, vous jouez <Fort>pour vous seul</Fort>. Vous savez pourquoi Armand a
          été tué : vous connaissez <Fort>le mobile</Fort>.
        </p>
      </NouveauRole>
    ),
    bouton: 'Je suis le Maître chanteur',
  },
  {
    cible: PANNEAU_ROLE,
    texte: () => (
      <>
        <Fort>Pour gagner</Fort>, c'est vous qui devez faire l'accusation finale juste : vous gagnez alors seul. Si un enquêteur trouve avant vous, les enquêteurs
        gagnent et vous perdez ; si personne ne trouve, c'est le complice qui gagne.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    texte: () => (
      <>
        <Fort>Comment jouer le Maître chanteur :</Fort>
        <span className="guide-progres">
          • Vous répondez toujours honnêtement quand on vous interroge : vous n'avez aucune ruse.
          <br />• Profitez de ce que les autres découvrent, sans trop les aider. Vous pouvez prétendre avoir un rôle d'enquêteur dans la discussion.
          <br />• Si l'on vous dénonce comme complice, la dénonciation est fausse : son auteur perd son prochain tour.
          <br />• Et surtout : accusez au bon moment, avant les autres !
        </span>
      </>
    ),
    bouton: 'Suivant',
  },
  {
    onglet: 'Enquête',
    cible: ['.actions .btn-danger'],
    texte: () => (
      <>
        Comme un enquêteur, vous avez le bouton <Fort>Accusation finale</Fort>. Pas maintenant : il vous manque encore le meurtrier, le lieu et l'arme !
      </>
    ),
    bouton: 'Suivant',
  },
  terminerTour(),
];


/** L'hypothèse de Marple (devenue le Témoin) : elle cite le vrai lieu et une de vos cartes, et vous interroge. */
function hypotheseDuTemoin(e: EtatPartie, interroges: string[]): ActionJeu {
  const carte = e.joueurs[MOI].main.find((x) => categorieDe(x) !== 'lieu') ?? e.joueurs[MOI].main[0];
  const t = hypotheseAvec(e, MOI, interroges.filter((x) => x !== MOI), carte);
  return hypothese({ ...t, lieu: SOLUTION.lieu }, interroges);
}

const COMPLICE: Etape[] = [
  {
    // Après votre tour, Marple (le Témoin désormais) formulera une hypothèse avec le vrai lieu et vous interrogera.
    auDebut: (p) =>
      p.preparer({
        role: { role: 'complice' },
        apres: (q) => q.scenariser(MARPLE, (e) => (sonTour(e, MARPLE) && e.hypothesesCeTour === 0 && e.pointsAction >= HYP ? hypotheseDuTemoin(e, [MOI, HERCULE]) : null)),
      }),
    modale: '🔄 Changement de camp : vous êtes le complice !',
    texte: (c) => (
      <>
        <p>
          Vous êtes le <Fort>complice</Fort> du meurtrier : <Fort>{nomElement(c.vue.moi.meurtrier!)}</Fort>. Vous ignorez le lieu, l'arme et le mobile. Votre rôle
          est secret : pour les autres, vous êtes un joueur comme eux.
        </p>
        <p style={{ marginBottom: 0 }}>
          <Fort>Vous gagnez</Fort> si personne ne trouve la solution avant la fin de la {MANCHES}ᵉ manche, ou si plus personne ne peut accuser. Vous ne pouvez
          jamais faire d'accusation finale, mais vous avez des <Fort>ruses</Fort>… et un <Fort>objectif secret</Fort>.
        </p>
      </>
    ),
    bouton: "C'est parti",
  },
  {
    cible: PANNEAU_ROLE,
    texte: ({ vue }) => (
      <>
        Vos ruses sont dans le panneau privé : <Fort>{ruses(vue)}</Fort> dans une partie à 5 joueurs (dans une partie à 4 : {G.ruses![4]} ; à 6 : {G.ruses![6]}).
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
    texte: () => (
      <>
        <Fort>Votre objectif secret</Fort> change la fin de partie : même si les enquêteurs trouvent, vous pouvez gagner. Il est tiré au sort parmi trois :
        <span className="guide-progres">
          • <Fort>Le témoin gênant</Fort> : si l'enquête aboutit, {(G.objectifs!.delaiDesignationMs / 1000).toFixed(0)} secondes pour désigner le Témoin ; si c'est
          lui, vous volez la victoire.
          <br />• <Fort>Le bouc émissaire</Fort> : faire accuser un innocent précis ({G.objectifs!.accusationsBouc[5]} accusation finale qui le vise suffit).
          <br />• <Fort>L'ombre</Fort> : n'être jamais dénoncé et utiliser au moins {G.objectifs!.rusesOmbre} ruses.
          <br />
          Ici, c'est le témoin gênant : retenez bien qui semble connaître le lieu…
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
        Voici le vrai indice et, en rouge, le titre du faux que liront les suivants. Il les enverra sur une fausse piste… Attention : l'Archiviste peut vérifier un
        dossier, et l'historique montre qui l'a ouvert avant lui.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    onglet: 'Enquête',
    cible: ['.actions .btn-or', '.modale'],
    texte: ({ vue }) => (
      <>
        Pour ne pas attirer l'attention, <Fort>jouez comme un enquêteur</Fort> : formulez une hypothèse ({HYP} PA). Vous connaissez le meurtrier (
        {nomElement(vue.moi.meurtrier!)}), pas le reste : découvrir le lieu, l'arme et le mobile vous dira quelles cartes « emprunter » pour égarer les autres.
      </>
    ),
    attendre: (c) => aFait(c, 'hypothese_originale'),
  },
  {
    quand: (c) => reponseRecue(c) !== null,
    attente: () => <>Les joueurs interrogés répondent…</>,
    cible: ['.resultat-hypothese'],
    texte: (c) => {
      const r = reponseRecue(c);
      return r?.type === 'carte_vue' ? (
        <>
          {court(c.vue, r.de)} vous montre <Fort>{nomElement(r.carte)}</Fort> : elle ne fait donc pas partie de la solution. Hypothèse après hypothèse, vous saurez
          mieux mentir.
        </>
      ) : (
        <>Personne n'a de carte à vous montrer : un élément de votre hypothèse fait peut-être partie de la solution. Bonne piste pour vos ruses !</>
      );
    },
    bouton: 'Suivant',
  },
  terminerTour(
    <>
      Vos points sont dépensés : touchez <Fort>Terminer mon tour</Fort>. Restez attentif : quand un joueur formule une hypothèse, <Fort>vous la voyez avant tout
      le monde</Fort>…
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
        <span className="guide-progres">Regardez bien ce qu'elle a demandé : qui cite quoi pourra vous servir à la fin.</span>
      </>
    ),
    attendre: (c) => {
      const h = c.vue.hypotheseEnCours;
      return aFalsifie(c) || !h || h.etape !== 'falsification' || !h.falsification || h.falsification.decide;
    },
  },
  {
    quand: (c) => (c.vue.hypotheseEnCours?.repondantActuel === MOI && !!c.vue.hypotheseEnCours.aRepondre) || !!maReponse(c) || monTour(c.vue),
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
      const debut =
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
      return (
        <>
          {debut} Dans l'historique, personne ne voit que vous avez rusé… sauf un Inspecteur qui vérifierait ses réponses !
        </>
      );
    },
    bouton: 'Suivant',
  },
  {
    auDebut: (p) => p.avanceRapide(),
    quand: ({ vue }) => monTour(vue),
    attente: () => <>Les bots terminent leur tour…</>,
    texte: () => (
      <>
        Attention aux <Fort>empreintes</Fort> : chaque ruse a une chance sur deux (à 5 joueurs) d'en laisser une dans l'historique, {C.delaiEmpreinte[0]} ou{' '}
        {C.delaiEmpreinte[1]} manches plus tard (jamais avant la manche {C.premiereMancheEmpreinte}). Elle innocente un autre joueur : « Hercule n'est pas le
        complice ». En les recoupant, les enquêteurs peuvent vous <Fort>dénoncer</Fort> : vos ruses sont alors suspendues {C.suspensionDemasque} manches (vous les
        retrouvez ensuite), et vos réponses sont honnêtes pendant ce temps. Rusez au bon moment, pas à chaque occasion.
      </>
    ),
    bouton: 'Suivant',
  },
  {
    texte: () => (
      <>
        <Fort>Bluffez !</Fort> Sur le tableau et dans la discussion, faites-vous passer pour un enquêteur : prétendez être l'Archiviste, épinglez une fausse piste,
        approuvez d'un 👍 une mauvaise idée… Les épingles sont anonymes : personne ne saura qu'elles viennent de vous avant la fin de la partie.
      </>
    ),
    bouton: 'Suivant',
  },
];

const FINAL: Etape[] = [
  {
    // Marple (le Témoin) doit avoir cité le vrai lieu : c'est l'indice de la dernière chance.
    auDebut: (p) =>
      p.preparer({
        role: { role: 'complice' },
        apres: (q) => {
          if (ontCiteLeLieu(q.etat, SOLUTION.lieu, MOI).includes(MARPLE)) return;
          q.scenariser(MARPLE, (e) => (sonTour(e, MARPLE) && e.hypothesesCeTour === 0 && e.pointsAction >= HYP ? hypotheseDuTemoin(e, [HERCULE, SHERLOCK]) : null));
        },
      }),
    modale: '⚖️ Le final : la dernière chance',
    texte: () => (
      <>
        <p>
          Place à la fin de partie, mise en scène. Vous êtes toujours <Fort>le complice</Fort>, avec l'objectif secret du <Fort>témoin gênant</Fort>.
        </p>
        <p style={{ marginBottom: 0 }}>
          Hercule pense avoir tout compris : il va faire son <Fort>accusation finale</Fort>… et elle sera juste. Votre dernière carte : trouver le Témoin.
        </p>
      </>
    ),
    bouton: 'Voir la suite',
  },
  terminerTour(),
  {
    // Les bots jouent jusqu'à Hercule, qui accuse (coup prévu par le guide).
    auDebut: (p) => {
      p.avanceRapide(HERCULE);
      p.scenariser(HERCULE, (e) => (sonTour(e, HERCULE) ? { type: 'accuser', ...SOLUTION } : null));
    },
    quand: ({ vue }) => vue.etape === 'designation',
    attente: () => <>Hercule prépare son accusation finale…</>,
    cible: ['.modale'],
    texte: (c) => {
      const cites = ontCiteLeLieu(c.p.etat, SOLUTION.lieu, MOI).map((id) => court(c.vue, id));
      return (
        <>
          L'accusation d'Hercule est <Fort>juste</Fort> : {tripletTexte(SOLUTION).join(', ')}. Sans votre objectif, les enquêteurs gagneraient. Mais voici votre{' '}
          <Fort>dernière chance</Fort> : désignez le Témoin, celui qui connaissait le lieu depuis le début. L'accusation vient de révéler ce lieu :{' '}
          <Fort>{nomElement(SOLUTION.lieu)}</Fort>.
          <span className="guide-progres">
            {cites.length ? <>Dans l'historique, l'ont cité : {cites.join(', ')}. </> : null}
            Le Témoin le cite souvent très tôt… ou l'évite soigneusement. Vous avez 2 minutes ({(G.objectifs!.delaiDesignationMs / 1000).toFixed(0)} secondes en vraie
            partie).
          </span>
        </>
      );
    },
    attendre: ({ vue }) => vue.etape === 'terminee',
  },
];

export const CHAPITRES_GRANDE: Chapitre[] = [
  { id: 'bases', titre: "Les bases de l'enquête", resume: 'Cartes, points d’action, hypothèse, carnet, archives, historique, accusation.', etapes: BASES },
  { id: 'temoin', titre: 'Le Témoin', resume: 'Les rôles secrets ; connaître le lieu sans se trahir.', etapes: TEMOIN },
  { id: 'tableau', titre: "Le tableau d'enquête", resume: 'Épingler ses soupçons, réagir à ceux des autres.', etapes: TABLEAU },
  { id: 'inspecteur', titre: "L'Inspecteur", resume: 'Vérifier si les réponses reçues étaient honnêtes.', etapes: INSPECTEUR },
  { id: 'legiste', titre: 'Le Légiste', resume: 'Une expertise : deux éléments innocents.', etapes: LEGISTE },
  { id: 'archiviste', titre: "L'Archiviste", resume: 'Archives gratuites et dossier trafiqué.', etapes: ARCHIVISTE },
  { id: 'journaliste', titre: 'Le Journaliste', resume: 'Publier une rumeur anonyme.', etapes: JOURNALISTE },
  { id: 'profileur', titre: 'Le Profileur', resume: 'Le complice est-il l’un de ces deux joueurs ?', etapes: PROFILEUR },
  { id: 'maitre', titre: 'Le Maître chanteur', resume: 'Le rôle trouble qui joue pour lui seul.', etapes: MAITRE },
  { id: 'complice', titre: 'Le complice', resume: 'Ruses, objectif secret, empreintes, bluff.', etapes: COMPLICE },
  {
    id: 'final',
    titre: 'Le final',
    resume: 'La dernière chance du complice, puis l’écran de fin.',
    etapes: FINAL,
    fin: [
      ({ vue }) => (
        <>
          {vue.resultat?.raison === 'objectif_complice' ? (
            <>
              <Fort>Bravo, vous avez trouvé le Témoin !</Fort> Grâce à votre objectif secret, vous volez la victoire des enquêteurs.
            </>
          ) : (
            <>
              <Fort>Raté : ce n'était pas le Témoin.</Fort> Les enquêteurs gardent leur victoire.
            </>
          )}{' '}
          Voici l'<Fort>écran de fin</Fort> : la solution et son récit (le mobile compris), le complice, les <Fort>rôles secrets</Fort> de chacun, le{' '}
          <Fort>tableau</Fort> avec le vrai auteur de chaque épingle (rumeurs comprises) et les ruses du complice. Prenez le temps de le parcourir.
        </>
      ),
      () => (
        <>
          <Fort>Le mot de la fin : la partie classique.</Fort> C'est le même jeu, en plus simple : 3 éléments à trouver (pas de mobile), pas de rôles à pouvoirs,
          ni Maître chanteur, ni objectif secret, ni tableau ; 2 PA par tour, 12 manches, de 3 à 6 joueurs. Elle a aussi sa partie guidée, dans « Apprendre à
          jouer ». <Fort>Bonne enquête !</Fort>
        </>
      ),
    ],
  },
];
