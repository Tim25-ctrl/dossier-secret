// Illustrations vectorielles légères : portraits stylisés, lieux et armes.
// Dessinées à la main en SVG pour rester gratuites, nettes et légères.

import type { ReactNode } from 'react';
import { PERSONNAGES } from '../../shared/data/catalogue';
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
    // --- Le train de nuit ---
    irina: (
      <>
        <path d="M21 24c0-10 22-10 22 0c-4-4-18-4-22 0z" fill="#1a1410" />
        <circle cx="32" cy="12" r="4.5" fill="#1a1410" />
        <path d="M25 17l3-4 4 3 4-3 3 4" stroke="#e2c486" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
        <path d="M27 46c3 2 7 2 10 0" stroke="#f3ead6" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </>
    ),
    hector: (
      <>
        <path d="M22 18h20v-4c0-4-20-4-20 0z" fill="#3b4a2a" />
        <path d="M19 18h26" stroke="#1a1410" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M23 31c3-3 6-2 9 0 3-2 6-3 9 0-3 2-6 1-9-1-3 2-6 3-9 1z" fill="#f3ead6" />
        <path d="M38 50h4v3h-4z" fill="#b65c6b" />
        <circle cx="40" cy="55.5" r="2.2" fill="#e2c486" />
      </>
    ),
    mathilde: (
      <>
        <path d="M21 23c1-10 21-10 22 0c-5-4-17-4-22 0z" fill="#5a4630" />
        <circle cx="42" cy="17" r="3.4" fill="#5a4630" />
        <path d="M23 45l9 5 9-5" stroke="#f3ead6" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
        <circle cx="32" cy="51" r="1.8" fill="#c9a14a" />
      </>
    ),
    lucas: (
      <>
        {/* Valet : cheveux plaqués, gilet rayé, col blanc et nœud papillon noir */}
        <path d="M21 23c0-10 22-10 22 0c-5-3-9-4-13-3-3 1-6 2-9 3z" fill="#1a1410" />
        <path d="M25 50v12M29 49v13M35 49v13M39 50v12" stroke="#c9a14a" strokeWidth="1.6" />
        <path d="M26 45l6 4 6-4" stroke="#f3ead6" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
        <path d="M28.5 48.5l3.5 1.8 3.5-1.8v3.6l-3.5-1.8-3.5 1.8z" fill="#1a1410" />
      </>
    ),
    margaret: (
      <>
        <path d="M20 29c-1-12 6-17 12-17s13 5 12 17c-2-5-4-8-6-9-4 2-9 2-12 0-2 1-4 4-6 9z" fill="#c98b3a" />
        <path d="M22 18h20" stroke="#1a1410" strokeWidth="2" />
        <path d="M40 18c2-6 6-9 9-9-1 4-4 7-9 9z" fill="#f3ead6" />
        <path d="M25 44c4 4 10 4 14 0" stroke="#f3ead6" strokeWidth="1.6" strokeDasharray="0.5 3.2" fill="none" strokeLinecap="round" />
      </>
    ),
    paul: (
      <>
        <ellipse cx="31" cy="16.5" rx="12" ry="4.5" fill="#1a1410" />
        <circle cx="31" cy="11.5" r="1.3" fill="#1a1410" />
        <path d="M36 33h7v3.5c0 2.5-3.5 2.5-3.5 0" stroke="#5a3b22" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M27 47l5 2 5-2v5l-5-2-5 2z" fill="#8a3b3b" />
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
  // --- Le train de nuit ---
  compartiment: (
    <>
      <rect x="16" y="10" width="32" height="20" rx="5" {...TRAIT} />
      <path d="M10 40h44v8H10zM14 48v6M50 48v6" {...TRAIT} />
      <path d="M16 40c0-5 9-5 9 0" {...TRAIT} />
      <path d="M24 16l6 6M34 14l8 8" {...TRAIT} />
    </>
  ),
  couloir: (
    <>
      <path d="M8 8l16 16v16L8 56M56 8L40 24v16l16 16M24 24h16M24 40h16" {...TRAIT} />
      <path d="M12 20v8M52 20v8" {...TRAIT} />
      <circle cx="32" cy="16" r="2" fill="currentColor" />
    </>
  ),
  wagon_restaurant: (
    <>
      <path d="M10 40h44M18 40v14M46 40v14" {...TRAIT} />
      <path d="M26 40v-8M20 32h12l-3-8h-6z" {...TRAIT} />
      <path d="M40 28c0 5 5 5 5 0v-4h-5zM42.5 33v7" {...TRAIT} />
    </>
  ),
  voiture_salon: (
    <>
      <path d="M14 54V40c0-4 4-6 8-6h20c4 0 8 2 8 6v14M14 46h36M18 54v-8M46 54v-8" {...TRAIT} />
      <path d="M32 6v8M23 14h18l-3 6H26z" {...TRAIT} />
      <path d="M26 20v3M32 20v3M38 20v3" {...TRAIT} />
    </>
  ),
  fourgon: (
    <>
      <rect x="8" y="40" width="24" height="14" rx="2" {...TRAIT} />
      <rect x="34" y="32" width="22" height="22" rx="2" {...TRAIT} />
      <rect x="12" y="24" width="18" height="16" rx="2" {...TRAIT} />
      <path d="M20 40v14M45 32v22M21 24v16" {...TRAIT} />
    </>
  ),
  plateforme: (
    <>
      <path d="M6 32l12-16 9 10 8-8 23 14" {...TRAIT} />
      <path d="M8 44h48M8 54h48M12 44v10M22 44v10M32 44v10M42 44v10M52 44v10" {...TRAIT} />
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
  // --- Le train de nuit ---
  cordelette: (
    <>
      <path d="M10 14c8 0 11 8 20 8s12-8 20-8" {...TRAIT} />
      <path d="M30 22v12" {...TRAIT} />
      <path d="M26 34h8l3 18H23z" {...TRAIT} />
      <path d="M27.5 40v10M32.5 40v10" {...TRAIT} />
    </>
  ),
  stylet: (
    <>
      <path d="M32 6l3.5 32h-7z" {...TRAIT} />
      <path d="M22 38h20M32 38v12" {...TRAIT} />
      <circle cx="32" cy="54" r="3.5" {...TRAIT} />
    </>
  ),
  pistolet: (
    <>
      <path d="M12 22h32v9H31l-2 4h-5l-3 15h-9l3-15c1-4 0-7-3-8z" {...TRAIT} />
      <path d="M44 22h7v4h-7" {...TRAIT} />
      <path d="M24 35c2 2 5 2 5 0" {...TRAIT} />
    </>
  ),
  somnifere: (
    <>
      <path d="M26 22h12v4c4 2 6 6 6 10v14c0 3-2 5-5 5H25c-3 0-5-2-5-5V36c0-4 2-8 6-10z" {...TRAIT} />
      <path d="M28 22v-7c0-4 8-4 8 0v7" {...TRAIT} />
      <path d="M30 48a4 4 0 1 0 4-6 3 3 0 0 1-4 6z" fill="currentColor" />
    </>
  ),
  cle_molette: (
    <>
      <path d="M12 48l22-22M17 53l22-22M12 48l5 5" {...TRAIT} />
      <path d="M34 26c-3-6 1-14 9-15l-5 7 3 5 6 1 5-6c2 8-6 15-13 13" {...TRAIT} />
    </>
  ),
  canne: (
    <>
      {/* Canne d'ébène inclinée : pommeau d'argent en olive (reflet), bague, embout */}
      <path d="M34.7 21.1L39.3 22.9 24.9 56.3 22.1 55.1z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M33.4 20.4l7.4 3" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M23.2 56.6l-1.4 3.3" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
      <ellipse cx="39.4" cy="15.6" rx="5.6" ry="6.8" transform="rotate(22.5 39.6 15)" fill="#d6d0c0" stroke="currentColor" strokeWidth="2" />
      <path d="M36.5 15c.2-1.9 1.1-3.3 2.5-4.1" stroke="#fbf8f0" strokeWidth="1.6" fill="none" strokeLinecap="round" />
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
export function Icone({ nom, taille = 18 }: { nom: 'cadenas' | 'oeil' | 'copie' | 'couronne' | 'robot' | 'loupe' | 'reglages' | 'livre' | 'plume' | 'dossier' | 'bulle' | 'joueurs' | 'insigne'; taille?: number }) {
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
    // Trois silhouettes à chapeau melon : les enquêteurs réunis.
    joueurs: (
      <>
        <path d="M9.5 6.5h5M10 6.5c0-2.6 4-2.6 4 0" />
        <circle cx="12" cy="9.5" r="2.4" />
        <path d="M7.5 20c.4-3.6 2.2-5.6 4.5-5.6s4.1 2 4.5 5.6" />
        <circle cx="5.5" cy="11" r="2" />
        <path d="M2 19.5c.3-2.7 1.6-4.2 3.5-4.2 1 0 1.8.4 2.4 1.1" />
        <circle cx="18.5" cy="11" r="2" />
        <path d="M22 19.5c-.3-2.7-1.6-4.2-3.5-4.2-1 0-1.8.4-2.4 1.1" />
      </>
    ),
    // Insigne étoilé (grade de l'enquêteur).
    insigne: (
      <>
        <path d="M12 2.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" />
        <path d="M8.5 17.5L7 22l5-2 5 2-1.5-4.5" />
      </>
    ),
  };
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {chemins[nom]}
    </svg>
  );
}
