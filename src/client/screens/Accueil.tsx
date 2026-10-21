import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { jouer } from '../sons';
import { AFFAIRES } from '../../shared/data/catalogue';
import { AFFAIRES_IDS, AFFAIRE_PAR_DEFAUT, elementsDe, type AffaireId } from '../../shared/types';
import { Ambiance, type TypeAmbiance } from '../components/Ambiance';
import { grade, lireProfil } from '../profil';
import { DUREES_TOUR, PSEUDO_MAX } from '../../shared/protocole';
import { ModaleProfil } from '../components/Profil';
import { libelleDuree } from './Lobby';
import { Modale } from '../components/Commun';
import { Embleme, Icone, Sceau } from '../components/Emblemes';
import { connexion, lireResume, type ResumePartie } from '../connexion';
import { installer, useInstallation } from '../installation';
import type { Preferences } from '../preferences';
import { ModaleRegles } from './Regles';
import { lancerPartieGuidee, type RoleGuide } from '../tutoriel/partieLocale';

type Mode = 'menu' | 'creer' | 'rejoindre';

/** « il y a 5 min », « il y a 2 h », « il y a 3 jours ». */
function depuis(t: number): string {
  const min = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} jour${j > 1 ? 's' : ''}`;
}

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
  // Ambiance de l'accueil : la pluie du manoir ou la neige du train, au hasard à chaque visite.
  const [ambiance] = useState<TypeAmbiance>(() => (Math.random() < 0.5 ? 'pluie' : 'neige'));
  const [profilLocal] = useState(lireProfil);
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
  const [solo, setSolo] = useState(false);
  const [profil, setProfil] = useState(false);
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
    lancerPartieGuidee(prefs.pseudo.trim(), role);
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
      <Ambiance type={ambiance} />
      {mode === 'menu' && (
        <div className="accueil-haut">
          <button className="puce-profil" onClick={() => setProfil(true)} aria-label={`Mon profil : ${gradeActuel.titre}`}>
            <span className="puce-profil-icone">
              <Icone nom="insigne" taille={22} />
            </span>
            <span className="puce-profil-texte">
              <strong>{prefs.pseudo.trim() || 'Mon profil'}</strong>
              <span>
                {gradeActuel.titre} · {profilLocal.victoires} victoire{profilLocal.victoires > 1 ? 's' : ''}
              </span>
            </span>
          </button>
          <span className="espace" />
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

            <section className="carte-mode" aria-labelledby="titre-multijoueur">
              <div className="carte-mode-entete">
                <span className="carte-mode-icone">
                  <Icone nom="joueurs" taille={30} />
                </span>
                <div>
                  <h2 id="titre-multijoueur">Multijoueur</h2>
                  <p>3 à 6 joueurs, chacun sur son appareil. Créez un salon et partagez son code.</p>
                </div>
              </div>
              <button className={`btn ${derniere ? '' : 'btn-or'}`} onClick={() => ouvrir('creer')}>
                Créer une partie
              </button>
              <button className="btn" onClick={() => ouvrir('rejoindre')}>
                Rejoindre une partie
              </button>
              <button className="btn" disabled={lecture} onClick={() => fichier.current?.click()}>
                {lecture ? 'Reprise…' : 'Reprendre une sauvegarde'}
              </button>
              <input ref={fichier} type="file" accept=".json,application/json" hidden onChange={(e) => void lireFichier(e)} />
              {erreurFichier && (
                <p className="erreur petit" role="alert" style={{ margin: 0 }}>
                  {erreurFichier}
                </p>
              )}
            </section>

            <section className="carte-mode" aria-labelledby="titre-solo">
              <div className="carte-mode-entete">
                <span className="carte-mode-icone">
                  <Icone nom="loupe" taille={30} />
                </span>
                <div>
                  <h2 id="titre-solo">Seul contre des bots</h2>
                  <p>Une vraie partie face à 2 à 5 joueurs automatiques, à votre rythme.</p>
                </div>
              </div>
              <button className="btn" onClick={() => setSolo(true)}>
                Jouer contre des bots
              </button>
            </section>

            {(!guidesFinis || installation !== 'indisponible') && (
              <div className="ligne accueil-secondaire">
                {!guidesFinis && (
                  <button className="btn btn-discret" onClick={() => setChoixGuide(true)}>
                    Apprendre à jouer (partie guidée)
                  </button>
                )}
                {installation !== 'indisponible' && (
                  <button className="btn btn-discret" onClick={() => (installation === 'invitation' ? void installer() : setAideIos(true))}>
                    Installer le jeu sur cet appareil
                  </button>
                )}
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
      {solo && <ModaleSolo prefs={prefs} majPrefs={majPrefs} onFermer={() => setSolo(false)} />}
      {profil && <ModaleProfil onFermer={() => setProfil(false)} onGuide={revoirGuide} pseudo={prefs.pseudo} onPseudo={(p) => majPrefs({ pseudo: p })} />}
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

/** Partie seul contre des bots : quelques réglages, puis l'enquête commence aussitôt. */
function ModaleSolo({ prefs, majPrefs, onFermer }: { prefs: Preferences; majPrefs: (p: Partial<Preferences>) => void; onFermer: () => void }) {
  const [pseudo, setPseudo] = useState(prefs.pseudo);
  const [bots, setBots] = useState(3);
  const [duree, setDuree] = useState<number | null>(null);
  const [mode, setMode] = useState<'ruse' | 'classique'>('ruse');
  const [affaire, setAffaire] = useState<AffaireId>(AFFAIRE_PAR_DEFAUT);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const lancer = async (e: FormEvent) => {
    e.preventDefault();
    if (!pseudo.trim()) return setErreur('Choisissez un pseudonyme.');
    setEnvoi(true);
    setErreur(null);
    majPrefs({ pseudo: pseudo.trim() });
    const r = await connexion.solo(pseudo, bots, duree, mode, affaire);
    setEnvoi(false);
    if (!r.ok) setErreur(r.erreur);
  };
  return (
    <Modale titre="Jouer contre des bots" onFermer={onFermer}>
      <form onSubmit={lancer} noValidate>
        <p className="muet petit" style={{ marginTop: 0 }}>
          Une vraie partie, seul face à des joueurs automatiques. L'un d'eux sera peut-être le complice… ou ce sera vous.
        </p>
        <div className="champ">
          <label htmlFor="pseudo-solo">Votre pseudonyme</label>
          <input id="pseudo-solo" value={pseudo} maxLength={PSEUDO_MAX} onChange={(e) => setPseudo(e.target.value)} autoComplete="nickname" />
        </div>
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
        {erreur && (
          <div className="erreur" role="alert">
            {erreur}
          </div>
        )}
        <div className="ligne" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-discret" onClick={onFermer}>
            Annuler
          </button>
          <span className="espace" />
          <button type="submit" className="btn btn-or" disabled={envoi}>
            {envoi ? 'Lancement…' : "Lancer l'enquête"}
          </button>
        </div>
      </form>
    </Modale>
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

