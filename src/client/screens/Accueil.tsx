import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { jouer } from '../sons';
import { AFFAIRES } from '../../shared/data/catalogue';
import { AFFAIRES_IDS, AFFAIRE_PAR_DEFAUT, elementsDe, type AffaireId } from '../../shared/types';
import { grade, lireProfil } from '../profil';
import { DUREES_TOUR, PSEUDO_MAX } from '../../shared/protocole';
import { ModaleProfil } from '../components/Profil';
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

type Mode = 'menu' | 'creer' | 'rejoindre';

/** Ligne de la carte « Partie en cours » : histoire, manche, joueurs, dernière activité. */
function texteResume(r: ResumePartie | null, code: string): string {
  if (!r || r.code !== code) return `Salon ${code}`;
  const etape = r.statut === 'lobby' ? "Salon d'attente" : `Manche ${r.manche} / ${r.manchesMax}`;
  return `${AFFAIRES[r.affaire]?.court ?? 'Partie'} · ${etape} · ${r.joueurs} joueurs · ${depuis(r.t)}`;
}

export function Accueil({ prefs, majPrefs }: { prefs: Preferences; majPrefs: (p: Partial<Preferences>) => void }) {
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
    if (f.size > 4_000_000) return setErreurFichier("Ce fichier n'est pas une sauvegarde de Dossier Secret.");
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
      <div className="logo">
        <Sceau taille={104} />
        <h1>Dossier Secret</h1>
        <div className="sous-titre">Enquête et bluff entre amis</div>
      </div>

      {mode === 'menu' && (
        <>
          <p style={{ maxWidth: 560, color: 'var(--ivoire-doux)' }}>
            Un crime, six suspects, un huis clos coupé du monde. Menez l'enquête entre amis… mais méfiez-vous : l'un de vous protège le meurtrier.
          </p>
          {!guidesFinis && (
            <section className="carte-apprendre" aria-label="Apprendre à jouer">
              <span className="carte-mode-icone">
                <Icone nom="livre" taille={28} />
              </span>
              <span className="carte-apprendre-texte">
                <strong>{guidesTermines.length ? 'Encore un rôle à découvrir' : 'Nouveau ? Apprenez à jouer en 5 minutes'}</strong>
                <span>
                  {guidesTermines.length
                    ? `Faites la partie guidée ${guidesTermines.includes('enqueteur') ? 'du complice' : "de l'enquêteur"} pour connaître tous les secrets du jeu.`
                    : 'Une vraie partie contre deux bots, avec un guide qui vous montre où toucher à chaque étape.'}
                </span>
              </span>
              <button className="btn btn-or" onClick={() => setChoixGuide(true)}>
                Apprendre à jouer
              </button>
            </section>
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

          <div className="accueil-actions">
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

            <section className={`carte-mode${ouverte === 'multi' ? ' ouverte' : ''}`}>
              <button className="carte-mode-entete" aria-expanded={ouverte === 'multi'} aria-controls="zone-multi" onClick={() => basculer('multi')}>
                <span className="carte-mode-icone">
                  <Icone nom="joueurs" taille={30} />
                </span>
                <span className="carte-mode-texte">
                  <span className="carte-mode-titre">Multijoueur</span>
                  <span>De 3 à 6 joueurs, chacun sur son téléphone : créez un salon et envoyez le code à vos amis.</span>
                </span>
                <span className="carte-mode-chevron" aria-hidden="true">
                  ▾
                </span>
              </button>
              {ouverte === 'multi' && (
                <div id="zone-multi" className="carte-mode-contenu">
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

            <section className={`carte-mode${ouverte === 'solo' ? ' ouverte' : ''}`}>
              <button className="carte-mode-entete" aria-expanded={ouverte === 'solo'} aria-controls="zone-solo" onClick={() => basculer('solo')}>
                <span className="carte-mode-icone">
                  <Icone nom="joueur" taille={30} />
                </span>
                <span className="carte-mode-texte">
                  <span className="carte-mode-titre">Seul contre des bots</span>
                  <span>Une enquête quand vous voulez, contre 2 à 5 bots. L'un de vous joue double jeu : peut-être un bot… peut-être vous.</span>
                </span>
                <span className="carte-mode-chevron" aria-hidden="true">
                  ▾
                </span>
              </button>
              {ouverte === 'solo' && (
                <div id="zone-solo" className="carte-mode-contenu">
                  <FormulaireSolo prefs={prefs} majPrefs={majPrefs} />
                  {comptes && (
                    <button className="btn btn-bloc" onClick={() => setCharger('solo')}>
                      Charger une partie solo
                    </button>
                  )}
                </div>
              )}
            </section>

            {installation !== 'indisponible' && (
              <div className="ligne accueil-secondaire">
                <button className="btn btn-discret" onClick={() => (installation === 'invitation' ? void installer() : setAideIos(true))}>
                  Installer le jeu sur cet appareil
                </button>
              </div>
            )}
            <p className="muet petit" style={{ margin: 0 }}>
              15 à 30 minutes · navigateur, tablette ou smartphone
            </p>
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
  const { compte } = useConnexion();
  const [pseudo, setPseudo] = useState(prefs.pseudo);
  const [bots, setBots] = useState(3);
  const [duree, setDuree] = useState<number | null>(null);
  const [mode, setMode] = useState<'ruse' | 'classique'>('ruse');
  const [cartes, setCartes] = useState<'visibles' | 'anonymes'>('visibles');
  const [affaire, setAffaire] = useState<AffaireId>(AFFAIRE_PAR_DEFAUT);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const lancer = async (e: FormEvent) => {
    e.preventDefault();
    const nom = compte?.nom ?? pseudo;
    if (!nom.trim()) return setErreur('Choisissez un pseudonyme.');
    setEnvoi(true);
    setErreur(null);
    if (!compte) majPrefs({ pseudo: pseudo.trim() });
    const r = await connexion.solo(nom, bots, duree, mode, affaire, cartes);
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
          <label htmlFor="affaire-solo">Affaire</label>
          <select id="affaire-solo" value={affaire} onChange={(e) => setAffaire(e.target.value as AffaireId)}>
            {AFFAIRES_IDS.map((a) => (
              <option key={a} value={a}>
                {AFFAIRES[a].court}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label htmlFor="nb-bots">Adversaires</label>
          <select id="nb-bots" value={bots} onChange={(e) => setBots(Number(e.target.value))}>
            {[2, 3, 4, 5].map((n) => (
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
        <button type="submit" className="btn btn-or btn-bloc" disabled={envoi} style={{ marginTop: 8 }}>
          {envoi ? 'Lancement…' : "Lancer l'enquête"}
        </button>
      </form>
  );
}

export function ModaleParametres({
  prefs,
  majPrefs,
  onFermer,
  onGuide,
}: {
  prefs: Preferences;
  majPrefs: (p: Partial<Preferences>) => void;
  onFermer: () => void;
  /** Depuis l'accueil seulement : relancer une partie guidée. */
  onGuide?: () => void;
}) {
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
      {onGuide && (
        <div className="champ" style={{ marginTop: 14 }}>
          <button className="btn btn-petit" onClick={onGuide}>
            🎓 Refaire une partie guidée
          </button>
        </div>
      )}
    </Modale>
  );
}

