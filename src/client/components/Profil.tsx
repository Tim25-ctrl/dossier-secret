import { useState } from 'react';
import { effacerProfil, grade, lireProfil, SUCCES, type Profil } from '../profil';
import { Modale } from './Commun';
import { InvitationCompte, ModaleCompte } from './Compte';
import { useConnexion } from '../connexion';

const pourcent = (v: number, n: number) => (n ? `${Math.round((v / n) * 100)} %` : '—');

/** Grade actuel et progression vers le suivant. */
export function Grade({ profil }: { profil: Profil }) {
  const { actuel, suivant } = grade(profil.victoires);
  const debut = actuel.victoires;
  const progression = suivant ? (profil.victoires - debut) / (suivant.victoires - debut) : 1;
  return (
    <div className="grade">
      <div className="grade-titre">🏅 {actuel.titre}</div>
      <div className="grade-barre" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progression * 100)}>
        <span style={{ width: `${Math.round(progression * 100)}%` }} />
      </div>
      <div className="petit muet">
        {suivant
          ? `Encore ${suivant.victoires - profil.victoires} victoire${suivant.victoires - profil.victoires > 1 ? 's' : ''} pour devenir ${suivant.titre}.`
          : 'Grade le plus élevé atteint.'}
      </div>
    </div>
  );
}

export function ModaleProfil({
  onFermer,
  onGuide,
  pseudo,
}: {
  onFermer: () => void;
  onGuide?: () => void;
  /** Pseudonyme proposé si le joueur crée un compte depuis cette fenêtre. */
  pseudo?: string;
}) {
  const { comptes, compte } = useConnexion();
  const [gerer, setGerer] = useState(false);
  // Relu à chaque affichage : il change avec la connexion au compte et après une remise à zéro.
  const [, setTic] = useState(0);
  const profil = lireProfil();
  const [confirmer, setConfirmer] = useState(false);
  const debloques = SUCCES.filter((s) => profil.succes[s.id]).length;
  return (
    <Modale titre="Mon profil" onFermer={onFermer} pied={<button className="btn btn-or" onClick={onFermer}>Fermer</button>}>
      {comptes && compte && (
        <p className="ligne compte-profil">
          <span>
            Compte : <strong>{compte.nom}</strong>
          </span>
          <button className="btn btn-petit btn-discret" onClick={() => setGerer(true)}>
            Gérer mon compte
          </button>
        </p>
      )}
      {comptes && !compte && (
        <InvitationCompte
          texte={
            <>
              Sans compte, ce profil reste sur cet appareil et vos parties ne peuvent pas être sauvegardées. Avec un compte, vos sauvegardes, votre grade et
              vos succès vous suivent partout.
            </>
          }
          pseudo={pseudo}
        />
      )}
      {gerer && <ModaleCompte onFermer={() => setGerer(false)} />}
      <Grade profil={profil} />
      <div className="stats-profil">
        <div>
          <strong>{profil.parties}</strong>
          <span>parties</span>
        </div>
        <div>
          <strong>{profil.victoires}</strong>
          <span>victoires ({pourcent(profil.victoires, profil.parties)})</span>
        </div>
        <div>
          <strong>
            {profil.enqueteur.victoires} / {profil.enqueteur.parties}
          </strong>
          <span>en enquêteur</span>
        </div>
        <div>
          <strong>
            {profil.complice.victoires} / {profil.complice.parties}
          </strong>
          <span>en complice</span>
        </div>
        <div>
          <strong>{profil.meilleureSerie}</strong>
          <span>meilleure série</span>
        </div>
      </div>
      {onGuide && (
        <p style={{ margin: '12px 0 0' }}>
          <button className="btn btn-petit" onClick={onGuide}>
            🎓 Refaire une partie guidée
          </button>
        </p>
      )}
      <h4 style={{ margin: '16px 0 8px' }}>
        Succès ({debloques} / {SUCCES.length})
      </h4>
      <ul className="liste-succes">
        {SUCCES.map((s) => (
          <li key={s.id} className={profil.succes[s.id] ? 'obtenu' : 'verrouille'}>
            <span className="icone-succes" aria-hidden="true">
              {profil.succes[s.id] ? s.icone : '🔒'}
            </span>
            <span>
              <strong>{s.titre}</strong>
              <span className="petit muet">{s.description}</span>
            </span>
            <span className="sr-only">{profil.succes[s.id] ? 'obtenu' : 'pas encore obtenu'}</span>
          </li>
        ))}
      </ul>
      <p className="petit muet">
        {compte ? 'Votre profil est gardé dans votre compte.' : 'Votre profil est gardé sur cet appareil uniquement.'} Les parties guidées ne comptent
        pas.{' '}
        {profil.parties > 0 &&
          (confirmer ? (
            <>
              Tout effacer ?{' '}
              <button
                className="btn btn-discret btn-petit"
                onClick={() => {
                  effacerProfil();
                  setTic((x) => x + 1);
                  setConfirmer(false);
                }}
              >
                Oui, effacer
              </button>{' '}
              <button className="btn btn-discret btn-petit" onClick={() => setConfirmer(false)}>
                Non
              </button>
            </>
          ) : (
            <button className="btn btn-discret btn-petit" onClick={() => setConfirmer(true)}>
              Remettre à zéro
            </button>
          ))}
      </p>
    </Modale>
  );
}
