import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { arreterAmbiance, demarrerAmbiance } from '../ambianceSonore';
import { AFFAIRES, nomChoixAffaire } from '../../shared/data/catalogue';
import { AFFAIRES_IDS, AFFAIRE_PAR_DEFAUT, CHOIX_AFFAIRES, elementsDe, type AffaireId, type ChoixAffaire, type ModeJeu } from '../../shared/types';
import { grade, lireProfil } from '../profil';
import { DUREES_TOUR, PSEUDO_MAX } from '../../shared/protocole';
import { ModaleProfil } from '../components/Profil';
import { ModaleParametres } from '../components/Parametres';
import { ModaleCompte } from '../components/Compte';
import { libelleDuree } from './Lobby';
import { Modale } from '../components/Commun';
import { Embleme, Icone, Sceau } from '../components/Emblemes';
import { connexion, lireResume, useConnexion, type ResumePartie } from '../connexion';
import { depuis, ModaleCharger } from '../components/Emplacements';
import type { TypePartie } from '../../shared/protocole';
import { installer, useInstallation } from '../installation';
import type { Preferences } from '../preferences';
import { ModaleRegles } from './Regles';
import { lancerPartieGuidee, type RoleGuide } from '../tutoriel/partieLocale';
import { lancerPartieHorsLigne, partieHorsLigneEnCours, reprendrePartieHorsLigne } from '../horsLigne';

/**
 * Étoiles filantes : toutes les 10 à 20 s, une tête lumineuse traverse vite le haut du ciel en
 * laissant une traînée qui s'efface, chaque fois à un endroit et un angle différents. Une fois sur
 * quatre environ, c'est une petite pluie : 3 à 5 étoiles filantes presque parallèles, l'une après l'autre.
 */
interface Filante {
  id: number;
  haut: number;
  gauche: number;
  angle: number;
  delai: number;
}

function EtoilesFilantes() {
  const [filantes, setFilantes] = useState<Filante[]>([]);
  useEffect(() => {
    let id = 0;
    const minuteurs = new Set<ReturnType<typeof setTimeout>>();
    const plusTard = (ms: number, fn: () => void) => {
      const m = setTimeout(() => {
        minuteurs.delete(m);
        fn();
      }, ms);
      minuteurs.add(m);
    };
    const lancer = () => {
      const versLaGauche = Math.random() < 0.5;
      const haut = 3 + Math.random() * 14;
      const gauche = versLaGauche ? 72 + Math.random() * 24 : 4 + Math.random() * 24;
      const angle = versLaGauche ? 150 + Math.random() * 20 : 10 + Math.random() * 20;
      const pluie = Math.random() < 0.25;
      const nb = pluie ? 3 + Math.floor(Math.random() * 3) : 1;
      // Une pluie : même direction, départs un peu décalés, l'une après l'autre.
      const nouvelles = Array.from({ length: nb }, (_, k) => ({
        id: ++id,
        haut: haut + (k ? (Math.random() - 0.3) * 14 : 0),
        gauche: gauche + (k ? (Math.random() - 0.5) * 16 : 0),
        angle: angle + (k ? (Math.random() - 0.5) * 6 : 0),
        delai: k * (0.18 + Math.random() * 0.35),
      }));
      setFilantes((f) => [...f, ...nouvelles]);
      const ids = new Set(nouvelles.map((n) => n.id));
      plusTard(2500 + nb * 600, () => setFilantes((f) => f.filter((x) => !ids.has(x.id))));
      plusTard(10_000 + Math.random() * 10_000, lancer);
    };
    plusTard(4_000 + Math.random() * 4_000, lancer);
    return () => minuteurs.forEach(clearTimeout);
  }, []);
  return (
    <>
      {filantes.map((p) => (
        <span key={p.id} className="filante" style={{ top: `${p.haut}%`, left: `${p.gauche}%`, transform: `rotate(${p.angle}deg)` }}>
          <span className="filante-corps" style={{ animationDelay: `${p.delai}s` }} />
        </span>
      ))}
    </>
  );
}

/** Ciel de nuit derrière le logo de l'accueil : étoiles fixes, quelques-unes scintillent. */
function CielEtoile() {
  const etoiles = Array.from({ length: 46 }, (_, i) => {
    const h = (k: number) => {
      const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    return { x: h(1) * 100, y: Math.pow(h(2), 1.4) * 100, r: 0.5 + h(3) * 1.2, o: 0.35 + h(4) * 0.55, scintille: h(5) < 0.3, delai: h(6) * 6 };
  });
  // Quelques grandes étoiles à quatre branches, qui scintillent l'une après l'autre.
  const etincelles = [
    [12, 18, 0],
    [86, 12, 1.3],
    [24, 58, 2.6],
    [74, 46, 3.9],
    [93, 70, 5.1],
    [6, 80, 6.4],
  ];
  return (
    <div className="ciel" aria-hidden="true">
      <svg className="ciel-etoile">
        {etoiles.map((e, i) => (
          <circle
            key={i}
            cx={`${e.x}%`}
            cy={`${e.y}%`}
            r={e.r}
            fill="#fff6dc"
            opacity={e.o}
            className={e.scintille ? 'scintille' : undefined}
            style={e.scintille ? { animationDelay: `${e.delai}s` } : undefined}
          />
        ))}
      </svg>
      {etincelles.map(([x, y, d], i) => (
        <span key={i} className="etincelle" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />
      ))}
      <EtoilesFilantes />
    </div>
  );
}

type Mode = 'menu' | 'creer' | 'rejoindre';

/** Ligne de la carte « Partie en cours » : histoire, manche, joueurs, dernière activité. */
function texteResume(r: ResumePartie | null, code: string): string {
  if (!r || r.code !== code) return `Salon ${code}`;
  const etape = r.statut === 'lobby' ? "Salon d'attente" : `Manche ${r.manche} / ${r.manchesMax}`;
  return `${nomChoixAffaire(r.affaire)} · ${etape} · ${r.joueurs} joueurs · ${depuis(r.t)}`;
}

export function Accueil({ prefs, majPrefs }: { prefs: Preferences; majPrefs: (p: Partial<Preferences>) => void }) {
  // Thème de Nuit Blanche à l'accueil et dans le salon d'attente (il démarre au premier geste).
  useEffect(() => {
    demarrerAmbiance('menu');
    return () => arreterAmbiance('menu');
  }, []);
  const codeUrl = new URLSearchParams(location.search).get('salon') ?? '';
  const [mode, setMode] = useState<Mode>(codeUrl ? 'rejoindre' : 'menu');
  const [pseudo, setPseudo] = useState(prefs.pseudo);
  const [code, setCode] = useState(codeUrl.toUpperCase());
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // Règles : false (fermées), true (choix de l'histoire dans la fenêtre) ou une histoire précise.
  const [regles, setRegles] = useState<boolean | AffaireId>(false);
  // Cartes « Multijoueur » et « Seul contre des bots » : une seule ouverte à la fois.
  const [ouverte, setOuverte] = useState<'multi' | 'solo' | null>(null);
  const basculer = (c: 'multi' | 'solo') => setOuverte((o) => (o === c ? null : c));
  // Relu à chaque affichage : il change quand on se connecte à un compte.
  const profilLocal = lireProfil();
  const gradeActuel = grade(profilLocal.victoires).actuel;
  const resume = lireResume();
  const [parametres, setParametres] = useState(false);
  const [tutoriel, setTutoriel] = useState(!prefs.tutorielVu);
  const [choixGuide, setChoixGuide] = useState(false);
  // Les deux parties guidées terminées : le bouton quitte l'accueil (elles restent dans Paramètres et Profil).
  const guidesTermines = prefs.guidesTermines ?? [];
  const guidesFinis = guidesTermines.includes('enqueteur') && guidesTermines.includes('complice');
  const revoirGuide = () => {
    setParametres(false);
    setProfil(false);
    setChoixGuide(true);
  };
  const [profil, setProfil] = useState(false);
  // Emplacements de sauvegarde (si le serveur les propose) : fenêtre « Charger une partie ».
  const { comptes, compte } = useConnexion();
  const [charger, setCharger] = useState<TypePartie | null>(null);
  const [fenetreCompte, setFenetreCompte] = useState(false);
  /** Après une connexion : le nom du compte devient le pseudonyme par défaut s'il n'y en avait pas. */
  const surConnexion = (nom: string) => {
    if (!prefs.pseudo.trim()) majPrefs({ pseudo: nom });
  };
  const installation = useInstallation();
  const [aideIos, setAideIos] = useState(false);
  // Reprise depuis un fichier de sauvegarde téléchargé pendant une partie.
  const fichier = useRef<HTMLInputElement>(null);
  const [erreurFichier, setErreurFichier] = useState<string | null>(null);
  const [lecture, setLecture] = useState(false);
  const lireFichier = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErreurFichier(null);
    if (f.size > 4_000_000) return setErreurFichier("Ce fichier n'est pas une sauvegarde de Nuit Blanche.");
    setLecture(true);
    const r = await connexion.reprendreFichier(await f.text());
    setLecture(false);
    if (!r.ok) setErreurFichier(r.erreur);
  };
  const guider = (role: RoleGuide) => {
    majPrefs({ tutorielVu: true });
    lancerPartieGuidee((compte?.nom ?? prefs.pseudo).trim(), role);
  };
  const derniere = connexion.derniereSession();
  const horsLigne = partieHorsLigneEnCours();

  /** Ouvre un formulaire en reprenant le pseudo par défaut (il a pu changer dans les Paramètres). */
  const ouvrir = (m: Mode) => {
    setMode(m);
    setPseudo(prefs.pseudo);
  };

  const valider = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(null);
    // Connecté : on joue toujours sous le nom du compte.
    const nom = compte?.nom ?? pseudo;
    if (!nom.trim()) return setErreur('Choisissez un pseudonyme.');
    if (mode === 'rejoindre' && code.replace(/\s/g, '').length !== 6) return setErreur("Le code d'invitation comporte 6 caractères.");
    setEnvoi(true);
    if (!compte) majPrefs({ pseudo: pseudo.trim() });
    const r = mode === 'creer' ? await connexion.creer(nom) : await connexion.rejoindre(code, nom);
    setEnvoi(false);
    if (!r.ok) setErreur(r.erreur);
    else if (codeUrl) history.replaceState(null, '', location.pathname);
  };

  return (
    <main className="accueil">
      {mode === 'menu' && (
        <div className="accueil-haut">
          <button className="puce-profil" onClick={() => setProfil(true)} aria-label={`Mon profil : ${gradeActuel.titre}`}>
            <span className="puce-profil-icone">
              <Icone nom="insigne" taille={22} />
            </span>
            <span className="puce-profil-texte">
              <strong>{compte?.nom ?? (prefs.pseudo.trim() || 'Mon profil')}</strong>
              <span>
                {gradeActuel.titre} · {profilLocal.victoires} victoire{profilLocal.victoires > 1 ? 's' : ''}
              </span>
            </span>
          </button>
          <span className="espace" />
          {comptes && !compte && (
            <button className="bouton-icone bouton-connexion" onClick={() => setFenetreCompte(true)} aria-label="Se connecter ou créer un compte" title="Se connecter">
              <Icone nom="joueur" taille={22} />
              <span className="libelle-large">Se connecter</span>
            </button>
          )}
          <button className="bouton-icone" onClick={() => setRegles(true)} aria-label="Règles du jeu" title="Règles du jeu">
            <Icone nom="livre" taille={22} />
          </button>
          <button className="bouton-icone" onClick={() => setParametres(true)} aria-label="Paramètres" title="Paramètres">
            <Icone nom="reglages" taille={22} />
          </button>
        </div>
      )}
      {/* Ciel de nuit étoilé, derrière le logo */}
      <CielEtoile />
      <div className="logo">
        <Sceau taille={mode === 'menu' ? 132 : 96} />
        <h1>Nuit Blanche</h1>
        <div className="sous-titre">Une nuit pour démasquer le coupable</div>
      </div>

      {mode === 'menu' && (
        <div className="accueil-actions menu-nuit">
          {derniere && (
            <section className="carte-mode carte-en-cours" aria-label="Partie en cours">
              <div className="carte-mode-entete">
                <span className="carte-mode-icone">
                  <Icone nom="dossier" taille={30} />
                </span>
                <div>
                  <h2>Partie en cours</h2>
                  <p>{texteResume(resume, derniere.code)}</p>
                </div>
              </div>
              <button className="btn btn-or" onClick={() => void connexion.reprendre(derniere)}>
                Reprendre ma partie
              </button>
            </section>
          )}

          {horsLigne && (
            <section className="carte-mode carte-en-cours" aria-label="Partie hors ligne en cours">
              <div className="carte-mode-entete">
                <span className="carte-mode-icone">
                  <Icone nom="robot" taille={30} />
                </span>
                <div>
                  <h2>Partie hors ligne en cours</h2>
                  <p>
                    {AFFAIRES[horsLigne.affaire].court} · Manche {horsLigne.manche} / {horsLigne.manchesMax} · {horsLigne.joueurs} joueurs · {depuis(horsLigne.t)}
                  </p>
                </div>
              </div>
              <button className="btn btn-or" onClick={() => reprendrePartieHorsLigne()}>
                Reprendre ma partie
              </button>
            </section>
          )}

          <section className="choix-menu">
            <button
              className={`bouton-menu ${derniere || horsLigne ? 'bouton-menu-contour' : 'bouton-menu-or'}`}
              aria-expanded={ouverte === 'multi'}
              aria-controls="zone-multi"
              onClick={() => basculer('multi')}
            >
              <span className="bouton-menu-titre">Jouer entre amis</span>
              <span className="bouton-menu-detail">De 3 à 6 joueurs, chacun sur son téléphone</span>
            </button>
            {ouverte === 'multi' && (
              <div id="zone-multi" className="choix-menu-contenu">
                <button className={`btn ${derniere ? '' : 'btn-or'}`} onClick={() => ouvrir('creer')}>
                  Créer une partie
                </button>
                <button className="btn" onClick={() => ouvrir('rejoindre')}>
                  Rejoindre une partie
                </button>
                {comptes ? (
                  <button className="btn" onClick={() => setCharger('multi')}>
                    Charger une partie
                  </button>
                ) : (
                  <button className="btn" disabled={lecture} onClick={() => fichier.current?.click()}>
                    {lecture ? 'Reprise…' : 'Reprendre une sauvegarde'}
                  </button>
                )}
              </div>
            )}
            <input ref={fichier} type="file" accept=".json,application/json" hidden onChange={(e) => void lireFichier(e)} />
            {erreurFichier && (
              <p className="erreur petit" role="alert" style={{ margin: 0 }}>
                {erreurFichier}
              </p>
            )}
          </section>

          <section className="choix-menu">
            <button className="bouton-menu bouton-menu-contour" aria-expanded={ouverte === 'solo'} aria-controls="zone-solo" onClick={() => basculer('solo')}>
              <span className="bouton-menu-titre">Seul contre des bots</span>
              <span className="bouton-menu-detail">Contre 2 à 5 bots, même sans internet</span>
            </button>
            {ouverte === 'solo' && (
              <div id="zone-solo" className="choix-menu-contenu">
                <FormulaireSolo prefs={prefs} majPrefs={majPrefs} />
                {comptes && (
                  <button className="btn btn-bloc" onClick={() => setCharger('solo')}>
                    Charger une partie solo
                  </button>
                )}
              </div>
            )}
          </section>

          {!guidesFinis && (
            <button className="bouton-menu bouton-menu-discret" onClick={() => setChoixGuide(true)}>
              <span className="bouton-menu-titre">Apprendre à jouer</span>
              <span className="bouton-menu-detail">
                {guidesTermines.length
                  ? `Encore un rôle à découvrir : ${guidesTermines.includes('enqueteur') ? 'le complice' : "l'enquêteur"}`
                  : 'Une partie guidée de 5 minutes'}
              </span>
            </button>
          )}

          <details className="affaires-deroulant">
            <summary>
              Les histoires <span className="muet">({AFFAIRES_IDS.length})</span>
            </summary>
            <ul className="cartes-histoires" aria-label="Les histoires">
              {AFFAIRES_IDS.map((a) => (
                <li key={a} className="carte-histoire">
                  <div className="portraits-histoire" aria-hidden="true">
                    {elementsDe(a).suspects.map((id) => (
                      <Embleme key={id} id={id} taille={34} />
                    ))}
                  </div>
                  <strong>{AFFAIRES[a].court}</strong>
                  <span className="petit">{AFFAIRES[a].accroche}</span>
                  <button className="btn btn-discret btn-petit" onClick={() => setRegles(a)}>
                    Lire l'histoire
                  </button>
                </li>
              ))}
            </ul>
          </details>

          {installation !== 'indisponible' && (
            <div className="ligne accueil-secondaire">
              <button className="btn btn-discret" onClick={() => (installation === 'invitation' ? void installer() : setAideIos(true))}>
                Installer le jeu sur cet appareil
              </button>
            </div>
          )}
          <p className="muet petit" style={{ margin: 0 }}>
            Un crime, six suspects, un huis clos… et un complice parmi vous · 15 à 30 minutes
          </p>
        </div>
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
          {compte ? (
            <NomDuCompte nom={compte.nom} />
          ) : (
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
          )}
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

      {regles !== false && (
        <ModaleRegles onFermer={() => setRegles(false)} affaire={regles === true ? undefined : regles} section={regles === true ? 'regles' : 'dossier'} />
      )}
      {aideIos && (
        <Modale titre="Installer le jeu sur l'iPhone" onFermer={() => setAideIos(false)}>
          <ol className="etapes-installation">
            <li>
              Ouvrez cette page dans <strong>Safari</strong>.
            </li>
            <li>
              Touchez le bouton <strong>Partager</strong> (le carré avec une flèche vers le haut).
            </li>
            <li>
              Choisissez <strong>Sur l'écran d'accueil</strong>, puis <strong>Ajouter</strong>.
            </li>
          </ol>
          <p className="petit muet" style={{ marginBottom: 0 }}>
            Le jeu aura son icône et s'ouvrira en plein écran, sans la barre du navigateur.
          </p>
        </Modale>
      )}
      {choixGuide && (
        <Modale titre="Partie guidée" onFermer={() => setChoixGuide(false)}>
          <p>Une vraie partie contre deux bots, avec un guide qui vous montre où cliquer. Quel rôle voulez-vous apprendre ?</p>
          <div className="choix-guide">
            <button className="btn btn-or" onClick={() => guider('enqueteur')}>
              🔎 Enquêteur{guidesTermines.includes('enqueteur') ? ' ✓' : ''}
              <span className="petit">Pour commencer : hypothèses, carnet, archives, accusation.</span>
            </button>
            <button className="btn" onClick={() => guider('complice')}>
              🎭 Complice{guidesTermines.includes('complice') ? ' ✓' : ''}
              <span className="petit">Ensuite : mentir, falsifier, trafiquer un dossier sans se faire démasquer.</span>
            </button>
          </div>
        </Modale>
      )}
      {charger && (
        <ModaleCharger
          type={charger}
          pseudo={prefs.pseudo}
          onConnecte={surConnexion}
          onFermer={() => setCharger(null)}
          onFichier={() => {
            setCharger(null);
            fichier.current?.click();
          }}
        />
      )}
      {fenetreCompte && <ModaleCompte pseudo={prefs.pseudo} onConnecte={surConnexion} onFermer={() => setFenetreCompte(false)} />}
      {profil && <ModaleProfil onFermer={() => setProfil(false)} onGuide={revoirGuide} pseudo={prefs.pseudo} />}
      {parametres && <ModaleParametres prefs={prefs} majPrefs={majPrefs} onFermer={() => setParametres(false)} onGuide={revoirGuide} />}
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
              <button className="btn btn-or" onClick={() => guider('enqueteur')}>
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

/** Connecté à un compte : on joue sous son nom, sans champ à remplir. */
function NomDuCompte({ nom }: { nom: string }) {
  return (
    <p className="nom-du-compte">
      Vous jouez sous le nom de votre compte : <strong>{nom}</strong>
    </p>
  );
}

/** Partie seul contre des bots : quelques réglages, puis l'enquête commence aussitôt. */
function FormulaireSolo({ prefs, majPrefs }: { prefs: Preferences; majPrefs: (p: Partial<Preferences>) => void }) {
  const { compte, statut } = useConnexion();
  const [pseudo, setPseudo] = useState(prefs.pseudo);
  const [bots, setBots] = useState(3);
  const [duree, setDuree] = useState<number | null>(null);
  const [mode, setMode] = useState<'ruse' | 'classique'>('ruse');
  const [cartes, setCartes] = useState<'visibles' | 'anonymes'>('visibles');
  const [affaire, setAffaire] = useState<ChoixAffaire>(AFFAIRE_PAR_DEFAUT);
  const [modeJeu, setModeJeu] = useState<ModeJeu>('classique');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // La Grande enquête se joue à 4 joueurs au moins : 3 bots au minimum.
  const minBots = modeJeu === 'grande' ? 3 : 2;
  const choisirMode = (m: ModeJeu) => {
    setModeJeu(m);
    if (m === 'grande' && bots < 3) setBots(3);
  };
  const lancer = async (e: FormEvent) => {
    e.preventDefault();
    const nom = compte?.nom ?? pseudo;
    if (!nom.trim()) return setErreur('Choisissez un pseudonyme.');
    setEnvoi(true);
    setErreur(null);
    if (!compte) majPrefs({ pseudo: pseudo.trim() });
    if (statut === 'deconnecte') {
      // Pas de connexion : la partie se joue entièrement sur cet appareil.
      setEnvoi(false);
      lancerPartieHorsLigne({ nom: nom.trim(), bots, dureeTourS: duree, modeComplice: mode, affaire, historiqueCartes: cartes, mode: modeJeu });
      return;
    }
    const r = await connexion.solo(nom, bots, duree, mode, affaire, cartes, modeJeu);
    setEnvoi(false);
    if (!r.ok) setErreur(r.erreur);
  };
  return (
    <form onSubmit={lancer} noValidate className="formulaire-solo">
        {compte ? (
          <NomDuCompte nom={compte.nom} />
        ) : (
          <div className="champ">
            <label htmlFor="pseudo-solo">Votre pseudonyme</label>
            <input id="pseudo-solo" value={pseudo} maxLength={PSEUDO_MAX} onChange={(e) => setPseudo(e.target.value)} autoComplete="nickname" />
          </div>
        )}
        <div className="champ">
          <label htmlFor="mode-jeu-solo">Mode de jeu</label>
          <select id="mode-jeu-solo" value={modeJeu} onChange={(e) => choisirMode(e.target.value as ModeJeu)}>
            <option value="classique">Partie classique</option>
            <option value="grande">Grande enquête (plus longue)</option>
          </select>
          {modeJeu === 'grande' && (
            <p className="petit muet" style={{ margin: '6px 0 0' }}>
              La Grande enquête dure plus longtemps (14 manches, 4 joueurs au moins) : on cherche aussi le mobile, chacun reçoit un rôle secret avec un pouvoir, le complice a un objectif secret, un tableau d'enquête est partagé, et on a 3 points d'action par tour. À 5 et 6 joueurs, un Maître chanteur joue pour lui seul.
            </p>
          )}
        </div>
        <div className="champ">
          <label htmlFor="affaire-solo">Affaire</label>
          <select id="affaire-solo" value={affaire} onChange={(e) => setAffaire(e.target.value as ChoixAffaire)}>
            {CHOIX_AFFAIRES.map((a) => (
              <option key={a} value={a}>
                {a === 'aleatoire' ? 'Au hasard (surprise au lancement)' : AFFAIRES[a].court}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label htmlFor="nb-bots">Adversaires</label>
          <select id="nb-bots" value={bots} onChange={(e) => setBots(Number(e.target.value))}>
            {[2, 3, 4, 5].filter((n) => n >= minBots).map((n) => (
              <option key={n} value={n}>
                {n} bots ({n + 1} joueurs){n === 3 ? ' (conseillé)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label htmlFor="duree-solo">Durée de vos tours</label>
          <select id="duree-solo" value={duree === null ? 'aucune' : String(duree)} onChange={(e) => setDuree(e.target.value === 'aucune' ? null : Number(e.target.value))}>
            {DUREES_TOUR.map((d) => (
              <option key={String(d)} value={d === null ? 'aucune' : String(d)}>
                {libelleDuree(d)}
                {d === null ? ' (conseillé)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label htmlFor="mode-solo">Complice</label>
          <select id="mode-solo" value={mode} onChange={(e) => setMode(e.target.value as 'ruse' | 'classique')}>
            <option value="ruse">Rusé (conseillé)</option>
            <option value="classique">Classique</option>
          </select>
        </div>
        <div className="champ">
          <label htmlFor="cartes-solo">Cartes vues pendant la partie</label>
          <select id="cartes-solo" value={cartes} onChange={(e) => setCartes(e.target.value as 'visibles' | 'anonymes')}>
            <option value="visibles">Notées dans l'historique (conseillé)</option>
            <option value="anonymes">À retenir de mémoire (difficile)</option>
          </select>
          <p className="petit muet" style={{ margin: '6px 0 0' }}>
            {cartes === 'anonymes' ? "À retenir de mémoire : vous voyez la carte sur le moment, puis elle n'est plus rappelée nulle part. N'oubliez pas de la noter dans votre carnet !" : "Notées dans l'historique : les cartes qu'on vous montre et que vous montrez restent écrites dans l'historique."}
          </p>
        </div>
        {erreur && (
          <div className="erreur" role="alert">
            {erreur}
          </div>
        )}
        {statut === 'deconnecte' && (
          <p className="petit muet" style={{ margin: '4px 0 0' }}>
            Pas de connexion : la partie se jouera hors ligne, sur cet appareil.
          </p>
        )}
        <button type="submit" className="btn btn-or btn-bloc" disabled={envoi} style={{ marginTop: 8 }}>
          {envoi ? 'Lancement…' : statut === 'deconnecte' ? "Lancer l'enquête hors ligne" : "Lancer l'enquête"}
        </button>
      </form>
  );
}

// Les paramètres sont dans components/Parametres.tsx (ré-exportés pour les imports existants).
export { ModaleParametres };
