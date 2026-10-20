import { useEffect, useState } from 'react';
import type { MessageChat } from '../../../shared/protocole';
import type { VueJoueur } from '../../../shared/types';
import { Chat } from '../Chat';
import { Modale } from '../Commun';
import { connexion } from '../../connexion';
import type { Noms } from './Textes';

/** Délai avant d'ouvrir la fenêtre : une page rechargée ne doit pas la faire clignoter chez les autres. */
export const GRACE_PAUSE_MS = 3_000;

/** Heure du serveur, rafraîchie chaque seconde tant que `actif` est vrai. */
export function useHeureServeur(decalage: number, actif: boolean): number {
  const [, setTic] = useState(0);
  useEffect(() => {
    if (!actif) return;
    const t = setInterval(() => setTic((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [actif]);
  return Date.now() + decalage;
}

export function dureeLisible(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}` : `${s} s`;
}

/**
 * Fenêtre « Partie en pause » : un joueur est déconnecté ou a quitté la partie.
 * Chacun peut attendre son retour (fermer la fenêtre) ou le remplacer par un bot.
 * La discussion reste accessible dans la fenêtre.
 */
export function ModalePause({
  pause,
  nom,
  maintenant,
  botsAutorises,
  messages,
  moi,
  onAttendre,
  onErreur,
}: {
  pause: NonNullable<VueJoueur['pause']>;
  nom: Noms;
  maintenant: number;
  botsAutorises: boolean;
  messages: MessageChat[];
  moi: string;
  onAttendre: () => void;
  onErreur: (e: string) => void;
}) {
  const [envoi, setEnvoi] = useState(false);
  const agir = async (fn: () => Promise<{ ok: boolean; erreur?: string }>) => {
    setEnvoi(true);
    const r = await fn();
    setEnvoi(false);
    if (!r.ok) onErreur(r.erreur ?? 'Action refusée.');
  };
  return (
    <Modale
      titre="⏸ Partie en pause"
      onFermer={onAttendre}
      pied={
        <button className="btn" onClick={onAttendre}>
          Attendre son retour
        </button>
      }
    >
      <ul className="liste-absents">
        {pause.absents.map((a) => (
          <li key={a.id}>
            <p style={{ margin: '0 0 8px' }}>
              <strong>{nom(a.id)}</strong> {a.parti ? 'a quitté la partie.' : "n'est plus connecté."}
            </p>
            <div className="ligne">
              {botsAutorises ? (
                <button className="btn btn-or btn-petit" disabled={envoi} onClick={() => void agir(() => connexion.remplacerParBot(a.id))}>
                  Remplacer par un bot
                </button>
              ) : (
                <button className="btn btn-petit" disabled={envoi} onClick={() => void agir(() => connexion.continuerSans(a.id))}>
                  Continuer sans {nom(a.id)}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="petit muet">
        La partie attend depuis {dureeLisible(maintenant - pause.depuis)} : personne ne perd de temps.{' '}
        {botsAutorises
          ? 'Un bot peut jouer à sa place avec ses cartes, sans rien révéler ; en cas de retour, le joueur reprend sa place.'
          : 'En continuant sans ce joueur, ses tours et ses réponses passeront automatiquement.'}
      </p>
      <h4 style={{ marginBottom: 6 }}>Discussion</h4>
      <Chat messages={messages} moi={moi} onErreur={onErreur} />
    </Modale>
  );
}
