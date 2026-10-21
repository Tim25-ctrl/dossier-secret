// Ambiance discrète derrière le titre de l'accueil : la pluie du Manoir des Brumes ou la neige
// du train de nuit. Purement décorative (masquée aux lecteurs d'écran), coupée par le réglage
// « Animations réduites » et par le réglage du système.

import { useMemo } from 'react';

export type TypeAmbiance = 'pluie' | 'neige';

/** Pseudo-hasard stable : les mêmes positions à chaque affichage, sans saut visuel. */
function hasard(i: number, graine: number): number {
  const x = Math.sin(i * 12.9898 + graine * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function Ambiance({ type }: { type: TypeAmbiance }) {
  const particules = useMemo(() => {
    const n = type === 'pluie' ? 46 : 38;
    return Array.from({ length: n }, (_, i) => {
      const gauche = hasard(i, 1) * 100;
      const duree = type === 'pluie' ? 0.7 + hasard(i, 2) * 0.6 : 7 + hasard(i, 2) * 7;
      const delai = -hasard(i, 3) * duree;
      const taille = type === 'pluie' ? 12 + hasard(i, 4) * 16 : 2 + hasard(i, 4) * 3.5;
      const opacite = 0.25 + hasard(i, 5) * 0.45;
      return { gauche, duree, delai, taille, opacite };
    });
  }, [type]);
  return (
    <div className={`ambiance ambiance-${type}`} aria-hidden="true">
      {particules.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.gauche}%`,
            animationDuration: `${p.duree}s`,
            animationDelay: `${p.delai}s`,
            opacity: p.opacite,
            ...(type === 'pluie' ? { height: p.taille } : { width: p.taille, height: p.taille }),
          }}
        />
      ))}
    </div>
  );
}
