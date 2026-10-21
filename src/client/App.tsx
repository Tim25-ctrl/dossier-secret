import { connexion, useConnexion } from './connexion';
import { usePreferences } from './preferences';
import { Accueil } from './screens/Accueil';
import { Fin } from './screens/Fin';
import { Jeu } from './screens/Jeu';
import { Lobby } from './screens/Lobby';
import { EcranDemandePlace, SalleReprise } from './screens/Reprise';
import { Sceau } from './components/Emblemes';
import { CONSEILS_DU_TUTORIEL } from './components/jeu/Conseils';
import { GuideTutoriel } from './tutoriel/Guide';

export function App() {
  const c = useConnexion();
  const [prefs, majPrefs] = usePreferences();

  // Sans connexion : en partie, on prévient ; à l'accueil, on rappelle que le solo marche hors ligne.
  const bandeau =
    c.statut === 'deconnecte' && !c.horsLigne ? (
      <div className="connexion-perdue" role="alert">
        {c.session
          ? 'Connexion au serveur perdue — reconnexion automatique en cours…'
          : 'Pas de connexion internet : vous pouvez jouer seul contre des bots, hors ligne.'}
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
    else if (etat.partie && etat.salon.reprise) ecran = <SalleReprise etat={etat} prefs={prefs} majPrefs={majPrefs} />;
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
  } else if (c.demandePlace) {
    ecran = <EcranDemandePlace demande={c.demandePlace} />;
  } else {
    ecran = <Accueil prefs={prefs} majPrefs={majPrefs} />;
  }

  return (
    <>
      {!c.tutoriel && bandeau}
      {ecran}
      {c.tutoriel && c.etat?.partie && (
        <GuideTutoriel
          onTermine={(role) =>
            majPrefs({
              tutorielVu: true,
              conseilsVus: [...new Set([...prefs.conseilsVus, ...CONSEILS_DU_TUTORIEL])],
              guidesTermines: [...new Set([...(prefs.guidesTermines ?? []), role])],
            })
          }
        />
      )}
    </>
  );
}
