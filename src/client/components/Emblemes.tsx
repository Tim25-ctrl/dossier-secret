// Illustrations vectorielles légères : portraits stylisés, lieux et armes.
// Dessinées à la main en SVG pour rester gratuites, nettes et légères.

import type { ReactNode } from 'react';
import { PERSONNAGES } from '../../shared/data/manoir';
import { categorieDe, type ArmeId, type ElementId, type LieuId, type SuspectId } from '../../shared/types';

const TRAIT = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Buste générique + accessoire propre à chaque personnage. */
function Portrait({ id }: { id: SuspectId }) {
  const couleur = PERSONNAGES[id].couleur;
  const accessoires: Record<SuspectId, ReactNode> = {
    eleonore: (
      <>
        <circle cx="32" cy="12" r="5" fill="#1a1410" />
        <path d="M21 26c0-9 22-9 22 0" fill="#1a1410" />
        <path d="M24 44c4 4 12 4 16 0" stroke="#f3ead6" strokeWidth="1.6" strokeDasharray="0.5 3.2" fill="none" strokeLinecap="round" />
      </>
    ),
    victor: (
      <>
        <path d="M26 31c3 2 9 2 12 0" stroke="#1a1410" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <rect x="38" y="31" width="10" height="2.6" rx="1.3" fill="#7a4b22" />
        <circle cx="49" cy="32.3" r="1.4" fill="#e2763a" />
        <path d="M22 50l10 6 10-6" stroke="#1a1410" strokeWidth="2" fill="none" />
      </>
    ),
    morel: (
      <>
        <circle cx="27.5" cy="25" r="3.6" stroke="#1a1410" strokeWidth="1.8" fill="none" />
        <circle cx="36.5" cy="25" r="3.6" stroke="#1a1410" strokeWidth="1.8" fill="none" />
        <path d="M31 25h2" stroke="#1a1410" strokeWidth="1.8" />
        <path d="M24 46c0 6 6 8 8 4M40 46c0 6-6 8-8 4" stroke="#c9c1b0" strokeWidth="1.8" fill="none" />
        <circle cx="32" cy="51" r="2" fill="#c9c1b0" />
      </>
    ),
    marchand: (
      <>
        <path d="M22 22c2-9 18-9 20 0c-6-3-14-3-20 0z" fill="#1a1410" />
        <path d="M27 47l5 3 5-3v6l-5-3-5 3z" fill="#1a1410" />
      </>
    ),
    camille: (
      <>
        <path d="M19 19c4-7 22-8 26 0c-8-2-18-2-26 0z" fill="#3a2a4a" />
        <circle cx="44" cy="16" r="1.6" fill="#3a2a4a" />
        <rect x="40" y="44" width="9" height="12" rx="1" fill="#f3ead6" stroke="#1a1410" strokeWidth="1.2" />
        <path d="M42 48h5M42 51h5" stroke="#1a1410" strokeWidth="1" />
      </>
    ),
    gabriel: (
      <>
        <path d="M14 21h36" stroke="#1a1410" strokeWidth="3" strokeLinecap="round" />
        <path d="M22 21c0-8 20-8 20 0z" fill="#1a1410" />
        <path d="M22 42c5 3 15 3 20 0l-2 6c-5 2-11 2-16 0z" fill="#8a3b3b" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={`Portrait de ${PERSONNAGES[id].nom}`}>
      <circle cx="32" cy="32" r="31" fill={couleur} />
      <circle cx="32" cy="32" r="28" fill="none" stroke="#f3ead6" strokeOpacity="0.35" />
      <path d="M12 62c2-12 10-18 20-18s18 6 20 18" fill="#262016" />
      <ellipse cx="32" cy="26" rx="10" ry="11.5" fill="#e9d9bd" />
      {accessoires[id]}
    </svg>
  );
}

const DESSINS_LIEUX: Record<LieuId, ReactNode> = {
  bureau: (
    <>
      <path d="M10 40h44M14 40v14M50 40v14M14 46h14v8" {...TRAIT} />
      <path d="M40 40v-10M36 30h8l-2-8h-4z" {...TRAIT} />
      <path d="M18 36h12v4H18z" {...TRAIT} />
    </>
  ),
  bibliotheque: (
    <>
      <path d="M10 54h44M12 14v40M52 14v40M12 14h40" {...TRAIT} />
      <path d="M17 52V24M22 52V20M27 52V26M33 52V22l5 1-3 29M43 52V18M48 52V24" {...TRAIT} />
    </>
  ),
  serre: (
    <>
      <path d="M10 54V30c0-12 44-12 44 0v24z" {...TRAIT} />
      <path d="M32 18v36M10 38h44" {...TRAIT} />
      <path d="M22 54c0-8 4-12 8-14-1 6-4 10-8 14zM42 54c0-8-4-12-8-14 1 6 4 10 8 14z" {...TRAIT} />
    </>
  ),
  cave: (
    <>
      <path d="M8 54V30a24 24 0 0 1 48 0v24" {...TRAIT} />
      <ellipse cx="24" cy="44" rx="7" ry="9" {...TRAIT} />
      <ellipse cx="40" cy="44" rx="7" ry="9" {...TRAIT} />
      <path d="M17 44h14M33 44h14" {...TRAIT} />
    </>
  ),
  salle_a_manger: (
    <>
      <circle cx="32" cy="34" r="13" {...TRAIT} />
      <circle cx="32" cy="34" r="7" {...TRAIT} />
      <path d="M12 20v10c0 3 4 3 4 0V20M14 30v22M52 20c-5 4-5 14 0 16v16" {...TRAIT} />
    </>
  ),
  salon_musique: (
    <>
      <path d="M12 50h40V36c0-10-8-18-20-18-6 0-10 4-10 10H12z" {...TRAIT} />
      <path d="M16 50v6M48 50v6M18 42h30" {...TRAIT} />
      <path d="M40 10v14M40 10l8 3" {...TRAIT} />
      <circle cx="37" cy="24" r="3" {...TRAIT} />
    </>
  ),
};

const DESSINS_ARMES: Record<ArmeId, ReactNode> = {
  chandelier: (
    <>
      <path d="M32 18v32M18 26v6c0 6 28 6 28 0v-6M24 56h16l-4-6h-8z" {...TRAIT} />
      <path d="M18 26v-6M32 18v-6M46 26v-6" {...TRAIT} />
      <path d="M18 14c-2 2 0 4 0 4s2-2 0-4zM32 6c-2 2 0 4 0 4s2-2 0-4zM46 14c-2 2 0 4 0 4s2-2 0-4z" fill="currentColor" />
    </>
  ),
  coupe_papier: (
    <>
      <path d="M14 50l26-26 6-12-12 6-26 26z" {...TRAIT} />
      <path d="M10 46l8 8M8 56l4-4" {...TRAIT} />
    </>
  ),
  revolver: (
    <>
      <path d="M10 22h36v8H26l-2 4h-6l-2 4c-1 6-2 10-6 14h-4c2-6 4-12 4-18z" {...TRAIT} />
      <circle cx="30" cy="34" r="5" {...TRAIT} />
      <path d="M46 22h8v4h-8" {...TRAIT} />
    </>
  ),
  dague: (
    <>
      <path d="M32 6l5 30H27z" {...TRAIT} />
      <path d="M20 36h24M32 36v14" {...TRAIT} />
      <circle cx="32" cy="54" r="3.5" {...TRAIT} />
    </>
  ),
  presse_papier: (
    <>
      <path d="M12 46c0-14 9-24 20-24s20 10 20 24z" {...TRAIT} />
      <path d="M10 46h44v6H10z" {...TRAIT} />
      <path d="M24 34c2-4 5-6 8-6" {...TRAIT} />
    </>
  ),
  poison: (
    <>
      <path d="M26 8h12M28 8v12L16 44c-3 7 2 12 8 12h16c6 0 11-5 8-12L36 20V8" {...TRAIT} />
      <path d="M20 40h24" {...TRAIT} />
      <path d="M28 46l8 6M36 46l-8 6" {...TRAIT} />
    </>
  ),
};

export function Embleme({ id, taille = 48 }: { id: ElementId; taille?: number }) {
  const cat = categorieDe(id);
  return (
    <span style={{ display: 'inline-flex', width: taille, height: taille, flex: 'none', color: '#3a2c12' }} aria-hidden={cat !== 'suspect'}>
      {cat === 'suspect' ? (
        <Portrait id={id as SuspectId} />
      ) : (
        <svg viewBox="0 0 64 64" width="100%" height="100%">
          <circle cx="32" cy="32" r="31" fill="#d8c9a6" />
          <circle cx="32" cy="32" r="28" fill="none" stroke="#8c6d33" strokeOpacity="0.6" />
          <g transform="translate(6 6) scale(0.8125)">{cat === 'lieu' ? DESSINS_LIEUX[id as LieuId] : DESSINS_ARMES[id as ArmeId]}</g>
        </svg>
      )}
    </span>
  );
}

/** Sceau du jeu (logo). */
/** Contour de la cire : 12 festons réguliers, centrés exactement sur le cercle et les initiales (60, 60). */
const CIRE = 'M60 6L62.3 6.6L64.5 8.2L66.5 10.4L68.3 12.7L70.1 14.6L71.9 15.6L74 15.6L76.4 14.9L79.1 13.8L82 12.9L84.7 12.6L87 13.2L88.7 14.9L89.8 17.4L90.4 20.3L90.9 23.2L91.4 25.7L92.5 27.5L94.3 28.6L96.8 29.1L99.7 29.6L102.6 30.2L105.1 31.3L106.8 33L107.4 35.3L107.1 38L106.2 40.9L105.1 43.6L104.4 46L104.4 48.1L105.4 49.9L107.3 51.7L109.6 53.5L111.8 55.5L113.4 57.7L114 60L113.4 62.3L111.8 64.5L109.6 66.5L107.3 68.3L105.4 70.1L104.4 71.9L104.4 74L105.1 76.4L106.2 79.1L107.1 82L107.4 84.7L106.8 87L105.1 88.7L102.6 89.8L99.7 90.4L96.8 90.9L94.3 91.4L92.5 92.5L91.4 94.3L90.9 96.8L90.4 99.7L89.8 102.6L88.7 105.1L87 106.8L84.7 107.4L82 107.1L79.1 106.2L76.4 105.1L74 104.4L71.9 104.4L70.1 105.4L68.3 107.3L66.5 109.6L64.5 111.8L62.3 113.4L60 114L57.7 113.4L55.5 111.8L53.5 109.6L51.7 107.3L49.9 105.4L48.1 104.4L46 104.4L43.6 105.1L40.9 106.2L38 107.1L35.3 107.4L33 106.8L31.3 105.1L30.2 102.6L29.6 99.7L29.1 96.8L28.6 94.3L27.5 92.5L25.7 91.4L23.2 90.9L20.3 90.4L17.4 89.8L14.9 88.7L13.2 87L12.6 84.7L12.9 82L13.8 79.1L14.9 76.4L15.6 74L15.6 71.9L14.6 70.1L12.7 68.3L10.4 66.5L8.2 64.5L6.6 62.3L6 60L6.6 57.7L8.2 55.5L10.4 53.5L12.7 51.7L14.6 49.9L15.6 48.1L15.6 46L14.9 43.6L13.8 40.9L12.9 38L12.6 35.3L13.2 33L14.9 31.3L17.4 30.2L20.3 29.6L23.2 29.1L25.7 28.6L27.5 27.5L28.6 25.7L29.1 23.2L29.6 20.3L30.2 17.4L31.3 14.9L33 13.2L35.3 12.6L38 12.9L40.9 13.8L43.6 14.9L46 15.6L48.1 15.6L49.9 14.6L51.7 12.7L53.5 10.4L55.5 8.2L57.7 6.6Z';

export function Sceau({ taille = 96 }: { taille?: number }) {
  return (
    <svg className="sceau" width={taille} height={taille} viewBox="0 0 120 120" role="img" aria-label="Sceau Dossier Secret">
      <defs>
        <radialGradient id="cire" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#e2c486" />
          <stop offset="100%" stopColor="#8c6d33" />
        </radialGradient>
      </defs>
      <path
        d={CIRE}
        fill="url(#cire)"
      />
      <circle cx="60" cy="60" r="36" fill="none" stroke="#5e4720" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="30" fill="none" stroke="#5e4720" strokeWidth="1" strokeDasharray="2 4" />
      <text x="60" y="71" textAnchor="middle" fontFamily="Cormorant Garamond, Georgia, serif" fontWeight="700" fontSize="34" fill="#3b2b10">
        DS
      </text>
    </svg>
  );
}

/** Petites icônes d'interface. */
export function Icone({ nom, taille = 18 }: { nom: 'cadenas' | 'oeil' | 'copie' | 'couronne' | 'robot' | 'loupe' | 'reglages' | 'livre' | 'plume' | 'dossier' | 'bulle'; taille?: number }) {
  const chemins: Record<typeof nom, ReactNode> = {
    cadenas: <path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" />,
    oeil: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    copie: <path d="M8 8h11v13H8zM5 16V3h11" />,
    couronne: <path d="M3 18h18l-2-11-5 5-2-7-2 7-5-5z" />,
    robot: <path d="M5 9h14v11H5zM12 9V5M9 14h.01M15 14h.01M2 13v3M22 13v3" />,
    loupe: <path d="M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM15 15l6 6" />,
    reglages: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12h3M2 12h3M12 2v3M12 19v3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />,
    livre: <path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6M20 4v14h-6" />,
    plume: <path d="M20 4C10 4 6 10 5 19l3-3c4 0 9-2 12-12zM5 19l-2 2" />,
    dossier: <path d="M3 6h6l2 2h10v11H3z" />,
    bulle: <path d="M4 5h16v11H10l-5 4v-4H4z" />,
  };
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {chemins[nom]}
    </svg>
  );
}
