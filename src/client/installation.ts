// Installation du jeu sur l'écran d'accueil (application web installable).
// - Android / ordinateur (Chrome, Edge…) : le navigateur propose l'installation ; on garde son
//   invitation pour l'afficher au moment où le joueur touche « Installer le jeu ».
// - iPhone / iPad : pas d'invitation possible, on explique la marche à suivre dans Safari.

import { useSyncExternalStore } from 'react';

interface InvitationInstallation extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let invitation: InvitationInstallation | null = null;
let installe = false;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // pas de bandeau automatique : le bouton de l'accueil s'en charge
    invitation = e as InvitationInstallation;
    prevenir();
  });
  window.addEventListener('appinstalled', () => {
    invitation = null;
    installe = true;
    prevenir();
  });
  if ('serviceWorker' in navigator && import.meta.env.PROD) void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

/** Le jeu tourne-t-il déjà comme une application installée ? */
const enApplication = () =>
  installe || window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const surIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export type EtatInstallation = 'invitation' | 'ios' | 'indisponible';

function etat(): EtatInstallation {
  if (typeof window === 'undefined' || enApplication()) return 'indisponible';
  if (invitation) return 'invitation';
  return surIos() ? 'ios' : 'indisponible';
}

export function useInstallation(): EtatInstallation {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    etat,
  );
}

/** Affiche l'invitation d'installation du navigateur. */
export async function installer(): Promise<boolean> {
  const i = invitation;
  if (!i) return false;
  await i.prompt();
  const { outcome } = await i.userChoice;
  invitation = null;
  prevenir();
  return outcome === 'accepted';
}
