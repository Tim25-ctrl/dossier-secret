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
    // --- Le paquebot ---
    helene: (
      <>
        {/* Chanteuse des années 20 : carré court ondulé, bandeau doré à plume, rouge à lèvres, sautoir de perles */}
        <path d="M21 27c-1-11 6-16 11-16s12 5 11 16c-2-5-5-8-11-8s-9 3-11 8z" fill="#1a1410" />
        <path d="M21 26c0 4 1 7 3 8v-9zM43 26c0 4-1 7-3 8v-9z" fill="#1a1410" />
        <path d="M21.5 19.5c6-3 15-3 21 0" stroke="#e2c486" strokeWidth="1.6" fill="none" />
        <path d="M40 18c3-6 6-9 9-10-1 4-4 8-9 10z" fill="#f3ead6" />
        <path d="M30 32c1.3.8 2.7.8 4 0" stroke="#b03a48" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M24 45c3 9 13 9 16 0" stroke="#f3ead6" strokeWidth="1.6" strokeDasharray="0.5 3" fill="none" strokeLinecap="round" />
      </>
    ),
    legoff: (
      <>
        {/* Officier : casquette marine galonnée, barbe courte, épaulettes et boutons dorés */}
        <path d="M23 31c1 7 4.5 10 9 10s8-3 9-10c-2 2.5-5 3.5-9 3.5s-7-1-9-3.5z" fill="#5a4630" />
        <path d="M20 18c0-7 24-7 24 0z" fill="#1f2c44" />
        <rect x="21" y="16.5" width="22" height="3.2" fill="#1f2c44" />
        <path d="M21 18.2h22" stroke="#e2c486" strokeWidth="1" />
        <path d="M21 19.6c4 3 18 3 22 0z" fill="#111" />
        <circle cx="32" cy="14" r="1.6" fill="#e2c486" />
        <path d="M14 55l7-2.5M50 55l-7-2.5" stroke="#e2c486" strokeWidth="2" strokeLinecap="round" />
        <circle cx="32" cy="52" r="1.1" fill="#e2c486" />
        <circle cx="32" cy="57.5" r="1.1" fill="#e2c486" />
      </>
    ),
    isabella: (
      <>
        {/* Comtesse : cheveux de jais relevés, chignon sur le côté, pendants d'oreilles et collier de rubis */}
        <path d="M20 27c-1-12 6-16 12-16s13 4 12 16c-3-6-6-9-12-9s-9 3-12 9z" fill="#2a1a12" />
        <circle cx="43.5" cy="14.5" r="4.6" fill="#2a1a12" />
        <path d="M21.6 30v4M42.4 30v4" stroke="#e2c486" strokeWidth="1.2" />
        <circle cx="21.6" cy="35.2" r="1.4" fill="#7fb3d5" />
        <circle cx="42.4" cy="35.2" r="1.4" fill="#7fb3d5" />
        <path d="M25 45c4 3.5 10 3.5 14 0" stroke="#b03a48" strokeWidth="1.9" strokeDasharray="0.5 2.6" strokeLinecap="round" fill="none" />
      </>
    ),
    breval: (
      <>
        {/* Égyptologue : casque colonial, barbe grise, lorgnon */}
        <path d="M23 30c0 9 4 14 9 14s9-5 9-14c-2 3-5 5-9 5s-7-2-9-5z" fill="#bdb6a6" />
        <path d="M18 21c0-11 28-11 28 0z" fill="#d8c79a" />
        <path d="M14 21.5c6 2 30 2 36 0" stroke="#b8a77a" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="28" cy="26" r="2.7" stroke="#1a1410" strokeWidth="1.2" fill="none" />
        <circle cx="36" cy="26" r="2.7" stroke="#1a1410" strokeWidth="1.2" fill="none" />
        <path d="M30.7 26h2.6" stroke="#1a1410" strokeWidth="1.2" />
      </>
    ),
    rose: (
      <>
        {/* Radiotélégraphiste : cheveux courts auburn, casque d'écoute, col d'uniforme */}
        <path d="M21 25c-1-10 5-14 11-14s12 4 11 14c-3-4-7-6-11-6s-8 2-11 6z" fill="#8a4a2a" />
        <path d="M19 26c0-15 26-15 26 0" stroke="#3a3a3a" strokeWidth="2.2" fill="none" />
        <rect x="17" y="23" width="5" height="8" rx="2" fill="#3a3a3a" />
        <rect x="42" y="23" width="5" height="8" rx="2" fill="#3a3a3a" />
        <path d="M26 45l6 4 6-4" stroke="#f3ead6" strokeWidth="2" fill="none" strokeLinejoin="round" />
        <path d="M41 51l-2 3h2.4l-2 3.4" stroke="#e2c486" strokeWidth="1.1" fill="none" />
      </>
    ),
    max: (
      <>
        {/* Joueur : cheveux gominés à la raie, fine moustache, cigarette, nœud papillon et carte en poche */}
        <path d="M21 23c0-10 22-11 22 0-6-4-15-4-22 0z" fill="#1a1410" />
        <path d="M27 14.5l2 7" stroke="#e9d9bd" strokeWidth="0.9" />
        <path d="M28 31c2-1 6-1 8 0" stroke="#1a1410" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M36 33.5l8 1.5" stroke="#f3ead6" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="44.3" cy="35.1" r="0.9" fill="#e2763a" />
        <path d="M27 45l5 7 5-7z" fill="#f3ead6" />
        <path d="M27.5 47l4.5 1.8 4.5-1.8v4.4l-4.5-1.8-4.5 1.8z" fill="#1a1410" />
        <g transform="rotate(12 42.5 53.5)">
          <rect x="40" y="50" width="5" height="7" rx="0.6" fill="#f3ead6" />
          <path d="M42.5 52.3c-.7-1-2-.3-1.3.6l1.3 1.3 1.3-1.3c.7-.9-.6-1.6-1.3-.6z" fill="#b03a48" />
        </g>
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
  // --- Le paquebot ---
  suite: (
    <>
      <path d="M10 44h44v9H10zM12 53v4M52 53v4" {...TRAIT} />
      <path d="M12 44V28c7-4 11-4 14 0v16" {...TRAIT} />
      <rect x="16" y="37" width="9" height="7" rx="2" {...TRAIT} />
      <rect x="36" y="12" width="15" height="15" rx="4" {...TRAIT} />
      <path d="M43.5 12v15M36 19.5h15" {...TRAIT} />
    </>
  ),
  poste_radio: (
    <>
      <rect x="10" y="28" width="44" height="26" rx="3" {...TRAIT} />
      <circle cx="22" cy="41" r="6" {...TRAIT} />
      <path d="M22 41l3-3M34 36h14M34 42h14M34 48h10" {...TRAIT} />
      <path d="M30 28L38 10" {...TRAIT} />
      <path d="M43 12c3 2 3 6 0 8M47 9c5 4 5 10 0 14" {...TRAIT} />
    </>
  ),
  piscine: (
    <>
      <path d="M8 40c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" {...TRAIT} />
      <path d="M8 50c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" {...TRAIT} />
      <path d="M38 38V12M48 38V12M38 12c0-4 10-4 10 0M38 20h10M38 28h10" {...TRAIT} />
    </>
  ),
  fumoir: (
    <>
      <rect x="12" y="14" width="18" height="26" rx="2" transform="rotate(-12 21 27)" {...TRAIT} />
      <rect x="30" y="14" width="18" height="26" rx="2" transform="rotate(10 39 27)" {...TRAIT} />
      <path d="M38 24c-2-3-6-1-4 2l4 4 4-4c2-3-2-5-4-2z" {...TRAIT} />
      <path d="M12 52h26M40 52h5" {...TRAIT} />
      <path d="M50 50c-3-3 3-5 0-8" {...TRAIT} />
    </>
  ),
  salle_machines: (
    <>
      <circle cx="26" cy="38" r="10" {...TRAIT} />
      <circle cx="26" cy="38" r="3.5" {...TRAIT} />
      <path d="M36 38h4M33.1 45.1l2.8 2.8M26 48v4M18.9 45.1l-2.8 2.8M16 38h-4M18.9 30.9l-2.8-2.8M26 28v-4M33.1 30.9l2.8-2.8" {...TRAIT} />
      <circle cx="48" cy="16" r="7" {...TRAIT} />
      <path d="M48 16l3-4M48 23v12h-6" {...TRAIT} />
    </>
  ),
  pont: (
    <>
      <circle cx="32" cy="18" r="9" {...TRAIT} />
      <circle cx="32" cy="18" r="4" {...TRAIT} />
      <path d="M25.6 11.6l3.6 3.6M38.4 11.6l-3.6 3.6M25.6 24.4l3.6-3.6M38.4 24.4l-3.6-3.6" {...TRAIT} />
      <path d="M6 34h52M6 44h52M10 34v20M24 34v20M40 34v20M54 34v20" {...TRAIT} />
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
  // --- Le paquebot ---
  sextant: (
    <>
      <path d="M32 10L15 46M32 10L49 46M15 46q17 9 34 0" {...TRAIT} />
      <path d="M32 10L40 49" {...TRAIT} />
      <path d="M21 28h17" {...TRAIT} strokeWidth={4} />
      <rect x="28.5" y="5" width="7" height="5" rx="1" {...TRAIT} />
    </>
  ),
  statuette: (
    <>
      <path d="M18 54h28v4H18z" {...TRAIT} />
      <path d="M24 54V38c0-4 3-6 6-6h4c3 0 6 2 6 6v16" {...TRAIT} />
      <path d="M28 32l-1-14 4 6h2l4-6-1 14" {...TRAIT} />
      <path d="M33 25c4 1 8 2 11 4l-8 2" {...TRAIT} />
    </>
  ),
  lance_fusees: (
    <>
      <path d="M10 26h28v11H27l-2 4h-5l-3 13h-9l3-14c1-4 0-7-3-8z" {...TRAIT} />
      <path d="M38 22h12v18H38" {...TRAIT} />
      <path d="M55 18l3-4M56 31h5M55 41l3 4" {...TRAIT} />
    </>
  ),
  champagne: (
    <>
      <path d="M16 18h32c0 10-7 16-16 16s-16-6-16-16z" {...TRAIT} />
      <path d="M32 34v16M23 54h18" {...TRAIT} />
      <circle cx="27" cy="25" r="1.4" fill="currentColor" />
      <circle cx="33" cy="22" r="1.2" fill="currentColor" />
      <circle cx="38" cy="26" r="1" fill="currentColor" />
      <path d="M46 6c-2.4 3.6-2.4 6 0 7.2 2.4-1.2 2.4-3.6 0-7.2z" fill="currentColor" />
    </>
  ),
  tisonnier: (
    <>
      <path d="M16 52L46 14" {...TRAIT} strokeWidth={3.4} />
      <path d="M46 14l7-2-3 7" {...TRAIT} />
      <circle cx="13" cy="55" r="4.5" {...TRAIT} />
    </>
  ),
  gaffe: (
    <>
      <path d="M10 58L46 16" {...TRAIT} strokeWidth={3.2} />
      <path d="M46 16c1-5 7-6 9-2s-2 7-6 5M46 16l4-8" {...TRAIT} />
      <path d="M14 53.5l3 2.6" {...TRAIT} />
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
export function Icone({ nom, taille = 18 }: { nom: 'cadenas' | 'oeil' | 'copie' | 'couronne' | 'robot' | 'loupe' | 'reglages' | 'livre' | 'plume' | 'dossier' | 'bulle' | 'joueurs' | 'joueur' | 'insigne'; taille?: number }) {
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
    // Une silhouette à chapeau melon : l'enquêteur seul.
    joueur: (
      <>
        <path d="M8 6.5h8M9 6.5c0-3.4 6-3.4 6 0" />
        <circle cx="12" cy="10.5" r="3" />
        <path d="M6 21c.5-4.2 2.8-6.6 6-6.6s5.5 2.4 6 6.6" />
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
