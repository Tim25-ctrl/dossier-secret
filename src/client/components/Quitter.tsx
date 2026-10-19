import { useState } from 'react';
import type { EtatClient } from '../../shared/protocole';
import { connexion } from '../connexion';
import { Modale } from './Commun';

/**
 * Bouton « Quitter » avec confirmation.
 * - Pendant une partie : confirmation systématique (on ne peut plus revenir).
 * - Dans le salon d'attente ou après la fin : confirmation seulement si l'on est
 *   le dernier joueur présent, car le salon sera alors fermé.
 */
export function BoutonQuitter({ etat, libelle, classe = 'btn btn-discret' }: { etat: EtatClient; libelle?: string; classe?: string }) {
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const enPartie = etat.salon.statut === 'partie';
  const dernier = !etat.salon.joueurs.some((j) => j.id !== etat.moi && !j.bot && !j.parti && j.connecte);
  const texte = libelle ?? (enPartie ? 'Quitter la partie' : 'Quitter le salon');

  const quitter = async () => {
    setEnvoi(true);
    await connexion.quitter();
    setEnvoi(false);
  };

  return (
    <>
      <button className={classe} onClick={() => (enPartie || dernier ? setConfirmation(true) : void quitter())}>
        {texte}
      </button>
      {confirmation && (
        <Modale
          titre={dernier ? 'Fermer le salon ?' : 'Quitter la partie ?'}
          onFermer={() => setConfirmation(false)}
          pied={
            <>
              <button className="btn btn-discret" onClick={() => setConfirmation(false)}>
                Annuler
              </button>
              <button className="btn btn-danger" disabled={envoi} onClick={() => void quitter()}>
                {dernier ? 'Quitter et fermer le salon' : 'Quitter la partie'}
              </button>
            </>
          }
        >
          {dernier ? (
            <p>
              Vous êtes <strong>le dernier joueur encore présent</strong>. Si vous quittez, le salon <strong>{etat.salon.code}</strong> sera fermé
              {enPartie ? ' et la partie en cours sera définitivement arrêtée' : ''}. Personne ne pourra plus le rejoindre.
            </p>
          ) : (
            <p>
              Vous ne pourrez plus revenir dans cette partie. Votre rôle et vos cartes restent en jeu : vos tours seront passés automatiquement et, si
              l'on vous interroge, une réponse honnête sera donnée à votre place.
            </p>
          )}
        </Modale>
      )}
    </>
  );
}
