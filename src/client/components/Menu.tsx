import { useEffect, useRef, useState } from 'react';
import type { EtatClient } from '../../shared/protocole';
import type { Preferences } from '../preferences';
import { ModaleParametres } from '../screens/Accueil';
import { ModaleRegles } from '../screens/Regles';
import { useQuitter } from './Quitter';

/**
 * Menu ☰ de la barre du haut (partie et salon d'attente) : règles, dossier de l'affaire,
 * paramètres, quitter. Les fenêtres ouvertes depuis le menu restent affichées après sa fermeture.
 */
export function MenuPrincipal({ etat, prefs, majPrefs }: { etat: EtatClient; prefs: Preferences; majPrefs: (p: Partial<Preferences>) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [fenetre, setFenetre] = useState<'regles' | 'dossier' | 'parametres' | null>(null);
  const quitter = useQuitter(etat);
  const zone = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);

  // Fermeture au clic à l'extérieur ou avec Échap (le focus revient sur le bouton ☰).
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!zone.current?.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOuvert(false);
        bouton.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dehors);
    document.addEventListener('keydown', echap);
    zone.current?.querySelector<HTMLButtonElement>('.menu-item')?.focus();
    return () => {
      document.removeEventListener('pointerdown', dehors);
      document.removeEventListener('keydown', echap);
    };
  }, [ouvert]);

  const choisir = (action: () => void) => () => {
    setOuvert(false);
    action();
  };

  return (
    <>
      <div className="menu-principal" ref={zone}>
        <button
          ref={bouton}
          type="button"
          className="btn btn-discret btn-petit menu-bouton"
          aria-haspopup="menu"
          aria-expanded={ouvert}
          aria-label="Menu"
          onClick={() => setOuvert(!ouvert)}
        >
          ☰
        </button>
        {ouvert && (
          <div className="menu-liste" role="menu">
            <button type="button" role="menuitem" className="menu-item" onClick={choisir(() => setFenetre('regles'))}>
              📖 Règles du jeu
            </button>
            <button type="button" role="menuitem" className="menu-item" onClick={choisir(() => setFenetre('dossier'))}>
              🗂️ Le dossier de l'affaire
            </button>
            <button type="button" role="menuitem" className="menu-item" onClick={choisir(() => setFenetre('parametres'))}>
              ⚙️ Paramètres
            </button>
            <button type="button" role="menuitem" className="menu-item menu-item-danger" onClick={choisir(quitter.demander)}>
              🚪 {quitter.libelle}
            </button>
          </div>
        )}
      </div>
      {(fenetre === 'regles' || fenetre === 'dossier') && <ModaleRegles section={fenetre} onFermer={() => setFenetre(null)} />}
      {fenetre === 'parametres' && <ModaleParametres prefs={prefs} majPrefs={majPrefs} onFermer={() => setFenetre(null)} />}
      {quitter.confirmation}
    </>
  );
}
