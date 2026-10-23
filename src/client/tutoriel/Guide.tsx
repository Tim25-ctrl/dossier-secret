// Bulle de la partie guidée : explique chaque étape, met en lumière l'élément à utiliser
// (le reste de l'écran est assombri et bloqué) et avance toute seule quand l'action est faite.
// La partie guidée est découpée en chapitres (chapitres.tsx) : on peut la suivre en entier,
// ou rejouer un seul chapitre.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { VueJoueur } from '../../shared/types';
import { Modale } from '../components/Commun';
import { connexion, useConnexion } from '../connexion';
import { CHAPITRES } from './chapitres';
import { MOI, figerPartieGuidee, partieGuidee, type PartieLocale } from './partieLocale';

export interface Contexte {
  vue: VueJoueur;
  /** Vrai quand le joueur n'avance plus depuis un moment : le guide l'aide davantage. */
  aide: boolean;
  /** La partie guidée (pour les hypothèses conseillées, ce qui s'est passé depuis le début du chapitre…). */
  p: PartieLocale;
}

export interface Etape {
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
  /** L'étape s'affiche dans une grande fenêtre (ouverture de chapitre, changement de rôle) : son titre. */
  modale?: ReactNode;
  /** À faire une fois, quand l'étape commence (préparer le chapitre, faire jouer les bots…). */
  auDebut?: (p: PartieLocale) => void;
}

export interface Chapitre {
  id: string;
  titre: string;
  /** Ce qu'on y apprend (sommaire). */
  resume: string;
  etapes: Etape[];
}

/** Délai sans progrès avant que le guide montre précisément quoi faire. */
const DELAI_AIDE_MS = 15_000;

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


/** Sommaire de la partie guidée : tout depuis le début, ou un seul chapitre (✓ : déjà fait). */
export function ModaleChapitres({
  faits,
  onChoisir,
  onFermer,
}: {
  faits: string[];
  onChoisir: (d: { chapitre: number; seul: boolean }) => void;
  onFermer: () => void;
}) {
  return (
    <Modale titre="🎓 Partie guidée" onFermer={onFermer}>
      <p style={{ marginTop: 0 }}>
        Une partie arrangée de <strong>Grande enquête</strong> contre quatre bots, avec un guide qui vous montre où cliquer. Vous y changez de rôle d'un chapitre à
        l'autre pour tout essayer. Suivez-la en entier (environ 25 minutes), ou rejouez un seul chapitre.
      </p>
      <button className="btn btn-or btn-bloc" onClick={() => onChoisir({ chapitre: 0, seul: false })}>
        ▶ Tout depuis le début
      </button>
      <ol className="liste-chapitres" aria-label="Les chapitres">
        {CHAPITRES.map((c, k) => (
          <li key={c.id}>
            <button className="btn" onClick={() => onChoisir({ chapitre: k, seul: true })}>
              <span className="chapitre-titre">
                {k + 1}. {c.titre}
                {faits.includes(c.id) && <span className="chapitre-fait" aria-label="déjà fait"> ✓</span>}
              </span>
              <span className="petit">{c.resume}</span>
            </button>
          </li>
        ))}
      </ol>
    </Modale>
  );
}

export function GuideTutoriel({ faits, onChapitre }: { faits: string[]; onChapitre: (id: string) => void }) {
  const etat = useConnexion().etat;
  const vue = etat?.partie ?? null;
  const p = partieGuidee();
  const [pos, setPos] = useState(() => ({ c: p?.depart.chapitre ?? 0, i: 0, seul: p?.depart.seul ?? false }));
  const [reduit, setReduit] = useState(false);
  const [sommaire, setSommaire] = useState(false);
  // Fin de partie : 0 = l'écran de fin, 1 = le mot de la fin.
  const [finEtape, setFinEtape] = useState(0);
  const [prepare, setPrepare] = useState('');
  const [, setTic] = useState(0);

  // Re-vérifie régulièrement (actions des bots, onglet ouvert, élément à surligner).
  useEffect(() => {
    const t = setInterval(() => setTic((x) => x + 1), 400);
    return () => clearInterval(t);
  }, []);

  const chapitre = CHAPITRES[pos.c];
  const etape: Etape | undefined = chapitre?.etapes[pos.i];
  const finDeChapitre = !!chapitre && !etape;
  const terminee = vue?.etape === 'terminee';
  const cleEtape = `${p?.generation ?? 0}|${pos.c}|${pos.i}`;
  const prete = !etape?.auDebut || prepare === cleEtape;
  const suivante = () => setPos((x) => ({ ...x, i: x.i + 1 }));

  // Préparation de l'étape (une seule fois) : rôle du chapitre, coups des bots…
  useEffect(() => {
    if (!p || !etape?.auDebut || prepare === cleEtape || terminee) return;
    etape.auDebut(p);
    setPrepare(cleEtape);
  });

  // Fin d'un chapitre : il compte comme fait ; dans la partie complète, on enchaîne sur le suivant.
  const signale = useRef('');
  useEffect(() => {
    if (!finDeChapitre) return;
    const cle = `${p?.generation ?? 0}|${pos.c}`;
    if (signale.current !== cle) {
      signale.current = cle;
      onChapitre(chapitre.id);
    }
    if (!pos.seul && pos.c + 1 < CHAPITRES.length) setPos({ c: pos.c + 1, i: 0, seul: false });
  });

  // Mode aide : l'étape n'avance plus depuis DELAI_AIDE_MS.
  // Une fois déclenchée, l'aide reste active jusqu'à la fin de l'étape.
  const avancement = useRef({ cle: '', depuis: Date.now(), aideEtape: '' });
  const cle = !vue || !etape ? '' : `${cleEtape}|${etape.progres?.(vue) ?? ''}`;
  if (avancement.current.cle !== cle) avancement.current = { ...avancement.current, cle, depuis: Date.now() };
  if (etape?.progres && Date.now() - avancement.current.depuis >= DELAI_AIDE_MS) avancement.current.aideEtape = cleEtape;
  const aide = avancement.current.aideEtape === cleEtape;
  const contexte: Contexte | null = vue && p ? { vue, aide, p } : null;

  // Étape « prête » : l'événement qu'elle attend est arrivé (une fois arrivé, il le reste).
  const pretPour = useRef('');
  if (contexte && etape && prete && !terminee && (!etape.quand || etape.quand(contexte))) pretPour.current = cleEtape;
  const pret = pretPour.current === cleEtape;

  // Pendant une explication (bouton « Suivant »), la partie est figée : rien ne se passe sans vous.
  const gel = !!contexte && !!etape && prete && !reduit && pret && !!(etape.bouton || etape.modale) && !terminee;
  useEffect(() => figerPartieGuidee(gel), [gel]);
  useEffect(() => () => figerPartieGuidee(false), []);

  const cible = etape && prete && !reduit && pret && contexte && !etape.modale && !terminee ? trouverCible(etape, contexte) : null;
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

  // Passage automatique quand l'action demandée est faite (une fois l'étape affichée : son événement est arrivé).
  useEffect(() => {
    if (!contexte || !etape || !prete || !pret || !etape.attendre) return;
    if (etape.attendre(contexte)) suivante();
  });

  if (!contexte || !p) return null;

  /** Rejouer depuis un chapitre : une partie neuve, seul ce chapitre ou tout ce qui suit. */
  const choisir = (d: { chapitre: number; seul: boolean }) => {
    setSommaire(false);
    setReduit(false);
    setFinEtape(0);
    p.recommencer();
    setPos({ c: d.chapitre, i: 0, seul: d.seul });
  };
  const fenetreSommaire = sommaire && <ModaleChapitres faits={faits} onChoisir={choisir} onFermer={() => setSommaire(false)} />;
  const boutonQuitter = (
    <button type="button" className="btn btn-discret btn-petit" onClick={() => connexion.arreterLocal()}>
      <span className="libelle-long">Quitter la partie guidée</span>
      <span className="libelle-court">Quitter</span>
    </button>
  );
  const boutonSommaire = (
    <button type="button" className="btn btn-petit" onClick={() => setSommaire(true)}>
      Chapitres
    </button>
  );
  const entete = (titre: ReactNode) => (
    <div className="guide-entete">
      <span>{titre}</span>
      <button type="button" className="btn btn-discret btn-petit" onClick={() => setReduit(true)} aria-label="Réduire le guide">
        ▾
      </button>
    </div>
  );

  if (reduit)
    return (
      <button type="button" className="guide-reduit" onClick={() => setReduit(false)}>
        🎓 Guide · chapitre {pos.c + 1}
      </button>
    );

  // La partie est finie (le final, ou une fin imprévue) : le guide commente l'écran de fin.
  if (terminee) {
    const final = chapitre?.id === 'final';
    const r = contexte.vue.resultat;
    const vole = r?.raison === 'objectif_complice';
    return (
      <>
        <aside className="guide" role="status" aria-live="polite">
          {entete(final ? `🎓 Partie guidée · le final` : '🎓 Partie guidée')}
          {!final ? (
            <p className="guide-texte">La partie est terminée. Choisissez un chapitre pour continuer à apprendre, ou quittez la partie guidée.</p>
          ) : finEtape === 0 ? (
            <p className="guide-texte">
              {vole ? (
                <>
                  <strong>Bravo, vous avez trouvé le Témoin !</strong> Grâce à votre objectif secret, vous volez la victoire des enquêteurs.
                </>
              ) : (
                <>
                  <strong>Raté : ce n'était pas le Témoin.</strong> Les enquêteurs gardent leur victoire.
                </>
              )}{' '}
              Voici l'<strong>écran de fin</strong> : la solution et son récit (le mobile compris), le complice, les <strong>rôles secrets</strong> de chacun, le{' '}
              <strong>tableau</strong> avec le vrai auteur de chaque épingle (rumeurs comprises) et les ruses du complice. Prenez le temps de le parcourir.
            </p>
          ) : (
            <p className="guide-texte">
              <strong>Le mot de la fin : la partie classique.</strong> C'est le même jeu, en plus simple : 3 éléments à trouver (pas de mobile), pas de rôles à
              pouvoirs, ni Maître chanteur, ni objectif secret, ni tableau ; 2 PA par tour, 12 manches, de 3 à 6 joueurs. Toutes les règles sont dans « Règles »
              (à l'accueil et dans le menu ☰). <strong>Bonne enquête !</strong>
            </p>
          )}
          <div className="guide-pied">
            {boutonQuitter}
            {boutonSommaire}
            {final && finEtape === 0 && (
              <button type="button" className="btn btn-or btn-petit" onClick={() => setFinEtape(1)}>
                Suivant
              </button>
            )}
          </div>
        </aside>
        {fenetreSommaire}
      </>
    );
  }

  // Un chapitre joué seul est fini : la suite, un autre chapitre, ou l'accueil.
  if (finDeChapitre) {
    if (!pos.seul) return null;
    const prochain = CHAPITRES[pos.c + 1];
    return (
      <>
        <aside className="guide" role="status" aria-live="polite">
          {entete(`🎓 Chapitre ${pos.c + 1} terminé`)}
          <p className="guide-texte">
            <strong>✓ « {chapitre.titre} » : c'est fait !</strong>{' '}
            {prochain ? <>Vous pouvez enchaîner avec le chapitre suivant, « {prochain.titre} », ou en choisir un autre.</> : <>Choisissez un autre chapitre, ou quittez.</>}
          </p>
          <div className="guide-pied">
            {boutonQuitter}
            {boutonSommaire}
            {prochain && (
              <button type="button" className="btn btn-or btn-petit" onClick={() => setPos({ c: pos.c + 1, i: 0, seul: true })}>
                Chapitre suivant
              </button>
            )}
          </div>
        </aside>
        {fenetreSommaire}
      </>
    );
  }
  if (!etape || !prete) return null;

  const titreBulle = (
    <>
      🎓 Chapitre {pos.c + 1}/{CHAPITRES.length} · {pos.i + 1}/{chapitre.etapes.length}
    </>
  );

  // Ouverture de chapitre, changement de rôle : une grande fenêtre.
  if (etape.modale)
    return (
      <>
        <Modale
          titre={etape.modale}
          pied={
            <>
              {boutonQuitter}
              {boutonSommaire}
              <button type="button" className="btn btn-or" onClick={suivante} autoFocus>
                {etape.bouton ?? 'Continuer'}
              </button>
            </>
          }
        >
          <p className="petit muet" style={{ marginTop: 0 }}>
            Partie guidée · chapitre {pos.c + 1} sur {CHAPITRES.length} : {chapitre.titre}
          </p>
          <div className="guide-fenetre">{etape.texte(contexte)}</div>
        </Modale>
        {fenetreSommaire}
      </>
    );

  const fenetre = document.querySelector<HTMLElement>('.voile .modale');
  const modaleOuverte = !!document.querySelector('.voile');
  const enPause = gel && (contexte.vue.joueurActif !== MOI || contexte.vue.etape === 'hypothese');
  const rc = cible?.getBoundingClientRect();
  // Une fenêtre ouverte : la bulle se met du côté (haut ou bas) où il reste le plus de place.
  const rf = fenetre?.getBoundingClientRect();
  // Grande fenêtre sans place au-dessus ni au-dessous : sur grand écran, la bulle se range à côté.
  const hauteurBulle = (bulle.current?.offsetHeight ?? 170) + 16;
  const aCote = !!rf && Math.max(rf.top, window.innerHeight - rf.bottom) < hauteurBulle && rf.left >= 250;
  const enHaut = rf
    ? rf.top >= window.innerHeight - rf.bottom
    : modaleOuverte || (!!rc && rc.height < window.innerHeight * 0.45 && (rc.top + rc.bottom) / 2 > window.innerHeight * 0.55);

  // Onglet à ouvrir d'abord : le bouton « Suivant » attend que ce soit fait.
  const ongletAOuvrir = etape.onglet && cible?.getAttribute('role') === 'tab' ? etape.onglet : null;
  // Une fenêtre ouverte (interrogation, hypothèse…) passe au premier plan : pas de voile par-dessus.
  // Sans élément à montrer, le voile ne couvre tout que sur une étape d'explication (rien à cliquer).
  const voile = pret && !modaleOuverte && (cible || etape.bouton) ? <VoileGuide cible={cible} trouActif={!etape.bouton || !!ongletAOuvrir} /> : null;

  return (
    <>
      {voile}
      <aside
        ref={bulle}
        className={`guide${aCote ? ' guide-cote' : enHaut ? ' guide-haut' : ''}`}
        style={aCote ? { width: Math.min(380, rf!.left - 24) } : undefined}
        role="status"
        aria-live="polite"
      >
        {entete(
          <>
            {titreBulle}
            {enPause && <span className="guide-pause"> · ⏸ pause</span>}
          </>,
        )}
        <div className="guide-texte">{pret ? etape.texte(contexte) : (etape.attente?.(contexte) ?? 'La partie continue…')}</div>
        <div className="guide-pied">
          {boutonQuitter}
          {boutonSommaire}
          {!pret ? (
            <span className="petit muet">⏳ La partie continue…</span>
          ) : ongletAOuvrir ? (
            <span className="petit muet">👉 Ouvrez l'onglet « {ongletAOuvrir} »</span>
          ) : etape.bouton ? (
            <button type="button" className="btn btn-or btn-petit" onClick={suivante}>
              {etape.bouton}
            </button>
          ) : (
            <span className="petit muet">À vous de jouer…</span>
          )}
        </div>
      </aside>
      {fenetreSommaire}
    </>
  );
}
