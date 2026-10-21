import { useState, type ReactNode } from 'react';
import type { EtatClient } from '../../shared/protocole';
import { connexion } from '../connexion';
import { Modale } from './Commun';

/**
 * Quitter avec confirmation.
 * - Pendant une partie : confirmation systématique (on ne peut plus revenir).
 * - Dans le salon d'attente ou après la fin : confirmation seulement si l'on est
 *   le dernier joueur présent, car le salon sera alors fermé.
 * Retourne l'action à déclencher et la fenêtre de confirmation à afficher (elle doit rester
 * montée même si le bouton qui l'a ouverte disparaît, par exemple un menu qui se referme).
 */
export function useQuitter(etat: EtatClient): { libelle: string; demander: () => void; confirmation: ReactNode } {
  const [ouverte, setOuverte] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const enPartie = etat.salon.statut === 'partie';
  const dernier = !etat.salon.joueurs.some((j) => j.id !== etat.moi && !j.bot && !j.parti && j.connecte);
  // Dernier joueur d'une partie qu'il peut enregistrer : on lui rappelle de le faire avant de partir.
  const rappelSauvegarde =
    enPartie && dernier && !connexion.instantane().tutoriel && connexion.instantane().comptes && (etat.salon.solo || etat.salon.hote === etat.moi);

  const quitter = async () => {
    setEnvoi(true);
    await connexion.quitter();
    setEnvoi(false);
  };

  const confirmation = ouverte ? (
    <Modale
      titre={dernier ? 'Fermer le salon ?' : 'Quitter la partie ?'}
      onFermer={() => setOuverte(false)}
      pied={
        <>
          <button className="btn btn-discret" onClick={() => setOuverte(false)}>
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
          {rappelSauvegarde && (
            <>
              <br />
              <br />
              Pour la reprendre plus tard, enregistrez-la d'abord : menu ☰ → <strong>« Sauvegarder la partie »</strong>.
            </>
          )}
        </p>
      ) : (
        <p>
          Vous ne pourrez plus revenir dans cette partie. Votre rôle et vos cartes restent en jeu : vos tours seront passés automatiquement et, si
          l'on vous interroge, une réponse honnête sera donnée à votre place.
        </p>
      )}
    </Modale>
  ) : null;

  return {
    libelle: connexion.instantane().tutoriel ? 'Quitter la partie guidée' : enPartie ? 'Quitter la partie' : 'Quitter le salon',
    // Partie guidée : rien à confirmer, on revient simplement à l'accueil.
    demander: () => (!connexion.instantane().tutoriel && (enPartie || dernier) ? setOuverte(true) : void quitter()),
    confirmation,
  };
}

/** Bouton « Quitter » avec confirmation (écran de fin). */
export function BoutonQuitter({ etat, libelle, classe = 'btn btn-discret' }: { etat: EtatClient; libelle?: string; classe?: string }) {
  const q = useQuitter(etat);
  return (
    <>
      <button className={classe} onClick={q.demander}>
        {libelle ?? q.libelle}
      </button>
      {q.confirmation}
    </>
  );
}
