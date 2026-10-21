// Emplacements de sauvegarde : 3 pour les parties solo, 3 pour les parties multijoueur.
// - En partie (menu ☰ → Sauvegarder la partie) : on choisit l'emplacement où enregistrer.
// - À l'accueil (« Charger une partie ») : on recharge, ou on efface, une partie enregistrée.
// Les emplacements sont rangés sur le serveur sous le code joueur de l'appareil.

import { useEffect, useState, type ReactNode } from 'react';
import { AFFAIRES } from '../../shared/data/catalogue';
import { NB_EMPLACEMENTS, type EtatClient, type InfoEmplacement, type TypePartie } from '../../shared/protocole';
import { changerCodeJoueur, codeJoueur, connexion, useConnexion } from '../connexion';
import { Modale } from './Commun';
import { Icone } from './Emblemes';

/** « à l'instant », « il y a 5 min », « il y a 2 h », « il y a 3 jours ». */
export function depuis(t: number): string {
  const min = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} jour${j > 1 ? 's' : ''}`;
}

const NUMEROS = Array.from({ length: NB_EMPLACEMENTS }, (_, i) => i + 1);

/** Les emplacements d'un type (solo ou multijoueur), lus sur le serveur. */
function useEmplacements(type: TypePartie) {
  const [liste, setListe] = useState<InfoEmplacement[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tour, setTour] = useState(0);
  const { statut } = useConnexion();
  useEffect(() => {
    if (statut !== 'connecte') return;
    let actif = true;
    setErreur(null);
    void connexion.listerEmplacements().then((r) => {
      if (!actif) return;
      if (r.ok) setListe(r.emplacements.filter((e) => e.type === type));
      else setErreur(r.erreur);
    });
    return () => {
      actif = false;
    };
  }, [type, tour, statut]);
  return { liste, erreur, recharger: () => setTour((x) => x + 1) };
}

/** Une ligne d'emplacement : son contenu (ou « Vide ») et ses boutons. */
function Emplacement({ numero, info, actif, children }: { numero: number; info?: InfoEmplacement; actif?: boolean; children?: ReactNode }) {
  const r = info?.resume;
  const avec =
    info?.type === 'solo'
      ? `Contre ${r!.bots} bot${r!.bots > 1 ? 's' : ''}`
      : r && r.autres.length
        ? `Avec ${r.autres.join(', ')}${r.bots ? ` et ${r.bots} bot${r.bots > 1 ? 's' : ''}` : ''}`
        : r
          ? `Avec ${r.bots} bot${r.bots > 1 ? 's' : ''}`
          : '';
  return (
    <li className={`emplacement${info ? '' : ' emplacement-vide'}${actif ? ' emplacement-actif' : ''}`}>
      <span className="emplacement-numero" aria-hidden="true">
        {numero}
      </span>
      <span className="emplacement-texte">
        {info && r ? (
          <>
            <strong>
              {AFFAIRES[r.affaire]?.court ?? 'Partie'} · Manche {r.manche} / {r.manchesMax}
            </strong>
            <span>{avec}</span>
            <span className="muet">
              {r.nom ? `${r.nom} · ` : ''}enregistrée {depuis(info.t)}
            </span>
          </>
        ) : (
          <>
            <strong className="muet">Emplacement {numero}</strong>
            <span className="muet">Vide</span>
          </>
        )}
      </span>
      {children && <span className="emplacement-actions">{children}</span>}
    </li>
  );
}

/** Code joueur de l'appareil : à noter pour retrouver ses sauvegardes ailleurs, ou à remplacer par celui d'un autre appareil. */
function CodeJoueur({ onChange }: { onChange: () => void }) {
  const [code, setCode] = useState(codeJoueur);
  const [saisie, setSaisie] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setMessage('Code copié.');
    } catch {
      setMessage('Copie impossible : recopiez le code à la main.');
    }
  };
  const valider = () => {
    if (saisie === null) return;
    if (!changerCodeJoueur(saisie)) return setMessage('Ce code ne convient pas : il fait 12 caractères, par exemple ABCD-EFGH-JK23.');
    setCode(codeJoueur());
    setSaisie(null);
    setMessage('Code changé : voici les sauvegardes de ce code.');
    onChange();
  };
  return (
    <div className="code-joueur">
      <p className="petit" style={{ margin: 0 }}>
        Vos sauvegardes sont rangées sous votre <strong>code joueur</strong> :
      </p>
      <div className="ligne">
        <span className="code-joueur-valeur">{code}</span>
        <button className="btn btn-petit btn-discret" onClick={() => void copier()}>
          <Icone nom="copie" /> Copier
        </button>
        {saisie === null && (
          <button className="btn btn-petit btn-discret" onClick={() => (setSaisie(''), setMessage(null))}>
            Utiliser un autre code
          </button>
        )}
      </div>
      {saisie !== null ? (
        <div className="ligne">
          <input
            aria-label="Code joueur d'un autre appareil"
            className="code-input"
            value={saisie}
            maxLength={14}
            placeholder="ABCD-EFGH-JK23"
            autoCapitalize="characters"
            autoComplete="off"
            autoFocus
            onChange={(e) => setSaisie(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && valider()}
          />
          <button className="btn btn-petit btn-or" onClick={valider}>
            Valider
          </button>
          <button className="btn btn-petit btn-discret" onClick={() => (setSaisie(null), setMessage(null))}>
            Annuler
          </button>
        </div>
      ) : (
        <p className="petit muet" style={{ margin: 0 }}>
          Notez-le : sur un autre téléphone ou ordinateur, « Utiliser un autre code » avec ce code y affiche les mêmes sauvegardes.
        </p>
      )}
      {message && (
        <p className="petit" role="status" style={{ margin: 0 }}>
          {message}
        </p>
      )}
    </div>
  );
}

/** Accueil : charger (ou effacer) une partie enregistrée. */
export function ModaleCharger({ type, onFermer, onFichier }: { type: TypePartie; onFermer: () => void; onFichier?: () => void }) {
  const { liste, erreur, recharger } = useEmplacements(type);
  const [effacer, setEffacer] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const charger = async (numero: number) => {
    setEnvoi(true);
    setErreurAction(null);
    const r = await connexion.chargerEmplacement(type, numero);
    setEnvoi(false);
    if (!r.ok) setErreurAction(r.erreur);
    // Sinon la partie s'affiche d'elle-même.
  };
  const confirmerEffacer = async (numero: number) => {
    setEnvoi(true);
    const r = await connexion.effacerEmplacement(type, numero);
    setEnvoi(false);
    setEffacer(null);
    if (!r.ok) setErreurAction(r.erreur);
    recharger();
  };
  return (
    <Modale
      titre={type === 'solo' ? 'Charger une partie solo' : 'Charger une partie multijoueur'}
      onFermer={onFermer}
      pied={
        <>
          {onFichier && (
            <button className="btn btn-discret" onClick={onFichier}>
              Depuis un fichier…
            </button>
          )}
          <span className="espace" />
          <button className="btn" onClick={onFermer}>
            Fermer
          </button>
        </>
      }
    >
      {erreur && (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      )}
      {!liste && !erreur && <p className="muet">Chargement des sauvegardes…</p>}
      {liste && (
        <ul className="emplacements">
          {NUMEROS.map((n) => {
            const info = liste.find((e) => e.numero === n);
            return (
              <Emplacement key={n} numero={n} info={info}>
                {info &&
                  (effacer === n ? (
                    <>
                      <button className="btn btn-petit btn-danger" disabled={envoi} onClick={() => void confirmerEffacer(n)}>
                        Effacer
                      </button>
                      <button className="btn btn-petit btn-discret" onClick={() => setEffacer(null)}>
                        Garder
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-petit btn-or" disabled={envoi} onClick={() => void charger(n)}>
                        Charger
                      </button>
                      <button className="btn btn-petit btn-discret" aria-label={`Effacer l'emplacement ${n}`} title="Effacer" onClick={() => setEffacer(n)}>
                        🗑
                      </button>
                    </>
                  ))}
              </Emplacement>
            );
          })}
        </ul>
      )}
      {erreurAction && (
        <p className="erreur petit" role="alert">
          {erreurAction}
        </p>
      )}
      {type === 'multi' && (
        <p className="petit muet">
          La partie reprend dans une salle d'attente : les autres joueurs reviennent avec le code du salon et <strong>le même pseudonyme</strong>.
        </p>
      )}
      <CodeJoueur onChange={recharger} />
    </Modale>
  );
}

/** En partie : choisir l'emplacement où enregistrer la partie. */
export function EnregistrerPartie({ etat }: { etat: EtatClient }) {
  const type: TypePartie = etat.salon.solo ? 'solo' : 'multi';
  const autorise = etat.salon.solo || etat.salon.hote === etat.moi;
  const { liste, erreur, recharger } = useEmplacements(type);
  const [remplacer, setRemplacer] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState<number | null>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);

  if (!autorise) {
    const hote = etat.salon.joueurs.find((j) => j.hote)?.nom ?? "l'hôte";
    return (
      <p>
        Seul l'hôte (<strong>{hote}</strong>) peut enregistrer cette partie dans ses emplacements de sauvegarde.
      </p>
    );
  }

  const enregistrer = async (numero: number) => {
    setEnvoi(true);
    setErreurAction(null);
    const r = await connexion.enregistrerEmplacement(numero);
    setEnvoi(false);
    setRemplacer(null);
    if (!r.ok) return setErreurAction(r.erreur);
    setFait(numero);
    recharger();
  };

  return (
    <>
      <p style={{ marginTop: 0 }}>
        Choisissez un emplacement{type === 'solo' ? ' (parties solo)' : ' (parties multijoueur)'}. Vous pourrez recharger la partie depuis l'accueil,{' '}
        {type === 'solo' ? '« Seul contre des bots » → « Charger une partie solo »' : '« Multijoueur » → « Charger une partie »'}.
      </p>
      {erreur && (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      )}
      {!liste && !erreur && <p className="muet">Chargement des emplacements…</p>}
      {liste && (
        <ul className="emplacements">
          {NUMEROS.map((n) => {
            const info = liste.find((e) => e.numero === n);
            return (
              <Emplacement key={n} numero={n} info={info} actif={fait === n}>
                {remplacer === n ? (
                  <>
                    <button className="btn btn-petit btn-danger" disabled={envoi} onClick={() => void enregistrer(n)}>
                      Remplacer
                    </button>
                    <button className="btn btn-petit btn-discret" onClick={() => setRemplacer(null)}>
                      Annuler
                    </button>
                  </>
                ) : (
                  <button className="btn btn-petit btn-or" disabled={envoi} onClick={() => (info ? setRemplacer(n) : void enregistrer(n))}>
                    {info ? 'Remplacer…' : 'Enregistrer ici'}
                  </button>
                )}
              </Emplacement>
            );
          })}
        </ul>
      )}
      {erreurAction && (
        <p className="erreur petit" role="alert">
          {erreurAction}
        </p>
      )}
      {fait !== null && (
        <p className="succes-sauvegarde" role="status">
          ✅ Partie enregistrée dans l'emplacement {fait}. Si vous continuez à jouer, pensez à l'enregistrer de nouveau avant de quitter.
        </p>
      )}
    </>
  );
}
