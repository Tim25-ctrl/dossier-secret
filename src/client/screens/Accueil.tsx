import { useState, type FormEvent } from 'react';
import { jouer } from '../sons';
import { AFFAIRE } from '../../shared/data/manoir';
import { PSEUDO_MAX } from '../../shared/protocole';
import { Modale } from '../components/Commun';
import { Icone, Sceau } from '../components/Emblemes';
import { connexion } from '../connexion';
import type { Preferences } from '../preferences';
import { ModaleRegles } from './Regles';

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
        <Tutoriel
          onFermer={() => {
            setTutoriel(false);
            majPrefs({ tutorielVu: true });
          }}
        />
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
      <button className="btn btn-discret btn-petit" onClick={() => majPrefs({ tutorielVu: false })}>
        Revoir le tutoriel au prochain passage sur l'accueil
      </button>
    </Modale>
  );
}

const ETAPES_TUTORIEL = [
  {
    titre: 'Bienvenue au Manoir des Brumes',
    texte: "Armand de Valombre a été assassiné. Votre mission : découvrir qui l'a tué, où, et avec quelle arme. Une seule combinaison parmi 216 est la bonne.",
  },
  {
    titre: 'Vos cartes sont innocentes',
    texte: 'Chaque carte que vous recevez ne fait pas partie de la solution. Interrogez les autres joueurs pour découvrir les leurs et éliminer des pistes.',
  },
  {
    titre: 'Un complice parmi vous',
    texte: "L'un des joueurs connaît le meurtrier. Il peut mentir deux fois et falsifier une hypothèse. Soyez attentifs aux réponses étranges.",
  },
  {
    titre: 'Prenez des notes',
    texte: "Votre carnet de déduction est privé. Cochez ce que vous écartez, puis accusez quand vous êtes sûr : une seule accusation par joueur !",
  },
];

function Tutoriel({ onFermer }: { onFermer: () => void }) {
  const [i, setI] = useState(0);
  const e = ETAPES_TUTORIEL[i];
  const dernier = i === ETAPES_TUTORIEL.length - 1;
  return (
    <Modale
      titre={e.titre}
      onFermer={onFermer}
      pied={
        <>
          <span className="muet petit" style={{ marginRight: 'auto', alignSelf: 'center' }}>
            {i + 1} / {ETAPES_TUTORIEL.length}
          </span>
          <button className="btn btn-discret" onClick={onFermer}>
            Passer
          </button>
          <button className="btn btn-or" onClick={() => (dernier ? onFermer() : setI(i + 1))}>
            {dernier ? "Commencer l'enquête" : 'Suivant'}
          </button>
        </>
      }
    >
      <p style={{ fontSize: '1.1em' }}>{e.texte}</p>
    </Modale>
  );
}
