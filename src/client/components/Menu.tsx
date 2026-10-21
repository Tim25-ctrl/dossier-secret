import { useEffect, useRef, useState } from 'react';
import type { EtatClient } from '../../shared/protocole';
import { connexion } from '../connexion';
import type { Preferences } from '../preferences';
import { ModaleParametres } from '../screens/Accueil';
import { ModaleRegles } from '../screens/Regles';
import { Modale } from './Commun';
import { useQuitter } from './Quitter';

/**
 * Menu ☰ de la barre du haut (partie et salon d'attente) : règles, dossier de l'affaire,
 * paramètres, quitter. Les fenêtres ouvertes depuis le menu restent affichées après sa fermeture.
 */
export function MenuPrincipal({ etat, prefs, majPrefs }: { etat: EtatClient; prefs: Preferences; majPrefs: (p: Partial<Preferences>) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [fenetre, setFenetre] = useState<'regles' | 'dossier' | 'parametres' | 'sauvegarde' | null>(null);
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

  // Sauvegarde téléchargeable : partie en ligne seulement (la partie guidée tourne sur l'appareil).
  const sauvegardePossible = !connexion.instantane().tutoriel && etat.salon.statut === 'partie';

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
            {sauvegardePossible && (
              <button type="button" role="menuitem" className="menu-item" onClick={choisir(() => setFenetre('sauvegarde'))}>
                💾 Sauvegarder la partie
              </button>
            )}
            <button type="button" role="menuitem" className="menu-item menu-item-danger" onClick={choisir(quitter.demander)}>
              🚪 {quitter.libelle}
            </button>
          </div>
        )}
      </div>
      {(fenetre === 'regles' || fenetre === 'dossier') && <ModaleRegles section={fenetre} affaire={etat.partie?.affaire ?? etat.salon.reglages.affaire} onFermer={() => setFenetre(null)} />}
      {fenetre === 'parametres' && <ModaleParametres prefs={prefs} majPrefs={majPrefs} onFermer={() => setFenetre(null)} />}
      {fenetre === 'sauvegarde' && <ModaleSauvegarde onFermer={() => setFenetre(null)} />}
      {quitter.confirmation}
    </>
  );
}

/** Explique la sauvegarde automatique et propose d'en télécharger une copie. */
function ModaleSauvegarde({ onFermer }: { onFermer: () => void }) {
  const [fait, setFait] = useState<boolean | null>(null);
  const [, setTic] = useState(0);
  const prete = !!connexion.sauvegardeLocale();
  // La première sauvegarde arrive quelques secondes après le début de la partie.
  useEffect(() => {
    if (prete) return;
    const t = setInterval(() => setTic((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [prete]);
  return (
    <Modale
      titre="Sauvegarder la partie"
      onFermer={onFermer}
      pied={
        <>
          <button className="btn btn-discret" onClick={onFermer}>
            Fermer
          </button>
          <button className="btn btn-or" disabled={!prete} onClick={() => setFait(connexion.telechargerSauvegarde())}>
            💾 Télécharger la sauvegarde
          </button>
        </>
      }
    >
      <p>
        La partie est <strong>sauvegardée automatiquement sur votre appareil</strong>. Si le serveur redémarre, elle reprend toute seule dès qu'un joueur
        revient.
      </p>
      <p>
        Vous pouvez aussi en <strong>télécharger une copie</strong> : pour reprendre la partie un autre jour ou sur un autre appareil, touchez « Reprendre une
        sauvegarde » sur l'accueil et choisissez ce fichier.
      </p>
      <p className="petit muet">
        Le fichier est chiffré : personne ne peut y lire la solution. Ne le partagez pas, il donne accès à votre place dans la partie.
      </p>
      {!prete && <p className="petit">La première sauvegarde arrive dans quelques secondes…</p>}
      {fait === true && <p className="petit">✅ Fichier téléchargé.</p>}
      {fait === false && <p className="petit erreur">Téléchargement impossible pour le moment.</p>}
    </Modale>
  );
}
