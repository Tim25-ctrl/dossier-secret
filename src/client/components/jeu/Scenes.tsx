// Grands moments mis en scène :
// - l'accusation : écran assombri, les trois cartes accusées se retournent une à une, puis le verdict ;
// - la révélation finale : la solution se retourne, l'épilogue s'écrit, puis le complice est nommé.
// Tout le monde voit la même chose (une accusation est publique) : rien ne trahit le complice. Une
// accusation fausse ne dit toujours pas quelle carte était fausse. On peut tout passer d'un geste ;
// avec « Animations réduites », tout s'affiche d'un coup.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AFFAIRES } from '../../../shared/data/catalogue';
import type { ElementId, Triplet, VueJoueur } from '../../../shared/types';
import { assourdir } from '../../ambianceSonore';
import { jouer } from '../../sons';
import { Carte } from '../Commun';
import { Sceau } from '../Emblemes';
import type { Noms } from './Textes';

const animationsReduites = () =>
  document.documentElement.dataset.animations === 'reduites' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Carte présentée face cachée, qui se retourne quand `visible` devient vrai. */
function CarteRetournable({ id, visible }: { id: ElementId; visible: boolean }) {
  return (
    <div className={`retournable${visible ? ' retournee' : ''}`}>
      <div className="retournable-interieur">
        <div className="retournable-face">
          <Carte id={id} />
        </div>
        <div className="retournable-dos" aria-hidden="true">
          <Sceau taille={46} />
        </div>
      </div>
    </div>
  );
}

/** Déroulé minuté : étape 0, 1, 2… jusqu'à `fin` (tout de suite si les animations sont réduites ou si l'on passe). */
function useDeroule(instants: number[], actif = true) {
  const [etape, setEtape] = useState(0);
  const passer = () => setEtape(instants.length);
  useEffect(() => {
    if (!actif) return;
    if (animationsReduites()) return passer();
    const minuteurs = instants.map((ms, i) => window.setTimeout(() => setEtape((e) => Math.max(e, i + 1)), ms));
    return () => minuteurs.forEach(clearTimeout);
  }, [actif]); // eslint-disable-line react-hooks/exhaustive-deps
  return { etape, passer, fini: etape >= instants.length };
}

// ---------------------------------------------------------------------------
// L'accusation
// ---------------------------------------------------------------------------

/** Instants (ms) : cartes retournées une à une, puis verdict. */
const INSTANTS_ACCUSATION = [1000, 1800, 2600, 3500];

function ContenuAccusation({ accusateur, triplet, correcte, etape }: { accusateur: string; triplet: Triplet; correcte: boolean; etape: number }) {
  return (
    <div className="scene-accusation-contenu">
      <h2 className="scene-titre">{accusateur === 'Vous' ? 'Vous accusez !' : `${accusateur} accuse !`}</h2>
      <div className="scene-cartes">
        <CarteRetournable id={triplet.suspect} visible={etape >= 1} />
        <CarteRetournable id={triplet.lieu} visible={etape >= 2} />
        <CarteRetournable id={triplet.arme} visible={etape >= 3} />
        {triplet.mobile && <CarteRetournable id={triplet.mobile} visible={etape >= 3} />}
      </div>
      <div className={`verdict-tampon ${correcte ? 'juste' : 'fausse'}${etape >= 4 ? ' visible' : ''}`} role="status">
        {etape >= 4 ? (correcte ? 'Accusation juste' : 'Accusation fausse') : ''}
      </div>
    </div>
  );
}

/** Sons de la scène : une carte qui se retourne à chaque étape, puis le verdict. */
function useSonsAccusation(etape: number, correcte: boolean) {
  const joue = useRef(0);
  useEffect(() => {
    if (animationsReduites()) {
      if (etape >= 4 && joue.current < 4) jouer(correcte ? 'verdictJuste' : 'verdictFaux');
      joue.current = etape;
      return;
    }
    for (let e = joue.current + 1; e <= etape; e++) jouer(e === 4 ? (correcte ? 'verdictJuste' : 'verdictFaux') : 'retourne');
    joue.current = Math.max(joue.current, etape);
  }, [etape, correcte]);
}

/**
 * En partie : chaque NOUVELLE accusation (jamais celles déjà vues au chargement) est mise en scène
 * pour tous. Une accusation juste termine la partie : sa scène est jouée par l'écran de fin.
 */
export function useSceneAccusation(vue: VueJoueur, nom: Noms) {
  const vues = useRef({ partie: vue.partieId, n: vue.historique.length });
  const [scene, setScene] = useState<{ accusateur: string; triplet: Triplet; correcte: boolean; cle: number } | null>(null);
  useEffect(() => {
    const r = vues.current;
    if (r.partie !== vue.partieId) {
      vues.current = { partie: vue.partieId, n: vue.historique.length };
      return;
    }
    const nouveaux = vue.historique.slice(r.n);
    r.n = vue.historique.length;
    const acc = nouveaux.filter((e) => e.type === 'accusation').at(-1);
    if (acc && acc.type === 'accusation' && !acc.correcte && vue.etape !== 'terminee')
      setScene({ accusateur: acc.joueur === vue.moi.id ? 'Vous' : nom(acc.joueur), triplet: acc.triplet, correcte: false, cle: Date.now() });
  }, [vue.historique.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return scene ? <SceneAccusation key={scene.cle} {...scene} onFini={() => setScene(null)} /> : null;
}

/** Scène d'accusation par-dessus la partie (accusation fausse : la partie continue ensuite). */
function SceneAccusation({ accusateur, triplet, correcte, onFini }: { accusateur: string; triplet: Triplet; correcte: boolean; onFini: () => void }) {
  const { etape, passer, fini } = useDeroule(INSTANTS_ACCUSATION);
  useSonsAccusation(etape, correcte);
  useEffect(() => {
    assourdir(true);
    return () => assourdir(false);
  }, []);
  // La scène se referme seule peu après le verdict.
  useEffect(() => {
    if (!fini) return;
    const t = window.setTimeout(onFini, 2800);
    return () => clearTimeout(t);
  }, [fini]); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div className="scene" role="dialog" aria-modal="true" aria-label={`${accusateur} accuse`} onClick={() => (fini ? onFini() : passer())}>
      <ContenuAccusation accusateur={accusateur} triplet={triplet} correcte={correcte} etape={etape} />
      <p className="scene-astuce">{fini ? "Toucher pour reprendre l'enquête" : 'Toucher pour passer'}</p>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// La révélation finale
// ---------------------------------------------------------------------------

const CLE_REVELATIONS = 'dossier-secret:revelations-vues';

/** La révélation n'est montrée qu'une fois par partie sur cet appareil (pas à chaque rechargement). */
export function revelationAMontrer(partieId: string): boolean {
  try {
    return !(JSON.parse(localStorage.getItem(CLE_REVELATIONS) ?? '[]') as string[]).includes(partieId);
  } catch {
    return true;
  }
}
function marquerRevelationVue(partieId: string) {
  try {
    const vues = (JSON.parse(localStorage.getItem(CLE_REVELATIONS) ?? '[]') as string[]).filter((x) => x !== partieId);
    localStorage.setItem(CLE_REVELATIONS, JSON.stringify([...vues, partieId].slice(-30)));
  } catch {
    /* stockage indisponible : la révélation reviendra au rechargement */
  }
}

/**
 * Fin de partie : l'accusation décisive (s'il y en a une), la solution qui se retourne, l'épilogue,
 * puis le complice. `onBilan` mène à l'écran de bilan habituel.
 */
export function Revelation({ vue, nom, onBilan }: { vue: VueJoueur; nom: Noms; onBilan: () => void }) {
  const r = vue.resultat!;
  const infos = AFFAIRES[vue.affaire];
  // Accusation qui a terminé la partie : juste, ou dernière accusation fausse possible.
  const decisive =
    r.raison === 'accusation_correcte' || r.raison === 'objectif_complice'
      ? r.accusations.find((a) => a.correcte)
      : r.raison === 'plus_d_accusateur'
        ? r.accusations.at(-1)
        : undefined;
  const [phase, setPhase] = useState<'accusation' | 'verite'>(decisive ? 'accusation' : 'verite');

  // Accusation décisive (même scène qu'en partie).
  const acc = useDeroule(INSTANTS_ACCUSATION, phase === 'accusation');
  useSonsAccusation(phase === 'accusation' ? acc.etape : 0, !!decisive?.correcte);
  useEffect(() => {
    if (phase !== 'accusation' || !acc.fini) return;
    const t = window.setTimeout(() => setPhase('verite'), 2600);
    return () => clearTimeout(t);
  }, [phase, acc.fini]);

  // La vérité : intro, trois cartes, quatre paragraphes d'épilogue, puis le complice.
  const recit = r.explication.slice(0, 4);
  const instants = [1600, 2400, 3200, ...recit.map((_, i) => 4600 + i * 2600), 4600 + recit.length * 2600 + 600, 4600 + recit.length * 2600 + 2200];
  const ver = useDeroule(instants, phase === 'verite');
  const nbCartes = Math.min(3, ver.etape);
  const nbParagraphes = Math.max(0, Math.min(recit.length, ver.etape - 3));
  const complicePret = ver.etape >= 4 + recit.length;
  const compliceNomme = ver.etape >= 5 + recit.length;
  const sonsVerite = useRef(0);
  useEffect(() => {
    if (phase !== 'verite') return;
    for (let e = sonsVerite.current + 1; e <= ver.etape; e++) {
      if (e <= 3 && !animationsReduites()) jouer('retourne');
      if (e === 5 + recit.length) jouer('demasque');
    }
    sonsVerite.current = Math.max(sonsVerite.current, ver.etape);
  }, [phase, ver.etape]); // eslint-disable-line react-hooks/exhaustive-deps

  const terminer = () => {
    marquerRevelationVue(vue.partieId);
    onBilan();
  };
  const passerTout = () => {
    if (phase === 'accusation') {
      acc.passer();
      setPhase('verite');
    }
    ver.passer();
  };

  const intro =
    r.raison === 'manches_ecoulees'
      ? "L'aube se lève… et le coupable court toujours."
      : r.raison === 'plus_d_accusateur'
        ? 'Plus personne ne peut accuser… et le coupable s’en tire.'
        : r.raison === 'objectif_complice'
          ? 'L’affaire est résolue… mais le complice a eu le dernier mot.'
          : r.vainqueur === 'maitre_chanteur'
            ? 'L’affaire est résolue… par le Maître chanteur, qui garde tout pour lui.'
            : 'L’affaire est résolue.';

  return (
    <div className="scene scene-revelation" role="dialog" aria-modal="true" aria-label="La vérité">
      {!ver.fini && (
        <button type="button" className="btn btn-discret btn-petit scene-passer" onClick={passerTout}>
          Passer
        </button>
      )}
      {phase === 'accusation' && decisive ? (
        <div onClick={() => (acc.fini ? setPhase('verite') : acc.passer())}>
          <ContenuAccusation accusateur={decisive.joueur === vue.moi.id ? 'Vous' : nom(decisive.joueur)} triplet={decisive.triplet} correcte={decisive.correcte} etape={acc.etape} />
        </div>
      ) : (
        <div className="scene-verite">
          <p className="scene-intro">{intro}</p>
          <h2 className="scene-titre">La vérité sur {infos.nuit}…</h2>
          <div className="scene-cartes">
            <CarteRetournable id={r.solution.suspect} visible={nbCartes >= 1} />
            <CarteRetournable id={r.solution.lieu} visible={nbCartes >= 2} />
            <CarteRetournable id={r.solution.arme} visible={nbCartes >= 3} />
            {r.solution.mobile && <CarteRetournable id={r.solution.mobile} visible={nbCartes >= 3} />}
          </div>
          <div className="scene-epilogue">
            {recit.slice(0, nbParagraphes).map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          {complicePret && (
            <p className="scene-complice">
              Le complice était…{' '}
              {compliceNomme && (
                <strong>
                  {nom(r.complice)}
                  {r.complice === vue.moi.id ? ' (vous)' : ''} !
                </strong>
              )}
            </p>
          )}
          {ver.fini && (
            <button type="button" className="btn btn-or scene-bilan" onClick={terminer} autoFocus>
              Voir le bilan
            </button>
          )}
        </div>
      )}
    </div>
  );
}
