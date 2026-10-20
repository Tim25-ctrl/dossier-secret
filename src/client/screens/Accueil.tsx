import { useState, type FormEvent } from 'react';
import { jouer } from '../sons';
import { AFFAIRE } from '../../shared/data/manoir';
import { PSEUDO_MAX } from '../../shared/protocole';
import { Modale } from '../components/Commun';
import { Icone, Sceau } from '../components/Emblemes';
import { connexion } from '../connexion';
import type { Preferences } from '../preferences';
import { ModaleRegles } from './Regles';
import { lancerPartieGuidee } from '../tutoriel/partieLocale';

type Mode = 'menu' | 'creer' | 'rejoindre';

export function Accueil({ prefs, majPrefs }: { prefs: Preferences; majPrefs: (p: Partial<Preferences>) => void }) {
  const codeUrl = new URLSearchParams(location.search).get('salon') ?? '';
  const [mode, setMode] = useState<Mode>(codeUrl ? 'rejoindre' : 'menu');
  const [pseudo, setPseudo] = useState(prefs.pseudo);
  const [code, setCode] = useState(codeUrl.toUpperCase());
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [regles, setRegles] = useState(false);
  const [parametres, setParametres] = useState(false);
  const [tutoriel, setTutoriel] = useState(!prefs.tutorielVu);
  const derniere = connexion.derniereSession();

  /** Ouvre un formulaire en reprenant le pseudo par défaut (il a pu changer dans les Paramètres). */
  const ouvrir = (m: Mode) => {
    setMode(m);
    setPseudo(prefs.pseudo);
  };

  const valider = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (!pseudo.trim()) return setErreur('Choisissez un pseudonyme.');
    if (mode === 'rejoindre' && code.replace(/\s/g, '').length !== 6) return setErreur("Le code d'invitation comporte 6 caractères.");
    setEnvoi(true);
    majPrefs({ pseudo: pseudo.trim() });
    const r = mode === 'creer' ? await connexion.creer(pseudo) : await connexion.rejoindre(code, pseudo);
    setEnvoi(false);
    if (!r.ok) setErreur(r.erreur);
    else if (codeUrl) history.replaceState(null, '', location.pathname);
  };

  return (
    <main className="accueil">
      <div className="logo">
        <Sceau taille={104} />
        <h1>Dossier Secret</h1>
        <div className="sous-titre">{AFFAIRE.titre}</div>
      </div>

      {mode === 'menu' && (
        <>
          <p style={{ maxWidth: 560, color: 'var(--ivoire-doux)' }}>
            Un collectionneur assassiné, six suspects, un manoir coupé du monde par la tempête. Menez l'enquête entre amis… mais méfiez-vous : l'un de vous protège
            le meurtrier.
          </p>
          <p className="muet petit">3 à 6 joueurs · 15 à 30 minutes · navigateur, tablette ou smartphone</p>
          <div className="accueil-actions" style={{ marginTop: 10 }}>
            {derniere && (
              <button className="btn btn-or" onClick={() => void connexion.reprendre(derniere)}>
                Reprendre ma partie ({derniere.code})
              </button>
            )}
            <button className={`btn ${derniere ? '' : 'btn-or'}`} onClick={() => ouvrir('creer')}>
              Créer une partie
            </button>
            <button className="btn" onClick={() => ouvrir('rejoindre')}>
              Rejoindre une partie
            </button>
            <button className="btn" onClick={() => {
                majPrefs({ tutorielVu: true });
                lancerPartieGuidee(prefs.pseudo.trim());
              }}>
              🎓 Apprendre à jouer (partie guidée)
            </button>
            <div className="ligne" style={{ justifyContent: 'center' }}>
              <button className="btn btn-discret" onClick={() => setRegles(true)}>
                <Icone nom="livre" /> Règles du jeu
              </button>
              <button className="btn btn-discret" onClick={() => setParametres(true)}>
                <Icone nom="reglages" /> Paramètres
              </button>
            </div>
          </div>
        </>
      )}

      {mode !== 'menu' && (
        <form className="panneau accueil-carte" onSubmit={valider} noValidate>
          <h2>{mode === 'creer' ? 'Créer une partie' : 'Rejoindre une partie'}</h2>
          {mode === 'rejoindre' && (
            <div className="champ">
              <label htmlFor="code">Code d'invitation</label>
              <input
                id="code"
                className="code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="ABC123"
                autoComplete="off"
                autoCapitalize="characters"
                inputMode="text"
                autoFocus={!codeUrl}
              />
            </div>
          )}
          <div className="champ">
            <label htmlFor="pseudo">Votre pseudonyme</label>
            <input
              id="pseudo"
              value={pseudo}
              maxLength={PSEUDO_MAX}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder="Inspecteur Martin"
              autoComplete="nickname"
              autoFocus={mode === 'creer' || !!codeUrl}
            />
          </div>
          {erreur && (
            <div className="erreur" role="alert">
              {erreur}
            </div>
          )}
          <div className="ligne" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-discret" onClick={() => (setMode('menu'), setErreur(null))}>
              Retour
            </button>
            <span className="espace" />
            <button type="submit" className="btn btn-or" disabled={envoi}>
              {envoi ? 'Connexion…' : mode === 'creer' ? 'Créer le salon' : 'Rejoindre'}
            </button>
          </div>
        </form>
      )}

      <div className="pied">Jeu de fiction. Toute ressemblance avec des personnes existantes serait fortuite.</div>

      {regles && <ModaleRegles onFermer={() => setRegles(false)} />}
      {parametres && <ModaleParametres prefs={prefs} majPrefs={majPrefs} onFermer={() => setParametres(false)} />}
      {tutoriel && (
        <Modale
          titre="Première visite ?"
          onFermer={() => {
            setTutoriel(false);
            majPrefs({ tutorielVu: true });
          }}
          pied={
            <>
              <button
                className="btn btn-discret"
                onClick={() => {
                  setTutoriel(false);
                  majPrefs({ tutorielVu: true });
                }}
              >
                Plus tard
              </button>
              <button className="btn btn-or" onClick={() => {
                majPrefs({ tutorielVu: true });
                lancerPartieGuidee(prefs.pseudo.trim());
              }}>
                Lancer la partie guidée
              </button>
            </>
          }
        >
          <p>
            Apprenez à jouer en <strong>5 minutes</strong>, avec une vraie partie contre deux bots. Un guide vous montre où cliquer et explique chaque étape :
            hypothèse, cartes montrées, carnet, archives, complice, accusation.
          </p>
          <p className="muet petit" style={{ marginBottom: 0 }}>
            Vous la retrouverez à tout moment avec le bouton « Apprendre à jouer » de l'accueil.
          </p>
        </Modale>
      )}
    </main>
  );
}

export function ModaleParametres({ prefs, majPrefs, onFermer }: { prefs: Preferences; majPrefs: (p: Partial<Preferences>) => void; onFermer: () => void }) {
  return (
    <Modale titre="Paramètres" onFermer={onFermer} pied={<button className="btn btn-or" onClick={onFermer}>Fermer</button>}>
      <div className="champ">
        <label htmlFor="taille">Taille du texte</label>
        <select id="taille" value={prefs.taille} onChange={(e) => majPrefs({ taille: e.target.value as Preferences['taille'] })}>
          <option value="normal">Normale</option>
          <option value="grand">Grande</option>
        </select>
      </div>
      <div className="champ">
        <label htmlFor="animations">Animations</label>
        <select id="animations" value={prefs.animations} onChange={(e) => majPrefs({ animations: e.target.value as Preferences['animations'] })}>
          <option value="normales">Normales</option>
          <option value="reduites">Réduites</option>
        </select>
      </div>
      <div className="champ">
        <label htmlFor="son">Sons</label>
        <select id="son" value={prefs.son ? 'oui' : 'non'} onChange={(e) => majPrefs({ son: e.target.value === 'oui' })}>
          <option value="oui">Activés</option>
          <option value="non">Coupés</option>
        </select>
      </div>
      {prefs.son && (
        <div className="champ">
          <label htmlFor="volume">Volume : {Math.round(prefs.volume * 100)} %</label>
          <input
            id="volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={prefs.volume}
            onChange={(e) => majPrefs({ volume: Number(e.target.value) })}
            onPointerUp={() => jouer('tour')}
            onKeyUp={() => jouer('tour')}
          />
        </div>
      )}
      <div className="champ">
        <label htmlFor="pseudo-defaut">Pseudonyme par défaut</label>
        <input id="pseudo-defaut" value={prefs.pseudo} maxLength={PSEUDO_MAX} onChange={(e) => majPrefs({ pseudo: e.target.value })} />
      </div>
      <div className="champ">
        <label htmlFor="conseils">Conseils en partie</label>
        <select id="conseils" value={prefs.conseils ? 'oui' : 'non'} onChange={(e) => majPrefs({ conseils: e.target.value === 'oui' })}>
          <option value="oui">Affichés</option>
          <option value="non">Masqués</option>
        </select>
      </div>
      {prefs.conseils && prefs.conseilsVus.length > 0 && (
        <button className="btn btn-discret btn-petit" onClick={() => majPrefs({ conseilsVus: [] })}>
          Réafficher tous les conseils déjà lus
        </button>
      )}
    </Modale>
  );
}

