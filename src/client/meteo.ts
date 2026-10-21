// Météo de la partie : la pluie (manoir) ou la neige (train) tombe par averses, puis s'arrête un
// moment. Le son et les gouttes (ou flocons) à l'écran suivent la même courbe, calculée depuis
// l'heure : tous les joueurs ont donc la même averse au même moment, sans rien échanger.
//
// Toutes les 4 minutes : une averse de 1 min 40 à 2 min 50 qui arrive et repart en douceur
// (20 s), puis un temps sec de 30 s à 3 min.

import { useEffect, useState } from 'react';

const CYCLE = 240_000;
const FONDU = 20;

function hasard(k: number, graine: number): number {
  const x = Math.sin(k * 12.9898 + graine * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Force de la pluie ou de la neige à cet instant : 0 (rien) à 1 (averse). */
export function intensiteMeteo(ms: number = Date.now()): number {
  const k = Math.floor(ms / CYCLE);
  const t = (ms - k * CYCLE) / 1000;
  const debut = hasard(k, 1) * 40;
  const duree = 100 + hasard(k, 2) * 70;
  const force = 0.7 + hasard(k, 3) * 0.3;
  if (t <= debut || t >= debut + duree) return 0;
  const x = Math.min(1, (t - debut) / FONDU, (debut + duree - t) / FONDU);
  return force * x * x * (3 - 2 * x);
}

/** La météo du moment, mise à jour chaque seconde. */
export function useMeteo(): number {
  const [i, setI] = useState(() => intensiteMeteo());
  useEffect(() => {
    const id = window.setInterval(() => setI(Math.round(intensiteMeteo() * 50) / 50), 1000);
    return () => clearInterval(id);
  }, []);
  return i;
}
