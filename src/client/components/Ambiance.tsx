// Ambiance discrète derrière le titre de l'accueil : la pluie du Manoir des Brumes, la neige
// du train de nuit ou le brouillard du paquebot. Purement décorative (masquée aux lecteurs d'écran), coupée par le réglage
// « Animations réduites » et par le réglage du système.

import { useMemo } from 'react';
import { useMeteo } from '../meteo';

import type { AffaireId } from '../../shared/types';

export type TypeAmbiance = 'pluie' | 'neige' | 'brouillard';

/** Ce qui tombe (ou flotte) dans chaque histoire. */
export function ambianceDe(affaire: AffaireId): TypeAmbiance {
  return affaire === 'train' ? 'neige' : affaire === 'paquebot' ? 'brouillard' : 'pluie';
}

/** Pseudo-hasard stable : les mêmes positions à chaque affichage, sans saut visuel. */
function hasard(i: number, graine: number): number {
  const x = Math.sin(i * 12.9898 + graine * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * `attenuation` (0 à 1) : la pluie ou la neige faiblit (à l'aube). `intensite` (0 à 1) : force de
 * l'averse du moment (voir meteo.ts) ; à 0, plus rien ne tombe.
 */
export function Ambiance({
  type,
  discret = false,
  attenuation = 0,
  intensite = 1,
}: {
  type: TypeAmbiance;
  discret?: boolean;
  attenuation?: number;
  intensite?: number;
}) {
  const particules = useMemo(() => {
    if (type === 'brouillard') {
      // De grandes nappes floues qui dérivent lentement d'un bord à l'autre.
      return Array.from({ length: discret ? 7 : 6 }, (_, i) => {
        const duree = 45 + hasard(i, 2) * 40;
        return { gauche: 0, haut: 4 + hasard(i, 1) * 80, duree, delai: -hasard(i, 3) * duree, taille: 45 + hasard(i, 4) * 40, opacite: 0.35 + hasard(i, 5) * 0.4 };
      });
    }
    const n = discret ? (type === 'pluie' ? 26 : 22) : type === 'pluie' ? 46 : 38;
    return Array.from({ length: n }, (_, i) => {
      const gauche = hasard(i, 1) * 100;
      const duree = type === 'pluie' ? 0.7 + hasard(i, 2) * 0.6 : 7 + hasard(i, 2) * 7;
      const delai = -hasard(i, 3) * duree;
      const taille = type === 'pluie' ? 12 + hasard(i, 4) * 16 : 2 + hasard(i, 4) * 3.5;
      const opacite = 0.25 + hasard(i, 5) * 0.45;
      return { gauche, haut: undefined as number | undefined, duree, delai, taille, opacite };
    });
  }, [type]);
  return (
    <div
      className={`ambiance ambiance-${type}${discret ? ' ambiance-discrete' : ''}${intensite <= 0 ? ' ambiance-calme' : ''}`}
      aria-hidden="true"
      style={attenuation > 0 || intensite < 1 ? { opacity: (discret ? 0.6 : 1) * (1 - attenuation) * intensite } : undefined}
    >
      {particules.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.gauche}%`,
            ...(p.haut !== undefined ? { top: `${p.haut}%` } : {}),
            animationDuration: `${p.duree}s`,
            animationDelay: `${p.delai}s`,
            opacity: p.opacite,
            ...(type === 'pluie'
              ? { height: p.taille }
              : type === 'brouillard'
                ? { width: `${p.taille}vw`, height: `${p.taille * 0.45}vh` }
                : { width: p.taille, height: p.taille }),
          }}
        />
      ))}
    </div>
  );
}

/** En partie : pluie ou neige par averses, au même rythme que le son (voir meteo.ts). */
export function AmbianceEnPartie({ type, attenuation }: { type: TypeAmbiance; attenuation: number }) {
  const intensite = useMeteo();
  return <Ambiance type={type} discret attenuation={attenuation} intensite={intensite} />;
}
