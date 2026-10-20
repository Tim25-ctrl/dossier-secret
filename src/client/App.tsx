import { connexion, useConnexion } from './connexion';
import { usePreferences } from './preferences';
import { Accueil } from './screens/Accueil';
import { Fin } from './screens/Fin';
import { Jeu } from './screens/Jeu';
import { Lobby } from './screens/Lobby';
import { Sceau } from './components/Emblemes';

export function App() {
  const c = useConnexion();
  const [prefs, majPrefs] = usePreferences();

  const bandeau =
    c.statut === 'deconnecte' ? (
      <div className="connexion-perdue" role="alert">
        Connexion au serveur perdue — reconnexion automatique en cours…
      </div>
    ) : null;

  if (c.expulsion) {
    return (
      <main className="accueil">
        <Sceau taille={80} />
        <h2>Session interrompue</h2>
        <p style={{ maxWidth: 480 }}>{c.expulsion}</p>
        <div className="accueil-actions">
          {c.session && (
            <button className="btn btn-or" onClick={() => void connexion.reprendre(c.session!)}>
              Reprendre la partie dans cet onglet
            </button>
          )}
          <button className="btn" onClick={() => connexion.fermerSessionLocale()}>
            Retour à l'accueil
          </button>
        </div>
      </main>
    );
  }

  let ecran;
  if (c.session && c.etat) {
    const { etat } = c;
    if (etat.partie && etat.partie.etape === 'terminee') ecran = <Fin etat={etat} />;
    else if (etat.partie) ecran = <Jeu etat={etat} decalage={c.decalage} prefs={prefs} majPrefs={majPrefs} />;
    else ecran = <Lobby etat={etat} prefs={prefs} majPrefs={majPrefs} />;
  } else if (c.session && (c.reprise || c.statut !== 'connecte')) {
    ecran = (
      <main className="accueil">
        <Sceau taille={80} />
        <p>Reconnexion au salon {c.session.code}…</p>
        <button className="btn btn-discret" onClick={() => connexion.fermerSessionLocale()}>
          Annuler
        </button>
      </main>
    );
  } else {
    ecran = <Accueil prefs={prefs} majPrefs={majPrefs} />;
  }

  return (
    <>
      {bandeau}
      {ecran}
    </>
  );
}
